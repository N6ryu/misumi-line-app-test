let selectedStation=null,loadedTrains=[],currentView=0;
let leafletMap=null;
let leafletTrainMarkers=[];

const gate=document.getElementById("stationGate");
const views=[...document.querySelectorAll(".view")];
const navButtons=[...document.querySelectorAll(".nav-btn[data-target]")];
const bottomNav=document.getElementById("bottomNav");
const stationFab=document.getElementById("stationFab");
const sheet=document.getElementById("bottomSheet");
const backdrop=document.getElementById("sheetBackdrop");
const stationModal=document.getElementById("stationModal");
const stationModalBackdrop=document.getElementById("stationModalBackdrop");

function setView(i){
  currentView=Math.max(0,Math.min(2,i));
  gate.hidden=true;
  views.forEach((v,n)=>v.classList.toggle("active",n===currentView));
  navButtons.forEach((b,n)=>b.classList.toggle("active",n===currentView));
  if(currentView===0&&selectedStation)setTimeout(()=>scrollToSelectedStation(false),80);
  if(currentView===1){
    requestAnimationFrame(()=>{
      setTimeout(()=>{
        initLeafletMap();
        if(leafletMap){
          leafletMap.invalidateSize(true);
          renderLeafletTrains();
          setTimeout(()=>leafletMap.invalidateSize(true),250);
        }
      },80);
    });
  }
  if(currentView===2){
    if(selectedStation) setTimetableStation(selectedStation);
    renderTimetable();
  }
}
navButtons.forEach(b=>b.addEventListener("click",()=>setView(Number(b.dataset.target))));

function showGate(){
  views.forEach(v=>v.classList.remove("active"));
  gate.hidden=false;
  bottomNav.hidden=true;
  stationFab.hidden=true;
}

function stationButtonHTML(s){
  return `<button class="station-pick-btn" data-station="${s.name}">
    <span class="station-mark"></span><strong>${s.name}</strong>
  </button>`;
}

function renderStationGrid(){
  const e=document.getElementById("stationGrid");
  e.innerHTML=stations.map(stationButtonHTML).join("");
  e.querySelectorAll("[data-station]").forEach(b=>b.addEventListener("click",()=>selectStation(b.dataset.station)));

  const tt=document.getElementById("ttStationGrid");
  tt.innerHTML=stations.map(stationButtonHTML).join("");
  tt.querySelectorAll("[data-station]").forEach(b=>b.addEventListener("click",()=>{
    setTimetableStation(b.dataset.station);
    closeStationModal();
  }));
}

function selectStation(name){
  selectedStation=name;
  bottomNav.hidden=false;
  stationFab.hidden=false;
  setTimetableStation(name);
  renderDualRoute();
  setView(0);
  setTimeout(()=>scrollToSelectedStation(true),180);
}

function scrollToSelectedStation(smooth=true){
  if(!selectedStation)return;
  const scroller=document.getElementById("positionScroller");
  const target=document.querySelector(`.route-node[data-station="${selectedStation}"]`);
  if(!scroller||!target)return;
  const sr=scroller.getBoundingClientRect(),tr=target.getBoundingClientRect();
  const desired=tr.top-sr.top+scroller.scrollTop-(scroller.clientHeight*.46)+(tr.height/2);
  scroller.scrollTo({top:Math.max(0,desired),behavior:smooth?"smooth":"auto"});
}

const routeSide=t=>(t.derivedDirection||t.rawDirection)==="上り"?"up":"down";

function trainChip(t){
  const side=routeSide(t);
  const icon=side==="up"?"./assets/train-up.gif?v=32":"./assets/train-down.gif?v=32";
  const state=t.operationalState==="出発待ち"?`出発待ち ${t.inferredDeparture||""}`.trim():t.nickname;
  return `<button class="track-train ${side} ${t.operationalState==="出発待ち"?"waiting":""}" data-train="${t.id}">
    <img class="train-gif" src="${icon}" alt="${side==="up"?"上り":"下り"}列車">
    <span class="train-chip-copy"><strong>${t.id}</strong><small>${state}</small></span>
  </button>`;
}

function renderDualRoute(){
  const e=document.getElementById("dualRoute");
  let h="";
  stations.forEach((s,i)=>{
    const at=loadedTrains.filter(t=>{
      if(t.currentStation===t.nextStation)return t.currentStation===s.name;
      return t.positionIndex>=i&&t.positionIndex<i+1;
    });
    const left=at.filter(t=>routeSide(t)==="up");
    const right=at.filter(t=>routeSide(t)==="down");
    h+=`<div class="route-node ${s.name===selectedStation?"selected":""}" data-station="${s.name}">
      <div class="side left">${left.map(trainChip).join("")}</div>
      <button class="center-station" data-station-button="${s.name}"><i></i><strong>${s.name}</strong></button>
      <div class="side right">${right.map(trainChip).join("")}</div>
    </div>`;
  });
  e.innerHTML=h;
  e.querySelectorAll("[data-train]").forEach(b=>b.addEventListener("click",()=>openTrainDetail(b.dataset.train)));
  e.querySelectorAll("[data-station-button]").forEach(b=>b.addEventListener("click",()=>selectStation(b.dataset.stationButton)));
}

function openSheet(title,body){
  document.getElementById("sheetTitle").textContent=title;
  document.getElementById("sheetBody").innerHTML=body;
  sheet.hidden=false;backdrop.hidden=false;
  requestAnimationFrame(()=>{sheet.classList.add("open");backdrop.classList.add("open")});
}
function closeSheet(){
  sheet.classList.remove("open");backdrop.classList.remove("open");
  setTimeout(()=>{sheet.hidden=true;backdrop.hidden=true},180);
}
document.getElementById("sheetClose").addEventListener("click",closeSheet);
backdrop.addEventListener("click",closeSheet);

function openTrainDetail(id){
  const t=loadedTrains.find(x=>x.id===id);if(!t)return;
  const rows=t.timetable.map((r,i)=>{
    const isStart=i===0&&t.operationalState==="出発待ち";
    const final=i===t.timetable.length-1&&!isStart;
    const time=isStart?(r.departure||r.arrival):(final?(r.arrival||r.departure):(r.departure||r.arrival));
    return `<div class="schedule-row ${final?"final":""}">
      <span class="schedule-dot"></span>
      <div><strong>${r.station}</strong><small>${isStart?"出発待ち":(final?"終着":"停車駅")}</small></div>
      <b>${time||"—"}</b><em>${isStart?"発":(final?"着":"発")}</em>
    </div>`;
  }).join("");
  openSheet(`${t.id} ${t.nickname}`,`
    <div class="train-detail-summary">
      <div><span>現在位置</span><strong>${t.currentStation===t.nextStation?t.currentStation+"駅":t.currentStation+" → "+t.nextStation}</strong></div>
      <div><span>方面</span><strong>${t.displayDirection}</strong></div>
      <div><span>状態</span><strong>${t.operationalState}</strong></div>
    </div>
    <h3 class="sheet-subtitle">ここから終着駅までの予定</h3>
    <div class="remaining-schedule">${rows}</div>
    ${t.operationalState==="出発待ち"?'<div class="inference-note"><strong>判定：</strong>ビーコン発信から5分以上経過し、三角駅に停車したままのため「上り・出発待ち」と判定しています。</div>':""}
    <p class="source-note">${t.timetableNote}</p>`);
}

// Leaflet + OpenStreetMap
function initLeafletMap(){
  if(leafletMap || typeof L==="undefined") return;

  const mapEl=document.getElementById("leafletMap");
  if(!mapEl) return;

  leafletMap=L.map(mapEl,{
    zoomControl:true,
    attributionControl:true,
    preferCanvas:true
  });

  const tileLayer=L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
    maxZoom:19,
    updateWhenIdle:false,
    keepBuffer:4,
    attribution:'&copy; OpenStreetMap contributors'
  }).addTo(leafletMap);

  tileLayer.on("load",()=>setTimeout(()=>leafletMap.invalidateSize(true),60));

  // 三角線全体が見える初期表示
  const bounds=L.latLngBounds(stations.map(s=>[s.lat,s.lng]));
  leafletMap.fitBounds(bounds,{padding:[24,24]});

  // 駅マーカー
  stations.forEach(s=>{
    const stationIcon=L.divIcon({
      className:"station-map-icon-wrap",
      html:`<span class="station-map-dot"></span><span class="station-map-name">${s.name}</span>`,
      iconSize:[80,28],
      iconAnchor:[10,14]
    });
    L.marker([s.lat,s.lng],{icon:stationIcon,interactive:false}).addTo(leafletMap);
  });

  // 駅を結ぶ簡易路線
  L.polyline(stations.map(s=>[s.lat,s.lng]),{
    color:"#1676bd",
    weight:4,
    opacity:.7
  }).addTo(leafletMap);

  renderLeafletTrains();
}

function trainMapIcon(t){
  const side=routeSide(t);
  const iconSrc=side==="up"?"./assets/train-up.gif?v=33":"./assets/train-down.gif?v=33";
  const state=t.operationalState==="出発待ち"
    ? `出発待ち ${t.inferredDeparture||""}`.trim()
    : t.id;

  return L.divIcon({
    className:"train-map-icon-wrap",
    html:`<div class="train-map-marker">
      <img src="${iconSrc}" alt="${t.id}">
      <span>${state}</span>
    </div>`,
    iconSize:[74,82],
    iconAnchor:[37,41]
  });
}

function renderLeafletTrains(){
  if(!leafletMap || typeof L==="undefined") return;

  leafletTrainMarkers.forEach(m=>leafletMap.removeLayer(m));
  leafletTrainMarkers=[];

  loadedTrains.forEach(t=>{
    const marker=L.marker([t.latitude,t.longitude],{
      icon:trainMapIcon(t),
      zIndexOffset:1000
    }).addTo(leafletMap);

    marker.on("click",()=>openTrainDetail(t.id));
    leafletTrainMarkers.push(marker);
  });
}

// timetable
let timetableStation="三角";
function setTimetableStation(name){
  timetableStation=name;
  document.getElementById("ttStationName").textContent=name;
  renderTimetable();
}
function renderTimetable(){
  const data=timetableData[timetableStation]||{up:[],down:[]};

  const hours={};
  for(let h=5;h<=23;h++) hours[h]={up:[],down:[]};

  function pushItems(items,side){
    for(const item of items){
      const [hh,mm]=item.time.split(":");
      const h=Number(hh);
      if(!hours[h]) hours[h]={up:[],down:[]};
      hours[h][side].push({minute:mm,label:item.label||""});
    }
  }

  pushItems(data.up,"up");
  pushItems(data.down,"down");

  const rows=Object.entries(hours)
    .filter(([,v])=>v.up.length||v.down.length)
    .map(([hour,v])=>`
      <div class="hour-row">
        <div class="minute-side up">
          ${v.up.length ? v.up.map(x=>`
            <div class="minute-entry" title="${x.label}">
              <strong>${x.minute}</strong>
              ${x.label ? `<small>${x.label}</small>` : ""}
            </div>`).join("") : '<span class="no-train">—</span>'}
        </div>

        <div class="hour-center">${hour}</div>

        <div class="minute-side down">
          ${v.down.length ? v.down.map(x=>`
            <div class="minute-entry" title="${x.label}">
              <strong>${x.minute}</strong>
              ${x.label ? `<small>${x.label}</small>` : ""}
            </div>`).join("") : '<span class="no-train">—</span>'}
        </div>
      </div>`).join("");

  document.getElementById("timetableRows").innerHTML=
    rows || '<div class="tt-empty">表示できる時刻がありません。</div>';
}

function openStationModal(){
  stationModal.hidden=false;stationModalBackdrop.hidden=false;
  requestAnimationFrame(()=>{stationModal.classList.add("open");stationModalBackdrop.classList.add("open")});
}
function closeStationModal(){
  stationModal.classList.remove("open");stationModalBackdrop.classList.remove("open");
  setTimeout(()=>{stationModal.hidden=true;stationModalBackdrop.hidden=true},160);
}
document.getElementById("ttStationButton").addEventListener("click",openStationModal);
document.getElementById("stationModalClose").addEventListener("click",closeStationModal);
stationModalBackdrop.addEventListener("click",closeStationModal);

stationFab.addEventListener("click",showGate);

const scales=[{s:1,l:"文字：標準"},{s:1.18,l:"文字：大"},{s:.9,l:"文字：小"}];
let scaleIndex=0;
document.getElementById("fontBtn").addEventListener("click",()=>{
  scaleIndex=(scaleIndex+1)%scales.length;
  document.documentElement.style.setProperty("--font-scale",scales[scaleIndex].s);
  document.getElementById("fontBtn").textContent=scales[scaleIndex].l;
});

async function init(){
  loadedTrains=await loadTrainData();
  renderStationGrid();
  renderDualRoute();
  renderTimetable();
  setTimeout(()=>{
    const s=document.getElementById("splashScreen");
    s.classList.add("hide");
    document.body.classList.remove("splash-active");
    setTimeout(()=>s.remove(),350);
  },1400);
}
init().catch(console.error);
