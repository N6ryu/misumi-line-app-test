let selectedStation=null,loadedTrains=[],mapReady=false,currentView=0;

const gate=document.getElementById("stationGate");
const views=[...document.querySelectorAll(".view")];
const navButtons=[...document.querySelectorAll(".nav-btn[data-target]")];
const bottomNav=document.getElementById("bottomNav");
const stationFab=document.getElementById("stationFab");
const sheet=document.getElementById("bottomSheet");
const backdrop=document.getElementById("sheetBackdrop");

function setView(i){
  currentView=Math.max(0,Math.min(2,i));
  gate.hidden=true;
  views.forEach((v,n)=>v.classList.toggle("active",n===currentView));
  navButtons.forEach((b,n)=>b.classList.toggle("active",n===currentView));
  if(currentView===0&&selectedStation)setTimeout(()=>scrollToSelectedStation(false),80);
  if(currentView===1)setTimeout(()=>{initMap();renderMap()},40);
}

navButtons.forEach(b=>b.addEventListener("click",()=>setView(Number(b.dataset.target))));

function showGate(){
  views.forEach(v=>v.classList.remove("active"));
  gate.hidden=false;
  bottomNav.hidden=true;
  stationFab.hidden=true;
}

function renderStationGrid(){
  const e=document.getElementById("stationGrid");
  e.innerHTML=stations.map(s=>`
    <button class="station-pick-btn" data-station="${s.name}">
      <span class="station-mark"></span><strong>${s.name}</strong>
    </button>`).join("");
  e.querySelectorAll("[data-station]").forEach(b=>
    b.addEventListener("click",()=>selectStation(b.dataset.station))
  );
}

function selectStation(name){
  selectedStation=name;
  document.getElementById("selectedStationLabel").textContent=`${name}駅`;
  bottomNav.hidden=false;
  stationFab.hidden=false;
  renderDualRoute();
  setView(0);
  setTimeout(()=>scrollToSelectedStation(true),180);
}

function scrollToSelectedStation(smooth=true){
  if(!selectedStation)return;
  const scroller=document.getElementById("positionScroller");
  const target=document.querySelector(`.route-node[data-station="${selectedStation}"]`);
  if(!scroller||!target)return;

  const sr=scroller.getBoundingClientRect();
  const tr=target.getBoundingClientRect();
  const desired=tr.top-sr.top+scroller.scrollTop-(scroller.clientHeight*0.46)+(tr.height/2);

  scroller.scrollTo({top:Math.max(0,desired),behavior:smooth?"smooth":"auto"});

  target.classList.remove("station-focus-flash");
  requestAnimationFrame(()=>target.classList.add("station-focus-flash"));
}

function openSheet(title,body){
  document.getElementById("sheetTitle").textContent=title;
  document.getElementById("sheetBody").innerHTML=body;
  sheet.hidden=false;
  backdrop.hidden=false;
  requestAnimationFrame(()=>{sheet.classList.add("open");backdrop.classList.add("open")});
}

function closeSheet(){
  sheet.classList.remove("open");
  backdrop.classList.remove("open");
  setTimeout(()=>{sheet.hidden=true;backdrop.hidden=true},180);
}

document.getElementById("sheetClose").addEventListener("click",closeSheet);
backdrop.addEventListener("click",closeSheet);

const routeSide=t=>(t.derivedDirection||t.rawDirection)==="上り"?"up":"down";

function trainChip(t){
  const side=routeSide(t);
  const icon=side==="up"?"./assets/train-up.gif?v=29":"./assets/train-down.gif?v=29";
  const state=t.operationalState==="出発待ち"
    ? `出発待ち ${t.inferredDeparture||""}`.trim()
    : t.nickname;

  return `<button class="track-train ${side} ${t.operationalState==="出発待ち"?"waiting":""}" data-train="${t.id}">
    <img class="train-gif" src="${icon}" alt="${side==="up"?"上り":"下り"}列車">
    <span class="train-chip-copy">
      <strong>${t.id}</strong>
      <small>${state}</small>
    </span>
  </button>`;
}

function renderDualRoute(){
  const e=document.getElementById("dualRoute");
  let h=`<div class="route-columns-head">
    <span>上り<br><b>熊本方面</b></span>
    <span>駅</span>
    <span>下り<br><b>三角方面</b></span>
  </div>`;

  stations.forEach((s,i)=>{
    const at=loadedTrains.filter(t=>{
      if(t.currentStation===t.nextStation)return t.currentStation===s.name;
      return t.positionIndex>=i&&t.positionIndex<i+1;
    });
    const left=at.filter(t=>routeSide(t)==="up");
    const right=at.filter(t=>routeSide(t)==="down");

    h+=`<div class="route-node ${s.name===selectedStation?"selected":""}" data-station="${s.name}">
      <div class="side left">${left.map(trainChip).join("")}</div>
      <button class="center-station" data-station-button="${s.name}">
        <i></i><strong>${s.name}</strong>
      </button>
      <div class="side right">${right.map(trainChip).join("")}</div>
    </div>`;
  });

  e.innerHTML=h;

  e.querySelectorAll("[data-train]").forEach(b=>
    b.addEventListener("click",()=>openTrainDetail(b.dataset.train))
  );
  e.querySelectorAll("[data-station-button]").forEach(b=>
    b.addEventListener("click",()=>selectStation(b.dataset.stationButton))
  );
}

function openTrainDetail(id){
  const t=loadedTrains.find(x=>x.id===id);
  if(!t)return;

  const rows=t.timetable.map((r,i)=>{
    const isStart=i===0&&t.operationalState==="出発待ち";
    const final=i===t.timetable.length-1&&!isStart;
    const time=isStart?(r.departure||r.arrival):(final?(r.arrival||r.departure):(r.departure||r.arrival));
    const label=isStart?"出発待ち":(final?"終着":"停車駅");
    const suffix=isStart?"発":(final?"着":"発");
    return `<div class="schedule-row ${final?"final":""}">
      <span class="schedule-dot"></span>
      <div><strong>${r.station}</strong><small>${label}</small></div>
      <b>${time||"—"}</b><em>${suffix}</em>
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
    <p class="source-note">${t.timetableNote}</p>
  `);
}

function renderTimeReference(){
  const e=document.getElementById("timeReference");
  e.innerHTML=loadedTrains.map(t=>`
    <article class="time-ref-card">
      <div class="time-ref-head"><strong>${t.id}</strong><span>${t.nickname}</span></div>
      ${t.timetable.map(r=>`
        <div class="time-ref-row">
          <b>${r.station}</b>
          <span>${r.arrival?`着 ${r.arrival}`:""}</span>
          <span>${r.departure?`発 ${r.departure}`:""}</span>
        </div>`).join("")}
      <small>${t.timetableNote}</small>
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
  const lats=all.map(p=>p[0]),lngs=all.map(p=>p[1]);
  const minLat=Math.min(...lats),maxLat=Math.max(...lats);
  const minLng=Math.min(...lngs),maxLng=Math.max(...lngs);
  const pad=34,width=720,height=500;
  const project=(lat,lng)=>[
    pad+((lng-minLng)/Math.max(.000001,maxLng-minLng))*(width-pad*2),
    pad+((maxLat-lat)/Math.max(.000001,maxLat-minLat))*(height-pad*2)
  ];
  return {width,height,project};
}

function initMap(){
  const el=document.getElementById("map");
  if(!el)return;
  const {width,height,project}=mapProjection();
  const pts=getRoutePoints().map(p=>project(p[0],p[1]).join(",")).join(" ");
  const ss=stations.map(s=>{
    const[x,y]=project(s.lat,s.lng);
    return `<g class="svg-station ${s.name===selectedStation?"selected":""}">
      <circle cx="${x}" cy="${y}" r="${s.name===selectedStation?8:5.5}"></circle>
      <text x="${x+9}" y="${y+14}">${s.name}</text>
    </g>`;
  }).join("");

  el.innerHTML=`<svg id="routeSvgMap" class="svg-route-map" viewBox="0 0 ${width} ${height}">
    <polyline class="svg-route-halo" points="${pts}"></polyline>
    <polyline class="svg-route-line" points="${pts}"></polyline>
    ${ss}<g id="svgTrainLayer"></g>
  </svg>`;
  mapReady=true;
}

function renderMap(){
  if(!mapReady)initMap();
  const layer=document.getElementById("svgTrainLayer");
  if(!layer)return;
  const {project}=mapProjection();
  layer.innerHTML=loadedTrains.map(t=>{
    const[x,y]=project(t.latitude,t.longitude);
    return `<g class="svg-train" transform="translate(${x} ${y})">
      <circle r="16" class="svg-train-circle"></circle>
      <text x="0" y="6" text-anchor="middle">🚃</text>
      <rect class="svg-train-label-bg" x="-46" y="-44" width="92" height="23" rx="11"></rect>
      <text class="svg-train-label" x="0" y="-29" text-anchor="middle">${t.id}</text>
    </g>`;
  }).join("");
}

stationFab.addEventListener("click",showGate);

const scales=[
  {s:1,l:"文字：標準"},
  {s:1.18,l:"文字：大"},
  {s:.9,l:"文字：小"}
];
let scaleIndex=0;
document.getElementById("fontBtn").addEventListener("click",()=>{
  scaleIndex=(scaleIndex+1)%scales.length;
  document.documentElement.style.setProperty("--font-scale",scales[scaleIndex].s);
  document.getElementById("fontBtn").textContent=scales[scaleIndex].l;
});

async function init(){
  loadedTrains=await loadTrainData();
  renderStationGrid();
  renderTimeReference();
  renderDualRoute();
  initMap();
  renderMap();

  setTimeout(()=>{
    const s=document.getElementById("splashScreen");
    s.classList.add("hide");
    document.body.classList.remove("splash-active");
    setTimeout(()=>s.remove(),350);
  },1200);
}

init().catch(console.error);
