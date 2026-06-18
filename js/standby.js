
  (function(){
    const $ = id => document.getElementById(id);

    const checkDate = $('ho_checkDate');
    const giver = $('ho_giver');
    const receiver = $('ho_receiver');
    const remark = $('ho_remark');
    const itemScope = { value: 'เครื่องมือและพัสดุ' };

    const vehicleSel = $('ho_vehicle');
    const pdfVehicleSel = $('ho_pdfVehicle');

    const reloadBtn = $('ho_reloadBtn');
    const saveActualBtn = $('ho_saveActualBtn');
    const submitBtn = $('ho_submitBtn');

    const tbody = $('ho_tbody');
    const missHint = $('ho_missHint');
    const autoHint = $('ho_autoHint');

    const pendingRefreshBtn = $('ho_pendingRefreshBtn');
    const pendingList = $('ho_pendingList');
    const pendingHint = $('ho_pendingHint');
    const notifyBell = $('ho_notifyBell');
const notifyBadge = $('ho_notifyBadge');

    const dDay = $('ho_dDay');
    const dMonth = $('ho_dMonth');
    const dYear = $('ho_dYear');
    
    const exportDayBtn = $('ho_exportDayBtn');
    const dayList = $('ho_dayList');


const dashRefreshBtn = $('ho_dashRefreshBtn');
const dashGrid = $('ho_dashGrid');

    let token = null;
    let personName = '';
    let equipment = [];
    let __didInitOnce = false;
    let _autoTimer = null;
    let _lastLoadKey = '';

    const VEH_PREFIX_SHOW = 'รายการ';

    function norm_(s){
      return String(s ?? '')
        .replace(/[\u200B-\u200D\uFEFF]/g,'')
        .replace(/\u00A0/g,' ')
        .replace(/\s+/g,' ')
        .trim();
    }
    function personKey_(name){
      let s = norm_(name);
      s = s.replace(/^(นาย|นางสาว|นาง|Mr\.?|Mrs\.?|Ms\.?)\s+/i,'').trim();
      return s.replace(/\s+/g,'').toLowerCase();
    }
    function samePerson_(a,b){ return personKey_(a) && personKey_(a) === personKey_(b); }
    function prettyVehicle_(sheetName){
      const s = norm_(sheetName);
      if(!s) return '';
      if(s.startsWith(VEH_PREFIX_SHOW)){
        return norm_(s.slice(VEH_PREFIX_SHOW.length)).replace(/^[:：\-–—\s]+/,'').trim() || s;
      }
      return s;
    }
    function esc(s){
      return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
    }
    function toISODateLocal(d){
      const yy=d.getFullYear();
      const mm=String(d.getMonth()+1).padStart(2,'0');
      const dd=String(d.getDate()).padStart(2,'0');
      return `${yy}-${mm}-${dd}`;
    }
    function dateThai_(iso){
      if(!iso) return '—';
      const d = new Date(iso + 'T12:00:00');
      if(isNaN(d.getTime())) return iso;
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()+543}`;
    }
    function todayParts(){
      const d=new Date();
      return {day:d.getDate(), month:d.getMonth()+1, be:d.getFullYear()+543};
    }

    function showLoading_(msg){
      if(typeof window.showLoading === 'function') window.showLoading(msg || 'กำลังดำเนินการ…');
    }
    function hideLoading_(){
      if(typeof window.hideLoading === 'function') window.hideLoading();
    }
    function showErr_(m){
      if(typeof window.showErr === 'function') window.showErr(m);
      else if(window.Swal) Swal.fire({icon:'error', title:'ไม่สำเร็จ', text:String(m||'เกิดข้อผิดพลาด')});
      else alert(m);
    }
    function showOK_(m){
      if(typeof window.showOK === 'function') window.showOK(m);
      else if(window.Swal) Swal.fire({icon:'success', title:'สำเร็จ', text:String(m||'ดำเนินการเรียบร้อย'), timer:1400, showConfirmButton:false});
      else alert(m);
    }
    function gsCall_(fn, args){
      return new Promise((resolve,reject)=>{
        google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)[fn].apply(google.script.run, args||[]);
      });
    }
    function setBtnBusy_(btn, busy, text){
      if(!btn) return;
      if(busy){
        btn.dataset.oldText = btn.textContent || '';
        btn.dataset.oldDisabled = btn.disabled ? '1' : '0';
        btn.disabled = true;
        btn.textContent = text || 'กำลังดำเนินการ…';
        btn.dataset.busy = '1';
      }else{
        if(btn.dataset.busy !== '1') return;
        btn.textContent = btn.dataset.oldText || btn.textContent;
        btn.disabled = btn.dataset.oldDisabled === '1';
        delete btn.dataset.busy;
        delete btn.dataset.oldText;
        delete btn.dataset.oldDisabled;
      }
    }
    async function runBusy_(btn, msg, fn){
      try{
        setBtnBusy_(btn, true, msg || 'กำลังดำเนินการ…');
        showLoading_(msg || 'กำลังดำเนินการ…');
        return await fn();
      }finally{
        hideLoading_();
        setBtnBusy_(btn, false);
      }
    }

    function wireAcc_(){
      document.querySelectorAll('#page-handover .acc').forEach(acc=>{
        if(acc.dataset.wired === '1') return;
        acc.dataset.wired = '1';
        const head = acc.querySelector('.acc-head');
        const btn = acc.querySelector('.acc-toggle');
        const set = collapsed=>{
          acc.setAttribute('data-collapsed', collapsed ? '1' : '0');
          if(btn) btn.textContent = collapsed ? '+' : '–';
        };
        const toggle = ()=>set(acc.getAttribute('data-collapsed') !== '1');
        if(head){
          head.addEventListener('click', e=>{
            if(e.target && e.target.closest && e.target.closest('.acc-toggle')) return;
            toggle();
          });
        }
        if(btn){
          btn.addEventListener('click', e=>{
            e.preventDefault();
            e.stopPropagation();
            toggle();
          });
        }
      });
    }

    function calcMissingQty(it){
      const have = Number(it.haveQty||0)||0;
      const act  = Number(it.actualQty||0)||0;
      return Math.max(0, have - act);
    }
    function computeProblemCount_(){
      let prob=0;
      equipment.forEach(it=>{
        const miss = calcMissingQty(it);
        if(miss>0) prob++;
      });
      return prob;
    }
    function computeReady_(){
      const same = receiver.value && samePerson_(receiver.value, personName);
      const ready = !!token && !!personName && !!vehicleSel.value && !!checkDate.value && !!receiver.value && equipment.length>0 && !same;
      if(submitBtn.dataset.busy !== '1') submitBtn.disabled = !ready;
      if(saveActualBtn.dataset.busy !== '1') saveActualBtn.disabled = !(token && vehicleSel.value && equipment.length>0);
      missHint.textContent = equipment.length
        ? `รายการไม่ครบ/ขาดจริง: ${computeProblemCount_()} รายการ${same ? ' • ผู้รับมอบซ้ำกับผู้มอบ' : ''}`
        : '—';
    }

    function drawTable(){
      if(!equipment.length){
        tbody.innerHTML = '<tr><td colspan="9" class="muted">ยังไม่มีข้อมูล กรุณาเลือกรถและโหลดรายการ</td></tr>';
        computeReady_();
        return;
      }

      tbody.innerHTML='';
      equipment.forEach((it, idx)=>{
        if(typeof it.note !== 'string') it.note = '';
        const std  = Number(it.stdQty||0)||0;
        const have = Number(it.haveQty||0)||0;
        const act  = Number((it.actualQty ?? have ?? 0))||0;
        it.actualQty = act;

        const miss = calcMissingQty(it);

        const tr=document.createElement('tr');
        tr.innerHTML = `
          <td>${esc(it.seq ?? (idx+1))}</td>
          <td>${esc(it.name||'')}</td>
          <td>${esc(it.unit||'')}</td>
          <td>${std}</td>
          <td><input value="${have}" disabled></td>
          <td><input data-i="${idx}" class="actual" type="number" min="0" step="1" value="${act}"></td>
          <td><span class="diff ${miss>0?'bad':''}">${miss}</span></td>
          <td><span class="status-pill ${miss>0?'st-rejected':'st-accepted'}">${miss>0?'ไม่ครบ':'ครบ'}</span></td>
          <td><input data-i="${idx}" class="note" type="text" value="${esc(it.note||'')}" placeholder="เช่น ชำรุด/ส่งซ่อม/ยืมอยู่..."></td>
        `;
        tbody.appendChild(tr);
      });

      tbody.querySelectorAll('input.actual').forEach(inp=>{
        inp.addEventListener('input', ()=>{
          const i=Number(inp.getAttribute('data-i'));
          equipment[i].actualQty = Number(inp.value||0)||0;
          const miss = calcMissingQty(equipment[i]);
          const tr = inp.closest('tr');
          const span = tr.querySelector('span.diff');
          const pill = tr.querySelector('.status-pill');
          span.textContent = String(miss);
          span.className = 'diff ' + (miss>0 ? 'bad':'');
          pill.textContent = miss>0 ? 'ไม่ครบ' : 'ครบ';
          pill.className = 'status-pill ' + (miss>0 ? 'st-rejected':'st-accepted');
          computeReady_();
        });
      });

      tbody.querySelectorAll('input.note').forEach(inp=>{
        inp.addEventListener('input', ()=>{
          const i=Number(inp.getAttribute('data-i'));
          equipment[i].note = inp.value || '';
        });
      });

      computeReady_();
    }

    async function loadVehicles_(){
      const cars = await gsCall_('hoGetVehicleSheets', [token]);
      const list = (Array.isArray(cars)?cars:[]).map(norm_).filter(Boolean);

      vehicleSel.innerHTML = '<option value="">— เลือกรถ —</option>';
      pdfVehicleSel.innerHTML = '<option value="">— เลือกรถ —</option>';

      const lastVeh = (()=>{ try{return localStorage.getItem('handover_vehicle')||'';}catch(e){return '';} })();

      list.forEach(sheetName=>{
        const text = prettyVehicle_(sheetName);
        const o1=document.createElement('option');
        o1.value = sheetName;
        o1.textContent = text;
        vehicleSel.appendChild(o1);

        const o2=document.createElement('option');
        o2.value = sheetName;
        o2.textContent = text;
        pdfVehicleSel.appendChild(o2);
      });

      if(list.length){
        vehicleSel.value = lastVeh && list.includes(lastVeh) ? lastVeh : list[0];
        pdfVehicleSel.value = vehicleSel.value;
      }
    }

    async function loadEquipment_(){
      if(!token) return showErr_('กรุณาเข้าสู่ระบบก่อน');
      const vehicleSheet = norm_(vehicleSel.value);
      if(!vehicleSheet) return showErr_('กรุณาเลือก "รถ" ก่อน');
      if(!checkDate.value) return showErr_('กรุณาเลือก "วันที่ตรวจสอบ" ก่อน');

      const [emps, eq] = await Promise.all([
        gsCall_('hoGetEmployeeNames', [token]),
        gsCall_('hoGetEquipmentList', [token, vehicleSheet])
      ]);

      receiver.innerHTML = '<option value="">— เลือกผู้รับมอบ —</option>';
      (Array.isArray(emps)?emps:[]).forEach(n=>{
        const name = String(n||'').trim();
        if(!name) return;
        const o=document.createElement('option');
        o.value=o.textContent=name;
        receiver.appendChild(o);
      });

      equipment = (Array.isArray(eq)?eq:[]).map(x=>({
        rowIndex: x.rowIndex,
        seq: x.seq,
        type: x.type || 'เครื่องมือ/พัสดุ',
        name: x.name,
        unit: x.unit,
        stdQty: x.stdQty,
        haveQty: x.haveQty,
        actualQty: x.actualQty,
        note: ''
      }));

      drawTable();
      showOK_('โหลดรายการแล้ว');
    }

    function canAutoLoad_(){
      return !!token && !!norm_(vehicleSel.value) && !!String(checkDate.value||'').trim();
    }
    function scheduleAutoLoad_(reason){
      if(!token){
        autoHint.textContent = 'กรุณาเข้าสู่ระบบก่อน';
        return;
      }
      if(!canAutoLoad_()){
        autoHint.textContent = 'เลือก “รถ” และ “วันที่ตรวจสอบ” ให้ครบ';
        return;
      }
      const key = [token, norm_(vehicleSel.value), checkDate.value].join('|');
      if(key === _lastLoadKey) return;
      if(_autoTimer) clearTimeout(_autoTimer);
      autoHint.textContent = `กำลังเตรียมโหลด… (${reason||'เปลี่ยนข้อมูล'})`;
      _autoTimer = setTimeout(async ()=>{
        _autoTimer = null;
        if(!canAutoLoad_()) return;
        _lastLoadKey = [token, norm_(vehicleSel.value), checkDate.value].join('|');
        await runBusy_(reloadBtn, 'กำลังโหลดรายการ…', loadEquipment_);
        autoHint.textContent = `โหลดแล้ว • ${prettyVehicle_(vehicleSel.value)} • ${dateThai_(checkDate.value)}`;
      }, 350);
    }
    
    async function viewPendingDetail_(handoverId){
  try{
    showLoading_('กำลังโหลดรายละเอียด…');

    let data = await gsCall_('hoGetHandoverForView', [token, handoverId]);

if(!data){
  const rows = await gsCall_('hoListPendingReceiver', [token]);
  data = (Array.isArray(rows) ? rows : []).find(x => String(x.id) === String(handoverId));
}

if(!data){
  throw new Error('ไม่พบข้อมูลรายการส่งมอบจาก HandoverLog');
}

if(!data){
  throw new Error('ไม่พบข้อมูลรายการส่งมอบจาก HandoverLog');
}

const items = Array.isArray(data.items) ? data.items : [];

    const rows = items.map((it, i)=>{
      const have = Number(it.haveQty || 0);
      const actual = Number(it.actualQty || 0);
      const miss = Number(it.missingQty ?? Math.max(0, have - actual)) || 0;

      return `
        <tr>
          <td>${i + 1}</td>
          <td style="text-align:left">${esc(it.name || '-')}</td>
          <td>${esc(it.unit || '-')}</td>
          <td>${Number(it.stdQty || 0)}</td>
          <td>${have}</td>
          <td>${actual}</td>
          <td style="font-weight:900;color:${miss > 0 ? '#b91c1c' : '#15803d'}">${miss}</td>
          <td style="text-align:left">${esc(it.note || '-')}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <div class="delivery-detail-content-title">พัสดุที่ส่งมอบ</div>
      <div class="delivery-detail-summary" style="text-align:left;font-size:13px;line-height:1.6;margin-bottom:10px">
        <b>รถ:</b> ${esc(prettyVehicle_(data.vehicle || ''))}<br>
        <b>ผู้มอบ:</b> ${esc(data.giver || '-')}<br>
        <b>ผู้รับมอบ:</b> ${esc(data.receiver || '-')}<br>
        <b>วันที่:</b> ${esc(String(data.day || '-'))}/${esc(String(data.month || '-'))}/${esc(data.beYear || '-')}<br>
        <b>รายการทั้งหมด:</b> ${items.length} รายการ
      </div>

      <div class="delivery-detail-table-wrap" style="max-height:430px;overflow:auto;border:1px solid #eadcff;border-radius:14px">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr style="background:#f6f0ff;color:#3b0764">
              <th style="padding:8px">ลำดับ</th>
              <th style="padding:8px;text-align:left">รายการ</th>
              <th style="padding:8px">หน่วย</th>
              <th style="padding:8px">มาตรฐาน</th>
              <th style="padding:8px">จำนวนที่มี</th>
              <th style="padding:8px">จำนวนจริง</th>
              <th style="padding:8px">ขาด</th>
              <th style="padding:8px;text-align:left">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="8" style="padding:12px;text-align:center">ไม่พบรายการ</td></tr>'}
          </tbody>
        </table>
      </div>
    `;

    if(window.Swal){
      Swal.fire({
  title: '',
  width: '980px',
  html,
  confirmButtonText: 'ปิด',
  customClass: {
    popup: 'delivery-detail-modal',
    title: 'delivery-detail-modal-title'
  },
  heightAuto: false,
  scrollbarPadding: false,
  didOpen: () => {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  },
  willClose: () => {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }
});
    }else{
      alert(`พบรายการ ${items.length} รายการ`);
    }

  }catch(e){
    showErr_(e && e.message ? e.message : e);
  }finally{
    hideLoading_();
  }
}

    async function loadPending_(){
      if(!token) return showErr_('กรุณาเข้าสู่ระบบก่อน');
      const rows = await gsCall_('hoListPendingReceiver', [token]);
      const list = Array.isArray(rows) ? rows : [];
      pendingHint.textContent = `พบ ${list.length} รายการ`;
      /* update badge */
if(notifyBadge){
  if(list.length > 0){
    notifyBadge.style.display = 'flex';
    notifyBadge.textContent = list.length > 99 ? '99+' : String(list.length);
  }else{
    notifyBadge.style.display = 'none';
  }
}

      if(!list.length){
        pendingList.innerHTML = '<div class="muted mini">ไม่มีรายการรอรับมอบสำหรับคุณ</div>';
        return;
      }

      pendingList.innerHTML = '';
      list.forEach(r=>{
        const div = document.createElement('div');
        div.className = 'pending-item';
        div.innerHTML = `
          <div class="pending-title">
            <div>${esc(prettyVehicle_(r.vehicle||''))}</div>
            <span class="status-pill st-pending">รอรับมอบ</span>
          </div>
          <div class="mini muted" style="margin-top:6px">
            วันที่ ${esc(String(r.day).padStart(2,'0'))}/${esc(String(r.month).padStart(2,'0'))}/${esc(r.beYear)} •
            ผู้มอบ: <b>${esc(r.giver||'-')}</b> •
            ประเภท: ${esc(r.itemScope||'-')}<br>
            รายการทั้งหมด ${Number(r.totalItems||0)} รายการ / ไม่ครบ ${Number(r.missingCount||0)} รายการ
            ${r.remark ? '<br>หมายเหตุ: '+esc(r.remark) : ''}
          </div>
          <div class="toolbar">
            <button class="btn" data-act="view" data-id="${esc(r.id)}">👁️ ดูรายการ</button>
<button class="btn primary" data-act="accept" data-id="${esc(r.id)}">✅ ยอมรับ</button>
<button class="btn danger" data-act="reject" data-id="${esc(r.id)}">❌ ปฏิเสธ</button>
          </div>
        `;
        pendingList.appendChild(div);
      });

      pendingList.querySelectorAll('button[data-act]').forEach(btn=>{
        btn.addEventListener('click', async ()=>{
          const id = btn.getAttribute('data-id');
          const act = btn.getAttribute('data-act');

          if(act === 'view'){
  if(!id) return showErr_('ไม่พบรหัสรายการส่งมอบ');
  await viewPendingDetail_(id);
  return;
}

          let note = '';
          if(window.Swal){
            const res = await Swal.fire({
              icon: act === 'accept' ? 'question' : 'warning',
              title: act === 'accept' ? 'ยืนยันรับมอบ?' : 'ปฏิเสธรับมอบ?',
              input: 'text',
              inputLabel: 'หมายเหตุผู้รับมอบ (ถ้ามี)',
              inputPlaceholder: 'ระบุหมายเหตุ...',
              showCancelButton: true,
              confirmButtonText: act === 'accept' ? 'ยอมรับ' : 'ปฏิเสธ',
              cancelButtonText: 'ยกเลิก'
            });
            if(!res.isConfirmed) return;
            note = res.value || '';
          }else{
            if(!confirm(act === 'accept' ? 'ยืนยันรับมอบ?' : 'ปฏิเสธรับมอบ?')) return;
          }

          await runBusy_(btn, 'กำลังบันทึกการตอบรับ…', async ()=>{
            if(act === 'accept') await gsCall_('hoAcceptHandover', [token, id, note]);
            else await gsCall_('hoRejectHandover', [token, id, note]);
            showOK_('บันทึกสถานะแล้ว');
            await loadPending_();
            await loadDashboard_();
          });
        });
      });
    }

    async function listDay_(){
      if(!token) return showErr_('กรุณาเข้าสู่ระบบก่อน');
      const be=Number(dYear.value||0), m=Number(dMonth.value||0), dd=Number(dDay.value||0);
      const veh = norm_(pdfVehicleSel.value);
      if(!be||!m||!dd) return showErr_('กรุณาระบุ วัน/เดือน/ปี ให้ครบ');
      if(!veh) return showErr_('กรุณาเลือก "รถ"');

      const rows = await gsCall_('hoListHandoversByDay', [token, be, m, dd, veh]);
      const list = Array.isArray(rows)?rows:[];
      if(!list.length){
        dayList.innerHTML='ไม่พบรายการในวันนั้น สำหรับรถคันนี้';
        return;
      }

      dayList.innerHTML='';
      list.forEach(r=>{
        const div=document.createElement('div');
        div.className = 'pending-item';
        const cls = r.status === 'ACCEPTED' ? 'st-accepted' : (r.status === 'REJECTED' ? 'st-rejected' : 'st-pending');
        const statusText = r.status === 'ACCEPTED' ? 'ยอมรับแล้ว' : (r.status === 'REJECTED' ? 'ปฏิเสธ' : 'รอรับมอบ');
        div.innerHTML = `
          <div class="pending-title">
            <div>${esc(r.giver||'-')} → ${esc(r.receiver||'-')}</div>
            <span class="status-pill ${cls}">${statusText}</span>
          </div>
          <div class="mini muted" style="margin-top:6px">
            รถ: ${esc(prettyVehicle_(r.vehicle||''))} • ประเภท: ${esc(r.itemScope||'-')} • ไม่ครบ ${Number(r.missingCount||0)} รายการ
          </div>
          <div class="toolbar">
            <button class="btn" data-view="${esc(r.id)}">ดูรายละเอียด</button>
            <button class="btn primary" data-pdf="${esc(r.id)}" ${r.status==='ACCEPTED'?'':'disabled'}>PDF ลงนาม</button>
          </div>
        `;
        dayList.appendChild(div);
      });

      dayList.querySelectorAll('button[data-pdf]').forEach(btn=>{
        btn.addEventListener('click', async ()=>{
          const id=btn.getAttribute('data-pdf');
          await runBusy_(btn,'กำลังสร้าง PDF…', async ()=>{
            const info = await gsCall_('hoExportHandoverPdf', [token, id]);
            if(info && info.url) window.open(info.url,'_blank');
            else showErr_('ไม่พบลิงก์ไฟล์ PDF');
          });
        });
      });

      dayList.querySelectorAll('button[data-view]').forEach(btn=>{
        btn.addEventListener('click', async ()=>{
          const id=btn.getAttribute('data-view');
          const data = await gsCall_('hoGetHandoverForView', [token, id]);
          const html = `
            <div style="text-align:left;font-size:13px;line-height:1.5">
              <b>รถ:</b> ${esc(prettyVehicle_(data.vehicle||''))}<br>
              <b>ผู้มอบ:</b> ${esc(data.giver||'-')}<br>
              <b>ผู้รับมอบ:</b> ${esc(data.receiver||'-')}<br>
              <b>สถานะ:</b> ${esc(data.status||'-')}<br>
              <b>รายการ:</b> ${(data.items||[]).length} รายการ
            </div>
          `;
          if(window.Swal) Swal.fire({title:'รายละเอียด', html, confirmButtonText:'ปิด'});
          else alert(html.replace(/<[^>]*>/g,''));
        });
      });
    }

    function initDefaults_(){
      const d = new Date();
      checkDate.value = toISODateLocal(d);
      const t=todayParts();
      dDay.value=String(t.day);
      dMonth.value=String(t.month);
      dYear.value=String(t.be);
    }

    function wireEvents_(){
      if(window.__handoverWired) return;
      window.__handoverWired = true;

      vehicleSel.addEventListener('change', ()=>{
        try{ localStorage.setItem('handover_vehicle', norm_(vehicleSel.value)); }catch(e){}
        if(vehicleSel.value) pdfVehicleSel.value = vehicleSel.value;
        equipment = [];
        drawTable();
        _lastLoadKey = '';
        scheduleAutoLoad_('เลือกรถ');
      });

      checkDate.addEventListener('change', ()=>{
        if(checkDate.value){
          const d = new Date(checkDate.value + 'T12:00:00');
          dDay.value = String(d.getDate());
          dMonth.value = String(d.getMonth()+1);
          dYear.value = String(d.getFullYear()+543);
        }
        equipment = [];
        drawTable();
        _lastLoadKey = '';
        scheduleAutoLoad_('เปลี่ยนวันที่');
      });

      receiver.addEventListener('change', computeReady_);

      reloadBtn.addEventListener('click', async ()=>{
        _lastLoadKey = '';
        await runBusy_(reloadBtn, 'กำลังโหลดรายการ…', loadEquipment_);
      });

      saveActualBtn.addEventListener('click', async ()=>{
        if(!token) return showErr_('กรุณาเข้าสู่ระบบก่อน');
        const vehicleSheet = norm_(vehicleSel.value);
        if(!vehicleSheet) return showErr_('กรุณาเลือก "รถ"');
        if(!equipment.length) return showErr_('ยังไม่มีรายการ');

        await runBusy_(saveActualBtn,'กำลังบันทึกจำนวนจริง…', async ()=>{
          const updates = equipment.map(it=>({rowIndex:it.rowIndex, actualQty:it.actualQty}));
          const res = await gsCall_('hoSaveActualQtys', [token, vehicleSheet, updates]);
          showOK_(`บันทึกแล้ว ${res && res.updated ? res.updated : 0} รายการ`);
        });
      });

      submitBtn.addEventListener('click', async ()=>{
        token = window.__token || token;
        personName = window.__personName || personName;
        const vehicleSheet = norm_(vehicleSel.value);
        if(!token) return showErr_('กรุณาเข้าสู่ระบบก่อน');
        if(!personName) return showErr_('บัญชีนี้ยังไม่ผูก PersonName ใน Users');
        if(!vehicleSheet) return showErr_('กรุณาเลือก "รถ"');
        if(!checkDate.value) return showErr_('กรุณาเลือกวันที่ตรวจสอบ');
        if(!receiver.value) return showErr_('กรุณาเลือกผู้รับมอบ');
        if(samePerson_(receiver.value, personName)) return showErr_('ผู้รับมอบต้องไม่ใช่คนเดียวกับผู้มอบ');
        if(!equipment.length) return showErr_('ยังไม่มีรายการ');

        const prob = computeProblemCount_();
        if(window.Swal){
          const r = await Swal.fire({
            icon: prob ? 'warning' : 'question',
            title: 'ยืนยันบันทึกส่งมอบ?',
            text: `พบรายการไม่ครบ ${prob} รายการ ระบบจะส่งให้ผู้รับมอบกดยอมรับก่อนออก PDF`,
            showCancelButton:true,
            confirmButtonText:'บันทึกส่งมอบ',
            cancelButtonText:'ยกเลิก'
          });
          if(!r.isConfirmed) return;
        }else if(!confirm('ยืนยันบันทึกส่งมอบ?')){
          return;
        }

        const payload = {
          checkDateISO: checkDate.value,
          receiverName: receiver.value,
          vehicleSheet,
          itemScope: itemScope.value || 'เครื่องมือและพัสดุ',
          remark: remark.value || '',
          items: equipment.map(it=>({
            seq: it.seq,
            type: itemScope.value || 'เครื่องมือและพัสดุ',
            name: it.name,
            unit: it.unit,
            stdQty: it.stdQty,
            haveQty: it.haveQty,
            actualQty: it.actualQty,
            note: it.note || ''
          }))
        };

        await runBusy_(submitBtn,'กำลังบันทึกส่งมอบ…', async ()=>{
          const res = await gsCall_('hoSubmitHandover', [token, payload]);
          showOK_(`บันทึกแล้ว สถานะ: รอผู้รับมอบยอมรับ`);
          await loadPending_();
          await loadDashboard_();
        });
      });

      pendingRefreshBtn.addEventListener('click', async ()=>{
        await runBusy_(pendingRefreshBtn, 'กำลังโหลดรายการรอยอมรับ…', loadPending_);
      });

     

      exportDayBtn.addEventListener('click', async ()=>{
        if(!token) return showErr_('กรุณาเข้าสู่ระบบก่อน');
        const be=Number(dYear.value||0), m=Number(dMonth.value||0), dd=Number(dDay.value||0);
        const veh = norm_(pdfVehicleSel.value);
        if(!be||!m||!dd) return showErr_('กรุณาระบุ วัน/เดือน/ปี ให้ครบ');
        if(!veh) return showErr_('กรุณาเลือก "รถ"');

        await runBusy_(exportDayBtn,'กำลังสร้าง PDF รายวัน…', async ()=>{
          const info = await gsCall_('hoExportDailyHandoverPdfByVehicle', [token, be, m, dd, veh]);
          if(info && info.url) window.open(info.url,'_blank');
          else showErr_('ไม่พบลิงก์ไฟล์ PDF');
        });
      });
      if(notifyBell){
  notifyBell.addEventListener('click', ()=>{
    const el = document.querySelector('#ho_pendingList');
    if(el){
      el.scrollIntoView({
        behavior:'smooth',
        block:'start'
      });
    }
  });
}
    }

    async function doShow_(){
      token = window.__token || null;
      personName = window.__personName || '';
      giver.value = personName || '(ยังไม่ผูก PersonName ใน Users)';

      initDefaults_();
      wireAcc_();
      wireEvents_();

      if(!token){
        equipment=[]; drawTable();
        pendingList.innerHTML = '<div class="muted mini">กรุณาเข้าสู่ระบบก่อน</div>';
        return;
      }

      await loadVehicles_();
equipment=[]; 
drawTable();
scheduleAutoLoad_('เปิดหน้า');

// โหลดรายการรอรับมอบอัตโนมัติเมื่อเข้าหน้า
pendingHint.textContent = 'กำลังโหลดรายการรอยอมรับ…';
await loadPending_();
await loadDashboard_();
    }

    window.handoverPage = window.handoverPage || {};
    window.handoverPage.onShow = async function(){
      __didInitOnce = true;
      await doShow_();
    };

    setTimeout(()=>{ if(!__didInitOnce) window.handoverPage.onShow(); }, 150);
      async function loadDashboard_(){
      if(!token || !dashGrid) return;

      dashGrid.innerHTML = '<div class="muted mini">กำลังโหลด Dashboard...</div>';

      try{
        const data = await gsCall_('hoGetDashboardSummary', [token]);
        const vehicles = Array.isArray(data && data.vehicles) ? data.vehicles : [];

        if(!vehicles.length){
          dashGrid.innerHTML = '<div class="muted mini">ยังไม่มีข้อมูลรับมอบที่ยอมรับแล้ว</div>';
          return;
        }

        dashGrid.innerHTML = '';

        vehicles.forEach(v=>{
          const pct = Number(v.percent || 0);
          const pctClass = pct >= 95 ? '' : (pct >= 80 ? 'warn' : 'bad');
          const miss = Array.isArray(v.topMissing) ? v.topMissing : [];

          const missHtml = miss.length
            ? `
              <div class="ho-missing-list">
                ${miss.map((x,i)=>`
                  <div class="ho-missing-row">
                    <span>${i+1}. ${esc(x.name || '-')}</span>
                    <strong>ขาด ${Number(x.missingQty||0)} ${esc(x.unit||'')}</strong>
                  </div>
                `).join('')}
              </div>
            `
            : `<div class="ho-complete">✅ ไม่พบรายการขาดในการรับมอบล่าสุด</div>`;

          const div = document.createElement('div');
          div.className = 'ho-dash-item';

          div.innerHTML = `
            <div class="ho-dash-title">
              <div>
                🚗 ${esc(v.vehicleDisplay || v.vehicle || '-')}
                <div class="muted mini">ล่าสุด: ${dateThai_(v.checkDateISO)}</div>
              </div>
              <span class="status-pill ${pct >= 95 ? 'st-accepted' : (pct >= 80 ? 'st-pending' : 'st-rejected')}">
                ${pct >= 95 ? 'พร้อมใช้' : (pct >= 80 ? 'ควรตรวจสอบ' : 'ไม่พร้อม')}
              </span>
            </div>

            <div class="ho-percent ${pctClass}">${pct}%</div>

            <div class="ho-bar">
              <span style="width:${Math.max(0, Math.min(100, pct))}%"></span>
            </div>

            <div class="mini muted">
              ครบ ${Number(v.totalActual||0)} / มาตรฐาน ${Number(v.totalStd||0)}
              ${Number(v.totalMissing||0) > 0 ? ` • ขาดรวม ${Number(v.totalMissing||0)}` : ''}
            </div>

            ${missHtml}
          `;

          dashGrid.appendChild(div);
        });

      }catch(err){
        dashGrid.innerHTML = `<div class="muted mini">โหลด Dashboard ไม่สำเร็จ: ${esc(err.message || err)}</div>`;
      }
    }

    if(dashRefreshBtn){
      dashRefreshBtn.addEventListener('click', async ()=>{
        await runBusy_(dashRefreshBtn, 'กำลังโหลด Dashboard…', loadDashboard_);
      });
    }

    window.handoverPage = window.handoverPage || {};
    window.handoverPage.onShow = async function(){
      __didInitOnce = true;
      await doShow_();
    };

    setTimeout(()=>{
      if(!__didInitOnce) window.handoverPage.onShow();
    }, 150);

  })();
  