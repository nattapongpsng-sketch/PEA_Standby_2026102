# เอกสารโครงการ Transfer_PEA_Prasaeng_Standby

## การปรับปรุง UX/UI

การปรับปรุงรอบนี้ทำในชั้น UI เป็นหลัก โดยคง selector เดิมที่ JavaScript ใช้งาน เช่น `#calendarWrap`, `#calScroll`, `.calendar`, `.day-card`, `.item`, `.chip`, `.names`, `.mini-edit`, `.side-link[data-page]` และ `#page-*` เพื่อไม่กระทบ event binding หรือ API flow เดิม

- ปรับ sidebar เป็น dashboard navigation ที่ชัดขึ้น มี profile card, hover state และ active state ที่เด่นกว่าเดิม
- ปรับ top toolbar ให้ปุ่ม wrap เป็นกลุ่มอ่านง่ายบน notebook, desktop และจอเล็ก
- ปรับ card, table, form, modal, loading และ collapsible section ให้ spacing สม่ำเสมอและดูเป็นระบบภายในองค์กร
- เพิ่ม focus-visible, hover, active และ disabled state เพื่อให้ใช้งาน keyboard และ mouse ได้ดีขึ้น

## โทนสีหลัก

สีหลักยังคงเอกลักษณ์เดิมของระบบ ได้แก่ ม่วง / ชมพู / ขาว / เหลือง โดยเพิ่ม CSS variables ใน `:root` เพื่อให้แก้ไขและควบคุม theme ได้ง่ายขึ้น

```css
:root {
  --pea-purple: #6b1fa7;
  --pea-magenta: #d12c8b;
  --pea-yellow: #ffd95c;
  --bg-main: #f8f3ff;
  --card-bg: #ffffff;
  --text-main: #1f1330;
  --border-soft: #eadff7;
  --shadow-soft: ...;
}
```

ตัวแปรเดิม เช่น `--p1`, `--p2`, `--panel`, `--line` ยังถูก map ไว้เพื่อให้ CSS เดิมทำงานต่อได้

## หลักการออกแบบหน้า Standby Calendar

- Calendar เป็นข้อมูลหลักของหน้า จึงใช้ card ขาว, header sticky, border นุ่ม และ shadow เบาเพื่อช่วยอ่านระยะยาว
- วันที่ปัจจุบันใช้ highlight เหลืองชัดเจนโดยไม่เปลี่ยนข้อมูลจริง
- วันหยุดใช้พื้นชมพูอ่อนและ badge เพื่อแยกสถานะโดยไม่รบกวนสายตา
- รายการ S1/S2/S3/R แสดงเป็น badge สีอ่อนที่ยังอยู่ในโทนเดิม
- รายชื่อเวรถูกจำกัดบรรทัดด้วย ellipsis และเพิ่ม `title` tooltip เพื่อดูข้อความเต็มได้โดยไม่ทำให้ cell สูงเกินจำเป็น
- ปุ่มแก้ไขเวรยังใช้ `.mini-edit` เดิม แต่ปรับให้เป็น icon button ที่มีขนาดและ focus state ชัดขึ้น

## ข้อควรระวังในการแก้ไข UI โดยไม่กระทบ logic

- ห้ามลบหรือเปลี่ยนชื่อ `id`, `class`, `data-*` ที่ JS ใช้งานอยู่โดยไม่ค้นหาใน `js/*.js` ก่อน
- ถ้าต้องเปลี่ยน selector ต้องแก้ทุกจุดใน `app.js`, `standby.js`, `ui.js` และทดสอบ flow ที่เกี่ยวข้อง
- ห้ามเปลี่ยน action/API contract ใน `js/api.js` หรือ GAS router เมื่อเป็นงาน UI-only
- หลีกเลี่ยงการย้าย element ที่มี event listener หรือ state เช่น login, toolbar, calendar, modal, handover และ map เว้นแต่จำเป็น
- ทดสอบทั้ง grid/list calendar, responsive, modal SweetAlert, loading overlay และปุ่ม export หลังแก้ CSS ทุกครั้ง

## ภาพรวมระบบ

ระบบนี้ย้ายหน้าเว็บเดิมจาก Google Apps Script UI ไปเป็น static Web App ในโฟลเดอร์ `pea-standby-web` โดยยังคงใช้ Google Sheet เดิมเป็น Database และใช้ Google Apps Script เป็น Backend API สำหรับอ่าน/บันทึกข้อมูล

แนวทางหลักคือคง behavior เดิมไว้ให้มากที่สุด ไม่ลบ feature เดิม และไม่เปลี่ยน business logic โดยไม่จำเป็น

## โครงสร้างไฟล์

```text
pea-standby-web/
  index.html
  README.md
  css/styles.css
  js/app.js
  js/config.js
  js/api.js
  js/standby.js
  js/ui.js
  js/utils.js
  assets/logo/
  assets/icons/
  docs/PROJECT_DOCUMENT.md
```

## รายละเอียดแต่ละไฟล์

`index.html` เป็นหน้าเว็บหลัก รวมโครงสร้าง HTML จาก `index.html`, `page_handover.html` และ `page_map.html` เดิม และโหลด CSS/JS ภายนอก

`css/styles.css` รวม style เดิมทั้งหมดจากหน้า GAS UI เพื่อคงสี layout ตาราง ปุ่ม form modal และแผนที่ให้เหมือนเดิมมากที่สุด

`js/config.js` เก็บค่าคงที่ของระบบ เช่น `GAS_API_URL`, action name, ปี พ.ศ. และเดือน

`js/api.js` เป็นจุดเดียวที่เรียก `fetch()` ไปยัง Google Apps Script API และมี compatibility shim สำหรับโค้ดเดิมที่ยังเรียก `google.script.run`

`js/utils.js` เก็บ helper ทั่วไป เช่น format date/time, validation, normalize name และ sort date

`js/standby.js` เก็บ logic ของหน้า handover ที่ย้ายออกจาก `page_handover.html`

`js/ui.js` เก็บ logic ของหน้า map ที่ย้ายออกจาก `page_map.html`

`js/app.js` เป็น controller หลักของระบบจาก `index.html` เดิม ทำงานเมื่อโหลดหน้า, ผูก event, login, โหลดข้อมูล และสั่ง render

## Backend GAS API

ไฟล์ `.gs` เดิมยังอยู่ใน `CodeGAS` และยังคง function เดิมไว้ ระบบเพิ่ม/ใช้ API layer ดังนี้

- `doGet(e)` ยังเปิดหน้า HtmlService เดิมได้ และรองรับ query API
- `doPost(e)` รับ JSON API ผ่าน `action`
- `handleApiRequest(e, method)` route action ไปยัง function ที่อนุญาต
- `apiCallFunction_(body)` เป็น compatibility layer สำหรับ frontend เดิมที่เรียก `google.script.run`
- `API_LEGACY_FUNCTION_ALLOWLIST_` จำกัดรายชื่อ function ที่ browser เรียกได้

## รายการ API action

- `health`
- `callFunction`
- `login`
- `getCurrentUser`
- `getRoster`
- `saveRoster`
- `getHandover`
- `saveHandover`
- `getMapData`
- `saveDailySign`
- `exportDailySign`
- `getConfig`

## รูปแบบ Response

สำเร็จ:

```json
{
  "ok": true,
  "data": {}
}
```

ผิดพลาด:

```json
{
  "ok": false,
  "message": "รายละเอียดปัญหา"
}
```

## Google Sheet Database

อ้างอิงโครงสร้างจาก `CodeGAS/Demo labanoon 43 Final.xlsx` โดยพบ sheet หลักดังนี้

- `ชีต1`
- `OutageMemory`
- `Users`
- `Attendance`
- `Requests`
- `Device`
- `ม.ค.2569` ถึง `ธ.ค.2569`
- `รายการพัสดุฯ_รถแก้ไฟ_2_หรือ_3_ต`
- `xรายการพัสดุฯ_รถกระเช้า_4_ตัน`
- `รายการเครื่องมือฯ_รถแก้ไฟ_2_หรื`
- `xรายการเครื่องมือฯ_รถกระเช้า_4_`
- `_TEMPLATE_รถยนต์แก้ไฟ`
- `HandoverLog`
- `รายชื่อพนักงาน`

ข้อกำหนดสำคัญคือห้ามเปลี่ยนชื่อ sheet หรือชื่อคอลัมน์โดยไม่จำเป็น หากต้องเพิ่มคอลัมน์ในอนาคตให้บันทึกไว้ในเอกสารนี้ก่อน deploy

## Flow การอ่าน/บันทึกข้อมูล

1. Browser โหลด `index.html`
2. `js/config.js` กำหนด `GAS_API_URL`
3. `js/api.js` ส่ง request ไป GAS ด้วย `fetch`
4. GAS ตรวจ `action` และ allowlist
5. GAS เรียก function เดิมเพื่ออ่าน/บันทึก Google Sheet
6. GAS ส่ง JSON กลับให้ frontend
7. frontend render ผลลัพธ์ด้วย logic เดิม

## ข้อควรระวังด้านความปลอดภัย

- ใช้ allowlist action และ allowlist function เท่านั้น
- ไม่รับชื่อ sheet จาก frontend เพื่อเปิดสิทธิ์เขียนอิสระ
- validate payload ก่อนเขียนลง Google Sheet
- request สำคัญ เช่น save/update/delete ควรมี log ฝั่ง GAS
- `GAS_API_URL` ควรถูกตั้งใน `js/config.js` เท่านั้น

## แนวทางย้ายไป Next.js ในอนาคต

- คง `api.js` เป็น boundary ระหว่าง frontend กับ GAS API
- แยก state/render ของหน้า calendar, handover และ map เป็น component
- ย้ายค่าคงที่จาก `config.js` ไป environment variable
- คง contract API เดิมไว้เพื่อไม่กระทบ Google Sheet และ GAS
- เมื่อพร้อมจึงค่อยเปลี่ยนจาก compatibility shim `google.script.run` ไปใช้ service function โดยตรง

## บันทึกการอัปเดตล่าสุด

### Backend API Router

- เปลี่ยน router หลักของ GAS จากแนวคิดเดิม `handleApiRequest(e, method)` เป็น `standbyApiHandleRequest_(e, method)` ใน `CodeGAS/code.gs`
- ให้ `doGet(e)` และ `doPost(e)` เรียก `standbyApiHandleRequest_()` โดยตรง เพื่อหลีกเลี่ยงปัญหาไฟล์ `api.gs` เก่าหรือ router เก่า override กันใน Apps Script
- เพิ่ม `action: "callFunction"` สำหรับรองรับ frontend เดิมที่ยังเรียกผ่าน compatibility shim ของ `google.script.run`
- เพิ่ม `API_LEGACY_FUNCTION_ALLOWLIST_` เพื่อจำกัดรายชื่อ function เดิมที่ browser เรียกได้ ไม่เปิดให้เรียก function ใดก็ได้อิสระ
- เพิ่ม alias action สำหรับงานลงชื่อและ export เช่น `recordAttendance`, `exportDailySignPdf`, `exportDailyAttendancePdf`, `exportAttendanceDailyPdf`, `exportDayAttendancePdf`
- เพิ่ม `apiVersion` และ `supportsCallFunction` ใน response ของ `health`, `getConfig`, `getCurrentUser` เพื่อใช้ตรวจว่า Web App deployment เป็นโค้ดรุ่นใหม่จริง

### การจัดการไฟล์ api.gs

- ไม่ใช้ไฟล์ `api.gs` เป็น router แล้ว
- ถ้าใน Apps Script project ยังมี `api.gs` เก่าที่ประกาศ `doPost(e)` หรือ `handleApiRequest(e)` ให้ลบออก เพื่อไม่ให้ชนกับ `doPost(e)` ใน `code.gs`
- ใน repo local ไม่มี `CodeGAS/api.gs` แล้ว ให้ถือว่า `code.gs` เป็น source of truth ของ API entrypoint

### Frontend API Adapter

- `pea-standby-web/js/api.js` ยังเป็นตัวกลางเดียวที่เรียก `fetch()` ไปยัง GAS API
- compatibility shim จะพยายามเรียก `callFunction` ก่อนเมื่อ backend รองรับ
- มี fallback ชั่วคราวสำหรับ endpoint รุ่นเก่าบางตัว เช่น `login`, `getCurrentUser`, `getRoster` เพื่อช่วยให้หน้าเว็บยังใช้งานบางส่วนได้ระหว่างที่ deployment ยังไม่เป็นโค้ดล่าสุด
- `pea-standby-web/index.html` ใส่ query version ให้ script เป็น `standby-api-router-4` เพื่อบังคับ browser โหลด JS รุ่นล่าสุดหลังแก้ระบบ API

### วิธีตรวจหลัง Deploy

หลังลบ `api.gs` และ deploy Web App ใหม่ ให้ทดสอบ `action: "health"` กับ `GAS_API_URL` ที่ใช้อยู่จริง ถ้าถูกต้องควรเห็นข้อมูลประมาณนี้:

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "apiVersion": "standby-web-callFunction-v1",
    "supportsCallFunction": true
  }
}
```

ถ้า `health` ยังไม่มี `supportsCallFunction: true` แปลว่า Web App URL ยังชี้ไป deployment เก่า หรือ Apps Script ยังไม่ได้ deploy version ใหม่

## Phase 1: ครอบระบบเดิมด้วย Next.js

Phase 1 นี้เป็นการครอบระบบ PEA Prasaeng Standby Web เดิมด้วย Next.js App Router เพื่อให้สามารถรันผ่าน `npm run dev`, `npm run build` และ `npm run start` ได้ โดยยังรักษาโครงสร้าง DOM, selector, flow การทำงาน และ business logic เดิมไว้ให้มากที่สุด

- ระบบเดิมยังใช้ HTML/CSS/JS logic เดิม โดยย้ายไฟล์ static ไปให้ Next.js ให้บริการผ่าน `public/`
- Google Apps Script ยังเป็น Backend สำหรับอ่านและบันทึกข้อมูล
- Google Sheet ยังเป็น Database เดิมของระบบ
- Next.js ทำหน้าที่เป็น Web Application Wrapper ก่อนเท่านั้น
- ยังไม่มี API Route
- ยังไม่มี PostgreSQL
- ยังไม่มีการย้าย Business Logic ออกจากไฟล์ JS เดิมหรือ Google Apps Script

```text
Browser
  ↓
Next.js App บน Local/Railway
  ↓
Static JS เดิม
  ↓
Google Apps Script
  ↓
Google Sheet
```

## TODO

- ตรวจทานข้อความภาษาไทยหลังเปิดไฟล์ใน editor ที่รองรับ UTF-8
- ใส่ Web App URL จริงใน `js/config.js`
- ทดสอบ flow หลักกับ GAS deployment จริง ได้แก่ login, โหลดตารางเวร, ลงชื่อ, handover, map และ export PDF
