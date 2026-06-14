/***************************************
 * map.gs — Outage Map + Emergency Alert
 ***************************************/

const MAP_DEVICE_SHEET = 'Device';
const MAP_ATTENDANCE_SHEET = 'Attendance';
const MAP_OUTAGE_MEMORY_SHEET = 'OutageMemory';
const MAP_MEMORY_LIMIT_PER_DEVICE = 10;

const MAP_WEBEX_TOKEN_PROP = 'MAP_WEBEX_BOT_TOKEN';
const MAP_WEBEX_ROOM_PROP  = 'MAP_WEBEX_ROOM_ID';

const GEMINI_API_KEY_PROP = 'GEMINI_API_KEY';
const GEMINI_MODEL = 'gemini-2.5-flash';
//const GEMINI_MODEL = 'gemini-1.5-flash';
function setGeminiApiKeyOnce(apiKey){
  if(!apiKey) throw new Error('กรุณาระบุ Gemini API Key');

  PropertiesService.getScriptProperties().setProperty(
    GEMINI_API_KEY_PROP,
    apiKey
  );

  return 'บันทึก Gemini API Key เรียบร้อยแล้ว';
}

function setupMyGeminiOnce(){
  throw new Error('โปรดเรียก setGeminiApiKeyOnce(apiKey) จาก Apps Script Editor โดยไม่ hardcode key ใน source code');
}

function mapCallGemini_(prompt){
  const apiKey = PropertiesService.getScriptProperties()
    .getProperty(GEMINI_API_KEY_PROP);

  if(!apiKey) throw new Error('ยังไม่ได้ตั้งค่า Gemini API Key');

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    GEMINI_MODEL +
    ':generateContent?key=' +
    encodeURIComponent(apiKey);

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.25,
      maxOutputTokens: 4000,
      stopSequences: ['จบการวิเคราะห์']
    }
  };

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  const text = res.getContentText();

  if(code < 200 || code >= 300){
    throw new Error('เรียก Gemini ไม่สำเร็จ: HTTP ' + code + ' / ' + text);
  }

  const json = JSON.parse(text);
  return json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function mapReadOutageMemory_(deviceCodes){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(MAP_OUTAGE_MEMORY_SHEET);
  if(!sh) return {};

  const lastRow = sh.getLastRow();
  if(lastRow < 2) return {};

  const values = sh.getRange(1, 1, lastRow, sh.getLastColumn()).getValues();
  const head = values[0].map(h => String(h || '').trim());

  const idx = (name, fallback) => {
    const i = head.indexOf(name);
    return i >= 0 ? i : fallback;
  };

  const COL_TS          = idx('TimestampServer', 0);
  const COL_BE          = idx('BE', 1);
  const COL_MONTH       = idx('Month', 2);
  const COL_DAY         = idx('Day', 3);
  const COL_SHIFT       = idx('Shift', 4);
  const COL_LEADER      = idx('Leader', 5);
  const COL_DEVICE      = idx('Device', 6);
  const COL_LOCATION    = idx('Location', 7);
  const COL_VOLTAGE     = idx('VoltageLevel', 8);
  const COL_MINUTES     = idx('Minutes', 9);
  const COL_CAUSE       = idx('Cause', 10);
  const COL_CAUSE_NOTE  = idx('CauseNote', 11);
  const COL_HV          = idx('OutageHV', 12);
  const COL_LV          = idx('OutageLV', 13);
  const COL_LAT         = idx('Lat', 14);
  const COL_LNG         = idx('Lng', 15);
  const COL_PHOTO       = idx('PhotoUrl', 16);

  const wanted = new Set((deviceCodes || []).map(c => mapNormalize_(c).toUpperCase()));
  const memory = {};

  for(let i = 1; i < values.length; i++){
    const r = values[i];
    const code = mapNormalize_(r[COL_DEVICE]).toUpperCase();
    if(!code) continue;
    if(wanted.size && !wanted.has(code)) continue;

    if(!memory[code]) memory[code] = [];

    memory[code].push({
      timestamp: r[COL_TS] instanceof Date
        ? Utilities.formatDate(r[COL_TS], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
        : String(r[COL_TS] || ''),
      date: `${r[COL_DAY] || ''}/${r[COL_MONTH] || ''}/${r[COL_BE] || ''}`,
      beYear: Number(r[COL_BE] || 0),
      month: Number(r[COL_MONTH] || 0),
      day: Number(r[COL_DAY] || 0),
      shift: String(r[COL_SHIFT] || ''),
      leader: mapNormalize_(r[COL_LEADER]),
      device: code,
      location: mapNormalize_(r[COL_LOCATION]),
      voltageLevel: mapNormalize_(r[COL_VOLTAGE]),
      minutes: Number(r[COL_MINUTES] || 0),
      cause: mapNormalize_(r[COL_CAUSE]),
      causeNote: mapNormalize_(r[COL_CAUSE_NOTE]),
      outageHV: Number(r[COL_HV] || 0),
      outageLV: Number(r[COL_LV] || 0),
      lat: r[COL_LAT],
      lng: r[COL_LNG],
      photoUrl: String(r[COL_PHOTO] || '')
    });
  }

  Object.keys(memory).forEach(code => {
    memory[code] = memory[code]
      .sort((a,b) => {
        const da = new Date(Number(a.beYear || 0) - 543, Number(a.month || 1) - 1, Number(a.day || 1)).getTime();
        const db = new Date(Number(b.beYear || 0) - 543, Number(b.month || 1) - 1, Number(b.day || 1)).getTime();
        return db - da;
      })
      .slice(0, MAP_MEMORY_LIMIT_PER_DEVICE);
  });

  return memory;
}

function mapBuildGeminiOutagePrompt_(emergency){
  const deviceCodes = emergency.map(p => p.code).filter(Boolean);
  const memoryMap = mapReadOutageMemory_(deviceCodes);

  const data = emergency.map(p => ({
    code: p.code,
    location: p.location || p.place || '',
    count7d: p.count7d || 0,
    countMonth: p.count || 0,
    totalMinutes: p.totalMinutes || 0,
    causes: p.causes || [],
    lastDate: p.lastDate || '',
    events: (p.events || []).slice(-5).map(e => ({
      date: `${e.day}/${e.month}/${e.beYear}`,
      shift: e.shift,
      site: e.site,
      cause: e.cause || '',
      minutes: e.minutes || 0,
      hv: e.hv || 0,
      lv: e.lv || 0
    })),
    memoryFromOutageMemory: memoryMap[p.code] || []
  }));

  return `
คุณคือวิศวกรไฟฟ้าผู้ช่วยวิเคราะห์เหตุไฟฟ้าขัดข้องของระบบจำหน่ายไฟฟ้าแรงสูง/แรงต่ำ เพื่อมุ่งเน้นการแก้ปัญหาไฟฟ้าขัดข้องให้ ผู้ใช้ไฟฟ้า
ให้วิเคราะห์จากข้อมูลจริงด้านล่างเท่านั้น ห้ามเดาข้อมูลที่ไม่มี

ข้อมูลหลัก คือ เหตุขัดข้องซ้ำจากระบบปัจจุบัน
ข้อมูล memoryFromOutageMemory คือ ความจำจากเหตุขัดข้องที่เคยบันทึกไว้ในชีต OutageMemory
ให้นำความจำนี้มาช่วยดูแนวโน้ม เช่น สาเหตุซ้ำ จุดเดิม อุปกรณ์เดิม หรือสภาพอากาศเดิม
แต่ห้ามสรุปเกินกว่าข้อมูลที่มี

เป้าหมาย:
1. สรุปอุปกรณ์ที่ควรเร่งตรวจสอบ
2. วิเคราะห์สาเหตุที่เป็นไปได้จากข้อมูลปัจจุบันและความจำย้อนหลัง
3. เสนอแนวทางตรวจสอบ ภาคสนามแบบสั้น กระชับ ใช้งานได้จริง
4. ถ้าข้อมูลสาเหตุไม่พอ ให้ระบุว่า "ข้อมูลสาเหตุยังไม่เพียงพอ"

รูปแบบคำตอบ:
ให้ตอบครบทุกอุปกรณ์ในข้อมูล
ห้ามใช้ markdown หนา ตัวเอียง หรือ bullet ซ้อน
ห้ามตัดคำตอบกลางประโยค
ให้ตอบรูปแบบนี้เท่านั้น

วิเคราะห์ AI:
1. รหัสอุปกรณ์: ...
   สรุป: ...
   สาเหตุที่พบจากข้อมูล: ...
   ความจำจาก OutageMemory: ...
   ความเห็น AI: ...
   แนวทางตรวจสอบ: ...

2. รหัสอุปกรณ์: ...
   สรุป: ...
   สาเหตุที่พบจากข้อมูล: ...
   ความจำจาก OutageMemory: ...
   ความเห็น AI: ...
   แนวทางตรวจสอบ: ...

เมื่อวิเคราะห์ครบแล้ว ให้ปิดท้ายด้วยคำว่า:
จบการวิเคราะห์

ข้อมูลเหตุขัดข้องซ้ำพร้อมความจำย้อนหลัง:
${JSON.stringify(data, null, 2)}
`;
}

function testGeminiOutageAnalysis(){
  const now = new Date();
  const beYear = now.getFullYear() + 543;
  const month = now.getMonth() + 1;

  const raw = mapReadOutageRaw_(beYear, month);
  const points = mapAggregate_(raw.rows);
  const emergency = points.filter(p => p.isEmergency);

  if(!emergency.length){
    return 'ไม่พบอุปกรณ์ที่เกิดเหตุซ้ำในรอบ 7 วัน';
  }

  const prompt = mapBuildGeminiOutagePrompt_(emergency);
  return mapCallGemini_(prompt);
}

function setupMyGeminiOnce(){
  throw new Error('โปรดเรียก setGeminiApiKeyOnce(apiKey) จาก Apps Script Editor โดยไม่ hardcode key ใน source code');
}

function mapNormalize_(s){
  return String(s || '').replace(/\u00A0/g,' ').replace(/\s+/g,' ').trim();
}

function mapExtractDeviceCode_(text){
  const s = mapNormalize_(text).toUpperCase();
  const m = s.match(/[A-Z]{2,}[A-Z0-9]*[-]?[0-9]{2,}(?:[-]?[0-9]+)?/);
  if(!m) return '';

  let code = m[0];
  const q = code.match(/^(QSA\d{2}WF)-?(\d+)$/);
  if(q) code = q[1] + '-' + q[2];

  return code;
}

function mapGetCause_(item){
  const direct = mapNormalize_(
    item.cause ||
    item.reason ||
    item.remark ||
    item.note ||
    item.problem ||
    item.detail ||
    item.causeText ||
    ''
  );

  if(direct) return direct;

  const site = mapNormalize_(item.site);

  const m = site.match(/สาเหตุ\s*[:：]?\s*(.+)$/i);
  if(m && m[1]) return mapNormalize_(m[1]);

  if(site.includes('ไม่พบสาเหตุ')) return 'ไม่พบสาเหตุ';

  return '';
}

function mapBuildDeviceIndex_(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(MAP_DEVICE_SHEET);
  if(!sh) throw new Error('ไม่พบชีต Device');

  const last = sh.getLastRow();
  if(last < 2) return {};

  const values = sh.getRange(2, 1, last - 1, 5).getValues();
  const index = {};

  values.forEach(r => {
    const code = mapNormalize_(r[0]).toUpperCase();
    const place = mapNormalize_(r[1]);
    const location = mapNormalize_(r[2]);
    const lat = Number(r[3]);
    const lng = Number(r[4]);

    if(!code || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

    index[code] = {
      code,
      place,
      location: location || `${code} ${place}`,
      lat,
      lng
    };
  });

  return index;
}

function mapBuildDate_(beYear, month, day){
  const ce = Number(beYear) - 543;
  return new Date(ce, Number(month) - 1, Number(day), 12, 0, 0);
}

function mapReadOutageRaw_(beYear, month){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(MAP_ATTENDANCE_SHEET);
  if(!sh) throw new Error('ไม่พบชีต Attendance');

  const lastRow = sh.getLastRow();
  if(lastRow < 2) return { rows: [], unmatched: [] };

  const values = sh.getRange(1, 1, lastRow, sh.getLastColumn()).getValues();
  const head = values[0].map(h => String(h || '').trim());

  const idx = (name, fallback) => {
    const i = head.indexOf(name);
    return i >= 0 ? i : fallback;
  };

  const COL_TS     = idx('TimestampServer', 0);
  const COL_BE     = idx('BE', 1);
  const COL_MONTH  = idx('Month', 2);
  const COL_DAY    = idx('Day', 3);
  const COL_SHIFT  = idx('Shift', 4);
  const COL_ACTION = idx('Action', 5);
  const COL_NAME   = idx('Name', 6);
  const COL_HV     = idx('OutageHV', 13);
  const COL_LV     = idx('OutageLV', 14);
  const COL_JSON   = idx('OutageJson', 15);

  const deviceIndex = mapBuildDeviceIndex_();
  const rows = [];
  const unmatched = [];

  for(let i = 1; i < values.length; i++){
    const r = values[i];

    const rowBE = Number(r[COL_BE]);
    const rowMonth = Number(r[COL_MONTH]);
    const rowDay = Number(r[COL_DAY]);
    const action = String(r[COL_ACTION] || '').trim().toUpperCase();

    if(rowBE !== Number(beYear)) continue;
    if(month && rowMonth !== Number(month)) continue;
    if(action !== 'OUT') continue;

    const jsonText = String(r[COL_JSON] || '').trim();
    if(!jsonText) continue;

    let items = [];
    try{
      const parsed = JSON.parse(jsonText);
      if(Array.isArray(parsed)) items = parsed;
    }catch(e){
      continue;
    }

    items.forEach(item => {
      const site = mapNormalize_(item.site);
      const minutes = Number(item.minutes || 0);
      const code = mapExtractDeviceCode_(site);
      const cause = mapGetCause_(item);

      if(!code) return;

      const dev = deviceIndex[code];

      const eventDate = mapBuildDate_(rowBE, rowMonth, rowDay);
      const eventRow = {
        timestamp: r[COL_TS] instanceof Date
          ? Utilities.formatDate(r[COL_TS], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
          : String(r[COL_TS] || ''),
        eventMs: eventDate.getTime(),
        beYear: rowBE,
        month: rowMonth,
        day: rowDay,
        shift: String(r[COL_SHIFT] || ''),
        name: mapNormalize_(r[COL_NAME]),
        code,
        site,
        cause,
        minutes,
        hv: Number(r[COL_HV] || 0),
        lv: Number(r[COL_LV] || 0)
      };

      if(!dev){
        unmatched.push(eventRow);
        return;
      }

      eventRow.place = dev.place;
      eventRow.location = dev.location;
      eventRow.lat = dev.lat;
      eventRow.lng = dev.lng;

      rows.push(eventRow);
    });
  }

  return { rows, unmatched };
}

function mapAggregate_(rows){
  const agg = {};

  rows.forEach(x => {
    if(!agg[x.code]){
      agg[x.code] = {
        code: x.code,
        place: x.place,
        location: x.location,
        lat: x.lat,
        lng: x.lng,
        count: 0,
        count7d: 0,
        isEmergency: false,
        totalMinutes: 0,
        hvCount: 0,
        lvCount: 0,
        lastDate: '',
        causes: [],
        events: []
      };
    }

    const a = agg[x.code];
    a.count += 1;
    a.totalMinutes += Number.isFinite(x.minutes) ? x.minutes : 0;
    a.hvCount += Number(x.hv || 0);
    a.lvCount += Number(x.lv || 0);
    a.lastDate = `${x.day}/${x.month}/${x.beYear}`;
    a.events.push(x);

    if(x.cause && !a.causes.includes(x.cause)) a.causes.push(x.cause);
  });

  const now = new Date();
  const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0).getTime();

  Object.values(agg).forEach(a => {
    a.count7d = a.events.filter(e => Number(e.eventMs || 0) >= since).length;
    a.isEmergency = a.count7d > 1;
  });

  return Object.values(agg).sort((a,b) => {
    if(b.isEmergency !== a.isEmergency) return Number(b.isEmergency) - Number(a.isEmergency);
    return b.count - a.count;
  });
}

function getOutageMapData(token, filter){
  ensureLogged_(token);

  filter = filter || {};
  const now = new Date();
  const beYear = Number(filter.beYear || BE_YEAR || now.getFullYear() + 543);

  // ✅ สำคัญ: ต้องรองรับ month = 0 คือ "ทั้งปี"
  let month;
  if(filter.month === 0 || filter.month === '0'){
    month = 0;
  }else if(filter.month === undefined || filter.month === null || filter.month === ''){
    month = now.getMonth() + 1;
  }else{
    month = Number(filter.month);
  }

  const raw = mapReadOutageRaw_(beYear, month);
  const points = mapAggregate_(raw.rows);
  const emergencyPoints = points.filter(p => p.isEmergency);

  return {
    ok: true,
    beYear,
    month,
    points,
    emergencyPoints,
    rows: raw.rows,
    totalEvents: raw.rows.length,
    unmatched: raw.unmatched
  };
}

/**
 * ✅ ตั้งค่า Webex ครั้งเดียว
 * วิธีใช้ใน Apps Script Editor:
 * setMapWebexConfigOnce('YOUR_WEBEX_BOT_TOKEN', 'YOUR_ROOM_ID');
 */
function setMapWebexConfigOnce(webexBotToken, roomId){
  if(!webexBotToken) throw new Error('กรุณาระบุ Webex Bot Token');
  if(!roomId) throw new Error('กรุณาระบุ Webex Room ID');

  PropertiesService.getScriptProperties().setProperties({
  [MAP_WEBEX_TOKEN_PROP]: webexBotToken,
  [MAP_WEBEX_ROOM_PROP]: roomId
});

  return 'บันทึกค่า Webex เรียบร้อยแล้ว';
}

function setupMyWebexOnce(){
  setMapWebexConfigOnce(
    '',
    ''
  );
}

function mapGetWebexConfig_(){
  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty(MAP_WEBEX_TOKEN_PROP);
  const roomId = p.getProperty(MAP_WEBEX_ROOM_PROP);

  if(!token) throw new Error('ยังไม่ได้ตั้งค่า Webex Bot Token');
  if(!roomId) throw new Error('ยังไม่ได้ตั้งค่า Webex Room ID');

  return { token, roomId };
}

function mapSendWebexMarkdown_(markdown){
  const cfg = mapGetWebexConfig_();

  const res = UrlFetchApp.fetch('https://webexapis.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + cfg.token
    },
    payload: JSON.stringify({
      roomId: cfg.roomId,
      markdown
    }),
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  if(code < 200 || code >= 300){
    throw new Error('ส่ง Webex ไม่สำเร็จ: HTTP ' + code + ' / ' + res.getContentText());
  }

  return true;
}

function mapBuildEmergencyMessage_(){
  const now = new Date();
  const beYear = now.getFullYear() + 543;
  const month = now.getMonth() + 1;

  const raw = mapReadOutageRaw_(beYear, month);
  const points = mapAggregate_(raw.rows);
  const emergency = points.filter(p => p.isEmergency);

  if(!emergency.length){
    return {
      hasEmergency: false,
      markdown:
        `### ✅ รายงานจุดเฝ้าระวังไฟฟ้าขัดข้อง\n` +
        `เวลา ${Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')} น.\n` +
        `ไม่พบอุปกรณ์ที่เกิดเหตุขัดข้องมากกว่า 1 ครั้งในรอบ 7 วันที่ผ่านมา`
    };
  }

  const lines = emergency.map((p, i) => {
    const cause = p.causes && p.causes.length ? p.causes.join(', ') : 'ไม่ระบุสาเหตุ';
    return `${i + 1}. ${p.code} — ${p.location || p.place || '-'}  \n` +
           `• จำนวนในรอบ 7 วัน: ${p.count7d} ครั้ง  \n` +
           `• จำนวนทั้งเดือน: ${p.count} ครั้ง  \n` +
           `• สาเหตุ: ${cause}`;
  }).join('\n');

  let aiAnalysis = '';
  try{
    const prompt = mapBuildGeminiOutagePrompt_(emergency);

Logger.log('========== GEMINI PROMPT ==========');
Logger.log(prompt);

aiAnalysis = mapCallGemini_(prompt);

Logger.log('========== GEMINI RAW RESPONSE ==========');
Logger.log(aiAnalysis);

aiAnalysis = compactAiText_(aiAnalysis);

Logger.log('========== GEMINI CLEAN RESPONSE ==========');
Logger.log(aiAnalysis);

  }catch(err){
    aiAnalysis = 'ไม่สามารถวิเคราะห์ด้วย AI ได้ในรอบนี้: ' + err.message;
  }

  return {
    hasEmergency: true,
    markdown:
      ` 🚨 แจ้งเตือนอุปกรณ์เกิดเหตุขัดข้องซ้ำในรอบ 7 วัน\n` +
      `เวลา ${Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')} น.\n` +
      lines + `\n` +
      ` 🤖 วิเคราะห์เบื้องต้นโดย AI\n` +
      `${aiAnalysis || 'ไม่มีผลวิเคราะห์'}\n` +
      `> ขอให้ผู้เกี่ยวข้องพิจารณาเร่งตรวจสอบพื้นที่/อุปกรณ์ดังกล่าว`
  };
}

/**
 * ✅ ฟังก์ชันให้ Trigger เรียกทุกวัน 08.30 น.
 */
function sendDailyMapEmergencyAlert(){
  const msg = mapBuildEmergencyMessage_();

  // ถ้าไม่อยากให้ส่งข้อความกรณีไม่มีเหตุซ้ำ ให้ comment บรรทัดนี้
  // if(!msg.hasEmergency) return 'ไม่มีเหตุฉุกเฉิน ไม่ได้ส่ง Webex';

  mapSendWebexMarkdown_(msg.markdown);
  return 'ส่ง Webex สำเร็จ';
}

/**
 * ✅ สร้าง Trigger ทุกวัน เวลา 08.30 น. ครั้งเดียว
 * วิธีใช้ใน Apps Script Editor:
 * setupDailyMapEmergencyTrigger();
 */
function setupDailyMapEmergencyTrigger(){
  ScriptApp.getProjectTriggers().forEach(t => {
    if(t.getHandlerFunction() === 'sendDailyMapEmergencyAlert'){
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('sendDailyMapEmergencyAlert')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .nearMinute(30)
    .create();

  return 'ตั้ง Trigger แจ้งเตือน Webex ทุกวัน เวลา 08.30 น. เรียบร้อยแล้ว';
}

/**
 * ✅ ฟังก์ชันทดสอบส่ง Webex ทันที
 * วิธีใช้ใน Apps Script Editor:
 * testMapEmergencyAlertNow();
 */
function testMapEmergencyAlertNow(){
  return sendDailyMapEmergencyAlert();
}

function compactAiText_(text){

  return String(text || '')
    .replace(/\*\*/g, '')
    .replace(/#{1,6}/g, '')
    .replace(/\n{3,}/g, '\n')
    .replace(/แนวทางตรวจสอบ:/g, 'แนวทาง:')
    .replace(/ความเห็น AI:/g, 'AI:')
    .replace(/สาเหตุที่พบจากข้อมูล:/g, 'สาเหตุ:')
    .replace(/รหัสอุปกรณ์:/g, 'อุปกรณ์:')
    .trim();
}
