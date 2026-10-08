const assert=require('node:assert/strict'),t=require('./regression.cjs'),B=require('../mission-backup.js');
const copy=B.clone,run=t.run,get=t.get;
let count=0;
async function test(name,fn){await fn();console.log(`PASS ${++count}. ${name}`);}
function capture(){return copy(run('createMissionBackup()'));}
function cruise(){return Object.fromEntries(['cruiseClimbFuel','cruiseCruiseFuel','cruiseDescentFuel','cruiseFlightFuel','cruiseResultTime','cruiseResultDistance','cruiseBlockFuel','cruiseFlow','cruiseStatus'].map(id=>[id,get(id).textContent]));}
function importData(data){t.ctx.imported=copy(data);run('applyMissionBackup(imported)');}
function configure(){
 run(`loadDemo();calcCruise=originalCalcCruise;toggleCruiseMode=originalToggleCruiseMode;
  $('missionName').value='ROUNDTRIP TEST';$('missionType').value='TRAINING';$('callsign').value='TEST 22';$('missionDate').value='2026-11-09';$('startZulu').value='09:17';
  $('missionNotes').value='Exact inputs / Übung';$('tankOnBoard').value='6987.123';$('taxiMin').value='9.25';$('reserveKg').value='655.25';$('surchargePct').value='3.75';$('recoveryExtra').value='123.5';
  state.route[1].lat=50.123456789;state.route[1].lon=7.987654321;state.route[1].mach=.724209185211;state.route[1].wind=-17.25;
  state.route[1].dist=57.123456789;state.route[2].holdMin=12.736402166549;state.route[3].plannedEta='10:00';state.route[3].plannedOut='10:01';
  state.route[4].inputTime=18.125;state.route[4].mach=.582383733703;state.route[5].etaOverride='12:15';
  $('aarEnabled').checked=true;$('aarManualToggle').checked=true;$('aarManualKg').value='765.4321';$('aarWp').value='3';
  $('aarArip').value='ENTRY X';$('aarArcp').value='RENDEZVOUS';$('aarPlannedArct').value='10:05';$('aarPlannedOut').value='10:17';$('aarAlt').value='210';$('aarSpeed').value='281';$('aarConfig').value='3 BAGS';$('aarDuration').value='12.125';$('aarTargetOut').value='5000.5';
  $('aarTankerType').value='TANKER';$('aarTankerCallsign').value='FUEL 01';$('aarFrequency').value='123.450 TBC';$('aarBingo2').value='1998.25';$('aarB2Rtb').value='ETAD';
  $('bingoWp').value='4';$('jokerWp').value='2';$('jokerBasis').value='out';$('jokerBuffer').value='812.345';$('bingoManualToggle').checked=true;$('bingoManual').value='2345.67';$('jokerManualToggle').checked=true;$('jokerManual').value='5678.91';
  $('divertSelection').value='1';$('divert1ManualDist').value='144.987';$('divert2ManualDist').value='158.765';$('divert1ManualElev').value='1259.5';$('divert2ManualElev').value='789.1';$('divertAltitude').value='23100';$('divertMach').value='0.81345';$('divertWind').value='-13.25';
  $('cruiseMode').value='distance';$('cruiseDistanceSource').value='manual';$('cruiseDistance').value='432.1987';$('cruiseTimeInput').value='87.987';$('cruiseAltitude').value='31765';$('cruiseMach').value='0.87654321';$('cruiseWind').value='12.5';$('cruiseDepElev').value='1777.5';$('cruiseArrElev').value='944.75';
  state.missionMeta={divertFuelArrival:'ETNN',divertFuelKg:{ETAD:1321.5,ETAR:1543.125},note:'arbitrary user metadata'};
  recalc();`);
}
(async()=>{
 await test('Complete general mission: export → reset → import, exact inputs AND recalculated route/fuel/cruise',()=>{
  configure();const before=capture(),expectedCruise=cruise(),savedBefore=[...t.saved];
  const text=JSON.stringify(before);run('loadDemo()');assert.notDeepEqual(capture().mission,before.mission);
  importData(B.parse(text));const after=capture();assert.deepEqual(after.mission,before.mission);assert.deepEqual(after.calculated,before.calculated);assert.deepEqual(cruise(),expectedCruise);assert.deepEqual([...t.saved],savedBefore);
  assert.equal(get('missionBackupStatus').textContent,'Mission successfully imported');assert.equal(run('state.route[1].mach'),.724209185211);
 });
 await test('Cross-device performance/nav snapshots, no network or localSave overwrite; reset returns to installed model',()=>{
  configure();const before=capture(),nav=copy(t.ctx.nav),profile=copy(t.ctx.profiles),fuel=copy(t.ctx.fuel),fetchCount=t.fetches.length;
  run(`loadDemo();state.profiles[0].climbFuelKgPerMin=999;state.profiles[0].groundFuelKgPerMin=28;state.profiles[0].tankCapacityKg=9000;state.navData.airports.forEach(a=>{if(a.icao==='ETAD')a.lat+=1;});state.fuelData.modelAnchors[0].points[0].kgMin=987;`);
  importData(before);assert.deepEqual(capture().calculated,before.calculated);assert.deepEqual(capture().mission,before.mission);assert.equal(t.fetches.length,fetchCount);
  run('loadDemo()');assert.equal(run('profile().groundFuelKgPerMin'),28);assert.equal(run('state.missionNavigation'),null);
  t.ctx.resetProfiles=profile;t.ctx.resetNav=nav;t.ctx.resetFuel=fuel;run(`state.profiles=resetProfiles;state.navData=resetNav;state.fuelData=resetFuel;state.fuelCache['fuel-flow.json']=resetFuel;`);
 });
 await test('AUTO AAR, AUTO Bingo/Joker, WP IN; cruise route/direct/time modes roundtrip',()=>{
  configure();for(const mode of ['route','direct','time']){
   run(`$('aarManualToggle').checked=false;$('bingoManualToggle').checked=false;$('jokerManualToggle').checked=false;$('jokerBasis').value='in';$('cruiseDistanceSource').value='${mode==='time'?'manual':mode}';$('cruiseMode').value='${mode==='time'?'time':'distance'}';recalc();`);
   const before=capture(),cc=cruise();run('loadDemo()');importData(before);assert.deepEqual(capture().mission,before.mission);assert.deepEqual(capture().calculated,before.calculated);assert.deepEqual(cruise(),cc);
  }
 });
 await test('All required missing sections/fields, version/model mismatch and malformed files rejected atomically',()=>{
  configure();const good=capture(),savedBefore=[...t.saved];
  const broken=[{...good,schemaVersion:999},{...good,schemaVersion:0}];
  for(const k of Object.keys(good.mission)){const b=copy(good);delete b.mission[k];broken.push(b);}
  for(const k of B.FIELD_IDS){const b=copy(good);delete b.mission.fields[k];broken.push(b);}
  for(const k of ['wp','alt','mach','wind','mode','dist','inputTime','holdMin','etaOverride']){const b=copy(good);delete b.mission.route[2][k];broken.push(b);}
  const invalid=copy(good);invalid.mission.references.aarWp=9999;broken.push(invalid);
  const model=copy(good);model.mission.performance.modelVersion='future';broken.push(model);
  const coords=copy(good);coords.mission.route[1].lat=200;broken.push(coords);
  const emptyProfile=copy(good);emptyProfile.mission.performance.aircraftProfile={};broken.push(emptyProfile);
  for(const b of broken){assert.throws(()=>importData(b));assert.deepEqual(capture().mission,good.mission);}
  assert.throws(()=>B.parse('{broken'));assert.throws(()=>B.parse(JSON.stringify(good).replace('"mission":{','"__proto__":{"polluted":true},"mission":{')));assert.equal({}.polluted,undefined);
  assert.deepEqual([...t.saved],savedBefore);
 });
 await test('Calculated results are ignored on import; unsupported legacy file explains missing data',()=>{
  configure();const before=capture(),bad=copy(before);bad.calculated={informationalOnly:false,summary:{bingo:999999,block:1,landingFob:1}};importData(bad);assert.deepEqual(capture().calculated,before.calculated);
  assert.throws(()=>B.parse(JSON.stringify({version:16,route:before.mission.route,fields:before.mission.fields})),/Legacy browser save/);
 });
 await test('New local saves use same complete schema; old browser saves remain present during file import',async()=>{
  configure();const before=capture();t.saved.set('vgaf_mission_v07','historical save');run('saveMission()');const local=JSON.parse(t.saved.get('vgaf_mission_v08'));assert.deepEqual(local.mission,before.mission);
  run('loadDemo()');await run('loadMission()');assert.deepEqual(capture().mission,before.mission);assert.deepEqual(capture().calculated,before.calculated);assert.equal(t.saved.get('vgaf_mission_v07'),'historical save');
 });
 await test('Export button generates a JSON Blob download with full state',()=>{
  configure();const before=capture();let downloaded=null,blurred=false,clicked=false,removed=false;
  const create=t.ctx.document.createElement;
  t.ctx.Blob=class{constructor(parts,options){this.text=parts.join('');this.type=options.type;}};
  t.ctx.URL={createObjectURL(blob){downloaded=blob;return 'blob:test';},revokeObjectURL(){}};
  t.ctx.document.activeElement={blur(){blurred=true;}};
  t.ctx.document.body={appendChild(){}};
  const link={click(){clicked=true;},remove(){removed=true;}};
  t.ctx.document.createElement=tag=>tag==='a'?link:create(tag);
  run('exportCurrentMission()');assert.ok(blurred&&clicked&&removed);assert.match(link.download,/ROUNDTRIP_TEST_2026-11-09.json/);assert.match(downloaded.type,/application\/json/);assert.deepEqual(B.parse(downloaded.text).mission,before.mission);
  t.ctx.document.createElement=create;
 });
 await test('No missing form inputs, no 40-waypoint truncation, absent coordinates stay absent',()=>{
  const excluded=new Set(['missionPreset','missionImportFile','simbriefUser','aarCapacity','divert1Distance','divert2Distance','alternate1Search','alternate2Search','alternate1Country','alternate2Country','layoutSelect','languageSelect','themeSelect','bingoWp','jokerWp','aarWp','bingoManualToggle','jokerManualToggle','aarEnabled','aarManualToggle']);
  const ids=[...t.read('index.html').matchAll(/<(?:input|select|textarea)\b[^>]*\bid="([^"]+)"/g)].map(x=>x[1]);
  assert.deepEqual(ids.filter(id=>!excluded.has(id)&&!B.FIELD_IDS.includes(id)),[]);
  run(`loadDemo();const mid=JSON.parse(JSON.stringify(state.route[2]));state.route.splice(2,0,...Array.from({length:45},(_,i)=>({...mid,wp:'WP '+i})));renderRoute();recalc();`);
  const before=capture();assert.equal(before.mission.route.length,52);run('loadDemo()');importData(before);assert.deepEqual(capture().mission,before.mission);assert.equal(Object.hasOwn(capture().mission.route[2],'lat'),false);
 });
 await test('Actual file import handler: valid file, invalid file, oversize file, repeat import',async()=>{
  configure();const before=capture();let file={size:100,text:async()=>JSON.stringify(before)};t.ctx.testFile=file;run('loadDemo()');await run('importMissionFile(testFile)');assert.deepEqual(capture().mission,before.mission);
  t.ctx.testFile={size:10,text:async()=>'{bad'};await run('importMissionFile(testFile)');assert.match(get('missionBackupStatus').textContent,/Import rejected/);assert.deepEqual(capture().mission,before.mission);
  t.ctx.testFile={size:B.MAX_BYTES+1,text:async()=>{throw Error('should not read');}};await run('importMissionFile(testFile)');assert.match(get('missionBackupStatus').textContent,/exceeds 5 MB/);assert.deepEqual(capture().mission,before.mission);
  t.ctx.testFile=file;await run('importMissionFile(testFile)');assert.equal(get('missionImportFile').value,'');
 });
 await test('Optional preset roundtrip, full precision and hard TOT, demo still default',async()=>{
  get('missionPreset').value='rhine-sentinelle-ghost-2026-10-10';await run('loadMissionPreset()');const before=capture();run('loadDemo()');assert.equal(get('callsign').value,'TEST01');importData(before);assert.deepEqual(capture().mission,before.mission);assert.deepEqual(capture().calculated,before.calculated);
 });
 console.log(`${count} backup test groups passed.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
