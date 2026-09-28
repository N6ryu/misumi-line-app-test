// 三角線リアルタイムナビ v25
// JR九州から提供されたサンプル2件のみを使用。
// 発着時刻表は未提供のため、このファイルでは補完しない。

const PROTOTYPE_CURRENT_TIME = "10:30";
const SAMPLE_ACQUIRED_TIME = "10:28";

const stations = [
  { id:"S01", name:"熊本", lat:32.7898759, lng:130.6886784 },
  { id:"S02", name:"西熊本", lat:32.7622048, lng:130.6830044 },
  { id:"S03", name:"川尻", lat:32.7432967, lng:130.6797000 },
  { id:"S04", name:"富合", lat:32.7137924, lng:130.6728748 },
  { id:"S05", name:"宇土", lat:32.6939373, lng:130.6689895 },
  { id:"S06", name:"緑川", lat:32.6940800, lng:130.6312200 },
  { id:"S07", name:"住吉", lat:32.7020569, lng:130.5978974 },
  { id:"S08", name:"肥後長浜", lat:32.6906325, lng:130.5602429 },
  { id:"S09", name:"網田", lat:32.6676218, lng:130.5468003 },
  { id:"S10", name:"赤瀬", lat:32.6533333, lng:130.5100028 },
  { id:"S11", name:"石打ダム", lat:32.6425269, lng:130.5068254 },
  { id:"S12", name:"波多浦", lat:32.6153747, lng:130.4879955 },
  { id:"S13", name:"三角", lat:32.6077500, lng:130.4696800 }
];

const trains = [
  {
    id:"8031D",
    currentStation:"富合",
    nextStation:"宇土",
    nextStop:"宇土",
    rawDirection:"下り",
    latitude:32.71283416,
    longitude:130.6727855,
    speed:75,
    beaconAt:"2026/01/01 10:28",
    acquiredAt:"2026/01/01 10:28",
    formation:"キハ185-4",
    cabCarNo:"キハ185-4"
  },
  {
    id:"527D",
    currentStation:"三角",
    nextStation:"三角",
    nextStop:"三角",
    rawDirection:"下り",
    latitude:32.60767861,
    longitude:130.4699545,
    speed:-3.6,
    beaconAt:"2026/01/01 10:02",
    acquiredAt:"2026/01/01 10:28",
    formation:"キハ147-106",
    cabCarNo:"キハ147-106"
  }
];

function stationIndex(name){
  return stations.findIndex(s => s.name === name);
}

function routePositionIndex(train){
  const aIndex = stationIndex(train.currentStation);
  const bIndex = stationIndex(train.nextStation);
  if(aIndex < 0) return 0;
  if(bIndex < 0 || aIndex === bIndex) return aIndex;

  const a = stations[aIndex], b = stations[bIndex];
  const cosLat = Math.cos(((a.lat+b.lat)/2) * Math.PI/180);
  const ax=a.lng*cosLat, ay=a.lat, bx=b.lng*cosLat, by=b.lat;
  const px=train.longitude*cosLat, py=train.latitude;
  const abx=bx-ax, aby=by-ay, apx=px-ax, apy=py-ay;
  const denom=abx*abx+aby*aby;
  const t=denom>0 ? Math.max(0,Math.min(1,(apx*abx+apy*aby)/denom)) : 0;
  return aIndex + (bIndex-aIndex)*t;
}

function trainLocationLabel(train){
  if(train.currentStation === train.nextStation) return `${train.currentStation}駅`;
  return `${train.currentStation} → ${train.nextStation}`;
}

function receivedTimeOnly(datetime){
  return String(datetime).split(" ").pop();
}

async function loadTrainData(){
  return trains.map(t => ({...t, positionIndex:routePositionIndex(t)}));
}
