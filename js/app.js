


    function normText_(text){
      return String(text||'').replace(/\s+/g,' ').trim();
    }

    function renderWeekdayS2FixedNames(names, selectedNames){
  const box = document.getElementById('rule_weekday_s2FixedNames');
  if(!box) return;

  const selected = new Set((selectedNames || []).map(normText_));

  box.innerHTML = '';

  if(!names || !names.length){
    box.innerHTML = '<div class="muted">ยังไม่มีรายชื่อ</div>';
    return;
  }

  names.forEach(name => {
    const n = normText_(name);

    const label = document.createElement('label');
    label.style.display = 'inline-flex';
    label.style.alignItems = 'center';
    label.style.gap = '8px';
    label.style.marginRight = '12px';
    label.style.marginBottom = '8px';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = n;
    cb.checked = selected.has(n);

    label.appendChild(cb);
    label.appendChild(document.createTextNode(n));
    box.appendChild(label);
  });
}
function getSelectedWeekdayS2FixedNames(){
  const box = document.getElementById('rule_weekday_s2FixedNames');
  if(!box) return [];

  return Array.from(box.querySelectorAll('input[type="checkbox"]:checked'))
    .map(cb => normText_(cb.value))
    .filter(Boolean);
}
function toggleWeekdayS2FixedUI(){
  const wrap = document.getElementById('weekdayS2FixedNamesWrap');
  const select = document.getElementById('rule_weekday_s2FixedOverride');

  if(!wrap || !select) return;

  const isOn = String(select.value || 'false') === 'true';

  wrap.style.display = isOn ? '' : 'none';
}

document.getElementById('rule_weekday_s2FixedOverride')
  ?.addEventListener('change', toggleWeekdayS2FixedUI);


    function showOK(t){
      Swal.fire({icon:'success',title:'สำเร็จ',text:String(t||''),timer:1700,showConfirmButton:false});
    }
    function showErr(t){
      Swal.fire({icon:'error',title:String(t||'เกิดข้อผิดพลาด')});
    }

    window.addEventListener('load', function init(){
      if(!window.google || !google.script || !google.script.run){
        const el = document.getElementById('loginError');
        el.textContent = 'ไม่สามารถติดต่อ Apps Script ได้ — โปรดรีเฟรชหน้า';
        el.style.display='block';
        return;
      }

      const BE_YEAR = window.BE_YEAR || 2569;
      const TH_MONTHS = window.TH_MONTHS || ["?.?.","?.?.","??.?.","??.?.","?.?.","??.?.","?.?.","?.?.","?.?.","?.?.","?.?.","?.?."];
      const wdIndex={'อาทิตย์':0,'จันทร์':1,'อังคาร':2,'พุธ':3,'พฤหัสบดี':4,'ศุกร์':5,'เสาร์':6};

      const $= id => document.getElementById(id.replace('#',''));

      const loginWrap=$('#loginWrap'), loginBtn=$('#loginBtn'), uEl=$('#u'), pEl=$('#p'), loginError=$('#loginError');
      const rolePill=$('#rolePill'), switchBtn=$('#switchBtn'), logoutBtn=$('#logoutBtn'), refreshBtn=$('#refreshBtn');
      const monthSelect=$('#monthSelect'), prevBtn=$('#prevBtn'), nextBtn=$('#nextBtn');
      const genBtn=$('#genBtn'), pdfBtn=$('#pdfBtn'), createBtn=$('#createBtn');
      const swapSumPdfBtn = $('#swapSumPdfBtn');
      const swapSumPdfBtn2 = $('#swapSumPdfBtn2');
      const swapSumPdfLinkWrap = $('#swapSumPdfLinkWrap');
      const viewBtn = $('#viewBtn');

      const calendarWrap=$('#calendarWrap'), calScroll=$('#calScroll'), titleEl=$('#title');
      const viewerPanel=$('#viewerPanel'), editorPanel=$('#editorPanel'), summaryWrap=$('#summaryTableWrap');
      const viewerCard=$('#viewerCard'), editorCard=$('#editorCard'), rulesCard=$('#rulesCard');

const peopleCard = $('#peopleCard');
const peopleTableBody = $('#peopleTableBody');
const personNameInput = $('#personNameInput');
const personRoleInput = $('#personRoleInput');
const addPersonBtn = $('#addPersonBtn');
const clearPersonFormBtn = $('#clearPersonFormBtn');
      const rqDay=$('#rqDay'), rqShift=$('#rqShift');
      const rqRequester=$('#rqRequester'), rqCoverer=$('#rqCoverer'), rqReason=$('#rqReason'), rqSubmit=$('#rqSubmit');
      const historyFor=$('#historyFor'), historyList=$('#historyList'), historyRefresh=$('#historyRefresh');
      const inboxRefresh = $('#inboxRefresh'), inboxList = $('#inboxList'), inboxWhoHint = $('#inboxWhoHint');
      const inboxScopeHint = $('#inboxScopeHint');

      const holDay=$('#holDay'), setHolidayBtn=$('#setHolidayBtn'), unsetHolidayBtn=$('#unsetHolidayBtn');
      const pendingList=$('#pendingList'), missingHint=$('#missingHint');
      const loading=$('#loading'), loadingMsg=$('#loadingMsg');

      const attDay=$('#attDay'), attShift=$('#attShift'), attAction=$('#attAction');
      const attPerson=$('#attPerson'), attPersonLabel=$('#attPersonLabel');
      const camStartBtn=$('#camStartBtn'), camSnapBtn=$('#camSnapBtn'), attSubmit=$('#attSubmit');
      const camVideo=$('#camVideo'), camPreview=$('#camPreview'), attGeo=$('#attGeo'), nowClock=$('#nowClock');
      let camPanel=null, camStatus=null, camRetakeBtn=null, camConfirmBtn=null, camCloseBtn=null;

      const expDay = $('#expDay');
      const expDailyBtn = $('#expDailyBtn');
      const expDailyResult = $('#expDailyResult');

      const r_s2Mode = $('#rule_s2WeekdayMode');
      const r_s2FixedName = $('#rule_s2FixedName');
      const r_s2HolidayCount = $('#rule_s2HolidayCount');
      const r_preferLeader = $('#rule_preferLeader');
      const r_rWeekday = $('#rule_reserveWeekdaySource');
      const r_rHoliday = $('#rule_reserveHolidaySource');
      const r_reserveMode = $('#rule_reserveMode');
      const r_shiftHours = $('#rule_shiftHours');
      const r_countS2 = $('#rule_countS2WeekdayHours');
      const r_countR = $('#rule_countReserveHours');
      const r_startMode = $('#rule_startSequenceMode');
      const r_manualStart = $('#rule_manualStartName');

      
      const saveRulesBtn = $('#saveRulesBtn');
      const saveRulesAndGenBtn = $('#saveRulesAndGenBtn');

      const sidebarPersonName = $('#sidebarPersonName');
      const sidebarUsername = $('#sidebarUsername');
      const userInlineName = $('#userInlineName');

      const navTabs = document.querySelectorAll('.side-link');
      const DISABLED_PAGES = new Set(['handover', 'map']);
      const sidebarToggle = $('#sidebarToggle');
      const sidebarBackdrop = $('#sidebarBackdrop');
      const isMobile = () => window.matchMedia('(max-width: 960px)').matches;
      const isCompactHeader = () => window.matchMedia('(max-width: 767px)').matches;
      const toolbarDesktop = document.querySelector('.toolbar-desktop');
      const toolbarMobile = document.querySelector('.toolbar-mobile');
      const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
      const mobileActionsToggle = document.querySelector('.mobile-actions-toggle');
      const mobileActionsPanel = document.querySelector('.mobile-actions-panel');
      const mobileMonthControl = document.querySelector('.mobile-month-control');
      const toolbarGroups = {
        account: document.querySelector('.toolbar-account'),
        data: document.querySelector('.toolbar-data'),
        month: document.querySelector('.toolbar-month'),
        view: document.querySelector('.toolbar-view'),
        actions: document.querySelector('.toolbar-actions')
      };

      const headerButtonMeta = {
        switchBtn: { full: 'เข้าสู่ระบบ', short: 'เข้าสู่ระบบ', icon: '🔐', title: 'เข้าสู่ระบบ' },
        logoutBtn: { full: 'ออกจากระบบ', short: 'ออกจากระบบ', icon: '🚪', title: 'ออกจากระบบ' },
        refreshBtn: { full: 'รีเฟรช', short: 'รีเฟรช', icon: '🔄', title: 'รีเฟรช' },
        prevBtn: { full: 'ก่อนหน้า', short: 'ก่อน', icon: '', title: 'ก่อนหน้า' },
        nextBtn: { full: 'ถัดไป', short: 'ถัดไป', icon: '', title: 'ถัดไป' },
        viewBtn: { full: 'อัตโนมัติ', short: 'อัตโนมัติ', icon: '⚙️', title: 'มุมมอง: อัตโนมัติ' },
        genBtn: { full: 'จัดเวร', short: 'จัดเวร', icon: '🗓️', title: 'จัดเวร' },
        pdfBtn: { full: 'PDF', short: 'PDF', icon: '📄', title: 'PDF' },
        swapSumPdfBtn: { full: 'สรุป PDF', short: 'สรุป PDF', icon: '📑', title: 'สรุป PDF' },
        createBtn: { full: 'ปฏิทิน', short: 'ปฏิทิน', icon: '📅', title: 'ปฏิทิน' },
        phonePdfBtn: { full: 'โทรศัพท์', short: 'โทรศัพท์', icon: '📞', title: 'โทรศัพท์' }
      };

      function getButtonIcon(id){
        return (headerButtonMeta[id] && headerButtonMeta[id].icon) || '';
      }
      window.getButtonIcon = getButtonIcon;

      function getHeaderNavMode_(){
        if(window.matchMedia('(max-width: 767px)').matches) return 'short';
        if(window.matchMedia('(max-width: 1200px)').matches) return 'short';
        return 'full';
      }

      function getHeaderButtonLabel_(id, mode){
        const meta = headerButtonMeta[id];
        if(!meta) return '';
        if(mode === 'icon') return meta.short || meta.full || getButtonIcon(id);
        if(mode === 'short') return meta.short || meta.full || getButtonIcon(id);
        return meta.full || meta.short || getButtonIcon(id);
      }

      function setupHeaderNavigationTooltips_(){
        Object.keys(headerButtonMeta).forEach(id => {
          const el = document.getElementById(id);
          const meta = headerButtonMeta[id];
          if(!el || !meta) return;
          const title = meta.title || meta.full || meta.short || '';
          el.setAttribute('title', title);
          el.dataset.headerNavButton = '1';
        });
        if(mobileMenuToggle){
          mobileMenuToggle.setAttribute('title', 'เมนู');
          mobileMenuToggle.textContent = 'เมนู';
        }
        if(mobileActionsToggle){
          mobileActionsToggle.setAttribute('title', 'การทำงาน');
          mobileActionsToggle.textContent = 'การทำงาน';
        }
        if(monthSelect){
          monthSelect.setAttribute('title', 'เลือกเดือน');
        }
      }

      function updateHeaderNavigationMode_(){
        const mode = getHeaderNavMode_();
        Object.keys(headerButtonMeta).forEach(id => {
          const el = document.getElementById(id);
          if(!el) return;
          const label = getHeaderButtonLabel_(id, mode);
          if(label) el.textContent = label;
          const title = headerButtonMeta[id].title || headerButtonMeta[id].full || label;
          el.setAttribute('title', title);
          el.dataset.headerNavMode = mode;
        });
      }

      const adminUserUsername = $('#adminUserUsername');
const adminUserPassword = $('#adminUserPassword');
const adminUserRole = $('#adminUserRole');
const adminUserPersonName = $('#adminUserPersonName');
const adminUserActive = $('#adminUserActive');
const adminUserSaveBtn = $('#adminUserSaveBtn');
const adminUserClearBtn = $('#adminUserClearBtn');
const adminUsersTableBody = $('#adminUsersTableBody');

const r_weekday_s1Count = $('#rule_weekday_s1Count');
const r_weekday_s2Count = $('#rule_weekday_s2Count');
const r_weekday_s3Count = $('#rule_weekday_s3Count');
const r_weekday_s2IncludeInRotation = $('#rule_weekday_s2IncludeInRotation');
const r_weekday_hasReserve = $('#rule_weekday_hasReserve');
const r_weekday_reserveFrom = $('#rule_weekday_reserveFrom');

const r_holiday_s1Count = $('#rule_holiday_s1Count');
const r_holiday_s2Count = $('#rule_holiday_s2Count');
const r_holiday_s3Count = $('#rule_holiday_s3Count');
const r_holiday_hasReserve = $('#rule_holiday_hasReserve');
const r_holiday_reserveFrom = $('#rule_holiday_reserveFrom');
      
      // ✅ วางไว้ตรงนี้เลย (หลังจับ element ครบแล้ว)
function hideReserveSourceUI(){
  const showWeekday = String(r_weekday_hasReserve?.value || 'false') === 'true';
  const showHoliday = String(r_holiday_hasReserve?.value || 'false') === 'true';

  const toggleRow = (el, on) => {
    if(!el) return;
    const row = el.closest('.form-row') || el.parentElement;
    if(row) row.style.display = on ? '' : 'none';
  };

  toggleRow(r_weekday_reserveFrom, showWeekday);
  toggleRow(r_holiday_reserveFrom, showHoliday);
  toggleRow(r_countR, showWeekday || showHoliday);
}

r_weekday_hasReserve?.addEventListener('change', hideReserveSourceUI);
r_holiday_hasReserve?.addEventListener('change', hideReserveSourceUI);
hideReserveSourceUI();

      // ===== State =====
      let token=null, role='viewer', lastMonthData=null;
      let currentUser='', currentPersonName='';
      // ===== Restore session from sessionStorage (on refresh) =====
try{
  const t = sessionStorage.getItem('pea_token');
  if(t){
    token = t;
    role = sessionStorage.getItem('pea_role') || 'viewer';
    currentUser = sessionStorage.getItem('pea_user') || '';
    currentPersonName = sessionStorage.getItem('pea_personName') || '';

    window.__token = token;
    window.__role = role;
    window.__personName = currentPersonName;
  }
}catch(e){}


      let rosterNames=[];                 // รายชื่อทั้งหมด
      let leaderEligibleSet = new Set();  // รายชื่อที่ "เป็นหัวหน้าได้" (อ้างอิง role จาก GS)
      let pdfLinkEl=null;
      let swapSummaryPdfLinkEl=null;
      let camStream=null, snapData=null, pendingCameraImage=null;
      
      // ✅ กล้องใหม่ผ่าน GitHub
const USE_GITHUB_CAMERA = false;
window.__cameraImage = window.__cameraImage || null;

      let clockTimer=null;

      // ✅ ค่าเริ่มต้น “เดือนปัจจุบันเสมอ”
      let currentMonth = (new Date().getMonth() + 1);

      // ✅ Calendar view: auto/grid/list (persist)
      let calendarView = 'auto'; // 'auto' | 'grid' | 'list'
      try{ calendarView = localStorage.getItem('pea_cal_view') || 'auto'; }catch(e){}
      function effectiveCalendarView_(){
        if(calendarView === 'grid' || calendarView === 'list') return calendarView;
        return isMobile() ? 'list' : 'grid';
      }
      function updateViewBtnLabel_(){
        if(!viewBtn) return;
        const ev = effectiveCalendarView_();
        const label = (calendarView === 'auto') ? 'มุมมอง: อัตโนมัติ' : ('มุมมอง: ' + (ev==='list' ? 'รายการ' : 'ตาราง'));
        viewBtn.textContent = label;
      }
      function updateViewBtnLabel_(){
        if(!viewBtn) return;
        const ev = effectiveCalendarView_();
        const viewName = (calendarView === 'auto') ? 'อัตโนมัติ' : (ev === 'list' ? 'รายการ' : 'ตาราง');
        headerButtonMeta.viewBtn.full = viewName;
        headerButtonMeta.viewBtn.short = viewName;
        headerButtonMeta.viewBtn.title = 'มุมมอง: ' + viewName;
        updateHeaderNavigationMode_();
      }
      function cycleCalendarView_(){
        const next = (calendarView === 'auto') ? 'list' : (calendarView === 'list' ? 'grid' : 'auto');
        calendarView = next;
        try{ localStorage.setItem('pea_cal_view', calendarView); }catch(e){}
        updateViewBtnLabel_();
        if(lastMonthData) drawCalendar(lastMonthData);
      }
      viewBtn?.addEventListener('click', cycleCalendarView_);

      // ===== UI Helpers =====
      function disableAll(val){
        const btns=[
          switchBtn,logoutBtn,refreshBtn,prevBtn,nextBtn,monthSelect,
          genBtn,pdfBtn,createBtn,rqSubmit,setHolidayBtn,unsetHolidayBtn,
          historyRefresh,loginBtn,saveRulesBtn,saveRulesAndGenBtn,
          attSubmit,camStartBtn,camSnapBtn,
          swapSumPdfBtn,swapSumPdfBtn2,
          expDailyBtn,
          inboxRefresh,
          viewBtn
        ];
        btns.forEach(el=>{
          if(!el) return;
          el.disabled=!!val;
          if(el.classList && el.classList.contains('btn')) el.classList.toggle('loading', !!val);
        });
      }
      function showLoading(msg){
        if(msg) loadingMsg.textContent=msg;
        loading.classList.remove('hidden');
        disableAll(true);
      }
      function hideLoading(){
        loading.classList.add('hidden');
        disableAll(false);
        loadingMsg.textContent='กำลังประมวลผล…';
      }
      function errBox(msg){
        loginError.textContent = msg;
        loginError.style.display = 'block';
        loginError.style.color = '#8a1c1c';
        loginError.style.background = '#ffecec';
        loginError.style.borderColor = '#f5c2c7';
      }
      function infoBox(msg){
        loginError.textContent = msg;
        loginError.style.display = 'block';
        loginError.style.color = '#0f5132';
        loginError.style.background = '#d1e7dd';
        loginError.style.borderColor = '#badbcc';
      }
      function clearErr(){
        loginError.textContent='';
        loginError.style.display='none';
      }
      function normText_(text){
        return String(text||'').replace(/\s+/g,' ').trim();
      }

      function updateUserDisplay(){
        if(token){
          sidebarPersonName.textContent = currentPersonName || '(ยังไม่ผูกชื่อกับชีต1)';
          sidebarUsername.textContent = currentUser ? ('บัญชี: ' + currentUser) : '—';
          userInlineName.textContent = currentPersonName || currentUser || '-';
          if(attPersonLabel){
            attPersonLabel.textContent = currentPersonName
              ? `${currentPersonName} (ตามบัญชีที่เข้าสู่ระบบ)`
              : 'ยังไม่ได้ผูกชื่อในชีต Users';
          }
          if(inboxWhoHint){
            inboxWhoHint.textContent = currentPersonName ? `ผู้แทน = ${currentPersonName}` : 'ยังไม่ผูกชื่อ (จะไม่สามารถยอมรับคำขอได้)';
          }
          if(inboxScopeHint){ inboxScopeHint.textContent = 'ค้นหา: ทั้งปี'; }
        }else{
          sidebarPersonName.textContent = 'ยังไม่ได้เข้าสู่ระบบ';
          sidebarUsername.textContent = '—';
          userInlineName.textContent = '-';
          if(attPersonLabel) attPersonLabel.textContent = 'ใช้จากบัญชีที่เข้าสู่ระบบ';
          if(inboxWhoHint) inboxWhoHint.textContent = '—';
          if(inboxScopeHint) inboxScopeHint.textContent = 'ค้นหา: —';
        }
      }

      // ===== Sidebar toggle =====
      function setDesktopCollapsed(collapsed){
        document.body.classList.toggle('sidebar-collapsed', !!collapsed);
        try{ localStorage.setItem('pea_sidebar_collapsed', collapsed ? '1' : '0'); }catch(e){}
      }
      function openMobileSidebar(open){
        document.body.classList.toggle('sidebar-open', !!open);
      }
      function restoreSidebarState(){
        try{
          const v = localStorage.getItem('pea_sidebar_collapsed');
          if(v === '1') setDesktopCollapsed(true);
        }catch(e){}
      }
      restoreSidebarState();

      sidebarToggle?.addEventListener('click', ()=>{
        if(isMobile()){
          openMobileSidebar(!document.body.classList.contains('sidebar-open'));
        }else{
          setDesktopCollapsed(!document.body.classList.contains('sidebar-collapsed'));
        }
      });
      sidebarBackdrop?.addEventListener('click', ()=> openMobileSidebar(false));

      function closeMobileActionsPanel(){
        if(!mobileActionsPanel || !mobileActionsToggle) return;
        mobileActionsPanel.hidden = true;
        document.body.classList.remove('mobile-actions-open');
        mobileActionsToggle.classList.remove('is-open');
        mobileActionsToggle.setAttribute('aria-expanded', 'false');
      }
      function toggleMobileActionsPanel(){
        if(!mobileActionsPanel || !mobileActionsToggle) return;
        const open = mobileActionsPanel.hidden;
        mobileActionsPanel.hidden = !open;
        document.body.classList.toggle('mobile-actions-open', open);
        mobileActionsToggle.classList.toggle('is-open', open);
        mobileActionsToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
      function syncCompactHeader(){
        if(!toolbarDesktop || !mobileMonthControl || !mobileActionsPanel) return;

        if(isCompactHeader()){
          if(toolbarGroups.month && toolbarGroups.month.parentElement !== mobileMonthControl){
            mobileMonthControl.appendChild(toolbarGroups.month);
          }
          ['account','data','view','actions'].forEach(key=>{
            const group = toolbarGroups[key];
            if(group && group.parentElement !== mobileActionsPanel) mobileActionsPanel.appendChild(group);
          });
        }else{
          ['account','data','month','view','actions'].forEach(key=>{
            const group = toolbarGroups[key];
            if(group && group.parentElement !== toolbarDesktop) toolbarDesktop.appendChild(group);
          });
          closeMobileActionsPanel();
        }
      }
      mobileMenuToggle?.addEventListener('click', ()=> openMobileSidebar(true));
      mobileActionsToggle?.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        toggleMobileActionsPanel();
      });
      mobileActionsPanel?.addEventListener('click', (e)=>{
        const actionButton = e.target.closest('button');
        if(!actionButton || !mobileActionsPanel.contains(actionButton)) return;
        closeMobileActionsPanel();
      }, true);
      document.addEventListener('click', (e)=>{
        if(!document.body.classList.contains('mobile-actions-open')) return;
        if(e.target.closest('.mobile-actions-panel') || e.target.closest('.mobile-actions-toggle')) return;
        closeMobileActionsPanel();
      });
      syncCompactHeader();
      setupHeaderNavigationTooltips_();
      updateViewBtnLabel_();

      window.addEventListener('resize', ()=>{
        if(!isMobile()) openMobileSidebar(false);
        syncCompactHeader();
        updateViewBtnLabel_();
        if(lastMonthData) drawCalendar(lastMonthData);
      });
      window.addEventListener('keydown', (e)=>{
        if(e.key === 'Escape' && document.body.classList.contains('sidebar-open')) openMobileSidebar(false);
        if(e.key === 'Escape' && document.body.classList.contains('mobile-actions-open')) closeMobileActionsPanel();
      });
      document.querySelectorAll('.collapse-card .collapse-head').forEach(btn=>{
        btn.addEventListener('click', ()=> btn.parentElement.classList.toggle('collapsed'));
      });

      // ===== Clock =====
      function startClock(){
        if(!nowClock) return;
        const dayNames=['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
        const pad = n => n<10 ? '0'+n : String(n);
        if(clockTimer) clearInterval(clockTimer);
        clockTimer = setInterval(()=>{
          const d=new Date();
          const y = d.getFullYear()+543;
          const m = d.getMonth()+1;
          const day = d.getDate();
          const wd = dayNames[d.getDay()];
          const hh=pad(d.getHours()), mm=pad(d.getMinutes()), ss=pad(d.getSeconds());
          nowClock.textContent = `${day}/${m}/${y} (${wd}) ${hh}:${mm}:${ss}`;
        },1000);
      }

        // ===== Camera =====
  function stopCamera(){
    if(camStream){
      camStream.getTracks().forEach(t=>t.stop());
      camStream=null;
    }
    if(camVideo){
      camVideo.srcObject = null;
      camVideo.style.display='none';
    }
  }

  function resetAttendanceForm(){
    if(attDay) attDay.value = String(new Date().getDate());
    if(attShift) attShift.value = '1';
    if(attAction) attAction.value = 'IN';
    updateAttActionColor();

    snapData = null;
    window.__cameraImage = null;
    
    if(camPreview){
      camPreview.src = '';
      camPreview.style.display = 'none';
    }
    if(camVideo){
      camVideo.style.display = 'none';
    }
    stopCamera();

    if(attGeo){
      attGeo.textContent = 'ตำแหน่ง: ยังไม่ระบุ (จะขอสิทธิเมื่อกดบันทึก)';
    }
  }

  // ✅ เปิดกล้อง: ถ้าเปิดโหมด GitHub ให้เด้งไป GitHub เลย
  [camStartBtn, camSnapBtn, camVideo, camPreview].forEach(el => {
    if(el) el.style.display = 'none';
  });

  // Camera capture is disabled; attendance still records time/location normally.
  camStartBtn?.addEventListener('click', async ()=>{
    return;
    if(USE_GITHUB_CAMERA){
      openGithubCameraSafe();
      return;
    }

    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      Swal.fire('ไม่รองรับ', 'เบราว์เซอร์ไม่รองรับการใช้งานกล้อง', 'error');
      return;
    }

    try{
      camStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      });

      camVideo.srcObject = camStream;
      camVideo.style.display='block';
      camPreview.style.display='none';
      await camVideo.play();
    }catch(err){
      Swal.fire('เปิดกล้องไม่สำเร็จ', err?.message || 'ไม่สามารถเปิดกล้องได้', 'error');
    }
  });

  // ✅ ปุ่มถ่ายภาพเดิม: ใช้เฉพาะตอน USE_GITHUB_CAMERA = false
  camSnapBtn?.addEventListener('click', ()=>{
    return;
    if(USE_GITHUB_CAMERA){
      Swal.fire('ใช้กล้องใหม่', 'กรุณาถ่ายภาพจากหน้ากล้อง GitHub แล้วกดส่งกลับระบบ', 'info');
      return;
    }

    if(!camVideo?.srcObject){
      Swal.fire('ยังไม่เปิดกล้อง', 'กรุณาเปิดกล้องก่อน', 'warning');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = camVideo.videoWidth || 640;
    canvas.height = camVideo.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(camVideo, 0, 0, canvas.width, canvas.height);

    snapData = canvas.toDataURL('image/jpeg', 0.9);

    camPreview.src = snapData;
    camPreview.style.display = 'block';
    camVideo.style.display = 'none';

    stopCamera();
  });

  // ✅ รับรูปกลับจาก GitHub
  window.addEventListener('message', function(event){
    if(event.origin !== GH_ORIGIN) return;

    const data = event.data;
    if(!data || data.type !== 'camera-image' || !data.imageBase64) return;

    window.__cameraImage = data.imageBase64;
    snapData = data.imageBase64; // ✅ ให้ระบบเดิมใช้ snapData ต่อได้ด้วย

    if(camPreview){
      camPreview.src = data.imageBase64;
      camPreview.style.display = 'block';
    }

    if(camVideo){
      camVideo.style.display = 'none';
    }

    if(ghCameraWindow && !ghCameraWindow.closed){
      ghCameraWindow.close();
    }

    try{
      Swal.fire({
        icon: 'success',
        title: 'รับภาพสำเร็จ',
        text: 'ระบบได้รับภาพจาก GitHub แล้ว',
        timer: 1200,
        showConfirmButton: false
      });
    }catch(e){}
  });
      
      // ===== Attendance action color =====
      function updateAttActionColor(){
        if(!attAction) return;
        attAction.classList.remove('in','out');
        if(attAction.value === 'IN') attAction.classList.add('in');
        else attAction.classList.add('out');
      }
      updateAttActionColor();
      attAction?.addEventListener('change', updateAttActionColor);

      // ===== Navigation =====
      
     function onOpenRulesPage(){
  if(typeof loadRules === 'function') loadRules();
  if(typeof loadRosterPeopleManage === 'function') loadRosterPeopleManage();
  if(typeof clearPeopleForm === 'function') clearPeopleForm();
}

function showPage(name){
  if(DISABLED_PAGES.has(name)) name = 'calendar';
  const isEditor = (role === 'editor');
  const isInspector = (role === 'inspector');
  const canOpenAdmin = isEditor || isInspector;
  const canOpenRules = isEditor || isInspector;

  if(!canOpenAdmin && name === 'admin') name = 'calendar';
  if(!canOpenRules && name === 'rules') name = 'calendar';

  if(name !== 'attendance') stopCamera();

  ['calendar','attendance','swap','admin','rules','handover','map'].forEach(p=>{
    const sec = document.getElementById('page-'+p);
    if(sec) sec.classList.toggle('active', !DISABLED_PAGES.has(p) && p===name);

    const tab = document.querySelector('.side-link[data-page="'+p+'"]');
    if(tab) tab.classList.toggle('active', !DISABLED_PAGES.has(p) && p===name);
  });

  if(isMobile()) openMobileSidebar(false);

  if(name === 'handover' && window.handoverPage && typeof window.handoverPage.onShow === 'function'){
    try{ window.handoverPage.onShow(); }catch(e){}
  }

  if(name === 'rules'){
    try{ onOpenRulesPage(); }catch(e){ console.error(e); }
  }

  if(name === 'admin'){
    try{ onOpenAdminPage(); }catch(e){ console.error(e); }
  }

  if(name === 'map' && typeof window.loadOutageMap === 'function'){
    setTimeout(() => window.loadOutageMap(), 250);
  }
}


      navTabs.forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const page = btn.getAttribute('data-page');
          showPage(page);
        });
      });

      function setNavRoleVisibility(){
  const isEditor = role === 'editor';
  const isInspector = role === 'inspector';
  const canOpenAdmin = isEditor || isInspector;
  const canOpenRules = isEditor || isInspector;

  const tabAdmin = document.querySelector('.side-link[data-page="admin"]');
  const tabRules = document.querySelector('.side-link[data-page="rules"]');
  const tabHandover = document.querySelector('.side-link[data-page="handover"]');
  const tabMap = document.querySelector('.side-link[data-page="map"]');

  if(tabAdmin) tabAdmin.style.display = canOpenAdmin ? 'flex' : 'none';
  if(tabRules) tabRules.style.display = canOpenRules ? 'flex' : 'none';
  if(tabHandover) tabHandover.style.display = 'none';
  if(tabMap) tabMap.style.display = 'none';

  const activeTab = document.querySelector('.side-link.active');
  if(
    activeTab &&
    (
      (!canOpenAdmin && activeTab.dataset.page === 'admin') ||
      (!canOpenRules && activeTab.dataset.page === 'rules') ||
      DISABLED_PAGES.has(activeTab.dataset.page)
    )
  ){
    showPage('calendar');
  }
}

      function setRoleUI(){
  const isEditor = role === 'editor';
  const isInspector = role === 'inspector';
  const canOpenAdmin = isEditor || isInspector;
  const canOpenRules = isEditor || isInspector;

  const inspectorBox = document.getElementById('inspectorBox');
  const editorPendingBox = document.getElementById('editorPendingBox');

  genBtn.style.display = isEditor ? 'inline-flex' : 'none';
  createBtn.style.display = isEditor ? 'inline-flex' : 'none';

  if(swapSumPdfBtn)  swapSumPdfBtn.style.display  = isEditor ? 'inline-flex' : 'none';
  if(swapSumPdfBtn2) swapSumPdfBtn2.style.display = isEditor ? 'inline-flex' : 'none';

  viewerCard.style.display = 'block';
  editorCard.style.display = canOpenAdmin ? 'block' : 'none';
  rulesCard.style.display = canOpenRules ? 'block' : 'none';

  if(inspectorBox) inspectorBox.style.display = isInspector ? 'block' : 'none';
  if(editorPendingBox) editorPendingBox.style.display = isEditor ? 'block' : 'none';

  rolePill.style.display = 'inline-block';
  if(isEditor){
    rolePill.textContent = 'ระดับ : ผู้ดูแลระบบ';
  }else if(isInspector){
    rolePill.textContent = 'ระดับ : ผู้ตรวจสอบ';
  }else{
    rolePill.textContent = 'ระดับ : ผู้ใช้งานทั่วไป';
  }

  logoutBtn.style.display = 'inline-flex';
  setNavRoleVisibility();
}

      function clearRoleUI(){
        genBtn.style.display='none';
        createBtn.style.display='none';
        if(swapSumPdfBtn) swapSumPdfBtn.style.display='none';
        if(swapSumPdfBtn2) swapSumPdfBtn2.style.display='none';

        viewerCard.style.display='none';
        editorCard.style.display='none';
        rulesCard.style.display='none';
        rolePill.style.display='none';
        logoutBtn.style.display='none';
        setNavRoleVisibility();
      }

      // ===== Leader eligibility (อ้างอิง role จาก GS) =====
      function isLeaderRole_(roleText){
        const r = normText_(roleText).toLowerCase();
        if(!r) return true; // ว่าง = ใช้ได้ (ทั้งหัวหน้า/ลูกเวร)
        // ไม่ให้ "ลูกเวร" เป็นหัวหน้าเวร
        if(r.includes('ลูกเวร') || r.includes('junior')) return false;
        // หัวหน้า/lead/leader = ใช้ได้
        if(r.includes('หัวหน้า') || r.includes('lead') || r.includes('leader')) return true;
        // อื่นๆ ให้ใช้ได้ (กันข้อมูล role รูปแบบเฉพาะหน่วย)
        return true;
      }
      function rebuildLeaderEligibleSet_(peopleList){
        rosterNames = [];
        leaderEligibleSet = new Set();

        const arr = Array.isArray(peopleList) ? peopleList : [];
        arr.forEach(it=>{
          // รองรับทั้งแบบ ["A","B"] และ [{name:"A",role:"หัวหน้า"},...]
          let name='', roleText='';
          if(typeof it === 'string'){
            name = normText_(it);
            roleText = ''; // ไม่ทราบ role => ใช้ได้
          }else if(it && typeof it === 'object'){
            name = normText_(it.name || it.personName || it.fullname || it.title || '');
            roleText = normText_(it.role || it.type || it.level || it.position || '');
          }else{
            return;
          }
          if(!name) return;
          rosterNames.push(name);
          if(isLeaderRole_(roleText)) leaderEligibleSet.add(name);
        });

        // ถ้าหา role ไม่ได้เลย (set ว่าง) => fallback = ทุกคนเป็นหัวหน้าได้ (ไม่ให้ UI พัง)
        if(rosterNames.length && leaderEligibleSet.size === 0){
          rosterNames.forEach(n => leaderEligibleSet.add(n));
        }
      }
      function isLeaderEligibleName_(name){
        const n = normText_(name);
        if(!n) return false;
        if(leaderEligibleSet.size === 0) return true;
        return leaderEligibleSet.has(n);
      }

      // ===== Calendar helpers =====

      function isTodayInThisMonth_(dayNum){
  const now = new Date();
  const thisDay = now.getDate();
  const thisMonth = now.getMonth() + 1; // 1-12
  const thisYearBE = now.getFullYear() + 543;

  // ใช้ตัวแปรเดือน/ปีที่คุณใช้อยู่ในระบบ (มักเป็น currentMonth และ BE_YEAR)
  return Number(dayNum) === Number(thisDay)
      && Number(currentMonth) === Number(thisMonth)
      && Number(BE_YEAR) === Number(thisYearBE);
}

      function extractNames(raw){
        if(!raw) return [];
        const m=raw.match(/\):\s*(.+)$/);
        const tail=m?m[1]:raw.split(':').slice(1).join(':');
        return tail.split(',').map(s=>s.trim()).filter(Boolean);
      }
      function isReserveText_(text){
        const t = normText_(text);
        if(!t) return false;
        if(t.startsWith('สำรอง')) return true;
        if(t.startsWith('เวรสำรอง')) return true;
        if(t.startsWith('เวร สำรอง')) return true;
        if(t.startsWith('กะสำรอง')) return true;
        if(t.startsWith('กะ สำรอง')) return true;
        if(/^R(\s|:|：)/i.test(t)) return true;
        return false;
      }
      function isReserveItem_(it){
        if(!it) return false;
        if(it.isReserve === true) return true;
        if(String(it.shift||'').toUpperCase() === 'R') return true;
        if(String(it.type||'').toUpperCase() === 'R') return true;
        return isReserveText_(it.text);
      }
      function dayHasReserve_(dayObj){
        const items = (dayObj && dayObj.items) ? dayObj.items : [];
        return items.some(it => isReserveItem_(it));
      }

      function makeItemElement(it, isHoliday, hasReserveInDay, dayNum){
  const div = document.createElement('div');
  div.className = 'item';

  const text = normText_(it && it.text);
  div.title = text;
  let chipLabel = '';
  let chipClass = 'chip-plain';

  // ✅ รายชื่อจริงจากข้อความ (ใช้ตอนแก้ไข Manual) + รายชื่อที่ใช้แสดงผล
  const namesFull = extractNames(text) || [];
  const names = namesFull.slice(); // แสดงผล "ตามชีตจริง" 100%

  const isS1 = text.startsWith('กะ1');
  const isS2 = text.startsWith('กะ2');
  const isS3 = text.startsWith('กะ3');
  const isR  = isReserveItem_(it);

  if (isS1){ chipLabel='S1'; chipClass='chip-s1'; }
  else if (isS2){ chipLabel='S2'; chipClass = isHoliday ? 'chip-s2' : 'chip-plain'; }
  else if (isS3){ chipLabel='S3'; chipClass='chip-s3'; }
  else if (isR){  chipLabel='R';  chipClass='chip-s1'; }

  // ❌ ไม่ต้องตัดชื่อกะ1 เมื่อมี R แล้ว (ให้แสดงตามข้อมูลจริงในชีต)
  // if(isS1 && hasReserveInDay && names.length >= 2){
  //   names = [names[0]];
  // }

  const spanChip = document.createElement('span');
  spanChip.className = 'chip ' + chipClass;
  spanChip.textContent = chipLabel;

  const spanNames = document.createElement('span');
  spanNames.className = 'names';
  spanNames.title = names.length ? names.join(', ') : text;

  // ตำแหน่งที่ "ควร" เป็นหัวหน้าเวร (คนแรกของชื่อในกะนั้น)
  const shouldHighlightFirst = (isS1 || isS2 || isS3); // R ไม่ใช่หัวหน้าเวร

  names.forEach((n, idx) => {
    if (idx > 0) spanNames.appendChild(document.createTextNode(', '));
    const spanName = document.createElement('span');
    spanName.textContent = n;

    // ✅ ไฮไลท์เฉพาะคนแรกที่เป็นหัวหน้าได้จริง
    if (idx === 0 && shouldHighlightFirst && isLeaderEligibleName_(n)){
      spanName.classList.add('leader-name');
    }

    spanNames.appendChild(spanName);
  });

  div.appendChild(spanChip);
  div.appendChild(spanNames);

  // ✅ Manual edit (Editor only)
  if(role === 'editor' && dayNum && (isS1 || isS2 || isS3 || isR)){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mini-edit';
    btn.textContent = '✏️';
    btn.title = 'แก้ไขเวร';

    const shiftKey = isR ? 'R' : (isS1 ? '1' : (isS2 ? '2' : '3'));

    btn.onclick = function(e){
      e.preventDefault();
      e.stopPropagation();
      // ✅ ส่ง "รายชื่อจริง" เข้าหน้าแก้ไขเสมอ
      openManualEditShift_(dayNum, shiftKey, namesFull);
    };

    div.appendChild(btn);
  }

  return div;
}


      function clearCalendarWrap_(){
        calendarWrap.innerHTML='';
      }

      function drawCalendarGrid_(monthData){
        clearCalendarWrap_();

        const table = document.createElement('table');
        table.className = 'calendar';
        table.setAttribute('id','calendarTable');

        const thead=document.createElement('thead');
        const trh=document.createElement('tr');
        ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'].forEach(h=>{
          const th=document.createElement('th'); th.textContent=h; trh.appendChild(th);
        });
        thead.appendChild(trh); table.appendChild(thead);

        const tbody=document.createElement('tbody');
        const days=monthData.days||[];
        if(!days.length){
          tbody.innerHTML='<tr><td colspan="7" class="muted" style="padding:14px">ยังไม่มีข้อมูลเดือนนี้</td></tr>';
          table.appendChild(tbody);
        }else{
          const first=wdIndex[days[0].weekday]??0;
          let cell=0;
          const total=days.length;
          for(let r=0;r<6;r++){
            const tr=document.createElement('tr');
            for(let c=0;c<7;c++){
              const td=document.createElement('td');
              const dIdx=cell-first;
              if(dIdx>=0 && dIdx<total){
                const d=days[dIdx];
                if(d.isHoliday) td.classList.add('holiday');

                // ✅ ไฮไลท์วันปัจจุบัน
if (isTodayInThisMonth_(d.day)) td.classList.add('is-today');


                const head=document.createElement('div'); head.className='day-header';
                const s=document.createElement('span'); s.className='day-num'; s.textContent=d.day; head.appendChild(s);
                if(d.isHoliday){
                  const b=document.createElement('span'); b.className='badge'; b.textContent='หยุด'; head.appendChild(b);
                }
                td.appendChild(head);

                const items=document.createElement('div'); items.className='items';
                const hasR = dayHasReserve_(d);
                (d.items||[]).forEach(it=> items.appendChild(makeItemElement(it, d.isHoliday, hasR, d.day)));
                td.appendChild(items);
              }else{
                td.innerHTML='&nbsp;';
              }
              tr.appendChild(td); cell++;
            }
            tbody.appendChild(tr);
          }
        }
        table.appendChild(tbody);
        calendarWrap.appendChild(table);
      }

      function drawCalendarList_(monthData){
        clearCalendarWrap_();

        const days = monthData.days || [];
        if(!days.length){
          calendarWrap.innerHTML = '<div class="muted" style="padding:14px">ยังไม่มีข้อมูลเดือนนี้</div>';
          return;
        }

        const wrap = document.createElement('div');
        wrap.className = 'day-cards';

        days.forEach(d=>{
          const card = document.createElement('div');
          card.className = 'day-card' + (d.isHoliday ? ' holiday' : '');

          // ✅ เพิ่มตรงนี้
if (isTodayInThisMonth_(d.day)) card.classList.add('is-today');


          const head = document.createElement('div');
          head.className = 'day-card-head';

          const left = document.createElement('div');
          left.className = 'day-card-left';

          const num = document.createElement('span');
          num.className = 'day-num';
          num.textContent = d.day;

          const wd = document.createElement('span');
          wd.className = 'day-card-wd';
          wd.textContent = d.weekday || '';

          left.appendChild(num);
          left.appendChild(wd);

          head.appendChild(left);

          if(d.isHoliday){
            const b = document.createElement('span');
            b.className = 'badge';
            b.textContent = 'หยุด';
            head.appendChild(b);
          }

          const body = document.createElement('div');
          body.className = 'day-card-items';

          const items=document.createElement('div');
          items.className='items';
          const hasR = dayHasReserve_(d);
          (d.items||[]).forEach(it=> items.appendChild(makeItemElement(it, d.isHoliday, hasR, d.day)));
          body.appendChild(items);

          card.appendChild(head);
          card.appendChild(body);
          wrap.appendChild(card);
        });

        calendarWrap.appendChild(wrap);
      }

      function drawCalendar(monthData){
        lastMonthData = monthData;
        const view = effectiveCalendarView_();
        updateViewBtnLabel_();

        if(view === 'grid') drawCalendarGrid_(monthData);
        else drawCalendarList_(monthData);

        const maxDay = String((monthData.days||[]).length||31);
        rqDay.max = maxDay;
        holDay.max = maxDay;
        attDay.max = maxDay;
        expDay.max = maxDay;

        if (!attDay.value) attDay.value = new Date().getDate();
        if (!rqDay.value) rqDay.value = new Date().getDate();
        if (!expDay.value) expDay.value = new Date().getDate();

        populateRequesterFromDayShift();
      }

      function drawSummaryTable(summary){
  const rows = Array.isArray(summary.result) ? summary.result : [];
  const total = Number(summary.totalHours || 0);

  // sort มาก -> น้อย (อยากเรียงแบบเดิม ลบบรรทัดนี้)
  const data = rows
    .map(r => ({ name: String(r.name||''), hours: Number(r.hours||0) }))
    .sort((a,b)=>b.hours-a.hours);

  const max = Math.max(1, ...data.map(d=>d.hours)); // กันหาร 0

  const outer = document.createElement('div');
  outer.className = 'sum-chart';

  // หัวเรื่อง + รวม
  const head = document.createElement('div');
  head.className = 'sum-chart-head';
  head.innerHTML = `
    <div class="sum-chart-title">สรุปชั่วโมงเวร (เดือนนี้)</div>
    <div class="sum-chart-total">รวมทั้งหมด: <b>${total}</b> ชม.</div>
  `;
  outer.appendChild(head);

  // รายการแท่ง
  const list = document.createElement('div');
  list.className = 'sum-bars';

  data.forEach(d=>{
    const pct = Math.max(2, Math.round((d.hours / max) * 100)); // ให้เห็นแท่งขั้นต่ำ
    const row = document.createElement('div');
    row.className = 'sum-bar-row';
    row.innerHTML = `
      <div class="sum-name" title="${escapeHtml_(d.name)}">${escapeHtml_(d.name)}</div>
      <div class="sum-bar-rail">
        <div class="sum-bar" style="width:${pct}%"></div>
      </div>
      <div class="sum-hours">${d.hours}</div>
    `;
    list.appendChild(row);
  });

  outer.appendChild(list);

  summaryWrap.innerHTML = '';
  summaryWrap.appendChild(outer);
}

// helper กันชื่อมี < > ทำให้ HTML เพี้ยน
function escapeHtml_(s){
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#39;");
}


      function render(){
        titleEl.textContent = `ปฏิทิน ${TH_MONTHS[currentMonth-1]} ${BE_YEAR}`;
        monthSelect.value = String(currentMonth);

        showLoading('กำลังโหลดข้อมูล…');
        google.script.run
          .withSuccessHandler(function(data){
            hideLoading();
            const missing = !data || data.missing || !(data.days||[]).length;
            missingHint.style.display = missing ? '' : 'none';
            drawCalendar(data||{days:[]});
            populateRequesterFromDayShift();
            fillHistoryForSelect(historyFor.value || currentPersonName);

            if(!data || data.missing){
              summaryWrap.innerHTML='<div class="muted">ยังไม่มีข้อมูล</div>';
              historyList.innerHTML='<span class="muted">—</span>';
              pendingList.innerHTML='<span class="muted">—</span>';
              if(inboxList) inboxList.innerHTML='<span class="muted">—</span>';
              return;
            }

            google.script.run
              .withSuccessHandler(function(sum){
                drawSummaryTable(sum||{result:[],totalHours:0});
              })
              .withFailureHandler(function(e){
                showErr(e.message||'คำนวณสรุปล้มเหลว');
              })
              .getMonthHoursSummary(BE_YEAR,currentMonth);

            refreshHistory();
            refreshInbox();
            if(role==='editor') refreshPending();
          })
          .withFailureHandler(function(err){
            hideLoading();
            showErr(err.message||'โหลดข้อมูลล้มเหลว');
          })
          .getMonthData(BE_YEAR,currentMonth);
      }

      // ===== Swap request helpers =====
      function getSwapCovererNames_(){
        const seen = new Set();
        const out = [];
        const add = (name) => {
          const n = normText_(name);
          if(!n) return;
          const key = n.toLowerCase();
          if(seen.has(key)) return;
          seen.add(key);
          out.push(n);
        };

        (rosterNames || []).forEach(add);

        if(lastMonthData && Array.isArray(lastMonthData.days)){
          lastMonthData.days.forEach(day => {
            (day.items || []).forEach(it => {
              extractNames(it && it.text).forEach(add);
            });
          });
        }

        return out;
      }

      function fillCovererSelect(excludeSet){
        rqCoverer.innerHTML='';
        const exclude = new Set(
          Array.from(excludeSet || []).map(n => normText_(n).toLowerCase()).filter(Boolean)
        );
        const names = getSwapCovererNames_();

        names.forEach(n=>{
          if(exclude.has(normText_(n).toLowerCase())) return;
          const o=document.createElement('option');
          o.value=o.textContent=n;
          rqCoverer.appendChild(o);
        });

        if(!rqCoverer.options.length){
          const o=document.createElement('option');
          o.value='';
          o.textContent='ไม่พบรายชื่อผู้แทน';
          rqCoverer.appendChild(o);
        }
      }

      function fillHistoryForSelect(preferredName){
        if(!historyFor) return;
        const preferred = normText_(preferredName || historyFor.value || currentPersonName || '');
        const names = getSwapCovererNames_();
        historyFor.innerHTML = '';

        names.forEach(n=>{
          const o=document.createElement('option');
          o.value=o.textContent=n;
          historyFor.appendChild(o);
        });

        if(!historyFor.options.length){
          const o=document.createElement('option');
          o.value='';
          o.textContent='ไม่พบรายชื่อ';
          historyFor.appendChild(o);
          return;
        }

        const matched = Array.from(historyFor.options).find(o => {
          return normText_(o.value).toLowerCase() === preferred.toLowerCase();
        });
        historyFor.value = matched ? matched.value : historyFor.options[0].value;
      }

     function validateSwapForm(){
  const day = parseInt(rqDay.value,10);
  const shift = String(rqShift.value||'').trim();
  const requester = String(rqRequester.value||'').trim();
  const coverer = String(rqCoverer.value||'').trim();

  // ✅ แบบ B: ไม่บังคับ reason ที่ปุ่ม (ปล่อยให้กดได้)
  const ok = !!(day && shift && requester && coverer && requester !== coverer);

  rqSubmit.disabled = !ok;
}


      function populateRequesterFromDayShift(){
        if(!lastMonthData){
          rqRequester.innerHTML='';
          fillCovererSelect(null);
          rqSubmit.disabled=true;
          return;
        }
        const day=parseInt(rqDay.value,10), shift=rqShift.value;
        rqRequester.innerHTML='';
        if(!day){ fillCovererSelect(null); rqSubmit.disabled=true; return; }

        const d=lastMonthData.days.find(x=>x.day==day);
        if(!d){ fillCovererSelect(null); rqSubmit.disabled=true; return; }

        const it=(d.items||[]).find(i=> normText_(i.text).startsWith('กะ'+shift));
        if(!it){ fillCovererSelect(null); rqSubmit.disabled=true; return; }

        let namesInShift = it.text ? extractNames(it.text) : [];
        const hasR = dayHasReserve_(d);
        if(String(shift)==='1' && hasR && namesInShift.length>=2){
          namesInShift = [namesInShift[0]];
        }

        const exclude=new Set(namesInShift);
        namesInShift.forEach(n=>{
          const o=document.createElement('option');
          o.value=o.textContent=n;
          rqRequester.appendChild(o);
        });

        fillCovererSelect(exclude);
        validateSwapForm();
      }
      rqDay.onchange=rqShift.onchange=populateRequesterFromDayShift;
      rqCoverer?.addEventListener('change', validateSwapForm);
      rqRequester?.addEventListener('change', validateSwapForm);
      rqReason?.addEventListener('input', validateSwapForm);

      function resetSwapRequestForm(){
        rqDay.value = String(new Date().getDate());
        rqShift.value = '1';
        rqReason.value = '';
        rqSubmit.disabled = true;
        populateRequesterFromDayShift();
        validateSwapForm();
      }

      rqSubmit.onclick=function(){
        const day=parseInt(rqDay.value,10),
              shift=rqShift.value,
              requester=rqRequester.value,
              coverer=rqCoverer.value,
              reason=(rqReason.value||'').trim();

        if(!day||!shift||!requester||!coverer){ showErr('กรุณากรอกข้อมูลให้ครบ'); return; }
        if(requester===coverer){ showErr('ผู้ร้องขอและผู้แทนต้องเป็นคนละคน'); return; }
        if(!reason){ showErr('กรุณาระบุเหตุผล'); return; }

        showLoading('กำลังส่งคำขอ (รอผู้แทนยอมรับ)…');
        google.script.run
          .withSuccessHandler(function(){
            hideLoading();
            Swal.fire({icon:'success',title:'ส่งคำขอแล้ว',text:'สถานะ: รอผู้แทนยอมรับ',timer:1600,showConfirmButton:false});
            resetSwapRequestForm();
            refreshHistory();
            refreshInbox();
            if(role==='editor') refreshPending();
            render();
          })
          .withFailureHandler(function(e){
            hideLoading();
            showErr(e.message||'ส่งคำขอล้มเหลว');
          })
          .submitSwapRequest(token,BE_YEAR,currentMonth,day,shift,requester,coverer,reason);
      };

      function isWaitingCovererStatus_(status){
        const s = String(status||'').toLowerCase().trim();
        return [
          'await_coverer',
          'awaiting_coverer',
          'waiting_coverer',
          'coverer_pending',
          'offer','offered','waiting_accept'
        ].includes(s);
      }

      function statusLabel(status){
  const s = String(status||'').toLowerCase().trim();
  if(s==='approved') return 'อนุมัติ';
  if(s==='rejected') return 'ไม่อนุมัติ';
  if(s==='cancelled') return 'ยกเลิก';
  if(s==='await_inspector') return 'รอผู้ตรวจสอบ';
  if(s==='pending') return 'รอผู้อนุมัติ';
  if(isWaitingCovererStatus_(s)) return 'รอผู้แทนยอมรับ';
  if(['coverer_rejected','rejected_by_coverer','declined_by_coverer','coverer_declined'].includes(s)) return 'ผู้แทนปฏิเสธ';
  return status || '—';
}
      function statusPillClass(status){
  const s = String(status||'').toLowerCase().trim();
  if(s==='approved') return 'st-approved';
  if(s==='rejected') return 'st-rejected';
  if(s==='cancelled') return 'st-cancelled';
  if(s==='await_inspector') return 'st-waiting';
  if(s==='pending') return 'st-pending';
  if(isWaitingCovererStatus_(s)) return 'st-waiting';
  if(['coverer_rejected','rejected_by_coverer','declined_by_coverer','coverer_declined'].includes(s)) return 'st-coverer-reject';
  return 'st-pending';
}

      function renderHistoryTable(rows, who){
        const wrap=historyList;
        if(!rows.length){ wrap.innerHTML='<span class="muted">ยังไม่มีคำขอ</span>'; return; }

        const tbl=document.createElement('table'); tbl.className='slim';
        tbl.innerHTML='<thead><tr><th>วันที่</th><th>กะ</th><th>ผู้แทน</th><th>เหตุผล</th><th>สถานะ</th><th>จัดการ</th></tr></thead>';
        const tb=document.createElement('tbody');

        rows.forEach(function(r){
          const tr=document.createElement('tr');
          const pill = statusPillClass(r.status);
          const stText = statusLabel(r.status);

          tr.innerHTML=`<td>${r.day}</td><td>${r.shift}</td><td>${r.coverer}</td><td>${(r.reason||'')}</td><td><span class="status-pill ${pill}">${stText}</span></td>`;
          const td=document.createElement('td');

          if(String(r.requester)===String(who)){
            const btnPdf=document.createElement('button');
            btnPdf.className='btn';
            btnPdf.textContent='พิมพ์ PDF';
            td.appendChild(btnPdf);

            btnPdf.onclick = function(){
              showLoading('กำลังสร้างใบขอสับเปลี่ยนฯ (PDF)…');
              google.script.run
                .withSuccessHandler(function(info){
                  hideLoading();
                  try{ window.open(info.url,'_blank'); }catch(e){}
                  const link=document.createElement('a');
                  link.href=info.url; link.target='_blank';
                  link.textContent='เปิด PDF';
                  link.style.marginLeft='8px';
                  link.className='btn';
                  td.appendChild(link);
                  showOK('สร้าง PDF แล้ว');
                })
                .withFailureHandler(function(e){
                  hideLoading();
                  showErr(e.message||'สร้าง PDF ล้มเหลว');
                })
                .exportSwapRequestPdf(token, BE_YEAR, currentMonth, r.day, r.shift, r.requester, r.coverer, r.reason || '', null);
            };
          }

          const s = String(r.status||'').toLowerCase().trim();
          const cancellable = (s==='pending' || isWaitingCovererStatus_(s));

          if(String(r.requester)===String(who) && cancellable){
            const btn=document.createElement('button');
            btn.className='btn';
            btn.style.marginLeft='6px';
            btn.textContent='ยกเลิก';
            btn.onclick=function(){
              showLoading('กำลังยกเลิก…');
              google.script.run
                .withSuccessHandler(function(){
                  hideLoading();
                  showOK('ยกเลิกแล้ว');
                  refreshHistory();
                  refreshInbox();
                  if(role==='editor') refreshPending();
                  render();
                })
                .withFailureHandler(function(e){
                  hideLoading();
                  showErr(e.message||'ยกเลิกล้มเหลว');
                })
                .cancelSwapRequest(token, r.id);
            };
            td.appendChild(btn);
          }else if(!td.childNodes.length){
            td.innerHTML='<span class="muted">—</span>';
          }

          tr.appendChild(td);
          tb.appendChild(tr);
        });

        tbl.appendChild(tb);

        const outer = document.createElement('div');
        outer.className = 'table-scroll';
        outer.appendChild(tbl);

        wrap.innerHTML='';
        wrap.appendChild(outer);
      }


function refreshHistory(){
  const who = historyFor.value || '';

  // ✅ Swal Loading ตอนเริ่มโหลด
  Swal.fire({
    title: 'กำลังโหลดประวัติ…',
    html: 'กรุณารอสักครู่',
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => Swal.showLoading()
  });

  google.script.run
    .withSuccessHandler(function(list){
      try{
        const rows = (Array.isArray(list) ? list : [])
          .filter(r => !who || String(r.requester) === String(who));

        renderHistoryTable(rows, who);

        // ✅ ปิด Loading + แจ้งสั้นๆ (เลือกได้)
        Swal.close();
        // ถ้าอยากให้มี Toast แจ้งเสร็จ:
        // Swal.fire({ icon:'success', title:'โหลดแล้ว', timer:900, showConfirmButton:false });

      }catch(err){
        Swal.close();
        showErr(err.message || 'แสดงผลประวัติไม่สำเร็จ');
      }
    })
    .withFailureHandler(function(e){
      Swal.close();
      showErr((e && e.message) ? e.message : 'โหลดประวัติไม่สำเร็จ');
    })
    .listRequests(token, BE_YEAR, currentMonth);
}


function roleRank(role){
  const r = String(role || '').trim().toLowerCase();
  if(r === 'editor') return 3;
  if(r === 'inspector') return 2;
  return 1;
}

function hasAtLeastRole(need){
  const current = window.__role || role || 'viewer';
  return roleRank(current) >= roleRank(need);
}


function isEditorRole(){
  return (window.__role || role || '').toLowerCase() === 'editor';
}

function isInspectorRole(){
  return (window.__role || role || '').toLowerCase() === 'inspector';
}

function canOpenAdminPage(){
  return isEditorRole() || isInspectorRole();
}


      historyRefresh.onclick = refreshHistory;

      // ===== Inbox (ผู้แทน) — ✅ ค้นหาทั้งปี + รองรับ await_coverer =====
      function renderInboxTable(rows){
        if(!inboxList) return;
        if(!currentPersonName){
          inboxList.innerHTML = '<span class="muted">ยังไม่ผูกชื่อกับชีต1/Users — ไม่สามารถแสดงรายการที่ต้องยอมรับได้</span>';
          return;
        }
        if(!rows.length){
          inboxList.innerHTML = '<span class="muted">ไม่มีคำขอที่รอการยอมรับ</span>';
          return;
        }

        const tbl=document.createElement('table'); tbl.className='slim';
        tbl.innerHTML='<thead><tr><th>เดือน</th><th>วันที่</th><th>กะ</th><th>ผู้ร้องขอ</th><th>เหตุผล</th><th>สถานะ</th><th>ดำเนินการ</th></tr></thead>';
        const tb=document.createElement('tbody');

        rows.forEach(r=>{
          const tr=document.createElement('tr');
          const pill = statusPillClass(r.status);
          const stText = statusLabel(r.status);

          tr.innerHTML = `
            <td>${r.month || ''}</td>
            <td>${r.day}</td>
            <td>${r.shift}</td>
            <td>${r.requester}</td>
            <td>${(r.reason||'')}</td>
            <td><span class="status-pill ${pill}">${stText}</span></td>
          `;

          const td=document.createElement('td');

          const btnYes = document.createElement('button');
          btnYes.className = 'btn primary';
          btnYes.textContent = 'ยอมรับ';

          const btnNo = document.createElement('button');
          btnNo.className = 'btn';
          btnNo.style.marginLeft='6px';
          btnNo.textContent = 'ปฏิเสธ';

          btnYes.onclick = async ()=>{
  const ok = await confirmCovererTwoStep(true, r);
  if(!ok) return;
  respondCovererDecision(r.id, true);
};

btnNo.onclick = async ()=>{
  const ok = await confirmCovererTwoStep(false, r);
  if(!ok) return;
  respondCovererDecision(r.id, false);
};

          td.appendChild(btnYes);
          td.appendChild(btnNo);

          tr.appendChild(td);
          tb.appendChild(tr);
        });

        tbl.appendChild(tb);

        const outer = document.createElement('div');
        outer.className = 'table-scroll';
        outer.appendChild(tbl);

        inboxList.innerHTML='';
        inboxList.appendChild(outer);
      }


async function confirmCovererTwoStep(isAccept, r){

  const actionText = isAccept ? 'ยอมรับ' : 'ปฏิเสธ';
  const color      = isAccept ? '#2e7d32' : '#c62828';

  const metaHtml = `
    <div style="text-align:left;line-height:1.6">
      <b>เดือน:</b> ${r.month || '-'}<br>
      <b>วันที่:</b> ${r.day}<br>
      <b>กะ:</b> ${r.shift}<br>
      <b>ผู้ร้องขอ:</b> ${r.requester}<br>
      <b>เหตุผล:</b> ${r.reason || '-'}
      <hr style="margin:10px 0">
      <span style="color:#666">การดำเนินการนี้ไม่สามารถย้อนกลับได้</span>
    </div>
  `;

  const result = await Swal.fire({
    icon: 'warning',
    title: `ยืนยันการ${actionText}?`,
    html: metaHtml,
    showCancelButton: true,
    confirmButtonText: actionText,
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: color,
    reverseButtons: true,
    focusCancel: true
  });

  return !!result.isConfirmed;
}

      function gsCall_(fn, args){
        return new Promise((resolve, reject)=>{
          try{
            const runner = google.script.run
              .withSuccessHandler(resolve)
              .withFailureHandler(reject);
            if(typeof runner[fn] !== 'function'){
              reject(new Error(`ไม่พบฟังก์ชัน GS: ${fn}`));
              return;
            }
            runner[fn].apply(null, args || []);
          }catch(e){
            reject(e);
          }
        });
      }

      async function refreshInbox(){
  if(!token){
    if(inboxList) inboxList.innerHTML = '<span class="muted">—</span>';
    return;
  }
  if(!currentPersonName){
    renderInboxTable([]);
    return;
  }

  // ✅ แสดง Swal loading ระหว่างดึงข้อมูล (เหมือนฟังก์ชันอื่น ๆ)
  Swal.fire({
    title: 'กำลังโหลดรายการรอยอมรับ…',
    html: 'ค้นหาคำขอแทนเวรที่รอให้คุณตอบรับ',
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => Swal.showLoading()
  });

  try{
    // ✅ เรียกครั้งเดียว (เร็วขึ้นมาก)
    const mine = await gsCall_('listInboxForCoverer', [token, BE_YEAR]);

    renderInboxTable(Array.isArray(mine) ? mine : []);
    Swal.close();

  }catch(e){
    Swal.close();
    showErr((e && e.message) ? e.message : 'โหลดรายการรอยอมรับไม่สำเร็จ');
  }
}


      inboxRefresh?.addEventListener('click', refreshInbox);

      function respondCovererDecision(requestId, accept){
        if(!token){ showErr('กรุณาเข้าสู่ระบบก่อน'); return; }
        if(!currentPersonName){ showErr('บัญชีนี้ยังไม่ผูกชื่อใน Users/ชีต1'); return; }

        const CANDIDATES = [
          'covererRespondSwapRequest',
          'respondToSwapRequest',
          'respondSwapRequest',
          'respondSwapOffer',
          'acceptSwapRequest',
          'covererDecision',
          'covererRespond'
        ];

        const actionText = accept ? 'ยอมรับ' : 'ปฏิเสธ';
        showLoading(`กำลัง${actionText}คำขอ…`);

        function tryCall(idx){
          if(idx >= CANDIDATES.length){
            hideLoading();
            showErr('ไม่พบฟังก์ชันสำหรับ “ผู้แทนตอบรับคำขอ” ในฝั่ง GS (ตรวจชื่อฟังก์ชัน)');
            return;
          }
          const fn = CANDIDATES[idx];

          try{
            const runner = google.script.run
              .withSuccessHandler(function(){
                hideLoading();
                showOK(`${actionText}แล้ว`);
                refreshInbox();
                refreshHistory();
                if(role==='editor') refreshPending();
                render();
              })
              .withFailureHandler(function(e){
                const msg = (e && e.message) ? String(e.message) : '';
                const looksLikeMissing =
                  msg.includes('is not a function') ||
                  msg.includes('not defined') ||
                  msg.includes('No signature of method');
                if(looksLikeMissing) tryCall(idx+1);
                else { hideLoading(); showErr(msg || `ทำรายการ${actionText}ไม่สำเร็จ`); }
              });

            if(typeof runner[fn] !== 'function'){ tryCall(idx+1); return; }
            runner[fn](token, requestId, !!accept);

          }catch(err){
            tryCall(idx+1);
          }
        }

        tryCall(0);
      }

      // ===== Pending (Editor) =====
      function refreshPending(){
        google.script.run
          .withSuccessHandler(function(list){
            const rows=(Array.isArray(list)?list:[]).filter(r=>String(r.status)==='pending');
            const wrap=pendingList;
            if(!rows.length){
              wrap.innerHTML='<span class="muted">ไม่มีคำขอค้างอนุมัติ</span>';
              return;
            }
            const table=document.createElement('table'); table.className='slim';
            table.innerHTML='<thead><tr><th>วันที่</th><th>กะ</th><th>ผู้ร้องขอ</th><th>ผู้แทน</th><th>เหตุผล</th><th>สถานะ</th><th>จัดการ</th></tr></thead>';
            const tb=document.createElement('tbody');
            rows.forEach(function(r){
              const tr=document.createElement('tr');
              tr.innerHTML=`<td>${r.day}</td><td>${r.shift}</td><td>${r.requester}</td><td>${r.coverer}</td><td>${r.reason||''}</td><td>${statusLabel(r.status)}</td>`;
              const td=document.createElement('td');

              const ok=document.createElement('button');
              ok.className='btn primary';
              ok.textContent='อนุมัติ';
              ok.onclick = async function(){

  const confirmed = await confirmSecureAction('approve', r);
  if(!confirmed) return;

  showLoading('กำลังอนุมัติ…');

  google.script.run
    .withSuccessHandler(function(){
      hideLoading();
      showOK('อนุมัติแล้ว');
      refreshPending();
      render();
    })
    .withFailureHandler(function(e){
      hideLoading();
      showErr(e.message || 'อนุมัติล้มเหลว');
    })
    .approveRequest(token, r.id, true);
};

              const no=document.createElement('button');
              no.className='btn';
              no.style.marginLeft='6px';
              no.textContent='ปฏิเสธ';
              no.onclick = async function(){

  const confirmed = await confirmSecureAction('reject', r);
  if(!confirmed) return;

  showLoading('กำลังปฏิเสธ…');

  google.script.run
    .withSuccessHandler(function(){
      hideLoading();
      showOK('ปฏิเสธแล้ว');
      refreshPending();
    })
    .withFailureHandler(function(e){
      hideLoading();
      showErr(e.message || 'ปฏิเสธล้มเหลว');
    })
    .approveRequest(token, r.id, false);
};

              td.appendChild(ok); td.appendChild(no);
              tr.appendChild(td);
              tb.appendChild(tr);
            });
            table.appendChild(tb);

            const outer = document.createElement('div');
            outer.className = 'table-scroll';
            outer.appendChild(table);

            wrap.innerHTML='';
            wrap.appendChild(outer);
          })
          .withFailureHandler(function(e){
            showErr(e.message||'โหลดคำขอล้มเหลว');
          })
          .listRequests(token,BE_YEAR,currentMonth);
      }
function refreshInspectList(){
  const wrap = document.getElementById('inspectList');
  if(!wrap) return;

  wrap.innerHTML = '<span class="muted">กำลังโหลด…</span>';

  google.script.run
    .withSuccessHandler(function(list){
      try{
        const rows = (Array.isArray(list) ? list : [])
          .filter(r => String(r.status || '').trim() === 'await_inspector');

        renderInspectTable(rows);
      }catch(err){
        wrap.innerHTML = '<span class="muted">โหลดข้อมูลไม่สำเร็จ</span>';
        showErr(err && err.message ? err.message : 'โหลดรายการรอตรวจสอบไม่สำเร็จ');
      }
    })
    .withFailureHandler(function(e){
      wrap.innerHTML = '<span class="muted">โหลดข้อมูลไม่สำเร็จ</span>';
      showErr((e && e.message) ? e.message : 'โหลดรายการรอตรวจสอบไม่สำเร็จ');
    })
    .listRequests(token, BE_YEAR, currentMonth);
}
function renderInspectTable(rows){
  const wrap = document.getElementById('inspectList');
  if(!wrap) return;

  const list = Array.isArray(rows) ? rows : [];
  if(!list.length){
    wrap.innerHTML = '<span class="muted">ไม่มีคำขอที่รอตรวจสอบ</span>';
    return;
  }

  const tbl = document.createElement('table');
  tbl.className = 'slim';

  tbl.innerHTML = `
    <thead>
      <tr>
        <th>วันที่</th>
        <th>กะ</th>
        <th>ผู้ขอ</th>
        <th>ผู้แทน</th>
        <th>เหตุผล</th>
        <th>สถานะ</th>
        <th>จัดการ</th>
      </tr>
    </thead>
  `;

  const tb = document.createElement('tbody');

  list.forEach(r=>{
  const tr = document.createElement('tr');
  const rowId = r.rowIndex || '';

  tr.innerHTML = `
    <td>${r.day || '-'}</td>
    <td>${r.shift || '-'}</td>
    <td>${escapeHtml_(r.requester || '-')}</td>
    <td>${escapeHtml_(r.coverer || '-')}</td>
    <td>${escapeHtml_(r.reason || '-')}</td>
    <td><span class="status-pill st-waiting">${escapeHtml_(r.status || '-')}</span></td>
    <td></td>
  `;

    const actionTd = tr.lastElementChild;

    const passBtn = document.createElement('button');
    passBtn.className = 'btn primary';
    passBtn.type = 'button';
    passBtn.textContent = 'ตรวจสอบผ่าน';
    passBtn.onclick = function(){
      confirmInspectAction(rowId, true);
    };

    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'btn';
    rejectBtn.type = 'button';
    rejectBtn.textContent = 'ไม่ผ่าน';
    rejectBtn.style.marginLeft = '8px';
    rejectBtn.onclick = function(){
      confirmInspectAction(rowId, false);
    };

    actionTd.appendChild(passBtn);
    actionTd.appendChild(rejectBtn);

    tb.appendChild(tr);
  });

  tbl.appendChild(tb);

  const sc = document.createElement('div');
  sc.className = 'table-scroll';
  sc.appendChild(tbl);

  wrap.innerHTML = '';
  wrap.appendChild(sc);
}

function confirmInspectAction(rowIdx, approve){
  if(!rowIdx){
    showErr('ไม่พบแถวคำขอที่ต้องการดำเนินการ');
    return;
  }

  Swal.fire({
    title: approve ? 'ยืนยันตรวจสอบผ่าน?' : 'ยืนยันไม่ผ่านการตรวจสอบ?',
    html: approve
      ? 'เมื่อยืนยันแล้ว คำขอจะถูกส่งต่อไปให้ <b>Editor</b> อนุมัติขั้นสุดท้าย'
      : 'เมื่อยืนยันแล้ว คำขอนี้จะถูก <b>ปฏิเสธ</b> ทันที',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก',
    customClass: { popup: 'pea-swal' }
  }).then((res)=>{
    if(!res.isConfirmed) return;

    showLoading(approve ? 'กำลังส่งต่อให้ Editor...' : 'กำลังปฏิเสธคำขอ...');

    google.script.run
      .withSuccessHandler(function(resp){
        hideLoading();

        showOK(approve ? 'ตรวจสอบผ่านแล้ว' : 'ปฏิเสธคำขอแล้ว');

        // โหลดกล่อง inspector ใหม่
        refreshInspectList();

        // ถ้ามีประวัติ/กล่องอื่น ให้รีเฟรชตาม
        try{ refreshHistory(); }catch(e){}
        try{ refreshInbox(); }catch(e){}
        try{ render(); }catch(e){}
      })
      .withFailureHandler(function(err){
        hideLoading();
        showErr((err && err.message) ? err.message : 'ดำเนินการไม่สำเร็จ');
      })
      .inspectSwapRequest(token, rowIdx, approve);
  });
}


      // ===== Holiday =====
      setHolidayBtn.onclick=function(){
        const d=parseInt(holDay.value,10);
        if(!d){ showErr('กรุณาระบุวัน'); return; }
        showLoading('กำลังอัปเดตวันหยุด…');
        google.script.run
          .withSuccessHandler(function(){ hideLoading(); showOK('ตั้งวันหยุดแล้ว'); render(); })
          .withFailureHandler(function(e){ hideLoading(); showErr(e.message||'อัปเดตล้มเหลว'); })
          .setHoliday(token,BE_YEAR,currentMonth,d,true);
      };
      unsetHolidayBtn.onclick=function(){
        const d=parseInt(holDay.value,10);
        if(!d){ showErr('กรุณาระบุวัน'); return; }
        showLoading('กำลังอัปเดตวันหยุด…');
        google.script.run
          .withSuccessHandler(function(){ hideLoading(); showOK('ยกเลิกวันหยุดแล้ว'); render(); })
          .withFailureHandler(function(e){ hideLoading(); showErr(e.message||'อัปเดตล้มเหลว'); })
          .setHoliday(token,BE_YEAR,currentMonth,d,false);
      };

async function confirmSecureAction(type, r){

  const isApprove = type === 'approve';
  const actionText = isApprove ? 'อนุมัติ' : 'ปฏิเสธ';
  const color = isApprove ? '#2e7d32' : '#c62828';

  const metaHtml = `
    <div style="text-align:left;line-height:1.6">
      <b>วันที่:</b> ${r.day}<br>
      <b>กะ:</b> ${r.shift}<br>
      <b>ผู้ร้องขอ:</b> ${r.requester}<br>
      <b>ผู้แทน:</b> ${r.coverer}<br>
      <b>เหตุผล:</b> ${r.reason || '-'}
    </div>
  `;

  const result = await Swal.fire({
    icon: 'warning',
    title: `ยืนยันการ${actionText}?`,
    html: metaHtml,
    showCancelButton: true,
    confirmButtonText: actionText,
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: color,
    reverseButtons: true
  });

  return !!result.isConfirmed;
}


      // ===== PDF month =====
      pdfBtn.onclick = async function(){
  const result = await Swal.fire({
    title: 'เลือกประเภทเอกสาร PDF',
    html: `
      <div style="text-align:left;font-size:14px;color:#444">
        กรุณาเลือกประเภทเอกสารที่ต้องการส่งออก
      </div>
    `,
    input: 'radio',
    inputOptions: {
      approve: 'ขออนุมัติ',
      report: 'รายงานสรุป'
    },
    inputValue: 'approve',
    showCancelButton: true,
    confirmButtonText: 'ตกลง',
    cancelButtonText: 'ยกเลิก',
    reverseButtons: true,
    customClass: {
      popup: 'pea-swal',
      confirmButton: 'btn primary',
      cancelButton: 'btn'
    },
    buttonsStyling: false,
    inputValidator: (value) => {
      if (!value) return 'กรุณาเลือกประเภทเอกสาร';
    }
  });

  if (!result.isConfirmed) return;

  const mode = result.value || 'approve';

  showLoading('กำลังสร้างไฟล์ PDF…');

  google.script.run
    .withSuccessHandler(function(info){
      hideLoading();

      if (pdfLinkEl && pdfLinkEl.parentNode) {
        pdfLinkEl.parentNode.removeChild(pdfLinkEl);
      }

      pdfLinkEl = document.createElement('a');
      pdfLinkEl.href = info.url;
      pdfLinkEl.target = '_blank';
      pdfLinkEl.style.marginLeft = '8px';
      pdfLinkEl.className = 'btn';
      pdfLinkEl.textContent = 'เปิด PDF';

      pdfBtn.insertAdjacentElement('afterend', pdfLinkEl);

      try {
        window.open(info.url, '_blank');
      } catch(e) {}

      const modeText = mode === 'report' ? 'รายงานสรุป' : 'ขออนุมัติ';
      showOK('สร้าง PDF แล้ว (' + modeText + ')');
    })
    .withFailureHandler(function(e){
      hideLoading();
      showErr(e.message || 'สร้าง PDF ล้มเหลว');
    })
    .exportMonthPdfOfficial(token, BE_YEAR, currentMonth, { mode: mode });
};

      // ===== Export Monthly Swap Summary PDF (try multiple names) =====
      function exportMonthlySwapSummaryPdf(){
        if(!token){ showErr('กรุณาเข้าสู่ระบบก่อน'); return; }
        if(role!=='editor'){ showErr('ฟังก์ชันนี้สำหรับผู้ดูแลระบบ (Editor)'); return; }

        const CANDIDATES = [
          'exportSwapSummaryPdf',
          'exportMonthlySwapSummaryPdf',
          'exportSwapRequestsSummaryPdf',
          'exportSwapRequestsMonthlyPdf'
        ];

        if(swapSummaryPdfLinkEl && swapSummaryPdfLinkEl.parentNode){
          swapSummaryPdfLinkEl.parentNode.removeChild(swapSummaryPdfLinkEl);
        }
        if(swapSumPdfLinkWrap) swapSumPdfLinkWrap.textContent = '';

        showLoading('กำลังสร้างสรุปสับเปลี่ยนเวร (PDF)…');

        function tryCall(idx){
          if(idx >= CANDIDATES.length){
            hideLoading();
            showErr('ไม่พบฟังก์ชันส่งออกสรุปสับเปลี่ยนเวรในฝั่ง GS (ตรวจชื่อฟังก์ชัน)');
            return;
          }
          const fn = CANDIDATES[idx];

          try{
            const runner = google.script.run
              .withSuccessHandler(function(info){
                hideLoading();
                try{ window.open(info.url,'_blank'); }catch(e){}
                swapSummaryPdfLinkEl = document.createElement('a');
                swapSummaryPdfLinkEl.href = info.url;
                swapSummaryPdfLinkEl.target = '_blank';
                swapSummaryPdfLinkEl.className = 'btn';
                swapSummaryPdfLinkEl.textContent = 'เปิด PDF';
                swapSummaryPdfLinkEl.style.marginLeft = '6px';
                if(swapSumPdfLinkWrap){
                  swapSumPdfLinkWrap.innerHTML = '';
                  swapSumPdfLinkWrap.appendChild(swapSummaryPdfLinkEl);
                }else{
                  swapSumPdfBtn.insertAdjacentElement('afterend', swapSummaryPdfLinkEl);
                }
                showOK('สร้าง PDF แล้ว');
              })
              .withFailureHandler(function(e){
                const msg = (e && e.message) ? String(e.message) : '';
                const looksLikeMissing =
                  msg.includes('is not a function') ||
                  msg.includes('not defined') ||
                  msg.includes('No signature of method');
                if(looksLikeMissing) tryCall(idx+1);
                else { hideLoading(); showErr(msg || 'สร้าง PDF สรุปสับเปลี่ยนเวรล้มเหลว'); }
              });

            if(typeof runner[fn] !== 'function'){ tryCall(idx+1); return; }
            runner[fn](token, BE_YEAR, currentMonth, null);

          }catch(err){
            tryCall(idx+1);
          }
        }
        tryCall(0);
      }
      if(swapSumPdfBtn) swapSumPdfBtn.onclick = exportMonthlySwapSummaryPdf;
      if(swapSumPdfBtn2) swapSumPdfBtn2.onclick = exportMonthlySwapSummaryPdf;

      function safeSet(el, val){
  if(el) el.value = val;
}

      // ===== Rules =====
      function loadRules(){
  google.script.run
    .withSuccessHandler(function(rules){
      rules = rules || {};

      const weekday = rules.weekday || {};
      const holiday = rules.holiday || {};

      safeSet(r_weekday_s1Count, String(weekday.s1Count ?? 2));
      safeSet(r_weekday_s2Count, String(weekday.s2Count ?? 1));
      safeSet(r_weekday_s3Count, String(weekday.s3Count ?? 2));
      safeSet(r_weekday_s2IncludeInRotation, String(weekday.s2IncludeInRotation ?? true));

      const fixedOverrideEl = document.getElementById('rule_weekday_s2FixedOverride');
if(fixedOverrideEl){
  fixedOverrideEl.value = String(weekday.s2FixedOverride ?? false);
}

renderWeekdayS2FixedNames(
  window.__rosterPeople || [],
  weekday.s2FixedNames || []
);

toggleWeekdayS2FixedUI();

      safeSet(r_weekday_hasReserve, String(weekday.hasReserve ?? false));
      safeSet(r_weekday_reserveFrom, weekday.reserveFrom || 'S3');

      safeSet(r_holiday_s1Count, String(holiday.s1Count ?? 2));
      safeSet(r_holiday_s2Count, String(holiday.s2Count ?? 2));
      safeSet(r_holiday_s3Count, String(holiday.s3Count ?? 2));
      safeSet(r_holiday_hasReserve, String(holiday.hasReserve ?? false));
      safeSet(r_holiday_reserveFrom, holiday.reserveFrom || 'S2');

      safeSet(r_preferLeader, String(rules.preferLeader ?? true));
      safeSet(r_shiftHours, String(rules.shiftHours ?? 8));
      safeSet(r_countS2, String(rules.countS2WeekdayHours ?? false));
      safeSet(r_countR, String(rules.countReserveHours ?? false));
      safeSet(r_startMode, rules.startSequenceMode || 'auto_from_prev');
      safeSet(r_manualStart, rules.manualStartName || '');

      hideReserveSourceUI();
    })
    .withFailureHandler(function(e){
      showErr((e && e.message) || 'โหลดการตั้งค่าล้มเหลว');
    })
    .getRosterRules(token);
}

function validateRulesBeforeSave(patch){
  if(!patch) return;

  const weekday = patch.weekday || {};

  if(weekday.s2FixedOverride){
    if(!Array.isArray(weekday.s2FixedNames) || weekday.s2FixedNames.length === 0){
      throw new Error('กรุณาเลือกรายชื่อคงที่สำหรับกะ 2 วันปกติ');
    }
  }
}
      function saveRules(thenGenerate){
  const patch = {
    weekday: {
  s1Count: Number(r_weekday_s1Count?.value || 0),
  s2Count: Number(r_weekday_s2Count?.value || 0),
  s3Count: Number(r_weekday_s3Count?.value || 0),
  s2IncludeInRotation: String(r_weekday_s2IncludeInRotation?.value || 'false') === 'true',

  s2FixedOverride: String(document.getElementById('rule_weekday_s2FixedOverride')?.value || 'false') === 'true',
  s2FixedNames: getSelectedWeekdayS2FixedNames(),

  hasReserve: String(r_weekday_hasReserve?.value || 'false') === 'true',
  reserveFrom: r_weekday_reserveFrom?.value || ''
},
    holiday: {
      s1Count: Number(r_holiday_s1Count?.value || 0),
      s2Count: Number(r_holiday_s2Count?.value || 0),
      s3Count: Number(r_holiday_s3Count?.value || 0),
      hasReserve: String(r_holiday_hasReserve?.value || 'false') === 'true',
      reserveFrom: r_holiday_reserveFrom?.value || ''
    },
    preferLeader: String(r_preferLeader?.value || 'false') === 'true',
    shiftHours: Number(r_shiftHours?.value || 8),
    countS2WeekdayHours: String(r_countS2?.value || 'false') === 'true',
    countReserveHours: String(r_countR?.value || 'false') === 'true',
    startSequenceMode: r_startMode?.value || 'auto_from_prev',
    manualStartName: r_manualStart?.value || ''
  };
  

  try{
  validateRulesBeforeSave(patch);
}catch(err){
  showErr(err.message || String(err));
  return;
}
  showLoading('กำลังบันทึกการตั้งค่า…');

  google.script.run
    .withSuccessHandler(function(){
      hideLoading();
      showOK('บันทึกการตั้งค่าแล้ว');

      if(thenGenerate){
        showLoading('กำลังกำหนดตารางเวรใหม่…');

        google.script.run
          .withSuccessHandler(function(){
            hideLoading();
            showOK('บันทึกและจัดตารางแล้ว');

            if (typeof render === 'function') {
              render();
            } else if (typeof refreshUI_ === 'function') {
              refreshUI_();
            }
          })
          .withFailureHandler(function(e){
            hideLoading();
            showErr((e && e.message) || 'จัดตารางไม่สำเร็จ');
          })
          .generateRosterMonth(token, BE_YEAR, currentMonth);
      }
    })
    .withFailureHandler(function(e){
      hideLoading();
      showErr((e && e.message) || 'บันทึกการตั้งค่าไม่สำเร็จ');
    })
    .setRosterRules(token, patch);
}

saveRulesBtn.onclick = () => saveRules(false);
saveRulesAndGenBtn.onclick = () => saveRules(true);
     

  let editingOriginalName = '';

function roleLabelTH(roleText, roleCode){
  if(roleText && String(roleText).trim()) return roleText;
  if(roleCode === 'lead') return 'หัวหน้า';
  if(roleCode === 'junior') return 'ลูกเวร';
  return 'ได้ทั้งสอง';
}

window.clearPeopleForm = function(){
  editingOriginalName = '';
  if(personNameInput) personNameInput.value = '';
  if(personRoleInput) personRoleInput.value = '';
  if(addPersonBtn) addPersonBtn.textContent = 'เพิ่มรายชื่อ';
};

window.editPerson = function(nameEnc, roleEnc){
  const name = decodeURIComponent(nameEnc || '');
  const role = decodeURIComponent(roleEnc || '');
  editingOriginalName = name;

  if(personNameInput) personNameInput.value = name;
  if(personRoleInput) personRoleInput.value = role;
  if(addPersonBtn) addPersonBtn.textContent = 'บันทึกการแก้ไข';

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.removePerson = function(nameEnc){
  console.log('🔥 CLICK DELETE BUTTON', nameEnc);
  const name = decodeURIComponent(nameEnc || '');

  if(!token){
    showErr('กรุณาเข้าสู่ระบบก่อน');
    return;
  }

  Swal.fire({
    title: 'ยืนยันการลบรายชื่อ',
    text: `ต้องการลบ "${name}" ใช่หรือไม่`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก'
  }).then(function(result){
    if(!result.isConfirmed) return;

    showLoading('กำลังลบรายชื่อ…');

    google.script.run
      .withSuccessHandler(function(){
        hideLoading();
        showOK('ลบรายชื่อแล้ว');
        window.clearPeopleForm();
        loadRosterPeopleManage();
        if(typeof initPeople === 'function') initPeople();
      })
      .withFailureHandler(function(e){
        hideLoading();
        showErr((e && e.message) || 'ลบรายชื่อไม่สำเร็จ');
      })
      .deleteRosterPerson(token, name);
  });
};

window.savePersonFromForm = function(){
  console.log('🔥 CLICK ADD BUTTON');
  const name = (personNameInput?.value || '').trim();
  const roleText = personRoleInput?.value || '';

  if(!token){
    showErr('กรุณาเข้าสู่ระบบก่อน');
    return;
  }

  if(!name){
    showErr('กรุณากรอกชื่อ - สกุล');
    return;
  }

  showLoading(editingOriginalName ? 'กำลังบันทึกการแก้ไข…' : 'กำลังเพิ่มรายชื่อ…');

  if(editingOriginalName){
    google.script.run
      .withSuccessHandler(function(){
        hideLoading();
        showOK('บันทึกการแก้ไขแล้ว');
        window.clearPeopleForm();
        loadRosterPeopleManage();
        if(typeof initPeople === 'function') initPeople();
      })
      .withFailureHandler(function(e){
        hideLoading();
        showErr((e && e.message) || 'บันทึกการแก้ไขไม่สำเร็จ');
      })
      .updateRosterPerson(token, editingOriginalName, { name, roleText });
  }else{
    google.script.run
      .withSuccessHandler(function(){
        hideLoading();
        showOK('เพิ่มรายชื่อแล้ว');
        window.clearPeopleForm();
        loadRosterPeopleManage();
        if(typeof initPeople === 'function') initPeople();
      })
      .withFailureHandler(function(e){
        hideLoading();
        showErr((e && e.message) || 'เพิ่มรายชื่อไม่สำเร็จ');
      })
      .addRosterPerson(token, { name, roleText });
  }
};

  function clearPeopleForm(){
    editingOriginalName = '';
    document.getElementById('personNameInput').value = '';
    document.getElementById('personRoleInput').value = '';
    const addBtn = document.getElementById('addPersonBtn');
    if(addBtn) addBtn.textContent = 'เพิ่มรายชื่อ';
  }

  function renderPeopleTable(rows){
  const tb = peopleTableBody || document.getElementById('peopleTableBody');
  if(!tb) return;

  if(!rows || !rows.length){
    tb.innerHTML = `
      <tr>
        <td colspan="4" class="muted">ยังไม่มีข้อมูลรายชื่อ</td>
      </tr>
    `;
    return;
  }

  tb.innerHTML = rows.map((p, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${escapeHtml_(p.name || '')}</td>
      <td>${escapeHtml_(roleLabelTH(p.roleText, p.role))}</td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn" type="button"
            onclick="window.editPerson('${encodeURIComponent(p.name || '')}','${encodeURIComponent(p.roleText || '')}')">
            แก้ไข
          </button>
          <button class="btn" type="button"
            onclick="window.removePerson('${encodeURIComponent(p.name || '')}')">
            ลบ
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

  function loadRosterPeopleManage(){
  const tb = peopleTableBody || document.getElementById('peopleTableBody');
  if(!tb) return;

  if(!token){
    tb.innerHTML = `
      <tr>
        <td colspan="4" class="muted">กรุณาเข้าสู่ระบบก่อน</td>
      </tr>
    `;
    return;
  }

  tb.innerHTML = `
    <tr>
      <td colspan="4" class="muted">กำลังโหลดข้อมูล...</td>
    </tr>
  `;

  google.script.run
    .withSuccessHandler(function(rows){
      renderPeopleTable(rows || []);
    })
    .withFailureHandler(function(e){
      tb.innerHTML = `
        <tr>
          <td colspan="4" class="error">${(e && e.message) || 'โหลดข้อมูลรายชื่อไม่สำเร็จ'}</td>
        </tr>
      `;
    })
    .getRosterPeopleFull(token);
}

  function editPerson(nameEnc, roleEnc){
    const name = decodeURIComponent(nameEnc || '');
    const role = decodeURIComponent(roleEnc || '');
    editingOriginalName = name;
    document.getElementById('personNameInput').value = name;
    document.getElementById('personRoleInput').value = role;
    const addBtn = document.getElementById('addPersonBtn');
    if(addBtn) addBtn.textContent = 'บันทึกการแก้ไข';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function removePerson(nameEnc){
  const name = decodeURIComponent(nameEnc || '');

  if(!token){
    showErr('กรุณาเข้าสู่ระบบก่อน');
    return;
  }

  Swal.fire({
    title: 'ยืนยันการลบรายชื่อ',
    text: `ต้องการลบ "${name}" ใช่หรือไม่`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก'
  }).then(function(result){
    if(!result.isConfirmed) return;

    showLoading('กำลังลบรายชื่อ...');

    google.script.run
      .withSuccessHandler(function(){
        hideLoading();
        showOK('ลบรายชื่อแล้ว');
        clearPeopleForm();
        loadRosterPeopleManage();
        if(typeof initPeople === 'function') initPeople();
      })
      .withFailureHandler(function(e){
        hideLoading();
        showErr((e && e.message) || 'ลบรายชื่อไม่สำเร็จ');
      })
      .deleteRosterPerson(token, name);
  });
}

function savePersonFromForm(){
  const name = (document.getElementById('personNameInput').value || '').trim();
  const roleText = document.getElementById('personRoleInput').value || '';

  if(!token){
    showErr('กรุณาเข้าสู่ระบบก่อน');
    return;
  }

  if(!name){
    showErr('กรุณากรอกชื่อ - สกุล');
    return;
  }

  showLoading(editingOriginalName ? 'กำลังบันทึกการแก้ไข...' : 'กำลังเพิ่มรายชื่อ...');

  if(editingOriginalName){
    google.script.run
      .withSuccessHandler(function(){
        hideLoading();
        showOK('บันทึกการแก้ไขแล้ว');
        clearPeopleForm();
        loadRosterPeopleManage();
        if(typeof initPeople === 'function') initPeople();
      })
      .withFailureHandler(function(e){
        hideLoading();
        showErr((e && e.message) || 'บันทึกการแก้ไขไม่สำเร็จ');
      })
      .updateRosterPerson(token, editingOriginalName, { name, roleText });
  }else{
    google.script.run
      .withSuccessHandler(function(){
        hideLoading();
        showOK('เพิ่มรายชื่อแล้ว');
        clearPeopleForm();
        loadRosterPeopleManage();
        if(typeof initPeople === 'function') initPeople();
      })
      .withFailureHandler(function(e){
        hideLoading();
        showErr((e && e.message) || 'เพิ่มรายชื่อไม่สำเร็จ');
      })
      .addRosterPerson(token, { name, roleText });
  }
}

  function escapeHtml_(s){
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

function bindPeopleManageButtons_(){
  if(addPersonBtn){
    addPersonBtn.onclick = window.savePersonFromForm;
  }
  if(clearPersonFormBtn){
    clearPersonFormBtn.onclick = window.clearPeopleForm;
  }
}

bindPeopleManageButtons_();


let editingAdminUsername = '';

function clearAdminUserForm(){
  editingAdminUsername = '';
  if(adminUserUsername) adminUserUsername.value = '';
  if(adminUserPassword) adminUserPassword.value = '';
  if(adminUserRole) adminUserRole.value = 'viewer';
  if(adminUserPersonName) adminUserPersonName.value = '';
  if(adminUserActive) adminUserActive.value = 'TRUE';
  if(adminUserSaveBtn) adminUserSaveBtn.textContent = 'เพิ่มผู้ใช้';
}

function renderAdminUsersTable(rows){
  if(!adminUsersTableBody) return;

  if(!rows || !rows.length){
    adminUsersTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="muted">ยังไม่มีข้อมูลผู้ใช้</td>
      </tr>
    `;
    return;
  }

  adminUsersTableBody.innerHTML = rows.map((u, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${escapeHtml_(u.username || '')}</td>
      <td>●●●●●●</td>
      <!--<td>${escapeHtml_(u.password || '')}</td>-->
      <td>${escapeHtml_(u.role || '')}</td>
      <td>${escapeHtml_(u.personName || '')}</td>
      <td>${u.active ? 'TRUE' : 'FALSE'}</td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn" type="button"
            onclick="window.editAdminUser('${encodeURIComponent(u.username||'')}')">แก้ไข</button>
          <button class="btn" type="button"
            onclick="window.removeAdminUser('${encodeURIComponent(u.username||'')}')">ลบ</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function loadAdminUsers(){
  if(!adminUsersTableBody) return;

  if(!token){
    adminUsersTableBody.innerHTML = `
      <tr><td colspan="7" class="muted">กรุณาเข้าสู่ระบบก่อน</td></tr>
    `;
    return;
  }

  adminUsersTableBody.innerHTML = `
    <tr><td colspan="7" class="muted">กำลังโหลดข้อมูล...</td></tr>
  `;

  google.script.run
    .withSuccessHandler(function(rows){
      renderAdminUsersTable(rows || []);
    })
    .withFailureHandler(function(e){
      adminUsersTableBody.innerHTML = `
        <tr><td colspan="7" class="error">${(e && e.message) || 'โหลดข้อมูลผู้ใช้ไม่สำเร็จ'}</td></tr>
      `;
    })
    .getUsersForAdmin(token);
}

window.editAdminUser = function(usernameEnc){
  const username = decodeURIComponent(usernameEnc || '');
  if(!username) return;

  google.script.run
    .withSuccessHandler(function(rows){
      const row = (rows || []).find(x => String(x.username||'') === username);
      if(!row){
        showErr('ไม่พบข้อมูลผู้ใช้');
        return;
      }

      editingAdminUsername = row.username;
      if(adminUserUsername) adminUserUsername.value = row.username || '';
      if(adminUserPassword) adminUserPassword.value = row.password || '';
      if(adminUserRole) adminUserRole.value = row.role || 'viewer';
      if(adminUserPersonName) adminUserPersonName.value = row.personName || '';
      if(adminUserActive) adminUserActive.value = row.active ? 'TRUE' : 'FALSE';
      if(adminUserSaveBtn) adminUserSaveBtn.textContent = 'บันทึกการแก้ไข';

      window.scrollTo({ top: 0, behavior: 'smooth' });
    })
    .withFailureHandler(function(e){
      showErr((e && e.message) || 'โหลดข้อมูลผู้ใช้ไม่สำเร็จ');
    })
    .getUsersForAdmin(token);
};

window.removeAdminUser = function(usernameEnc){
  const username = decodeURIComponent(usernameEnc || '');
  if(!username){
    showErr('ไม่พบ Username');
    return;
  }

  Swal.fire({
    title: 'ยืนยันการลบผู้ใช้',
    text: `ต้องการลบ "${username}" ใช่หรือไม่`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก'
  }).then(function(result){
    if(!result.isConfirmed) return;

    showLoading('กำลังลบผู้ใช้...');

    google.script.run
      .withSuccessHandler(function(){
        hideLoading();
        showOK('ลบผู้ใช้แล้ว');
        clearAdminUserForm();
        loadAdminUsers();
      })
      .withFailureHandler(function(e){
        hideLoading();
        showErr((e && e.message) || 'ลบผู้ใช้ไม่สำเร็จ');
      })
      .deleteUserByAdmin(token, username);
  });
};

window.saveAdminUserFromForm = function(){
  const username = (adminUserUsername?.value || '').trim();
  const password = (adminUserPassword?.value || '').trim();
  const role = adminUserRole?.value || 'viewer';
  const personName = (adminUserPersonName?.value || '').trim();
  const active = adminUserActive?.value || 'TRUE';

  if(!token){
    showErr('กรุณาเข้าสู่ระบบก่อน');
    return;
  }

  if(!username){
    showErr('กรุณากรอก Username');
    return;
  }
  if(!password){
    showErr('กรุณากรอก Password');
    return;
  }
  if(!personName){
    showErr('กรุณากรอก Person Name');
    return;
  }

  showLoading(editingAdminUsername ? 'กำลังบันทึกการแก้ไขผู้ใช้...' : 'กำลังเพิ่มผู้ใช้...');

  const payload = { username, password, role, personName, active };

  if(editingAdminUsername){
    google.script.run
      .withSuccessHandler(function(){
        hideLoading();
        showOK('บันทึกการแก้ไขแล้ว');
        clearAdminUserForm();
        loadAdminUsers();
      })
      .withFailureHandler(function(e){
        hideLoading();
        showErr((e && e.message) || 'บันทึกการแก้ไขไม่สำเร็จ');
      })
      .updateUserByAdmin(token, editingAdminUsername, payload);
  }else{
    google.script.run
      .withSuccessHandler(function(){
        hideLoading();
        showOK('เพิ่มผู้ใช้แล้ว');
        clearAdminUserForm();
        loadAdminUsers();
      })
      .withFailureHandler(function(e){
        hideLoading();
        showErr((e && e.message) || 'เพิ่มผู้ใช้ไม่สำเร็จ');
      })
      .addUserByAdmin(token, payload);
  }
};

function bindAdminUsersButtons_(){
  if(adminUserSaveBtn) adminUserSaveBtn.onclick = window.saveAdminUserFromForm;
  if(adminUserClearBtn) adminUserClearBtn.onclick = clearAdminUserForm;
}

bindAdminUsersButtons_();

function onOpenAdminPage(){
  loadAdminUsers();
  clearAdminUserForm();

  if(role === 'inspector'){
    refreshInspectList();
  }

  if(role === 'editor'){
    refreshPending();
  }
}

      // ===== People =====
      function initPeople(){
        google.script.run.withSuccessHandler(function(list){
          // ✅ รองรับ list เป็น string[] หรือ object[] (มี role)
          rebuildLeaderEligibleSet_(list);

          rqRequester.innerHTML = '';
historyFor.innerHTML = '';
r_manualStart.innerHTML = '<option value="">(ไม่กำหนด)</option>';
attPerson.innerHTML = '';

rosterNames.forEach(function(n){
  const o1 = document.createElement('option');
  o1.value = o1.textContent = n;
  rqRequester.appendChild(o1);

  const o2 = document.createElement('option');
  o2.value = o2.textContent = n;
  historyFor.appendChild(o2);

  const om = document.createElement('option');
  om.value = om.textContent = n;
  r_manualStart.appendChild(om);

  const oa = document.createElement('option');
  oa.value = oa.textContent = n;
  attPerson.appendChild(oa);
});


window.__rosterPeople = rosterNames || [];

renderWeekdayS2FixedNames(window.__rosterPeople, []);
toggleWeekdayS2FixedUI();
fillCovererSelect(null);
fillHistoryForSelect(currentPersonName);

          updateUserDisplay();

          if(role==='editor') loadRules();
          populateRequesterFromDayShift();
          validateSwapForm();
          refreshInbox();
          refreshHistory();

        }).getRosterPeople();
      }
       

       // ===== Attendance submit =====
attSubmit.onclick = function () {
  const day = parseInt(attDay.value, 10);
  const shift = String(attShift.value || '').trim();
  const action = String(attAction?.value || 'IN').toUpperCase();

  if (!token) { showErr('กรุณาเข้าสู่ระบบก่อน'); return; }
  if (!day || !shift) { showErr('กรุณากรอกข้อมูลให้ครบ'); return; }
  //if (!snapData) { showErr('กรุณาถ่ายภาพก่อนบันทึกการลงชื่อ'); return; }
  // Camera capture is disabled; recordAttendance accepts a null photo payload.
  showLoading('กำลังบันทึกการลงชื่อปฏิบัติงาน…');

  // --- NEW: เปิด popup กรอกเหตุขัดข้อง (เฉพาะหัวหน้าเวรตอน OUT) ---
async function askOutageDetailsPopup_() {
  const deviceOptions = await new Promise((resolve) => {
    google.script.run
      .withSuccessHandler(function (list) {
        resolve(Array.isArray(list) ? list : []);
      })
      .withFailureHandler(function (err) {
        console.error('getDeviceLocationOptions error:', err);
        resolve([]);
      })
      .getDeviceLocationOptions();
  });

  const result = await Swal.fire({
    title: 'สรุปเหตุการณ์ไฟฟ้าขัดข้องก่อนลงชื่อออก',
    width: 720,
    heightAuto: false,
    customClass: {
      popup: 'pea-outage-popup',
      confirmButton: 'pea-btn-primary',
      cancelButton: 'pea-btn-secondary'
    },
    html: `
<div class="pea-outage-wrap">

  <div class="pea-outage-grid">
    <div>
      <label>แรงสูง (จำนวนรายการ)</label>
      <input id="sw_hv" type="number" min="0" step="1" class="swal2-input pea-input" value="0">
    </div>
    <div>
      <label>แรงต่ำ (จำนวนรายการ)</label>
      <input id="sw_lv" type="number" min="0" step="1" class="swal2-input pea-input" value="0">
    </div>
  </div>

  <div class="pea-divider"></div>

  <div class="pea-row-header">
    <b>รายการไฟดับ</b>
    <button type="button" id="sw_addRow" class="pea-mini-btn">+ เพิ่ม</button>
  </div>

  <datalist id="deviceLocationList"></datalist>

  <div id="sw_rows" class="pea-rows"></div>

  <div class="pea-note">
    * ระยะเวลาไฟดับ ให้ระบุเป็น นาที
  </div>

</div>
`,
    showCancelButton: true,
    confirmButtonText: 'ยืนยันและลงชื่อออก',
    cancelButtonText: 'ยกเลิก',

    didOpen: () => {
      const rowsEl = document.getElementById('sw_rows');
      const addBtn = document.getElementById('sw_addRow');
      const dataListEl = document.getElementById('deviceLocationList');

      // เติม options ลง datalist ครั้งเดียว
      dataListEl.innerHTML = deviceOptions
        .map(v => `<option value="${escapeHtml_(v)}"></option>`)
        .join('');

function addRow(site = '', minutes = '') {
  const id = 'r' + Math.random().toString(16).slice(2);
  const wrap = document.createElement('div');

  wrap.className = 'pea-outage-row';
  wrap.dataset.rowid = id;

  wrap.innerHTML = `
    <div class="pea-outage-mainline">
      <div class="pea-autocomplete pea-site-box">
        <input class="sw_site"
          placeholder="พิมพ์รหัสอุปกรณ์ / ชื่อสถานที่"
          value="${escapeHtml_(site)}">
      </div>

      <input class="sw_min" type="number" min="0" step="1"
        placeholder="นาที"
        value="${escapeHtml_(minutes)}">

      <select class="sw_vlevel">
        <option value="">ระดับ</option>
        <option value="HV">แรงสูง</option>
        <option value="LV">แรงต่ำ</option>
      </select>

      <select class="sw_cause">
        <option value="ไม่ทราบสาเหตุ">ไม่ทราบสาเหตุ</option>
        <option value="ต้นไม้/กิ่งไม้">ต้นไม้/กิ่งไม้</option>
        <option value="สัตว์">สัตว์</option>
        <option value="อุปกรณ์ชำรุด">อุปกรณ์ชำรุด</option>
        <option value="ฟ้าผ่า/ฝนตก/ลมแรง">ฟ้าผ่า/ฝนตก/ลมแรง</option>
        <option value="บุคคลภายนอก/รถชน">บุคคลภายนอก/รถชน</option>
        <option value="โหลดเกิน">โหลดเกิน</option>
        <option value="สายขาด/สายแตะกัน">สายขาด/สายแตะกัน</option>
        <option value="อื่น ๆ">อื่น ๆ</option>
      </select>

      <button type="button" class="sw_del" title="ลบรายการ">✕</button>
    </div>

    <textarea class="sw_note"
      placeholder="หมายเหตุเพิ่มเติม (ไม่บังคับ) เช่น พบกิ่งไม้ใกล้แนวสาย / ฟิวส์ขาดซ้ำ / จุดเดิมเคยเกิดเหตุ"></textarea>
  `;

  const input = wrap.querySelector('.sw_site');
  attachAutoComplete(input, deviceOptions);

  wrap.querySelector('.sw_del').onclick = () => wrap.remove();

  rowsEl.appendChild(wrap);
}

      addRow();
      addBtn.onclick = () => addRow();
    },

    preConfirm: () => {
      const hv = Number(document.getElementById('sw_hv').value || 0);
      const lv = Number(document.getElementById('sw_lv').value || 0);

      const rows = Array.from(document.querySelectorAll('#sw_rows > div'));
      const outages = rows.map(r => {
  const site = String(r.querySelector('.sw_site')?.value || '').trim();
  const minutes = Number(r.querySelector('.sw_min')?.value || 0);
  const voltageLevel = String(r.querySelector('.sw_vlevel')?.value || '').trim();
  const cause = String(r.querySelector('.sw_cause')?.value || 'ไม่ทราบสาเหตุ').trim();
  const causeNote = String(r.querySelector('.sw_note')?.value || '').trim();

  return { site, minutes, voltageLevel, cause, causeNote };
}).filter(x => x.site || x.minutes || x.causeNote);

      if (hv < 0 || lv < 0) {
        Swal.showValidationMessage('จำนวนรายการต้องเป็น 0 หรือมากกว่า');
        return false;
      }

      for (const o of outages) {
        if (o.minutes < 0 || !Number.isFinite(o.minutes)) {
          Swal.showValidationMessage('นาทีไฟดับต้องเป็นตัวเลข 0 หรือมากกว่า');
          return false;
        }
      }

      return { hvCount: hv, lvCount: lv, outages };
    }
  });

  if (!result.isConfirmed) return null;
  return result.value;
}

function escapeHtml_(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

  // --- NEW: ตรวจว่าเป็นหัวหน้าเวรไหม (ใช้ GAS ช่วยตัดสิน) ---
  function checkIsLeaderOut_(cb) {
  google.script.run
    .withSuccessHandler(function (res) {

      // 🔍 DEBUG ดูค่าที่ GAS ส่งกลับมา
      console.log('isLeaderOnShift response =', res);

      cb(null, !!(res && res.isLeader));
    })
    .withFailureHandler(function (e) {
      console.error('isLeaderOnShift error =', e);
      cb(e);
    })
    .isLeaderOnShift(token, BE_YEAR, currentMonth, day, shift);
}

  function doSend(lat, lng, extraPayload) {
  const clientIso = new Date().toISOString();

  // ✅ ใช้รูปจาก GitHub ก่อน ถ้าไม่มีค่อย fallback ไป snapData
  const photoData = window.__cameraImage || snapData || null;

  google.script.run
    .withSuccessHandler(function (res) {
  hideLoading();

  const msg = res && res.note
    ? `${res.note}\nServer: ${res.serverTime}`
    : 'บันทึกการลงชื่อแล้ว';

  showOK(msg);
  resetAttendanceForm();

  // ✅ เมื่อลงชื่อสำเร็จ ถ้าเป็นหัวหน้าเวร ให้ไปหน้า ส่งมอบ/รับมอบ อัตโนมัติ
  google.script.run
    .withSuccessHandler(function(chk){
      if(chk && chk.isLeader){
        goToHandoverPageAfterAttendance_();
      }
    })
    .withFailureHandler(function(e){
      console.warn('ตรวจสอบหัวหน้าเวรหลังลงชื่อไม่สำเร็จ:', e);
    })
    .isLeaderOnShift(token, BE_YEAR, currentMonth, day, shift);
})
    .withFailureHandler(function (e) {
      hideLoading();
      showErr(e.message || 'บันทึกการลงชื่อไม่สำเร็จ');
    })
    .recordAttendance(
      token,
      BE_YEAR,
      currentMonth,
      day,
      shift,
      action,
      clientIso,
      lat,
      lng,
      photoData,
      extraPayload || null
    );
}

  // ---- FLOW หลัก ----
  function proceedWithGeoAndSend(extraPayload) {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const lat = pos.coords.latitude, lng = pos.coords.longitude;
          attGeo.textContent = `ตำแหน่ง: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          doSend(lat, lng, extraPayload);
        },
        err => {
          let reason = 'เกิดข้อผิดพลาด';
          if (err && err.code === 1) reason = 'ผู้ใช้ไม่อนุญาตสิทธิ์ Location (Permission denied)';
          else if (err && err.code === 2) reason = 'ไม่สามารถระบุตำแหน่งได้ (Position unavailable)';
          else if (err && err.code === 3) reason = 'ใช้เวลานานเกินไป (Timeout)';
          attGeo.textContent = `ตำแหน่ง: ไม่สามารถดึงพิกัดได้ (${reason})`;
          doSend(null, null, extraPayload);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    } else {
      attGeo.textContent = 'ตำแหน่ง: เบราว์เซอร์ไม่รองรับการขอพิกัด';
      doSend(null, null, extraPayload);
    }
  }

  // เงื่อนไขใหม่: OUT + หัวหน้าเวร => popup ก่อน
  if (action === 'OUT') {
    checkIsLeaderOut_(async function (err, isLeader) {
      if (err) { hideLoading(); showErr(err.message || 'ตรวจสอบหัวหน้าเวรไม่สำเร็จ'); return; }

      if (isLeader) {
        hideLoading(); // ซ่อน loading ก่อนเปิด popup
        const payload = await askOutageDetailsPopup_();
        if (!payload) { showErr('ยกเลิกการลงชื่อออก'); return; }

        showLoading('กำลังบันทึกการลงชื่อออก…');
        proceedWithGeoAndSend({
  type: 'OUTAGE_SUMMARY',
  ...payload
});
      } else {
        // ไม่ใช่หัวหน้าเวร -> ออกได้เลย (ไม่ถาม)
        proceedWithGeoAndSend(null);
      }
    });
  } else {
    // IN -> ปกติ
    proceedWithGeoAndSend(null);
  }
};

      /*// ===== Attendance submit =====
      attSubmit.onclick=function(){
        const day=parseInt(attDay.value,10);
        const shift=String(attShift.value||'').trim();
        const action = String(attAction?.value || 'IN').toUpperCase();

        if(!token){ showErr('กรุณาเข้าสู่ระบบก่อน'); return; }
        if(!day || !shift){ showErr('กรุณากรอกข้อมูลให้ครบ'); return; }
        if(!snapData){ showErr('กรุณาถ่ายภาพก่อนบันทึกการลงชื่อ'); return; }

        showLoading('กำลังบันทึกการลงชื่อปฏิบัติงาน…');

        function doSend(lat,lng){
          const clientIso = new Date().toISOString();
          google.script.run
            .withSuccessHandler(function(res){
              hideLoading();
              const msg = res && res.note ? `${res.note}\nServer: ${res.serverTime}` : 'บันทึกการลงชื่อแล้ว';
              showOK(msg);
              resetAttendanceForm();
            })
            .withFailureHandler(function(e){
              hideLoading();
              showErr(e.message||'บันทึกการลงชื่อไม่สำเร็จ');
            })
            .recordAttendance(token, BE_YEAR, currentMonth, day, shift, action, clientIso, lat, lng, snapData);
        }

        if(navigator.geolocation){
          navigator.geolocation.getCurrentPosition(
            pos => {
              const lat = pos.coords.latitude, lng = pos.coords.longitude;
              attGeo.textContent = `ตำแหน่ง: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
              doSend(lat, lng);
            },
            err => {
              let reason = 'เกิดข้อผิดพลาด';
              if (err && err.code === 1) reason = 'ผู้ใช้ไม่อนุญาตสิทธิ์ Location (Permission denied)';
              else if (err && err.code === 2) reason = 'ไม่สามารถระบุตำแหน่งได้ (Position unavailable)';
              else if (err && err.code === 3) reason = 'ใช้เวลานานเกินไป (Timeout)';

              attGeo.textContent = `ตำแหน่ง: ไม่สามารถดึงพิกัดได้ (${reason})`;
              doSend(null, null);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
          );
        }else{
          attGeo.textContent = 'ตำแหน่ง: เบราว์เซอร์ไม่รองรับการขอพิกัด';
          doSend(null, null);
        }
      };*/

      // ===== Export Daily Sign PDF (try multiple names) =====
      function exportDailySignPdf(){
        const day = parseInt(expDay.value,10);
        if(!token){ showErr('กรุณาเข้าสู่ระบบก่อน'); return; }
        if(!day || day<1 || day>31){ showErr('กรุณาระบุวันที่ให้ถูกต้อง'); return; }

        const CANDIDATES = [
          'exportDailySignPdf',
          'exportDailyAttendancePdf',
          'exportAttendanceDailyPdf',
          'exportDayAttendancePdf'
        ];

        expDailyResult.style.display='none';
        expDailyResult.innerHTML='';

        showLoading('กำลังสร้าง PDF ใบลงชื่อ 1 วัน…');

        function tryCall(idx){
          if(idx >= CANDIDATES.length){
            hideLoading();
            showErr('ไม่พบฟังก์ชันส่งออกใบลงชื่อรายวันในฝั่ง GS (ตรวจชื่อฟังก์ชัน)');
            return;
          }
          const fn = CANDIDATES[idx];

          try{
            const runner = google.script.run
              .withSuccessHandler(function(res){
                hideLoading();
                const url = res && res.url ? res.url : '';
                expDailyResult.style.display='block';
                expDailyResult.innerHTML = url
                  ? `สร้างไฟล์สำเร็จ: <a href="${url}" target="_blank" rel="noopener">เปิด PDF</a>`
                  : 'สร้างไฟล์สำเร็จ แต่ไม่พบลิงก์ไฟล์';
                if(url) try{ window.open(url,'_blank'); }catch(e){}
                showOK('ส่งออกใบลงชื่อสำเร็จ');
              })
              .withFailureHandler(function(e){
                const msg = (e && e.message) ? String(e.message) : '';
                const looksLikeMissing =
                  msg.includes('is not a function') ||
                  msg.includes('not defined') ||
                  msg.includes('No signature of method');
                if(looksLikeMissing) tryCall(idx+1);
                else { hideLoading(); showErr(msg || 'ส่งออกไม่สำเร็จ'); }
              });

            if(typeof runner[fn] !== 'function'){ tryCall(idx+1); return; }
            runner[fn](token, BE_YEAR, currentMonth, day);

          }catch(err){
            tryCall(0);
          }
        }

        tryCall(0);
      }
      expDailyBtn?.addEventListener('click', exportDailySignPdf);

      // ===== Month nav / actions =====
      prevBtn.onclick=function(){ if(currentMonth>1){ currentMonth--; render(); } };
      nextBtn.onclick=function(){ if(currentMonth<12){ currentMonth++; render(); } };
      refreshBtn.onclick=function(){ render(); showOK('รีเฟรชแล้ว'); };
      
      const inspectRefreshBtn = document.getElementById('inspectRefreshBtn');
if(inspectRefreshBtn){
  inspectRefreshBtn.onclick = refreshInspectList;
}

      genBtn.onclick=function(){
        showLoading('กำลังจัดตารางเวร…');
        google.script.run
          .withSuccessHandler(function(){ hideLoading(); render(); showOK('จัดตารางเวรสำเร็จ'); })
          .withFailureHandler(function(e){ hideLoading(); showErr(e.message||'จัดตารางเวรล้มเหลว'); })
          .generateRosterMonth(token,BE_YEAR,currentMonth);
      };

      createBtn.onclick = async function(){

  // (ถ้ามีพวกตัวแปรปี/เดือนอยู่แล้ว ส่งเข้ามาได้)
  const confirmed = await confirmCreateCalendarTwoStep({
    beYear: (typeof BE_YEAR !== 'undefined' ? BE_YEAR : ''),
    month: (typeof currentMonth !== 'undefined' ? currentMonth : ''),
    note: 'แนะนำให้ตรวจสอบว่ามีการสำรองข้อมูลก่อนดำเนินการ'
  });

  if(!confirmed) return;

  showLoading('กำลังสร้างปฏิทิน…');
  google.script.run
    .withSuccessHandler(function(){
      hideLoading();
      render();
      showOK('สร้างปฏิทินแล้ว');
    })
    .withFailureHandler(function(e){
      hideLoading();
      showErr(e.message||'สร้างปฏิทินล้มเหลว');
    })
    .createMonthlySheetsForBE(token);
};
      

      async function confirmCreateCalendarTwoStep(opts){
  // opts: { beYear, month, note }
  const beYear = opts?.beYear ?? '';
  const month  = opts?.month ?? '';
  const note   = opts?.note ?? '';

  const confirmWord = 'CREATE';

  // ชั้นที่ 1
  const step1 = await Swal.fire({
    icon: 'warning',
    title: 'ยืนยันการสร้างปฏิทิน (ขั้นที่ 1)?',
    html: `
      <div style="text-align:left;line-height:1.6">
        <b>การดำเนินการ:</b> สร้าง/เตรียมชีตรายเดือนสำหรับระบบตารางเวร<br>
        <b>ปี (พ.ศ.):</b> ${beYear || '-'}<br>
        <b>เดือน:</b> ${month || '(อาจสร้างครบทั้งปี ตามฟังก์ชันฝั่ง Server)'}<br>
        ${note ? `<b>หมายเหตุ:</b> ${note}<br>` : ''}
        <span style="color:#666">คำเตือน: การกดปุ่มนี้มีผลต่อโครงสร้างข้อมูลรายเดือน</span>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'ดำเนินการต่อ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#6b1fa7',
    reverseButtons: true,
    focusCancel: true
  });

  if(!step1.isConfirmed) return false;

  // ชั้นที่ 2 (พิมพ์คำยืนยัน)
  const step2 = await Swal.fire({
    icon: 'question',
    title: `พิมพ์คำว่า ${confirmWord}`,
    html: `
      <div style="text-align:left;line-height:1.6">
        เพื่อยืนยันการ <b>สร้างปฏิทิน</b> อย่างถาวร<br>
        <span style="color:#666">พิมพ์ให้ตรงตัวพิมพ์ใหญ่ทั้งหมด</span>
      </div>
    `,
    input: 'text',
    inputPlaceholder: `พิมพ์ ${confirmWord}`,
    showCancelButton: true,
    confirmButtonText: 'ยืนยันสร้าง',
    cancelButtonText: 'ย้อนกลับ',
    confirmButtonColor: '#6b1fa7',
    reverseButtons: true,
    preConfirm: (value)=>{
      if(value !== confirmWord){
        Swal.showValidationMessage(`ต้องพิมพ์คำว่า ${confirmWord} ให้ถูกต้อง`);
        return false;
      }
      return true;
    }
  });

  return !!step2.isConfirmed;
}


      // ===== Month select =====
      (function initMonthSelect(){
        monthSelect.innerHTML='';
        TH_MONTHS.forEach(function(m,i){
          const o=document.createElement('option');
          o.value=String(i+1);
          o.textContent=`${m} ${BE_YEAR}`;
          monthSelect.appendChild(o);
        });
        monthSelect.value=String(currentMonth);
        monthSelect.onchange=function(){
          currentMonth=parseInt(monthSelect.value,10);
          render();
        };
      })();

      // ===== Login / Logout =====
      function resetLoginForm(){
        uEl.value='';
        pEl.value='';
        clearErr();
      }

      function doLogin(){
        const user=(uEl.value||'').trim(), pass=(pEl.value||'').trim();
        if(!user||!pass){ errBox('กรุณากรอกผู้ใช้และรหัสผ่าน'); return; }
        [loginBtn,uEl,pEl].forEach(el=>el.disabled=true);
        infoBox('กำลังเข้าสู่ระบบ…');

        google.script.run
          .withSuccessHandler(function(res){
            [loginBtn,uEl,pEl].forEach(el=>el.disabled=false);
            if(!res || !res.ok){ errBox(res && res.message ? res.message : 'เข้าสู่ระบบไม่สำเร็จ'); return; }

            token=res.token; role=res.role;
            currentUser = res.user || '';
            currentPersonName = res.personName || '';

            window.__token = token;
            window.__personName = currentPersonName;
            window.__role = role;
            
            // ✅ persist auth (for refresh)
try{
  sessionStorage.setItem('pea_token', token);
  sessionStorage.setItem('pea_role', role);
  sessionStorage.setItem('pea_user', currentUser);
  sessionStorage.setItem('pea_personName', currentPersonName);
}catch(e){}


            loginWrap.classList.add('login-hidden');

            document.querySelectorAll('.collapse-card').forEach(card=>card.classList.add('collapsed'));

            setRoleUI();
            updateUserDisplay();
            initPeople();
            render();
            showPage('calendar');
            Swal.fire({icon:'success',title:'เข้าสู่ระบบแล้ว',timer:900,showConfirmButton:false});

            resetAttendanceForm();
            resetSwapRequestForm();
            resetLoginForm();
          })
          .withFailureHandler(function(err){
            [loginBtn,uEl,pEl].forEach(el=>el.disabled=false);
            errBox(err.message||'เข้าสู่ระบบล้มเหลว');
          })
          .login(user,pass);
      }
      loginBtn.onclick=doLogin;
      pEl.addEventListener('keypress', e=>{ if(e.key==='Enter') doLogin(); });
      uEl.addEventListener('input', clearErr);
      pEl.addEventListener('input', clearErr);

      function resetToLogin(){
        if(token) google.script.run.logout(token);
        token=null; role='viewer';
        currentUser=''; currentPersonName='';

        window.__token = null;
        window.__personName = '';
        window.__role = 'viewer';


        stopCamera();
        clearRoleUI();

        currentMonth = (new Date().getMonth() + 1);
        monthSelect.value = String(currentMonth);

        calendarWrap.innerHTML='';
        summaryWrap.innerHTML='';
        historyList.innerHTML='';
        pendingList.innerHTML='';
        if(inboxList) inboxList.innerHTML='';

        if(pdfLinkEl && pdfLinkEl.parentNode) pdfLinkEl.parentNode.removeChild(pdfLinkEl);
        if(swapSummaryPdfLinkEl && swapSummaryPdfLinkEl.parentNode) swapSummaryPdfLinkEl.parentNode.removeChild(swapSummaryPdfLinkEl);
        if(swapSumPdfLinkWrap) swapSumPdfLinkWrap.textContent = '';

        loginWrap.classList.remove('login-hidden');
        showPage('calendar');
        updateUserDisplay();
        openMobileSidebar(false);

        resetAttendanceForm();
        resetSwapRequestForm();

        try{
  sessionStorage.removeItem('pea_token');
  sessionStorage.removeItem('pea_role');
  sessionStorage.removeItem('pea_user');
  sessionStorage.removeItem('pea_personName');
}catch(e){}

      }

      switchBtn.onclick = resetToLogin;
      logoutBtn.onclick=function(){
        resetToLogin();
        Swal.fire({icon:'success',title:'ออกจากระบบแล้ว',timer:900,showConfirmButton:false});
      };

      // ===== Ping =====
      google.script.run.withSuccessHandler(function(){}).withFailureHandler(function(){
        errBox('ไม่สามารถติดต่อ Apps Script ได้ โปรดรีเฟรชหน้า');
      }).ping();

      // ===== Start =====
      showPage('calendar');
      setNavRoleVisibility();
      startClock();
      updateUserDisplay();
      resetAttendanceForm();
      if(!rqDay.value) rqDay.value = String(new Date().getDate());
      if(!expDay.value) expDay.value = String(new Date().getDate());
      updateViewBtnLabel_();
      // ===== Auto login if token exists (no login flash) =====
function showLoginOnly_(){
  // ✅ เปิดหน้า login แบบ "ตั้งใจ" เมื่อ token ใช้ไม่ได้เท่านั้น
  try{ document.documentElement.classList.remove('has-token'); }catch(e){}
  loginWrap.classList.remove('login-hidden'); // เผื่อกรณีคุณเคยซ่อนด้วย class
  loginWrap.style.display = '';              // เผื่อถูก inline display:none มา
  clearRoleUI();
  token=null; role='viewer';
  currentUser=''; currentPersonName='';
  updateUserDisplay();

  try{
    sessionStorage.removeItem('pea_token');
    sessionStorage.removeItem('pea_role');
    sessionStorage.removeItem('pea_user');
    sessionStorage.removeItem('pea_personName');
  }catch(e){}
}

if(token){
  // ✅ ซ่อน login ตั้งแต่ต้น + แสดง loading ระหว่างตรวจ token
  try{ document.documentElement.classList.add('has-token'); }catch(e){}
  showLoading('กำลังตรวจสอบสิทธิ์เข้าสู่ระบบ…');

  google.script.run
    .withSuccessHandler(function(res){
      if(res && res.ok){
        role = res.role || role;
        currentUser = res.user || currentUser;
        currentPersonName = res.personName || currentPersonName;

        window.__token = token;
        window.__role = role;
        window.__personName = currentPersonName;

        try{
          sessionStorage.setItem('pea_role', role);
          sessionStorage.setItem('pea_user', currentUser);
          sessionStorage.setItem('pea_personName', currentPersonName);
        }catch(e){}

        hideLoading();
        loginWrap.classList.add('login-hidden'); // กันไว้ซ้ำ
        setRoleUI();
        updateUserDisplay();
        initPeople();
        render();
        showPage('calendar');
      }else{
        hideLoading();
        showLoginOnly_();
      }
    })
    .withFailureHandler(function(){
      hideLoading();
      showLoginOnly_();
    })
    .validateToken(token);
}else{
  // ✅ ไม่มี token => ให้แสดงหน้า login ปกติ
  try{ document.documentElement.classList.remove('has-token'); }catch(e){}
}




    });

    // ✅ Keep content below fixed topbar (auto height)
(function fixTopbarHeight(){
  const topbarEl = document.querySelector('.topbar');
  if(!topbarEl) return;

  const setH = () => {
    document.documentElement.style.setProperty('--topbarH', topbarEl.offsetHeight + 'px');
  };

  setH();
  window.addEventListener('resize', setH);

  if('ResizeObserver' in window){
    const ro = new ResizeObserver(setH);
    ro.observe(topbarEl);
  }
})();

function openManualEditShift_(day, shift, currentNames){
  const tk = (window.__token) || (function(){ try{return sessionStorage.getItem('pea_token');}catch(e){return null;} })();
  const rl = (window.__role)  || (function(){ try{return sessionStorage.getItem('pea_role')||'viewer';}catch(e){return 'viewer';} })();

  if(!tk){ showErr('กรุณาเข้าสู่ระบบก่อน'); return; }
  if(rl !== 'editor'){ showErr('ท่านไม่มีสิทธิ์ดำเนินการ'); return; }

  showLoading('กำลังโหลดรายชื่อ…');

  google.script.run
    .withSuccessHandler(function(names){
      hideLoading();

      const roster = Array.isArray(names) ? names : [];
      const curSet = new Set((currentNames||[]).map(n=>normText_(n)).filter(Boolean));

      const listHtml = roster.map(n=>{
        const nn = normText_(n);
        const checked = curSet.has(nn) ? 'checked' : '';
        return `
          <label style="display:flex;gap:10px;align-items:center;padding:6px 0;border-bottom:1px dashed rgba(0,0,0,.08)">
            <input type="checkbox" class="me-name" value="${escapeHtml_(n)}" ${checked}/>
            <span>${escapeHtml_(n)}</span>
          </label>
        `;
      }).join('');

      Swal.fire({
  title: `แก้ไขเวร (วันที่ ${day} / กะ ${shift})`,
  html: `
    <div style="text-align:left">
      <div class="muted" style="margin-bottom:8px">
        เลือก/ยกเลิกรายชื่อได้ • ถ้าไม่เลือกเลย = ลบทั้งบรรทัดกะนี้
      </div>
      <div class="pea-picklist">
        ${listHtml || '<div class="muted">ไม่พบรายชื่อพนักงาน</div>'}
      </div>
    </div>
  `,
  showCancelButton: true,
  showDenyButton: true,
  confirmButtonText: 'บันทึก',
  denyButtonText: 'ล้างทั้งหมด',
  cancelButtonText: 'ยกเลิก',

  // ✅ ให้ SweetAlert2 ใช้ class ปุ่มของเว็บเรา
  buttonsStyling: false,
  customClass: {
    popup: 'pea-swal',
    confirmButton: 'btn primary',
    denyButton: 'btn danger',
    cancelButton: 'btn'
  },

  preConfirm: () => {
    const cbs = Array.from(document.querySelectorAll('.me-name'));
    const picked = cbs.filter(x=>x.checked).map(x=>normText_(x.value)).filter(Boolean);

    const seen = new Set();
    const dup = [];
    picked.forEach(n=>{
      const k = normText_(n);
      if(seen.has(k)) dup.push(n);
      seen.add(k);
    });
    if(dup.length){
      Swal.showValidationMessage('รายชื่อซ้ำกัน: ' + Array.from(new Set(dup)).join(', '));
      return false;
    }
    return picked;
  }
})
.then(res=>{
        if(res.isDismissed) return;

        const picked = res.isDenied ? [] : (res.value || []);
        const m = getUiMonth_();
        showLoading('กำลังบันทึกการแก้ไข…');
        google.script.run
          .withSuccessHandler(function(){
            hideLoading();
            showOK('บันทึกแล้ว');
            refreshUI_();
          })
          .withFailureHandler(function(e){
            hideLoading();
            showErr(e.message || 'บันทึกไม่สำเร็จ');
          })
          .manualEditShiftNames(tk, window.BE_YEAR, m, day, shift, picked);
      });
    })
    .withFailureHandler(function(e){
      hideLoading();
      showErr(e.message || 'โหลดรายชื่อไม่สำเร็จ');
    })
    .listPeopleNames(tk);
}

// ✅ Fallback Loading (ถ้าระบบหลักไม่มี showLoading/hideLoading)
(function(){
  if(typeof window.showLoading === 'function' && typeof window.hideLoading === 'function') return;

  const ID = '__fallback_loading__';

  function ensureEl_(){
    let el = document.getElementById(ID);
    if(el) return el;

    el = document.createElement('div');
    el.id = ID;

    // ✅ ใช้คลาสเดียวกับของระบบหลัก
    el.className = 'loading-overlay hidden';
    el.innerHTML =
      '<div class="loading-card">' +
        '<div class="spinner"></div>' +
        '<div id="'+ID+'_msg" class="loading-msg">กำลังดำเนินการ…</div>' +
      '</div>';

    document.body.appendChild(el);
    return el;
  }

  window.showLoading = function(msg){
    try{
      const el = ensureEl_();
      const m = document.getElementById(ID+'_msg');
      if(m) m.textContent = msg || 'กำลังดำเนินการ…';

      // โชว์แบบเดียวกับหลัก (ไม่ใช้ display:flex ตรง ๆ เพื่อให้ class คุมได้)
      el.classList.remove('hidden');
      el.style.display = 'flex';
    }catch(e){}
  };

  window.hideLoading = function(){
    try{
      const el = document.getElementById(ID);
      if(!el) return;
      el.classList.add('hidden');
      el.style.display = 'none';
    }catch(e){}
  };
})();

// ✅ Fallback escapeHtml_ (ถ้าเดิมไม่มี)
(function(){
  if(typeof window.escapeHtml_ === 'function') return;

  window.escapeHtml_ = function(s){
    return String(s||'')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  };
})();

function getUiMonth_(){
  // พยายามอ่านจาก select เดือน ถ้ามี
  const sel =
    document.getElementById('monthSelect') ||
    document.getElementById('month') ||
    document.querySelector('select[data-month]') ||
    document.querySelector('select[name="month"]');

  if(sel){
    const v = Number(sel.value);
    if(!isNaN(v) && v>=1 && v<=12) return v; // ของระบบคุณใช้ 1-12
  }

  // fallback: ถ้ามีตัวแปร global อื่นอยู่แล้ว
  if(typeof window.currentMonth !== 'undefined') return Number(window.currentMonth);
  if(typeof window.monthIdx !== 'undefined') return Number(window.monthIdx);
  if(typeof window.selectedMonth !== 'undefined') return Number(window.selectedMonth);

  // fallback สุดท้าย: เดือนวันนี้
  return (new Date()).getMonth()+1;
}

function refreshUI_(){
  // 0) กัน overlay ค้าง
  try{ if(typeof hideLoading==='function') hideLoading(); }catch(e){}
  try{
    const fb = document.getElementById('__fallback_loading__');
    if(fb) fb.style.display='none';
  }catch(e){}

  // 1) ถ้ามีปุ่ม Refresh ของระบบ ให้กดมัน (ปรับ selector ได้ตามปุ่มจริงของคุณ)
  try{
    const btn =
      document.querySelector('[data-action="refresh"]') ||
      document.querySelector('#btnRefresh') ||
      document.querySelector('.btn-refresh') ||
      document.querySelector('button[title*="Refresh"]') ||
      document.querySelector('button[title*="รีเฟรช"]');
    if(btn){ btn.click(); return; }
  }catch(e){}

  // 2) ถ้ามี select เดือน ให้ dispatch change เพื่อให้ flow เดิมของคุณโหลดข้อมูลใหม่
  try{
    const sel =
      document.getElementById('monthSelect') ||
      document.getElementById('month') ||
      document.querySelector('select[name="month"]');
    if(sel){
      sel.dispatchEvent(new Event('change',{bubbles:true}));
      return;
    }
  }catch(e){}

  // 3) ลองเรียกชื่อฟังก์ชันที่เป็นไปได้ (เผื่อคุณมีอยู่แล้ว)
  try{
    const fns = [
      'render',
      'renderCalendar',
      'drawCalendar',
      'renderMonth',
      'loadMonthData',
      'loadMonth',
      'refresh'
    ];
    for(const fn of fns){
      if(typeof window[fn] === 'function'){
        window[fn]();
        return;
      }
    }
  }catch(e){}

  // 4) fallback สุดท้าย: เปลี่ยน url แบบ replace ใส่ cachebuster (ปลอดภัยกว่า reload ตรง ๆ ใน dev)
  try{
    const u = new URL(location.href);
    u.searchParams.set('_ts', String(Date.now()));
    location.replace(u.toString());
  }catch(e){
    try{ location.reload(); }catch(_){}
  }
}
// =============================
// GitHub Camera (SAFE MODE)
// =============================
const GH_CAMERA_URL = 'https://nattapongpsng-sketch.github.io/Camera_PSG_Standby/';
const GH_ORIGIN = 'https://nattapongpsng-sketch.github.io';

let ghCameraWindow = null;

// เปิดกล้อง GitHub
function openGithubCameraSafe(){
  ghCameraWindow = window.open(
    GH_CAMERA_URL,
    'ghCamera',
    'width=900,height=800'
  );
}

// รับรูปกลับมา
window.addEventListener('message', function(event){
  if(event.origin !== GH_ORIGIN) return;

  const data = event.data;
  if(!data || data.type !== 'camera-image') return;

  console.log('📸 ได้รูปจาก GitHub แล้ว');

  // 👉 เอาไปแทน preview เดิม
  const preview = document.getElementById('camPreview');
  if(preview){
    preview.src = data.imageBase64;
    preview.style.display = 'block';
  }

  // 👉 เก็บไว้ใช้ตอน submit attendance
  window.__cameraImage = data.imageBase64;

  // ปิด popup
  if(ghCameraWindow && !ghCameraWindow.closed){
    ghCameraWindow.close();
  }
});

function attachAutoComplete(input, options){

  const wrap = document.createElement('div');
  wrap.className = 'pea-autocomplete';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);

  const list = document.createElement('div');
  list.className = 'pea-autocomplete-list';
  list.style.display = 'none';
  wrap.appendChild(list);
  
  input.addEventListener('input', () => {
    const keyword = input.value.toLowerCase().trim();
    list.innerHTML = '';

    if(!keyword){
      list.style.display = 'none';
      return;
    }

    // 🔍 filter + จำกัด 5 รายการ
    const filtered = options
      .filter(v => v.toLowerCase().includes(keyword))
      .slice(0,5);

    if(filtered.length === 0){
      list.style.display = 'none';
      return;
    }

    filtered.forEach(item => {
      const div = document.createElement('div');
      div.className = 'pea-autocomplete-item';
      div.textContent = item;

      div.onclick = () => {
        input.value = item;
        list.style.display = 'none';
      };

      list.appendChild(div);
    });

    list.style.display = 'block';
  });

  // คลิกนอก = ปิด
  document.addEventListener('click', (e)=>{
    if(!wrap.contains(e.target)){
      list.style.display = 'none';
    }
  });
}
const PHONE_PDF_URL = 'https://drive.google.com/file/d/1ahIxqIRuSOmiot8Bn46NRngfXyDmWqci/view?usp=sharing';

document.getElementById('phonePdfBtn')?.addEventListener('click', () => {
  window.open(PHONE_PDF_URL, '_blank');
});

function goToHandoverPageAfterAttendance_(){
  return;
  try{
    const btn = document.querySelector('.side-link[data-page="handover"]');
    if(btn){
      btn.click(); // ใช้ระบบเปลี่ยนหน้าเดิม ปลอดภัยสุด
    }else if(typeof showPage === 'function'){
      showPage('handover');
    }

    setTimeout(() => {
      try{ window.scrollTo({ top: 0, behavior: 'smooth' }); }catch(e){}
      try{ if(typeof hoLoadDashboard_ === 'function') hoLoadDashboard_(); }catch(e){}
      try{ if(typeof loadDashboard_ === 'function') loadDashboard_(); }catch(e){}
      try{ if(typeof loadPending_ === 'function') loadPending_(); }catch(e){}
    }, 300);

  }catch(err){
    console.warn('goToHandoverPageAfterAttendance_ error:', err);
  }
}
