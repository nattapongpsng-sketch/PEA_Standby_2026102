


(function(){
  let outageMap = null;
  let outageLayer = null;
  let labelLayer = null;
  let feeder33Layer = null;
  let mapLayerControl = null;

  const LABEL_SHOW_ZOOM = 13;

  function getToken_(){
    return window.token || window.__token || sessionStorage.getItem('pea_token') || '';
  }

  function escapeHtml_(s){
    return String(s || '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function initCurrentMonth_(){
    const sel = document.getElementById('mapMonth');
    if(sel && !sel.dataset.ready){
      sel.value = String(new Date().getMonth() + 1);
      sel.dataset.ready = '1';
    }
  }

  function initOutageMap_(){
    if(outageMap) return;

    outageMap = L.map('outageMap', { zoomControl:true }).setView([8.57, 99.25], 11);

    /*L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(outageMap);*/

    const streetMap = L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {
    attribution: '&copy; OpenStreetMap'
  }
);

const satelliteMap = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  {
    attribution: 'Tiles © Esri'
  }
);

const darkMap = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  {
    attribution: '&copy; CartoDB'
  }
);

streetMap.addTo(outageMap);

mapLayerControl = L.control.layers({
  "🗺️ ถนน": streetMap,
  "🛰️ ดาวเทียม": satelliteMap,
  "🌙 Dark": darkMap
}, {}, {
  collapsed: false
}).addTo(outageMap);


    outageLayer = L.layerGroup().addTo(outageMap);
    labelLayer = L.layerGroup().addTo(outageMap);

    outageMap.on('zoomend', updateLabelVisibility_);
    load33kVGeojsonLayer_();
  }
 function load33kVGeojsonLayer_(){
  if(!outageMap) return;
  if(feeder33Layer) return;

  const geojsonUrl = 'https://nattapongpsng-sketch.github.io/33kVGeojson/PSGgeojson.geojson';

  const conductorColors = {
    A: '#444444',
    AA: '#666666',
    ACSR: '#f57c00',
    PIC: '#7b1fa2',
    SAC: '#0288d1',
    XLPE: '#455a64',
    UNKNOWN: '#555555'
  };

  function getConductorType_(feature){
    const props = feature.properties || {};
    return String(props.CONDUCTORT || 'UNKNOWN').trim().toUpperCase() || 'UNKNOWN';
  }

  function getConductorColor_(type){
    return conductorColors[type] || conductorColors.UNKNOWN;
  }

  feeder33Layer = L.geoJSON(null, {
    style: function(feature){
      const type = getConductorType_(feature);

      return {
        color: getConductorColor_(type),
        weight: 1.4,
        opacity: 0.95
      };
    },

    onEachFeature: function(feature, layer){
      const props = feature.properties || {};
      const type = getConductorType_(feature);
      const color = getConductorColor_(type);

      let html = `
        <div class="map-popup-title">⚡ ระบบจำหน่าย 33kV</div>
        <div class="map-popup-line"><b>TAG:</b> ${escapeHtml_(props.TAG || '-')}</div>
        <div class="map-popup-line"><b>FEEDERID:</b> ${escapeHtml_(props.FEEDERID || '-')}</div>
        <div class="map-popup-line"><b>CONDUCTORT:</b> <span style="color:${color};font-weight:900;">${escapeHtml_(type)}</span></div>
        <div class="map-popup-line"><b>CONDUCTORS:</b> ${escapeHtml_(props.CONDUCTORS || '-')}</div>
        <div class="map-popup-line"><b>LABELTEXT:</b> ${escapeHtml_(props.LABELTEXT || '-')}</div>
        <div class="map-popup-line"><b>MAINORLATE:</b> ${escapeHtml_(props.MAINORLATE || '-')}</div>
        <div class="map-popup-line"><b>MEASURELEN:</b> ${escapeHtml_(props.MEASURELEN || props.SHAPE_LEN || '-')} ม.</div>
      `;

      layer.bindPopup(html);

      layer.on('mouseover', function(){
        layer.setStyle({
          weight: 4,
          opacity: 1
        });
      });

      layer.on('mouseout', function(){
        layer.setStyle({
          weight: 1.4,
          opacity: 0.95
        });
      });
    }
  }).addTo(outageMap);

  fetch(geojsonUrl)
    .then(res => {
      if(!res.ok) throw new Error('โหลด GeoJSON 33kV ไม่สำเร็จ');
      return res.json();
    })
    .then(data => {
      feeder33Layer.addData(data);

      if(mapLayerControl){
        mapLayerControl.addOverlay(feeder33Layer, '⚡ ระบบจำหน่าย 33kV');
      }

      try{
        outageMap.fitBounds(feeder33Layer.getBounds(), { padding:[30,30] });
      }catch(e){}

      setTimeout(() => {
        outageMap.invalidateSize();
      }, 300);
    })
    .catch(err => {
      console.error(err);
      alert(err.message || 'โหลด Layer 33kV ไม่สำเร็จ');
    });
}
  function markerRadius_(count){
    return Math.max(8, Math.min(28, 7 + count * 3));
  }

  function markerColor_(count){
    if(count >= 5) return '#d32f2f';
    if(count >= 3) return '#f57c00';
    return '#6b1fa7';
  }

  function makeLabelHtml_(p){
    return `
      <div class="map-device-label">
        <div class="code">${escapeHtml_(p.code || '')}</div>
        <div class="place">${escapeHtml_(p.place || p.location || '-')}</div>
      </div>
    `;
  }

  function updateLabelVisibility_(){
    if(!outageMap) return;

    const show = outageMap.getZoom() >= LABEL_SHOW_ZOOM;
    document.querySelectorAll('#page-map .map-device-label').forEach(el => {
      el.classList.toggle('map-device-label-hidden', !show);
    });
  }

  function renderMap_(data){
    initOutageMap_();

    outageLayer.clearLayers();
    labelLayer.clearLayers();

    const points = data.points || [];
    const emergencyPoints = data.emergencyPoints || [];

    document.getElementById('mapTotalEvents').textContent = data.totalEvents || 0;
    document.getElementById('mapTotalPoints').textContent = points.length || 0;
    document.getElementById('mapEmergencyCount').textContent = emergencyPoints.length || 0;
    document.getElementById('mapUnmatched').textContent = (data.unmatched || []).length || 0;

    renderEmergencyBox_(emergencyPoints);

    if(!points.length){
      outageMap.setView([8.57, 99.25], 11);
      renderTopTable_([]);
      renderEmergencyTable_([]);
      renderUnmatched_(data.unmatched || []);
      updateLabelVisibility_();
      return;
    }

    const bounds = [];

    points.forEach(p => {
      if(p.isEmergency){
        const icon = L.divIcon({
          className:'',
          html:'<div class="emergency-marker"></div>',
          iconSize:[24,24],
          iconAnchor:[12,12]
        });

        const marker = L.marker([p.lat, p.lng], { icon });
        marker.bindPopup(makePopup_(p, true));
        marker.addTo(outageLayer);
      }else{
        const color = markerColor_(p.count);
        const marker = L.circleMarker([p.lat, p.lng], {
          radius: markerRadius_(p.count),
          color,
          weight: 2,
          fillColor: color,
          fillOpacity: 0.55
        });

        marker.bindPopup(makePopup_(p, false));
        marker.addTo(outageLayer);
      }

      const labelIcon = L.divIcon({
        className: '',
        html: makeLabelHtml_(p),
        iconSize: null,
        iconAnchor: [-12, 34]
      });

      L.marker([p.lat, p.lng], {
        icon: labelIcon,
        interactive: false
      }).addTo(labelLayer);

      bounds.push([p.lat, p.lng]);
    });

    outageMap.fitBounds(bounds, { padding:[30,30] });

    renderTopTable_(points.slice(0,10));
    renderEmergencyTable_(emergencyPoints);
    renderUnmatched_(data.unmatched || []);

    setTimeout(() => {
      outageMap.invalidateSize();
      updateLabelVisibility_();
    }, 250);
  }

  function makePopup_(p, emergency){
    const cause = (p.causes && p.causes.length) ? p.causes.join(', ') : '-';

    return `
      <div class="map-popup-title ${emergency ? 'emergency' : ''}">
        ${emergency ? '🚨 ' : ''}${escapeHtml_(p.code)}
      </div>
      <div class="map-popup-line"><b>สถานที่:</b> ${escapeHtml_(p.location || p.place || '-')}</div>
      <div class="map-popup-line"><b>จำนวนทั้งเดือน:</b> ${p.count || 0}</div>
      <div class="map-popup-line"><b>จำนวนใน 7 วัน:</b> ${p.count7d || 0}</div>
      <div class="map-popup-line"><b>นาทีรวม:</b> ${p.totalMinutes || 0}</div>
      <div class="map-popup-line"><b>สาเหตุ:</b> ${escapeHtml_(cause)}</div>
      <div class="map-popup-line"><b>ครั้งล่าสุด:</b> ${escapeHtml_(p.lastDate || '-')}</div>
    `;
  }

  function renderEmergencyBox_(items){
    const box = document.getElementById('mapEmergencyBox');
    if(!box) return;

    if(!items.length){
      box.style.display = 'none';
      box.innerHTML = '';
      return;
    }

    box.style.display = 'block';
    box.innerHTML = `🚨 พบอุปกรณ์เกิดเหตุซ้ำมากกว่า 1 ครั้งในรอบ 7 วัน จำนวน ${items.length} จุด: ` +
      items.slice(0,8).map(x => `<b>${escapeHtml_(x.code)}</b>`).join(', ') +
      (items.length > 8 ? ' ...' : '');
  }

  function renderEmergencyTable_(points){
    const tb = document.getElementById('mapEmergencyTbody');
    if(!tb) return;

    if(!points.length){
      tb.innerHTML = `<tr><td colspan="6" class="muted">ยังไม่มีข้อมูล</td></tr>`;
      return;
    }

    tb.innerHTML = points.map((p, i) => {
      const cause = (p.causes && p.causes.length) ? p.causes.join(', ') : 'ไม่ระบุ';
      return `
        <tr>
          <td>${i + 1}</td>
          <td><b style="color:#dc2626;">${escapeHtml_(p.code)}</b></td>
          <td>${escapeHtml_(p.location || p.place || '-')}</td>
          <td><b>${p.count7d || 0}</b></td>
          <td>${escapeHtml_(cause)}</td>
          <td>${escapeHtml_(p.lastDate || '-')}</td>
        </tr>
      `;
    }).join('');
  }

  function renderTopTable_(points){
    const tb = document.getElementById('mapTopTbody');
    if(!tb) return;

    if(!points.length){
      tb.innerHTML = `<tr><td colspan="6" class="muted">ยังไม่มีข้อมูล</td></tr>`;
      return;
    }

    tb.innerHTML = points.map((p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><b>${p.isEmergency ? '🚨 ' : ''}${escapeHtml_(p.code)}</b></td>
        <td>${escapeHtml_(p.location || p.place || '-')}</td>
        <td><b>${p.count}</b></td>
        <td>${p.totalMinutes || 0}</td>
        <td>${escapeHtml_(p.lastDate || '-')}</td>
      </tr>
    `).join('');
  }

  function renderUnmatched_(items){
    const el = document.getElementById('mapUnmatchedList');
    if(!el) return;

    if(!items.length){
      el.textContent = 'ไม่พบรายการตกหล่น';
      return;
    }

    el.innerHTML = items.slice(0,50).map(x =>
      `• ${escapeHtml_(x.code)} — ${escapeHtml_(x.site || '-')} วันที่ ${escapeHtml_(x.day)}/${escapeHtml_(x.month)}`
    ).join('<br>');
  }

  window.loadOutageMap = function(){
    initCurrentMonth_();

    const token = getToken_();
    if(!token){
      if(window.showErr) showErr('กรุณาเข้าสู่ระบบก่อน');
      else alert('กรุณาเข้าสู่ระบบก่อน');
      return;
    }

    const month = Number(document.getElementById('mapMonth')?.value || (new Date().getMonth() + 1));

    if(window.showLoading) showLoading('กำลังโหลดแผนที่ไฟฟ้าขัดข้อง…');

    google.script.run
      .withSuccessHandler(function(res){
        if(window.hideLoading) hideLoading();
        renderMap_(res || {});
      })
      .withFailureHandler(function(err){
        if(window.hideLoading) hideLoading();
        if(window.showErr) showErr(err.message || 'โหลดแผนที่ไม่สำเร็จ');
        else alert(err.message || 'โหลดแผนที่ไม่สำเร็จ');
      })
      .getOutageMapData(token, {
        beYear: window.BE_YEAR || 2569,
        month
      });
  };

  window.mapToggleCollapse_ = function(btn, ev){
    if(ev){
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
    }

    const card = btn.closest('.collapse-card');
    if(card) card.classList.toggle('collapsed');

    return false;
  };

  document.addEventListener('DOMContentLoaded', function(){
    initCurrentMonth_();

    const btn = document.getElementById('mapLoadBtn');
    if(btn) btn.addEventListener('click', window.loadOutageMap);
  });
})();
