const assert=require('node:assert/strict'),core=require('../logic-core.js'),B=require('../mission-backup.js'),t=require('./regression.cjs');
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-7,`${a} != ${b}`);
const base={rate:500,receiverFlow:40,eventDuration:2,fobIn:4000,capacity:7213};
let n=0;async function test(name,fn){await fn();console.log(`PASS ${++n}. ${name}`);}
(async()=>{
 await test('MANUAL transfer only: exact gross/rate, simultaneous burn',()=>{
  const r=core.computeAarTransfer({...base,manual:true,grossOnload:1000});assert.ok(r.valid);near(r.transferTime,2);near(r.transferBurn,80);near(r.fobOut,4920);near(r.orbitBurn,0);
 });
 await test('AUTO transfer only: target equation and exact onload',()=>{
  const r=core.computeAarTransfer({...base,targetOutFob:4920});assert.ok(r.valid);near(r.transferTime,(4920-4000)/(500-40));near(r.grossOnload,1000);near(r.fobOut,4920);
 });
 await test('Longer event: MANUAL extra burn, AUTO compensates extra burn at event OUT',()=>{
  const m=core.computeAarTransfer({...base,eventDuration:10,manual:true,grossOnload:1000});near(m.transferTime,2);near(m.orbitTime,8);near(m.orbitBurn,320);near(m.eventBurn,400);near(m.fobOut,4600);
  const a=core.computeAarTransfer({...base,eventDuration:10,targetOutFob:4920});assert.ok(a.valid);near(a.transferTime,2.64);near(a.grossOnload,1320);near(a.fobOut,4920);near(a.eventBurn,400);
 });
 await test('Missing/zero/negative/invalid and rates <= receiver burn never produce a valid transfer time',()=>{
  for(const rate of [null,'',0,-1,NaN,20,40]){const r=core.computeAarTransfer({...base,rate,manual:true,grossOnload:1000});assert.equal(r.valid,false);assert.ok(Number.isNaN(r.transferTime));}
  assert.equal(core.computeAarTransfer({...base,rate:null}).status,'RATE REQUIRED');
 });
 await test('Too short event, zero gross and target below IN handled without input changes',()=>{
  for(const manual of [true,false]){const args={...base,eventDuration:1,manual,grossOnload:1000,targetOutFob:4920};const r=core.computeAarTransfer(args);assert.equal(r.status,'EVENT TOO SHORT');near(r.transferTime,2);assert.ok(Number.isNaN(r.fobOut));assert.equal(args.eventDuration,1);}
  const z=core.computeAarTransfer({...base,eventDuration:0,manual:true,grossOnload:0});assert.ok(z.valid);near(z.transferTime,0);near(z.fobOut,4000);
  const below=core.computeAarTransfer({...base,eventDuration:10,targetOutFob:3000});assert.ok(below.valid);near(below.grossOnload,0);near(below.fobOut,3600);
 });
 await test('Physical tank peak checked before orbit; fuel exhaustion and over-cap targets rejected',()=>{
  const r=core.computeAarTransfer({...base,fobIn:7000,eventDuration:10,manual:true,grossOnload:500});assert.equal(r.status,'TRANSFER CAP LIMIT');near(r.peakFob,7460);assert.ok(Number.isNaN(r.fobOut));
  const target=core.computeAarTransfer({...base,targetOutFob:7213,eventDuration:10});assert.equal(target.status,'TRANSFER CAP LIMIT');
  const dry=core.computeAarTransfer({...base,fobIn:100,eventDuration:10,manual:true,grossOnload:0});assert.equal(dry.status,'FUEL EXHAUSTED');
 });
 t.get('missionPreset').value='rhine-sentinelle-ghost-2026-10-10';await t.run('loadMissionPreset()');
 await test('Real app: rate/event edits preserve geometry; missing rate displays N/A on ticket/PDF',()=>{
  const geom=t.geometry(t.snapshot());assert.match(t.get('aarTicketTransferTime').textContent,/N\/A \/ RATE REQUIRED/);assert.match(t.snapshot().card,/N\/A \/ RATE REQUIRED/);
  t.run("$('aarTransferRate').value='500';recalc();");const a=t.snapshot();near(a.a.transfer.transferTime,966/500);assert.ok(a.a.transfer.valid);near(a.a.durationBurn,a.a.aarBurnRate*10);near(a.a.fobAfter,a.a.currentFobBefore+966-a.a.durationBurn);assert.deepEqual(t.geometry(a),geom);
  assert.match(a.card,/TRANSFER RATE/);assert.match(a.card,/AAR EVENT/);
  const eta=a.s.cumulative[4];t.run("$('aarDuration').value='12';recalc();");near(t.snapshot().s.cumulative[4]-eta,2);assert.deepEqual(t.geometry(t.snapshot()),geom);near(t.snapshot().a.transfer.transferTime,a.a.transfer.transferTime);
  t.run("$('aarDuration').value='1';recalc();");assert.equal(t.snapshot().a.status,'EVENT TOO SHORT');assert.ok(Number.isNaN(t.snapshot().a.fobAfter));assert.equal(t.get('aarDuration').value,'1');
 });
 await test('Real AUTO event OUT and JSON/local roundtrip retain rate, source and event',async()=>{
  t.run("$('aarDuration').value='10';$('aarManualToggle').checked=false;$('aarTargetOut').value='6800';$('aarRateSource').value='RECEIVER PRESET';recalc();");
  const before=t.json(t.run('createMissionBackup()'));near(t.snapshot().a.fobAfter,6800);assert.ok(t.snapshot().a.transfer.valid);
  t.run('saveMission();loadDemo();');await t.run('loadMission()');assert.deepEqual(t.json(t.run('captureMissionState()')),before.mission);assert.deepEqual(t.json(t.run('createMissionBackup().calculated')),before.calculated);
  assert.equal(t.get('aarRateSource').value,'RECEIVER PRESET');assert.equal(t.get('aarTransferRate').value,'500');
 });
 await test('Schema 1 safely migrates only new rate fields; new schemas require both fields',()=>{
  const old=t.json(t.run('createMissionBackup()'));old.schemaVersion=1;old.mission.performance.modelVersion='ife-forward-1';delete old.mission.fields.aarTransferRate;delete old.mission.fields.aarRateSource;
  const migrated=B.parse(JSON.stringify(old));assert.equal(migrated.schemaVersion,2);assert.equal(migrated.mission.fields.aarTransferRate,'');assert.equal(migrated.mission.fields.aarRateSource,'MANUAL');
  t.ctx.oldMission=old;t.run('applyMissionBackup(oldMission)');assert.match(t.get('aarTicketTransferTime').textContent,/RATE REQUIRED/);assert.equal(old.schemaVersion,1);
  const invalid=t.json(migrated);delete invalid.mission.fields.aarTransferRate;assert.throws(()=>B.validate(invalid),/aarTransferRate/);
 });
 console.log(`${n} AAR transfer regressions passed. All rates in tests are synthetic, not real tanker calibration.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
