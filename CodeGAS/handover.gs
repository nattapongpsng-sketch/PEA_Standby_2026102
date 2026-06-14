/* =============================================================================
 * handover.gs (REPLACE WHOLE FILE)
 * HANDOVER MODULE for PEA Standby Roster App
 * Flow:
 *   1) ผู้มอบบันทึกส่งมอบ -> Status = PENDING_RECEIVER
 *   2) ผู้รับมอบเข้าหน้าเดียวกัน -> เห็นรายการรอยอมรับ -> กดยอมรับ/ปฏิเสธ
 *   3) PDF จะแสดงช่องลงนามทั้งผู้มอบและผู้รับมอบ เฉพาะรายการที่ ACCEPTED แล้ว
 *
 * Required from main project:
 *   - requireAuth_(token)  returns { user/username, role, personName }
 *   - include(filename)
 *
 * Sheets:
 *   - รายชื่อพนักงาน
 *   - HandoverLog
 *   - Vehicle item sheets: ชื่อชีตขึ้นต้นด้วย "รายการ"
 *
 * Vehicle item sheet columns supported:
 *   ลำดับ | ประเภท | รายการ | หน่วย | จำนวนมาตรฐาน | จำนวนที่มี | จำนวนที่มีจริง
 * If "ประเภท" missing, this module auto-adds it and defaults each item to "เครื่องมือ/พัสดุ".
 * ============================================================================= */

/***** CONFIG *****/
const HO_EMP_SHEET      = 'รายชื่อพนักงาน';
const HO_EQUIP_TEMPLATE = '_TEMPLATE_รถยนต์แก้ไฟ';
const HO_LOG_SHEET      = 'HandoverLog';

const HO_VEHICLE_PREFIX = 'รายการ';
const HO_TZ = 'Asia/Bangkok';

// Drive File ID โลโก้หัว PDF
const HO_LOGO_FILE_ID = '12ObBKnkNrqj7lvqTG72UcCv_pC6Se9HZ';

// แนะนำให้ย้าย token/room ไป Script Properties: HO_WEBEX_TOKEN / HO_WEBEX_ROOM_ID
const HO_WEBEX_TOKEN_PROP = 'HO_WEBEX_TOKEN';
const HO_WEBEX_ROOM_ID_PROP = 'HO_WEBEX_ROOM_ID';

const HO_STATUS_PENDING  = 'PENDING_RECEIVER';
const HO_STATUS_ACCEPTED = 'ACCEPTED';
const HO_STATUS_REJECTED = 'REJECTED';

const HO_LOG_HEADERS_ = [
  'Id',
  'Timestamp',
  'CheckDateISO',
  'DateBE',
  'Month',
  'Day',
  'GiverUsername',
  'GiverName',
  'ReceiverName',
  'VehicleSheet',
  'ItemScope',
  'TotalItems',
  'MissingCount',
  'ItemsJson',
  'Remark',
  'Status',
  'ReceiverDecisionAt',
  'ReceiverDecisionBy',
  'ReceiverDecisionNote',
  'WebexStatus',
  'WebexError'
];

const HO_EQUIP_HEADERS_ = [
  'ลำดับ',
  'ประเภท',
  'รายการ',
  'หน่วย',
  'จำนวนมาตรฐาน',
  'จำนวนที่มี',
  'จำนวนที่มีจริง'
];

/***** GUARDS *****/
function hoRequireMainAuth_(){
  if (typeof requireAuth_ !== 'function') {
    throw new Error('ไม่พบ requireAuth_(token) ในโปรเจกต์หลัก กรุณาตรวจสอบ Code.gs หลัก');
  }
}

/***** UTIL *****/
function hoNow_(){ return new Date(); }
function hoPad2_(n){ n = Number(n)||0; return (n<10?'0':'')+n; }

function hoNorm_(s){
  return String(s ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g,'')
    .replace(/\u00A0/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function hoPersonKey_(s){
  return hoNorm_(s)
    .replace(/^(นาย|นางสาว|นาง|Mr\.?|Mrs\.?|Ms\.?)\s+/i,'')
    .replace(/\s+/g,'')
    .toLowerCase();
}

function hoVehicleKey_(s){
  return hoNorm_(s).replace(/\s+/g,'');
}

function hoBeYearFromAD_(adYear){ return Number(adYear) + 543; }
function hoAdYearFromBE_(beYear){ return Number(beYear) - 543; }

function hoFmtDateTH_(d){
  return `${hoPad2_(d.getDate())}/${hoPad2_(d.getMonth()+1)}/${d.getFullYear()+543}`;
}

function hoParseDateISO_(iso){
  iso = String(iso||'').trim();
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if(!y || mo<1 || mo>12 || d<1 || d>31) return null;
  return new Date(y, mo-1, d, 12, 0, 0);
}

function hoToISODate_(v){
  if(v instanceof Date && !isNaN(v.getTime())){
    return Utilities.formatDate(v, HO_TZ, 'yyyy-MM-dd');
  }
  const s = hoNorm_(v);
  if(!s) return '';
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dt = new Date(s);
  if(dt instanceof Date && !isNaN(dt.getTime())){
    return Utilities.formatDate(dt, HO_TZ, 'yyyy-MM-dd');
  }
  return s;
}

function hoIsoFromBE_(be, month, day){
  const ad = Number(be) - 543;
  const m  = Number(month);
  const d  = Number(day);
  const dt = new Date(ad, m-1, d, 12, 0, 0);
  return Utilities.formatDate(dt, HO_TZ, 'yyyy-MM-dd');
}

function hoJson_(v){
  try{ return JSON.stringify(v); }catch(e){ return '[]'; }
}

function hoParseJson_(s, fallback){
  try{
    const v = JSON.parse(String(s||''));
    return v == null ? fallback : v;
  }catch(e){
    return fallback;
  }
}

function hoStripTitle_(name){
  return hoNorm_(name).replace(/^(นาย|นางสาว|นาง)\s+/,'').trim();
}


/* =========================================================
 * One-time setup Webex Script Properties
 * รันครั้งเดียว แล้วลบทิ้งได้
 * ========================================================= */
function hoOneTimeSetWebexConfig(){

  const props = PropertiesService.getScriptProperties();

  // ตั้งค่า TOKEN
  props.setProperty(
    'HO_WEBEX_TOKEN',
    ''
  );

  // ตั้งค่า ROOM ID
  props.setProperty(
    'HO_WEBEX_ROOM_ID',
    ''
  );

  Logger.log('✅ Webex Script Properties set completed');
}

/***** SHEETS *****/
function hoGetSheet_(name, create, headers){
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if(!sh && create){
    sh = ss.insertSheet(name);
    if(headers && headers.length){
      sh.getRange(1,1,1,headers.length).setValues([headers]);
      sh.setFrozenRows(1);
    }
  }
  return sh;
}

function hoGetHeaderMap_(sh){
  const lastCol = Math.max(1, sh.getLastColumn());
  const head = sh.getRange(1,1,1,lastCol).getValues()[0].map(hoNorm_);
  const map = {};
  head.forEach((h,i)=>{ if(h) map[h] = i+1; });
  return map;
}

function hoEnsureHeaders_(sh, headers){
  const lastCol = Math.max(headers.length, sh.getLastColumn());
  const headNow = sh.getRange(1,1,1,lastCol).getValues()[0].map(hoNorm_);
  const nonEmpty = headNow.filter(Boolean).length;

  if(nonEmpty === 0){
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    return;
  }

  const map = hoGetHeaderMap_(sh);
  const existing = new Set(Object.keys(map));
  const toAdd = headers.filter(h => !existing.has(h));
  if(toAdd.length){
    const before = sh.getLastColumn();
    sh.insertColumnsAfter(before, toAdd.length);
    sh.getRange(1, before+1, 1, toAdd.length).setValues([toAdd]);
  }
  sh.setFrozenRows(1);
}

function hoEnsureAllSheets_(){
  const tpl = hoGetSheet_(HO_EQUIP_TEMPLATE, true, HO_EQUIP_HEADERS_);
  hoEnsureHeaders_(tpl, HO_EQUIP_HEADERS_);

  const log = hoGetSheet_(HO_LOG_SHEET, true, HO_LOG_HEADERS_);
  hoEnsureHeaders_(log, HO_LOG_HEADERS_);
}

/***** VEHICLES *****/
function hoGetVehicleSheets(token){
  hoRequireMainAuth_();
  requireAuth_(token);
  hoEnsureAllSheets_();

  const ss = SpreadsheetApp.getActive();
  return ss.getSheets().map(s=>s.getName()).filter(n=>{
    const name = hoNorm_(n);
    if(!name.startsWith(HO_VEHICLE_PREFIX)) return false;
    if(name === hoNorm_(HO_EQUIP_TEMPLATE)) return false;
    if(name === hoNorm_(HO_LOG_SHEET)) return false;
    if(name === hoNorm_(HO_EMP_SHEET)) return false;
    return true;
  });
}

/***** EMPLOYEES *****/
function hoGetEmployeeNames(token){
  hoRequireMainAuth_();
  requireAuth_(token);

  const sh = hoGetSheet_(HO_EMP_SHEET, false);
  if(!sh) throw new Error(`ไม่พบชีต "${HO_EMP_SHEET}"`);

  const vals = sh.getRange(1,1,Math.max(1,sh.getLastRow()),1)
    .getValues()
    .flat()
    .map(hoNorm_)
    .filter(Boolean);

  const out = [];
  const seen = new Set();
  vals.forEach(n=>{
    const k = hoPersonKey_(n);
    if(k && !seen.has(k)){
      seen.add(k);
      out.push(n);
    }
  });
  return out;
}

/***** EQUIPMENT / SUPPLIES *****/
function hoGetEquipmentList(token, vehicleSheet){
  hoRequireMainAuth_();
  requireAuth_(token);
  hoEnsureAllSheets_();

  vehicleSheet = hoNorm_(vehicleSheet);
  if(!vehicleSheet) throw new Error('กรุณาเลือก "รถ"');

  const sh = hoGetSheet_(vehicleSheet, false);
  if(!sh) throw new Error(`ไม่พบชีตรถ "${vehicleSheet}"`);

  hoEnsureHeaders_(sh, HO_EQUIP_HEADERS_);

  const values = sh.getDataRange().getValues();
  if(values.length < 2) return [];

  const head = values[0].map(hoNorm_);
  const idx = {
    seq: head.indexOf('ลำดับ'),
    type: head.indexOf('ประเภท'),
    item: head.indexOf('รายการ'),
    unit: head.indexOf('หน่วย'),
    std: head.indexOf('จำนวนมาตรฐาน'),
    have: head.indexOf('จำนวนที่มี'),
    actual: head.indexOf('จำนวนที่มีจริง'),
  };

  const rows = values.slice(1).filter(r => hoNorm_(idx.item>=0 ? r[idx.item] : '') );

  return rows.map((r,i)=> {
    const haveQty = Number(idx.have>=0 ? r[idx.have] : 0) || 0;
    return {
      rowIndex: i+2,
      seq: (idx.seq>=0 ? r[idx.seq] : (i+1)),
      type: hoNorm_(idx.type>=0 ? r[idx.type] : '') || 'เครื่องมือ/พัสดุ',
      name: hoNorm_(idx.item>=0 ? r[idx.item] : ''),
      unit: hoNorm_(idx.unit>=0 ? r[idx.unit] : ''),
      stdQty: Number(idx.std>=0 ? r[idx.std] : 0) || 0,
      haveQty: haveQty,
      actualQty: Number(idx.actual>=0 ? r[idx.actual] : haveQty) || 0
    };
  });
}

function hoSaveActualQtys(token, vehicleSheet, updates){
  hoRequireMainAuth_();
  requireAuth_(token);
  hoEnsureAllSheets_();

  vehicleSheet = hoNorm_(vehicleSheet);
  if(!vehicleSheet) throw new Error('กรุณาเลือก "รถ"');

  const sh = hoGetSheet_(vehicleSheet, false);
  if(!sh) throw new Error(`ไม่พบชีตรถ "${vehicleSheet}"`);

  hoEnsureHeaders_(sh, HO_EQUIP_HEADERS_);

  updates = Array.isArray(updates) ? updates : [];
  if(!updates.length) return {ok:true, updated:0};

  const head = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(hoNorm_);
  const colActual = head.indexOf('จำนวนที่มีจริง');
  if(colActual < 0) throw new Error('ไม่พบคอลัมน์ "จำนวนที่มีจริง"');

  let count = 0;
  updates.forEach(u=>{
    const rowIndex = Number(u.rowIndex||0);
    if(rowIndex>=2){
      sh.getRange(rowIndex, colActual+1).setValue(Number(u.actualQty||0)||0);
      count++;
    }
  });
  return {ok:true, updated:count};
}

/***** LOG *****/
function hoGetLogSheet_(){
  hoEnsureAllSheets_();
  const sh = hoGetSheet_(HO_LOG_SHEET, true, HO_LOG_HEADERS_);
  hoEnsureHeaders_(sh, HO_LOG_HEADERS_);
  return sh;
}

function hoAppendLogRow_(obj){
  const sh = hoGetLogSheet_();
  const rowIndex = sh.getLastRow() + 1;
  const map = hoGetHeaderMap_(sh);

  Object.keys(obj).forEach(k=>{
    const col = map[k];
    if(col) sh.getRange(rowIndex, col).setValue(obj[k]);
  });
  return rowIndex;
}

function hoUpdateLogById_(id, patch){
  const sh = hoGetLogSheet_();
  const values = sh.getDataRange().getValues();
  if(values.length < 2) throw new Error('ยังไม่มีข้อมูลใน HandoverLog');

  const head = values[0].map(hoNorm_);
  const iId = head.indexOf('Id');
  if(iId < 0) throw new Error('ไม่พบคอลัมน์ Id ใน HandoverLog');

  let rowNo = -1;
  for(let i=1; i<values.length; i++){
    if(String(values[i][iId]) === String(id)){
      rowNo = i+1;
      break;
    }
  }
  if(rowNo < 0) throw new Error('ไม่พบรายการที่ต้องการอัปเดต');

  const map = hoGetHeaderMap_(sh);
  Object.keys(patch || {}).forEach(k=>{
    const col = map[k];
    if(col) sh.getRange(rowNo, col).setValue(patch[k]);
  });

  return true;
}

/***** WEBEX *****/
function hoGetScriptProp_(key, def){
  const v = PropertiesService.getScriptProperties().getProperty(key);
  return v == null || v === '' ? (def || '') : String(v);
}

function hoSendWebexMessage_(text){
  const token = hoGetScriptProp_(HO_WEBEX_TOKEN_PROP, '');
  const room  = hoGetScriptProp_(HO_WEBEX_ROOM_ID_PROP, '');

  if(!token || !room) {
    return {ok:false, message:'SKIP: ไม่ได้ตั้งค่า HO_WEBEX_TOKEN/HO_WEBEX_ROOM_ID'};
  }

  const url = 'https://webexapis.com/v1/messages';
  const payload = { roomId: room, markdown: String(text||'') };

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  if(code>=200 && code<300) return {ok:true};
  return {ok:false, code, body: res.getContentText()};
}

function hoNotify_(title, lines){
  let status = 'SKIP';
  let error = '';
  try{
    const msg = [`**${title}**`].concat(lines || []).join('\n');
    const res = hoSendWebexMessage_(msg);
    if(res && res.ok){
      status = 'OK';
    }else{
      status = 'SKIP';
      error = res ? hoJson_(res) : '';
    }
  }catch(e){
    status = 'ERR';
    error = String(e && e.message ? e.message : e);
  }
  return {status, error};
}

/***** SUBMIT: PENDING RECEIVER *****/
function hoSubmitHandover(token, payload){
  hoRequireMainAuth_();
  const u = requireAuth_(token);
  hoEnsureAllSheets_();

  const giverName = hoNorm_(u.personName);
  if(!giverName) throw new Error('บัญชีนี้ยังไม่ผูก PersonName ในชีต Users');

  payload = payload || {};
  const receiverName = hoNorm_(payload.receiverName);
  const remark = hoNorm_(payload.remark);
  const items = Array.isArray(payload.items) ? payload.items : [];
  const checkDateISO = String(payload.checkDateISO || '').trim();
  const vehicleSheet = hoNorm_(payload.vehicleSheet);
  const itemScope = hoNorm_(payload.itemScope || 'เครื่องมือและพัสดุ');

  if(!vehicleSheet) throw new Error('กรุณาเลือก "รถ"');
  if(!receiverName) throw new Error('กรุณาเลือกผู้รับมอบ');
  if(hoPersonKey_(receiverName) === hoPersonKey_(giverName)) throw new Error('ผู้รับมอบต้องไม่ใช่คนเดียวกับผู้มอบ');
  if(!items.length) throw new Error('ไม่มีรายการอุปกรณ์/พัสดุ');
  if(!checkDateISO) throw new Error('กรุณาเลือกวันที่ตรวจสอบ');

  const checkDate = hoParseDateISO_(checkDateISO);
  if(!checkDate) throw new Error('รูปแบบวันที่ตรวจสอบไม่ถูกต้อง');

  const beY = hoBeYearFromAD_(checkDate.getFullYear());
  const mm  = checkDate.getMonth()+1;
  const dd  = checkDate.getDate();

  let missingCount = 0;

  const normalizedItems = items.map(it=>{
    const type      = hoNorm_(it.type || 'เครื่องมือ/พัสดุ');
    const stdQty    = Number(it.stdQty||0)||0;
    const haveQty   = Number(it.haveQty||0)||0;
    const actualQty = Number(it.actualQty||0)||0;
    const note      = hoNorm_(it.note||'');

    const missingQty = Math.max(0, haveQty - actualQty);
    const has = missingQty <= 0;
    const problem = (!has) || (stdQty>0 && actualQty < stdQty);
    if(problem) missingCount++;

    return {
      seq: it.seq,
      type,
      name: hoNorm_(it.name),
      unit: hoNorm_(it.unit),
      stdQty, haveQty, actualQty,
      missingQty,
      has,
      note
    };
  });

  const ts = hoNow_();
  const id = Utilities.getUuid();

  const wx = hoNotify_('📦 ส่งมอบเครื่องมือ/พัสดุ รอผู้รับมอบยอมรับ', [
    `- รถ: **${vehicleSheet}**`,
    `- ประเภท: ${itemScope}`,
    `- วันที่ตรวจสอบ: ${hoPad2_(dd)}/${hoPad2_(mm)}/${beY}`,
    `- ผู้มอบ: ${giverName}`,
    `- ผู้รับมอบ: ${receiverName}`,
    `- รายการทั้งหมด: ${normalizedItems.length}`,
    `- รายการไม่ครบ/ขาด: ${missingCount}`,
    `- สถานะ: \`${HO_STATUS_PENDING}\``,
    `- หมายเหตุ: ${remark || '-'}`
  ]);

  hoAppendLogRow_({
    'Id': id,
    'Timestamp': ts,
    'CheckDateISO': checkDateISO,
    'DateBE': beY,
    'Month': mm,
    'Day': dd,
    'GiverUsername': u.user || u.username || '',
    'GiverName': giverName,
    'ReceiverName': receiverName,
    'VehicleSheet': vehicleSheet,
    'ItemScope': itemScope,
    'TotalItems': normalizedItems.length,
    'MissingCount': missingCount,
    'ItemsJson': JSON.stringify(normalizedItems),
    'Remark': remark,
    'Status': HO_STATUS_PENDING,
    'ReceiverDecisionAt': '',
    'ReceiverDecisionBy': '',
    'ReceiverDecisionNote': '',
    'WebexStatus': wx.status,
    'WebexError': wx.error
  });

  return {
    ok:true,
    id,
    status: HO_STATUS_PENDING,
    checkDateISO,
    dateTH: hoFmtDateTH_(checkDate),
    missingCount,
    webexStatus: wx.status,
    vehicleSheet
  };
}

/***** PENDING LIST FOR RECEIVER *****/
function hoListPendingForReceiver(token){
  hoRequireMainAuth_();
  const u = requireAuth_(token);
  const me = hoNorm_(u.personName);
  if(!me) throw new Error('บัญชีนี้ยังไม่ผูก PersonName ในชีต Users');

  const sh = hoGetLogSheet_();
  const values = sh.getDataRange().getValues();
  if(values.length < 2) return [];

  const head = values[0].map(hoNorm_);
  const col = k => head.indexOf(k);

  const idx = {
    id: col('Id'),
    ts: col('Timestamp'),
    iso: col('CheckDateISO'),
    be: col('DateBE'),
    m: col('Month'),
    d: col('Day'),
    giver: col('GiverName'),
    receiver: col('ReceiverName'),
    vehicle: col('VehicleSheet'),
    scope: col('ItemScope'),
    total: col('TotalItems'),
    miss: col('MissingCount'),
    remark: col('Remark'),
    status: col('Status')
  };

  const out = [];
  for(let r=1; r<values.length; r++){
    const row = values[r];
    if(hoPersonKey_(row[idx.receiver]) !== hoPersonKey_(me)) continue;
    if(hoNorm_(row[idx.status] || HO_STATUS_ACCEPTED) !== HO_STATUS_PENDING) continue;

    out.push({
      id: row[idx.id],
      ts: row[idx.ts],
      checkDateISO: idx.iso>=0 ? hoToISODate_(row[idx.iso]) : '',
      beYear: idx.be>=0 ? Number(row[idx.be]||0) : 0,
      month: idx.m>=0 ? Number(row[idx.m]||0) : 0,
      day: idx.d>=0 ? Number(row[idx.d]||0) : 0,
      giver: idx.giver>=0 ? row[idx.giver] : '',
      receiver: idx.receiver>=0 ? row[idx.receiver] : '',
      vehicle: idx.vehicle>=0 ? row[idx.vehicle] : '',
      itemScope: idx.scope>=0 ? row[idx.scope] : '',
      totalItems: idx.total>=0 ? Number(row[idx.total]||0) : 0,
      missingCount: idx.miss>=0 ? Number(row[idx.miss]||0) : 0,
      remark: idx.remark>=0 ? row[idx.remark] : '',
      status: HO_STATUS_PENDING
    });
  }

  out.sort((a,b)=>{
    const ta = a.ts ? new Date(a.ts).getTime() : 0;
    const tb = b.ts ? new Date(b.ts).getTime() : 0;
    return tb - ta;
  });

  return out;
}

/***** RECEIVER ACCEPT / REJECT *****/
function hoRespondHandover(token, handoverId, decision, note){
  hoRequireMainAuth_();
  const u = requireAuth_(token);
  const me = hoNorm_(u.personName);
  if(!me) throw new Error('บัญชีนี้ยังไม่ผูก PersonName ในชีต Users');

  const data = hoGetHandoverById_(handoverId);
  if(hoPersonKey_(data.receiver) !== hoPersonKey_(me)){
    throw new Error('คุณไม่ใช่ผู้รับมอบของรายการนี้');
  }
  if(data.status !== HO_STATUS_PENDING){
    throw new Error('รายการนี้ไม่ได้อยู่ในสถานะรอผู้รับมอบยอมรับ');
  }

  decision = hoNorm_(decision).toUpperCase();
  const newStatus = decision === 'ACCEPT' ? HO_STATUS_ACCEPTED : HO_STATUS_REJECTED;
  const dt = hoNow_();
  const noteText = hoNorm_(note || '');

  const wx = hoNotify_(newStatus === HO_STATUS_ACCEPTED ? '✅ ผู้รับมอบยอมรับรายการส่งมอบแล้ว' : '❌ ผู้รับมอบปฏิเสธรายการส่งมอบ', [
    `- รถ: **${data.vehicle}**`,
    `- ผู้มอบ: ${data.giver}`,
    `- ผู้รับมอบ: ${data.receiver}`,
    `- วันที่: ${hoPad2_(data.day)}/${hoPad2_(data.month)}/${data.beYear}`,
    `- สถานะ: \`${newStatus}\``,
    `- หมายเหตุผู้รับมอบ: ${noteText || '-'}`
  ]);

  hoUpdateLogById_(handoverId, {
    'Status': newStatus,
    'ReceiverDecisionAt': dt,
    'ReceiverDecisionBy': me,
    'ReceiverDecisionNote': noteText,
    'WebexStatus': wx.status,
    'WebexError': wx.error
  });

  return {ok:true, id: handoverId, status: newStatus};
}

function hoAcceptHandover(token, handoverId, note){
  return hoRespondHandover(token, handoverId, 'ACCEPT', note || '');
}

function hoRejectHandover(token, handoverId, note){
  return hoRespondHandover(token, handoverId, 'REJECT', note || '');
}

/***** LIST BY DAY + VEHICLE *****/
function hoListHandoversByDay(token, beYear, month, day, vehicleSheet){
  hoRequireMainAuth_();
  requireAuth_(token);

  const BE = Number(beYear)||0;
  const M  = Number(month)||0;
  const D  = Number(day)||0;
  if(!BE || !M || !D) throw new Error('วัน/เดือน/ปี ไม่ครบ');

  const vehNeed = hoVehicleKey_(vehicleSheet);
  if(!vehNeed) throw new Error('กรุณาเลือก "รถ"');

  const isoNeed = hoIsoFromBE_(BE, M, D);

  const sh = hoGetLogSheet_();
  const values = sh.getDataRange().getValues();
  if(values.length < 2) return [];

  const head = values[0].map(hoNorm_);
  const col = k => head.indexOf(k);

  const iId   = col('Id');
  const iISO  = col('CheckDateISO');
  const iBE   = col('DateBE');
  const iM    = col('Month');
  const iD    = col('Day');
  const iG    = col('GiverName');
  const iR    = col('ReceiverName');
  const iMiss = col('MissingCount');
  const iRem  = col('Remark');
  const iTs   = col('Timestamp');
  const iVeh  = col('VehicleSheet');
  const iScope= col('ItemScope');
  const iStatus = col('Status');

  if(iId<0 || iTs<0 || iVeh<0) throw new Error('หัวตาราง HandoverLog ไม่ตรง');

  const out = [];

  for(let r=1; r<values.length; r++){
    const row = values[r];

    const vehRow = hoVehicleKey_(iVeh>=0 ? row[iVeh] : '');
    if(vehRow !== vehNeed) continue;

    let okDate = false;
    const isoRow = (iISO>=0) ? hoToISODate_(row[iISO]) : '';
    if(isoRow && /^\d{4}-\d{2}-\d{2}$/.test(isoRow)){
      okDate = (isoRow === isoNeed);
    } else {
      okDate =
        (Number(iBE>=0 ? row[iBE] : 0) === BE) &&
        (Number(iM>=0  ? row[iM]  : 0) === M)  &&
        (Number(iD>=0  ? row[iD]  : 0) === D);
    }
    if(!okDate) continue;

    out.push({
      id: row[iId],
      ts: row[iTs],
      giver: iG>=0 ? row[iG] : '',
      receiver: iR>=0 ? row[iR] : '',
      vehicle: iVeh>=0 ? row[iVeh] : '',
      itemScope: iScope>=0 ? row[iScope] : '',
      missingCount: Number(iMiss>=0 ? row[iMiss] : 0) || 0,
      remark: iRem>=0 ? (row[iRem]||'') : '',
      status: iStatus>=0 ? hoNorm_(row[iStatus] || HO_STATUS_ACCEPTED) : HO_STATUS_ACCEPTED
    });
  }

  out.sort((a,b)=>{
    const ta = a.ts ? new Date(a.ts).getTime() : 0;
    const tb = b.ts ? new Date(b.ts).getTime() : 0;
    return ta - tb;
  });

  return out;
}

/***** GET ONE *****/
function hoGetHandoverById_(id){
  const sh = hoGetLogSheet_();
  const values = sh.getDataRange().getValues();
  if(values.length < 2) throw new Error('ยังไม่มีข้อมูลใน HandoverLog');

  const head = values[0].map(hoNorm_);
  const col = k => head.indexOf(k);

  const iId    = col('Id');
  const iTs    = col('Timestamp');
  const iISO   = col('CheckDateISO');
  const iBE    = col('DateBE');
  const iM     = col('Month');
  const iD     = col('Day');
  const iG     = col('GiverName');
  const iR     = col('ReceiverName');
  const iVeh   = col('VehicleSheet');
  const iScope = col('ItemScope');
  const iItems = col('ItemsJson');
  const iRem   = col('Remark');
  const iStatus= col('Status');
  const iAt    = col('ReceiverDecisionAt');
  const iBy    = col('ReceiverDecisionBy');
  const iNote  = col('ReceiverDecisionNote');

  if(iId < 0) throw new Error('ไม่พบคอลัมน์ Id ใน HandoverLog');

  const row = values.slice(1).find(r => String(r[iId])===String(id));
  if(!row) throw new Error('ไม่พบรายการที่ต้องการ');

  let items = hoParseJson_(iItems>=0 ? row[iItems] : '[]', []);
  items = (items||[]).map(it=>{
    const haveQty = Number(it.haveQty ?? it.qty ?? 0) || 0;
    const actualQty = Number(it.actualQty ?? it.qty ?? haveQty) || 0;
    const missingQty = Number(it.missingQty ?? Math.max(0, haveQty - actualQty)) || 0;
    const has = (typeof it.has === 'boolean') ? it.has : missingQty <= 0;
    return Object.assign({}, it, {
      type: hoNorm_(it.type || 'เครื่องมือ/พัสดุ'),
      haveQty, actualQty, missingQty, has, note: it.note||''
    });
  });

  const statusRaw = iStatus>=0 ? hoNorm_(row[iStatus]) : '';
  return {
    id: row[iId],
    ts: row[iTs],
    checkDateISO: (iISO>=0 ? hoToISODate_(row[iISO]) : ''),
    beYear: Number(iBE>=0 ? row[iBE] : 0),
    month: Number(iM>=0 ? row[iM] : 0),
    day: Number(iD>=0 ? row[iD] : 0),
    giver: iG>=0 ? (row[iG]||'') : '',
    receiver: iR>=0 ? (row[iR]||'') : '',
    vehicle: iVeh>=0 ? (row[iVeh]||'') : '',
    itemScope: iScope>=0 ? (row[iScope]||'') : '',
    items,
    remark: iRem>=0 ? (row[iRem]||'') : '',
    status: statusRaw || HO_STATUS_ACCEPTED,
    receiverDecisionAt: iAt>=0 ? row[iAt] : '',
    receiverDecisionBy: iBy>=0 ? row[iBy] : '',
    receiverDecisionNote: iNote>=0 ? row[iNote] : ''
  };
}

function hoGetHandoverForView(token, handoverId){
  hoRequireMainAuth_();
  requireAuth_(token);
  return hoGetHandoverById_(handoverId);
}

/***** PDF HELPERS *****/
function hoGetLogoBlob_(){
  try{ return DriveApp.getFileById(HO_LOGO_FILE_ID).getBlob(); }
  catch(e){ return null; }
}
function hoTightenPara_(p){
  try{ p.setSpacingBefore(0).setSpacingAfter(0).setLineSpacing(1.0); }catch(e){}
  return p;
}
function hoSetCellStyle_(cell, fontSize, bold){
  try{
    const t = cell.editAsText();
    t.setFontFamily('TH Sarabun New').setFontSize(fontSize);
    if(bold) t.setBold(true);
  }catch(e){}
}
function hoDocA4Compact_(doc){
  const body = doc.getBody();
  body.setMarginTop(18).setMarginBottom(18).setMarginLeft(18).setMarginRight(18);
  return body;
}
function hoApplyTableLayout_(table){

  // [ลำดับ, รายการ, หน่วย, มาตรฐาน, มี, มีจริง, สถานะ, หมายเหตุ]

  // ปรับใหม่:
  // - ลดคอลัมน์ "รายการ"
  // - เพิ่มคอลัมน์ "หมายเหตุ"
  // - ตารางไม่ล้น A4

  const W = [30, 220, 34, 40, 50, 50, 42, 100];

  try{
    const rows = table.getNumRows();

    for(let r=0; r<rows; r++){

      const row = table.getRow(r);
      const n = row.getNumCells();

      for(let c=0; c<Math.min(W.length, n); c++){

        const cell = row.getCell(c);

        cell.setWidth(W[c]);

        try{
          cell.setPaddingTop(1);
          cell.setPaddingBottom(1);
          cell.setPaddingLeft(2);
          cell.setPaddingRight(2);
        }catch(e){}

      }
    }

  }catch(e){}
}

function hoAppendSignatureBlock_(body, data, acceptedOnly){
  const accepted = data.status === HO_STATUS_ACCEPTED;

  hoTightenPara_(body.appendParagraph(' ')).setSpacingAfter(2);

  if(acceptedOnly && !accepted){
    hoTightenPara_(body.appendParagraph('หมายเหตุ: เอกสารนี้ยังไม่สมบูรณ์ เนื่องจากผู้รับมอบยังไม่ได้กดยอมรับในระบบ'))
      .setFontFamily('TH Sarabun New').setFontSize(10).setBold(true).setForegroundColor('#B42318');
    return;
  }

  const giverNameClean = hoStripTitle_(data.giver);
  const receiverNameClean = hoStripTitle_(data.receiver);

  const sig = body.appendTable([
    [`ลงชื่อ ${giverNameClean} ผู้มอบ`, `ลงชื่อ ${receiverNameClean} ผู้รับมอบ`],
    [`( ${giverNameClean} )`, `( ${receiverNameClean} )`],
    ['ผู้มอบ', 'ผู้รับมอบ']
  ]);
  sig.setBorderWidth(0);

  for(let r=0; r<sig.getNumRows(); r++){
    const row = sig.getRow(r);
    for(let c=0; c<row.getNumCells(); c++){
      const cell = row.getCell(c);
      hoSetCellStyle_(cell, r===0 ? 10 : 9, r===0);
      try{
        cell.getParagraphs().forEach(p=>{
          hoTightenPara_(p);
          p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
        });
      }catch(e){}
    }
  }

  if(data.receiverDecisionAt){
    const at = data.receiverDecisionAt instanceof Date
      ? Utilities.formatDate(data.receiverDecisionAt, HO_TZ, 'dd/MM/yyyy HH:mm:ss')
      : String(data.receiverDecisionAt);
    hoTightenPara_(body.appendParagraph(`ผู้รับมอบกดยอมรับผ่านระบบเมื่อ: ${at}`))
      .setFontFamily('TH Sarabun New').setFontSize(8);
  }
}

/***** EXPORT PDF: single record *****/
function hoExportHandoverPdf(token, handoverId){
  hoRequireMainAuth_();
  requireAuth_(token);
  const data = hoGetHandoverById_(handoverId);

  if(data.status !== HO_STATUS_ACCEPTED){
    throw new Error('ยังไม่สามารถออก PDF ลงนามได้ เนื่องจากผู้รับมอบยังไม่ได้กดยอมรับ');
  }

  const docName = `ใบส่งมอบ-รับมอบ_${data.vehicle}_${data.day}-${data.month}-${data.beYear}_${data.giver}_to_${data.receiver}`;
  const doc = DocumentApp.create(docName);
  const body = hoDocA4Compact_(doc);

  const headerTable = body.appendTable([['','']]);
  headerTable.setBorderWidth(0);

  const logoBlob = hoGetLogoBlob_();
  if(logoBlob){
    const img = headerTable.getCell(0,0).appendImage(logoBlob);
    img.setWidth(120); try{ img.setHeight(92); }catch(e){}
  }

  const ht = headerTable.getCell(0,1);
  hoTightenPara_(ht.appendParagraph('ใบส่งมอบ-รับมอบรายการเครื่องมือ/พัสดุ (Standby)'))
    .setBold(true).setFontFamily('TH Sarabun New').setFontSize(14);
  hoTightenPara_(ht.appendParagraph('การไฟฟ้าส่วนภูมิภาค (PEA) • สาขาพระแสง'))
    .setFontFamily('TH Sarabun New').setFontSize(10);
  hoTightenPara_(ht.appendParagraph(`รถ: ${data.vehicle || '-'}`))
    .setFontFamily('TH Sarabun New').setFontSize(10).setBold(true);
  hoTightenPara_(ht.appendParagraph(`ประเภท: ${data.itemScope || 'เครื่องมือและพัสดุ'}`))
    .setFontFamily('TH Sarabun New').setFontSize(9);
  hoTightenPara_(ht.appendParagraph(`วันที่ตรวจสอบ: ${hoPad2_(data.day)}/${hoPad2_(data.month)}/${data.beYear}`))
    .setFontFamily('TH Sarabun New').setFontSize(9);

  const timeStr = data.ts ? Utilities.formatDate(new Date(data.ts), HO_TZ, 'HH:mm:ss') : '-';
  hoTightenPara_(body.appendParagraph(`เวลา: ${timeStr}  •  ผู้มอบ: ${data.giver}  •  ผู้รับมอบ: ${data.receiver}`))
    .setFontFamily('TH Sarabun New').setFontSize(9);

  const table = body.appendTable();
  const header = table.appendTableRow();
  ['ลำดับ','รายการ','หน่วย','มาตรฐาน','จำนวนที่มี','จำนวนจริง','สถานะ','หมายเหตุ'].forEach(t=>{
    const c = header.appendTableCell(t);
    c.setBackgroundColor('#F3ECFF');
    hoSetCellStyle_(c, 8, true);
    try{ c.getParagraphs().forEach(hoTightenPara_); }catch(e){}
  });

  let prob = 0;
  (data.items||[]).forEach(it=>{
    const tr = table.appendTableRow();
    const isProb = (it.has === false) || Number(it.missingQty||0) > 0;
    if(isProb) prob++;
    const hasText = isProb ? 'ไม่ครบ' : 'ครบ';

    const cells = [
      String(it.seq||''),
      String(it.name||''),
      String(it.unit||''),
      String(it.stdQty||''),
      String(it.haveQty ?? ''),
      String(it.actualQty ?? ''),
      hasText,
      String(it.note||'')
    ].map(v => tr.appendTableCell(v));

    cells.forEach(c=>{
      hoSetCellStyle_(c, 8, false);
      try{ c.getParagraphs().forEach(hoTightenPara_); }catch(e){}
    });

    if(isProb){
      cells[6].setForegroundColor('#B42318');
      try{ cells[6].editAsText().setBold(true); }catch(e){}
    }
  });

  hoApplyTableLayout_(table);

  hoTightenPara_(body.appendParagraph(`สรุป: รายการทั้งหมด ${data.items.length} รายการ / รายการไม่ครบ ${prob} รายการ`))
    .setBold(true).setFontFamily('TH Sarabun New').setFontSize(10);

  if(data.remark){
    hoTightenPara_(body.appendParagraph(`หมายเหตุเพิ่มเติม: ${data.remark}`))
      .setFontFamily('TH Sarabun New').setFontSize(9);
  }
  if(data.receiverDecisionNote){
    hoTightenPara_(body.appendParagraph(`หมายเหตุจากผู้รับมอบ: ${data.receiverDecisionNote}`))
      .setFontFamily('TH Sarabun New').setFontSize(9);
  }

  hoAppendSignatureBlock_(body, data, true);

  doc.saveAndClose();

  const file = DriveApp.getFileById(doc.getId());
  const pdfBlob = file.getAs(MimeType.PDF);
  const pdfFile = DriveApp.createFile(pdfBlob).setName(docName + '.pdf');

  return { ok:true, url: pdfFile.getUrl(), docUrl: file.getUrl(), id: data.id };
}

/***** EXPORT PDF: daily by vehicle; includes only ACCEPTED records *****/
function hoExportDailyHandoverPdfByVehicle(token, beYear, month, day, vehicleSheet){
  hoRequireMainAuth_();
  requireAuth_(token);

  const BE = Number(beYear)||0;
  const M  = Number(month)||0;
  const D  = Number(day)||0;
  if(!BE || !M || !D) throw new Error('วัน/เดือน/ปี ไม่ครบ');

  const vehName = hoNorm_(vehicleSheet);
  if(!vehName) throw new Error('กรุณาเลือก "รถ"');

  const listAll = hoListHandoversByDay(token, BE, M, D, vehName);
  const list = listAll.filter(x => x.status === HO_STATUS_ACCEPTED);

  const docName = `สรุปใบส่งมอบ-รับมอบ_รายวัน_${hoPad2_(D)}-${hoPad2_(M)}-${BE}_(${vehName})`;
  const doc = DocumentApp.create(docName);
  const body = hoDocA4Compact_(doc);

  const headerTable = body.appendTable([['','']]);
  headerTable.setBorderWidth(0);

  const logoBlob = hoGetLogoBlob_();
  if(logoBlob){
    const img = headerTable.getCell(0,0).appendImage(logoBlob);
    img.setWidth(120); try{ img.setHeight(92); }catch(e){}
  }

  const ht = headerTable.getCell(0,1);
  hoTightenPara_(ht.appendParagraph('สรุปใบส่งมอบ-รับมอบรายการเครื่องมือ/พัสดุ (Standby) – รายวัน'))
    .setBold(true).setFontFamily('TH Sarabun New').setFontSize(14);
  hoTightenPara_(ht.appendParagraph(`รถ: ${vehName}`))
    .setFontFamily('TH Sarabun New').setFontSize(10);
  hoTightenPara_(ht.appendParagraph(`วันที่: ${hoPad2_(D)}/${hoPad2_(M)}/${BE}`))
    .setFontFamily('TH Sarabun New').setFontSize(10);
  hoTightenPara_(ht.appendParagraph('หมายเหตุ: รายงานนี้แสดงเฉพาะรายการที่ผู้รับมอบกดยอมรับแล้ว'))
    .setFontFamily('TH Sarabun New').setFontSize(9).setForegroundColor('#5B21B6');

  if(!list.length){
    hoTightenPara_(body.appendParagraph('ไม่พบรายการที่ผู้รับมอบกดยอมรับแล้วในวันที่เลือก สำหรับรถคันนี้'))
      .setFontFamily('TH Sarabun New').setFontSize(10);
    doc.saveAndClose();

    const file = DriveApp.getFileById(doc.getId());
    const pdfFile = DriveApp.createFile(file.getAs(MimeType.PDF)).setName(docName + '.pdf');
    return { ok:true, url: pdfFile.getUrl(), docUrl: file.getUrl(), count:0, skipped:listAll.length };
  }

  list.forEach((x, idx)=>{
    const data = hoGetHandoverById_(x.id);
    if(idx > 0) body.appendPageBreak();

    hoTightenPara_(body.appendParagraph(`รายการที่ ${idx+1}: ${data.giver} → ${data.receiver}`))
      .setBold(true).setFontFamily('TH Sarabun New').setFontSize(11);

    const table = body.appendTable();
    const header = table.appendTableRow();
    ['ลำดับ','รายการ','หน่วย','มาตรฐาน','จำนวนที่มี','จำนวนจริง','สถานะ','หมายเหตุ'].forEach(t=>{
      const c = header.appendTableCell(t);
      c.setBackgroundColor('#F3ECFF');
      hoSetCellStyle_(c, 8, true);
      try{ c.getParagraphs().forEach(hoTightenPara_); }catch(e){}
    });

    (data.items||[]).forEach(it=>{
      const tr = table.appendTableRow();
      const isProb = (it.has === false) || Number(it.missingQty||0) > 0;
      const hasText = isProb ? 'ไม่ครบ' : 'ครบ';

      const cells = [
        String(it.seq||''),
        String(it.name||''),
        String(it.unit||''),
        String(it.stdQty||''),
        String(it.haveQty ?? ''),
        String(it.actualQty ?? ''),
        hasText,
        String(it.note||'')
      ].map(v => tr.appendTableCell(v));

      cells.forEach(c=>{
        hoSetCellStyle_(c, 8, false);
        try{ c.getParagraphs().forEach(hoTightenPara_); }catch(e){}
      });
    });

    hoApplyTableLayout_(table);

    hoTightenPara_(body.appendParagraph(`สรุป: รายการทั้งหมด ${data.items.length} รายการ / ไม่ครบ ${data.items.filter(it => !it.has || Number(it.missingQty||0)>0).length} รายการ`))
      .setBold(true).setFontFamily('TH Sarabun New').setFontSize(9);

    if(data.remark){
      hoTightenPara_(body.appendParagraph(`หมายเหตุรวม: ${data.remark}`))
        .setFontFamily('TH Sarabun New').setFontSize(9);
    }
    if(data.receiverDecisionNote){
      hoTightenPara_(body.appendParagraph(`หมายเหตุผู้รับมอบ: ${data.receiverDecisionNote}`))
        .setFontFamily('TH Sarabun New').setFontSize(9);
    }

    hoAppendSignatureBlock_(body, data, true);
  });

  doc.saveAndClose();

  const file = DriveApp.getFileById(doc.getId());
  const pdfFile = DriveApp.createFile(file.getAs(MimeType.PDF)).setName(docName + '.pdf');

  return { ok:true, url: pdfFile.getUrl(), docUrl: file.getUrl(), count:list.length, skipped:listAll.length - list.length };
}

/***** OPTIONAL SETUP *****/
function hoSetupSheets(){
  hoEnsureAllSheets_();
  return {ok:true, message:'ตั้งค่า Handover sheets แล้ว'};
}
function hoPersonKey_(s){
  return String(s || '')
    .replace(/^(นาย|นางสาว|นาง)\s*/,'')
    .replace(/\s+/g,'')
    .trim()
    .toLowerCase();
}

function hoListPendingReceiver(token){
  hoRequireMainAuth_();
  const u = requireAuth_(token);
  const me = hoPersonKey_(u.personName);
  if(!me) throw new Error('บัญชีนี้ยังไม่ผูก PersonName');

  const sh = hoGetLogSheet_();
  const values = sh.getDataRange().getValues();
  if(values.length < 2) return [];

  const head = values[0].map(hoNorm_);
  const col = name => head.indexOf(name);

  const iId       = col('Id');
  const iDate     = col('CheckDateISO');
  const iBE       = col('DateBE');
  const iMonth    = col('Month');
  const iDay      = col('Day');
  const iGiver    = col('GiverName');
  const iReceiver = col('ReceiverName');
  const iVehicle  = col('VehicleSheet');
  const iScope    = col('ItemScope');
  const iTotal    = col('TotalItems');
  const iMissing  = col('MissingCount');
  const iItems    = col('ItemsJson');
  const iRemark   = col('Remark');
  const iStatus   = col('Status');

  if(iStatus < 0) throw new Error('ไม่พบคอลัมน์ Status ใน HandoverLog');
  if(iId < 0) throw new Error('ไม่พบคอลัมน์ Id ใน HandoverLog');
  if(iItems < 0) throw new Error('ไม่พบคอลัมน์ ItemsJson ใน HandoverLog');

  return values.slice(1)
    .filter(r => {
      const status = String(r[iStatus] || '').trim().toUpperCase();
      const receiver = hoPersonKey_(r[iReceiver]);
      return status === 'PENDING_RECEIVER' && receiver === me;
    })
    .map(r => {
      const items = hoParseJson_(r[iItems], []);
      return {
        id: String(r[iId] || '').trim(),
        checkDateISO: hoToISODate_(r[iDate]),
        beYear: Number(r[iBE] || 0),
        month: Number(r[iMonth] || 0),
        day: Number(r[iDay] || 0),
        giver: r[iGiver] || '',
        receiver: r[iReceiver] || '',
        vehicle: r[iVehicle] || '',
        itemScope: r[iScope] || 'เครื่องมือและพัสดุ',
        totalItems: Number(r[iTotal] || items.length || 0),
        missingCount: Number(r[iMissing] || 0),
        remark: iRemark >= 0 ? r[iRemark] || '' : '',
        status: r[iStatus] || '',
        items: Array.isArray(items) ? items : []
      };
    });
}
function hoGetDashboardSummary(token){
  hoRequireMainAuth_();
  requireAuth_(token);

  const sh = hoGetLogSheet_();
  const values = sh.getDataRange().getValues();
  if(values.length < 2) return { vehicles: [] };

  const head = values[0].map(hoNorm_);
  const col = k => head.indexOf(k);

  const iTs      = col('Timestamp');
  const iDate    = col('CheckDateISO');
  const iVehicle = col('VehicleSheet');
  const iItems   = col('ItemsJson');
  const iStatus  = col('Status');

  if(iVehicle < 0 || iItems < 0) {
    throw new Error('ไม่พบคอลัมน์ VehicleSheet หรือ ItemsJson ใน HandoverLog');
  }

  const latestByVehicle = {};

  for(let r = 1; r < values.length; r++){
    const row = values[r];

    const vehicle = hoNorm_(row[iVehicle]);
    const status = iStatus >= 0 ? hoNorm_(row[iStatus]).toUpperCase() : '';
    const itemsText = String(row[iItems] || '').trim();

    if(!vehicle || !itemsText) continue;
    if(status !== HO_STATUS_ACCEPTED) continue;

    let items = [];
    try {
      items = JSON.parse(itemsText);
    } catch(e) {
      continue;
    }

    if(!Array.isArray(items) || !items.length) continue;

    const tsVal = iTs >= 0 ? row[iTs] : '';
    const dateVal = iDate >= 0 ? row[iDate] : '';

    const ts = tsVal instanceof Date
      ? tsVal.getTime()
      : new Date(tsVal || dateVal).getTime();

    const safeTs = isNaN(ts) ? 0 : ts;

    if(!latestByVehicle[vehicle] || safeTs > latestByVehicle[vehicle].ts){
      latestByVehicle[vehicle] = {
        vehicle,
        ts: safeTs,
        checkDateISO: iDate >= 0 ? hoToISODate_(row[iDate]) : '',
        items
      };
    }
  }

  const vehicles = Object.values(latestByVehicle).map(v => {
    let totalStd = 0;
    let totalActual = 0;

    const missingItems = [];

    v.items.forEach(it => {
      const name = hoNorm_(it.name);
      const unit = hoNorm_(it.unit);
      const stdQty = Number(it.stdQty || it.haveQty || 0) || 0;
      const actualQty = Number(it.actualQty || 0) || 0;
      const missingQty = Number(
        it.missingQty != null ? it.missingQty : Math.max(0, stdQty - actualQty)
      ) || 0;

      totalStd += stdQty;
      totalActual += Math.min(actualQty, stdQty);

      if(missingQty > 0){
        missingItems.push({
          name,
          unit,
          missingQty
        });
      }
    });

    const percent = totalStd > 0
      ? Math.round((totalActual / totalStd) * 1000) / 10
      : 0;

    missingItems.sort((a,b) => b.missingQty - a.missingQty);

    return {
      vehicle: v.vehicle,
      vehicleDisplay: v.vehicle.replace(/^รายการ[:：\-–—\s]*/, ''),
      checkDateISO: v.checkDateISO,
      percent,
      totalStd,
      totalActual,
      totalMissing: Math.max(0, totalStd - totalActual),
      topMissing: missingItems.slice(0, 5)
    };
  });

  vehicles.sort((a,b) => a.percent - b.percent);

  return { vehicles };
}

