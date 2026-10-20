const assert=require('node:assert/strict');
const t=require('./regression.cjs');
const data=JSON.parse(t.read('data/international-airbases.json'));
const nav=JSON.parse(t.read('data/navdata.json'));
const merged=new Map(nav.airports.map(a=>[a.icao,a]));
for(const a of data.airbases)if(!merged.has(a.icao))merged.set(a.icao,a);
t.ctx.extendedNav={...nav,airports:[...merged.values()]};
const ids=new Set();
for(const a of data.airbases){assert.ok(!ids.has(a.icao),a.icao);ids.add(a.icao);assert.match(a.icao,/^[A-Z]{4}$/);for(const k of ['lat','lon','elevationFt'])assert.ok(Number.isFinite(a[k]),`${a.icao} ${k}`);assert.ok(Math.abs(a.lat)<=90&&Math.abs(a.lon)<=180);}
const p=Object.getPrototypeOf(t.get('alternate1Search'));
p.replaceChildren=function(){this.options=[];this.textContent='';};p.append=function(...items){items.forEach(x=>this.appendChild(x));};p.matches=()=>false;p.addEventListener=function(k,f){(this.events??={})[k]=f;};
t.run(`state.navData=extendedNav;state.missionNavigation=null;loadDemo();$('arrival').value='ETSN';setEndpointElevationFromAirport('arr');$('divertAltitude').value='30000';$('divertMach').value='.85';$('divertWind').value='0';$('alternate1Country').value='FR';`);
const found=()=>t.get('alternate1Results').options.filter(x=>x.className==='airbase-result');
for(const q of ['LFPV','lfpv','Velizy','Vélizy','Villacoublay','LFPV · Vélizy-Villacoublay Air Base']){
 t.get('alternate1Search').value=q;t.run('renderAirbaseSearch(1)');assert.ok(found().some(r=>r.options[0].options[0].textContent.includes('LFPV')),q);
}
// Actual selection handler (recalc runs the unchanged fuel engine).
found()[0].options[0].events.click();assert.equal(t.get('alternate1').value,'LFPV');assert.equal(found().length,1);
const d=t.run('calculateDivert(1)');assert.equal(d.valid,true);assert.equal(d.status,'AUTO DB');assert.ok(d.distance>300&&d.distance<400);assert.ok(d.fuel>0&&d.time>0);
const a=t.run("airport(' lfpv ')");assert.equal(a.elevationFt,585);assert.ok(Math.abs(a.lat-48.7741666667)<1e-9);assert.ok(Math.abs(a.lon-2.1913888889)<1e-9);
// Direct manual ICAO works, without needing to click a search result.
t.get('alternate2').value='lfpv';t.get('divert2ManualDist').value='';t.get('divert2ManualElev').value='';assert.equal(t.run('calculateDivert(2).valid'),true);
t.get('divert2ManualDist').value='400';t.get('divert2ManualElev').value='600';assert.equal(t.run('calculateDivert(2).distance'),400);
t.get('alternate2').value='ZZZZ';t.get('divert2ManualDist').value='';t.get('divert2ManualElev').value='';assert.equal(t.run('calculateDivert(2).valid'),false);
// Imported snapshots keep old airport data and gain missing records; export captures additions.
t.run('state.missionNavigation=JSON.parse(JSON.stringify(nav));state.missionNavigation.airports.find(a=>a.icao===\'ETSN\').elevationFt=1234;');
assert.equal(t.run("airport('ETSN').elevationFt"),1234);assert.equal(t.run("airport('LFPV').elevationFt"),585);assert.ok(t.run("captureMissionState().navigation.airports.some(a=>a.icao==='LFPV')"));
assert.equal(t.run('new Set(activeNavigation().airports.map(a=>a.icao)).size'),t.run('activeNavigation().airports.length'));
t.get('alternate1Country').value='GB';t.get('alternate1Search').value='LFPV';t.run('renderAirbaseSearch(1)');assert.equal(found().length,0);
console.log('PASS airport data, accent/label search, country filter, selection, direct ICAO, manual overrides, unknown-airport handling, saved snapshot precedence and export');
console.log('ETSN -> LFPV test profile:',JSON.stringify(d));
