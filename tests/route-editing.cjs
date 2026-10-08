const assert=require('node:assert/strict'),t=require('./regression.cjs');
class Field{
 constructor(value='',k=''){this.value=value;this.dataset={k};this.events={};this.tagName=k==='mode'?'SELECT':'INPUT';this.classes=new Set();this.classList={remove:k=>this.classes.delete(k),toggle:k=>{if(this.classes.has(k)){this.classes.delete(k);return false;}this.classes.add(k);return true;}};this.style={};}
 addEventListener(k,f){this.events[k]=f;}setAttribute(k,v){this[k]=v;}
}
(async()=>{
 t.get('missionPreset').value='rhine-sentinelle-ghost-2026-10-10';await t.run('loadMissionPreset()');
 const before=t.json(t.snapshot()),rows=[];
 const originalCreate=t.ctx.document.createElement;
 t.ctx.document.createElement=tag=>{
  if(tag!=='tr')return originalCreate(tag);
  const tr=new Field();tr.fields={};tr.cells=Array.from({length:15},()=>({dataset:{}}));tr.title={textContent:''};tr.toggle=new Field();tr.toggle.querySelector=()=>tr.title;
  Object.defineProperty(tr,'innerHTML',{set(html){this.html=html;for(const m of html.matchAll(/<input\b[^>]*data-k="([^"]+)"[^>]*>/g)){const val=m[0].match(/value="([^"]*)"/)[1];this.fields[m[1]]=new Field(val,m[1]);}this.fields.mode=new Field('distance','mode');},get(){return this.html;}});
  tr.querySelectorAll=sel=>sel==='td'?tr.cells:sel==='[data-k]'?Object.values(tr.fields):[];
  tr.querySelector=sel=>sel==='.route-card-toggle'?tr.toggle:sel.startsWith('[data-k=')?tr.fields[sel.match(/"([^"]+)"/)[1]]:null;
  rows.push(tr);return tr;
 };
 t.run('originalRenderRoute()');
 assert.match(rows[6].html,/RUSTI \/ LL ENTRY/);
 assert.deepEqual(rows[3].cells.map(c=>c.dataset.label).slice(1,7),['WP','ALT ft','MACH','ZEIT / ETA Z · WP IN','NM','HOLD min / WP OUT']);
 const positions=['data-k=\"wp\"','data-k=\"alt\"','data-k=\"mach\"','class=\"calc-zulu\"','data-k=\"dist\"','class=\"hold-cell\"'].map(s=>rows[3].html.indexOf(s));
 assert.ok(positions.every((p,i)=>p>=0&&(i===0||p>positions[i-1])),'Requested actual field order');
 rows[7].toggle.events.click();assert.equal(rows[7].toggle['aria-expanded'],'true');
 rows[7].toggle.events.click();assert.equal(rows[7].toggle['aria-expanded'],'false');
 for(const row of rows)for(const f of Object.values(row.fields))if(f.tagName!=='SELECT')f.events.change();
 assert.deepEqual(t.json(t.snapshot().route),before.route,'Untouched rounded fields preserve exact state');
 const hold=rows[7].fields.holdMin;hold.value='';hold.events.input();hold.value='12,';hold.events.input();
 assert.equal(t.run('state.route[7].holdMin'),before.route[7].holdMin,'No mid-entry recalculation');
 hold.value='12,5';hold.events.input();hold.events.change();assert.equal(t.run('state.route[7].holdMin'),12.5);
 assert.deepEqual(t.geometry(t.snapshot()),t.geometry(before),'Hold preserves geometry and Mach');
 const wind=rows[3].fields.wind;wind.value='-';wind.events.input();assert.equal(t.run('state.route[3].wind'),-7);wind.value='-12';wind.events.input();wind.events.change();assert.equal(t.run('state.route[3].wind'),-12);
 const mach=rows[3].fields.mach;mach.value='0.';mach.events.input();assert.equal(t.run('state.route[3].mach'),before.route[3].mach);mach.value='0.73';mach.events.input();mach.events.change();assert.equal(t.run('state.route[3].mach'),.73);
 const nm=rows[2].fields.dist;nm.value='50,2';nm.events.input();nm.events.change();assert.equal(t.run('state.route[2].dist'),50.2);assert.equal(t.run('state.route[2].mode'),'distance');
 const mins=rows[2].fields.inputTime;mins.value='10';mins.events.input();mins.events.change();assert.equal(t.run('state.route[2].mode'),'time');assert.equal(t.run('state.route[2].inputTime'),10);
 const mode=rows[2].fields.mode;mode.value='distance';mode.events.change();assert.equal(t.run('state.route[2].mode'),'distance');assert.equal(rows.length,26,'Mode commit does not destroy controls');
 const name=rows[6].fields.wp;name.value='TEST WAYPOINT';name.events.input();name.events.change();assert.equal(rows[6].title.textContent,'TEST WAYPOINT');
 t.ctx.document.createElement=originalCreate;
 t.run('saveMission()');await t.run('loadMission()');assert.equal(t.run('state.route[7].holdMin'),12.5);assert.equal(t.run('state.route[3].mach'),.73);
 console.log('PASS: card expand/collapse, full waypoint title, unchanged precision, partial/decimal/negative edits, Mach/Hold/Wind/NM/MIN/mode, geometry, save/load. DOM event test; no device rendering test.');
})().catch(e=>{console.error(e);process.exitCode=1;});
