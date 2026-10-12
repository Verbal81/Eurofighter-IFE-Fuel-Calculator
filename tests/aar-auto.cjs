const assert=require('node:assert/strict'),fs=require('node:fs'),M=require('../aar-rate-model'),C=require('../logic-core'),B=require('../mission-backup'),t=require('./regression.cjs');
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-6,`${a} != ${b}`);
const runs=t.run('(state.aarMeasurements.supplementRuns).map(r=>({...r,receiverFlow:aarMeasurementEstimate(r).receiverFlow}))');
for(const r of runs){
 const duration=r.elapsedSecFromCheckpoint/60,gross=r.fuelStopKg-r.fuelStartKg+r.receiverFlow*duration;
 const curve=M.effectiveRate({runs,configuration:r.configuration,flightLevel:r.flightLevel,speedKt:r.speedKt,fobIn:r.fuelStartKg,grossOnload:gross,receiverFlow:r.receiverFlow});
 near(curve.time,duration);near(curve.peakFob,r.fuelStopKg);assert.deepEqual(curve.kinds,['MEASURED PROFILE']);
 // Gross required for AUTO target at EVENT OUT equals measured net gain + event burn.
 for(const manual of [false,true]){
  const requested=manual?gross:r.fuelStopKg-r.fuelStartKg+r.receiverFlow*duration;
  const out=C.computeAarTransfer({rate:curve.rate,receiverFlow:r.receiverFlow,eventDuration:duration,fobIn:r.fuelStartKg,targetOutFob:r.fuelStopKg,grossOnload:requested,manual:true,capacity:7213});
  assert.equal(out.valid,true);near(out.fobOut,r.fuelStopKg);near(out.transferTime,duration);near(out.transferBurn,r.receiverFlow*duration);
 }
}
const common={runs,configuration:'CLEAN',fob:2000};
const a=M.rateAt({...common,flightLevel:150,speedKt:285}),b=M.rateAt({...common,flightLevel:230,speedKt:285});
const mid=M.rateAt({...common,flightLevel:190,speedKt:285});assert.equal(mid.kind,'INTERPOLATED');near(mid.rate,(a.rate+b.rate)/2);
const q=M.rateAt({...common,flightLevel:230,speedKt:267.5}),q0=M.rateAt({...common,flightLevel:230,speedKt:250});assert.equal(q.kind,'INTERPOLATED');near(q.rate,(q0.rate+b.rate)/2);
assert.equal(M.rateAt({...common,flightLevel:310,speedKt:285}).kind,'REFERENCE ESTIMATE');
assert.equal(M.rateAt({...common,flightLevel:190,speedKt:285,fob:6500}).kind,'REFERENCE / FUEL-BAND ESTIMATE');
assert.equal(M.rateAt({...common,configuration:'3 BAGS',flightLevel:210,speedKt:280}).kind,'REFERENCE ESTIMATE');
assert.ok(Number.isNaN(M.effectiveRate({...common,runs:[],flightLevel:230,speedKt:285,fobIn:1000,grossOnload:500,receiverFlow:30}).rate));
assert.equal(M.effectiveRate({...common,flightLevel:230,speedKt:285,fobIn:2000,grossOnload:500,receiverFlow:10000}).status,'RATE ≤ RECEIVER FLOW');
t.run("loadDemo();$('aarEnabled').checked=true;$('aarWp').value='1';$('aarAlt').value='230';$('aarSpeed').value='285';$('aarConfig').value='3 BAGS';$('aarManualToggle').checked=true;$('aarManualKg').value='100';recalc();");
assert.equal(t.get('aarRateMode').value,'AUTO');assert.equal(t.get('aarTankerType').value,'A330 MRTT');assert.equal(t.get('aarTransferRate').readOnly,true);assert.ok(t.snapshot().a.transfer.valid);
const shape=t.geometry(t.snapshot()),start=t.get('tankOnBoard').value;
for(const min of [0,10,20]){t.get('aarDuration').value=String(min);t.run('recalc()');assert.deepEqual(t.geometry(t.snapshot()),shape);assert.equal(t.get('tankOnBoard').value,start);assert.equal(t.get('aarManualKg').value,'100');if(min===0)assert.equal(t.snapshot().a.transfer.status,'EVENT TOO SHORT');}
t.run("$('aarDuration').value='10';$('aarManualToggle').checked=false;$('aarTargetOut').value='5000';recalc();");
near(t.snapshot().a.accepted,0);near(t.snapshot().a.transfer.transferTime,0);assert.match(t.get('aarTransferStatus').textContent,/NO ONLOAD REQUIRED/);
t.run("$('aarTargetOut').value='7200';recalc();");assert.equal(t.snapshot().a.transfer.valid,false);assert.equal(t.snapshot().a.transfer.status,'TRANSFER CAP LIMIT');
t.run("$('aarTargetOut').value='6800';recalc();");assert.ok(t.snapshot().a.transfer.valid);near(t.snapshot().a.fobAfter,6800);
const backup=t.json(t.run('createMissionBackup()')),saved=t.json(t.snapshot());
t.ctx.roundtrip=backup;t.run("loadDemo();state.aarMeasurements.supplementRuns[0].checkpoints[0].elapsedSec+=10;applyMissionBackup(roundtrip);");
assert.deepEqual(t.json(t.run('createMissionBackup().calculated')),backup.calculated);assert.deepEqual(t.json(t.run('captureMissionState()')),backup.mission);
const old=t.json(backup);old.schemaVersion=2;old.mission.performance.modelVersion='ife-forward-transfer-2';delete old.mission.fields.aarRateMode;delete old.mission.performance.aarMeasurements;old.mission.fields.aarRateSource='MANUAL';old.mission.fields.aarTransferRate='';
const migrated=B.validate(old);assert.equal(migrated.schemaVersion,3);assert.equal(migrated.mission.fields.aarRateMode,'AUTO');assert.equal(migrated.mission.fields.aarTransferRate,'');t.ctx.migratedBlank=migrated;t.run('applyMissionBackup(migratedBlank)');assert.ok(t.snapshot().a.transfer.valid);assert.equal(t.get('aarRateMode').value,'AUTO');const migratedNumeric=t.json(old);migratedNumeric.mission.fields.aarTransferRate='500';assert.equal(B.validate(migratedNumeric).mission.fields.aarRateMode,'MANUAL');
const bad=t.json(backup);bad.mission.performance.aarMeasurements.supplementRuns[0].checkpoints[1].elapsedSec=0;assert.throws(()=>B.validate(bad),/increasing/);
if(process.argv[2]){
 t.ctx.ofp=JSON.parse(fs.readFileSync(process.argv[2]));t.run("loadDemo();applySimBrief(ofp);$('aarEnabled').checked=true;$('aarWp').value='3';$('aarConfig').value='3 BAGS';$('aarAlt').value='230';$('aarSpeed').value='285';$('aarDuration').value='10';$('aarTargetOut').value='';$('aarManualToggle').checked=false;recalc();");
 assert.equal(t.snapshot().route.length,26);assert.equal(t.get('departure').value,'ETSN');assert.equal(t.get('arrival').value,'ETSN');assert.equal(t.snapshot().a.transfer.valid,true);
 near(t.snapshot().a.transfer.rate,488.0197806895111);near(t.snapshot().a.accepted,0);assert.match(t.get('aarTransferStatus').textContent,/NO ONLOAD REQUIRED/);
 console.log(JSON.stringify({simbrief:'793765',route:t.snapshot().route.length,fobIn:t.snapshot().a.currentFobBefore,gross:t.snapshot().a.accepted,burn:t.snapshot().a.durationBurn,out:t.snapshot().a.fobAfter,rate:t.snapshot().a.transfer.rate}));
}
console.log('PASS: six full measurement curves, AUTO/MANUAL fuel balance, interpolation at common fuel bands, labelled references, missing data, zero onload, duration/capacity, immutable geometry, archived calibration roundtrip and schema 2 migration.');
