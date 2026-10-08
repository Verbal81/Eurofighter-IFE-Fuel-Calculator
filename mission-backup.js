/* Complete input snapshot. No calculation is performed in this module. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.IFEMissionBackup=api;})(typeof window!=='undefined'?window:globalThis,()=>{
  'use strict';
  const SCHEMA_VERSION=2,APP_VERSION='1.9.19',MODEL_VERSION='ife-forward-transfer-2',MAX_BYTES=5*1024*1024;
  const FIELD_IDS=['aarTransferRate','aarRateSource','callsign','missionDate','startZulu','departure','depElevation','arrival','arrElevation','aircraft','tankOnBoard','taxiMin','reserveKg','surchargePct','alternate1','alternate2','divert1ManualDist','divert1ManualElev','divert2ManualDist','divert2ManualElev','divertAltitude','divertMach','divertWind','recoveryExtra','jokerBuffer','bingoManual','jokerManual','cruiseMode','cruiseDistanceSource','cruiseDistance','cruiseTimeInput','cruiseAltitude','cruiseMach','cruiseWind','cruiseDepElev','cruiseArrElev','aarManualKg','aarArip','aarArcp','aarAlt','aarSpeed','aarDuration','aarConfig','aarBingo2','aarB2Rtb','jokerBasis','aarTargetOut','missionName','missionType','missionNotes','aarTankerType','aarTankerCallsign','aarFrequency','aarPlannedArct','aarPlannedOut','divertSelection'];
  const TEXT_IDS=new Set(['aarRateSource','callsign','missionDate','startZulu','departure','arrival','aircraft','alternate1','alternate2','cruiseMode','cruiseDistanceSource','aarArip','aarArcp','aarConfig','aarB2Rtb','jokerBasis','missionName','missionType','missionNotes','aarTankerType','aarTankerCallsign','aarFrequency','aarPlannedArct','aarPlannedOut','divertSelection']);
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const clone=v=>JSON.parse(JSON.stringify(v));
  const number=v=>typeof v==='number'?v:typeof v==='string'&&v.trim()!==''?Number(v.trim().replace(/\s/g,'').replace(',','.')):NaN;
  const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
  function validate(data){
    // Schema 1 had no transfer-rate fields: migrate only those genuinely new inputs.
    if(data?.schemaVersion===1){
      if(data.mission?.fields&&('aarTransferRate' in data.mission.fields||'aarRateSource' in data.mission.fields))throw new Error('Schema 1 cannot contain schema 2 transfer inputs');
      if(data.mission?.performance?.modelVersion!=='ife-forward-1')throw new Error('Unsupported legacy calculation model');
      data=clone(data);data.schemaVersion=2;
      data.mission.fields={...data.mission.fields,aarTransferRate:'',aarRateSource:'MANUAL'};
      data.mission.performance.modelVersion=MODEL_VERSION;
    }
    const errors=[];const fail=(p,m)=>errors.push(`${p}: ${m}`);
    const req=(v,keys,p)=>{if(!object(v)){fail(p,'object required');return false;}for(const k of keys)if(!own(v,k))fail(`${p}.${k}`,'missing');return true;};
    const numeric=(v,p,{blank=false,min=-Infinity,max=Infinity}={})=>{if(blank&&v==='')return;const n=number(v);if(!Number.isFinite(n)||n<min||n>max)fail(p,'invalid number');};
    const time=(v,p)=>{if(v!==''&&!/^(?:[01]\d|2[0-3]):?[0-5]\dZ?$/i.test(v))fail(p,'HH:MM UTC required');};
    let nodes=0;
    const scan=(v,p,depth)=>{
      if(++nodes>150000||depth>24)throw new Error('JSON structure too large/deep');
      if(typeof v==='number'&&!Number.isFinite(v))fail(p,'non-finite number');
      if(typeof v==='string'&&v.length>20000)fail(p,'text too long');
      if(v&&typeof v==='object')for(const k of Object.keys(v)){
        if(['__proto__','prototype','constructor'].includes(k))throw new Error(`Unsafe JSON key: ${p}.${k}`);
        scan(v[k],`${p}.${k}`,depth+1);
      }
    };
    scan(data,'JSON',0);
    if(!object(data))throw new Error('Mission JSON object required');
    if(!own(data,'schemaVersion')){
      if([4,5,7,8,13,14,15,16].includes(data.version))throw new Error('Legacy browser save is not a complete portable backup: schemaVersion, performance, navigation and cruiseDistanceSource are missing. Load it in the original app, then EXPORT CURRENT MISSION. No defaults were applied.');
      throw new Error('schemaVersion: missing');
    }
    if(data.schemaVersion!==SCHEMA_VERSION)throw new Error(`Unsupported schemaVersion ${String(data.schemaVersion)}; this app supports ${SCHEMA_VERSION}. Mission unchanged.`);
    if(data.format!=='eurofighter-ife-mission')fail('format','not an IFE mission backup');
    const m=data.mission;
    if(req(m,['fields','route','toggles','references','source','missionMeta','performance','navigation','holdModel'],'mission')){
      if(typeof m.source!=='string')fail('mission.source','text required');
      if(m.missionMeta!==null&&!object(m.missionMeta))fail('mission.missionMeta','object or null required');
      if(m.holdModel!=='level-at-waypoint-v1')fail('mission.holdModel','unsupported hold model');
      if(req(m.fields,FIELD_IDS,'mission.fields')){
        for(const [k,v] of Object.entries(m.fields)){
          if(!FIELD_IDS.includes(k)){fail(`mission.fields.${k}`,'unknown input');continue;}
          if(typeof v!=='string')fail(`mission.fields.${k}`,'text input required');
          else if(!TEXT_IDS.has(k))numeric(v,`mission.fields.${k}`,{blank:true});
        }
        for(const [k,values] of Object.entries({aarRateSource:['MANUAL','TANKER PRESET','RECEIVER PRESET'],cruiseMode:['distance','time'],cruiseDistanceSource:['route','direct','manual'],jokerBasis:['in','out'],divertSelection:['auto','1','2'],aarConfig:['CLEAN','3 BAGS']}))if(!values.includes(m.fields[k]))fail(`mission.fields.${k}`,'unknown mode');
        for(const k of ['startZulu','aarPlannedArct','aarPlannedOut'])if(own(m.fields,k))time(m.fields[k],`mission.fields.${k}`);
        if(m.fields.missionDate!==''&&(!/^\d{4}-\d{2}-\d{2}$/.test(m.fields.missionDate)||Number.isNaN(Date.parse(m.fields.missionDate))))fail('mission.fields.missionDate','invalid date');
      }
      if(req(m.toggles,['bingo','joker','aar','aarManual'],'mission.toggles'))for(const [k,v] of Object.entries(m.toggles))if(!['bingo','joker','aar','aarManual'].includes(k)||typeof v!=='boolean')fail(`mission.toggles.${k}`,'unknown/non-boolean toggle');
      if(!Array.isArray(m.route)||m.route.length<2||m.route.length>2000)fail('mission.route','2–2000 waypoints required');
      else{
        m.route.forEach((r,i)=>{
          const p=`mission.route[${i}]`;
          if(!req(r,['wp','alt','mach','wind','mode','dist','inputTime','holdMin','etaOverride'],p))return;
          if(typeof r.wp!=='string')fail(p+'.wp','text required');
          if(!['distance','time'].includes(r.mode))fail(p+'.mode','unknown mode');
          for(const k of ['alt','mach','wind','dist','inputTime','holdMin'])if(own(r,k))numeric(r[k],p+'.'+k,{blank:true});
          for(const [k,limit] of [['lat',90],['lon',180]])if(own(r,k))numeric(r[k],p+'.'+k,{min:-limit,max:limit});
          for(const k of ['etaOverride','plannedEta','plannedOut'])if(own(r,k))time(r[k],p+'.'+k);
        });
        if(req(m.references,['bingoWp','jokerWp','aarWp'],'mission.references'))for(const k of ['bingoWp','jokerWp','aarWp']){
          const v=m.references[k];if(v!==null&&(!Number.isInteger(v)||v<0||v>=m.route.length))fail('mission.references.'+k,'invalid waypoint index');
          if(v===null&&(k!=='aarWp'||m.toggles?.aar))fail('mission.references.'+k,'waypoint required');
          if(['bingoWp','jokerWp'].includes(k)&&v===0)fail('mission.references.'+k,'Reference requires a waypoint after departure');
          if(k==='aarWp'&&v!==null&&(v===0||v===m.route.length-1))fail('mission.references.aarWp','AAR requires an intermediate waypoint');
        }
        if(m.fields){
          for(const [r,id,elev] of [[m.route[0],'departure','depElevation'],[m.route[m.route.length-1],'arrival','arrElevation']]){
            const expected=(m.fields[id]||'').trim().toUpperCase()||(id==='departure'?'DEP':'ARR');
            if(r.wp!==expected)fail('mission.route','endpoint does not match '+id);
            // Explicit input elevations must be consistent; blank means the archived navigation value.
            if(m.fields[elev]!==''&&number(m.fields[elev])!==number(r.alt))fail('mission.route','endpoint altitude does not match '+elev);
          }
        }
      }
      const perf=m.performance;
      if(req(perf,['modelVersion','aircraftProfile','fuelData'],'mission.performance')){
        if(perf.modelVersion!==MODEL_VERSION)fail('mission.performance.modelVersion','unsupported calculation model');
        const p=perf.aircraftProfile;
        const keys=['id','tankCapacityKg','groundFuelKgPerMin','climbRateFpm','climbFuelKgPerMin','descentRateFpm','descentFuelKgPerMin','transitionTasKt','minMach','maxMach','measurementConfiguration'];
        if(req(p,keys,'mission.performance.aircraftProfile')){
          if(p.id!==m.fields?.aircraft)fail('mission.performance.aircraftProfile.id','does not match selected aircraft');
          for(const k of keys.filter(k=>!['id','measurementConfiguration'].includes(k))){if(typeof p[k]!=='number')fail('mission.performance.aircraftProfile.'+k,'numeric JSON value required');numeric(p[k],'mission.performance.aircraftProfile.'+k,{min:['climbRateFpm','descentRateFpm','tankCapacityKg','minMach','maxMach'].includes(k)?Number.MIN_VALUE:0});}
          if(p.minMach>p.maxMach)fail('mission.performance.aircraftProfile','minMach exceeds maxMach');
        }
        const fuel=perf.fuelData;
        if(req(fuel,['rows','modelAnchors','machExtrapolationFactor'],'mission.performance.fuelData')){
          numeric(fuel.machExtrapolationFactor,'mission.performance.fuelData.machExtrapolationFactor',{min:0,max:1});
          if(!Array.isArray(fuel.rows)||!fuel.rows.length)fail('mission.performance.fuelData.rows','reference rows missing');
          else fuel.rows.forEach((r,i)=>{for(const k of ['altitudeFt','m070','m080','m085','m090','m095'])numeric(r[k],`fuelData.rows[${i}].${k}`,{min:0});});
          if(!Array.isArray(fuel.modelAnchors)||!fuel.modelAnchors.length)fail('mission.performance.fuelData.modelAnchors','anchors missing');
          else fuel.modelAnchors.forEach((r,i)=>{
            numeric(r.altitudeFt,`fuelData.modelAnchors[${i}].altitudeFt`,{min:0,max:55000});
            if(!Array.isArray(r.points)||!r.points.length)fail(`fuelData.modelAnchors[${i}].points`,'points missing');
            else r.points.forEach((p,j)=>{numeric(p.mach,`modelAnchors[${i}].points[${j}].mach`,{min:Number.MIN_VALUE});numeric(p.kgMin,`modelAnchors[${i}].points[${j}].kgMin`,{min:0});});
          });
        }
      }
      if(req(m.navigation,['airports','waypoints'],'mission.navigation'))for(const [kind,key] of [['airports','icao'],['waypoints','ident']]){
        if(!Array.isArray(m.navigation[kind])){fail('mission.navigation.'+kind,'array required');continue;}
        m.navigation[kind].forEach((a,i)=>{
          if(typeof a[key]!=='string')fail(`mission.navigation.${kind}[${i}]`,'identifier missing');
          for(const [k,limit] of [['lat',90],['lon',180]])if(own(a,k)&&a[k]!==null)numeric(a[k],`navigation.${kind}[${i}].${k}`,{min:-limit,max:limit});
          if(own(a,'elevationFt')&&a.elevationFt!==null)numeric(a.elevationFt,`navigation.${kind}[${i}].elevationFt`);
        });
      }
    }
    if(errors.length)throw new Error(errors.slice(0,18).join('\n')+(errors.length>18?`\n… ${errors.length-18} further fields`:''));
    return data;
  }
  function parse(text){
    if(typeof text!=='string'||text.length>MAX_BYTES)throw new Error('Mission file exceeds 5 MB');
    let data;try{data=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw new Error('Invalid JSON file');}
    return validate(data);
  }
  return {SCHEMA_VERSION,APP_VERSION,MODEL_VERSION,MAX_BYTES,FIELD_IDS,clone,validate,parse};
});
