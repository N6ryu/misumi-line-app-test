let currentView = 0;
let selectedStation = null;
let loadedTrains = [];
let mapReady = false;

const stationGate = document.getElementById("stationGate");
const views = [...document.querySelectorAll(".view")];
const navButtons = [...document.querySelectorAll(".nav-btn")];
const bottomNav = document.getElementById("bottomNav");
const sheet = document.getElementById("bottomSheet");
const sheetBackdrop = document.getElementById("sheetBackdrop");

function setView(index){
  currentView = Math.max(0, Math.min(3,index));
  stationGate.hidden = true;
  views.forEach((v,i)=>v.classList.toggle("active", i===currentView));
  navButtons.forEach((b,i)=>b.classList.toggle("active", i===currentView));
  if(currentView===2){
    setTimeout(()=>{ initMap(); renderMap(loadedTrains); },40);
  }
}
navButtons.forEach(btn=>btn.addEventListener("click",()=>setView(Number(btn.dataset.target))));

function showStationGate(){
  views.forEach(v=>v.classList.remove("active"));
  stationGate.hidden = false;
  bottomNav.hidden = true;
}

function chooseStation(name){
  selectedStation = name;
  document.getElementById("selectedStationLabel").textContent = `${name}駅`;
  document.getElementById("positionStationLabel").textContent = `${name}駅`;
  stationGate.hidden = true;
  bottomNav.hidden = false;
  renderSelectedRelevance();
  renderVerticalRoute();
  setView(0);
}

function renderStationGrid(){
  const grid = document.getElementById("stationGrid");
  grid.innerHTML = stations.map(s=>`
    <button type="button" class="station-pick-btn" data-station="${s.name}">
      <span class="station-mark"></span>
      <strong>${s.name}</strong>
    </button>`).join("");
  grid.querySelectorAll("[data-station]").forEach(btn=>{
    btn.addEventListener("click",()=>chooseStation(btn.dataset.station));
  });
}

function relationToSelected(train){
  if(!selectedStation) return null;
  if(train.currentStation===selectedStation) return "現在駅";
  if(train.nextStation===selectedStation && train.currentStation!==train.nextStation) return "次駅";
  return null;
}

function renderSelectedRelevance(){
  const el = document.getElementById("selectedRelevance");
  const relevant = loadedTrains.filter(t=>relationToSelected(t));
  if(!relevant.length){
    el.innerHTML = `
      <span class="kicker">FOR ${selectedStation}</span>
      <h2>${selectedStation}駅</h2>
      <p>今回提供されたサンプル2件には、この駅を現在駅・次駅とする列車情報はありません。</p>
      <small>列車情報が追加されれば、同じ画面に上下線をまとめて表示する想定です。</small>`;
    return;
  }
  el.innerHTML = `
    <span class="kicker">FOR ${selectedStation}</span>
    <h2>${selectedStation}駅に関係する列車</h2>
    <div class="relevance-list">
      ${relevant.map(t=>`
        <button type="button" class="relevance-item" data-train="${t.id}">
          <span>${relationToSelected(t)}</span>
          <strong>${t.id}</strong>
          <b>${trainLocationLabel(t)}</b>
        </button>`).join("")}
    </div>`;
  el.querySelectorAll("[data-train]").forEach(b=>b.addEventListener("click",()=>openTrainSheet(b.dataset.train)));
}

function statusLabel(train){
  if(train.currentStation===train.nextStation && train.nextStation===train.nextStop){
    return "駅位置データ";
  }
  return "走行データ";
}

function renderStatusTrains(){
  const wrap = document.getElementById("statusTrainList");
  wrap.innerHTML = loadedTrains.map(t=>`
    <button type="button" class="status-train-card" data-train="${t.id}">
      <div class="train-card-head">
        <div><span class="train-number">${t.id}</span><span class="raw-dir">${t.rawDirection}</span></div>
        <span class="train-state">${statusLabel(t)}</span>
      </div>
      <div class="location-large">${trainLocationLabel(t)}</div>
      <div class="raw-grid">
        <div><small>currentStation</small><strong>${t.currentStation}</strong></div>
        <div><small>nextStation</small><strong>${t.nextStation}</strong></div>
        <div><small>nextStop</small><strong>${t.nextStop}</strong></div>
        <div><small>取得時刻</small><strong>${receivedTimeOnly(t.acquiredAt)}</strong></div>
      </div>
      <div class="tap-detail">詳細を見る ›</div>
    </button>`).join("");
  wrap.querySelectorAll("[data-train]").forEach(b=>b.addEventListener("click",()=>openTrainSheet(b.dataset.train)));
}

function renderVerticalRoute(){
  const route = document.getElementById("verticalRoute");
  let html = "";
  stations.forEach((s,i)=>{
    const selected = s.name===selectedStation;
    html += `
      <button type="button" class="station-row ${selected?"selected":""}" data-station="${s.name}">
        <span class="station-axis">
          <i class="station-dot"></i>
          ${i<stations.length-1?'<i class="station-line"></i>':""}
        </span>
        <span class="station-copy">
          <strong>${s.name}</strong>
          ${selected?'<small>選択中</small>':'<small>駅を見る ›</small>'}
        </span>
      </button>`;
    loadedTrains.filter(t=>{
      if(t.currentStation===t.nextStation) return t.currentStation===s.name;
      const p=t.positionIndex;
      return p>=i && p<i+1;
    }).forEach(t=>{
      html += `
        <button type="button" class="train-on-route" data-train="${t.id}">
          <span class="train-axis-icon">🚃</span>
          <span class="train-route-card">
            <span class="train-route-top"><strong>${t.id}</strong><b>${t.rawDirection}</b></span>
            <span class="train-route-time">${trainLocationLabel(t)}</span>
            <small>取得 ${receivedTimeOnly(t.acquiredAt)} ／ 現在時刻 10:30固定</small>
          </span>
        </button>`;
    });
  });
  route.innerHTML = html;
  route.querySelectorAll("[data-station]").forEach(b=>b.addEventListener("click",()=>openStationSheet(b.dataset.station)));
  route.querySelectorAll("[data-train]").forEach(b=>b.addEventListener("click",()=>openTrainSheet(b.dataset.train)));
}

function openSheet({kicker,title,body}){
  document.getElementById("sheetKicker").textContent=kicker;
  document.getElementById("sheetTitle").textContent=title;
  document.getElementById("sheetBody").innerHTML=body;
  sheet.hidden=false; sheetBackdrop.hidden=false;
  requestAnimationFrame(()=>{sheet.classList.add("open");sheetBackdrop.classList.add("open");});
}
function closeSheet(){
  sheet.classList.remove("open"); sheetBackdrop.classList.remove("open");
  setTimeout(()=>{sheet.hidden=true;sheetBackdrop.hidden=true;},180);
}
document.getElementById("sheetClose").addEventListener("click",closeSheet);
sheetBackdrop.addEventListener("click",closeSheet);

function openStationSheet(name){
  const relevant = loadedTrains.filter(t=>t.currentStation===name || t.nextStation===name);
  openSheet({
    kicker:"STATION",
    title:`${name}駅`,
    body:`
      <div class="sheet-callout">
        <strong>現在時刻 10:30（固定）</strong>
        <span>今回のサンプルに含まれる情報だけを表示します。</span>
      </div>
      ${relevant.length ? relevant.map(t=>`
        <div class="sheet-train-line">
          <strong>${t.id}</strong><span>${trainLocationLabel(t)}</span><small>${t.rawDirection}・取得 ${receivedTimeOnly(t.acquiredAt)}</small>
        </div>`).join("") :
        '<div class="empty-state">この駅に直接関係する列車データは、今回のサンプル2件にはありません。</div>'}
      <div class="sheet-callout subtle">
        <strong>発着時刻について</strong>
        <span>駅別の発着時刻表は今回の提供データに含まれていないため、表示していません。</span>
      </div>`
  });
}

function openTrainSheet(id){
  const t=loadedTrains.find(x=>x.id===id);
  if(!t)return;
  openSheet({
    kicker:"TRAIN DATA",
    title:t.id,
    body:`
      <div class="train-detail-hero">
        <div class="train-detail-title"><strong>${trainLocationLabel(t)}</strong><span>${t.rawDirection}</span></div>
        <div class="time-pair"><div><small>現在時刻</small><b>10:30</b></div><div><small>取得時刻</small><b>${receivedTimeOnly(t.acquiredAt)}</b></div></div>
      </div>
      <div class="detail-grid">
        <div><small>currentStation</small><strong>${t.currentStation}</strong></div>
        <div><small>nextStation</small><strong>${t.nextStation}</strong></div>
        <div><small>nextStop</small><strong>${t.nextStop}</strong></div>
        <div><small>direction</small><strong>${t.rawDirection}</strong></div>
        <div><small>latitude</small><strong>${t.latitude}</strong></div>
        <div><small>longitude</small><strong>${t.longitude}</strong></div>
        <div><small>speed</small><strong>${t.speed}</strong></div>
        <div><small>ビーコン発信</small><strong>${receivedTimeOnly(t.beaconAt)}</strong></div>
        <div><small>編成</small><strong>${t.formation}</strong></div>
        <div><small>運転台車号</small><strong>${t.cabCarNo}</strong></div>
      </div>`
  });
}

function renderTimeData(){
  const list=document.getElementById("timeDataList");
  list.innerHTML=loadedTrains.map(t=>`
    <article class="time-data-item">
      <strong>${t.id}</strong>
      <div><span>ビーコン発信時刻</span><b>${receivedTimeOnly(t.beaconAt)}</b></div>
      <div><span>取得時刻</span><b>${receivedTimeOnly(t.acquiredAt)}</b></div>
    </article>`).join("");
}

function getRoutePoints(){
  if(Array.isArray(lightweightRouteSegments)&&lightweightRouteSegments.length){
    const pts=[];
    lightweightRouteSegments.forEach((seg,si)=>{
      if(!seg||!Array.isArray(seg.points))return;
      seg.points.forEach((p,i)=>{
        if(si>0&&i===0)return;
        if(Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1]))pts.push(p);
      });
    });
    if(pts.length>1)return pts;
  }
  return stations.map(s=>[s.lat,s.lng]);
}
function mapProjection(){
  const route=getRoutePoints();
  const all=route.concat(stations.map(s=>[s.lat,s.lng]));
  const lats=all.map(p=>p[0]), lngs=all.map(p=>p[1]);
  const minLat=Math.min(...lats),maxLat=Math.max(...lats),minLng=Math.min(...lngs),maxLng=Math.max(...lngs);
  const pad=34,width=720,height=500;
  const project=(lat,lng)=>[
    pad+((lng-minLng)/Math.max(.000001,maxLng-minLng))*(width-pad*2),
    pad+((maxLat-lat)/Math.max(.000001,maxLat-minLat))*(height-pad*2)
  ];
  return {width,height,project};
}
function initMap(){
  const el=document.getElementById("map"); if(!el)return;
  const {width,height,project}=mapProjection();
  const points=getRoutePoints().map(p=>project(p[0],p[1]).join(",")).join(" ");
  const stationSvg=stations.map(s=>{
    const [x,y]=project(s.lat,s.lng);
    const selected=s.name===selectedStation;
    return `<g class="svg-station ${selected?"selected":""}">
      <circle cx="${x}" cy="${y}" r="${selected?8:5.5}"></circle>
      <text x="${x+9}" y="${y+14}">${s.name}</text></g>`;
  }).join("");
  el.innerHTML=`<svg id="routeSvgMap" class="svg-route-map" viewBox="0 0 ${width} ${height}" aria-label="熊本から三角までの路線図">
    <polyline class="svg-route-halo" points="${points}"></polyline>
    <polyline class="svg-route-line" points="${points}"></polyline>
    ${stationSvg}<g id="svgTrainLayer"></g></svg>`;
  mapReady=true;
}
function renderMap(trains){
  if(!mapReady)initMap();
  const layer=document.getElementById("svgTrainLayer"); if(!layer)return;
  const {project}=mapProjection();
  layer.innerHTML=trains.map(t=>{
    const [x,y]=project(t.latitude,t.longitude);
    return `<g class="svg-train" transform="translate(${x} ${y})">
      <circle r="16" class="svg-train-circle"></circle>
      <text x="0" y="6" text-anchor="middle">🚃</text>
      <rect class="svg-train-label-bg" x="-45" y="-44" width="90" height="23" rx="11"></rect>
      <text class="svg-train-label" x="0" y="-29" text-anchor="middle">${t.id} ${receivedTimeOnly(t.acquiredAt)}</text>
    </g>`;
  }).join("");
}

document.getElementById("changeStationBtn").addEventListener("click",showStationGate);

// 文字サイズ
const fontScales=[
  {scale:1,label:"文字：標準"},
  {scale:1.18,label:"文字：大"},
  {scale:.9,label:"文字：小"}
];
let fontIndex=0;
document.getElementById("fontBtn").addEventListener("click",()=>{
  fontIndex=(fontIndex+1)%fontScales.length;
  const f=fontScales[fontIndex];
  document.documentElement.style.setProperty("--font-scale",f.scale);
  document.getElementById("fontBtn").textContent=f.label;
});

async function init(){
  loadedTrains=await loadTrainData();
  renderStationGrid();
  renderStatusTrains();
  renderTimeData();
  renderVerticalRoute();
  initMap();
  renderMap(loadedTrains);
  setTimeout(()=>{
    const splash=document.getElementById("splashScreen");
    splash.classList.add("hide");
    document.body.classList.remove("splash-active");
    setTimeout(()=>splash.remove(),350);
  },1400);
}
init().catch(err=>{
  console.error(err);
  document.body.classList.remove("splash-active");
});
