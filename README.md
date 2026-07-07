# PEA Prasaeng Standby Web

## Current UI Status - 2026-07-07

- หน้าลงชื่อปฏิบัติงานยกเลิกการใช้กล้องแล้ว เหลือการบันทึกเวลาและพิกัดสำหรับการลงชื่อเข้า-ออก
- ข้อความบนหน้า Attendance ปรับเป็น `ลงชื่อปฏิบัติงาน (บันทึกเวลา + พิกัด)` และ `ตำแหน่งสำหรับการลงชื่อ`
- การบันทึกลงชื่อยังคงใช้ flow เดิม: ตรวจบัญชีผู้ใช้, วันที่, กะ, ประเภท IN/OUT, ขอพิกัด GPS, แล้วเรียก `recordAttendance(...)`
- payload รูปภาพส่งเป็น `null` ได้ และไม่มีการบังคับให้ถ่ายภาพก่อนบันทึก
- เมนู `ส่งมอบ/รับมอบ` และ `แผนที่สถิติไฟฟ้าขัดข้อง` ถูกซ่อนจากทุก user ชั่วคราว และมี guard ใน `showPage(...)` ไม่ให้เปิดสองหน้านี้ผ่าน navigation
- หลังลงชื่อสำเร็จ ระบบไม่ auto jump ไปหน้า `ส่งมอบ/รับมอบ` แล้ว

Files updated for this state:

- `app/page.js`
- `legacy.index/index.html`
- `js/app.js`
- `public/js/app.js`
- `css/styles.css`
- `public/css/styles.css`

Verification:

- `node --check js/app.js`
- `node --check public/js/app.js`
- `npm run build`

## วิธีเปิดดูหน้าเว็บ

โปรเจกต์ `pea-standby-web` เป็น static frontend ที่เรียก Google Apps Script ผ่าน `js/config.js`

1. ตั้งค่า `GAS_API_URL` ใน `js/config.js` ให้เป็น Web App URL ที่ deploy แล้ว
2. เปิดไฟล์ `index.html` โดยตรงใน browser หรือรัน static server จากโฟลเดอร์ repo
3. ตัวอย่าง static server:

```powershell
cd pea-standby-web
python -m http.server 8080
```

จากนั้นเปิด `http://localhost:8080`

## วิธีทดสอบหลังแก้ UI

- เปิดหน้าเว็บและตรวจว่าไม่มี error ใน console
- Login ด้วยบัญชี viewer/editor ที่ใช้งานจริง
- ตรวจเมนู sidebar ทุกหน้า: ปฏิทิน, ลงชื่อ, สับเปลี่ยนเวร, ผู้ดูแล, ตั้งค่า, ส่งมอบ/รับมอบ และแผนที่
- ทดสอบ calendar ทั้งมุมมองอัตโนมัติ, รายการ และตาราง
- ทดสอบหน้าจอขนาด 1366px, 1920px และหน้าจอเล็ก โดย calendar เท่านั้นที่ควร scroll แนวนอนได้เมื่อจำเป็น

## Checklist การทดสอบปุ่มหลัก

- `รีเฟรชข้อมูล` โหลดข้อมูลเวรใหม่ได้
- `เดือนก่อน` และ `เดือนถัดไป` เปลี่ยนเดือนได้
- `มุมมอง: อัตโนมัติ` สลับมุมมอง calendar ได้
- `จัดตารางเวร (เดือนนี้)` ทำงานได้สำหรับ editor
- `ส่งออกตารางเวรฯ PDF` สร้างและเปิด PDF ได้
- `สรุปสับเปลี่ยนเวร PDF` ใช้งานได้เมื่อสิทธิ์แสดงปุ่ม
- `สร้างปฏิทิน` ทำงานได้ตาม flow เดิม
- ปุ่มแก้ไขเวรใน calendar เปิด modal และบันทึกกลับได้
- ปุ่มบันทึก/ส่งออกในหน้า attendance และ handover ยังเรียก GAS API ตามเดิม

ระบบนี้เป็นการแยกหน้าเว็บของระบบอยู่เวร Standby เดิมออกจาก Google Apps Script โดยคง Google Sheet เดิมเป็นฐานข้อมูล และให้ Google Apps Script ทำหน้าที่เป็น Backend API

## โครงสร้าง

- `index.html` หน้าเว็บหลักแบบ static HTML
- `css/styles.css` CSS ที่แยกออกมาจากไฟล์ HTML เดิม
- `js/config.js` ค่าคงที่ เช่น `GAS_API_URL`, action name, ปี พ.ศ. และรายชื่อเดือน
- `js/api.js` ตัวกลางเรียก Google Apps Script API และ shim สำหรับ `google.script.run`
- `js/utils.js` helper ทั่วไป
- `js/standby.js` logic ของหน้า handover
- `js/ui.js` logic ของหน้า map
- `js/app.js` controller หลักของระบบ
- `docs/PROJECT_DOCUMENT.md` เอกสารระบบภาษาไทย

## เปิดใช้งานแบบ local

1. แก้ `js/config.js`
2. ใส่ URL ของ Google Apps Script Web App ที่ deploy แล้วใน `GAS_API_URL`
3. เปิด `index.html` ผ่าน browser หรือรัน static server เช่น `npx serve pea-standby-web`

## ตั้งค่า GAS_API_URL

```js
const GAS_API_URL = "https://script.google.com/macros/s/DEPLOYMENT_ID/exec";
```

ห้าม hardcode URL ซ้ำในไฟล์อื่น ให้แก้เฉพาะ `js/config.js`

## Deploy Frontend

โฟลเดอร์ `pea-standby-web` เป็น static site สามารถ deploy ได้กับ GitHub Pages, Firebase Hosting, Vercel static output หรือ web server ปกติ

## Deploy Google Apps Script เป็น Web App

1. เปิดโปรเจกต์ Google Apps Script เดิม
2. อัปเดตไฟล์ `.gs` จากโฟลเดอร์ `CodeGAS`
3. Deploy เป็น Web App
4. ตั้งค่า Execute as เป็นเจ้าของสคริปต์หรือรูปแบบที่ใช้งานเดิม
5. ตั้งค่า Who has access ตามนโยบายของหน่วยงาน
6. นำ Web App URL มาใส่ใน `pea-standby-web/js/config.js`

## Backend Router Note

- API entrypoint ปัจจุบันอยู่ใน `CodeGAS/code.gs`
- `doPost(e)` ต้องเรียก `standbyApiHandleRequest_(e, 'POST')`
- ไม่ใช้ `api.gs` เป็น router แล้ว หาก Apps Script project ยังมี `api.gs` เก่าที่ประกาศ `doPost(e)` หรือ `handleApiRequest(e)` ให้ลบออกเพื่อไม่ให้ชนกับ router ใหม่
- หลัง deploy ให้ทดสอบ `action: "health"` และตรวจว่ามี `supportsCallFunction: true`

## Flow การทำงาน

Browser เรียก `callApi()` ใน `js/api.js` -> ส่ง JSON ไป `doPost(e)` ของ GAS -> `handleApiRequest()` ตรวจ action/allowlist -> เรียก function เดิม -> อ่าน/บันทึก Google Sheet -> ส่ง JSON กลับรูปแบบ `{ ok, data }`

หากเกิด error จะตอบกลับ `{ ok:false, message:"..." }`
