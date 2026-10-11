const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),old=require('../data/aar-measurements-2026-10-03.json'),data=require('../data/aar-measurements-2026-10-11.json');
assert.deepEqual(data.runs,old.runs,'Archived observations preserved');
assert.equal(data.supplementRuns.length,6);assert.equal(data.activation.enabled,false);
const gains=[3302,6860,2000,2000,2000,2000],durations=[421,646,140,141,137,140];
const profiles=[['CLEAN',230,285],['3 BAGS',230,285],['CLEAN',230,250],['CLEAN',230,320],['CLEAN',150,285],['CLEAN',300,285]];
for(const [i,r] of data.supplementRuns.entries()){
 assert.deepEqual([r.configuration,r.flightLevel,r.speedKt],profiles[i]);
 assert.equal(r.fuelStopKg-r.fuelStartKg,gains[i]);assert.equal(r.elapsedSecFromCheckpoint,durations[i]);
 assert.equal(r.grossOnloadKg,null);assert.equal(r.receiverBurnKg,null);assert.equal(r.effectiveGrossTransferRateKgMin,null);assert.equal(r.measurementDate,null);assert.equal(r.interruptionsRaw,'');
 let previousFuel=r.fuelStartKg,previousTime=0;
 for(const cp of r.checkpoints){assert.ok(cp.fuelKg>previousFuel);assert.ok(cp.elapsedSec>previousTime);previousFuel=cp.fuelKg;previousTime=cp.elapsedSec;}
 assert.equal(previousFuel,r.fuelStopKg);assert.equal(previousTime,durations[i]);
}
assert.equal(data.supplementRuns[5].startLocalTimeRaw,'1355lcl');assert.equal(data.supplementRuns[5].stopLocalTimeRaw,'1355lcl');assert.ok(data.supplementRuns[5].issues.includes('START_STOP_CLOCK_CONFLICT'));
const t=require('./regression.cjs');
(async()=>{
 t.get('missionPreset').value='rhine-sentinelle-ghost-2026-10-10';await t.run('loadMissionPreset()');
 const before=t.json(t.snapshot());t.ctx.observationData=data;t.run('state.aarMeasurements=observationData;renderAarMeasurementLog();recalc();');
 assert.deepEqual(t.json(t.snapshot()),before,'Observations do not affect mission calculation or route');
 assert.match(t.get('settingsAarRuns').textContent,/10/);assert.match(t.get('aarMeasurementLog').innerHTML,/NET kg\/min/);assert.match(t.get('aarMeasurementLog').innerHTML,/RATE REQUIRED/);
 assert.equal(t.get('aarTransferRate').value,'');assert.ok(Number.isNaN(t.snapshot().a.transfer.transferTime));assert.equal(t.snapshot().a.transfer.status,'RATE REQUIRED');
 console.log('AAR measurement checks passed: 6 profiles, raw times, 30 checkpoints, archive preserved, no activation, unchanged mission.');
})().catch(e=>{console.error(e);process.exitCode=1;});
