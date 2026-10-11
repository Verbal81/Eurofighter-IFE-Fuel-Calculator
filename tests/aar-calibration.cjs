const assert=require('node:assert/strict'),data=require('../data/aar-measurements-2026-10-11.json'),old=require('../data/aar-measurements-2026-10-03.json'),core=require('../logic-core.js'),t=require('./regression.cjs');
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-7,`${a} != ${b}`);
assert.deepEqual(data.runs,old.runs);assert.equal(data.supplementRuns.length,6);
assert.equal(data.supplementRuns.reduce((n,r)=>n+r.checkpoints.length,0),30);
assert.equal(data.supplementRuns[5].stopLocalTimeRaw,'1355lcl');assert.equal(data.supplementRuns[5].timingResolution.durationSec,140);
assert.equal(data.supplementRuns[5].timingResolution.derivedStopIfStartSecondsZero,'13:57:20');
(async()=>{
 t.ctx.observationData=data;t.run('state.aarMeasurements=observationData;');
 t.get('missionPreset').value='rhine-sentinelle-ghost-2026-10-10';await t.run('loadMissionPreset()');
 const before=t.json(t.snapshot());t.run('renderAarMeasurementLog();recalc();');assert.deepEqual(t.json(t.snapshot()),before,'Loading observations never selects an estimate or modifies mission');
 for(const r of data.supplementRuns){
  const e=t.run(`aarMeasurementEstimate(state.aarMeasurements.supplementRuns[${r.run-1}])`);
  near(e.net,r.fuelStopKg-r.fuelStartKg);near(e.gross,e.net+e.burn);near(e.grossRate,e.netRate+e.receiverFlow);
  for(const manual of [true,false]){
   const result=core.computeAarTransfer({rate:e.grossRate,receiverFlow:e.receiverFlow,eventDuration:e.minutes,fobIn:r.fuelStartKg,targetOutFob:r.fuelStopKg,grossOnload:e.gross,manual,capacity:7213});
   assert.equal(result.valid,true);near(result.transferTime,e.minutes);near(result.fobOut,r.fuelStopKg);near(result.transferBurn,e.burn);
  }
  t.get('aarAlt').value=String(r.flightLevel);t.get('aarSpeed').value=String(r.speedKt);t.get('aarConfig').value=r.configuration;
  const geo=t.geometry(t.snapshot()),start=t.get('tankOnBoard').value,onload=t.get('aarManualKg').value,event=t.get('aarDuration').value;
  assert.equal(t.run(`applyAarMeasurement(${r.run})`),true);near(Number(t.get('aarTransferRate').value),e.grossRate);assert.equal(t.snapshot().a.transfer.valid,true);
  assert.deepEqual(t.geometry(t.snapshot()),geo);assert.equal(t.get('tankOnBoard').value,start);assert.equal(t.get('aarManualKg').value,onload);assert.equal(t.get('aarDuration').value,event);
  const backup=t.json(t.run('createMissionBackup()'));const parsed=require('../mission-backup.js').parse(JSON.stringify(backup));assert.equal(parsed.mission.fields.aarRateSource,`RECEIVER PRESET S${r.run} ESTIMATE`);
 }
 const savedPlan=t.json(t.run('createMissionBackup()'));t.run('saveMission();loadDemo();');await t.run('loadMission()');assert.deepEqual(t.json(t.run('captureMissionState()')),savedPlan.mission);assert.deepEqual(t.json(t.run('createMissionBackup().calculated')),savedPlan.calculated);
 const last=t.get('aarTransferRate').value;t.get('aarAlt').value='210';t.run('recalc()');assert.equal(t.snapshot().a.transfer.valid,false);assert.equal(t.snapshot().a.transfer.status,'MEASUREMENT PROFILE MISMATCH');assert.equal(t.run('applyAarMeasurement(6)'),false);assert.equal(t.get('aarTransferRate').value,last);
 t.get('aarTransferRate').value='';t.get('aarRateSource').value='MANUAL';t.get('aarConfig').value='3 BAGS';t.run('recalc()');assert.equal(t.snapshot().a.transfer.status,'RATE REQUIRED');
 console.log('PASS: six measured-run MANUAL/AUTO replays, no double burn, raw/corrected timing, exact preset rates, source backup validation, profile mismatch, missing rate, unchanged mission inputs/geometry.');
})().catch(e=>{console.error(e);process.exitCode=1;});
