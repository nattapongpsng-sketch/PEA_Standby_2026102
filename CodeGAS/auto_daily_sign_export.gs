/****************************************************
 * auto_daily_sign_export.gs  (REPLACE ALL)
 * Export ใบเซ็นชื่อรายวัน (วันก่อนหน้า) เวลา 08:30 ทุกวัน
 * - ใช้ buildDailyAttendanceSummary_() + renderDailySignSheet_() จากโค้ดเดิม
 * - สร้าง Spreadsheet ชั่วคราว -> Render -> Export PDF (ผ่าน /export) -> เก็บ Drive
 * - ส่งแจ้งเตือนผ่าน sendNotify_() = Webex + LINE (ตามระบบเดิมของโปรเจกต์)
 * - ไม่กระทบโค้ดเดิม (เพิ่ม/แทนไฟล์นี้ไฟล์เดียว)
 ****************************************************/

/** ✅ ใส่ “ลิงก์โฟลเดอร์” หรือ “FolderId” ก็ได้ */
const DAILY_SIGN_PDF_FOLDER_INPUT =
  'https://drive.google.com/drive/folders/19KqQC6O2VHOqKX-ZgSzZ96uHIq8Q_0Il?usp=sharing';

const AUTO_DAILY_SIGN_CFG = {
  TZ: Session.getScriptTimeZone(),
  KEY_LAST_SENT_ISO: 'DAILY_SIGN_LAST_SENT_ISO'
};

/** ✅ ตั้ง Trigger ทุกวัน 08:30 */
function setupAutoDailySignExport_0830(){
  removeAutoDailySignExport_0830();

  ScriptApp.newTrigger('autoDailySignExportRunner_0830')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .nearMinute(30)
    .create();
}

/** ✅ ลบ Trigger (เฉพาะงานนี้) */
function removeAutoDailySignExport_0830(){
  ScriptApp.getProjectTriggers().forEach(t=>{
    if(t.getHandlerFunction() === 'autoDailySignExportRunner_0830'){
      ScriptApp.deleteTrigger(t);
    }
  });
}

/**
 * ✅ Runner (รันโดย Trigger)
 * - สร้างใบของ "วันก่อนหน้า"
 * - Export PDF
 * - ส่งลิงก์ผ่าน sendNotify_() (Webex + LINE)
 */
function autoDailySignExportRunner_0830(){
  const lock = LockService.getScriptLock();
  if(!lock.tryLock(25 * 1000)) return;

  try{
    const props = PropertiesService.getScriptProperties();

    // ---- วันที่ "เมื่อวาน" ตาม timezone สคริปต์ ----
    const now = new Date();
    const d = new Date(now);
    d.setDate(d.getDate() - 1);

    const iso = Utilities.formatDate(d, AUTO_DAILY_SIGN_CFG.TZ, 'yyyy-MM-dd');

    // กันส่งซ้ำ
    //const last = props.getProperty(AUTO_DAILY_SIGN_CFG.KEY_LAST_SENT_ISO);
    //if(last === iso) return;

    const beYear   = Number(Utilities.formatDate(d, AUTO_DAILY_SIGN_CFG.TZ, 'yyyy')) + 543;
    const monthIdx = Number(Utilities.formatDate(d, AUTO_DAILY_SIGN_CFG.TZ, 'M'));
    const dayNum   = Number(Utilities.formatDate(d, AUTO_DAILY_SIGN_CFG.TZ, 'd'));

    const file = exportDailySignPdfByDate_(beYear, monthIdx, dayNum);
    const url  = ensureShareAndGetUrl_(file);

    const msg = [
      `📄 **ใบลงนามปฏิบัติงานแก้ไฟฟ้าขัดข้องประจำวัน**`,
      `การไฟฟ้าส่วนภูมิภาค สาขาพระแสง`,
      `วันที่: **${dayNum}/${monthIdx}/${beYear}**`,
      ``,
      `🔗 ลิงก์ PDF: ${url}`
    ].join('\n');

    // ✅ ส่ง Webex + LINE ผ่านตัวกลางของโปรเจกต์
    safeSendNotify_(msg);

    props.setProperty(AUTO_DAILY_SIGN_CFG.KEY_LAST_SENT_ISO, iso);

  }catch(err){
    const emsg = `⚠️ autoDailySignExportRunner_0830 error: ${err && err.message ? err.message : err}`;
    try{ safeSendNotify_(emsg); }catch(e){}
    throw err;
  }finally{
    try{ lock.releaseLock(); }catch(e){}
  }
}

/**
 * ✅ Export ใบเซ็นชื่อรายวันเป็น PDF (แบบไม่ “กระดาษเปล่า”)
 */
function exportDailySignPdfByDate_(beYear, monthIdx, dayNum){
  // 1) สรุปจาก Attendance (ของเดิม)
  const sum = buildDailyAttendanceSummary_(beYear, monthIdx, dayNum);

  // ✅ NEW: สรุปเหตุขัดข้องจากหัวหน้าเวร (ของเดิมใน Code.gs)
  const outage = (typeof buildDailyOutageSummary_ === 'function')
    ? buildDailyOutageSummary_(beYear, monthIdx, dayNum)
    : null;

  const tz = Session.getScriptTimeZone();
  const stamp = Utilities.formatDate(new Date(), tz, 'yyyyMMdd_HHmmss');
  const tmpName = `TMP_DAILY_SIGN_${stamp}`;

  // 2) สร้าง Spreadsheet ชั่วคราว
  const tmpSS = SpreadsheetApp.create(tmpName);
  const tmpId = tmpSS.getId();
  const tmpSh = tmpSS.getSheets()[0];
  tmpSh.setName('DAILY_SIGN');

  // 3) Render ใบลงชื่อในไฟล์ชั่วคราว
  // ✅ FIX: ส่ง outage เข้าไปด้วย
  renderDailySignSheet_(tmpSh, beYear, monthIdx, dayNum, sum, outage);

  SpreadsheetApp.flush();
  Utilities.sleep(1500);

  // 4) Export PDF เฉพาะชีตนี้
  const pdfName = `ใบลงชื่อ_${beYear}-${pad2_(monthIdx)}-${pad2_(dayNum)}.pdf`;
  const blob = exportSheetToPdfBlobWithRetry_(tmpId, tmpSh.getSheetId(), pdfName);

  // 5) ทิ้งไฟล์ชั่วคราว
  try{ DriveApp.getFileById(tmpId).setTrashed(true); }catch(e){}

  // 6) เซฟลงโฟลเดอร์เป้าหมาย
  const folder = getTargetFolderSafe_();
  const file = folder.createFile(blob).setName(pdfName);
  return file;
}

/* ===================== PDF Export Helpers ===================== */

function exportSheetToPdfBlobWithRetry_(spreadsheetId, sheetGid, filename){
  let lastErr = null;
  for(let i=0; i<4; i++){
    try{
      Utilities.sleep(i===0 ? 0 : (1000 + i*900));
      return exportSheetToPdfBlob_(spreadsheetId, sheetGid, filename, true); // muteHttpExceptions
    }catch(e){
      lastErr = e;
    }
  }
  throw lastErr || new Error('Export PDF failed (unknown)');
}

function exportSheetToPdfBlob_(spreadsheetId, sheetGid, filename, mute){
  const base = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export`;
  const params = {
    format: 'pdf',
    gid: String(sheetGid),
    portrait: 'true',
    fitw: 'true',
    sheetnames: 'false',
    printtitle: 'false',
    pagenumbers: 'false',
    gridlines: 'false',
    fzr: 'false',
    size: 'A4',
    top_margin: '0.25',
    bottom_margin: '0.25',
    left_margin: '0.25',
    right_margin: '0.25'
  };
  const qs = Object.keys(params).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&');
  const url = `${base}?${qs}`;

  const token = ScriptApp.getOAuthToken();
  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: !!mute
  });

  const code = res.getResponseCode();
  const blob = res.getBlob();

  if(code !== 200){
    const txt = res.getContentText() || '';
    throw new Error(`Export PDF failed (code ${code}): ${txt.substring(0,180)}`);
  }

  const ct = (blob.getContentType() || '').toLowerCase();
  if(ct.indexOf('pdf') === -1){
    const txt2 = res.getContentText() || '';
    throw new Error(`Export PDF got non-PDF content: ${ct} :: ${txt2.substring(0,180)}`);
  }

  return blob.setName(filename);
}

/* ===================== Folder Helpers ===================== */

function extractDriveFolderId_(input){
  const s = String(input || '').trim();
  if(!s) return '';
  const m1 = s.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if(m1 && m1[1]) return m1[1];
  const m2 = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if(m2 && m2[1]) return m2[1];
  const m3 = s.match(/^[a-zA-Z0-9_-]{10,}$/); // direct id
  if(m3) return s;
  return '';
}

function getTargetFolderSafe_(){
  const folderId = extractDriveFolderId_(DAILY_SIGN_PDF_FOLDER_INPUT);
  if(folderId){
    try{ return DriveApp.getFolderById(folderId); }catch(e){}
  }
  return DriveApp.getRootFolder();
}

/* ===================== Share ===================== */

function ensureShareAndGetUrl_(file){
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function pad2_(n){ n = Number(n||0); return (n<10?'0':'')+n; }

/* ===================== Notify Wrapper (Webex+LINE) ===================== */

function safeSendNotify_(webexMarkdown){
  // ใช้ sendNotify_ ของโปรเจกต์ (ส่ง Webex + LINE)
  if(typeof sendNotify_ === 'function'){
    return sendNotify_(webexMarkdown);
  }

  // fallback: อย่างน้อยส่ง Webex ได้
  if(typeof sendWebexMarkdown_ === 'function') return sendWebexMarkdown_(webexMarkdown);
  if(typeof sendWebexMessage_ === 'function')  return sendWebexMessage_(webexMarkdown);

  throw new Error('ไม่พบฟังก์ชัน notify (sendNotify_) หรือ Webex sender ในโปรเจกต์');
}

/* ===================== Manual Test ===================== */

function testAutoDailySignExportYesterday(){
  const now = new Date();
  const d = new Date(now);
  d.setDate(d.getDate() - 1);

  const beYear   = Number(Utilities.formatDate(d, AUTO_DAILY_SIGN_CFG.TZ, 'yyyy')) + 543;
  const monthIdx = Number(Utilities.formatDate(d, AUTO_DAILY_SIGN_CFG.TZ, 'M'));
  const dayNum   = Number(Utilities.formatDate(d, AUTO_DAILY_SIGN_CFG.TZ, 'd'));

  const file = exportDailySignPdfByDate_(beYear, monthIdx, dayNum);
  const url = ensureShareAndGetUrl_(file);

  const msg = `✅ ทดสอบส่งออกใบลงชื่อเมื่อวานสำเร็จ\n🔗 ${url}`;
  safeSendNotify_(msg);
  return url;
}
