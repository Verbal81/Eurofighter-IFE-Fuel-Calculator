const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const U=require('../app-updates.js'),t=require('./regression.cjs');
function fixture(origin=new URL(U.OFFICIAL).origin){
 const nodes=new Map(),session=new Map(),requests=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:false,textContent:'',events:{},addEventListener(k,f){this.events[k]=f;}});return nodes.get(id);};
 const f={node,session,requests,remote:U.VERSION,live:U.VERSION,reloads:0};
 f.env={document:{getElementById:node,documentElement:{lang:'en'},addEventListener(){},activeElement:{blur(){}}},
 location:{origin,reload(){f.reloads++;}},navigator:{onLine:true},AbortController,
 sessionStorage:{getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k)},
 setTimeout(){return 1;},clearTimeout(){},addEventListener(){},
 fetch:async(url,opts)=>{requests.push({url,opts});if(f.failure)throw new Error('unavailable');return {ok:true,json:async()=>({schemaVersion:f.schema??1,appVersion:url===U.MANIFEST?f.remote:f.live})};}};
 f.io={capture:()=>({inputs:'unchanged'}),restore:b=>{f.restored=b;},exportMission(){}};
 return f;
}
(async()=>{
 assert.equal(U.compare('1.9.23','1.9.9'),1);assert.equal(U.compare('1.10.0','1.9.99'),1);assert.equal(U.compare('1.9.23','1.9.23'),0);assert.throws(()=>U.validate({schemaVersion:2,appVersion:'1.9.23'}));assert.throws(()=>U.compare('latest','1.9.23'));
 console.log('PASS numeric version comparison and incompatible manifest rejection');
 const f=fixture(),c=U.createController(f.env);f.remote='1.9.24';c.missionReady(f.io);await c.check(true);
 assert.equal(f.node('applyAppUpdate').hidden,false);assert.equal(f.reloads,0);assert.match(f.node('appUpdateNotice').textContent,/1.9.24/);
 assert.equal(f.requests[0].opts.credentials,'omit');assert.equal(f.requests[0].opts.cache,'no-store');assert.equal(f.requests[0].url,U.MANIFEST);
 await c.check();assert.equal(f.requests.length,1,'Automatic checks throttled');
 await c.apply();assert.equal(f.reloads,0);assert.equal(f.session.size,0);assert.match(f.node('appUpdateNotice').textContent,/still deploying/);
 console.log('PASS update notice, privacy, throttling and deployment race');
 f.remote=U.VERSION;await c.check(true);assert.match(f.node('appUpdateStatus').textContent,/Up to date/);assert.equal(f.node('applyAppUpdate').hidden,true);
 f.failure=true;await c.check(true);assert.match(f.node('appUpdateStatus').textContent,/unavailable/);f.failure=false;f.schema=9;await c.check(true);assert.match(f.node('appUpdateStatus').textContent,/unavailable/);
 f.schema=1;f.env.navigator.onLine=false;await c.check(true);assert.match(f.node('appUpdateStatus').textContent,/unavailable/);
 console.log('PASS current version, failed/offline checks and unknown schema');
 for(const origin of ['null','http://localhost:8000','https://example.test']){const x=fixture(origin),y=U.createController(x.env);y.missionReady(x.io);assert.match(x.node('appUpdateNotice').textContent,/separate copy/);assert.equal(x.node('latestAppLink').href,U.OFFICIAL);x.remote='1.9.24';await y.check(true);await y.apply();assert.equal(x.reloads,0);assert.equal(x.node('applyAppUpdate').hidden,true);}
 console.log('PASS file/local/self-hosted copies retain permanent official-app guidance');
 // Real mission engine: old app's update action -> reload into this version -> exact restoration.
 const old={module:{exports:{}},URL};vm.runInNewContext(fs.readFileSync(require.resolve('../app-updates.js'),'utf8').replace("const VERSION='1.9.23'","const VERSION='1.9.22'"),old);
 t.run("loadDemo();$('aarEnabled').checked=true;$('aarWp').value='1';$('aarDuration').value='10';$('aarManualToggle').checked=true;$('aarManualKg').value='100';state.route[2].holdMin=7;recalc();");const backup=t.json(t.run('createMissionBackup()'));
 const m=fixture(),oldController=old.module.exports.createController(m.env);
 oldController.missionReady({capture:()=>t.json(t.run('createMissionBackup()')),restore(){},exportMission(){}});
 t.saved.set('existing-save','keep');await oldController.check(true);await oldController.apply();assert.equal(m.reloads,1);assert.ok(m.session.has(U.PENDING));
 t.run('loadDemo()');const current=U.createController(m.env);
 current.missionReady({capture(){},restore:b=>{t.ctx.pendingBackup=b;t.run('applyMissionBackup(pendingBackup)');},exportMission(){}});
 assert.deepEqual(t.json(t.run('captureMissionState()')),backup.mission);assert.deepEqual(t.json(t.run('createMissionBackup().calculated')),backup.calculated);assert.equal(t.saved.get('existing-save'),'keep');assert.equal(m.session.has(U.PENDING),false);
 console.log('PASS real mission capture -> reset/reload -> restore, exact inputs/results, saved slot preserved');
 const blocked=fixture(),b=old.module.exports.createController(blocked.env);b.missionReady(blocked.io);blocked.env.sessionStorage.setItem=()=>{throw new Error('quota');};await b.check(true);await b.apply();assert.equal(blocked.reloads,0);assert.match(blocked.node('appUpdateNotice').textContent,/Update paused/);
 const restore=fixture();restore.session.set(U.PENDING,JSON.stringify({targetVersion:U.VERSION,missionBackup:backup}));U.createController(restore.env).missionReady({restore(){throw new Error('invalid');}});assert.ok(restore.session.has(U.PENDING));assert.equal(restore.node('downloadUpdateRecovery').hidden,false);
 console.log('PASS storage failure prevents reload; failed restore retains downloadable recovery');
 const manifest=require('../version.json');assert.equal(manifest.appVersion,U.VERSION);assert.equal(require('../mission-backup.js').APP_VERSION,U.VERSION);
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8'),sw=fs.readFileSync(require.resolve('../sw.js'),'utf8');assert.ok(html.indexOf('app-updates.js')<html.indexOf('src="app.js'));assert.match(sw,/pathname.endsWith\('\/version.json'\)/);assert.match(sw,/'app-updates.js'/);
 console.log('PASS release versions, startup ordering and non-cached update manifest');
 const headers=fs.readFileSync(require.resolve('../_headers'),'utf8');assert.ok(headers.includes(U.MANIFEST));assert.match(headers,/script-src 'self';/);assert.doesNotMatch(headers,/connect-src[^\n]*\*/);
 console.log('PASS production CSP permits only the required GitHub manifest, without remote script access');
})().catch(e=>{console.error(e);process.exitCode=1;});
