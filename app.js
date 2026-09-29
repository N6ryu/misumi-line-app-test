let selectedStation=null,loadedTrains=[],currentView=0;

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
  if(currentView===1)setTimeout(renderMapOverlay,100);
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

// OpenStreetMap iframe overlay (bbox: west,south,east,north)
const MAP_BBOX={west:130.44,south:32.59,east:130.71,north:32.81};
function mercY(lat){
  const rad=lat*Math.PI/180;
  return Math.log(Math.tan(Math.PI/4+rad/2));
}
function mapPercent(lat,lng){
  const x=(lng-MAP_BBOX.west)/(MAP_BBOX.east-MAP_BBOX.west)*100;
  const yn=mercY(MAP_BBOX.north),ys=mercY(MAP_BBOX.south),y=mercY(lat);
  const top=(yn-y)/(yn-ys)*100;
  return {x,top};
}
function renderMapOverlay(){
  const layer=document.getElementById("mapTrainOverlay");
  if(!layer)return;
  layer.innerHTML=loadedTrains.map(t=>{
    const p=mapPercent(t.latitude,t.longitude);
    const side=routeSide(t);
    const icon=side==="up"?"./assets/train-up.gif?v=32":"./assets/train-down.gif?v=32";
    return `<button class="map-gif-train" style="left:${p.x}%;top:${p.top}%;" data-train="${t.id}" title="${t.id}">
      <img src="${icon}" alt="${t.id}">
      <span>${t.id}</span>
    </button>`;
  }).join("");
  layer.querySelectorAll("[data-train]").forEach(b=>b.addEventListener("click",()=>openTrainDetail(b.dataset.train)));
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
  const byTime=new Map();
  for(const item of data.up){
    if(!byTime.has(item.time))byTime.set(item.time,{time:item.time,up:[],down:[]});
    byTime.get(item.time).up.push(item.label);
  }
  for(const item of data.down){
    if(!byTime.has(item.time))byTime.set(item.time,{time:item.time,up:[],down:[]});
    byTime.get(item.time).down.push(item.label);
  }
  const rows=[...byTime.values()].sort((a,b)=>a.time.localeCompare(b.time));
  document.getElementById("timetableRows").innerHTML=rows.length?rows.map(r=>`
    <div class="tt-row">
      <div class="tt-side up">${r.up.map(x=>`<span>${x}</span>`).join("")}</div>
      <strong class="tt-time">${r.time}</strong>
      <div class="tt-side down">${r.down.map(x=>`<span>${x}</span>`).join("")}</div>
    </div>`).join(""):`<div class="tt-empty">この方向の発車列車はありません。</div>`;
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
  renderMapOverlay();
  renderTimetable();
  setTimeout(()=>{
    const s=document.getElementById("splashScreen");
    s.classList.add("hide");
    document.body.classList.remove("splash-active");
    setTimeout(()=>s.remove(),350);
  },1400);
}
init().catch(console.error);
