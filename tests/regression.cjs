// Focused, dependency-free regressions: real app.js calculation/save functions in a minimal DOM.
// The route below is a SYNTHETIC test fixture, independent of the supplied RHINE SENTINELLE preset, tested separately below.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),core=require('../logic-core.js');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const near=(a,b,msg='')=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-6,`${msg}: ${a} != ${b}`);
const json=x=>JSON.parse(JSON.stringify(x));
const elements=new Map();
class Element {
  constructor(value=''){this.value=value;this.checked=false;this.disabled=false;this.options=[];this.textContent='';this.style={};this.classList={toggle(){},remove(){},add(){}};}
  set innerHTML(v){this.html=v;this.options=[];} get innerHTML(){return this.html||'';}
  appendChild(o){this.options.push(o);if(this.value==='')this.value=String(o.value);}
  setAttribute(k,v){this[k]=v;} removeAttribute(k){delete this[k];}
  cloneNode(){return Object.assign(new Element(this.value),this);}
}
const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
const html=read('index.html');
for(const m of html.matchAll(/<(?:input|select)\b[^>]*\bid="([^"]+)"[^>]*>/g))get(m[1]).value=m[0].match(/\bvalue="([^"]*)"/)?.[1]||'';
for(const m of html.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){
  const os=[...m[2].matchAll(/<option\b([^>]*)>/g)];
  const selected=os.find(o=>/\bselected\b/.test(o[1]))||os[0];
  if(selected)get(m[1]).value=selected[1].match(/value="([^"]*)"/)?.[1]||'';
}
const fetches=[];
const saved=new Map(),ctx={console,IFECore:core,IFEMissionBackup:require('../mission-backup.js'),fetch:async url=>{fetches.push(url);return {ok:true,json:async()=>JSON.parse(read(url))};},document:{getElementById:get,createElement:()=>new Element(),documentElement:{lang:'en'},querySelectorAll:()=>[]},localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,String(v))},setTimeout:()=>{}};
ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(read('app.js').replace(/toggleCruiseMode\(\);\s*boot\(\);\s*$/,''),ctx);
const run=code=>vm.runInContext(code,ctx);
ctx.profiles=JSON.parse(read('data/aircraft-profiles.json')).profiles;ctx.fuel=JSON.parse(read('data/fuel-flow.json'));ctx.nav=JSON.parse(read('data/navdata.json'));
run(`state.profiles=profiles;state.fuelData=fuel;state.navData=nav;$('aircraft').value=state.selectedAircraft;
  originalRenderRoute=renderRoute;renderRoute=()=>{syncEndpoints();updateBingoOptions();updateAarOptions();};
  originalCalcCruise=calcCruise;originalToggleCruiseMode=toggleCruiseMode;drawRoute=()=>{};calcCruise=()=>{};renderProfileList=()=>{};
  syncAlternatePreset=()=>{};useMissionAirportElevations=()=>{};toggleCruiseMode=()=>{};showView=()=>{};
  state.fuelCache['fuel-flow.json']=fuel;`);
const snapshot=()=>run(`({s:state.summary,a:state.aar,route:state.route,legs:state.calc,
  start:$('tankOnBoard').value,onload:$('aarManualKg').value,card:$('dataCardSheet').innerHTML})`);
function setup({manual=true,duration=10,hold=0,start=7213,onload=300}={}){
  run(`loadDemo();$('startZulu').value='17:30';$('departure').value='ETSN';$('arrival').value='ETSN';
    setEndpointElevationFromAirport('dep');setEndpointElevationFromAirport('arr');
    $('tankOnBoard').value='${start}';$('taxiMin').value='8';$('aarEnabled').checked=true;
    $('aarConfig').value='3 BAGS';$('aarAlt').value='210';$('aarSpeed').value='285';
    $('aarDuration').value='${duration}';$('aarManualToggle').checked=${manual};$('aarManualKg').value='${onload}';
    $('aarTargetOut').value='';$('jokerBasis').value='in';$('jokerBuffer').value='795';
    state.route=[{wp:'ETSN',alt:missionDepElev(),mach:'',dist:0},
      {wp:'RP ANGIE',alt:21000,mach:.60,wind:-5,dist:80,lat:49.5,lon:10},
      {wp:'S-PUSH',alt:21000,mach:.60,wind:3,dist:70,holdMin:${hold},lat:49.7,lon:9},
      {wp:'IP',alt:21000,mach:.60,wind:0,dist:60},
      {wp:'TGT-SUIP',alt:21000,mach:.60,wind:0,dist:20},
      {wp:'ETSN',alt:missionArrElev(),mach:.60,wind:0,dist:110}];
    state.route.forEach(r=>{r.wind=r.wind??0;r.mode='distance';r.inputTime=0;r.holdMin=r.holdMin||0;r.etaOverride='';});
    renderRoute();$('aarWp').value='1';$('bingoWp').value='5';$('jokerWp').value='2';recalc();`);
  return snapshot();
}
const geometry=x=>json(x.route.map(r=>[r.wp,r.lat,r.lon,r.alt,r.mach,r.wind,r.mode,r.dist,r.inputTime]));
let count=0;
async function test(label,fn){await fn();count++;console.log(`PASS ${count}. ${label}`);}
if(require.main===module)(async()=>{
  await test('AUTO AAR without HOLD: target is actual OUT',()=>{
    const x=setup({manual:false,start:2500});assert.equal(x.a.status,'PLAN OK');
    near(x.a.accepted,x.a.targetOutFob-x.a.currentFobBefore+x.a.durationBurn);
    near(x.a.fobAfter,x.a.targetOutFob);near(x.s.fobOutAt[1],x.a.fobAfter);assert.equal(x.start,'2500');
    run(`$('aarTargetOut').value='6000';recalc();`);const custom=snapshot();near(custom.a.fobAfter,6000);assert.equal(custom.start,'2500');
  });
  await test('MANUAL AAR without HOLD: exact onload; independent required/planned fuel',()=>{
    const x=setup();near(x.a.accepted,300);near(x.a.fobAfter,x.a.currentFobBefore+300-x.a.durationBurn);
    near(x.s.plannedTakeoffFob,7213-x.s.ground);assert.notEqual(x.s.plannedTakeoffFob,x.s.requiredTakeoff);
    assert.equal(x.start,'7213');assert.equal(x.onload,'300');assert.match(x.card,/T\/O REQ/);assert.match(x.card,/PLANNED T\/O FOB/);
    assert.doesNotMatch(x.card,/TARGET FOB OUT/);assert.equal(get('aarTicketTargetRow').hidden,true);
  });
  await test('MANUAL + S-PUSH HOLD: fuel/time IN and OUT; whole downstream path',()=>{
    const a=setup(),b=setup({hold:17});near(b.s.fobInAt[2],a.s.fobInAt[2]);
    near(b.s.fobInAt[2]-b.s.fobOutAt[2],b.s.holdFuelAt[2]);near(b.s.landingFob,a.s.landingFob-b.s.holdFuelAt[2]);
    near(b.s.cumulative[3]-a.s.cumulative[3],17);assert.deepEqual(geometry(a),geometry(b));
    near(b.s.landingFob,7213-b.s.ground-b.s.trip+b.a.accepted-b.a.durationBurn);
  });
  await test('AAR duration 0 / 10 / 20 minutes: burn and geometry',()=>{
    const xs=[0,10,20].map(duration=>setup({duration}));
    near(xs[0].a.durationBurn,0);near(xs[2].a.durationBurn,2*xs[1].a.durationBurn);
    near(xs[0].s.landingFob-xs[1].s.landingFob,xs[1].a.durationBurn);
    near(xs[0].s.landingFob-xs[2].s.landingFob,xs[2].a.durationBurn);
    xs.forEach(x=>{assert.deepEqual(geometry(x),geometry(xs[0]));assert.equal(x.start,'7213');assert.equal(x.onload,'300');});
  });
  await test('Joker WP IN includes selected HOLD exactly once',()=>{
    const a=setup({hold:0}),b=setup({hold:17});const floor=b.s.divert+b.s.recovery+b.s.reserve;
    near(b.s.joker,Math.ceil(b.s.remaining[2]+floor+795-1e-9));
    near(b.s.remaining[2]-a.s.remaining[2],b.s.holdFuelAt[2]);
    near(b.s.bingo,Math.ceil(floor-1e-9));near(b.s.remaining[5],0);
  });
  await test('Joker WP OUT excludes selected HOLD; same-WP AAR is not counted twice',()=>{
    const x=setup({hold:17});run(`$('jokerBasis').value='out';updateBingo();`);const out=snapshot();
    near(out.s.joker,Math.ceil(x.s.remaining[2]-x.s.holdFuelAt[2]+x.s.divert+x.s.recovery+x.s.reserve+795-1e-9));
    near(out.s.jokerPredicted,out.s.fobOutAt[2]);
    run(`$('jokerWp').value='1';updateBingo();`);const same=snapshot();
    near(same.s.jokerRemaining,same.s.remainingRoute[1]);
  });
  await test('Capacity: simultaneous burn space, impossible MANUAL and unreachable AAR',()=>{
    const a=core.computeAarFuelState({fobIn:7213,targetOutFob:7213,durationBurn:300,capacity:7213});
    near(a.accepted,300);near(a.fobOut,7213);near(a.fobAfterLoad,7513);assert.ok(a.valid);
    for(let t=0;t<=1;t+=.01)assert.ok(a.fobIn+(a.accepted-300)*t<=7213+1e-7);
    const b=core.computeAarFuelState({fobIn:7000,requestedOnload:1000,manual:true,durationBurn:300,capacity:7213});
    assert.equal(b.requested,1000);assert.equal(b.valid,false);assert.ok(Number.isNaN(b.fobOut));
    const c=core.computeAarFuelState({fobIn:100,requestedOnload:0,manual:true,durationBurn:300,capacity:7213});assert.equal(c.fuelExhausted,true);assert.ok(Number.isNaN(c.fobOut));
    const x=setup({onload:4000});assert.equal(x.a.status,'CAP LIMIT');assert.equal(get('planStatus').textContent,'AAR CHECK');assert.equal(x.onload,'4000');assert.equal(x.start,'7213');assert.ok(Number.isNaN(x.s.landingFob));
    const y=setup({start:100});assert.equal(y.a.status,'UNREACHABLE');assert.ok(Number.isNaN(y.s.landingFob));
    assert.equal(core.computeAarFuelState({fobIn:8000,capacity:7213}).valid,false);
  });
  await test('AAR shifts downstream ETA and OUT once; arrival IN is unchanged',()=>{
    const a=setup({duration:0}),b=setup({duration:10});near(a.s.cumulative[1],b.s.cumulative[1]);
    for(let i=2;i<a.route.length;i++)near(b.s.cumulative[i]-a.s.cumulative[i],10);
    assert.notEqual(a.a.aarOut,b.a.aarOut);assert.deepEqual(geometry(a),geometry(b));
  });
  await test('HOLD shifts downstream ETA; hard times add real hold/burn or flag lateness',()=>{
    const a=setup({hold:0}),b=setup({hold:17});near(a.s.cumulative[2],b.s.cumulative[2]);near(b.s.time-a.s.time,17);
    run(`state.route[4].etaOverride=formatZulu(state.summary.startZuluMin+state.summary.cumulative[4]+10);recalc();`);
    const anchored=snapshot();assert.equal(anchored.s.hardTimeIssues.length,0);assert.ok(anchored.s.scheduleHoldAt[2]>9);
    near(anchored.s.cumulative[4]+anchored.s.startZuluMin,run(`parseZulu(state.route[4].etaOverride)`));
    assert.ok(anchored.s.landingFob<b.s.landingFob);assert.equal(anchored.route[2].holdMin,17);assert.deepEqual(geometry(b),geometry(anchored));
    run(`state.route[4].etaOverride='17:45';recalc();`);const late=snapshot();assert.equal(late.s.hardTimeIssues[0].reason,'LATE');near(late.s.cumulative[4],b.s.cumulative[4]);
    const midnight=core.buildSimpleTimeline({legMinutes:[10,15],holdMinutes:[0,5,0],hardTimeMinutes:[NaN,NaN,40]});near(midnight.etaIn[2],40);near(midnight.scheduleHoldMinutes[1],10);
  });
  await test('LEG NM / coordinates invariant across AUTO, MANUAL, HOLD, durations, Joker, capacity, ETA',()=>{
    const base=setup();for(const options of [{manual:false},{hold:17},{duration:0},{duration:20},{onload:9000}])assert.deepEqual(geometry(setup(options)),geometry(base));
    setup();run(`$('jokerBasis').value='out';updateBingo();state.route[4].etaOverride='18:50';recalc();`);assert.deepEqual(geometry(snapshot()),geometry(base));
    run(`state.route[0].lat=48.123;state.route[0].lon=11.234;state.route[5].lat=48.456;state.route[5].lon=11.567;recalc();`);
    near(run('state.route[0].lat'),48.123);near(run('state.route[5].lon'),11.567);
    const zero=run(`calculateLeg({lat:49,lon:10,alt:21000},{lat:49,lon:10,alt:21000,mach:.6,wind:0,dist:0,mode:'distance'})`);
    assert.equal(zero.error,'');near(zero.distance,0);near(zero.time,0);near(zero.fuel,0);
    run(`loadDemo();`);const demoNm=json(run('state.calc.map(c=>c?.distance)'));
    run(`state.route[2].holdMin=17;state.route[5].etaOverride='23:50';recalc();`);assert.deepEqual(json(run('state.calc.map(c=>c?.distance)')),demoNm);
  });
  await test('Old saves remain readable and untouched; labels/values survive save/load; default remains demo',async()=>{
    const x=setup({hold:17});run('saveMission()');const stored=saved.get('vgaf_mission_v08');const fresh=JSON.parse(stored).mission;const old={version:13,route:fresh.route,fields:fresh.fields,toggles:fresh.toggles,...fresh.references,missionMeta:fresh.missionMeta};delete old.fields.jokerBasis;delete old.fields.aarTargetOut;saved.set('vgaf_mission_v08',JSON.stringify(old));
    const before=saved.get('vgaf_mission_v08');run(`$('jokerBasis').value='out';$('aarTargetOut').value='9999';`);await run('loadMission()');
    assert.equal(saved.get('vgaf_mission_v08'),before);assert.equal(get('jokerBasis').value,'in');assert.equal(get('aarTargetOut').value,'');
    assert.equal(run('state.route[1].wp'),'RP ANGIE');near(run('state.route[1].lat'),49.5);near(run('state.route[1].mach'),.6);
    assert.equal(get('tankOnBoard').value,'7213');near(snapshot().s.landingFob,x.s.landingFob);
    run('loadDemo()');assert.equal(saved.get('vgaf_mission_v08'),before);assert.equal(get('callsign').value,'TEST01');
    assert.deepEqual(json(run('state.route.map(r=>r.wp)')),['ETNN','KOMUT','NARAK','TUDRA','ROMOK','OVTIL','ETNN']);
    assert.equal(run('sanitizeRoute([{wp:"DEP"},{wp:"AAR OUT",mach:.4}])[1].mach'),.4);
  });
  await test('Unsupported AAR configuration/speed has no fabricated burn or downstream FOB',()=>{
    setup();run(`$('aarConfig').value='CLEAN';recalc();`);assert.equal(snapshot().a.status,'AAR PROFILE');assert.ok(Number.isNaN(snapshot().s.landingFob));
    setup();run(`$('aarSpeed').value='40';recalc();`);assert.equal(snapshot().a.status,'AAR PROFILE');assert.ok(Number.isNaN(snapshot().s.landingFob));
  });
  const preset=JSON.parse(read('data/mission-presets.json')).presets[0];
  await test('Optional RHINE SENTINELLE preset: explicit load, exact inputs, old saves/default retained',async()=>{
    run('loadDemo();saveMission();');const priorSave=saved.get('vgaf_mission_v08'),demo=geometry(snapshot());
    const beforeFetch=fetches.length;assert.equal(await run('loadMissionPreset()'),false);assert.equal(fetches.length,beforeFetch);
    get('missionPreset').value=preset.missionMeta.id;assert.equal(await run('loadMissionPreset()'),true);
    assert.equal(saved.get('vgaf_mission_v08'),priorSave);
    const x=snapshot();assert.equal(x.route.length,26);near(x.s.dist,723.5);
    for(const [id,value] of Object.entries(preset.fields))assert.equal(String(get(id).value),id==='missionNotes'?value.replace(/\bM(\d+[.,]\d{3,})/g,(_,n)=>'M'+Number(Number(n).toFixed(2))):value,id);
    preset.route.forEach((r,i)=>{for(const k of ['wp','alt','mach','wind','dist','holdMin','etaOverride','plannedEta','plannedOut'])assert.equal(x.route[i][k],r[k],`${i+1} ${k}`);if(r.lat!==undefined){near(x.route[i].lat,r.lat);near(x.route[i].lon,r.lon);}});
    assert.deepEqual(json(x.route.filter(r=>r.etaOverride).map(r=>r.wp)),['TGT-SUIP']);
    assert.equal(x.route[2].wp,'MEXIT');assert.equal(x.s.divertName,'ETNN');assert.equal(x.s.jokerIndex,7);assert.equal(x.s.jokerBasis,'in');assert.equal(x.s.bingoIndex,25);
    assert.equal(x.a.index,3);assert.equal(x.route[4].holdMin,0);assert.equal(x.route[5].holdMin,0);
    assert.match(x.card,/MMF15/);assert.match(x.card,/118\.680 MHz TBC \/ provisional/);assert.match(x.card,/DMPI1\/DMPI2/);
    run('loadDemo();');assert.deepEqual(geometry(snapshot()),demo);assert.equal(get('callsign').value,'TEST01');assert.equal(get('missionName').value,'');assert.equal(get('aarEnabled').checked,false);
    assert.equal(saved.get('vgaf_mission_v08'),priorSave);
  });
  await test('Preset calculation: briefing fuel state, coordinated speed/HOLD plan, hard TOT, editable onload/speed/frequency',async()=>{
    get('missionPreset').value=preset.missionMeta.id;assert.equal(await run('loadMissionPreset()'),true);const x=snapshot(),shape=geometry(x);
    near(x.a.accepted,966);near(x.a.durationBurn,324.1449685692674);near(x.a.fobAfter,x.s.fobInAt[3]+966-x.a.durationBurn);
    assert.ok(x.a.fobAfterLoad>7213);assert.ok(x.a.fobAfter<7213);assert.equal(x.a.status,'PLAN OK');
    near(x.s.landingFob,7213-x.s.ground-x.s.trip+966-x.a.durationBurn);near(x.s.fobInAt[7]-x.s.fobOutAt[7],x.s.holdFuelAt[7]);
    near(x.s.holdAt[7],preset.route[7].holdMin);near(x.s.scheduleHoldAt.reduce((a,b)=>a+b,0),0);near(x.s.time,x.s.routeTime+preset.route[7].holdMin+10);
    assert.equal(x.s.hardTimeIssues.length,0);assert.equal(get('planStatus').textContent,'PLAN READY');near(x.s.cumulative[3],20);near(x.s.cumulative[7]+x.s.holdAt[7],60);near(x.s.cumulative[12],80);near(x.s.divert,1253);near(x.s.reserve,600);assert.equal(get('jokerBuffer').value,'795');near(run('state.diverts[0].fuel'),1119);
    run(`state.route[11].mach=.55;recalc();`);assert.equal(get('planStatus').textContent,'HARD TIME CHECK');assert.ok(snapshot().s.hardTimeIssues[0].delta<0);run(`state.route[11].mach=${preset.route[11].mach};recalc();`);
    near(x.s.bingo,1853);near(x.s.joker,6449);near(x.s.remaining[25],0);assert.equal(x.start,'7213');
    for(const f of [...x.s.fobInAt,...x.s.fobOutAt])assert.ok(f>=0&&f<=7213);
    run(`$('aarManualKg').value='1000';recalc();`);const edited=snapshot();near(edited.a.accepted,1000);near(edited.s.landingFob-x.s.landingFob,34);assert.equal(edited.start,'7213');assert.deepEqual(geometry(edited),shape);
    run(`$('aarSpeed').value='285';$('aarFrequency').value='119.100 MHz TBC';recalc();saveMission();`);near(snapshot().a.durationBurn,327.7385832561052);
    const serialized=saved.get('vgaf_mission_v08');run('loadDemo();');await run('loadMission()');assert.equal(saved.get('vgaf_mission_v08'),serialized);
    assert.equal(get('aarManualKg').value,'1000');assert.equal(get('aarSpeed').value,'285');assert.equal(get('aarFrequency').value,'119.100 MHz TBC');assert.deepEqual(geometry(snapshot()),shape);
    get('missionPreset').value=preset.missionMeta.id;assert.equal(await run('loadMissionPreset()'),true);assert.equal(saved.get('vgaf_mission_v08'),serialized);
    assert.equal(get('aarManualKg').value,'966');assert.equal(get('aarSpeed').value,'280');
    if(process.argv.includes('--write-report')){
      const current=snapshot();const clock=min=>{let seconds=Math.round(min*60)%86400;if(seconds<0)seconds+=86400;return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':')+'Z';};
      const s=current.s,a=current.a;
      const report={preset:preset.missionMeta.title,basis:preset.missionMeta.basisNote,status:get('planStatus').textContent,
        fuelKg:{start:7213,plannedTakeoff:s.plannedTakeoffFob,angieIn:s.fobInAt[3],grossOnload:a.accepted,aarBurn:a.durationBurn,aarOut:a.fobAfter,spushIn:s.fobInAt[7],spushOut:s.fobOutAt[7],joker:s.joker,bingo:s.bingo,tgt:s.fobInAt[12],landing:s.landingFob},
        comparisons:{joker:{expected:6458,actual:s.joker,delta:s.joker-6458},bingo:{expected:1853,actual:s.bingo,delta:s.bingo-1853},diverts:json(run('state.diverts')).map((d,i)=>({icao:d.name,expected:i?1253:1119,actual:d.fuel,delta:d.fuel-(i?1253:1119)}))},
        timing:{angieIn:clock(s.startZuluMin+s.cumulative[3]),aarOut:clock(s.startZuluMin+s.cumulative[3]+a.duration),spushIn:clock(s.startZuluMin+s.cumulative[7]),spushOut:clock(s.startZuluMin+s.cumulative[7]+s.holdAt[7]),tot:clock(s.startZuluMin+s.cumulative[12]),totLateSeconds:Math.max(0,(s.cumulative[12]-80)*60),landing:clock(s.startZuluMin+s.time)},
        route:current.route.map((r,i)=>({wp:r.wp,legNm:i?current.legs[i].distance:0,plannedEta:r.plannedEta,hardTime:r.etaOverride,actualEta:clock(s.startZuluMin+s.cumulative[i]),fobIn:s.fobInAt[i],holdMin:s.holdAt[i],holdBurn:s.holdFuelAt[i],fobOut:s.fobOutAt[i]}))};
      fs.mkdirSync(path.join(root,'verification'),{recursive:true});fs.writeFileSync(path.join(root,'verification/rhine-sentinelle-calculation.json'),JSON.stringify(report,null,2)+'\n');
    }
  });
  await test('Mach display: max 2 decimals in route/PDF, no implicit precision loss on change/render/save/load',async()=>{
    get('missionPreset').value=preset.missionMeta.id;await run('loadMissionPreset()');
    const before=json(snapshot().s),originalCreate=ctx.document.createElement;
    const fields=[];
    ctx.document.createElement=tag=>{
      const el=new Element();
      if(tag==='tr'){
        el.dataset={};
        el.querySelector=()=>null;
        el.querySelectorAll=selector=>{
          if(selector!=='[data-k]')return [];
          const value=el.innerHTML.match(/data-k="mach"[\s\S]*?value="([^\"]*)"/)[1];
          const field={value,dataset:{k:'mach'},classList:{remove(){}},events:{},addEventListener(name,fn){this.events[name]=fn;}};
          fields.push(field);return [field];
        };
      }
      return el;
    };
    run('originalRenderRoute()');
    assert.equal(fields[3].value,'0.72');assert.equal(fields[11].value,'0.58');
    fields[3].events.change();fields[11].events.change();
    near(run('state.route[3].mach'),preset.route[3].mach);near(run('state.route[11].mach'),preset.route[11].mach);
    run('renderDataCard();');assert.doesNotMatch(snapshot().card,/0\.724209|0\.582383/);assert.match(snapshot().card,/>0\.72<\/td>/);assert.match(snapshot().card,/>0\.58<\/td>/);
    assert.deepEqual(json(snapshot().s),before);
    ctx.document.createElement=originalCreate;
    run('saveMission();');await run('loadMission()');
    near(run('state.route[3].mach'),preset.route[3].mach);near(run('state.route[11].mach'),preset.route[11].mach);
    assert.deepEqual(json(snapshot().s),before);
    assert.equal(run('displayMach(.7)'),'0.7');assert.equal(run('displayMach(.724209185211)'),'0.72');
  });
  setup();const burn=run('aarBurnProfile(1).aarBurnRate');console.log(`AAR model, FL210 / 285 KIAS / 3 BAGS / 10 min / 0% surcharge: ${(burn*10).toFixed(6)} kg`);
  console.log(`${count} focused regressions passed.`);
})().catch(e=>{console.error(e);process.exitCode=1;});

module.exports={run,snapshot,saved,get,json,read,ctx,geometry,fetches};
