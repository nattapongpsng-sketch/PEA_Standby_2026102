/********************************************************************************
 * Code.gs (Full) — ระบบตารางเวร + สับเปลี่ยน + ลงชื่อปฏิบัติงาน + Export PDF
 * - รองรับหน้า index.html เวอร์ชันปรับปรุง (เมนูซ้าย / หลายหน้า / เดือนปัจจุบัน)
 * - ใช้ Script Properties เก็บกติกา (Rules) และลำดับการหมุนเวร (Sequence)
 * - ใช้ Cache เก็บ Session token (Login)
 * - เพิ่มขั้นตอน “ผู้แทน (Coverer) ต้องยอมรับ” ก่อนส่งให้ Editor อนุมัติ
 *
 * ✅ เพิ่มกฎ "ห้ามเป็นหัวหน้าเวร" (FORBIDDEN_LEADERS)
 *    - หากเป็นชื่อแรกของกะนั้น จะไม่ถือเป็นหัวหน้าเวร
 *    - กะที่มี 2 คน จะสลับชื่อให้คนต้องห้ามไม่เป็นคนแรก
 ********************************************************************************/

/* =============================================================================
 * CONFIG
 * ============================================================================= */
const BE_YEAR = getBEYear_();
const API_VERSION = 'standby-web-callFunction-v1';

function getBEYear_() {
  const override = PropertiesService.getScriptProperties().getProperty('BE_YEAR_OVERRIDE');
  return override ? Number(override) : new Date().getFullYear() + 543;
}

const TH_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const HEADER_ROWS = 3;
const START_DATA_ROW = 4;

const ROSTER_NAMES_SHEET = 'ชีต1';
const REQUESTS_SHEET     = 'Requests';
const ATTENDANCE_SHEET   = 'Attendance';
const OUTAGE_MEMORY_SHEET = 'OutageMemory';
const USERS_SHEET        = 'Users';

// โลโก้ PEA (fileId บน Google Drive)
const LOGO_FILE_ID = '1_YaVdSkEVkFfICqsUAXsNsU_vUpTzUvG';

// (ทางเลือก) โฟลเดอร์เก็บรูป Attendance — ถ้าว่างจะเก็บที่ My Drive ราก
const PHOTO_FOLDER_ID = '1bh9ZEiVureXKB8ImKt6T8SkpOA3eyTjO'; // ใส่ Folder ID ถ้าต้องการจัดระเบียบรูป



/* =============================================================================
 * AUTH (Cache Session)
 * - ระบบหลักตารางเวร: login() จะ put Cache เป็น {username, role, personName}
 * - Handover ต้องการ requireAuth_() เพื่อดึง payload มาตรฐาน (ok/user/role/personName)
 * ============================================================================= */
const TOKEN_TTL_SECONDS = 60 * 60 * 6; // 6 ชม.
const AUTH_PREFIX = 'auth_';

/**
 * อ่าน session จาก token (ตามรูปแบบระบบหลัก)
 * return: {username, role, personName} หรือ null
 */
function getSessionByToken_(token){
  token = String(token||'').trim();
  if(!token) return null;

  const raw = CacheService.getScriptCache().get(`${AUTH_PREFIX}${token}`);
  if(!raw) return null;

  try{
    const sess = JSON.parse(raw);
    if(!sess || !sess.role) return null;
    // normalize minimal fields
    return {
      username: String(sess.username||'').trim(),
      role: String(sess.role||'viewer').trim().toLowerCase(),
      personName: normalizeName_(sess.personName||'')
    };
  }catch(e){
    return null;
  }
}

function ensureLogged_(token){
  const sess = getSessionByToken_(token);
  if(!sess) throw new Error('ยังไม่ได้เข้าสู่ระบบหรือเซสชันหมดอายุ');
  return sess;
}

const ROLE_RANK = {
  viewer: 1,
  inspector: 2,
  editor: 3
};

function requireRole_(token, need){
  const sess = ensureLogged_(token);

  const needRole = String(need || 'viewer').trim().toLowerCase();
  const haveRole = String(sess.role || 'viewer').trim().toLowerCase();

  const needRank = ROLE_RANK[needRole] || 1;
  const haveRank = ROLE_RANK[haveRole] || 1;

  if (haveRank < needRank){
    throw new Error('ท่านไม่มีสิทธิ์ดำเนินการ');
  }

  return sess;
}

function getLoginPersonName_(token){
  const sess = ensureLogged_(token);
  return normalizeName_(sess.personName || '');
}

/**
 * ✅ COMPAT: ให้โค้ด Handover เรียกได้
 * - ตรวจ token ว่าถูกต้อง + คืน payload มาตรฐาน
 * return: {ok:true, user, role, personName, username}
 */
function requireAuth_(token){
  const sess = ensureLogged_(token);
  return {
    ok: true,
    user: sess.username,
    username: sess.username,
    role: sess.role,
    personName: sess.personName
  };
}

/**
 * ✅ เผื่อบางไฟล์เรียกชื่อ getAuthPayload_ (optional)
 */
function getAuthPayload_(token){
  return requireAuth_(token);
}



/* =============================================================================
 * RULES (Script Properties) ตั้งค่าเงื่อนไขเบื้องต้น
 * ============================================================================= */
const RULES_KEY = 'ROSTER_RULES_JSON';
const DEFAULT_RULES = {
  // ===== โครงใหม่ =====
  weekday: {
  s1Count: 2,
  s2Count: 1,
  s3Count: 2,
  s2IncludeInRotation: true,

  // ✅ ใหม่: ถ้า true ให้ใช้รายชื่อคงที่สำหรับกะ 2 วันปกติ
  s2FixedOverride: false,

  // ✅ ใหม่: รายชื่อคงที่ของกะ 2 วันปกติ
  s2FixedNames: [],

  hasReserve: false,
  reserveFrom: 'S3'
},
  holiday: {
    s1Count: 2,
    s2Count: 2,
    s3Count: 2,
    hasReserve: false,
    reserveFrom: 'S2'
  },

  // ===== ของเดิมคงไว้ก่อน =====
  s2WeekdayMode: 'fixed',
  s2WeekdayFixedName: '',
  s2HolidayCount: 2,
  preferLeader: true,
  reserveMode: 'none',
  reserveWeekdaySource: 'S3_second',
  reserveHolidaySource: 'S2_second',
  shiftHours: 8,
  countS2WeekdayHours: false,
  countReserveHours: false,
  manualStartName: '',
  startSequenceMode: 'auto_from_prev'
};

/* =============================================================================
 * HELPERS (string / date / misc)
 * ============================================================================= */
function normalizeName_(s){
  return String(s||'')
    .replace(/\u00A0/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function parseRole_(v){
  const s = String(v||'').toLowerCase();
  if(!s) return 'both';
  if(s.includes('หัว')) return 'lead';
  if(s.includes('ลูก')) return 'junior';
  return 'both';
}
function rotateIndex_(i,len){ return ((i%len)+len)%len; }

function nowText_(){
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(),'yyyy-MM-dd HH:mm:ss');
}
/** ============================================================================
 * CONFIG
 * ========================================================================== */
const FORBIDDEN_LEADERS_CACHE_KEY = 'forbidden_leaders_v1';
const FORBIDDEN_LEADERS_CACHE_TTL = 300; // วินาที (5 นาที)

/** ============================================================================
 * ✅ ดึงรายชื่อ "ห้ามเป็นหัวหน้าเวร" จากชีต1
 * เงื่อนไข:
 *   - คอลัมน์ A = ชื่อ
 *   - คอลัมน์ B มีคำว่า "ลูกเวร"
 * ใช้ CacheService เพื่อลดการอ่านชีตซ้ำ
 * ========================================================================== */
function getForbiddenLeaders_() {
  const cache = CacheService.getScriptCache();

  // 1) ลองอ่านจาก cache ก่อน
  const cached = cache.get(FORBIDDEN_LEADERS_CACHE_KEY);
  if (cached) {
    try {
      const arr = JSON.parse(cached);
      if (Array.isArray(arr)) return arr;
    } catch (err) {
      // ถ้า cache เสีย/parse ไม่ได้ ให้ตกไปอ่านจากชีตใหม่
    }
  }

  // 2) ถ้าไม่มี cache ค่อยอ่านจากชีต
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('ชีต1');
  if (!sh) return [];

  const lastRow = sh.getLastRow();
  if (lastRow < 1) return [];

  const values = sh.getRange(1, 1, lastRow, 2).getValues(); // A:B
  const names = [];

  values.forEach(row => {
    const name = String(row[0] || '').trim(); // คอลัมน์ A
    const role = String(row[1] || '').trim(); // คอลัมน์ B

    if (!name) return;

    // ถ้าในคอลัมน์ B มีคำว่า "ลูกเวร" ให้ถือว่าเป็น forbidden leader
    if (role.indexOf('ลูกเวร') !== -1) {
      names.push(name);
    }
  });

  // 3) กันชื่อซ้ำ โดยเทียบจาก normalize
  const map = {};
  names.forEach(name => {
    const key = normalizeName_(name);
    if (key) map[key] = name;
  });

  const result = Object.keys(map).map(k => map[k]);

  // 4) เก็บลง cache
  try {
    cache.put(
      FORBIDDEN_LEADERS_CACHE_KEY,
      JSON.stringify(result),
      FORBIDDEN_LEADERS_CACHE_TTL
    );
  } catch (err) {
    // ถ้า cache put ไม่ได้ ก็ยังคืนค่าปกติ
  }

  return result;
}

/** ============================================================================
 * ✅ ตรวจชื่อ "ห้ามเป็นหัวหน้าเวร"
 * ========================================================================== */
function isForbiddenLeader_(name) {
  const n = normalizeName_(name);
  if (!n) return false;

  const forbiddenLeaders = getForbiddenLeaders_();
  return forbiddenLeaders.some(x => normalizeName_(x) === n);
}

/** ============================================================================
 * ✅ ล้าง cache กรณีมีการแก้ชื่อ/สถานะในชีต1 แล้วอยากให้โหลดใหม่ทันที
 * ========================================================================== */
function clearForbiddenLeadersCache_() {
  CacheService.getScriptCache().remove(FORBIDDEN_LEADERS_CACHE_KEY);
}

/**
 * ✅ คืนหัวหน้าเวรของกะจากรายชื่อ (ตามนิยาม "คนแรก" แต่ข้ามชื่อที่ต้องห้าม)
 * - ถ้าคนแรกเป็นต้องห้าม จะพยายามใช้คนถัดไปแทน (ถ้ามี)
 * - ถ้าทุกคนเป็นต้องห้าม/ไม่มีชื่อ -> คืน ''
 */
function pickLeaderName_(names){
  const arr = (names||[]).map(normalizeName_).filter(Boolean);
  for(const n of arr){
    if(!isForbiddenLeader_(n)) return n;
  }
  return '';
}

/**
 * ✅ จัดเรียงคู่ (2 คน) ให้คนที่ต้องห้าม "ไม่อยู่คนแรก"
 * - ถ้าคนแรกเป็นต้องห้าม และคนที่สองไม่ต้องห้าม -> สลับ
 * - กรณีอื่นคงเดิม
 */
function ensureForbiddenNotFirstPair_(aName, bName){
  const a = normalizeName_(aName);
  const b = normalizeName_(bName);
  if(a && b && isForbiddenLeader_(a) && !isForbiddenLeader_(b)){
    return [b, a];
  }
  return [aName, bName];
}

/**
 * แปลงบรรทัด “กะX (...): A, B” -> [A,B]
 * รองรับหลายรูปแบบ (มี/ไม่มี “):”)
 */
function extractPeople_(line){
  const raw = String(line||'').trim();
  if(!raw) return [];
  const m = raw.match(/\):\s*(.+)$/);
  const tail = m ? m[1] : raw.split(':').slice(1).join(':');
  return tail.split(',')
    .map(s=>normalizeName_(s))
    .filter(Boolean);
}

function safeGetMonthSheet_(beYear, monthIdx){
  const name = `${TH_MONTHS[monthIdx-1]}${beYear}`;
  return SpreadsheetApp.getActive().getSheetByName(name) || null;
}

/** ล้างและเขียนรายการบรรทัดลง “คอลัมน์วัน” (คอลัมน์ตามวันที่) */
function writeLinesToDay_(sh, col, lines){
  const lastRow = Math.max(sh.getLastRow(), START_DATA_ROW);
  if(lastRow >= START_DATA_ROW){
    sh.getRange(START_DATA_ROW, col, lastRow-START_DATA_ROW+1, 1).clearContent();
  }
  if(lines && lines.length){
    sh.getRange(START_DATA_ROW, col, lines.length, 1).setValues(lines.map(v=>[v]));
  }
}

/* =============================================================================
 * WEBEX NOTIFY
 * - roomId: ใช้ค่า UUID จากลิงก์ webexteams://im?space=...
 * ============================================================================= */
const WEBEX_TOKEN_PROP = 'WEBEX_TOKEN';
const WEBEX_ROOM_ID_PROP = 'WEBEX_ROOM_ID';

function getScriptProp_(key, defaultValue){
  const v = PropertiesService.getScriptProperties().getProperty(key);
  return v == null || v === '' ? (defaultValue || '') : String(v);
}

function getWebexConfig_(){
  return {
    token: getScriptProp_(WEBEX_TOKEN_PROP, ''),
    roomId: getScriptProp_(WEBEX_ROOM_ID_PROP, '')
  };
}

// ===== SHIFT NOTIFY (ล่วงหน้า) =====
const SHIFT_NOTIFY_MIN_BEFORE = 120; // แจ้งล่วงหน้า 2 ชม.
const SHIFT_NOTIFY_POLL_MIN   = 10;  // trigger วิ่งทุก 10 นาที
const SHIFT_NOTIFY_KEY_PREFIX = 'shiftNotifySent_'; // กันส่งซ้ำ


function sendWebexMarkdown_(markdown){
  const cfg = getWebexConfig_();
  const token = cfg.token;
  const roomId = cfg.roomId;

  if(!token || !roomId) return;

  const url = 'https://webexapis.com/v1/messages';
  const payload = { roomId, markdown: String(markdown || '') };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try{
    const res = UrlFetchApp.fetch(url, options);
    const code = res.getResponseCode();
    if(code < 200 || code >= 300){
      Logger.log('Webex send failed: ' + code + ' ' + res.getContentText());
    }
  }catch(err){
    Logger.log('Webex send error: ' + (err && err.message ? err.message : err));
  }
}


function setWebexConfigByAdmin(token, payload){
  requireRole_(token, 'inspector');

  const webexToken = String(payload && payload.webexToken || '').trim();
  const webexRoomId = String(payload && payload.webexRoomId || '').trim();

  const sp = PropertiesService.getScriptProperties();

  if(webexToken){
    sp.setProperty(WEBEX_TOKEN_PROP, webexToken);
  }
  if(webexRoomId){
    sp.setProperty(WEBEX_ROOM_ID_PROP, webexRoomId);
  }

  return { ok:true, message:'บันทึกค่า Webex แล้ว' };
}

function getWebexConfigForAdmin(token){
  requireRole_(token, 'inspector');

  const cfg = getWebexConfig_();
  return {
    ok: true,
    hasToken: !!cfg.token,
    roomId: cfg.roomId || ''
  };
}

function fmtSwapLine_(beYear, monthIdx, day, shift){
  // แสดงรูปแบบอ่านง่าย (พ.ศ./เดือน/วัน/กะ)
  return `พ.ศ.${beYear} เดือน ${monthIdx} วันที่ ${day} กะ ${shift}`;
}

function webexSwapMessage_(title, data){
  // data: {beYear, monthIdx, day, shift, requester, coverer, reason, status, actor}
  const lines = [];
  lines.push(`**🔔 ${title}**`);
  lines.push(`- **วัน/กะ:** ${fmtSwapLine_(data.beYear, data.monthIdx, data.day, data.shift)}`);
  if(data.requester) lines.push(`- **ผู้ขอ:** ${data.requester}`);
  if(data.coverer)   lines.push(`- **ผู้แทน:** ${data.coverer}`);
  if(data.reason)    lines.push(`- **เหตุผล:** ${data.reason}`);
  if(data.status)    lines.push(`- **สถานะ:** \`${data.status}\``);
  if(data.actor)     lines.push(`- **ดำเนินการโดย:** ${data.actor}`);
  lines.push(`- เวลา: ${nowText_ ? nowText_() : new Date().toLocaleString('th-TH')}`);
  return lines.join('\n');
}
function fmtLatLng_(lat,lng){
  const a = (lat===null || lat===undefined || lat==='') ? '' : String(lat);
  const b = (lng===null || lng===undefined || lng==='') ? '' : String(lng);
  if(!a || !b) return '-';
  return `${a}, ${b}`;
}

function webexAttendanceMessage_(title, data){
  // data: {beYear, monthIdx, day, shift, action, name, status, note, tsServer, tsClient, lat, lng, photoUrl}
  const lines = [];
  lines.push(`**📝 ${title}**`);
  lines.push(`- **ผู้ปฏิบัติงาน:** ${data.name}`);
  lines.push(`- **วัน/กะ:** พ.ศ.${data.beYear} เดือน ${data.monthIdx} วันที่ ${data.day} กะ ${data.shift}`);
  lines.push(`- **ประเภท:** \`${data.action}\``);
  lines.push(`- **สถานะ:** \`${data.status}\``);
  if(data.note) lines.push(`- **หมายเหตุ:** ${data.note}`);
  lines.push(`- **พิกัด:** ${fmtLatLng_(data.lat, data.lng)}`);
  if(data.photoUrl) lines.push(`- **รูป:** ${data.photoUrl}`);
  if(data.tsClient) lines.push(`- เวลา (Client): ${data.tsClient}`);
  if(data.tsServer) lines.push(`- เวลา (Server): ${data.tsServer}`);
  return lines.join('\n');
}

/* =============================================================================
 * PEOPLE (อ่านรายชื่อจาก "ชีต1")
 * ============================================================================= */
function getPeople_(){
  const sh = SpreadsheetApp.getActive().getSheetByName(ROSTER_NAMES_SHEET);
  if(!sh) return [];
  const last = Math.max(1, sh.getLastRow());
  const vals = sh.getRange(1,1,last,2).getValues();

  const seen = new Set();
  const out = [];
  vals.forEach(([n,r])=>{
    const name = normalizeName_(n);
    if(!name || seen.has(name)) return;
    out.push({ name, role: parseRole_(r) });
    seen.add(name);
  });
  return out;
}
function getRosterPeople(){
  // ใช้ให้ index แสดงรายชื่อ/ตัวเลือก
  return getPeople_().map(p=>p.name);
}

/* =============================================================================
 * PEOPLE MANAGEMENT APIs (Editor)
 * - จัดการรายชื่อเวรผ่านหน้าเว็บ
 * - ใช้ชีต1 เดิม: Col A = ชื่อ, Col B = บทบาท
 * ============================================================================= */

/** คืนข้อมูลรายชื่อทั้งหมดแบบละเอียด สำหรับหน้า settings */
function getRosterPeopleFull(token){
  requireRole_(token, 'inspector');

  const sh = SpreadsheetApp.getActive().getSheetByName(ROSTER_NAMES_SHEET);
  if(!sh){
    throw new Error(`ไม่พบชีต ${ROSTER_NAMES_SHEET}`);
  }

  const lastRow = sh.getLastRow();
  if(lastRow < 1){
    return [];
  }

  const values = sh.getRange(1, 1, lastRow, 2).getValues();
  const out = [];
  const seen = new Set();

  values.forEach((row, idx) => {
    const name = normalizeName_(row[0]);
    const roleRaw = String(row[1] || '').trim();
    if(!name) return;

    const key = name.toLowerCase();
    if(seen.has(key)) return;
    seen.add(key);

    out.push({
      row: idx + 1,
      name: name,
      roleText: roleRaw,
      role: parseRole_(roleRaw) // lead | junior | both
    });
  });

  return out;
}

/** เพิ่มชื่อใหม่ */
function addRosterPerson(token, payload){
  requireRole_(token, 'inspector');

  const sh = SpreadsheetApp.getActive().getSheetByName(ROSTER_NAMES_SHEET);
  if(!sh){
    throw new Error(`ไม่พบชีต ${ROSTER_NAMES_SHEET}`);
  }

  const name = normalizeName_(payload && payload.name);
  const roleText = normalizeRoleText_(payload && payload.roleText);

  if(!name){
    throw new Error('กรุณาระบุชื่อ');
  }

  const people = getRosterPeopleFull(token);
  const dup = people.find(p => normalizeName_(p.name).toLowerCase() === name.toLowerCase());
  if(dup){
    throw new Error('มีชื่อนี้อยู่แล้วในระบบ');
  }

  sh.appendRow([name, roleText]);
  return { ok: true, message: 'เพิ่มรายชื่อแล้ว' };
}

/** แก้ไขชื่อ/บทบาท */
function updateRosterPerson(token, originalName, payload){
  requireRole_(token, 'inspector');

  const sh = SpreadsheetApp.getActive().getSheetByName(ROSTER_NAMES_SHEET);
  if(!sh){
    throw new Error(`ไม่พบชีต ${ROSTER_NAMES_SHEET}`);
  }

  const oldName = normalizeName_(originalName);
  const newName = normalizeName_(payload && payload.name);
  const roleText = normalizeRoleText_(payload && payload.roleText);

  if(!oldName) throw new Error('ไม่พบชื่อเดิม');
  if(!newName) throw new Error('กรุณาระบุชื่อใหม่');

  const lastRow = sh.getLastRow();
  if(lastRow < 1) throw new Error('ไม่มีข้อมูลรายชื่อ');

  const values = sh.getRange(1, 1, lastRow, 2).getValues();

  let targetRow = -1;
  for(let i = 0; i < values.length; i++){
    const name = normalizeName_(values[i][0]);
    if(name && name.toLowerCase() === oldName.toLowerCase()){
      targetRow = i + 1;
      break;
    }
  }

  if(targetRow === -1){
    throw new Error('ไม่พบรายชื่อที่ต้องการแก้ไข');
  }

  // กันชื่อซ้ำกับคนอื่น
  for(let i = 0; i < values.length; i++){
    const rowNo = i + 1;
    const name = normalizeName_(values[i][0]);
    if(!name) continue;
    if(rowNo !== targetRow && name.toLowerCase() === newName.toLowerCase()){
      throw new Error('ชื่อใหม่ซ้ำกับรายชื่อที่มีอยู่แล้ว');
    }
  }

  sh.getRange(targetRow, 1, 1, 2).setValues([[newName, roleText]]);
  return { ok: true, message: 'แก้ไขรายชื่อแล้ว' };
}

/** ลบชื่อ */
function deleteRosterPerson(token, name){
  requireRole_(token, 'inspector');

  const sh = SpreadsheetApp.getActive().getSheetByName(ROSTER_NAMES_SHEET);
  if(!sh){
    throw new Error(`ไม่พบชีต ${ROSTER_NAMES_SHEET}`);
  }

  const targetName = normalizeName_(name);
  if(!targetName){
    throw new Error('ไม่พบชื่อที่ต้องการลบ');
  }

  const lastRow = sh.getLastRow();
  if(lastRow < 1){
    throw new Error('ไม่มีข้อมูลรายชื่อ');
  }

  const values = sh.getRange(1, 1, lastRow, 2).getValues();

  for(let i = 0; i < values.length; i++){
    const rowName = normalizeName_(values[i][0]);
    if(rowName && rowName.toLowerCase() === targetName.toLowerCase()){
      sh.deleteRow(i + 1);
      return { ok: true, message: 'ลบรายชื่อแล้ว' };
    }
  }

  throw new Error('ไม่พบรายชื่อที่ต้องการลบ');
}

/** normalize role text ให้เก็บในชีตเป็นข้อความอ่านง่าย */
function normalizeRoleText_(roleText){
  const s = String(roleText || '').trim();
  if(!s) return '';
  if(s === 'lead' || s === 'หัวหน้า') return 'หัวหน้า';
  if(s === 'junior' || s === 'ลูกเวร') return 'ลูกเวร';
  if(s === 'both' || s === 'ได้ทั้งสอง' || s === 'ทั้งหมด') return '';
  return s;
}

/* =============================================================================
 * USERS (ชีต Users)
 * ============================================================================= */
function getUsers_(){
  const sh = SpreadsheetApp.getActive().getSheetByName(USERS_SHEET);
  if(!sh) return [];
  const last = sh.getLastRow();
  if(last < 2) return [];
  const vals = sh.getRange(2,1,last-1,5).getValues(); // A:E

  return vals.map(r => ({
    username:   String(r[0]||'').trim(),
    password:   String(r[1]||''),
    role:       String(r[2]||'viewer').trim().toLowerCase(),
    personName: normalizeName_(r[3]||''),
    active:     String(r[4]||'TRUE').toUpperCase() !== 'FALSE'
  })).filter(u => u.username && u.password && u.active);
}

function makeSession_(user){
  return {
    username: String(user.username || '').trim(),
    role: String(user.role || 'viewer').trim().toLowerCase(),
    personName: normalizeName_(user.personName || '')
  };
}

/* =============================================================================
 * USERS MANAGEMENT APIs (Editor)
 * - จัดการบัญชีผู้ใช้ผ่านหน้า Admin
 * - ชีต Users: A=Username, B=Password, C=Role, D=PersonName, E=Active
 * ============================================================================= */

function normalizeUserRole_(role){
  const s = String(role || '').trim().toLowerCase();
  if (s === 'editor') return 'editor';
  if (s === 'inspector') return 'inspector';
  return 'viewer';
}

function normalizeActiveText_(v){
  const s = String(v || '').trim().toUpperCase();
  return s === 'FALSE' ? 'FALSE' : 'TRUE';
}

/** อ่าน user ทั้งหมด */
function getUsersForAdmin(token){
  requireRole_(token, 'inspector');

  const sh = SpreadsheetApp.getActive().getSheetByName(USERS_SHEET);
  if(!sh) throw new Error(`ไม่พบชีต ${USERS_SHEET}`);

  const lastRow = sh.getLastRow();
  if(lastRow < 2) return [];

  const values = sh.getRange(2, 1, lastRow - 1, 5).getValues();

  return values
    .map((r, i) => ({
      row: i + 2,
      username: String(r[0] || '').trim(),
      password: String(r[1] || ''),
      role: normalizeUserRole_(r[2]),
      personName: normalizeName_(r[3] || ''),
      active: String(r[4] || 'TRUE').toUpperCase() !== 'FALSE'
    }))
    .filter(u => u.username);
}

/** เพิ่ม user */
function addUserByAdmin(token, payload){
  requireRole_(token, 'inspector');

  const sh = SpreadsheetApp.getActive().getSheetByName(USERS_SHEET);
  if(!sh) throw new Error(`ไม่พบชีต ${USERS_SHEET}`);

  const username   = String(payload && payload.username || '').trim();
  const password   = String(payload && payload.password || '').trim();
  const role       = normalizeUserRole_(payload && payload.role);
  const personName = normalizeName_(payload && payload.personName);
  const activeText = normalizeActiveText_(payload && payload.active);

  if(!username) throw new Error('กรุณาระบุ Username');
  if(!password) throw new Error('กรุณาระบุ Password');
  if(!personName) throw new Error('กรุณาระบุชื่อบุคคล');

  const users = getUsersForAdmin(token);
  const dup = users.find(u => String(u.username).toLowerCase() === username.toLowerCase());
  if(dup) throw new Error('Username นี้มีอยู่แล้ว');

  sh.appendRow([username, password, role, personName, activeText]);
  return { ok:true, message:'เพิ่มผู้ใช้แล้ว' };
}

/** แก้ไข user */
function updateUserByAdmin(token, originalUsername, payload){
  requireRole_(token, 'inspector');

  const sh = SpreadsheetApp.getActive().getSheetByName(USERS_SHEET);
  if(!sh) throw new Error(`ไม่พบชีต ${USERS_SHEET}`);

  const oldUsername = String(originalUsername || '').trim();
  const username    = String(payload && payload.username || '').trim();
  const password    = String(payload && payload.password || '').trim();
  const role        = normalizeUserRole_(payload && payload.role);
  const personName  = normalizeName_(payload && payload.personName);
  const activeText  = normalizeActiveText_(payload && payload.active);

  if(!oldUsername) throw new Error('ไม่พบ Username เดิม');
  if(!username) throw new Error('กรุณาระบุ Username');
  if(!password) throw new Error('กรุณาระบุ Password');
  if(!personName) throw new Error('กรุณาระบุชื่อบุคคล');

  const lastRow = sh.getLastRow();
  if(lastRow < 2) throw new Error('ไม่มีข้อมูลผู้ใช้');

  const values = sh.getRange(2, 1, lastRow - 1, 5).getValues();

  let targetRow = -1;
  for(let i = 0; i < values.length; i++){
    const u = String(values[i][0] || '').trim();
    if(u && u.toLowerCase() === oldUsername.toLowerCase()){
      targetRow = i + 2;
      break;
    }
  }
  if(targetRow === -1) throw new Error('ไม่พบผู้ใช้ที่ต้องการแก้ไข');

  for(let i = 0; i < values.length; i++){
    const rowNo = i + 2;
    const u = String(values[i][0] || '').trim();
    if(!u) continue;
    if(rowNo !== targetRow && u.toLowerCase() === username.toLowerCase()){
      throw new Error('Username ใหม่ซ้ำกับที่มีอยู่แล้ว');
    }
  }

  sh.getRange(targetRow, 1, 1, 5).setValues([
    [username, password, role, personName, activeText]
  ]);

  return { ok:true, message:'แก้ไขผู้ใช้แล้ว' };
}

/** ลบ user */
function deleteUserByAdmin(token, username){
  requireRole_(token, 'inspector');

  const sh = SpreadsheetApp.getActive().getSheetByName(USERS_SHEET);
  if(!sh) throw new Error(`ไม่พบชีต ${USERS_SHEET}`);

  const target = String(username || '').trim();
  if(!target) throw new Error('ไม่พบ Username ที่ต้องการลบ');

  const me = ensureLogged_(token);
  if(String(me.username || '').trim().toLowerCase() === target.toLowerCase()){
    throw new Error('ไม่สามารถลบบัญชีที่กำลังใช้งานอยู่ได้');
  }

  const lastRow = sh.getLastRow();
  if(lastRow < 2) throw new Error('ไม่มีข้อมูลผู้ใช้');

  const values = sh.getRange(2, 1, lastRow - 1, 5).getValues();
  for(let i = 0; i < values.length; i++){
    const u = String(values[i][0] || '').trim();
    if(u && u.toLowerCase() === target.toLowerCase()){
      sh.deleteRow(i + 2);
      return { ok:true, message:'ลบผู้ใช้แล้ว' };
    }
  }

  throw new Error('ไม่พบผู้ใช้ที่ต้องการลบ');
}


/* =============================================================================
 * RULES (Script Properties)
 * ============================================================================= */
function getRules_(){
  const sp = PropertiesService.getScriptProperties();
  const raw = sp.getProperty(RULES_KEY);
  if(!raw){
    sp.setProperty(RULES_KEY, JSON.stringify(DEFAULT_RULES));
    return DEFAULT_RULES;
  }
  try{
    const obj = JSON.parse(raw);
    return Object.assign({}, DEFAULT_RULES, obj||{});
  }catch(e){
    sp.setProperty(RULES_KEY, JSON.stringify(DEFAULT_RULES));
    return DEFAULT_RULES;
  }
}
function normalizeUiRules_(obj){
  obj = obj || {};

  const fixedNames = Array.isArray(obj.s2FixedNames)
    ? obj.s2FixedNames.map(normalizeName_).filter(Boolean)
    : [];

  return {
    s1Count: Math.max(0, Math.min(3, Number(obj.s1Count ?? 2))),
    s2Count: Math.max(0, Math.min(3, Number(obj.s2Count ?? 1))),
    s3Count: Math.max(0, Math.min(3, Number(obj.s3Count ?? 2))),
    s2IncludeInRotation: !!obj.s2IncludeInRotation,

    // ✅ ใหม่
    s2FixedOverride: !!obj.s2FixedOverride,
    s2FixedNames: fixedNames,

    hasReserve: !!obj.hasReserve,
    reserveFrom: ['S1','S2','S3'].includes(String(obj.reserveFrom || '')) ? String(obj.reserveFrom) : 'S3'
  };
}

function setRules_(patch){
  const cur = getRules_();
  const next = Object.assign({}, cur, patch||{});

  // validate
  if(!['fixed','rotate'].includes(next.s2WeekdayMode)) next.s2WeekdayMode='fixed';
  next.s2HolidayCount = Number(next.s2HolidayCount||2);
  if(![1,2].includes(next.s2HolidayCount)) next.s2HolidayCount=2;

  next.preferLeader = !!next.preferLeader;
  if(!['none','with_R'].includes(next.reserveMode)) next.reserveMode='none';

  // legacy validate
  const wdOK = ['S3_second','S3_first','S1_first'];
  const hdOK = ['S2_second','S2_first','S3_first'];
  if(!wdOK.includes(next.reserveWeekdaySource)) next.reserveWeekdaySource='S3_second';
  if(!hdOK.includes(next.reserveHolidaySource)) next.reserveHolidaySource='S2_second';

  next.shiftHours = Math.max(1, Number(next.shiftHours||8));
  next.countS2WeekdayHours = !!next.countS2WeekdayHours;
  next.countReserveHours   = !!next.countReserveHours;

  next.weekday = normalizeUiRules_(next.weekday || {});
  next.holiday = normalizeUiRules_(next.holiday || {});

  if(!['auto_from_prev','manual'].includes(next.startSequenceMode)) next.startSequenceMode='auto_from_prev';
  next.manualStartName = String(next.manualStartName||'').trim();

  PropertiesService.getScriptProperties().setProperty(RULES_KEY, JSON.stringify(next));
  return next;
}

/* =============================================================================
 * SEQUENCE (เก็บลำดับหมุนเวรข้ามเดือน)
 * ============================================================================= */
function props_(){ return PropertiesService.getScriptProperties(); }
function keyStart_(y,m){ return `startSeq_${y}_${m}`; }
function keyEnd_(y,m){ return `endSeq_${y}_${m}`; }
function prevMonth_(y,m){ return m>1?{y, m:m-1}:{y:y-1, m:12}; }

function getStoredStartSeq_(y,m){
  const v = props_().getProperty(keyStart_(y,m));
  return v==null ? null : Number(v);
}
function setStoredStartSeq_(y,m,seq){
  props_().setProperty(keyStart_(y,m), String(seq));
}
function setStoredEndSeq_(y,m,lastName){
  const name = normalizeName_(lastName);
  if(!name) return;
  props_().setProperty(keyEnd_(y,m), name);
}

/**
 * derive start seq จากเดือนก่อน:
 * 1) อ่าน keyEnd_ ก่อน (เก็บชื่อคนสุดท้ายที่ใช้)
 * 2) ถ้าไม่มี -> อ่านจากชีตเดือนก่อน โดยดู “กะ3” แล้วใช้คนที่ 2 ของกะ3 เป็นตัวต่อเนื่อง
 */
function deriveStartSeqFromPrev_(beYear, monthIdx, people){
  const {y,m} = prevMonth_(beYear, monthIdx);

  const lastNameProp = props_().getProperty(keyEnd_(y,m));
  if(lastNameProp && people && people.length){
    const lastNorm = normalizeName_(lastNameProp);
    const idx = people.findIndex(p => normalizeName_(p.name) === lastNorm);
    if(idx >= 0) return (idx+1) % people.length;
  }

  const sh = safeGetMonthSheet_(y, m);
  if(!sh) return null;

  const lastCol = sh.getLastColumn();
  if(lastCol < 1) return null;

  const rDate = sh.getRange(1,1,1,lastCol).getValues()[0];
  let col = -1;
  for(let c=lastCol; c>=1; c--){
    if(Number(rDate[c-1])){ col=c; break; }
  }
  if(col===-1) return null;

  const lastRow = Math.max(sh.getLastRow(), START_DATA_ROW);
  if(lastRow < START_DATA_ROW) return null;

  const lines = sh.getRange(START_DATA_ROW, col, lastRow-START_DATA_ROW+1, 1).getValues()
    .map(r=>String(r[0]||'').trim())
    .filter(Boolean);

  const g3 = lines.find(x=>/^กะ3\b/.test(x));
  if(!g3) return null;

  const ppl = extractPeople_(g3);
  if(ppl.length < 2) return null;

  const idx = people.findIndex(p => normalizeName_(p.name) === normalizeName_(ppl[1]));
  if(idx === -1) return null;
  return (idx+1) % people.length;
}

/* =============================================================================
 * WEB APP
 * ============================================================================= */
function include(filename){
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** เดือนปัจจุบัน (ตามปี BE_YEAR) เพื่อให้หน้า index เลือกเดือนปัจจุบันได้เสมอ */
function getDefaultMonth_(beYear){
  const tz = Session.getScriptTimeZone();
  const now = new Date();
  const ce = Number(beYear) - 543;
  const nowCE = Number(Utilities.formatDate(now, tz, 'yyyy'));
  const nowM  = Number(Utilities.formatDate(now, tz, 'M'));
  return (nowCE === ce) ? nowM : 1;
}

function doGet(e){
  if (isApiRequest_(e)) {
    return standbyApiHandleRequest_(e, 'GET');
  }

  const t = HtmlService.createTemplateFromFile('index');
  t.BE_YEAR = BE_YEAR;
  t.TH_MONTHS = TH_MONTHS;
  t.CURRENT_MONTH = getDefaultMonth_(BE_YEAR);
  t.SERVER_TS = nowText_();
  return t.evaluate()
    .setTitle('ตารางเวรแก้ไฟฟ้าขัดข้องฯ Standby 2569')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* =============================================================================
 * JSON API ENTRYPOINTS (Next.js / Vercel)
 * - Keeps the legacy HtmlService UI available for normal doGet() page loads.
 * - Keeps the legacy LINE webhook doPost() path when no JSON action is provided.
 * ============================================================================= */
function isApiRequest_(e){
  const p = (e && e.parameter) ? e.parameter : {};
  return !!(p.action || p.api === '1' || p.format === 'json');
}

function parseApiBody_(e, method){
  if(method === 'POST'){
    const raw = e && e.postData && e.postData.contents ? String(e.postData.contents) : '';
    if(!raw) return {};
    return JSON.parse(raw);
  }
  return (e && e.parameter) ? e.parameter : {};
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function apiOk_(data){
  return jsonResponse({ ok: true, data: data === undefined ? null : data });
}

function apiFail_(err){
  const message = err && err.message ? err.message : String(err);
  return jsonResponse({
    ok: false,
    message: message,
    error: message
  });
}

function standbyApiHandleRequest_(e, method) {
  try {
    const body = parseApiBody_(e, method);
    const action = String(body.action || '').trim();

    switch (action) {
      case 'health':
        return apiOk_({
          status: 'ok',
          apiVersion: API_VERSION,
          supportsCallFunction: true,
          serverTime: nowText_(),
          beYear: BE_YEAR,
          currentMonth: getDefaultMonth_(BE_YEAR)
        });

      case 'callFunction':
        return apiOk_(apiCallFunction_(body));

      case 'login':
        return apiOk_(apiLogin(body));

      case 'getCurrentUser':
        return apiOk_(apiGetCurrentUser(body));

      case 'getRoster':
        return apiOk_(apiGetRoster(body));

      case 'saveRoster':
        return apiOk_(apiSaveRoster(body));

      case 'getHandover':
        return apiOk_(apiGetHandover(body));

      case 'saveHandover':
        return apiOk_(apiSaveHandover(body));

      case 'getMapData':
        return apiOk_(apiGetMapData(body));

      case 'saveDailySign':
      case 'recordAttendance':
        return apiOk_(apiSaveDailySign(body));

      case 'exportDailySign':
      case 'exportDailySignPdf':
      case 'exportDailyAttendancePdf':
      case 'exportAttendanceDailyPdf':
      case 'exportDayAttendancePdf':
        return apiOk_(apiExportDailySign(body));

      case 'getConfig':
        return apiOk_(apiGetConfig(body));

      default:
        return jsonResponse({
          ok: false,
          message: 'Unknown action: ' + action,
          error: 'Unknown action: ' + action
        });
    }
  } catch (err) {
    return apiFail_(err);
  }
}

const API_LEGACY_FUNCTION_ALLOWLIST_ = {
  ping: true,
  login: true,
  logout: true,
  whoAmI: true,
  validateToken: true,
  getConfig: true,

  getRosterPeopleFull: true,
  addRosterPerson: true,
  updateRosterPerson: true,
  deleteRosterPerson: true,
  getUsersForAdmin: true,
  addUserByAdmin: true,
  updateUserByAdmin: true,
  deleteUserByAdmin: true,
  getRosterRules: true,
  setRosterRules: true,
  createMonthlySheetsForBE: true,
  getMonthData: true,
  getMonthHoursSummary: true,
  generateRosterMonth: true,
  addItem: true,
  setHoliday: true,
  manualEditShiftNames: true,
  listRequests: true,
  listIncomingSwapRequests: true,
  listInboxForCoverer: true,
  submitSwapRequest: true,
  inspectSwapRequest: true,
  approveRequest: true,
  respondCovererSwap: true,
  covererRespondSwapRequest: true,
  respondToSwapRequest: true,
  respondSwapRequest: true,
  respondSwapOffer: true,
  acceptSwapRequest: true,
  covererRespond: true,
  respondCoverer: true,
  respondCovererRequest: true,
  covererDecision: true,
  covererAcceptRequest: true,
  covererRejectRequest: true,
  cancelSwapRequest: true,
  isLeaderOnShift: true,
  listPeopleNames: true,

  recordAttendance: true,
  exportMonthPdfOfficial: true,
  exportDailySignPdf: true,
  exportSwapRequestPdf: true,
  exportSwapSummaryPdf: true,
  getDeviceLocationOptions: true,
  appendOutageMemory_: true,

  hoGetVehicleSheets: true,
  hoGetEmployeeNames: true,
  hoGetEquipmentList: true,
  hoSaveActualQtys: true,
  hoSubmitHandover: true,
  hoListPendingReceiver: true,
  hoListPendingForReceiver: true,
  hoAcceptHandover: true,
  hoRejectHandover: true,
  hoRespondHandover: true,
  hoListHandoversByDay: true,
  hoGetHandoverForView: true,
  hoExportHandoverPdf: true,
  hoExportDailyHandoverPdfByVehicle: true,
  hoGetDashboardSummary: true,

  getOutageMapData: true,
  exportDailySignPdfByDate_: true
};

function apiCallFunction_(body){
  const fnName = String(body.functionName || body.fn || '').trim();
  if(!fnName || !API_LEGACY_FUNCTION_ALLOWLIST_[fnName]){
    throw new Error('Function is not allowed: ' + fnName);
  }
  const args = Array.isArray(body.args) ? body.args : [];
  const fn = globalThis[fnName];
  if(typeof fn !== 'function'){
    throw new Error('Function not found: ' + fnName);
  }
  console.log('API callFunction:', fnName);
  return fn.apply(null, args);
}

function apiLogin(body){
  const res = login(body.username, body.password);
  if(!res || !res.ok) throw new Error((res && (res.message || res.error)) || 'เข้าสู่ระบบไม่สำเร็จ');
  return {
    token: res.token,
    ttl: res.ttl,
    user: res.user,
    username: res.user,
    role: res.role,
    personName: res.personName || '',
    beYear: res.beYear || BE_YEAR,
    currentMonth: res.currentMonth || getDefaultMonth_(BE_YEAR)
  };
}

function apiGetCurrentUser(body){
  const token = String(body.token || '').trim();
  const res = validateToken(token);
  if(!res || !res.ok) throw new Error((res && (res.message || res.error)) || 'Session หมดอายุ');
  return {
    user: res.user || res.username || '',
    username: res.user || res.username || '',
    role: res.role || 'viewer',
    personName: res.personName || '',
    apiVersion: API_VERSION,
    supportsCallFunction: true,
    beYear: BE_YEAR,
    currentMonth: getDefaultMonth_(BE_YEAR)
  };
}

function apiGetRoster(body){
  const token = String(body.token || '').trim();
  requireRole_(token, 'viewer');

  const beYear = Number(body.beYear || body.year || BE_YEAR);
  const monthIdx = Number(body.month || body.monthIdx || getDefaultMonth_(beYear));
  return {
    roster: getMonthData(beYear, monthIdx),
    summary: getMonthHoursSummary(beYear, monthIdx),
    requests: listRequests(token, beYear, monthIdx)
  };
}

function apiSaveRoster(body){
  const token = String(body.token || '').trim();
  const op = String(body.operation || body.mode || '').trim();
  const beYear = Number(body.beYear || body.year || BE_YEAR);
  const monthIdx = Number(body.month || body.monthIdx || getDefaultMonth_(beYear));

  if(op === 'generate') return generateRosterMonth(token, beYear, monthIdx);
  if(op === 'createMonthSheets') return createMonthlySheetsForBE(token);
  if(op === 'setHoliday') return setHoliday(token, beYear, monthIdx, Number(body.day), !!body.isHoliday);
  if(op === 'manualEditShift') return manualEditShiftNames(token, beYear, monthIdx, Number(body.day), body.shift, body.names || []);
  if(op === 'addItem') return addItem(token, beYear, monthIdx, Number(body.day), body.text || '');

  throw new Error('Unsupported saveRoster operation: ' + op);
}

function apiGetHandover(body){
  const token = String(body.token || '').trim();
  const op = String(body.operation || body.mode || 'dashboard').trim();

  if(op === 'config'){
    return {
      vehicles: hoGetVehicleSheets(token),
      employees: hoGetEmployeeNames(token)
    };
  }
  if(op === 'equipment') return hoGetEquipmentList(token, body.vehicleSheet);
  if(op === 'pending') return hoListPendingReceiver(token);
  if(op === 'day') return hoListHandoversByDay(token, Number(body.beYear || body.year || BE_YEAR), Number(body.month), Number(body.day), body.vehicleSheet);
  if(op === 'detail') return hoGetHandoverForView(token, body.handoverId || body.id);
  if(op === 'dashboard' && typeof hoGetDashboardSummary === 'function') return hoGetDashboardSummary(token);

  throw new Error('Unsupported getHandover operation: ' + op);
}

function apiSaveHandover(body){
  const token = String(body.token || '').trim();
  const op = String(body.operation || body.mode || 'submit').trim();

  if(op === 'submit') return hoSubmitHandover(token, body.payload || body);
  if(op === 'saveActualQtys') return hoSaveActualQtys(token, body.vehicleSheet, body.updates || []);
  if(op === 'accept') return hoAcceptHandover(token, body.handoverId || body.id, body.note || '');
  if(op === 'reject') return hoRejectHandover(token, body.handoverId || body.id, body.note || '');

  throw new Error('Unsupported saveHandover operation: ' + op);
}

function apiGetMapData(body){
  const token = String(body.token || '').trim();
  return getOutageMapData(token, {
    beYear: Number(body.beYear || body.year || BE_YEAR),
    month: body.month
  });
}

function apiSaveDailySign(body){
  return recordAttendance(
    String(body.token || '').trim(),
    Number(body.beYear || body.year || BE_YEAR),
    Number(body.month || body.monthIdx || getDefaultMonth_(BE_YEAR)),
    Number(body.day),
    body.shift,
    body.attendanceAction || body.signAction || body.recordAction || body.attAction || body.inOut || body.checkType || body.direction || body.type,
    body.clientIso || body.clientTime || '',
    body.lat,
    body.lng,
    body.imageDataUrl || body.photoDataUrl || '',
    body.extraPayload || body.outage || null
  );
}

function apiExportDailySign(body){
  const token = String(body.token || '').trim();
  const beYear = Number(body.beYear || body.year || BE_YEAR);
  const monthIdx = Number(body.month || body.monthIdx || getDefaultMonth_(beYear));
  const day = Number(body.day);
  return exportDailySignPdf(token, beYear, monthIdx, day);
}

function apiGetConfig(body){
  const token = String(body.token || '').trim();
  let user = null;
  if(token){
    try{ user = apiGetCurrentUser({token}); }catch(e){ user = null; }
  }

  return {
    appName: 'ระบบอยู่เวร Standby',
    beYear: BE_YEAR,
    apiVersion: API_VERSION,
    supportsCallFunction: true,
    currentMonth: getDefaultMonth_(BE_YEAR),
    months: TH_MONTHS,
    roles: ['viewer', 'inspector', 'editor'],
    rosterPeople: getRosterPeople(),
    rules: getRules_(),
    user
  };
}

/* =============================================================================
 * AUTH APIS
 * ============================================================================= */
function ping(){
  return { ok:true, ts:Date.now(), serverTime: nowText_(), beYear: BE_YEAR, currentMonth: getDefaultMonth_(BE_YEAR) };
}

function makeSession_(user){
  return {
    username: String(user.username || '').trim(),
    role: String(user.role || 'viewer').trim().toLowerCase(),
    personName: normalizeName_(user.personName || '')
  };
}

function login(username, password){
  const u = String(username||'').trim();
  const p = String(password||'').trim();
  if(!u || !p) return { ok:false, message:'กรุณากรอกผู้ใช้และรหัสผ่าน' };

  const users = getUsers_();
  const hit = users.find(x =>
    x.username.toUpperCase() === u.toUpperCase() &&
    x.password === p
  );
  if(!hit) return { ok:false, message:'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };

  const sess = makeSession_(hit); // {username, role, personName}
  const token = Utilities.getUuid();

  CacheService.getScriptCache().put(
    `${AUTH_PREFIX}${token}`,
    JSON.stringify(sess),
    TOKEN_TTL_SECONDS
  );

  return {
    ok:true,
    role:sess.role,
    token,
    ttl:TOKEN_TTL_SECONDS,
    user:sess.username,
    personName:sess.personName||'',
    beYear: BE_YEAR,
    currentMonth: getDefaultMonth_(BE_YEAR)
  };
}

function logout(token){
  if(token) CacheService.getScriptCache().remove(`${AUTH_PREFIX}${token}`);
  return true;
}

function whoAmI(token){
  const sess = ensureLogged_(token);
  return { ok:true, username:sess.username, role:sess.role, personName:sess.personName||'' };
}

/* =============================================================================
 * RULES APIs (Editor) — bridge ระหว่าง index ใหม่ กับ GS เดิม
 * ============================================================================= */

function legacyRulesToUiRules_(rules){
  rules = rules || getRules_();

  const useReserve = String(rules.reserveMode || 'none') === 'with_R';

  // map reserve source เดิม -> ค่าใหม่แบบง่าย
  let weekdayReserveFrom = 'S3';
  if (String(rules.reserveWeekdaySource || '') === 'S1_first') {
    weekdayReserveFrom = 'S1';
  } else if (String(rules.reserveWeekdaySource || '').indexOf('S3') === 0) {
    weekdayReserveFrom = 'S3';
  }

  let holidayReserveFrom = 'S2';
  if (String(rules.reserveHolidaySource || '').indexOf('S3') === 0) {
    holidayReserveFrom = 'S3';
  } else if (String(rules.reserveHolidaySource || '').indexOf('S2') === 0) {
    holidayReserveFrom = 'S2';
  }

  return {
    weekday: {
      // GS เดิมรองรับจริง: กะ1 = 2 คน หรือ 1 คน + R
      s1Count: useReserve ? 1 : 2,

      // GS เดิมรองรับ S2 วันปกติเป็น 1 คนเท่านั้น
      s2Count: 1,

      // GS เดิมทำกะ3 = 2 คน
      s3Count: 2,

      // หน้าใหม่ถามว่า S2 วันปกติเอาเข้าระบบหมุนหรือไม่
      s2IncludeInRotation: String(rules.s2WeekdayMode || 'fixed') === 'rotate',

      hasReserve: useReserve,
      reserveFrom: weekdayReserveFrom
    },

    holiday: {
      // GS เดิมใช้ reserve แบบ global เหมือนกันทั้งระบบ
      s1Count: useReserve ? 1 : 2,

      // GS เดิมรองรับ 1 หรือ 2
      s2Count: Number(rules.s2HolidayCount || 2),

      // GS เดิมทำกะ3 = 2 คน
      s3Count: 2,

      hasReserve: useReserve,
      reserveFrom: holidayReserveFrom
    },

    preferLeader: !!rules.preferLeader,
    shiftHours: Number(rules.shiftHours || 8),
    countS2WeekdayHours: !!rules.countS2WeekdayHours,
    countReserveHours: !!rules.countReserveHours,
    startSequenceMode: String(rules.startSequenceMode || 'auto_from_prev'),
    manualStartName: String(rules.manualStartName || '')
  };
}

function uiRulesToLegacyPatch_(patch){
  patch = patch || {};

  const weekday = patch.weekday || {};
  const holiday = patch.holiday || {};

  const weekdayHasReserve = String(weekday.hasReserve) === 'true' || weekday.hasReserve === true;
  const holidayHasReserve = String(holiday.hasReserve) === 'true' || holiday.hasReserve === true;

  // GS เดิมรองรับ reserveMode แค่ค่าเดียวทั้งระบบ
  const useReserve = weekdayHasReserve || holidayHasReserve;

  // S2 วันปกติ เดิมรองรับ fixed/rotate
  const s2WeekdayMode =
    (String(weekday.s2IncludeInRotation) === 'true' || weekday.s2IncludeInRotation === true)
      ? 'rotate'
      : 'fixed';

  // ถ้า fixed และไม่มีชื่อกำหนดไว้ ให้คงค่าว่างไว้ -> generator จะ fallback คนแรกเอง
  const s2WeekdayFixedName = '';

  // S2 วันหยุด เดิมรองรับแค่ 1 หรือ 2
  let s2HolidayCount = Number(holiday.s2Count);
  if (![1, 2].includes(s2HolidayCount)) {
    s2HolidayCount = 2;
  }

  // reserve source เดิม
  let reserveWeekdaySource = 'S3_second';
  if (String(weekday.reserveFrom || '') === 'S1') {
    reserveWeekdaySource = 'S1_first';
  } else if (String(weekday.reserveFrom || '') === 'S3') {
    reserveWeekdaySource = 'S3_second';
  }

  let reserveHolidaySource = 'S2_second';
  if (String(holiday.reserveFrom || '') === 'S3') {
    reserveHolidaySource = 'S3_first';
  } else if (String(holiday.reserveFrom || '') === 'S2') {
    reserveHolidaySource = 'S2_second';
  }

  return {
    s2WeekdayMode: s2WeekdayMode,
    s2WeekdayFixedName: s2WeekdayFixedName,
    s2HolidayCount: s2HolidayCount,
    preferLeader: !!patch.preferLeader,
    reserveMode: useReserve ? 'with_R' : 'none',
    reserveWeekdaySource: reserveWeekdaySource,
    reserveHolidaySource: reserveHolidaySource,
    shiftHours: Math.max(1, Number(patch.shiftHours || 8)),
    countS2WeekdayHours: !!patch.countS2WeekdayHours,
    countReserveHours: !!patch.countReserveHours,
    startSequenceMode: ['auto_from_prev', 'manual'].includes(String(patch.startSequenceMode))
      ? String(patch.startSequenceMode)
      : 'auto_from_prev',
    manualStartName: String(patch.manualStartName || '').trim()
  };
}

function getRosterRules(token){
  requireRole_(token,'inspector');
  const rules = getRules_();
  return legacyRulesToUiRules_(rules);
}

function setRosterRules(token, patch){
  requireRole_(token,'inspector');

  const isNewShape = patch && (patch.weekday || patch.holiday);

  if(isNewShape){
    const legacyPatch = uiRulesToLegacyPatch_(patch);

    const mergedPatch = Object.assign({}, patch, legacyPatch);

    return setRules_(mergedPatch);
  }

  return setRules_(patch || {});
}

/* =============================================================================
 * CREATE MONTH SHEETS (Editor) — สร้างชีตรายเดือนทั้งปี
 * - ถ้ามีครบทั้ง 12 เดือนแล้ว: ไม่ทำอะไรและ return ทันที
 * ============================================================================= */
function createMonthlySheetsForBE(token){
  requireRole_(token,'editor');

  const ss = SpreadsheetApp.getActive();

  // ✅ 1) ตรวจว่ามีครบทุกเดือนแล้วหรือยัง
  const needNames = TH_MONTHS.map(m => `${m}${BE_YEAR}`);
  const existing = new Set(ss.getSheets().map(s => s.getName()));
  const hasAll = needNames.every(n => existing.has(n));

  if(hasAll){
    // มีครบแล้ว ไม่ต้องสร้างใหม่ ไม่ต้องล้างข้อมูล
    return true;
  }

  // ✅ 2) ถ้ายังไม่ครบ: สร้างเฉพาะเดือนที่ยังไม่มี
  const ce = BE_YEAR - 543;
  const DOW = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];

  for(let m=0; m<12; m++){
    const name = `${TH_MONTHS[m]}${BE_YEAR}`;
    if(ss.getSheetByName(name)) continue; // ✅ ข้ามเดือนที่มีอยู่แล้ว

    const sh = ss.insertSheet(name);

    const days = new Date(ce, m+1, 0).getDate();
    const r1=[], r2=[], r3=[];
    for(let d=1; d<=days; d++){
      const wd = new Date(ce, m, d).getDay();
      r1.push(d);
      r2.push(DOW[wd]);
      r3.push((wd===0||wd===6) ? 'หยุด' : '');
    }

    sh.getRange(1,1,1,days).setValues([r1]);
    sh.getRange(2,1,1,days).setValues([r2]);
    sh.getRange(3,1,1,days).setValues([r3]);

    sh.setFrozenRows(HEADER_ROWS);
    sh.getRange(1,1,1,days).setFontWeight('bold').setHorizontalAlignment('center');
    sh.getRange(2,1,1,days).setHorizontalAlignment('center');
    sh.getRange(3,1,1,days).setHorizontalAlignment('center');
    sh.setColumnWidths(1,days,170);
  }

  return true;
}


/* =============================================================================
 * REQUESTS SHEET (Upgrade)
 * ============================================================================= */
function getRequestsSheet_(){
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(REQUESTS_SHEET);
  if(!sh){
    sh = ss.insertSheet(REQUESTS_SHEET);
    sh.getRange(1,1,1,14).setValues([[
      'ID','BE','Month','Day','Shift','Requester','Coverer',
      'Reason','Status','CreatedAt','ActedBy','ActedAt',
      'CovererDecision','CovererAt'
    ]]);
    sh.setFrozenRows(1);
    return sh;
  }

  // Upgrade ให้เป็น 14 คอลัมน์เสมอ
  const lastCol = sh.getLastColumn();
  const head = sh.getRange(1,1,1,Math.max(14,lastCol)).getValues()[0];
  const hasCovererDecision = head.includes('CovererDecision');
  const hasCovererAt = head.includes('CovererAt');

  if(!hasCovererDecision || !hasCovererAt || lastCol < 14){
    const needCols = 14 - lastCol;
    if(needCols > 0) sh.insertColumnsAfter(lastCol, needCols);
    sh.getRange(1,1,1,14).setValues([[
      'ID','BE','Month','Day','Shift','Requester','Coverer',
      'Reason','Status','CreatedAt','ActedBy','ActedAt',
      'CovererDecision','CovererAt'
    ]]);
    sh.setFrozenRows(1);
  }
  return sh;
}

/* =============================================================================
 * MONTH READ (อ่านข้อมูลชีตรายเดือนเพื่อแสดงในหน้า Calendar)
 * ============================================================================= */
function monthSheetExists(beYear, monthIdx){
  return !!safeGetMonthSheet_(beYear, monthIdx);
}

function getMonthData(beYear, monthIdx){
  const sh = safeGetMonthSheet_(beYear, monthIdx);
  if(!sh){
    return { beYear, ceYear:beYear-543, monthIndex:monthIdx, monthName:TH_MONTHS[monthIdx-1], days:[], missing:true };
  }

  const lastCol = sh.getLastColumn();
  const rDate = sh.getRange(1,1,1,lastCol).getValues()[0];
  const rWeek = sh.getRange(2,1,1,lastCol).getValues()[0];
  const rHol  = sh.getRange(3,1,1,lastCol).getValues()[0];

  const lastRow = Math.max(sh.getLastRow(), START_DATA_ROW);
  const body = (lastRow>=START_DATA_ROW)
    ? sh.getRange(START_DATA_ROW,1,lastRow-START_DATA_ROW+1,lastCol).getValues()
    : [];

  const days = [];
  for(let c=0; c<lastCol; c++){
    const d = Number(rDate[c]);
    if(!d) break;

    const items = [];
    for(let r=0; r<body.length; r++){
      const raw = String(body[r][c]||'').trim();
      if(!raw) continue;

      let cls='other';
      if(/^กะ1\b/.test(raw)) cls='s1';
      else if(/^กะ2\b/.test(raw)) cls='s2';
      else if(/^กะ3\b/.test(raw)) cls='s3';
      else if(/^สำรอง\b/.test(raw)) cls='reserve';

      // ✅ เพิ่ม leader info (ไม่กระทบของเดิม)
      const names = extractPeople_(raw);
      const first = names[0] ? normalizeName_(names[0]) : '';
      const leader = pickLeaderName_(names);
      const leaderForbiddenFirst = !!(first && isForbiddenLeader_(first));

      items.push({ text:raw, cls, leader, leaderForbiddenFirst });
    }

    days.push({
      day:d,
      weekday:String(rWeek[c]||''),
      isHoliday:String(rHol[c]||'').trim()!=='',
      items
    });
  }

  return { beYear, ceYear:beYear-543, monthIndex:monthIdx, monthName:TH_MONTHS[monthIdx-1], days, missing:false };
}

/* =============================================================================
 * SUMMARY HOURS (ใช้ร่วมกัน Web + PDF)
 * FIX:
 * - with_R = อ่าน R จากบรรทัด "สำรอง" เท่านั้น
 * - กะ1 ถ้ามีหลายคน = ทุกคนได้กะ1
 * ============================================================================= */
function getMonthHoursSummary(beYear, monthIdx){
  const data = getMonthData(beYear, monthIdx);
  if(data.missing){
    return {
      beYear,
      monthIndex: monthIdx,
      monthName: TH_MONTHS[monthIdx - 1],
      result: [],
      totalHours: 0,
      missing: true
    };
  }

  const rules = getRules_();
  const H = Number(rules.shiftHours || 8);
  const hours = {};

  const add = (name, h) => {
    const k = normalizeName_(name);
    if(!k) return;
    hours[k] = (hours[k] || 0) + h;
  };

  data.days.forEach(d => {
    const items = d.items || [];

    const findNames = (prefix) => {
      const it = items.find(x => String((x && x.text) || '').trim().startsWith(prefix));
      return it ? extractPeople_(it.text).map(normalizeName_).filter(Boolean) : [];
    };

    const n1 = findNames('กะ1');
    const n2 = findNames('กะ2');
    const n3 = findNames('กะ3');
    const nr = findNames('สำรอง');

    // ===== กะ1 =====
    n1.forEach(n => add(n, H));

    // ===== กะ2 =====
    if(d.isHoliday){
      n2.forEach(n => add(n, H));
    }else{
      if(rules.countS2WeekdayHours){
        n2.forEach(n => add(n, H));
      }
    }

    // ===== กะ3 =====
    n3.forEach(n => add(n, H));

    // ===== สำรอง =====
    if(rules.countReserveHours){
      nr.forEach(n => add(n, H));
    }
  });

  const order = getPeople_().map(p => p.name);
  const result = order.map(n => ({
    name: n,
    hours: hours[normalizeName_(n)] || 0
  }));

  const totalHours = Object.values(hours).reduce((a, b) => a + b, 0);

  return {
    beYear: data.beYear,
    monthIndex: data.monthIndex,
    monthName: data.monthName,
    result,
    totalHours,
    missing: false
  };
}

/* =============================================================================
 * MODIFY MONTH (Editor) — เพิ่มบรรทัด / ตั้งวันหยุด
 * ============================================================================= */
function addItem(token, beYear, monthIdx, day, text){
  requireRole_(token,'editor');
  const sh = safeGetMonthSheet_(beYear, monthIdx);
  if(!sh) throw new Error('ยังไม่ได้สร้างชีตรายเดือน');
  if(!String(text||'').trim()) return false;

  const lastCol = sh.getLastColumn();
  const dates = sh.getRange(1,1,1,lastCol).getValues()[0];
  let col = -1;
  for(let c=0;c<dates.length;c++){
    if(Number(dates[c])===Number(day)){ col=c+1; break; }
  }
  if(col===-1) throw new Error(`ไม่พบวันที่ ${day}`);

  const lastRow = Math.max(sh.getLastRow(), START_DATA_ROW);
  let target = START_DATA_ROW;
  for(let r=START_DATA_ROW;r<=lastRow;r++){
    if(!sh.getRange(r,col).getValue()){ target=r; break; }
    if(r===lastRow) target=r+1;
  }
  sh.getRange(target,col).setValue(String(text).trim());
  return true;
}

function setHoliday(token, beYear, monthIdx, day, isHoliday){
  requireRole_(token,'editor');
  const sh = safeGetMonthSheet_(beYear, monthIdx);
  if(!sh) throw new Error('ยังไม่ได้สร้างชีตรายเดือน');

  const lastCol = sh.getLastColumn();
  const dates = sh.getRange(1,1,1,lastCol).getValues()[0];
  let col = -1;
  for(let c=0;c<dates.length;c++){
    if(Number(dates[c])===Number(day)){ col=c+1; break; }
  }
  if(col===-1) throw new Error(`ไม่พบวันที่ ${day}`);

  sh.getRange(3,col).setValue(isHoliday ? 'หยุด' : '');
  return true;
}

/* =============================================================================
 * MANUAL EDIT SHIFT (Editor) — แก้ชื่อผู้อยู่เวรแบบ Manual
 * - ลบรายชื่อเดิม / เพิ่มรายชื่อใหม่
 * - กันรายชื่อซ้ำกันภายในกะ (ตาม normalizeName_)
 * - รองรับ กะ 1/2/3 และ สำรอง (R)
 * ============================================================================= */
function manualEditShiftNames(token, beYear, monthIdx, day, shift, names){
  requireRole_(token, 'editor');

  const sh = safeGetMonthSheet_(beYear, monthIdx);
  if(!sh) throw new Error('ยังไม่ได้สร้างชีตรายเดือน');

  const people = getPeople_().map(p => normalizeName_(p.name)).filter(Boolean);
  const peopleSet = new Set(people);

  // ---- normalize input names ----
  let arr = [];
  if(Array.isArray(names)) arr = names;
  else if(names == null) arr = [];
  else arr = String(names).split(','); // fallback

  arr = arr.map(x => normalizeName_(x)).filter(Boolean);

  // ---- validate duplicates (must not duplicate) ----
  const seen = new Set();
  const dup = [];
  arr.forEach(n=>{
    const k = normalizeName_(n);
    if(seen.has(k)) dup.push(n);
    seen.add(k);
  });
  if(dup.length){
    throw new Error('รายชื่อซ้ำกันในกะเดียวกัน: ' + Array.from(new Set(dup)).join(', '));
  }

  // ---- validate must exist in roster people ----
  const unknown = arr.filter(n => !peopleSet.has(normalizeName_(n)));
  if(unknown.length){
    throw new Error('พบชื่อที่ไม่มีในรายชื่อพนักงาน (ชีต1): ' + unknown.join(', '));
  }

  // ---- find column by day (header row=1) ----
  const lastCol = sh.getLastColumn();
  const dates = sh.getRange(1,1,1,lastCol).getValues()[0];
  let col = -1;
  for(let c=0;c<dates.length;c++){
    if(Number(dates[c])===Number(day)){ col=c+1; break; }
  }
  if(col===-1) throw new Error(`ไม่พบวันที่ ${day}`);

  // ---- find target row for this shift ----
  const lastRow = Math.max(sh.getLastRow(), START_DATA_ROW);

  const shiftKey = String(shift||'').toUpperCase().trim();
  const isR = (shiftKey==='R');

  let targetRow = -1;
  let rawHead = '';

  for(let r=START_DATA_ROW; r<=lastRow; r++){
    const raw = String(sh.getRange(r,col).getValue()||'').trim();
    if(!raw) continue;

    // ✅ FIX: ไม่ใช้ \b กับภาษาไทย
    const isMatch = isR
      ? raw.startsWith('สำรอง')           // รองรับ "สำรอง (..): ..." ชัวร์
      : raw.startsWith('กะ' + shiftKey);  // รองรับ "กะ1/2/3 ..." ชัวร์

    if(isMatch){
      targetRow = r;

      // เก็บหัวบรรทัดเดิมไว้ (ก่อนรายชื่อ)
      // รูปแบบเดิมเป็น "...): ..." หรือ "....: ..."
      const at = raw.indexOf('):');
      rawHead = at>=0 ? raw.slice(0,at+2) : (raw.split(':')[0]+':');
      break;
    }
  }

  // ---- build new line or delete ----
  if(arr.length === 0){
    // ลบทั้งบรรทัด (ถ้าพบ)
    if(targetRow !== -1){
      deleteRowInThisColumn_(sh, col, targetRow);
    }
    return true;
  }

  // ถ้าไม่พบบรรทัดเดิม -> สร้างบรรทัดใหม่ด้วยหัวมาตรฐาน
  if(targetRow === -1){
    rawHead = defaultShiftHead_(shiftKey); // "กะ1 (..):" หรือ "สำรอง (..):"
    targetRow = findFirstEmptyRowInColumn_(sh, col, START_DATA_ROW);
  }

  // ✅ เงื่อนไขเดิมของระบบ: ถ้ากะมี 2 คน อาจต้องสลับกันกรณี "FORBIDDEN" ไม่ให้เป็นคนแรก
  // (พี่ระบุว่า with_R ยกเว้นกะ1 หัวหน้าเวรกรณีพิเศษอยู่ใน auto-roster แล้ว
  //  ส่วน manual เราคง rule นี้เหมือนเดิมทุกกะที่มี 2 คน)
  if(arr.length >= 2){
    const pair = ensureForbiddenNotFirstPair_(arr[0], arr[1]);
    arr[0] = pair[0]; arr[1] = pair[1];
  }

  const newLine = `${rawHead} ${arr.join(', ')}`;
  sh.getRange(targetRow, col).setValue(newLine);
  return true;

  // ---------------- helpers ----------------
  function defaultShiftHead_(k){
    if(k==='1') return 'กะ1 (00:30-08:30):';
    if(k==='2') return 'กะ2 (08:30-16:30):';
    if(k==='3') return 'กะ3 (16:30-00:30):';
    if(k==='R') return 'สำรอง (00:30-08:30):';
    throw new Error('กะไม่ถูกต้อง (รองรับ 1/2/3/R)');
  }

  function findFirstEmptyRowInColumn_(sheet, col, startRow){
    const lr = Math.max(sheet.getLastRow(), startRow);
    for(let r=startRow; r<=lr; r++){
      const v = String(sheet.getRange(r,col).getValue()||'').trim();
      if(!v) return r;
    }
    return lr+1;
  }

  function deleteRowInThisColumn_(sheet, col, row){
    const lr = Math.max(sheet.getLastRow(), row);
    // shift up เฉพาะคอลัมน์นี้
    for(let r=row; r<lr; r++){
      const next = sheet.getRange(r+1, col).getValue();
      sheet.getRange(r, col).setValue(next);
    }
    sheet.getRange(lr, col).setValue('');
  }
}






/* =============================================================================
 * AUTO ROSTER (Editor)
 * - reserveMode none   : กะ1=2คน, ไม่มีบรรทัดสำรอง
 * - reserveMode with_R : คนที่2กะ1 = R + เพิ่มบรรทัด "สำรอง ..."
 * ============================================================================= */

function generateRosterMonth(token, beYear, monthIdx){
  requireRole_(token,'inspector');

  const people = getPeople_();
  const N = people.length;
  if(N < 3) throw new Error('ต้องมีรายชื่ออย่างน้อย 3 คนใน "ชีต1"');

  const sh = safeGetMonthSheet_(beYear, monthIdx);
  if(!sh) throw new Error('ยังไม่ได้สร้างชีตรายเดือน');

  const lastCol = sh.getLastColumn();
  const holidays = sh.getRange(3,1,1,lastCol).getValues()[0]
    .map(x => String(x || '').trim() !== '');

  // clear body
  const lastRow = Math.max(sh.getLastRow(), START_DATA_ROW);
  if(lastRow >= START_DATA_ROW){
    sh.getRange(START_DATA_ROW,1,lastRow-START_DATA_ROW+1,lastCol).clearContent();
  }

  const rules = getRules_();

  function toIntCount_(v, fallback){
    if(v === null || v === undefined || v === '') return fallback;
    const n = Number(v);
    if(!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(3, Math.floor(n)));
  }

  function oldWeekdayReserveFrom_(){
    const s = String(rules.reserveWeekdaySource || '');
    if(s.indexOf('S1') === 0) return 'S1';
    if(s.indexOf('S3') === 0) return 'S3';
    return 'S3';
  }

  function oldHolidayReserveFrom_(){
    const s = String(rules.reserveHolidaySource || '');
    if(s.indexOf('S3') === 0) return 'S3';
    if(s.indexOf('S2') === 0) return 'S2';
    return 'S2';
  }

  function normalizeFixedNames_(arr){
    if(!Array.isArray(arr)) return [];
    return arr.map(normalizeName_).filter(Boolean);
  }

  function getDayCfg_(isHoliday){
    const wd = rules.weekday || {};
    const hd = rules.holiday || {};

    if(isHoliday){
      return {
        s1Count: toIntCount_(hd.s1Count, 2),
        s2Count: toIntCount_(hd.s2Count, Number(rules.s2HolidayCount || 2)),
        s3Count: toIntCount_(hd.s3Count, 2),

        // วันหยุดยังไม่ใช้ override นี้
        s2IncludeInRotation: true,
        s2FixedOverride: false,
        s2FixedNames: [],

        hasReserve: (hd.hasReserve !== undefined)
          ? !!hd.hasReserve
          : (String(rules.reserveMode || 'none') === 'with_R'),

        reserveFrom: String(hd.reserveFrom || oldHolidayReserveFrom_())
      };
    }

    return {
      s1Count: toIntCount_(wd.s1Count, 2),
      s2Count: toIntCount_(wd.s2Count, 1),
      s3Count: toIntCount_(wd.s3Count, 2),

      s2IncludeInRotation: (wd.s2IncludeInRotation !== undefined)
        ? !!wd.s2IncludeInRotation
        : (String(rules.s2WeekdayMode || 'fixed') === 'rotate'),

      // ✅ ใหม่: โหมดรายชื่อคงที่ของกะ 2 วันปกติ
      s2FixedOverride: !!wd.s2FixedOverride,
      s2FixedNames: normalizeFixedNames_(wd.s2FixedNames),

      hasReserve: (wd.hasReserve !== undefined)
        ? !!wd.hasReserve
        : (String(rules.reserveMode || 'none') === 'with_R'),

      reserveFrom: String(wd.reserveFrom || oldWeekdayReserveFrom_())
    };
  }

  // ==== start seq ====
  let seq = null;
  if(rules.startSequenceMode === 'manual'){
    if(rules.manualStartName){
      const idx = people.findIndex(p => normalizeName_(p.name) === normalizeName_(rules.manualStartName));
      seq = (idx >= 0) ? idx : 0;
    }else{
      seq = 0;
    }
  }else{
    seq = getStoredStartSeq_(beYear, monthIdx);
    if(seq == null) seq = deriveStartSeqFromPrev_(beYear, monthIdx, people);
    if(seq == null) seq = 0;
  }
  setStoredStartSeq_(beYear, monthIdx, seq);

  // ==== skip-state แบบหมุน ====
  let skipState = getStoredSkipState_(beYear, monthIdx);

  if(!skipState){
    let prevY = beYear, prevM = monthIdx - 1;
    if(prevM < 1){
      prevM = 12;
      prevY = beYear - 1;
    }
    skipState = getStoredSkipState_(prevY, prevM);
  }

  let skipTarget = Number(skipState && Number.isFinite(skipState.skipTarget) ? skipState.skipTarget : 0);
  let skipArmed  = !!(skipState && skipState.skipArmed);

  if(rules.startSequenceMode === 'manual'){
    skipTarget = 0;
    skipArmed = false;
  }

  // S2 วันปกติแบบ "ไม่นำมาหมุนในการจัดเวร" -> ใช้ลำดับแยก ไม่กระทบ seq หลัก
  let s2Seq = seq;

  const leaderScore = p => (p.role === 'lead') ? 2 : (p.role === 'both' ? 1 : 0);

  function orderShiftPeople_(arr){
    const out = (arr || []).slice();

    if(out.length <= 1){
      return out;
    }

    if(rules.preferLeader){
      out.sort((a, b) => leaderScore(b) - leaderScore(a));
    }

    const goodIdx = out.findIndex(p => !isForbiddenLeader_(p.name));
    if(goodIdx > 0){
      const t = out[0];
      out[0] = out[goodIdx];
      out[goodIdx] = t;
    }

    return out;
  }

  const consume = () => {
    if(N <= 0) throw new Error('ไม่พบรายชื่อผู้ปฏิบัติงาน');

    if(skipArmed && seq === skipTarget){
      seq = rotateIndex_(seq + 1, N);
      skipTarget = rotateIndex_(skipTarget + 1, N);
      skipArmed = false;
    }

    const P = people[seq];
    seq = rotateIndex_(seq + 1, N);

    if(seq === 0){
      skipArmed = true;
    }

    return P;
  };

  const consumeS2Separate_ = () => {
    if(N <= 0) throw new Error('ไม่พบรายชื่อผู้ปฏิบัติงาน');
    const P = people[s2Seq];
    s2Seq = rotateIndex_(s2Seq + 1, N);
    return P;
  };

  function pullMain_(count){
    const out = [];
    for(let i = 0; i < count; i++){
      out.push(consume());
    }
    return orderShiftPeople_(out);
  }

  function pullS2Weekday_(count, includeInRotation){
    const out = [];
    for(let i = 0; i < count; i++){
      out.push(includeInRotation ? consume() : consumeS2Separate_());
    }
    return orderShiftPeople_(out);
  }

  function pickFixedPeopleByNames_(names){
    return names
      .map(name => people.find(p => normalizeName_(p.name) === normalizeName_(name)))
      .filter(Boolean);
  }

  for(let c = 1; c <= lastCol; c++){
    const isHoliday = holidays[c - 1];
    const cfg = getDayCfg_(isHoliday);

    const s1Objs = pullMain_(cfg.s1Count);

    let s2Objs = [];

    if(isHoliday){
      // วันหยุดใช้ logic เดิม
      s2Objs = pullMain_(cfg.s2Count);
    }else{
      // ✅ วันปกติ: ถ้าเปิด override ให้ใช้รายชื่อคงที่
      if(cfg.s2FixedOverride && cfg.s2FixedNames.length){
        s2Objs = orderShiftPeople_(pickFixedPeopleByNames_(cfg.s2FixedNames));
      }else{
        // ใช้ logic เดิม
        s2Objs = pullS2Weekday_(cfg.s2Count, cfg.s2IncludeInRotation);
      }
    }

    const s3Objs = pullMain_(cfg.s3Count);

    const s1Names = s1Objs.map(p => p.name);
    const s2Names = s2Objs.map(p => p.name);
    const s3Names = s3Objs.map(p => p.name);

    const lines = [];

    if(s1Names.length){
      lines.push(`กะ1 (00:30-08:30): ${s1Names.join(', ')}`);
    }
    if(s2Names.length){
      lines.push(`กะ2 (08:30-16:30): ${s2Names.join(', ')}`);
    }
    if(s3Names.length){
      lines.push(`กะ3 (16:30-00:30): ${s3Names.join(', ')}`);
    }

    if(cfg.hasReserve){
      let reserveName = '';

      if(cfg.reserveFrom === 'S1'){
        reserveName = s1Names[0] || '';
      }else if(cfg.reserveFrom === 'S2'){
        reserveName = s2Names[0] || '';
      }else if(cfg.reserveFrom === 'S3'){
        reserveName = s3Names[0] || '';
      }

      if(normalizeName_(reserveName)){
        lines.push(`สำรอง (00:30-08:30): ${normalizeName_(reserveName)}`);
      }
    }

    writeLinesToDay_(sh, c, lines);
  }

  // เก็บ seq และ skip-state ต่อให้เดือนหน้า
  const endSeq = seq % N;
  const lastIndex = rotateIndex_(seq - 1, N);
  const lastName = people[lastIndex].name;

  setStoredEndSeq_(beYear, monthIdx, lastName);

  let nextY = beYear, nextM = monthIdx + 1;
  if(nextM > 12){
    nextM = 1;
    nextY = beYear + 1;
  }

  setStoredStartSeq_(nextY, nextM, endSeq);
  setStoredSkipState_(nextY, nextM, {
    skipTarget: skipTarget,
    skipArmed: skipArmed
  });

  return true;
}


function getStoredSkipState_(beYear, monthIdx){
  const key = `ROSTER_SKIP_STATE_${beYear}_${monthIdx}`;
  const raw = PropertiesService.getScriptProperties().getProperty(key);
  if(!raw) return null;
  try{
    return JSON.parse(raw);
  }catch(err){
    return null;
  }
}

function setStoredSkipState_(beYear, monthIdx, state){
  const key = `ROSTER_SKIP_STATE_${beYear}_${monthIdx}`;
  PropertiesService.getScriptProperties().setProperty(key, JSON.stringify({
    skipTarget: Number(state && state.skipTarget || 0),
    skipArmed: !!(state && state.skipArmed)
  }));
}




/*function generateRosterMonth(token, beYear, monthIdx){
  requireRole_(token,'editor');

  const people = getPeople_();
  const N = people.length;
  if(N < 3) throw new Error('ต้องมีรายชื่ออย่างน้อย 3 คนใน "ชีต1"');

  const sh = safeGetMonthSheet_(beYear, monthIdx);
  if(!sh) throw new Error('ยังไม่ได้สร้างชีตรายเดือน');

  const lastCol = sh.getLastColumn();
  const holidays = sh.getRange(3,1,1,lastCol).getValues()[0].map(x => String(x||'').trim() !== '');

  // clear body
  const lastRow = Math.max(sh.getLastRow(), START_DATA_ROW);
  if(lastRow >= START_DATA_ROW){
    sh.getRange(START_DATA_ROW,1,lastRow-START_DATA_ROW+1,lastCol).clearContent();
  }

  const rules = getRules_();
  const useReserve = (rules.reserveMode === 'with_R');

  // ===== start seq =====
  let startSeq = null;
  if(rules.startSequenceMode === 'manual'){
    if(rules.manualStartName){
      const idx = people.findIndex(p => normalizeName_(p.name) === normalizeName_(rules.manualStartName));
      startSeq = (idx >= 0) ? idx : 0;
    }else{
      startSeq = 0;
    }
  }else{
    startSeq = getStoredStartSeq_(beYear, monthIdx);
    if(startSeq == null) startSeq = deriveStartSeqFromPrev_(beYear, monthIdx, people);
    if(startSeq == null) startSeq = 0;
  }
  setStoredStartSeq_(beYear, monthIdx, startSeq);

  // ===== fixed S2 weekday =====
  const s2FixedNorm = normalizeName_(rules.s2WeekdayFixedName || '') || normalizeName_(people[0].name);
  const fixedWeekdayPerson = people.find(p => normalizeName_(p.name) === s2FixedNorm) || people[0];

  // ===== สถิติรายเดือนเพื่อความสมดุล =====
  // duty        = ภาระเวรจริง (กะ1, กะ3, กะ2วันหยุด)
  // holidayDuty = ภาระเวรจริงที่ตรงวันหยุด
  // leader      = จำนวนครั้งเป็นหัวหน้าเวร
  // reserve     = จำนวนครั้งเป็น R (R = 0 คะแนน แต่ใช้ถัวเฉลี่ยจำนวนครั้ง)
  const stats = {};
  people.forEach(p => {
    const k = normalizeName_(p.name);
    stats[k] = {
      duty: 0,
      holidayDuty: 0,
      leader: 0,
      reserve: 0
    };
  });

  // ===== ลำดับฐานของเดือนนี้ (ใช้ตัดสินเมื่อคะแนนเท่ากัน) =====
  const orderRank = {};
  for(let i=0; i<N; i++){
    const p = people[rotateIndex_(startSeq + i, N)];
    orderRank[normalizeName_(p.name)] = i;
  }

  let lastAssignedName = '';

  function personKey_(p){
    return normalizeName_(p && p.name);
  }

  function canLead_(p){
    return !isForbiddenLeader_(p.name);
  }

  function bumpDuty_(p, isHoliday, asLeader){
    const k = personKey_(p);
    stats[k].duty += 1;
    if(isHoliday) stats[k].holidayDuty += 1;
    if(asLeader) stats[k].leader += 1;
    lastAssignedName = p.name;
  }

  function bumpReserve_(p){
    const k = personKey_(p);
    stats[k].reserve += 1; // R = 0 คะแนน
    lastAssignedName = p.name;
  }

  function cmpByBaseOrder_(a, b){
    return (orderRank[personKey_(a)] ?? 9999) - (orderRank[personKey_(b)] ?? 9999);
  }

  // วันทำการ: เน้น duty ก่อน
  function cmpGeneral_(a, b){
    const sa = stats[personKey_(a)];
    const sb = stats[personKey_(b)];

    if(sa.duty !== sb.duty) return sa.duty - sb.duty;
    if(sa.holidayDuty !== sb.holidayDuty) return sa.holidayDuty - sb.holidayDuty;
    if(sa.leader !== sb.leader) return sa.leader - sb.leader;
    if(sa.reserve !== sb.reserve) return sa.reserve - sb.reserve;
    return cmpByBaseOrder_(a, b);
  }

  // วันหยุด: เน้น holidayDuty ก่อน
  function cmpHoliday_(a, b){
    const sa = stats[personKey_(a)];
    const sb = stats[personKey_(b)];

    if(sa.holidayDuty !== sb.holidayDuty) return sa.holidayDuty - sb.holidayDuty;
    if(sa.duty !== sb.duty) return sa.duty - sb.duty;
    if(sa.leader !== sb.leader) return sa.leader - sb.leader;
    if(sa.reserve !== sb.reserve) return sa.reserve - sb.reserve;
    return cmpByBaseOrder_(a, b);
  }

  // เลือกหัวหน้าเวร: เน้นจำนวนครั้งเป็นหัวหน้าให้น้อยก่อน
  function cmpLeader_(a, b, isHoliday){
    const sa = stats[personKey_(a)];
    const sb = stats[personKey_(b)];

    if(sa.leader !== sb.leader) return sa.leader - sb.leader;

    if(isHoliday){
      if(sa.holidayDuty !== sb.holidayDuty) return sa.holidayDuty - sb.holidayDuty;
      if(sa.duty !== sb.duty) return sa.duty - sb.duty;
    }else{
      if(sa.duty !== sb.duty) return sa.duty - sb.duty;
      if(sa.holidayDuty !== sb.holidayDuty) return sa.holidayDuty - sb.holidayDuty;
    }

    if(sa.reserve !== sb.reserve) return sa.reserve - sb.reserve;
    return cmpByBaseOrder_(a, b);
  }

  // เลือก R: ถัวเฉลี่ยจำนวนครั้ง R แยก
  function cmpReserve_(a, b, isHoliday){
    const sa = stats[personKey_(a)];
    const sb = stats[personKey_(b)];

    if(sa.reserve !== sb.reserve) return sa.reserve - sb.reserve;
    if(isHoliday){
      if(sa.holidayDuty !== sb.holidayDuty) return sa.holidayDuty - sb.holidayDuty;
    }
    if(sa.duty !== sb.duty) return sa.duty - sb.duty;
    if(sa.leader !== sb.leader) return sa.leader - sb.leader;
    return cmpByBaseOrder_(a, b);
  }

  function sortCandidates_(arr, mode, isHoliday){
    const list = arr.slice();

    if(mode === 'leader'){
      list.sort((a,b) => cmpLeader_(a,b,isHoliday));
    }else if(mode === 'reserve'){
      list.sort((a,b) => cmpReserve_(a,b,isHoliday));
    }else{
      list.sort((a,b) => isHoliday ? cmpHoliday_(a,b) : cmpGeneral_(a,b));
    }

    return list;
  }

  function pickOne_(candidates, mode, isHoliday){
    const sorted = sortCandidates_(candidates, mode, isHoliday);
    return sorted.length ? sorted[0] : null;
  }

  function pickLeaderThenMember_(candidates, isHoliday, requireLeader){
    const leaderPool = candidates.filter(canLead_);
    let leader = null;

    if(leaderPool.length){
      leader = pickOne_(leaderPool, 'leader', isHoliday);
    }else if(requireLeader){
      throw new Error(`ไม่สามารถจัดหัวหน้าเวรได้ในเดือน ${TH_MONTHS[monthIdx-1]} วันที่กำลังประมวลผล`);
    }else{
      leader = pickOne_(candidates, 'general', isHoliday);
    }

    if(!leader) throw new Error('ไม่พบผู้ปฏิบัติงานสำหรับกะ 2 คน');

    const secondPool = candidates.filter(p => personKey_(p) !== personKey_(leader));
    const member = pickOne_(secondPool, 'general', isHoliday);
    if(!member) throw new Error('ไม่สามารถเลือกคนที่ 2 ของกะได้');

    // กัน forbidden leader อยู่คนแรก
    const pair = ensureForbiddenNotFirstPair_(leader.name, member.name);
    if(normalizeName_(pair[0]) === normalizeName_(leader.name)){
      return [leader, member];
    }else{
      return [member, leader];
    }
  }

  function eligiblePool_(assignedTodaySet, bannedForS1Set){
    return people.filter(p => {
      const k = personKey_(p);
      if(!k) return false;
      if(assignedTodaySet.has(k)) return false;
      if(bannedForS1Set && bannedForS1Set.has(k)) return false;
      return true;
    });
  }

  // ห้ามเด็ดขาด กะ3 ของเมื่อวาน -> กะ1 ของวันนี้
  let prevDayG3Set = new Set();

  for(let c=1; c<=lastCol; c++){
    const isHoliday = holidays[c-1];
    const assignedToday = new Set(); // ใช้เฉพาะภาระเวรจริง + R
    const lines = [];

    // =========================
    // กะ1
    // =========================
    {
      const s1Pool = eligiblePool_(assignedToday, prevDayG3Set);

      if(useReserve){
        // กะ1 แสดง 1 คน + สำรอง 1 คน
        const leaderPool = s1Pool.filter(canLead_);
        const s1Leader = pickOne_(leaderPool, 'leader', isHoliday);
        if(!s1Leader){
          throw new Error(`ไม่สามารถจัดหัวหน้าเวรกะ1 ได้ (วันที่ ${c}) เพราะติดข้อห้ามกะ3->กะ1 หรือไม่มีผู้มีสิทธิ์เป็นหัวหน้า`);
        }

        assignedToday.add(personKey_(s1Leader));
        bumpDuty_(s1Leader, isHoliday, true);

        const reservePool = eligiblePool_(assignedToday, prevDayG3Set);
        const reservePerson = pickOne_(reservePool, 'reserve', isHoliday);
        if(!reservePerson){
          throw new Error(`ไม่สามารถจัดเวรสำรอง R ได้ (วันที่ ${c})`);
        }

        assignedToday.add(personKey_(reservePerson));
        bumpReserve_(reservePerson);

        lines.push(`กะ1 (00:30-08:30): ${s1Leader.name}`);
        lines.push(`กะ2 (08:30-16:30): __PENDING__`);
        lines.push(`กะ3 (16:30-00:30): __PENDING__`);
        lines.push(`สำรอง (00:30-08:30): ${reservePerson.name}`);
      }else{
        const pair = pickLeaderThenMember_(s1Pool, isHoliday, true);
        const s1a = pair[0];
        const s1b = pair[1];

        assignedToday.add(personKey_(s1a));
        assignedToday.add(personKey_(s1b));

        bumpDuty_(s1a, isHoliday, true);
        bumpDuty_(s1b, isHoliday, false);

        lines.push(`กะ1 (00:30-08:30): ${s1a.name}, ${s1b.name}`);
        lines.push(`กะ2 (08:30-16:30): __PENDING__`);
        lines.push(`กะ3 (16:30-00:30): __PENDING__`);
      }
    }

    // =========================
    // กะ2
    // =========================
    let s2Text = '';

    if(isHoliday){
      const count = Number(rules.s2HolidayCount || 2);

      if(count === 1){
        const s2Pool = eligiblePool_(assignedToday, null);
        const s2one = pickOne_(s2Pool, 'general', true);
        if(!s2one) throw new Error(`ไม่สามารถจัดกะ2 วันหยุดได้ (วันที่ ${c})`);

        assignedToday.add(personKey_(s2one));
        bumpDuty_(s2one, true, canLead_(s2one)); // ถ้าคนเดียวถือเป็นหัวหน้าโดยธรรมชาติ

        s2Text = `กะ2 (08:30-16:30): ${s2one.name}`;
      }else{
        const s2Pool = eligiblePool_(assignedToday, null);

        // ต้องพยายามมีหัวหน้าเวรเสมอ
        const pair = pickLeaderThenMember_(s2Pool, true, true);
        const s2a = pair[0];
        const s2b = pair[1];

        assignedToday.add(personKey_(s2a));
        assignedToday.add(personKey_(s2b));

        bumpDuty_(s2a, true, true);
        bumpDuty_(s2b, true, false);

        s2Text = `กะ2 (08:30-16:30): ${s2a.name}, ${s2b.name}`;
      }
    }else{
      // ✅ วันทำการ: fixed 1 คน และ "ไม่อยู่ในเงื่อนไขใด ๆ"
      // - ไม่ตรวจชน
      // - ไม่เพิ่ม assignedToday
      // - ไม่เพิ่ม duty/holidayDuty/leader/reserve
      s2Text = `กะ2 (08:30-16:30): ${fixedWeekdayPerson.name}`;
    }

    for(let i=0; i<lines.length; i++){
      if(lines[i] === 'กะ2 (08:30-16:30): __PENDING__'){
        lines[i] = s2Text;
        break;
      }
    }

    // =========================
    // กะ3
    // =========================
    {
      const s3Pool = eligiblePool_(assignedToday, null);
      const pair = pickLeaderThenMember_(s3Pool, isHoliday, true);
      const s3a = pair[0];
      const s3b = pair[1];

      assignedToday.add(personKey_(s3a));
      assignedToday.add(personKey_(s3b));

      bumpDuty_(s3a, isHoliday, true);
      bumpDuty_(s3b, isHoliday, false);

      const s3Text = `กะ3 (16:30-00:30): ${s3a.name}, ${s3b.name}`;

      for(let i=0; i<lines.length; i++){
        if(lines[i] === 'กะ3 (16:30-00:30): __PENDING__'){
          lines[i] = s3Text;
          break;
        }
      }

      // ห้ามเด็ดขาด กะ3 -> กะ1 ข้ามวัน
      prevDayG3Set = new Set([personKey_(s3a), personKey_(s3b)]);
    }

    writeLinesToDay_(sh, c, lines);
  }

  // ===== เก็บ pattern ต่อเดือนหน้า =====
  // ใช้คนสุดท้ายที่ถูกใช้งานในภาระเวรจริง / R ของเดือนนี้
  if(lastAssignedName){
    setStoredEndSeq_(beYear, monthIdx, lastAssignedName);

    const idx = people.findIndex(p => normalizeName_(p.name) === normalizeName_(lastAssignedName));
    const nextSeq = (idx >= 0) ? rotateIndex_(idx + 1, N) : startSeq;

    if(monthIdx < 12) setStoredStartSeq_(beYear, monthIdx + 1, nextSeq);
    else setStoredStartSeq_(beYear + 1, 1, nextSeq);
  }else{
    if(monthIdx < 12) setStoredStartSeq_(beYear, monthIdx + 1, startSeq);
    else setStoredStartSeq_(beYear + 1, 1, startSeq);
  }

  return true;
}*/

/*function generateRosterMonth(token, beYear, monthIdx){
  requireRole_(token,'editor');

  const people = getPeople_();
  const N = people.length;
  if(N < 3) throw new Error('ต้องมีรายชื่ออย่างน้อย 3 คนใน "ชีต1"');

  const sh = safeGetMonthSheet_(beYear, monthIdx);
  if(!sh) throw new Error('ยังไม่ได้สร้างชีตรายเดือน');

  const lastCol = sh.getLastColumn();
  const holidays = sh.getRange(3,1,1,lastCol).getValues()[0].map(x=>String(x||'').trim()!=='');

  // clear body
  const lastRow = Math.max(sh.getLastRow(), START_DATA_ROW);
  if(lastRow >= START_DATA_ROW){
    sh.getRange(START_DATA_ROW,1,lastRow-START_DATA_ROW+1,lastCol).clearContent();
  }

  const rules = getRules_();
  const useReserve = (rules.reserveMode === 'with_R');

  // ==== start seq ====
  let seq = null;
  if(rules.startSequenceMode === 'manual'){
    if(rules.manualStartName){
      const idx = people.findIndex(p => normalizeName_(p.name) === normalizeName_(rules.manualStartName));
      seq = (idx>=0) ? idx : 0;
    }else{
      seq = 0;
    }
  }else{
    seq = getStoredStartSeq_(beYear, monthIdx);
    if(seq == null) seq = deriveStartSeqFromPrev_(beYear, monthIdx, people);
    if(seq == null) seq = 0;
  }
  setStoredStartSeq_(beYear, monthIdx, seq);

  // leader preference
  const leaderScore = p => (p.role==='lead') ? 2 : (p.role==='both' ? 1 : 0);

  // ✅ จัดหัวหน้า + กันชื่อ "ต้องห้าม" ไม่ให้เป็นคนแรกของกะ (เฉพาะกะที่มี 2 คน)
  const maybePreferLeader = (a,b)=>{
    let first=a, second=b;
    if(rules.preferLeader){
      const A=leaderScore(a), B=leaderScore(b);
      if(B>A){ first=b; second=a; }
    }
    // กันคนต้องห้ามไม่ให้เป็นคนแรก
    const pair = ensureForbiddenNotFirstPair_(first.name, second.name);
    return pair[0]===first.name ? [first, second] : [second, first];
  };

  const consume = ()=>{
    const P = people[rotateIndex_(seq, N)];
    seq = rotateIndex_(seq+1, N);
    return P;
  };

  // S2 fixed weekday
  const s2FixedNorm = normalizeName_(rules.s2WeekdayFixedName || '') || normalizeName_(people[0].name);

  for(let c=1; c<=lastCol; c++){
    const isHoliday = holidays[c-1];

    // กะ1: ดึง 2 คนเสมอ (คนที่2อาจเป็น R)
let s1a = consume();
let s1b = consume();

// ✅ reserveMode none → กัน forbidden ไม่ให้เป็นคนแรกของกะ1 (หัวหน้าเวร)
if(!useReserve){
  const pair = ensureForbiddenNotFirstPair_(s1a.name, s1b.name);
  if(pair[0] !== s1a.name){
    const tmp = s1a; s1a = s1b; s1b = tmp;
  }
}

// ✅ สร้าง list สำหรับ "แสดงผลลงชีต"
// - with_R: กะ1 แสดง 1 คน (หัวหน้าเวร)
// - none  : กะ1 แสดง 2 คน
const s1DisplayList = useReserve ? [s1a.name] : [s1a.name, s1b.name];

// ✅ ชื่อสำรอง (R) เฉพาะ with_R
const reserveName = useReserve ? s1b.name : '';

    // กะ2
    let s2List = [];
    if(isHoliday){
      if(Number(rules.s2HolidayCount) === 1){
        s2List = [ consume().name ];
        // (ถ้าเป็นคนต้องห้ามและมีคนเดียว — ถือว่า "กะนี้ไม่มีหัวหน้าเวร" โดยธรรมชาติ)
      }else{
        const a = consume(), b = consume();
        const [p2a,p2b] = maybePreferLeader(a,b);
        s2List = [p2a.name, p2b.name];
      }
    }else{
      if(rules.s2WeekdayMode === 'fixed'){
        const found = people.find(p => normalizeName_(p.name) === s2FixedNorm);
        s2List = [ (found ? found.name : people[0].name) ];
        // (หาก fixed เป็นชื่อที่ต้องห้าม -> ไม่แก้ชื่อ แต่จะไม่ถือเป็นหัวหน้าเวรในฝั่งการไฮไลท์)
      }else{
        s2List = [ consume().name ];
      }
    }

    // กะ3: 2 คน
    const g3a = consume(), g3b = consume();
    const [p3a,p3b] = maybePreferLeader(g3a,g3b);

    const lines = [
  `กะ1 (00:30-08:30): ${s1DisplayList.join(', ')}`,
  `กะ2 (08:30-16:30): ${s2List.join(', ')}`,
  `กะ3 (16:30-00:30): ${p3a.name}, ${p3b.name}`
];


    if(useReserve && normalizeName_(reserveName)){
      lines.push(`สำรอง (00:30-08:30): ${normalizeName_(reserveName)}`);
    }

    writeLinesToDay_(sh, c, lines);

    // พัก 1 คนหลังจบวัน (กติกาเดิม)
    //consume();

    // พัก 1 คนหลังจบวัน (กติกาเดิม)
// ✅ เพิ่มเงื่อนไข: ถ้าจำนวนคนในชีต1 "เป็นเลขคู่" ค่อยพัก 1 คน
// (ถ้าเป็นเลขคี่ → ไม่พัก ให้คิวต่อเนื่องไปเลย)
if(N % 2 === 0){
  consume();
}

  }

  // เก็บ seq ต่อเดือนหน้า
  const endSeq = seq % N;
  const lastIndex = rotateIndex_(seq-1, N);
  const lastName = people[lastIndex].name;
  setStoredEndSeq_(beYear, monthIdx, lastName);

  if(monthIdx < 12) setStoredStartSeq_(beYear, monthIdx+1, endSeq);
  else setStoredStartSeq_(beYear+1, 1, endSeq);

  return true;
}
*/
function inspectSwapRequest(token, rowIdx, approve){
  requireRole_(token, 'inspector');

  const sh = SpreadsheetApp.getActive().getSheetByName(REQUESTS_SHEET);
  if(!sh) throw new Error('ไม่พบชีตคำขอ');

  const row = Number(rowIdx);
  if(!row || row < 2) throw new Error('ไม่พบแถวคำขอ');

  const vals = sh.getRange(row, 1, 1, 14).getValues()[0];
  const status = String(vals[8] || '').trim();

  if(status !== 'await_inspector'){
    throw new Error('คำขอนี้ไม่ได้อยู่ในสถานะรอผู้ตรวจสอบ');
  }

  const now = nowText_();

  if(approve){
    // ส่งต่อให้ editor อนุมัติขั้นสุดท้าย
    vals[8]  = 'pending';
    vals[10] = 'inspector';
    vals[11] = now;
  }else{
    // จบกระบวนการทันที
    vals[8]  = 'rejected';
    vals[10] = 'inspector';
    vals[11] = now;
  }

  sh.getRange(row, 1, 1, 14).setValues([vals]);

  const beYear    = Number(vals[1]);
  const monthIdx  = Number(vals[2]);
  const day       = Number(vals[3]);
  const shift     = String(vals[4] || '');
  const requester = String(vals[5] || '');
  const coverer   = String(vals[6] || '');
  const reason    = String(vals[7] || '');
 
 Logger.log('INSPECT notify approve=' + approve + ', status=' + vals[8]);
  // ✅ แจ้งเตือน Webex / LINE
  sendNotify_(webexSwapMessage_(
    approve
      ? 'ผู้ตรวจสอบ "ตรวจผ่าน" คำขอแทนเวร (ส่งต่อให้ผู้อนุมัติ)'
      : 'ผู้ตรวจสอบ "ไม่ผ่าน" คำขอแทนเวร',
    {
      beYear,
      monthIdx,
      day,
      shift,
      requester,
      coverer,
      reason,
      status: String(vals[8] || ''),
      actor: 'inspector'
    }
  ));

  return {
    ok: true,
    status: vals[8],
    inspectedAt: now
  };
}

/* =============================================================================
 * SWAP REQUESTS (เพิ่มขั้นตอน Coverer ต้องยอมรับก่อน)
 * ✅ Patch v1: แก้ช่องโหว่ 2 จุดแบบไม่กระทบส่วนอื่น
 *   (1) Requester ต้องมาจาก token เท่านั้น (ไม่รับจาก client)
 *   (2) Cancel ได้เฉพาะ "ผู้ขอ" ของรายการนั้น (หรือ editor ถ้าต้องการ — ปัจจุบันไม่เปิด)
 * ============================================================================= */

/** helper: requester จาก token เท่านั้น */
function getRequesterFromToken_(token){
  const me = normalizeName_(getLoginPersonName_(token));
  if(!me) throw new Error('บัญชีนี้ไม่ได้ผูก personName');
  return me;
}

function listRequests(token, beYear, monthIdx){
  requireRole_(token,'viewer');

  const sh = getRequestsSheet_();
  const last = sh.getLastRow();
  if(last <= 1) return [];

  const vals = sh.getRange(2, 1, last - 1, 14).getValues();

  return vals.map((r, i) => ({
    rowIndex: i + 2, // ✅ เลขแถวจริงในชีต
    id: String(r[0] || ''),
    be: Number(r[1]),
    month: Number(r[2]),
    day: Number(r[3]),
    shift: String(r[4] || ''),
    requester: String(r[5] || ''),
    coverer: String(r[6] || ''),
    reason: String(r[7] || ''),
    status: String(r[8] || ''),
    createdAt: String(r[9] || ''),
    actedBy: String(r[10] || ''),
    actedAt: String(r[11] || ''),
    covererDecision: String(r[12] || ''),
    covererAt: String(r[13] || '')
  })).filter(x =>
    x.be === Number(beYear) &&
    x.month === Number(monthIdx)
  );
}

function listIncomingSwapRequests(token, beYear, monthIdx){
  requireRole_(token,'viewer');
  const me = normalizeName_(getLoginPersonName_(token));
  if(!me) throw new Error('บัญชีนี้ไม่ได้ผูก personName');

  const sh = getRequestsSheet_();
  const last = sh.getLastRow();
  if(last <= 1) return [];

  const vals = sh.getRange(2,1,last-1,14).getValues();
  return vals
    .map(r=>({
      id:String(r[0]),
      be:Number(r[1]),
      month:Number(r[2]),
      day:Number(r[3]),
      shift:String(r[4]),
      requester:String(r[5]||''),
      coverer:String(r[6]||''),
      reason:String(r[7]||''),
      status:String(r[8]||''),
      createdAt:String(r[9]||''),
      actedBy:String(r[10]||''),
      actedAt:String(r[11]||''),
      covererDecision:String(r[12]||''),
      covererAt:String(r[13]||'')
    }))
    .filter(x =>
      x.be===Number(beYear) &&
      x.month===Number(monthIdx) &&
      normalizeName_(x.coverer)===me &&
      String(x.status||'')==='await_coverer'
    )
    .sort((a,b)=>(a.day-b.day) || (Number(a.shift)-Number(b.shift)));
}

/**
 * submitSwapRequest
 * ✅ requester มาจาก token เท่านั้น
 *
 * ✅ PATCH เพิ่ม:
 * - coverer ต้องไม่อยู่ใน "กะก่อนหน้า" หรือ "กะถัดไป"
 * - ยกเว้น: ถ้า coverer อยู่ใน "กะ2 ของวันปกติ (ไม่ใช่วันหยุด)" ให้ผ่านได้
 * - เปลี่ยนการหา item จาก RegExp \b -> startsWith เพื่อกันภาษาไทย match ไม่ติด
 *
 * ✅ PATCH เพิ่มใหม่ (ตามที่ขอ):
 * - ห้ามขอแทนเวร "ซ้ำของเดิม" (Requester คนเดิม ห้ามส่งซ้ำในกะเดิม/วันเดิม หากยัง active)
 * - กันยิงซ้ำแบบ requester+coverer ซ้ำในกะเดิม/วันเดิม หากยัง active
 */
function submitSwapRequest(token, beYear, monthIdx, day, shift, requester, coverer, reason){
  requireRole_(token,'viewer');

  // ✅ requester มาจาก token เท่านั้น (ไม่สนค่า requester ที่ส่งมาจากหน้าเว็บ)
  const requesterFromToken = getRequesterFromToken_(token);

  // normalize
  const requesterN = normalizeName_(requesterFromToken);
  const covererN   = normalizeName_(coverer);
  const reasonText = String(reason||'').trim();

  if(!requesterN || !covererN) throw new Error('กรุณาระบุผู้ร้องขอและผู้แทน');
  if(requesterN === covererN) throw new Error('ผู้ร้องขอและผู้แทนต้องเป็นคนละคน');
  if(!reasonText) throw new Error('กรุณาระบุเหตุผล');

  const md = getMonthData(beYear, monthIdx);
  const daysArr = (md.days||[]);
  const dObj = daysArr.find(x => Number(x.day) === Number(day));
  if(!dObj) throw new Error('ไม่พบวันดังกล่าว');

  const shiftKey = String(shift||'').trim(); // "1"|"2"|"3"
  if(!/^[123]$/.test(shiftKey)) throw new Error('กะไม่ถูกต้อง');

  // -------- helper: หา names ในกะของวัน (ใช้ startsWith กัน \b ภาษาไทย) --------
  const getShiftNames_ = (dayObj, sKey)=>{
    if(!dayObj) return [];
    const items = dayObj.items || [];
    const prefix = 'กะ' + String(sKey);
    const it = items.find(row => String((row && row.text) || '').trim().startsWith(prefix));
    return it ? extractPeople_(it.text).map(normalizeName_).filter(Boolean) : [];
  };

  // -------- helper: อนุโลมกรณียกเว้น (กะ2 ของวันปกติ) --------
  const isExceptionAllowed_ = (adjDayObj, adjShiftKey)=>{
    // "วันปกติ" = ไม่ใช่วันหยุด (d.isHoliday === false)
    return String(adjShiftKey) === '2' && adjDayObj && !adjDayObj.isHoliday;
  };

  // -------- 1) ตรวจว่า requester อยู่กะนี้จริง + coverer ไม่อยู่กะเดียวกัน --------
  const assigned = getShiftNames_(dObj, shiftKey);
  if(!assigned.length) throw new Error('ไม่มีกะนี้ในวันดังกล่าว');

  if(!assigned.includes(requesterN)) throw new Error('ผู้ร้องขอไม่ได้อยู่ในกะนี้');
  if(assigned.includes(covererN)) throw new Error('ผู้ที่อยู่เวรร่วมกันในกะนี้ ไม่สามารถขอแทนกันได้');

  // -------- 2) ✅ PATCH: coverer ต้องไม่อยู่ "กะก่อนหน้า/ถัดไป" --------
  // นิยามกะก่อนหน้า/ถัดไป:
  // - ขอแทนกะ1: prev = กะ3 ของ "วันก่อนหน้า", next = กะ2 ของ "วันเดียวกัน"
  // - ขอแทนกะ2: prev = กะ1 ของวันเดียวกัน, next = กะ3 ของวันเดียวกัน
  // - ขอแทนกะ3: prev = กะ2 ของวันเดียวกัน, next = กะ1 ของ "วันถัดไป"
  const getDayObjByDay_ = (dd)=> daysArr.find(x => Number(x.day) === Number(dd)) || null;

  let prevDayNum = Number(day), prevShiftKey = null;
  let nextDayNum = Number(day), nextShiftKey = null;

  if(shiftKey === '1'){
    prevDayNum = Number(day) - 1; prevShiftKey = '3';
    nextDayNum = Number(day);     nextShiftKey = '2';
  }else if(shiftKey === '2'){
    prevDayNum = Number(day);     prevShiftKey = '1';
    nextDayNum = Number(day);     nextShiftKey = '3';
  }else if(shiftKey === '3'){
    prevDayNum = Number(day);     prevShiftKey = '2';
    nextDayNum = Number(day) + 1; nextShiftKey = '1';
  }
  /*//จุดนี้ Block ไว้เพื่อให้สามารถขอสลับเวรในกะที่ติดกันได้ก่อน 
  const prevDayObj = getDayObjByDay_(prevDayNum);
  const nextDayObj = getDayObjByDay_(nextDayNum);

  // ตรวจ prev
  if(prevShiftKey && prevDayObj){
    const prevNames = getShiftNames_(prevDayObj, prevShiftKey);
    const allowed = isExceptionAllowed_(prevDayObj, prevShiftKey);
    if(prevNames.includes(covererN) && !allowed){
      throw new Error(`ผู้แทน "${covererN}" อยู่ในกะก่อนหน้า (วันที่ ${prevDayNum} / กะ${prevShiftKey}) จึงไม่สามารถมาแทนเวรนี้ได้`);
    }
  }
  // ตรวจ next
  if(nextShiftKey && nextDayObj){
    const nextNames = getShiftNames_(nextDayObj, nextShiftKey);
    const allowed = isExceptionAllowed_(nextDayObj, nextShiftKey);
    if(nextNames.includes(covererN) && !allowed){
      throw new Error(`ผู้แทน "${covererN}" อยู่ในกะถัดไป (วันที่ ${nextDayNum} / กะ${nextShiftKey}) จึงไม่สามารถมาแทนเวรนี้ได้`);
    }
  }
  */
  // -------- 3) ✅ PATCH ใหม่: ห้ามขอแทนเวร "ซ้ำของเดิม" --------
  // - ห้าม requester ส่งซ้ำในวัน/กะเดิม หากยัง active (await_coverer/pending/approved)
  // - กัน requester+coverer ซ้ำในวัน/กะเดิม หากยัง active
  const sh = getRequestsSheet_();
  const last = sh.getLastRow();

  if(last > 1){
    const vals = sh.getRange(2,1,last-1,14).getValues();
    const activeStatuses = ['await_coverer','pending','approved'];

    const sameShiftActive = vals.filter(r =>
      Number(r[1])===Number(beYear) &&
      Number(r[2])===Number(monthIdx) &&
      Number(r[3])===Number(day) &&
      String(r[4])===String(shiftKey) &&
      activeStatuses.includes(String(r[8]||''))
    );

    // (3.1) requester คนเดิม ห้ามส่งซ้ำในกะเดิม/วันเดิม (แม้เปลี่ยน coverer ก็ห้าม)
    const requesterAlreadyActive = sameShiftActive.some(r =>
      normalizeName_(r[5]||'') === requesterN
    );
    if(requesterAlreadyActive){
      throw new Error('คุณได้ส่งคำขอแทนเวรสำหรับวัน/กะนี้ไว้แล้ว (ยังไม่สิ้นสุดกระบวนการ) จึงไม่สามารถส่งซ้ำได้');
    }

    // (3.2) กัน requester+coverer ซ้ำเป๊ะในกะเดิม/วันเดิม (กันกดซ้ำ/ยิงซ้ำ)
    const samePairAlreadyActive = sameShiftActive.some(r =>
      normalizeName_(r[5]||'') === requesterN &&
      normalizeName_(r[6]||'') === covererN
    );
    if(samePairAlreadyActive){
      throw new Error('มีคำขอเดิม (ผู้ขอ/ผู้แทนชุดเดิม) สำหรับวัน/กะนี้อยู่แล้ว จึงไม่สามารถส่งซ้ำได้');
    }

    // -------- 4) (ของเดิม) ตรวจซ้ำซ้อนกับคำขอเดิมในมุม "คนที่ได้รับอนุมัติแล้ว/ผู้แทนถูกใช้ไปแล้ว" --------
    const approvedCoverers = sameShiftActive
      .filter(r => String(r[8]) === 'approved')
      .map(r => normalizeName_(r[6]));

    if(approvedCoverers.includes(requesterN) || approvedCoverers.includes(covererN)){
      throw new Error('ผู้ที่ได้รับอนุมัติให้อยู่เวรแทนแล้วในกะนี้ จะไม่สามารถส่งคำขอใหม่ได้');
    }

    if(assigned.length === 2){
      const usedCoverers = sameShiftActive.map(r => normalizeName_(r[6]));
      if(usedCoverers.includes(covererN)){
        throw new Error(`ผู้แทน "${covererN}" ถูกเลือกแทนแล้วในกะนี้`);
      }
    }
  }

  // -------- 5) ตรวจ coverer ต้องอยู่ในรายชื่อพนักงาน --------
  const allNames = getPeople_().map(p=>normalizeName_(p.name));
  if(!allNames.includes(covererN)) throw new Error('ไม่พบชื่อผู้แทนในรายชื่อ');

  // -------- 6) บันทึกคำขอ --------
  const id = Utilities.getUuid();
  const now = nowText_();

  sh.appendRow([
    id, Number(beYear), Number(monthIdx), Number(day), String(shiftKey),
    requesterN, covererN, reasonText,
    'await_coverer', now,
    '', '',
    '', ''
  ]);

  // ✅ Webex notify: มีคำขอใหม่ (รอผู้แทนตอบรับ)
  sendNotify_(webexSwapMessage_('มีคำขอแทนเวรใหม่ (รอผู้แทนตอบรับ)', {
    beYear:Number(beYear), monthIdx:Number(monthIdx), day:Number(day), shift:String(shiftKey),
    requester: requesterN, coverer: covererN, reason: reasonText, status: 'await_coverer', actor: requesterN
  }));

  return { ok:true, id, status:'await_coverer', requester: requesterN };
}


function respondCovererSwap(token, id, accept){
  requireRole_(token,'viewer');

  const me = normalizeName_(getLoginPersonName_(token));
  if(!me) throw new Error('บัญชีนี้ไม่ได้ผูก personName');

  const sh = getRequestsSheet_();
  const last = sh.getLastRow();
  if(last<=1) throw new Error('ไม่มีคำขอ');

  const vals = sh.getRange(2,1,last-1,14).getValues();
  for(let i=0;i<vals.length;i++){
    if(String(vals[i][0])===String(id)){
      const status = String(vals[i][8]||'');
      if(status !== 'await_coverer') throw new Error('คำขอนี้ไม่ได้อยู่ในสถานะรอผู้แทนตอบรับ');

const coverer = normalizeName_(vals[i][6]||'');
if(me !== coverer) throw new Error('เฉพาะผู้แทนที่ถูกระบุเท่านั้นที่สามารถตอบรับ/ปฏิเสธได้');

const now = nowText_();
const decision = accept ? 'accept' : 'reject';

// ✅ เปลี่ยนจาก pending -> await_inspector
vals[i][8]  = accept ? 'await_inspector' : 'coverer_rejected';
vals[i][10] = 'coverer';
vals[i][11] = now;
vals[i][12] = decision;
vals[i][13] = now;

sh.getRange(i+2,1,1,14).setValues([vals[i]]);

// ✅ Webex notify: ผู้แทนตอบกลับ
sendNotify_(webexSwapMessage_(
  accept ? 'ผู้แทน "ยอมรับ" คำขอแทนเวร (รอผู้ตรวจสอบ)' : 'ผู้แทน "ปฏิเสธ" คำขอแทนเวร',
  {
    beYear:Number(vals[i][1]),
    monthIdx:Number(vals[i][2]),
    day:Number(vals[i][3]),
    shift:String(vals[i][4]),
    requester:String(vals[i][5]||''),
    coverer:String(vals[i][6]||''),
    reason:String(vals[i][7]||''),
    status: String(vals[i][8]||''),
    actor: me
  }
));

return { ok:true, status: vals[i][8], covererDecision: decision, covererAt: now };
    }
  }
  throw new Error('ไม่พบคำขอ');
}

/***** ALIASES: รองรับชื่อฟังก์ชันฝั่ง HTML สำหรับ "ผู้แทนตอบรับคำขอ" *****/
function covererRespond(token, id, decision){
  const v = String(decision||'').toLowerCase().trim();
  const accept = (decision === true) || v === 'accept' || v === 'approve' || v === 'yes' || v === 'true';
  return respondCovererSwap(token, id, accept);
}
function respondCoverer(token, id, accept){ return respondCovererSwap(token, id, !!accept); }
function respondCovererRequest(token, id, accept){ return respondCovererSwap(token, id, !!accept); }
function covererDecision(token, id, accept){ return respondCovererSwap(token, id, !!accept); }
function covererRespondSwapRequest(token, id, accept){ return respondCovererSwap(token, id, !!accept); }
function respondToSwapRequest(token, id, accept){ return respondCovererSwap(token, id, !!accept); }
function respondSwapRequest(token, id, accept){ return respondCovererSwap(token, id, !!accept); }
function respondSwapOffer(token, id, accept){ return respondCovererSwap(token, id, !!accept); }
function acceptSwapRequest(token, id, accept){ return respondCovererSwap(token, id, !!accept); }
function covererAcceptRequest(token, id){ return respondCovererSwap(token, id, true); }
function covererRejectRequest(token, id){ return respondCovererSwap(token, id, false); }

function cancelSwapRequest(token, id){
  requireRole_(token,'viewer');

  // ✅ ผู้ยกเลิกต้องเป็น "เจ้าของคำขอ" เท่านั้น
  const me = getRequesterFromToken_(token);

  const sh = getRequestsSheet_();
  const last = sh.getLastRow();
  if(last<=1) throw new Error('ไม่มีคำขอ');

  const vals = sh.getRange(2,1,last-1,14).getValues();
  for(let i=0;i<vals.length;i++){
    if(String(vals[i][0])===String(id)){
      const st = String(vals[i][8]||'');
      if(!['await_coverer','pending'].includes(st)){
        throw new Error('ยกเลิกได้เฉพาะคำขอที่ยังรอดำเนินการ (รอผู้แทนตอบรับ/รออนุมัติ)');
      }

      const owner = normalizeName_(vals[i][5]||'');
      if(me !== owner){
        throw new Error('ยกเลิกได้เฉพาะผู้ขอเท่านั้น');
      }

      vals[i][8]  = 'cancelled';
      vals[i][10] = 'requester';
      vals[i][11] = nowText_();
      sh.getRange(i+2,1,1,14).setValues([vals[i]]);

      // ✅ Webex notify: ผู้ขอยกเลิกคำขอ
      sendWebexMarkdown_(webexSwapMessage_('ผู้ขอยกเลิกคำขอแทนเวร', {
        beYear:Number(vals[i][1]), monthIdx:Number(vals[i][2]), day:Number(vals[i][3]), shift:String(vals[i][4]),
        requester:String(vals[i][5]||''), coverer:String(vals[i][6]||''), reason:String(vals[i][7]||''),
        status: String(vals[i][8]||''), actor: String(vals[i][5]||'')
      }));

      return true;
    }
  }
  throw new Error('ไม่พบคำขอ');
}

/* =============================================================================
 * UPDATE SHIFT CELL (ใช้ตอนอนุมัติ) — แก้เฉพาะบรรทัด “กะX”
 * ============================================================================= */
function updateShiftCell_(sh, beYear, monthIdx, day, shift, requester, coverer){
  const lastCol = sh.getLastColumn();
  const dates = sh.getRange(1,1,1,lastCol).getValues()[0];
  let col=-1;
  for(let c=0;c<dates.length;c++){
    if(Number(dates[c])===Number(day)){ col=c+1; break; }
  }
  if(col===-1) throw new Error(`ไม่พบวันที่ ${day}`);

  const lastRow = Math.max(sh.getLastRow(), START_DATA_ROW);
  let targetRow=-1, rawHead='', names=[];
  for(let r=START_DATA_ROW;r<=lastRow;r++){
    const raw = String(sh.getRange(r,col).getValue()||'').trim();
    if(!raw) continue;
    if(new RegExp('^กะ'+shift+'\\b').test(raw)){
      targetRow = r;
      const at = raw.indexOf('):');
      rawHead = at>=0 ? raw.slice(0,at+2) : (raw.split(':')[0]+':');
      names = extractPeople_(raw);
      break;
    }
  }
  if(targetRow===-1) throw new Error('ไม่พบแถวกะที่ระบุ');

  const idx = names.findIndex(n=>normalizeName_(n)===normalizeName_(requester));
  if(idx===-1) throw new Error('ไม่พบชื่อผู้ร้องขอในกะนี้');
  names[idx] = coverer;

  // uniq กันชื่อซ้ำ
  const uniq=[], seen=new Set();
  names.forEach(n=>{
    const k=normalizeName_(n);
    if(!k) return;
    if(!seen.has(k)){ uniq.push(n); seen.add(k); }
  });

  // ✅ หลังแก้ชื่อ อาจเกิดกรณี "ต้องห้าม" กลายเป็นคนแรกของกะ 2 คน -> สลับให้
  if(uniq.length>=2){
    const pair = ensureForbiddenNotFirstPair_(uniq[0], uniq[1]);
    uniq[0]=pair[0]; uniq[1]=pair[1];
  }

  const newLine = `${rawHead} ${uniq.join(', ')}`;
  sh.getRange(targetRow,col).setValue(newLine);
}

/* =============================================================================
 * APPROVE / REJECT (Editor)
 * ============================================================================= */
function approveRequest(token, id, approve){
  requireRole_(token,'editor');

  const sh = getRequestsSheet_();
  const last = sh.getLastRow();
  if(last<=1) throw new Error('ไม่มีคำขอ');

  const vals = sh.getRange(2,1,last-1,14).getValues();
  let row=null, rowIdx=-1;
  for(let i=0;i<vals.length;i++){
    if(String(vals[i][0])===String(id)){
      row = vals[i]; rowIdx = i+2; break;
    }
  }
  if(!row) throw new Error('ไม่พบคำขอ');

  const status = String(row[8]||'');
  if(status !== 'pending'){
    if(status === 'await_coverer'){
      throw new Error('ต้องรอให้ผู้แทนกดยอมรับก่อน จึงจะส่งให้ผู้อนุมัติได้');
    }
    throw new Error('คำขอนี้ได้รับการดำเนินการแล้ว');
  }

  const beYear   = Number(row[1]);
  const monthIdx = Number(row[2]);
  const day      = Number(row[3]);
  const shift    = String(row[4]);
  const requester= String(row[5]||'');
  const coverer  = String(row[6]||'');

  if(approve){
    const mSheet = safeGetMonthSheet_(beYear, monthIdx);
    if(!mSheet) throw new Error('ไม่พบชีตรายเดือนสำหรับอัปเดตเวร');
    updateShiftCell_(mSheet, beYear, monthIdx, day, shift, requester, coverer);
  }

  const now = nowText_();
  row[8]  = approve ? 'approved' : 'rejected';
  row[10] = 'editor';
  row[11] = now;
  sh.getRange(rowIdx,1,1,14).setValues([row]);

  // ✅ Webex notify: ผลการอนุมัติ
  sendNotify_(webexSwapMessage_(
    approve ? 'ผู้อนุมัติ "อนุมัติ" คำขอแทนเวร ✅' : 'ผู้อนุมัติ "ไม่อนุมัติ" คำขอแทนเวร ❌',
    {
      beYear, monthIdx, day, shift,
      requester, coverer,
      reason: String(row[7]||''),
      status: String(row[8]||''),
      actor: 'editor'
    }
  ));

  return true;
}

/* =============================================================================
 * ATTENDANCE SHEET
 * ============================================================================= */
function getAttendanceSheet_(){
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(ATTENDANCE_SHEET);
  const HEAD16 = [
    'TimestampServer','BE','Month','Day','Shift','Action','Name',
    'Status','Note','Lat','Lng','PhotoUrl','ClientTime',
    'OutageHV','OutageLV','OutageJson'
  ];

  if(!sh){
    sh = ss.insertSheet(ATTENDANCE_SHEET);
    sh.getRange(1,1,1,HEAD16.length).setValues([HEAD16]);
    sh.setFrozenRows(1);
    return sh;
  }

  // ---- upgrade ให้ครบ 16 คอลัมน์ ----
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const head = sh.getRange(1,1,1,Math.max(lastCol, HEAD16.length)).getValues()[0];

  const hasAction   = head.includes('Action');
  const hasOutageHV = head.includes('OutageHV');
  const needCols = HEAD16.length - sh.getLastColumn();

  // ถ้าชีตเก่าขาดคอลัมน์ ให้เพิ่มจนถึง 16
  if(needCols > 0){
    sh.insertColumnsAfter(sh.getLastColumn(), needCols);
  }

  // ถ้าหัวตารางไม่ครบ/ไม่ตรง ให้ set ใหม่ทั้ง 16 ช่อง
  if(!hasAction || !hasOutageHV || sh.getLastColumn() < HEAD16.length){
    sh.getRange(1,1,1,HEAD16.length).setValues([HEAD16]);
    sh.setFrozenRows(1);
  }

  return sh;
}


function getShiftWindow_(beYear, monthIdx, day, sNum){
  const ceYear = Number(beYear) - 543;
  const mZero  = Number(monthIdx) - 1;
  const d      = Number(day);

  let startHour=0, startMin=30, endHour=8, endMin=30;
  if(sNum===2){ startHour=8;  startMin=30; endHour=16; endMin=30; }
  else if(sNum===3){ startHour=16; startMin=30; endHour=0; endMin=30; }

  const start = new Date(ceYear, mZero, d, startHour, startMin, 0, 0);
  let end = new Date(ceYear, mZero, d, endHour, endMin, 0, 0);
  if(sNum===3){
    end = new Date(ceYear, mZero, d+1, endHour, endMin, 0, 0);
  }
  return { start, end };
}

/**
 * ✅ helper: ตรวจว่าชื่อผู้ใช้อยู่เวรจริงในวัน/กะนั้นหรือไม่
 * - ใช้ข้อมูลจาก getMonthData() เหมือนโมดูล swap
 * - ถ้าไม่พบกะ/วัน => คืน { ok:false, reason:'...' }
 */
function isScheduledInShift_(beYear, monthIdx, day, shift, personName){
  const md = getMonthData(beYear, monthIdx);
  const dObj = (md.days||[]).find(x => Number(x.day) === Number(day));
  if(!dObj) return { ok:false, reason:'ไม่พบวันดังกล่าวในข้อมูลตารางเวร' };

  const it = (dObj.items||[]).find(row => new RegExp('^กะ'+shift+'\\b').test(String(row.text||'')));
  if(!it) return { ok:false, reason:'ไม่มีกะนี้ในวันดังกล่าว' };

  const assigned = extractPeople_(it.text).map(normalizeName_);
  const me = normalizeName_(personName);
  if(!assigned.includes(me)) return { ok:false, reason:'ชื่อผู้ใช้ไม่ได้ถูกจัดอยู่ในกะนี้' };

  return { ok:true, assignedRaw: assigned };
}

/*function recordAttendance(token, beYear, monthIdx, day, shift, action, clientIso, lat, lng, imageDataUrl){*/
function recordAttendance(token, beYear, monthIdx, day, shift, action, clientIso, lat, lng, imageDataUrl, extraPayload){
  const sess = ensureLogged_(token);
  const name = normalizeName_(sess.personName);
  if(!name){
    throw new Error('บัญชีผู้ใช้นี้ไม่ได้ผูกกับชื่อใน "ชีต1" กรุณาติดต่อผู้ดูแลระบบ');
  }

  const role = String(sess.role||'viewer').toLowerCase().trim();

  const sNum = Number(shift);
  if(!day || ![1,2,3].includes(sNum)) throw new Error('ข้อมูลวันหรือกะไม่ถูกต้อง');

  action = String(action||'IN').toUpperCase().trim();
  if(!['IN','OUT'].includes(action)) throw new Error('กรุณาเลือกประเภทการลงชื่อ: IN หรือ OUT');

  const allNames = getPeople_().map(p=>normalizeName_(p.name));
  if(!allNames.includes(name)) throw new Error(`ไม่พบชื่อ "${name}" ใน "ชีต1"`);

  // ✅ (ข้อ 2) ตรวจว่าอยู่เวรจริงในวัน/กะนั้น
  // - viewer: ไม่ให้ลงชื่อถ้าไม่ถูกจัด
  // - editor: ให้ลงชื่อได้ แต่ติด status/note ว่า override
  let scheduleOverride = false;
  let scheduleWarn = '';
  try{
    const sc = isScheduledInShift_(beYear, monthIdx, day, String(shift), name);
    if(!sc.ok){
      if(role === 'editor'){
        scheduleOverride = true;
        scheduleWarn = ` (override: ${sc.reason})`;
      }else{
        throw new Error(`ไม่อนุญาตให้ลงชื่อ: ${sc.reason}`);
      }
    }
  }catch(e){
    // ถ้าฟังก์ชันช่วยเหลือ/โครงข้อมูลตารางเวรมีปัญหา ให้ยึดตาม policy เดิม: viewer ไม่ผ่าน, editor ผ่านแบบ override
    if(role === 'editor'){
      scheduleOverride = true;
      scheduleWarn = ` (override: ตรวจสอบตารางเวรไม่สำเร็จ)`;
    }else{
      throw e;
    }
  }

  const sh = getAttendanceSheet_();

  // ✅ โหลดรายการเดิมของ "คนนี้/วันเดียวกัน/กะเดียวกัน" เพื่อตรวจซ้ำ + ตรวจลำดับ IN/OUT
  const last = sh.getLastRow();
  let existing = [];
  if(last > 1){
    // อ่าน B..G (BE,Month,Day,Shift,Action,Name)
    const vals = sh.getRange(2,2,last-1,6).getValues();
    existing = vals
      .filter(r =>
        Number(r[0])===Number(beYear) &&
        Number(r[1])===Number(monthIdx) &&
        Number(r[2])===Number(day) &&
        String(r[3])===String(shift) &&
        normalizeName_(r[5])===name
      )
      .map(r => String(r[4]||'').toUpperCase().trim()); // Action list
  }

  // ✅ กันลงชื่อ action เดิมซ้ำ (คง logic เดิม)
  if(existing.includes(action)){
    throw new Error('มีข้อมูลการลงชื่อประเภทนี้สำหรับวันและกะนี้แล้ว');
  }

  // ✅ (ข้อ 1) กัน OUT โดยไม่มี IN ก่อน
  if(action === 'OUT' && !existing.includes('IN')){
    throw new Error('ไม่สามารถลงชื่อออก (OUT) ได้ เนื่องจากยังไม่มีการลงชื่อเข้า (IN) ของวันและกะนี้');
  }

  const tz = Session.getScriptTimeZone();
  const now = new Date();

  let clientDate=null;
  try{ clientDate = clientIso ? new Date(clientIso) : null; }catch(e){}
  let tUse = (clientDate && !isNaN(clientDate.getTime())) ? clientDate : now;

  const win = getShiftWindow_(beYear, monthIdx, day, sNum);
  const shiftStart = win.start;
  const shiftEnd   = win.end;

  const earliestIn = new Date(shiftStart.getTime() - 30*60000);
  const latestOut  = new Date(shiftEnd.getTime() + 30*60000);

  let status='', note='';

  if(action==='IN'){
    if(tUse.getTime() < earliestIn.getTime()){
      throw new Error('สามารถลงชื่อเข้าได้ล่วงหน้าไม่เกิน 30 นาที ก่อนเวลาเข้ากะ');
    }
    status = 'IN_ON_TIME';
    note = 'ลงชื่อเข้า: ตรงเวลา';
    if(tUse.getTime() > shiftStart.getTime()){
      status = 'IN_LATE';
      note = 'ลงชื่อเข้า: สาย';
    }
  }else{
    // ✅ OUT: อนุญาตลงชื่อออกได้ล่วงหน้า 30 นาที (ไม่ถือว่าออกก่อนเวลา)
    const graceEarlyOut = 30 * 60000;

    if(tUse.getTime() > latestOut.getTime()){
      throw new Error('ลงชื่อออกหลังเวลาเลิกกะได้ไม่เกิน 30 นาที');
    }

    const earliestOkOut = new Date(shiftEnd.getTime() - graceEarlyOut);
    if(tUse.getTime() < earliestOkOut.getTime()){
      status = 'OUT_EARLY';
      note = 'ลงชื่อออก: ก่อนเวลา';
    }else{
      status = 'OUT_OK';
      note = 'ลงชื่อออก: ตรงเวลา';
      // ✅ ปัดเวลาให้เป็นเวลาเลิกกะ
      tUse = new Date(shiftEnd.getTime());
    }
  }

  // ✅ ถ้า editor override ให้แปะสถานะ/หมายเหตุเพิ่มแบบไม่ทำลาย logic เดิม
  if(scheduleOverride){
    status = `${status}_OVERRIDE`;
    note = `${note}${scheduleWarn}`;
  }

  let photoUrl = '';

try {
  const s = imageDataUrl ? String(imageDataUrl) : '';

  // ✅ ตรวจแบบยืดหยุ่น
  if (s && s.includes('base64')) {

    const parts = s.split(',');
    if (parts.length < 2) throw new Error('base64 format ผิด');

    const meta = parts[0];
    const base64 = parts[1];

    const contentTypeMatch = meta.match(/data:(.*);base64/);
    const contentType = contentTypeMatch ? contentTypeMatch[1] : 'image/jpeg';

    const bytes = Utilities.base64Decode(base64);

    const safeName = name.replace(/[\\\/\[\]\*\?\:]/g,'_');
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');

    const fileName = `ATT_${safeName}_${stamp}.jpg`;

    const blob = Utilities.newBlob(bytes, contentType, fileName);

    let file;
    if (PHOTO_FOLDER_ID) {
      file = DriveApp.getFolderById(PHOTO_FOLDER_ID).createFile(blob);
    } else {
      file = DriveApp.createFile(blob);
    }

    photoUrl = file.getUrl();

    Logger.log('✅ Uploaded file: ' + photoUrl);

  } else {
    Logger.log('❌ ไม่พบ base64 image');
  }

} catch (err) {
  Logger.log('❌ Upload error: ' + err.message);
  photoUrl = '';
}

  const tsServer = Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm:ss');
  const tsClient = Utilities.formatDate(tUse, tz, 'yyyy-MM-dd HH:mm:ss');
  
  // ===== NEW: OUTAGE payload (เฉพาะหัวหน้าเวรตอน OUT) =====
  let outageHV = '', outageLV = '', outageJson = '';
  let clean = [];
  if(extraPayload && typeof extraPayload === 'object'){
    // คาดหวังรูปแบบจาก popup:
    // { type:'OUTAGE_SUMMARY', hvCount:Number, lvCount:Number, outages:[{site,minutes}] }
    if(String(extraPayload.type||'') === 'OUTAGE_SUMMARY'){
      if(action !== 'OUT'){
        // ถ้าส่งมาแต่ไม่ใช่ OUT ก็ไม่เอาไปใช้
      }else{
        const hv = Number(extraPayload.hvCount || 0);
        const lv = Number(extraPayload.lvCount || 0);
        const outages = Array.isArray(extraPayload.outages) ? extraPayload.outages : [];

        if(hv < 0 || lv < 0) throw new Error('ข้อมูลเหตุขัดข้องไม่ถูกต้อง (จำนวนรายการต้องเป็น 0 หรือมากกว่า)');

        // normalize outages
        clean = outages.map(o => ({
  site: String(o.site || '').trim(),
  minutes: Number(o.minutes || 0),

  // ✅ เพิ่มใหม่ โดยไม่กระทบของเดิม
  voltageLevel: String(o.voltageLevel || '').trim(),
  cause: String(o.cause || 'ไม่ทราบสาเหตุ').trim(),
  causeNote: String(o.causeNote || '').trim()
})).filter(x => x.site || x.minutes || x.causeNote);

        for(const o of clean){
          if(!Number.isFinite(o.minutes) || o.minutes < 0){
            throw new Error('ข้อมูลเหตุขัดข้องไม่ถูกต้อง (นาทีดับต้องเป็น 0 หรือมากกว่า)');
          }
        }

        outageHV = String(hv);
        outageLV = String(lv);
        outageJson = clean.length ? JSON.stringify(clean) : '';
      }
    }
  }

  sh.appendRow([
    tsServer, Number(beYear), Number(monthIdx), Number(day), String(shift),
    action, name,
    status, note,
    lat||'', lng||'',
    photoUrl, tsClient,

    // ===== NEW columns =====
    outageHV, outageLV, outageJson
  ]);

  appendOutageMemory_({
  tsServer,
  tsClient,
  beYear: Number(beYear),
  monthIdx: Number(monthIdx),
  day: Number(day),
  shift: String(shift),
  name,
  lat: lat || '',
  lng: lng || '',
  photoUrl,
  outageHV,
  outageLV,
  outages: clean
});

  /*sh.appendRow([
    tsServer, Number(beYear), Number(monthIdx), Number(day), String(shift),
    action, name,
    status, note,
    lat||'', lng||'',
    photoUrl, tsClient
  ]);*/

  // ✅ Webex notify: ลงชื่อเข้า/ออก สำเร็จ

    sendNotify_(webexAttendanceMessage_(
    action === 'IN' ? 'ลงชื่อเข้าเวร' : 'ลงชื่อออกเวร',
    {
      beYear:Number(beYear), monthIdx:Number(monthIdx), day:Number(day), shift:String(shift),
      action, name, status, note,
      tsServer, tsClient,
      lat: (lat||''), lng: (lng||''),
      photoUrl,
      outageHV, outageLV, outageJson
    }
  ));
/*
  sendNotify_(webexAttendanceMessage_(
    action === 'IN' ? 'ลงชื่อเข้าเวร' : 'ลงชื่อออกเวร',
    {
      beYear:Number(beYear), monthIdx:Number(monthIdx), day:Number(day), shift:String(shift),
      action, name, status, note,
      tsServer, tsClient,
      lat: (lat||''), lng: (lng||''),
      photoUrl
    }
  ));*/

  return { ok:true, status, note, serverTime: tsServer };
}

/* =============================================================================
 * DAILY SIGN SUMMARY (สรุป IN/OUT ต่อกะ/ต่อคน สำหรับทำใบลงชื่อรายวัน)
 * ✅ ปรับ: ช่อง "ลงชื่อ" ให้ใส่เฉพาะชื่อจริงคำแรก (ตัดคำนำหน้า)
 * ✅ ปรับ: ถ้ายังไม่ลงชื่อ OUT -> outSign ต้องว่าง (ไม่ให้โชว์ชื่อก่อน)
 * ============================================================================= */

function getFirstNameOnly_(fullName){
  if(!fullName) return '';
  let s = String(fullName).trim();
  s = s.replace(/^(นาย|นางสาว|น\.ส\.|นาง|ด\.ช\.|ด\.ญ\.|Mr\.|Mrs\.|Ms\.)\s*/i, '');
  const parts = s.split(/\s+/);
  return parts[0] || '';
}

function buildDailyAttendanceSummary_(beYear, monthIdx, dayNum){
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(ATTENDANCE_SHEET);
  if(!sh) throw new Error('ไม่พบชีต Attendance');

  const tz = Session.getScriptTimeZone();
  const values = sh.getDataRange().getValues();
  if(values.length < 2) return {1:[],2:[],3:[]};

  const COL_TS=0, COL_BE=1, COL_M=2, COL_D=3, COL_SHIFT=4, COL_ACTION=5, COL_NAME=6, COL_NOTE=8;

  const map = {}; // shift|name

  for(let r=1; r<values.length; r++){
    const row = values[r];
    const be = Number(row[COL_BE]), m = Number(row[COL_M]), d = Number(row[COL_D]);
    if(be!==Number(beYear) || m!==Number(monthIdx) || d!==Number(dayNum)) continue;

    const shift = Number(row[COL_SHIFT]);
    const action = String(row[COL_ACTION]||'').trim().toUpperCase();
    const name = normalizeName_(row[COL_NAME]||'');
    if(!name || ![1,2,3].includes(shift) || !['IN','OUT'].includes(action)) continue;

    const tsRaw = row[COL_TS];
    const ts = (tsRaw instanceof Date) ? tsRaw : new Date(String(tsRaw).replace(' ', 'T'));
    if(isNaN(ts.getTime())) continue;

    const note = String(row[COL_NOTE]||'').trim();
    const key = `${shift}|${name}`;
    if(!map[key]) map[key] = { name, shift, inDate:null, outDate:null, note:'' };

    if(note && !map[key].note.includes(note)){
      map[key].note = map[key].note ? (map[key].note + ' | ' + note) : note;
    }

    if(action==='IN'){
      if(!map[key].inDate || ts < map[key].inDate) map[key].inDate = ts;
    }else{
      if(!map[key].outDate || ts > map[key].outDate) map[key].outDate = ts;
    }
  }

  const out = {1:[],2:[],3:[]};
  Object.keys(map).forEach(k=>{
    const it = map[k];

    const inTime  = it.inDate  ? Utilities.formatDate(it.inDate,  tz, 'HH:mm') : '';

    let outDateUse = it.outDate ? new Date(it.outDate.getTime()) : null;

    if(outDateUse){
      // ✅ ถ้า OUT ก่อนเวลา แต่ไม่เกิน 30 นาที → ปัดเป็นเวลาเลิกกะ
      const win = getShiftWindow_(beYear, monthIdx, dayNum, it.shift);
      const shiftEnd = win.end;

      const graceEarlyOut = 30 * 60000;
      const earliestOkOut = new Date(shiftEnd.getTime() - graceEarlyOut);

      if(outDateUse.getTime() < shiftEnd.getTime() && outDateUse.getTime() >= earliestOkOut.getTime()){
        outDateUse = shiftEnd;
      }
    }

    const outTime = outDateUse ? Utilities.formatDate(outDateUse, tz, 'HH:mm') : '';

    const signName = getFirstNameOnly_(it.name);

    out[it.shift].push({
      name: it.name,
      inTime,
      outTime,

      // ✅ สำคัญ: ลงชื่อ เฉพาะเมื่อ "มีเวลา" จริง
      inSign:  inTime  ? signName : '',
      outSign: outTime ? signName : '',

      note: it.note
    });
  });

  [1,2,3].forEach(s => out[s].sort((a,b)=>String(a.name).localeCompare(String(b.name))));
  return out;
}

function buildDailyOutageSummary_(beYear, monthIdx, dayNum){
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(ATTENDANCE_SHEET);
  if(!sh) throw new Error('ไม่พบชีต Attendance');

  const values = sh.getDataRange().getValues();
  if(values.length < 2) return {1:null,2:null,3:null};

  // ===== หา leader ของแต่ละกะจากตารางเวร (วันเดียวกัน) =====
  const md = getMonthData(beYear, monthIdx);
  const dObj = (md.days||[]).find(x => Number(x.day) === Number(dayNum));
  const leaders = {1:'',2:'',3:''};

  if(dObj){
    const items = dObj.items || [];
    const findNames = (prefix)=>{
      const it = items.find(x => String((x && x.text)||'').trim().startsWith(prefix));
      return it ? extractPeople_(it.text).map(normalizeName_).filter(Boolean) : [];
    };
    // ใช้ logic หัวหน้าเวร “ข้าม forbidden” ตามระบบหลักของคุณ
    leaders[1] = pickLeaderName_(findNames('กะ1'));
    leaders[2] = pickLeaderName_(findNames('กะ2'));
    leaders[3] = pickLeaderName_(findNames('กะ3'));
  }

  // หา index จากหัวตาราง
  const head = values[0].map(x=>String(x||'').trim());
  const idx = (name, fallback)=> {
    const i = head.indexOf(name);
    return (i >= 0) ? i : fallback;
  };

  const COL_TS    = idx('TimestampServer', 0);
  const COL_BE    = idx('BE', 1);
  const COL_M     = idx('Month', 2);
  const COL_D     = idx('Day', 3);
  const COL_SHIFT = idx('Shift', 4);
  const COL_ACT   = idx('Action', 5);
  const COL_NAME  = idx('Name', 6);

  const COL_HV    = idx('OutageHV', 13);
  const COL_LV    = idx('OutageLV', 14);
  const COL_JSON  = idx('OutageJson', 15);

  const latest = {1:null,2:null,3:null};

  for(let r=1; r<values.length; r++){
    const row = values[r];

    const be = Number(row[COL_BE]);
    const m  = Number(row[COL_M]);
    const d  = Number(row[COL_D]);
    if(be!==Number(beYear) || m!==Number(monthIdx) || d!==Number(dayNum)) continue;

    const action = String(row[COL_ACT]||'').trim().toUpperCase();
    if(action !== 'OUT') continue;

    const shift = Number(row[COL_SHIFT]);
    if(![1,2,3].includes(shift)) continue;

    const by = normalizeName_(row[COL_NAME]||'');

    // ✅ (1) ต้องเป็นหัวหน้าเวรของกะนั้นจริง (ถ้าหาหัวหน้าได้)
    const leader = leaders[shift];
    if(leader && by !== normalizeName_(leader)) continue;

    const hvRaw = String(row[COL_HV]||'').trim();
    const lvRaw = String(row[COL_LV]||'').trim();
    const json  = String(row[COL_JSON]||'').trim();

    // ✅ (2) ข้ามแถวที่ไม่มีข้อมูล outage เลย (กัน OUT คนอื่นมาทับ)
    if(!hvRaw && !lvRaw && !json) continue;

    let ts = null;
    const tsRaw = row[COL_TS];
    if(tsRaw instanceof Date) ts = tsRaw;
    else{
      const t = new Date(String(tsRaw||'').replace(' ', 'T'));
      if(!isNaN(t.getTime())) ts = t;
    }
    if(!ts) ts = new Date(0);

    const hv = Number(hvRaw || 0);
    const lv = Number(lvRaw || 0);

    let items = [];
    if(json){
      try{
        const arr = JSON.parse(json);
        if(Array.isArray(arr)){
          items = arr.map(o=>({
            site: String((o && o.site) || '').trim(),
            minutes: Number((o && o.minutes) || 0)
          })).filter(x=>x.site || x.minutes);
        }
      }catch(e){}
    }

    const payload = { ts, by, hv, lv, items };

    if(!latest[shift] || (payload.ts.getTime() > latest[shift].ts.getTime())){
      latest[shift] = payload;
    }
  }

  return latest;
}



/* =============================================================================
 * COMMON: Logo helper
 * ============================================================================= */
function drawLogoTopLeft_(sheet, widthPx, heightPx, topRowsPx, firstTextRow){
  try{
    const blob = DriveApp.getFileById(LOGO_FILE_ID).getBlob();
    const img = sheet.insertImage(blob, 1, 1);
    if(typeof img.setWidth==='function') img.setWidth(widthPx||110);
    if(typeof img.setHeight==='function') img.setHeight(heightPx||90);
  }catch(e){ /* ignore */ }

  const headRows = Math.max(firstTextRow-1, 1);
  const px = Math.max(topRowsPx||110, 80);
  sheet.setRowHeights(1, headRows, Math.ceil(px/headRows));
}

/* =============================================================================
 * ใบลงชื่อรายวัน (Render Sheet) — ปรับหัวข้อชิดซ้าย
 * ============================================================================= */
function renderDailySignSheet_(sh, beYear, monthIdx, dayNum, sum, outage){

  sh.clear();
  sh.setHiddenGridlines(true);

  drawLogoTopLeft_(sh, 110, 90, 110, 6);

  const monthName = TH_MONTHS[monthIdx-1];

  sh.getRange('A6:C6')
    .merge()
    .setValue('บัญชีลงนามปฏิบัติงานแก้ไฟฟ้าขัดข้องประจำวัน')
    .setFontSize(13)
    .setFontWeight('bold')
    .setHorizontalAlignment('left');

  sh.getRange('A7:E7')
    .merge()
    .setValue(`การไฟฟ้าส่วนภูมิภาค สาขาพระแสง  ประจำวันที่ ${dayNum}  ${monthName}  ${beYear}`)
    .setFontSize(13)
    .setHorizontalAlignment('left');

  let row = 10;

  function block(shift, title){
    sh.getRange(row,1,1,7).merge().setValue(title).setFontWeight('bold');
    row++;

    sh.getRange(row,1,1,7).setValues([['ที่','รายชื่อพนักงาน','เวลามา','ลงชื่อ','เวลากลับ','ลงชื่อ','หมายเหตุ']])
      .setFontWeight('bold');
    row++;

    const list = (sum[shift]||[]).slice(0,2);
    const rows = [];
    for(let i=0;i<2;i++){
      const it = list[i] || {};
      rows.push([ i+1, it.name||'', it.inTime||'', it.inSign||'', it.outTime||'', it.outSign||'', it.note||'' ]);
    }

    sh.getRange(row,1,2,7).setValues(rows);
    sh.getRange(row-1,1,3,7).setBorder(true,true,true,true,true,true,'#222',SpreadsheetApp.BorderStyle.SOLID);
    row += 4;
  }

  block(1,'กะ1 : 00.30 - 08.30 น.');
  block(2,'กะ2 : 08.30 - 16.30 น.');
  block(3,'กะ3 : 16.30 - 00.30 น.');

  sh.getRange(row,2).setValue('หมายเหตุ : ........................................................................................................\n\n').setFontSize(13);
  

  // ===== กล่องสรุปไฟฟ้าขัดข้อง (ล่างซ้าย A-D) =====
const o = outage || {1:null,2:null,3:null};

const fmtShift = (s)=>{
  const it = o[s];
  if(!it) return `\n กะที่ ${s}: -`;

  const base = `\n กะที่ ${s}: ไฟฟ้าขัดข้องแรงสูง ${it.hv||0} รายการ, แรงต่ำ ${it.lv||0} รายการ`;
  if(!it.items || !it.items.length) return base;

  const detail = it.items.slice(0,6).map(x=>{
    const site = x.site || '-';
    const min  = (Number.isFinite(x.minutes) ? x.minutes : 0);
    return `  รหัสอุปกรณ์/ชื่อบ้าน  ${site} ระยะเวลาไฟดับ ${min} นาที`;
  });

  if(it.items.length > 6) detail.push(`  • ...อีก ${it.items.length-6} รายการ`);

  return [base].concat(detail).join('\n');
};

const outageTitleRow = row + 1;
const outageBodyRow  = row + 2;

// ===== หัวข้อ (ชิดซ้าย) =====
sh.getRange(outageTitleRow,1,1,4).merge()
  .setValue('สรุปเหตุการณ์ไฟฟ้าขัดข้อง (จากหัวหน้าเวรฯ)')
  .setFontWeight('bold')
  .setFontSize(13)
  .setHorizontalAlignment('left')     // ✅ ชิดซ้าย
  .setVerticalAlignment('middle');

// ===== เนื้อหา =====
const outageText = [
  fmtShift(1),
  fmtShift(2),
  fmtShift(3)
].join('\n');

sh.getRange(outageBodyRow,1,7,4).merge()
  .setValue(outageText)
  .setFontSize(12)
  .setWrap(true)
  .setVerticalAlignment('top')
  .setHorizontalAlignment('left');    // ✅ ชิดซ้าย

// ===== เส้นกรอบ =====
sh.getRange(outageTitleRow,1,8,4)
  .setBorder(true,true,true,true,true,true,'#222',SpreadsheetApp.BorderStyle.SOLID);




  sh.getRange(row+3,5,1,3).merge().setFontSize(13).setValue('เรียน ผจก.กฟส.พระแสง\n\nเพื่อโปรดทราบ\n\n\n(............................)').setHorizontalAlignment('center');

  sh.getRange(row+8,5,1,3).merge().setFontSize(13).setValue('ทราบ\n\n\n(............................)\n\nผจก.กฟส.พระแสง').setHorizontalAlignment('center');

  sh.setColumnWidth(1, 40);
  sh.setColumnWidth(2, 240);
  sh.setColumnWidth(3, 80);
  sh.setColumnWidth(4, 80);
  sh.setColumnWidth(5, 80);
  sh.setColumnWidth(6, 80);
  sh.setColumnWidth(7, 260);

  /*sh.getRange(4,1,sh.getLastRow(),1).setHorizontalAlignment('center');
  sh.getRange(4,3,sh.getLastRow(),4).setHorizontalAlignment('center');*/
    sh.setColumnWidth(1, 40);
  sh.setColumnWidth(2, 240);
  sh.setColumnWidth(3, 80);
  sh.setColumnWidth(4, 80);
  sh.setColumnWidth(5, 80);
  sh.setColumnWidth(6, 80);
  sh.setColumnWidth(7, 260);

  // ===== จัดกึ่งกลางภาพรวม (ตามเดิม) =====
  sh.getRange(4,1,sh.getLastRow(),1).setHorizontalAlignment('center');   // คอลัมน์ A
  sh.getRange(4,3,sh.getLastRow(),4).setHorizontalAlignment('center');   // คอลัมน์ C-F

  // ✅ FIX: บังคับ "กล่องสรุปไฟฟ้าขัดข้อง" ให้ชิดซ้าย (กันโดนบรรทัดข้างบนทับ)
  // หัวข้อ (แถว outageTitleRow) อยู่ช่วง A:D
  sh.getRange(outageTitleRow, 1, 1, 4).setHorizontalAlignment('left');

  // เนื้อหา (แถว outageBodyRow ถึง outageBodyRow+6) อยู่ช่วง A:D
  sh.getRange(outageBodyRow, 1, 7, 4).setHorizontalAlignment('left');

}

/* =============================================================================
 * EXPORT PDF – ตารางเวรฯ ทางการ
 * หมายเหตุ: คงเดิมทั้งหมด + เพิ่ม Bold/Italic “หัวหน้าเวร”
 * หัวหน้าเวร = คนแรกของรายชื่อใน กะ1/กะ2/กะ3 ของวันนั้น
 * เงื่อนไขเพิ่ม: คนที่เป็น "ลูกเวรเท่านั้น" ห้ามเป็นหัวหน้าเวร (ไม่ทำ bold/italic)
 *
 * ✅ PATCH (สรุปที่ทำในเวอร์ชันนี้)
 * 1) FIX สำรองไม่ถูกอ่าน: เดิมใช้ RegExp '^สำรอง\\b' ทำให้ไม่ match (\\b ไม่รองรับไทย)
 *    -> เปลี่ยน namesOf() ให้ใช้ startsWith(prefix) เพื่อรองรับ "สำรอง" แน่นอน
 * 2) โหมด with_R:
 *    - R ขึ้นเฉพาะคนที่อยู่บรรทัด "สำรอง" จริงในชีตเท่านั้น
 *    - ถ้า Manual ใส่คนเพิ่มในกะ1 -> ทุกคนในกะ1 ได้ "1"
 *    - ถ้าคนเดียวกันอยู่ทั้งกะ1+สำรอง -> ช่องช่วง1 จะเป็น "R" (ทับ '1')
 * ============================================================================= */
function exportMonthPdfOfficial(token, beYear, monthIdx, meta){
  requireRole_(token,'viewer');

  const data = getMonthData(beYear, monthIdx);
  if(data.missing) throw new Error('ยังไม่ได้สร้างชีตรายเดือน');

  const days = Array.isArray(data.days) ? data.days : [];
  if(!days.length) throw new Error('เดือนนี้ไม่มีข้อมูล');

  // ===== Canonicalize name (กันชื่อไม่ match) =====
  function canonicalName_(s){
    s = String(s||'');
    // ใช้ normalize เดิมก่อน
    try{ s = normalizeName_(s); }catch(e){}
    // ตัดคำนำหน้าชื่อที่พบบ่อย
    s = s.replace(/^(นาย|นางสาว|นาง|น\.ส\.|นส\.|ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง)\s*/, '');
    // ลดช่องว่างซ้ำ
    s = s.replace(/\s+/g,' ').trim();
    return s;
  }
  function isJuniorOnlyRole_(roleText){
    const r = String(roleText||'').replace(/\s+/g,'').trim();
    // ถ้ามีคำว่า "ลูกเวร" ที่ไหน ถือว่าเป็นลูกเวรเท่านั้น
    return r.includes('ลูกเวร');
  }

  // ✅ ต้องใช้ role ด้วย
  const peopleRaw = getPeople_();     // [{name, role}, ...]
  const people = peopleRaw.map(p=>p.name);
  if(!people.length) throw new Error('ยังไม่มีรายชื่อใน "ชีต1"');

  // map: canonicalName -> { roleText, isJuniorOnly }
  const roleMap = {};
  peopleRaw.forEach(p=>{
    const key = canonicalName_(p.name);
    const roleText = String(p.role||'').trim();
    roleMap[key] = { roleText, isJuniorOnly: isJuniorOnlyRole_(roleText) };
  });

  // เลือกหัวหน้าเวร: คนแรกที่ "ไม่ใช่ลูกเวรเท่านั้น"
  function pickLeader_(nameList){
    for(let i=0;i<nameList.length;i++){
      const nm = canonicalName_(nameList[i]);
      if(!nm) continue;
      const info = roleMap[nm];
      // ถ้าหา role ไม่เจอ ให้ "ไม่เลือก" เพื่อกันหลุด (ปลอดภัยกว่า)
      if(!info) continue;
      if(!info.isJuniorOnly) return nm;
    }
    return ''; // ถ้าทั้งกะเป็นลูกเวรล้วน หรือ role หาไม่เจอ -> ไม่มีหัวหน้าเวร
  }

  const rules = getRules_();

  const title = `ตารางเวร_${data.monthName}${beYear}`;
  const ss = SpreadsheetApp.create(title);
  const sh = ss.getActiveSheet().setName('ตารางเวร');

  drawLogoTopLeft_(sh, 110, 90, 110, 6);

  const line1 = 'การไฟฟ้าส่วนภูมิภาค สาขาพระแสง';
  const line2 = (meta && meta.from) ? `จาก  ${meta.from}` : 'จาก  ผปร.กฟส.พระแสง                                         ถึง   กฟส.พระแสง';
  const line5 = (meta && meta.from) ? `จาก  ${meta.from}` : 'เลขที่                                                                    วันที่           ';
const mode = String((meta && meta.mode) || 'approve').toLowerCase();
const isReport = mode === 'report';

const defaultSubject = isReport
  ? `เรื่อง ขอรายงานผลการอยู่เวรแก้ไฟฟ้าขัดข้อง ประจำเดือน ${data.monthName}${beYear}`
  : `เรื่อง ขออนุมัติตารางอยู่เวรแก้ไฟฟ้าขัดข้อง ประจำเดือน ${data.monthName}${beYear}`;

const defaultBody = isReport
  ? 'เพื่อให้การจัดทำค่าตอบแทนงานปฏิบัติงานระบบไฟฟ้าเป็นไปด้วยความเรียบร้อยจึงขอรายงานผลการอยู่เวรแก้ไฟฟ้าขัดข้อง ดังต่อไปนี้'
  : 'เพื่อให้งานปฏิบัติงานระบบไฟฟ้าเป็นไปด้วยความเรียบร้อยจึงขออนุมัติจัดตารางการปฏิบัติงานของชุดพนักงานช่าง ดังต่อไปนี้';

const defaultClosingText = isReport
  ? '                                                               จึงเรียนมาเพื่อโปรดทราบ และแจ้งส่วนที่เกี่ยวข้องดำเนินการต่อไป'
  : '                                                               จึงเรียนมาเพื่อโปรดพิจารณา';

const defaultApproveRemark = isReport
  ? 'เรียน หผ.บง.กฟส.พระแสง\n        - ดำเนินการจัดทำค่าตอบแทนต่อไป'
  : 'เรียน หผ.ปร.กฟส.พระแสง\n        - อนุมัติ';

const line3 = (meta && meta.subject) ? meta.subject : defaultSubject;
const line4 = (meta && meta.to) ? `ถึง   ${meta.to}` : defaultBody;

  const headerStart = 5;
  sh.getRange(headerStart,   1).setValue(line1).setFontWeight('bold').setFontSize(11);
  sh.getRange(headerStart+1, 1).setValue(line2);
  sh.getRange(headerStart+2, 1).setValue(line5);
  sh.getRange(headerStart+3, 1).setValue(line3);
  sh.getRange(headerStart+4, 1).setValue(line4);

  const tableStart = headerStart + 5;
  const totalCols = 2 + 3*people.length;

  const headerRow1 = new Array(totalCols).fill('');
  const headerRow2 = new Array(totalCols).fill('');
  headerRow1[0]='วันที่'; headerRow1[1]='วัน';

  for(let i=0;i<people.length;i++){
    const base = 2 + i*3;
    headerRow1[base] = people[i];
    headerRow2[base]   = 'ช่วง 1';
    headerRow2[base+1] = 'ช่วง 2';
    headerRow2[base+2] = 'ช่วง 3';
  }

  sh.getRange(tableStart,1,2,totalCols).setValues([headerRow1, headerRow2]);
  sh.getRange(tableStart,1,2,1).merge();
  sh.getRange(tableStart,2,2,1).merge();
  sh.getRange(tableStart,1,2,2).setHorizontalAlignment('center').setFontWeight('bold');

  for(let i=0;i<people.length;i++){
    const col = 3 + i*3;
    sh.getRange(tableStart,col,1,3).merge()
      .setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setFontWeight('bold').setWrap(true).setFontSize(8);
  }

  sh.setColumnWidths(1,1,55);
  sh.setColumnWidths(2,1,75);
  for(let i=0;i<people.length;i++){
    const c = 3 + i*3;
    sh.setColumnWidths(c,1,38);
    sh.setColumnWidths(c+1,1,38);
    sh.setColumnWidths(c+2,1,38);
  }
  applyPdfFullWidthLayout_(sh, people.length);

  const bodyStart = tableStart + 2;
  const bodyRows = [];
  const shiftCount = Array(people.length).fill(null).map(()=>[0,0,0]);

  // ✅ เก็บหัวหน้าเวรรายวัน: [หัวหน้ากะ1, หัวหน้ากะ2, หัวหน้ากะ3] (canonical แล้ว)
  const leadersByDay = [];

  days.forEach(d=>{
    const row = new Array(totalCols).fill('');
    row[0]=d.day; row[1]=d.weekday;

    const its = d.items || [];

    // ✅ FIX: ใช้ startsWith() แทน RegExp \\b เพื่อรองรับคำว่า "สำรอง" (ภาษาไทย)
    const namesOf = (prefix)=>{
      const it = its.find(x=>{
        const t = String((x && x.text) || '').trim();
        return t.startsWith(prefix);
      });
      // normalize เดิมก่อน แล้วค่อย canonical ตอนเลือกหัวหน้า/เทียบ
      return it ? extractPeople_(it.text).map(x=>String(x||'')).map(normalizeName_) : [];
    };

    const n1 = namesOf('กะ1');
    const n2 = namesOf('กะ2');
    const n3 = namesOf('กะ3');
    const nr = namesOf('สำรอง');

    // ✅ หัวหน้าเวร = คนแรกที่ไม่ใช่ลูกเวรเท่านั้น (อิง roleMap)
    leadersByDay.push([
      pickLeader_(n1),
      pickLeader_(n2),
      pickLeader_(n3)
    ]);

    people.forEach((person,pi)=>{
      const P = normalizeName_(person);
      const base = 2 + pi*3;
      const colS1 = base, colS2 = base+1, colS3 = base+2;

      // ✅ PATCH: โหมด with_R ให้ถือว่า "R" เฉพาะคนที่อยู่ในบรรทัด "สำรอง" จริงเท่านั้น
      /*let isR = false;
      if(rules.reserveMode === 'with_R'){
        if(nr.includes(P)) isR = true;
      }*/

      //ต่อให้ตั้ง without R แต่ถ้าชีตมี “สำรอง” → PDF ก็ยังแสดง R
      let isR = nr.includes(P); // อ่านจากชีตจริงเสมอ

      // ===== ช่วง 1 (กะ1 / สำรอง) =====
      // ถ้าอยู่กะ1 -> ใส่ '1' (รองรับ Manual กะ1 2 คน)
      if(n1.includes(P)){
        row[colS1] = '1';
        shiftCount[pi][0] += 1;
      }

      // ถ้าเป็นสำรอง -> ต้องใส่ 'R' (ทับ '1' ถ้าซ้ำ)
      if(isR){
        row[colS1] = 'R';
        if(rules.countReserveHours) shiftCount[pi][0] += 1;
      }

      if(n2.includes(P)){
        if(!d.isHoliday && !rules.countS2WeekdayHours){
          row[colS2]='/';
        }else{
          row[colS2]='2';
          shiftCount[pi][1]+=1;
        }
      }

      if(n3.includes(P)){
        row[colS3]='3';
        shiftCount[pi][2]+=1;
      }
    });

    bodyRows.push(row);
  });

  if(bodyRows.length){
    sh.getRange(bodyStart,1,bodyRows.length,totalCols).setValues(bodyRows).setHorizontalAlignment('center');
  }

  const summary = getMonthHoursSummary(beYear, monthIdx);
  const hoursPerPerson = new Array(people.length).fill(0);
  const idxMap = {};
  people.forEach((n,i)=> idxMap[normalizeName_(n)] = i);
  (summary.result||[]).forEach(o=>{
    const i = idxMap[normalizeName_(o.name)];
    if(i!=null) hoursPerPerson[i] = Number(o.hours||0);
  });

  const countRow = bodyStart + (bodyRows.length||0);
  const hoursRow = countRow + 1;
  const ackRow   = hoursRow + 1;

  const countRowVals = new Array(totalCols).fill('');
  countRowVals[0]='รวม(ครั้ง)';
  for(let i=0;i<people.length;i++){
    const base = 2 + i*3;
    countRowVals[base]   = shiftCount[i][0]||'';
    countRowVals[base+1] = shiftCount[i][1]||'';
    countRowVals[base+2] = shiftCount[i][2]||'';
  }
  sh.getRange(countRow,1,1,totalCols).setValues([countRowVals]).setHorizontalAlignment('center');

  sh.getRange(hoursRow,1).setValue('รวมชั่วโมงปฏิบัติงาน').setFontWeight('bold');
  for(let i=0;i<people.length;i++){
    const col = 3 + i*3;
    sh.getRange(hoursRow,col,1,3).merge().setHorizontalAlignment('center').setValue(hoursPerPerson[i]||0);
  }

  sh.getRange(ackRow,1).setValue('ทราบ').setFontWeight('bold');
  for(let i=0;i<people.length;i++){
    const col = 3 + i*3;
    sh.getRange(ackRow,col,1,3).merge().setHorizontalAlignment('center');
  }

  sh.setRowHeights(tableStart,2,22);
  sh.setRowHeights(bodyStart,bodyRows.length||1,18);
  sh.setRowHeights(countRow,3,18);

  const totalTableRows = 2 + (bodyRows.length||0) + 3;
  sh.getRange(tableStart,1,totalTableRows,totalCols).setBorder(true,true,true,true,true,true,'#222',SpreadsheetApp.BorderStyle.SOLID);

  // coloring (อิงค่าจริงในเซลล์) + ✅หัวหน้าเวร bold+italic (กันลูกเวร)
  if(bodyRows.length){
    sh.getRange(bodyStart,1,bodyRows.length,totalCols).setBackground('#ffffff').setFontColor('#000000');
    days.forEach((d,idx)=>{
      if(d.isHoliday) sh.getRange(bodyStart+idx,1,1,totalCols).setBackground('#ffe1e6');
    });

    for(let r=0;r<bodyRows.length;r++){
      const row = bodyRows[r];
      const rr = bodyStart + r;

      for(let c=3;c<=totalCols;c++){
        const v = String(row[c-1]||'').trim();
        if(!v) continue;

        const cell = sh.getRange(rr,c);

        if(v==='R'){
          cell.setBackground('#000000').setFontColor('#fff');

        }else if(v==='1'||v==='2'||v==='3'){
          cell.setBackground('#ffe681').setFontColor('#000');

          const personIndex = Math.floor((c - 3) / 3);
          const slotIndex   = (c - 3) % 3;

          const expected = String(slotIndex + 1);
          if(v === expected){
            const leaderKey = (leadersByDay[r] && leadersByDay[r][slotIndex]) ? leadersByDay[r][slotIndex] : '';
            if(leaderKey){
              const thisKey = canonicalName_(people[personIndex]);

              // กันซ้ำ: ถ้า role ของคนนี้เป็นลูกเวรเท่านั้น ห้ามทำ bold/italic
              const info = roleMap[thisKey];
              if(info && !info.isJuniorOnly && thisKey === leaderKey){
                cell.setFontWeight('bold').setFontStyle('italic');
              }
            }
          }
        }
      }
    }
  }

  // legend + sign (คงเดิม)
  const legendStart = ackRow + 2;
  sh.getRange(legendStart,1,1,totalCols).merge().setValue('หมายเหตุ').setFontWeight('bold').setHorizontalAlignment('left');

  sh.getRange(legendStart+1,1).setBackground('#ffe681');
  sh.getRange(legendStart+1,2,1,totalCols-1).merge().setValue(' : เวรที่ได้รับค่าตอบแทน(หัวหน้าเวร คือ ตัวเลขหนา และเอียง)').setHorizontalAlignment('left');

  sh.getRange(legendStart+2,1).setBackground('#000').setFontColor('#fff').setHorizontalAlignment('center').setValue('R');
  sh.getRange(legendStart+2,2,1,totalCols-1).merge().setValue(' : เวรกะสำรอง').setHorizontalAlignment('left');

  sh.getRange(legendStart+3,1).setValue('/').setHorizontalAlignment('center');
  sh.getRange(legendStart+3,2,1,totalCols-1).merge().setValue(' : เวรในวันทำการที่ไม่ได้รับค่าตอบแทน').setHorizontalAlignment('left');

  sh.getRange(legendStart+4,1).setBackground('#ffe1e6');
  sh.getRange(legendStart+4,2,1,totalCols-1).merge().setValue(' : วันหยุด').setHorizontalAlignment('left');

  const reMark = legendStart + 5;
  sh.getRange(reMark,1,1,totalCols).merge()
    .setValue('หมายเหตุ ช่วง 1 เวลา (00:30-08:30 น.),ช่วง 2 เวลา (08:30-16:30 น.),ช่วง 3 เวลา (16:30-00:30 น.วันรุ่งขึ้น)')
    .setHorizontalAlignment('left').setFontSize(9);

  const signTop = legendStart + 6;
sh.getRange(signTop,1,1,totalCols).merge()
  .setValue(defaultClosingText)
  .setHorizontalAlignment('left').setFontSize(11);

  sh.setRowHeights(signTop,6,26);
  sh.getRange(signTop+2,1,1,totalCols).merge()
    .setValue('ลงชื่อ....................................................     หผ.ปร.กฟส.พระแสง (ผู้ขออนุมัติ)     วันที่ ........../........../..........')
    .setHorizontalAlignment('right').setFontSize(11);
  sh.getRange(signTop+3,1,1,totalCols).merge()
    .setValue('(.................................................................)                                                                                   ')
    .setHorizontalAlignment('right').setFontSize(11);

  const signTop1 = legendStart + 10;
sh.getRange(signTop1,1,1,totalCols).merge()
  .setValue(defaultApproveRemark)
  .setHorizontalAlignment('left').setFontSize(11);

  sh.getRange(signTop1+2,1,1,totalCols).merge()
    .setValue('ลงชื่อ....................................................     ผจก.กฟส.พระแสง (ผู้อนุมัติ)          วันที่ ........../........../..........')
    .setHorizontalAlignment('left').setFontSize(11);
  sh.getRange(signTop1+3,1,1,totalCols).merge()
    .setValue('(.................................................................)                                                                                   ')
    .setHorizontalAlignment('left').setFontSize(11);

  // export timestamp bottom-right (คงเดิม)
  const tz = Session.getScriptTimeZone();
  const now = new Date();
  const be = now.getFullYear() + 543;
  const exportedAt = Utilities.formatDate(now, tz, 'dd/MM/') + be + Utilities.formatDate(now, tz, ' HH:mm') + ' น.';
  const exportText = `เอกสารนี้สร้างจากระบบอัตโนมัติ พิมพ์วันที่ ${exportedAt}`;

  const exportRow = Math.max(sh.getLastRow()+1, signTop+6);
  const exportMergeCols = Math.min(8, totalCols);
  const exportStartCol = totalCols - exportMergeCols + 1;

  sh.getRange(exportRow, exportStartCol, 1, exportMergeCols).merge()
    .setValue(exportText).setHorizontalAlignment('right').setFontSize(9).setFontColor('#555');
  sh.setRowHeight(exportRow, 18);

  SpreadsheetApp.flush();
  Utilities.sleep(250);

  const gid = sh.getSheetId();
  const url = `https://docs.google.com/spreadsheets/d/${ss.getId()}/export`
            + `?format=pdf&size=A4&portrait=false&fitw=true`
            + `&sheetnames=false&printtitle=false&pagenumbers=false`
            + `&gridlines=false&fzr=false&gid=${gid}`;

  const oauth = ScriptApp.getOAuthToken();
  const res = UrlFetchApp.fetch(url, { headers:{Authorization:'Bearer '+oauth}, muteHttpExceptions:true });

  const code = res.getResponseCode();
  const ct = String(res.getHeaders()['Content-Type']||'').toLowerCase();
  if(code!==200 || !ct.includes('pdf')){
    Logger.log('Export failed HTTP='+code+', CT='+ct);
    Logger.log(res.getContentText().slice(0,500));
    throw new Error('Export PDF ล้มเหลว');
  }

  const blob = res.getBlob().setName(`${title}.pdf`);
  const file = DriveApp.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  try{ DriveApp.getFileById(ss.getId()).setTrashed(true); }catch(e){}
  return { url:file.getUrl(), name:file.getName(), fileId:file.getId() };
}



function applyPdfFullWidthLayout_(sh, peopleLen){
  // ค่าฐานเดิมของคุณ
  const baseDate = 55;
  const baseDay  = 75;
  const baseShift = 38; // ต่อ 1 ช่องช่วง (ช่วง1/2/3)

  // ความกว้างรวม “ปัจจุบัน”
  const currentTotal =
    baseDate + baseDay + (peopleLen * 3 * baseShift);

  // เป้าหมายความกว้างรวม (A4 landscape) — ค่าโดยประมาณในหน่วย px ของ Google Sheets
  // ปรับได้ตามใจ: 1050~1250 มักจะดู “เต็มหน้า” ดี
  const targetTotal = 1120;

  // ถ้าตารางแคบ → ขยาย, ถ้ากว้างอยู่แล้ว → ไม่ต้องทำอะไร
  if(currentTotal >= targetTotal) return;

  // สเกลขยาย (กันใหญ่เกิน)
  const scale = Math.min(3.0, targetTotal / currentTotal);

  // ตั้งคอลัมน์ตามสเกล (กันเกิน/กันต่ำเกิน)
  const wDate = Math.min(140, Math.max(55, Math.round(baseDate * scale)));
  const wDay  = Math.min(180, Math.max(75, Math.round(baseDay  * scale)));
  const wShift= Math.min(120, Math.max(38, Math.round(baseShift* scale)));

  sh.setColumnWidth(1, wDate);
  sh.setColumnWidth(2, wDay);

  for(let i=0;i<peopleLen;i++){
    const c = 3 + i*3;
    sh.setColumnWidth(c,   wShift);
    sh.setColumnWidth(c+1, wShift);
    sh.setColumnWidth(c+2, wShift);
  }
}

/* =============================================================================
 * EXPORT PDF: ใบลงชื่อรายวัน (3 กะ)
 * ============================================================================= */
function exportDailySignPdf(token, beYear, monthIdx, day){
  requireRole_(token,'viewer');

  beYear = Number(beYear||BE_YEAR);
  monthIdx = Number(monthIdx||0);
  day = Number(day||0);
  if(!monthIdx || monthIdx<1 || monthIdx>12) throw new Error('เดือนไม่ถูกต้อง');
  if(!day || day<1 || day>31) throw new Error('วันที่ไม่ถูกต้อง');

  const sum = buildDailyAttendanceSummary_(beYear, monthIdx, day);
  const outage = buildDailyOutageSummary_(beYear, monthIdx, day);

  const title = `ใบลงชื่อรายวัน_${day}_${TH_MONTHS[monthIdx-1]}${beYear}`;
  const ssTmp = SpreadsheetApp.create(title);
  const sh = ssTmp.getActiveSheet().setName('ใบลงชื่อ');

  renderDailySignSheet_(sh, beYear, monthIdx, day, sum, outage);

  SpreadsheetApp.flush();
  Utilities.sleep(250);

  const gid = sh.getSheetId();
  const url = `https://docs.google.com/spreadsheets/d/${ssTmp.getId()}/export`
            + `?format=pdf&size=A4&portrait=true&fitw=true`
            + `&sheetnames=false&printtitle=false&pagenumbers=false`
            + `&gridlines=false&fzr=false&gid=${gid}`;

  const oauth = ScriptApp.getOAuthToken();
  const res = UrlFetchApp.fetch(url, { headers:{Authorization:'Bearer '+oauth}, muteHttpExceptions:true });

  const code = res.getResponseCode();
  const ct = String(res.getHeaders()['Content-Type']||'').toLowerCase();
  if(code!==200 || !ct.includes('pdf')){
    Logger.log('DailySign Export failed HTTP='+code+', CT='+ct);
    Logger.log(res.getContentText().slice(0,500));
    throw new Error('Export PDF ใบลงชื่อรายวัน ล้มเหลว');
  }

  const blob = res.getBlob().setName(`${title}.pdf`);
  const file = DriveApp.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  try{ DriveApp.getFileById(ssTmp.getId()).setTrashed(true); }catch(e){}
  return { url:file.getUrl(), name:file.getName(), fileId:file.getId() };
}
/* =============================================================================
 * EXPORT PDF: ใบขอสับเปลี่ยนเวร (เพิ่มเหตุผล)
 * ============================================================================= */
function exportSwapRequestPdf(token, beYear, monthIdx, day, shift, requester, coverer, reason, meta){
  requireRole_(token,'viewer');

  shift = String(shift||'').trim();
  requester = normalizeName_(requester);
  coverer   = normalizeName_(coverer);
  const sNum = Number(shift);

  if(!day || ![1,2,3].includes(sNum)) throw new Error('ข้อมูลวันหรือกะไม่ถูกต้อง');
  if(!requester || !coverer) throw new Error('กรุณาระบุผู้ขออนุมัติและผู้แทน');
  if(requester===coverer) throw new Error('ผู้ขออนุมัติและผู้แทนต้องเป็นคนละคน');

  const allNames = getPeople_().map(p=>normalizeName_(p.name));
  if(!allNames.includes(requester)) throw new Error(`ไม่พบผู้ขออนุมัติ "${requester}" ใน "ชีต1"`);
  if(!allNames.includes(coverer))   throw new Error(`ไม่พบผู้แทน "${coverer}" ใน "ชีต1"`);

  const md = getMonthData(beYear, monthIdx);
  const dd = (md.days||[]).find(x=>Number(x.day)===Number(day));
  if(!dd) throw new Error(`ไม่พบวันที่ ${day}/${md.monthName}${beYear}`);

  const monthName = TH_MONTHS[monthIdx-1];
  const timeStr = (sNum===1) ? '00:30 - 08:30' : (sNum===2 ? '08:30 - 16:30' : '16:30 - 00:30');
  const reasonText = String(reason||'').trim();

  const title = `ใบขอสับเปลี่ยนเวร_${requester}_${day}${monthName}${beYear}`;
  const ss = SpreadsheetApp.create(title);
  const sh = ss.getActiveSheet().setName('ใบขอสับเปลี่ยนเวร');

  drawLogoTopLeft_(sh, 110, 90, 90, 3);

  sh.setColumnWidths(1,1,40);
  sh.setColumnWidths(2,1,260);
  sh.setColumnWidths(3,1,40);
  sh.setColumnWidths(4,1,60);
  sh.setColumnWidths(5,1,260);
  sh.setHiddenGridlines(true);

  const docTitle = (meta && meta.subject) || 'ขออนุมัติลาเวร และจัดเวรแทน ชุดปฏิบัติการระบบไฟฟ้า รูปแบบ Standby';
  const toLine   = (meta && meta.to) || 'ผจก.กฟส.พระแสง';

  // ====== ✅ วันที่ปัจจุบัน (ชื่อเดือนเต็ม + พ.ศ.) ======
  const tz = Session.getScriptTimeZone();
  const now = new Date();

  const TH_MONTHS_FULL = [
    'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
    'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'
  ];
  const dNow = Number(Utilities.formatDate(now, tz, 'd'));
  const mNow = Number(Utilities.formatDate(now, tz, 'M')); // 1-12
  const yBENow = Number(Utilities.formatDate(now, tz, 'yyyy')) + 543;

  const todayText = `วันที่       ${dNow} ${TH_MONTHS_FULL[mNow-1]} ${yBENow}`;
  // =======================================================

  sh.getRange('A3').setValue('จาก').setFontSize(12);
  sh.getRange('B3').setValue(`${requester} (ผู้ขออนุมัติ)`).setFontSize(12);
  sh.getRange('D3').setValue('ถึง').setFontSize(12);
  sh.getRange('E3').setValue(toLine).setFontSize(12);
  sh.getRange('A4').setValue('เลขที่').setFontSize(12);

  // ✅ แก้ตรงนี้: จาก 'วันที่' -> วันที่ปัจจุบัน
  sh.getRange('D4').setValue(todayText).setFontSize(12);

  sh.getRange('A5').setValue('เรื่อง').setFontSize(12);
  sh.getRange('B5').setValue(docTitle).setFontSize(12);
  sh.getRange('A6').setValue('เรียน').setFontSize(12);
  sh.getRange('B6').setValue('ผจก.กฟส.พระแสง ผ่าน หผ.ปร.').setFontSize(12);

  const body1 = `            ตามอนุมัติ ตารางอยู่เวรแก้ไฟฟ้าขัดข้อง กฟส.พระแสง รูปแบบ Standby ประจำเดือน ${monthName}${beYear} \n ข้าพเจ้า  ${requester} ไม่สามารถอยู่เวรฯ วันที่  ${day} ${monthName}${beYear} เวลา  ${timeStr} ได้`;
  const bodyReason = reasonText
    ? `เนื่องจาก ${reasonText}`
    : '            เนื่องจาก................................................................................................................................';

  sh.getRange('A8').setValue(body1).setFontSize(12);
  sh.getRange('A9').setValue(bodyReason).setFontSize(12);

  const body2 = `            ดังนั้น เพื่อให้งานอยู่เวรแก้ไฟฟ้าขัดข้อง กฟส.พระแสง รูปแบบ Standby เป็นไปด้วยความเรียบร้อย \n จึงขออนุมัติให้  ${coverer} อยู่เวรแทนในวันและเวลาดังกล่าว โดยมีสิทธิ์ เบิกค่าตอบแทนการอยู่เวร \n รูปแบบ Standby ตามระเบียบของ กฟภ. `;
  sh.getRange('A10').setValue(body2).setFontSize(12);
  sh.getRange('A11').setValue('            จึงเรียนมาเพื่อโปรดพิจารณา').setFontSize(12);

  sh.getRange('A15').setValue('ลงชื่อ ..........................................................  ผู้ขออนุมัติ   ลงชื่อ ..........................................................  ผู้แทน').setFontSize(12);
  sh.getRange('A16').setValue(`                   (${requester} )                                                          ( ${coverer} )`).setFontSize(12);

  sh.getRange('A19').setValue('ลงชื่อ ..........................................................  ผู้ตรวจทาน (หัวหน้าแผนก)').setFontSize(12);
  sh.getRange('A21').setValue('วันที่ ........../........../..........').setFontSize(12);
  sh.getRange('A23').setValue('ลงชื่อ ..........................................................  ผู้อนุมัติ (ผู้จัดการ) ').setFontSize(12);
  sh.getRange('A25').setValue('วันที่ ........../........../..........').setFontSize(12);

  SpreadsheetApp.flush();
  Utilities.sleep(200);

  const gid = sh.getSheetId();
  const url = `https://docs.google.com/spreadsheets/d/${ss.getId()}/export`
            + `?format=pdf&size=A4&portrait=true&fitw=true`
            + `&sheetnames=false&printtitle=false&pagenumbers=false`
            + `&gridlines=false&fzr=false&gid=${gid}`;

  const oauth = ScriptApp.getOAuthToken();
  const res = UrlFetchApp.fetch(url, { headers:{Authorization:'Bearer '+oauth}, muteHttpExceptions:true });

  const code = res.getResponseCode();
  const ct = String(res.getHeaders()['Content-Type']||'').toLowerCase();
  if(code!==200 || !ct.includes('pdf')) throw new Error('Export PDF ใบขอสับเปลี่ยนเวร ล้มเหลว');

  const blob = res.getBlob().setName(`${title}.pdf`);
  const file = DriveApp.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  try{ DriveApp.getFileById(ss.getId()).setTrashed(true); }catch(e){}
  return { url:file.getUrl(), name:file.getName(), fileId:file.getId() };
}

/* =============================================================================
 * EXPORT PDF: สรุปสับเปลี่ยนเวรทั้งเดือน (Editor)
 * ============================================================================= */
function exportSwapSummaryPdf(token, beYear, monthIdx, meta){
  requireRole_(token,'editor');

  beYear = Number(beYear||BE_YEAR);
  monthIdx = Number(monthIdx||0);
  if(!monthIdx || monthIdx<1 || monthIdx>12) throw new Error('เดือนไม่ถูกต้อง');

  const monthName = TH_MONTHS[monthIdx-1];
  const shReq = getRequestsSheet_();
  const last = shReq.getLastRow();
  const rows = (last<=1) ? [] : shReq.getRange(2,1,last-1,14).getValues();

  const list = rows.map(r=>({
    id:String(r[0]||''),
    be:Number(r[1]||0),
    month:Number(r[2]||0),
    day:Number(r[3]||0),
    shift:String(r[4]||''),
    requester:String(r[5]||''),
    coverer:String(r[6]||''),
    reason:String(r[7]||''),
    status:String(r[8]||''),
    createdAt:String(r[9]||''),
    actedBy:String(r[10]||''),
    actedAt:String(r[11]||''),
    covererDecision:String(r[12]||''),
    covererAt:String(r[13]||'')
  })).filter(x=>x.be===beYear && x.month===monthIdx);

  const statusLabel = (s)=>{
    const v = String(s||'').toLowerCase();
    if(v==='approved') return 'อนุมัติ';
    if(v==='rejected') return 'ไม่อนุมัติ';
    if(v==='cancelled') return 'ยกเลิก';
    if(v==='pending') return 'รออนุมัติ';
    if(v==='await_inspector') return 'รอตรวจสอบ';
    if(v==='await_coverer') return 'รอผู้แทนตอบรับ';
    if(v==='coverer_rejected') return 'ผู้แทนปฏิเสธ';
    return s || '';
  };

  const covererDecisionLabel = (d)=>{
    const v = String(d||'').toLowerCase();
    if(v==='accept') return 'ยอมรับ';
    if(v==='reject') return 'ปฏิเสธ';
    return d || '';
  };

  const counts = { await_coverer:0, pending:0, await_inspector:0, approved:0, rejected:0, cancelled:0, coverer_rejected:0, other:0 };
  list.forEach(x=>{
    const v = String(x.status||'').toLowerCase();
    if(v in counts) counts[v]++; else counts.other++;
  });

  const title = `สรุปสับเปลี่ยนเวร_${monthName}${beYear}`;
  const ss = SpreadsheetApp.create(title);
  const sh = ss.getActiveSheet().setName('สรุปสับเปลี่ยนเวร');
  sh.setHiddenGridlines(true);

  drawLogoTopLeft_(sh, 110, 90, 110, 5);

  const headStart = 5;
  const line1 = 'การไฟฟ้าส่วนภูมิภาค สาขาพระแสง';
  const line2 = (meta && meta.subject) ? meta.subject : `สรุปข้อมูลการสับเปลี่ยนเวร ประจำเดือน ${monthName}${beYear}`;
  const line3 = (meta && meta.note) ? meta.note : '';

  sh.getRange(headStart,1).setValue(line1).setFontWeight('bold').setFontSize(12);
  sh.getRange(headStart+1,1).setValue(line2).setFontSize(12);
  if(line3) sh.getRange(headStart+2,1).setValue(line3).setFontSize(12);

  // ===== TABLE =====
  const tableStart = headStart + 5; // เริ่มตารางหลังหัวกระดาษ
  const headers = [
    'ลำดับ','วันที่','กะ','ผู้ขอ','ผู้แทน','เหตุผล',
    'สถานะ','ผู้แทนตอบรับ','เวลาผู้แทนตอบรับ',
    'วันเวลาส่งคำขอ','ผู้ดำเนินการล่าสุด','วันเวลาดำเนินการล่าสุด','ID'
  ];
  sh.getRange(tableStart,1,1,headers.length).setValues([headers])
    .setFontWeight('bold').setHorizontalAlignment('center').setBackground('#f3f3f3');

  const body = list.slice().sort((a,b)=>(a.day-b.day)||(Number(a.shift)-Number(b.shift)))
    .map((x,i)=>([
      i+1,
      `${x.day} ${monthName}${beYear}`,
      `กะ${x.shift}`,
      x.requester,
      x.coverer,
      x.reason,
      statusLabel(x.status),
      covererDecisionLabel(x.covererDecision),
      x.covererAt,
      x.createdAt,
      x.actedBy,
      x.actedAt,
      x.id
    ]));

  if(body.length){
    sh.getRange(tableStart+1,1,body.length,headers.length).setValues(body)
      .setFontSize(10).setVerticalAlignment('top').setWrap(true);
  }else{
    sh.getRange(tableStart+1,1).setValue('ไม่มีรายการสับเปลี่ยนเวรในเดือนนี้').setFontSize(11);
  }

  const w = [50,110,60,150,150,240,110,110,140,140,120,140,180];
  w.forEach((px,idx)=> sh.setColumnWidth(idx+1, px));

  const totalRows = 1 + Math.max(body.length,1);
  sh.getRange(tableStart,1,totalRows,headers.length)
    .setBorder(true,true,true,true,true,true,'#222',SpreadsheetApp.BorderStyle.SOLID);

  sh.setFrozenRows(tableStart);

  // ===== SUMMARY (ย้ายไปล่างสุด) =====
  const summaryLines = [
    `รอผู้แทนตอบรับ: ${counts.await_coverer}`,
    `รออนุมัติ: ${counts.pending}`,
    `รอตรวจสอบ: ${counts.await_inspector}`,
    `อนุมัติ: ${counts.approved}`,
    `ไม่อนุมัติ: ${counts.rejected}`,
    `ผู้แทนปฏิเสธ: ${counts.coverer_rejected}`,
    `ยกเลิก: ${counts.cancelled}`,
    `อื่น ๆ: ${counts.other}`,
    `รวมทั้งหมด: ${list.length}`
  ];

  // วางสรุปใต้ตาราง (เว้น 2 แถว)
  const sumRow = tableStart + totalRows + 2;

  sh.getRange(sumRow,1).setValue('สรุปสถานะ').setFontWeight('bold');

  // ✅ ใส่ข้อความจริงที่คอลัมน์ B แล้วจัด format ให้ถูกคอลัมน์
  sh.getRange(sumRow+1, 2, summaryLines.length, 1)
    .setValues(summaryLines.map(x=>[x]))
    .setFontSize(10)
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('left')
    .setWrap(true);

  SpreadsheetApp.flush();
  Utilities.sleep(250);

  const gid = sh.getSheetId();
  const url = `https://docs.google.com/spreadsheets/d/${ss.getId()}/export`
            + `?format=pdf&size=A4&portrait=false&fitw=true`
            + `&sheetnames=false&printtitle=false&pagenumbers=true`
            + `&gridlines=false&fzr=false&gid=${gid}`;

  const oauth = ScriptApp.getOAuthToken();
  const res = UrlFetchApp.fetch(url, { headers:{Authorization:'Bearer '+oauth}, muteHttpExceptions:true });

  const code = res.getResponseCode();
  const ct = String(res.getHeaders()['Content-Type']||'').toLowerCase();
  if(code!==200 || !ct.includes('pdf')){
    Logger.log('SwapSummary Export failed HTTP='+code+', CT='+ct);
    Logger.log(res.getContentText().slice(0,500));
    throw new Error('Export PDF (สรุปสับเปลี่ยนเวร) ล้มเหลว');
  }

  const blob = res.getBlob().setName(`${title}.pdf`);
  const file = DriveApp.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  try{ DriveApp.getFileById(ss.getId()).setTrashed(true); }catch(e){}
  return { url:file.getUrl(), name:file.getName(), fileId:file.getId() };
}


/* =============================================================================
 * DEV (ทดสอบ)
 * ============================================================================= */
function dev_makeEditorToken(minutes){
  const ttl = Math.max(1, Number(minutes||30))*60;
  const t = Utilities.getUuid();
  const sess = { username:'DEV', role:'editor', personName:'' };
  CacheService.getScriptCache().put(AUTH_PREFIX+t, JSON.stringify(sess), ttl);
  Logger.log(`DEV editor token: ${t} (ttl ${ttl}s)`);
  return t;
}
function dev_exportPDF(monthIdx){
  const token = dev_makeEditorToken(30);
  const m = Number(monthIdx||1);
  const res = exportMonthPdfOfficial(token, BE_YEAR, m, null);
  Logger.log(JSON.stringify(res,null,2));
  return res;
}
function dev_exportSwapSummary(monthIdx){
  const token = dev_makeEditorToken(30);
  const m = Number(monthIdx||1);
  const res = exportSwapSummaryPdf(token, BE_YEAR, m, null);
  Logger.log(JSON.stringify(res,null,2));
  return res;
}

// ===== HandOver wrappers (ให้ HTML เรียก) =====

function hoGetVehicleSheets(token){
  return getVehicleSheets(token); // หรือชื่อฟังก์ชันจริงที่คุณทำไว้
}

function hoGetEmployeeNames(token){
  return getEmployeeNames(token);
}

// ✅ ต้องรับ vehicleSheet
function hoGetEquipmentList(token, vehicleSheet){
  return getEquipmentList(token, vehicleSheet);
}

// ✅ ต้องรับ vehicleSheet + updates
function hoSaveActualQtys(token, vehicleSheet, updates){
  return saveActualQtys(token, vehicleSheet, updates);
}

// ✅ ต้องรับ vehicleSheet ด้วย
function hoListHandoversByDay(token, be, m, d, vehicleSheet){
  return listHandoversByDay(token, be, m, d, vehicleSheet);
}

// ✅ export รายวัน “แยกตามรถ”
function hoExportDailyHandoverPdfByVehicle(token, be, m, d, vehicleSheet){
  return exportDailyHandoverPdfByVehicle(token, be, m, d, vehicleSheet);
}

// ✅ payload ต้องมี vehicleSheet อยู่แล้ว
function hoSubmitHandover(token, payload){
  return submitHandover(token, payload);
}

// (ถ้าคุณมีพิมพ์ PDF รายการเดียวตาม id)
function hoExportHandoverPdf(token, id){
  return exportHandoverPdf(token, id);
}
/** ✅ ใช้ให้หน้าเว็บเช็คว่า token ยังใช้ได้ไหม (เรียกได้ด้วย google.script.run) */
function validateToken(token){
  try{
    // ถ้าคุณมี helper เดิม requireAuth_(token) อยู่แล้ว ให้ใช้มัน
    // ถ้า token ไม่ถูกต้อง มันควร throw error
    const sess = requireAuth_(token);

    // ปรับให้เข้ากับโครงสร้างจริงของคุณ:
    // - บางระบบ requireAuth_ อาจคืน role/user/personName หรือบางส่วน
    const role = (sess && sess.role) ? String(sess.role) : (getLoginRole_(token) || 'viewer');
    const user = (sess && sess.user) ? String(sess.user) : (getLoginUsername_(token) || '');
    const personName = (sess && sess.personName) ? String(sess.personName) : (getLoginPersonName_(token) || '');

    return { ok:true, role: role, user: user, personName: personName };
  }catch(err){
    return { ok:false, message: (err && err.message) ? err.message : String(err) };
  }
}

//กดรันฟังก์ชั่นนี้ เดี่ยวๆ ด้วย
function setupShiftNotifyTrigger(){
  // ลบของเดิมก่อนกันซ้ำ
  removeShiftNotifyTrigger();

  ScriptApp.newTrigger('shiftNotifyRunner_')
    .timeBased()
    .everyMinutes(SHIFT_NOTIFY_POLL_MIN)
    .create();
}
//กดรันฟังก์ชั่นนี้ เดี่ยวๆ ด้วย หากต้องการลบ
function removeShiftNotifyTrigger(){
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if(t.getHandlerFunction() === 'shiftNotifyRunner_'){
      ScriptApp.deleteTrigger(t);
    }
  });
}

function shiftNotifyRunner_(){
  // ถ้าไม่ได้ใช้ระบบนี้บางช่วง สามารถ return ได้ตามเงื่อนไขที่ต้องการ
  notifyShiftsBefore_(SHIFT_NOTIFY_MIN_BEFORE);
}

function notifyShiftsBefore_(minutesBefore){
  const tz = Session.getScriptTimeZone();
  const now = new Date();
  const props = PropertiesService.getScriptProperties();

  // เราจะตรวจ “วันนี้” และ “พรุ่งนี้” (เพราะกะ 1 แจ้ง 22:30 ของวันก่อน)
  const datesToCheck = [0, 1].map(addDays => {
    const d = new Date(now.getTime());
    d.setDate(d.getDate() + addDays);
    return d;
  });

  datesToCheck.forEach(dateObj => {
    const y = Number(Utilities.formatDate(dateObj, tz, 'yyyy'));
    const m = Number(Utilities.formatDate(dateObj, tz, 'M'));
    const d = Number(Utilities.formatDate(dateObj, tz, 'd'));

    const beYear = y + 543;

    // สนใจเฉพาะปีระบบของคุณ (2569) — ถ้าต้องการให้ข้ามปีได้ ค่อยขยายทีหลัง
    if(beYear !== Number(BE_YEAR)) return;

    // 3 กะ
    [1,2,3].forEach(shiftNum => {
      const win = getShiftWindow_(beYear, m, d, shiftNum);
      const start = win.start;
      const notifyAt = new Date(start.getTime() - minutesBefore*60000);

      // เงื่อนไข “เข้า window” ของรอบ trigger (กันพลาด)
      const windowMs = SHIFT_NOTIFY_POLL_MIN * 60000;
      const inWindow = now.getTime() >= notifyAt.getTime() && now.getTime() < (notifyAt.getTime() + windowMs);
      if(!inWindow) return;

      // กันส่งซ้ำ: key ต่อ วัน/กะ
      const key = `${SHIFT_NOTIFY_KEY_PREFIX}${beYear}_${m}_${d}_S${shiftNum}`;
      if(props.getProperty(key)) return; // ส่งแล้ว

      // ดึงรายชื่อเวรจากตารางเดือน
      const info = getShiftAssignmentForNotify_(beYear, m, d, shiftNum);
      if(!info.ok) return; // ถ้าไม่พบข้อมูล ก็ไม่ส่ง

      // ส่ง Webex
      sendNotify_(buildShiftNotifyMessage_(beYear, m, d, shiftNum, info.names, start));

      // mark ส่งแล้ว
      props.setProperty(key, Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm:ss'));
    });
  });
}

function getShiftAssignmentForNotify_(beYear, monthIdx, day, shiftNum){
  const md = getMonthData(beYear, monthIdx);
  if(md.missing) return { ok:false, reason:'missing month sheet' };

  const dObj = (md.days||[]).find(x => Number(x.day) === Number(day));
  if(!dObj) return { ok:false, reason:'day not found' };

  const it = (dObj.items||[]).find(row => new RegExp('^กะ'+shiftNum+'\\b').test(String(row.text||'')));
  if(!it) return { ok:false, reason:'shift not found' };

  const names = extractPeople_(it.text).map(normalizeName_).filter(Boolean);
  if(!names.length) return { ok:false, reason:'no names' };

  return { ok:true, names };
}

function buildShiftNotifyMessage_(beYear, monthIdx, day, shiftNum, names, shiftStartDate){
  const tz = Session.getScriptTimeZone();
  const timeStart = Utilities.formatDate(shiftStartDate, tz, 'HH:mm');

  // เวลากะ (ตามของคุณ)
  const shiftLabel = (shiftNum===1) ? '00:30-08:30' : (shiftNum===2 ? '08:30-16:30' : '16:30-00:30');

  const who = names.map(n => `- ${n}`).join('\n');

  return [
    `**⏰ แจ้งเตือนเวรล่วงหน้า 2 ชั่วโมง**`,
    `- **วัน/กะ:** พ.ศ.${beYear} เดือน ${monthIdx} วันที่ ${day}  (กะ ${shiftNum})`,
    `- **เวลาเริ่มกะ:** ${timeStart} น.  (${shiftLabel})`,
    `- **ผู้อยู่เวร:**`,
    `${who}`,
    `- เวลาแจ้งเตือน: ${nowText_()}`
  ].join('\n');
}

function listPeopleNames(token){
  requireRole_(token,'viewer');
  return getPeople_().map(p=>p.name).filter(Boolean);
}

function listPeopleNames(token){
  requireRole_(token,'viewer');
  return getPeople_().map(p=>p.name).filter(Boolean);
}

function testSendLine(){
  const token = PropertiesService.getScriptProperties()
    .getProperty('LINE_CHANNEL_ACCESS_TOKEN');

  const url = 'https://api.line.me/v2/bot/message/broadcast';

  const payload = {
    messages: [{
      type: 'text',
      text: 'ทดสอบส่งจากระบบ Standby สำเร็จแล้ว ✅'
    }]
  };

  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload),
  });
}
function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) ? String(e.postData.contents) : '';
    if (raw) {
      const body = JSON.parse(raw);
      if (body && body.action) {
        return standbyApiHandleRequest_(e, 'POST');
      }
    }
  } catch (err) {
    return apiFail_(err);
  }

  return handleLineWebhookPost_(e);
}

function handleLineWebhookPost_(e) {
  const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '';
  console.log(raw);

  const body = raw ? JSON.parse(raw) : {};
  const events = body.events || [];
  const props = PropertiesService.getScriptProperties();

  events.forEach(ev => {
    const src = ev.source || {};
    if (src.groupId) {
      props.setProperty('LINE_TARGET_GROUP', src.groupId);
    }
    if (src.userId) {
      props.setProperty('LINE_LAST_USER', src.userId);
    }
  });

  props.setProperty('LAST_HIT', new Date().toISOString());

  return ContentService.createTextOutput("OK");
}
function testSendToGroup(){
  const props = PropertiesService.getScriptProperties();
  const groupId = props.getProperty('LINE_TARGET_GROUP');
  const token = props.getProperty('LINE_CHANNEL_ACCESS_TOKEN');

  const url = 'https://api.line.me/v2/bot/message/push';

  const payload = {
    to: groupId,
    messages: [{
      type: 'text',
      text: '📢 ทดสอบส่งเข้ากลุ่มสำเร็จ\nระบบพร้อมใช้งานแล้ว'
    }]
  };

  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload),
  });
}

/* =============================================================================
 * LINE NOTIFY (Push to Group)
 * - ใช้ Script Properties:
 *   LINE_CHANNEL_ACCESS_TOKEN
 *   LINE_TARGET_GROUP
 * ============================================================================= */
const LINE_TOKEN_KEY = 'LINE_CHANNEL_ACCESS_TOKEN';
const LINE_GROUP_KEY = 'LINE_TARGET_GROUP';

// เปิด/ปิดการส่ง LINE ได้ โดยไม่กระทบ Webex
const LINE_NOTIFY_ENABLED_KEY = 'LINE_NOTIFY_ENABLED'; // 'true'/'false'


function isLineEnabled_(){
  const v = PropertiesService.getScriptProperties().getProperty(LINE_NOTIFY_ENABLED_KEY);
  // default = true (ถ้ายังไม่ตั้ง)
  return (v == null) ? true : String(v).toLowerCase() === 'true';
}

function sendLineText_(text){
  try{
    if(!isLineEnabled_()) return;

    const props = PropertiesService.getScriptProperties();
    const token = String(props.getProperty(LINE_TOKEN_KEY) || '').trim();
    const groupId = String(props.getProperty(LINE_GROUP_KEY) || '').trim();
    if(!token || !groupId) return; // ไม่มีค่า ก็เงียบไว้ ไม่ให้กระทบโค้ดเดิม

    const url = 'https://api.line.me/v2/bot/message/push';
    const payload = {
      to: groupId,
      messages: [{ type:'text', text: String(text||'') }]
    };

    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const code = res.getResponseCode();
    if(code < 200 || code >= 300){
      Logger.log('LINE send failed: ' + code + ' ' + res.getContentText());
    }
  }catch(err){
    Logger.log('LINE send error: ' + (err && err.message ? err.message : err));
  }
}


function webexMdToLineText_(md){
  let s = String(md || '');

  // ตัด markdown พื้นฐานให้เป็น text
  s = s.replace(/\*\*(.*?)\*\*/g, '$1');    // **bold**
  s = s.replace(/`([^`]+)`/g, '$1');        // `code`
  s = s.replace(/\[(.*?)\]\((.*?)\)/g, '$1'); // [text](url) -> text
  s = s.replace(/^\s*-\s+/gm, '• ');        // list
  s = s.replace(/\n{3,}/g, '\n\n');         // ลดบรรทัดว่าง

  // กันยาวเกิน (LINE จำกัด ~ 5000 ตัวอักษรต่อข้อความโดยประมาณ)
  if(s.length > 4500){
    s = s.slice(0, 4500) + '\n…(ตัดข้อความ)';
  }
  return s.trim();
}

function sendNotify_(webexMarkdown){
  // 1) ส่ง Webex เดิม (คงพฤติกรรมเดิมทุกอย่าง)
  sendWebexMarkdown_(webexMarkdown);

  // 2) ส่ง LINE เพิ่ม (แปลง markdown -> text)
  const lineText = webexMdToLineText_(webexMarkdown);
  sendLineText_(lineText);
}
function lineEnable(){
  PropertiesService.getScriptProperties().setProperty(LINE_NOTIFY_ENABLED_KEY, 'true');
}
function lineDisable(){
  PropertiesService.getScriptProperties().setProperty(LINE_NOTIFY_ENABLED_KEY, 'false');
}

/** ลบ Script Properties ที่ขึ้นต้นด้วย prefix */
function clearPropsByPrefix_(prefix){
  const sp = PropertiesService.getScriptProperties();
  const all = sp.getProperties();
  let n = 0;

  Object.keys(all).forEach(k => {
    if(k.startsWith(prefix)){
      sp.deleteProperty(k);
      n++;
    }
  });

  return n;
}

/** ลบ Script Property ตามชื่อ */
function clearPropByName_(key){
  const sp = PropertiesService.getScriptProperties();
  if(sp.getProperty(key) !== null){
    sp.deleteProperty(key);
    return 1;
  }
  return 0;
}

/** ✅ ลบ shiftNotifySent_ ทั้งหมด + DAILY_SIGN_LAST_SENT_ISO */
function adminClearShiftNotifyAndDailySign(){
  let total = 0;

  total += clearPropsByPrefix_('shiftNotifySent_');
  total += clearPropByName_('DAILY_SIGN_LAST_SENT_ISO');

  Logger.log('Deleted props = ' + total);
}

/** ⚠️ ลบทุก property ทั้งหมด */
function adminClearAllScriptProperties(){
  PropertiesService.getScriptProperties().deleteAllProperties();
  Logger.log('Deleted ALL script properties.');
}

/**
 * listInboxForCoverer
 * - คืนรายการ "รอผู้แทนตอบรับ" ที่ coverer == คนที่ login (จาก token)
 * - ดึงทั้งปีครั้งเดียว เร็วกว่า refreshInbox แบบวน 12 เดือนมาก
 */
function listInboxForCoverer(token, beYear){
  requireRole_(token,'viewer');

  const me = normalizeName_(getLoginPersonName_(token));
  if(!me) throw new Error('บัญชีนี้ไม่ได้ผูก personName');

  const sh = getRequestsSheet_();
  const last = sh.getLastRow();
  if(last <= 1) return [];

  // สมมติ Requests มี 14 คอลัมน์ตามที่คุณใช้
  const vals = sh.getRange(2,1,last-1,14).getValues();

  // index mapping ตาม appendRow ของคุณ:
  // [0]id, [1]beYear, [2]monthIdx, [3]day, [4]shift, [5]requester, [6]coverer, [7]reason, [8]status, [9]createdAt, [10]lastActorRole, [11]lastAt, [12]decision, [13]decisionAt
  const out = [];
  for(const r of vals){
    const y = Number(r[1]);
    if(y !== Number(beYear)) continue;

    const coverer = normalizeName_(r[6] || '');
    const status  = String(r[8] || '').trim();

    // รอผู้แทนตอบรับ
    if(coverer === me && status === 'await_coverer'){
      out.push({
        id: String(r[0] || ''),
        beYear: y,
        month: Number(r[2]),
        day: Number(r[3]),
        shift: String(r[4] || ''),
        requester: String(r[5] || ''),
        coverer: String(r[6] || ''),
        reason: String(r[7] || ''),
        status: status,
        createdAt: String(r[9] || '')
      });
    }
  }

  // เรียงเดือน/วัน/กะ
  out.sort((a,b)=>(a.month-b.month)||(a.day-b.day)||(Number(a.shift)-Number(b.shift)));
  return out;
}

function isLeaderOnShift(token, beYear, monthIdx, day, shift){
  const sess = ensureLogged_(token);
  const meRaw = sess.personName || '';
  const me = canonName_(normalizeName_(meRaw));

  const sNum = Number(shift);
  if(!day || ![1,2,3].includes(sNum)) throw new Error('ข้อมูลวันหรือกะไม่ถูกต้อง');

  const monthSh = getMonthSheetByIdx_(beYear, monthIdx);
  if(!monthSh) return { isLeader:false, leaderName:'' };

  // ✅ อ่าน "เฉพาะเซลล์ของกะนั้น" (แถว 4/5/6)
  const cellText = getShiftCellTextForDay_(monthSh, Number(day), sNum);
  if(!cellText) return { isLeader:false, leaderName:'' };

  // ✅ แตกชื่อจากข้อความในเซลล์
  let names = extractNamesFromShiftCell_(cellText);

  // ✅ fallback: ถ้ายังไม่ได้ ลอง parse แบบหลัง ":" (แต่ใช้ lastIndex / หรือ '):' ก่อน)
  if(!names || !names.length){
    names = parseNamesAfterColonSafe_(cellText);
  }

  const leaderName = pickLeaderFromMonthlyCell_(names);

  const leaderCanon = canonName_(leaderName);
  const isLeader = !!leaderCanon && !!me && leaderCanon === me;

  return { isLeader, leaderName: leaderName || '' };
}

/** =========================
 * Helpers
 * ========================= */

function getMonthSheetByIdx_(beYear, monthIdx){
  const ss = SpreadsheetApp.getActive();
  const sheets = ss.getSheets();

  const m = Number(monthIdx);
  const y = String(beYear);
  const candidates = [];

  if (typeof TH_MONTHS !== 'undefined' && Array.isArray(TH_MONTHS) && TH_MONTHS[m-1]) {
    candidates.push(`${TH_MONTHS[m-1]}${y}`);
    candidates.push(`${TH_MONTHS[m-1]}.${y}`);
    candidates.push(`${TH_MONTHS[m-1]} ${y}`);
  }

  const mm2 = String(m).padStart(2,'0');
  candidates.push(`${mm2}/${y}`);
  candidates.push(`${m}/${y}`);
  candidates.push(`${mm2}-${y}`);
  candidates.push(`${m}-${y}`);

  for(const name of candidates){
    const sh = ss.getSheetByName(name);
    if(sh) return sh;
  }

  const hit = sheets.find(sh => {
    const n = sh.getName();
    if(!n.includes(y)) return false;

    if (typeof TH_MONTHS !== 'undefined' && Array.isArray(TH_MONTHS) && TH_MONTHS[m-1]) {
      if(n.includes(TH_MONTHS[m-1])) return true;
    }
    if(n.includes(`${mm2}`) || n.includes(`${m}`)) return true;
    return false;
  });

  return hit || null;
}

function getShiftCellTextForDay_(monthSh, dayNum, shiftNum){
  const col = findDayColumn_(monthSh, dayNum);
  if(!col) return '';

  // ✅ กะ1=แถว4, กะ2=แถว5, กะ3=แถว6 (เสมอ)
  const row = 3 + Number(shiftNum); // 4/5/6
  const v = monthSh.getRange(row, col).getDisplayValue();
  return (v || '').toString().trim();
}

function findDayColumn_(sh, dayNum){
  const lastCol = sh.getLastColumn();
  const header = sh.getRange(1,1,1,lastCol).getValues()[0];
  for(let c=0;c<header.length;c++){
    if(Number(header[c]) === Number(dayNum)) return c+1;
  }
  return 0;
}

/**
 * ✅ แตกชื่อจาก "เซลล์กะเดียว" เช่น:
 * "กะ2 (08:30-16:30): นายไมตรี เผือกผ่อง"
 * "กะ1 (00:30-08:30): นายA, นายB"
 *
 * ป้องกันปัญหา ':' ในเวลา 08:30 โดยตัดหลัง '):' ก่อนเสมอ
 */
function extractNamesFromShiftCell_(cellText){
  const line = (cellText || '').toString().trim();
  if(!line) return [];

  // 1) ตัดหลัง '):' (ปลอดภัยสุด)
  const idx = line.indexOf('):');
  if(idx >= 0){
    const raw = line.slice(idx + 2).trim();
    return splitNames_(raw);
  }

  // 2) fallback: ใช้ ':' ตัวสุดท้าย เผื่อรูปแบบไม่ใช่ '):'
  const last = Math.max(line.lastIndexOf(':'), line.lastIndexOf('：'));
  if(last >= 0){
    const raw = line.slice(last + 1).trim();
    return splitNames_(raw);
  }

  return [];
}

function parseNamesAfterColonSafe_(cellText){
  // fallback อีกชั้น (ทำเหมือนกัน)
  return extractNamesFromShiftCell_(cellText);
}

function splitNames_(rawNames){
  if(!rawNames) return [];
  return rawNames
    .split(',')
    .flatMap(s => s.split(' และ '))
    .map(s => normalizeName_(s))
    .filter(Boolean);
}

/**
 * หัวหน้าเวร = ชื่อแรกที่ไม่อยู่ใน FORBIDDEN_LEADERS
 * ✅ ถ้ามีคนเดียว ให้คนนั้นเป็นหัวหน้าเวรทันที
 */
function pickLeaderFromMonthlyCell_(names){
  const arr = (names || [])
    .map(s => (s || '').toString().trim())
    .map(normalizeName_)
    .filter(Boolean);

  if(arr.length === 1) return arr[0];

  for (const n of arr){
    if (isForbiddenLeader_(n)) continue;
    return n;
  }
  return '';
}

function canonName_(s){
  return (s || '')
    .toString()
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(นาย|นางสาว|น\.ส\.|นาง|ว่าที่ร้อยตรี|ว่าที่ ร\.ต\.|ร้อยตรี|ร\.ต\.|ดร\.|Dr\.)\s*/,'')
    .trim()
    .toLowerCase();
}

//ใช้แค่ 1 ครั้ง
function oneTimeSetWebexConfig(){
  const sp = PropertiesService.getScriptProperties();
  sp.setProperty('WEBEX_TOKEN', '');
  sp.setProperty('WEBEX_ROOM_ID', '');
}

/** ดึงรายการ location จากชีต Device คอลัมน์ C สำหรับ autocomplete */
function getDeviceLocationOptions() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'device_location_options_v1';
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('Device');
  if (!sh) throw new Error('ไม่พบชีต Device');

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  // คอลัมน์ C = 3, เริ่มอ่านตั้งแต่แถว 2
  const values = sh.getRange(2, 3, lastRow - 1, 1).getDisplayValues()
    .flat()
    .map(v => String(v || '').trim())
    .filter(Boolean);

  // ตัดค่าซ้ำ
  const unique = [...new Set(values)];

  // cache 6 ชั่วโมง
  cache.put(cacheKey, JSON.stringify(unique), 21600);

  return unique;
}

function clearDeviceLocationOptionsCache() {
  CacheService.getScriptCache().remove('device_location_options_v1');
}

function getOrCreateOutageMemorySheet_(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(OUTAGE_MEMORY_SHEET);

  const headers = [
    'TimestampServer','BE','Month','Day','Shift','Leader',
    'Device','Location','VoltageLevel','Minutes',
    'Cause','CauseNote',
    'OutageHV','OutageLV',
    'Lat','Lng','PhotoUrl','ClientTime','RawJson'
  ];

  if(!sh){
    sh = ss.insertSheet(OUTAGE_MEMORY_SHEET);
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }

  return sh;
}

function splitDeviceLocation_(siteText){
  const s = String(siteText || '').trim();
  if(!s) return { device:'', location:'' };

  const parts = s.split(/\s+/);
  const device = parts[0] || '';
  const location = parts.slice(1).join(' ');

  return { device, location };
}

function appendOutageMemory_(payload){
  try{
    if(!payload || !Array.isArray(payload.outages) || !payload.outages.length) return;

    const sh = getOrCreateOutageMemorySheet_();

    const rows = payload.outages.map(o => {
      const site = String(o.site || '').trim();
      const dl = splitDeviceLocation_(site);

      return [
        payload.tsServer || '',
        Number(payload.beYear || 0),
        Number(payload.monthIdx || 0),
        Number(payload.day || 0),
        String(payload.shift || ''),
        String(payload.name || ''),
        dl.device,
        dl.location || site,
        String(o.voltageLevel || ''),
        Number(o.minutes || 0),
        String(o.cause || 'ไม่ทราบสาเหตุ'),
        String(o.causeNote || ''),
        String(payload.outageHV || ''),
        String(payload.outageLV || ''),
        String(payload.lat || ''),
        String(payload.lng || ''),
        String(payload.photoUrl || ''),
        String(payload.tsClient || ''),
        JSON.stringify(o)
      ];
    });

    sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }catch(err){
    Logger.log('appendOutageMemory_ error: ' + (err && err.message ? err.message : err));
  }
}
