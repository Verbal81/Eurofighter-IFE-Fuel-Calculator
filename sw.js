const CACHE='eurofighter-ife-v1.9.18';
const ASSETS=['./','index.html','styles.css','i18n.js','logic-core.js','app.js','mission-backup.js','privacy-policy.html','manifest.webmanifest','icons/icon.svg','data/aircraft-profiles.json','data/fuel-flow.json','data/navdata.json','data/mission-presets.json','data/international-airbases.json','data/measurements-2026-10-01.json','data/aar-measurements-2026-10-03.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==self.location.origin)return; // Never cache SimBrief or any other cross-origin/user-specific response.
  e.respondWith(fetch(e.request).then(r=>{
    if(r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));}
    return r;
  }).catch(()=>caches.match(e.request,{ignoreSearch:true})));
});
