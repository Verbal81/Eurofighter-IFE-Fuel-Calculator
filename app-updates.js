/* Version checks never download executable code or send mission data. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else {root.IFEAppUpdates=api;api.controller=api.createController(root);api.controller.start();}
})(typeof window!=='undefined'?window:globalThis,()=>{
  'use strict';
  const VERSION='1.9.25';
  const OFFICIAL='https://ife-eufi-fuelcalc-test.topstoni81.workers.dev/';
  const MANIFEST='https://raw.githubusercontent.com/Verbal81/Eurofighter-IFE-Fuel-Calculator/main/version.json';
  const PENDING='ife_pending_app_update_v1',INTERVAL=60*60*1000;
  function parts(v){if(typeof v!=='string'||!/^\d{1,5}\.\d{1,5}\.\d{1,5}$/.test(v))throw new Error('Unsupported version');return v.split('.').map(Number);}
  function compare(a,b){const x=parts(a),y=parts(b);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]>y[i]?1:-1;return 0;}
  function validate(data){if(data?.schemaVersion!==1)throw new Error('Unsupported update manifest');parts(data.appVersion);return {appVersion:data.appVersion};}
  function createController(env){
    const doc=env.document,el=id=>doc.getElementById(id);
    const official=env.location.origin===new URL(OFFICIAL).origin;
    let latest=null,busy=false,lastAttempt=0,mission=null,recovery=null;
    const t=(en,de)=>(doc.documentElement.lang||'en')==='de'?de:en;
    const put=(id,text)=>{if(el(id))el(id).textContent=text;};
    function status(text){put('appUpdateStatus',text);}
    function banner(text){put('appUpdateNotice',text);if(el('appUpdateBanner'))el('appUpdateBanner').hidden=false;}
    function render(){
      put('installedAppVersion','v'+VERSION);
      put('appInstallType',official?t('OFFICIAL WEB APP / PWA','OFFIZIELLE WEB-APP / PWA'):t('SEPARATE COPY','SEPARATE KOPIE'));
      for(const id of ['latestAppLink','settingsLatestApp'])if(el(id))el(id).href=OFFICIAL;
      if(el('applyAppUpdate'))el('applyAppUpdate').hidden=!(official&&latest&&compare(latest,VERSION)>0);
      if(el('latestAppLink'))el('latestAppLink').hidden=official;
      if(el('updateExportMission'))el('updateExportMission').disabled=!mission;
      if(official&&!recovery&&(!latest||compare(latest,VERSION)<=0)&&el('appUpdateBanner'))el('appUpdateBanner').hidden=true;
      if(!official)banner(t('This is a separate copy. Use the official web app for current releases. Export your mission JSON before switching.','Dies ist eine separate Kopie. Die offizielle Web-App liefert aktuelle Versionen. Vor dem Wechsel die Mission als JSON exportieren.'));
      if(latest&&compare(latest,VERSION)>0)banner(t('Update available: v','Update verfügbar: v')+latest+(official?t('. UPDATE NOW preserves the current mission before reloading.','. UPDATE NOW sichert die aktuelle Mission vor dem Neuladen.'):t('. Export your mission, then open the latest app. Local files cannot replace themselves.','. Mission exportieren und die aktuelle App öffnen. Lokale Dateien können sich nicht selbst ersetzen.')));
    }
    async function readVersion(url){
      const abort=new env.AbortController(),timer=env.setTimeout(()=>abort.abort(),8000);
      try {const response=await env.fetch(url,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:abort.signal});if(!response.ok)throw new Error('Version request failed');return validate(await response.json()).appVersion;}
      finally{env.clearTimeout(timer);}
    }
    async function check(force=false){
      if(busy||(!force&&lastAttempt&&Date.now()-lastAttempt<INTERVAL))return;
      lastAttempt=Date.now();busy=true;if(el('checkAppUpdates'))el('checkAppUpdates').disabled=true;
      status(t('Checking GitHub…','GitHub wird geprüft…'));
      try{
        if(env.navigator.onLine===false)throw new Error('Offline');
        latest=await readVersion(MANIFEST);
        const order=compare(latest,VERSION);
        status(order>0?t('Update available: v','Update verfügbar: v')+latest:order===0?t('Up to date · v','Aktuell · v')+VERSION:t('Installed build is newer than the published manifest.','Installierter Stand ist neuer als der veröffentlichte Versionshinweis.'));
        render();
      }catch(e){status(t('Update check unavailable. Reconnect and try again; the current app remains usable.','Update-Prüfung nicht verfügbar. Verbindung prüfen und erneut versuchen; die vorhandene App bleibt nutzbar.'));}
      finally{busy=false;if(el('checkAppUpdates'))el('checkAppUpdates').disabled=false;}
    }
    async function apply(){
      if(!official||!mission||!latest||compare(latest,VERSION)<=0)return;
      const button=el('applyAppUpdate');if(button)button.disabled=true;
      try{
        if(env.navigator.onLine===false)throw new Error('Offline');
        const live=await readVersion(new URL('version.json',OFFICIAL).href);
        if(compare(live,latest)<0){banner(t('The new version is still deploying. Keep planning and check again shortly.','Die neue Version wird noch veröffentlicht. Weiterplanen und später erneut prüfen.'));return;}
        doc.activeElement?.blur?.();
        const saved={targetVersion:live,missionBackup:mission.capture()};
        env.sessionStorage.setItem(PENDING,JSON.stringify(saved));
        // Keep the browser-save slot untouched. Restoration runs only after app data are ready.
        env.location.reload();
      }catch(e){banner(t('Update paused: the mission could not be secured or the release is unavailable. Export JSON before reloading.','Update angehalten: Mission konnte nicht gesichert werden oder Version ist nicht erreichbar. Vor dem Neuladen JSON exportieren.'));}
      finally{if(button)button.disabled=false;}
    }
    function missionReady(io){
      mission=io;render();
      let raw;try{raw=env.sessionStorage.getItem(PENDING);}catch{return;}
      if(!raw)return;
      try{
        const pending=JSON.parse(raw);recovery=pending.missionBackup;
        if(compare(VERSION,pending.targetVersion)<0){banner(t('Update not applied yet. Your recovery copy is retained; retry when the release is available.','Update noch nicht geladen. Wiederherstellungskopie bleibt erhalten; später erneut versuchen.'));}
        else {io.restore(pending.missionBackup);env.sessionStorage.removeItem(PENDING);recovery=null;status(t('Update complete · current mission restored.','Update abgeschlossen · aktuelle Mission wiederhergestellt.'));}
      }catch(e){banner(t('Automatic mission restore failed. Download the recovery JSON; no saved mission was deleted.','Automatische Wiederherstellung fehlgeschlagen. Recovery-JSON herunterladen; gespeicherte Missionen wurden nicht gelöscht.'));}
      if(el('downloadUpdateRecovery'))el('downloadUpdateRecovery').hidden=!recovery;
    }
    function downloadRecovery(){
      if(!recovery)return;
      const url=env.URL.createObjectURL(new env.Blob([JSON.stringify(recovery,null,2)],{type:'application/json'}));
      const a=doc.createElement('a');a.href=url;a.download='IFE_mission_update_recovery.json';a.click();env.setTimeout(()=>env.URL.revokeObjectURL(url),30000);
    }
    function start(){
      render();
      el('checkAppUpdates')?.addEventListener('click',()=>check(true));
      el('applyAppUpdate')?.addEventListener('click',apply);
      el('updateExportMission')?.addEventListener('click',()=>mission?.exportMission());
      el('downloadUpdateRecovery')?.addEventListener('click',downloadRecovery);
      env.addEventListener('online',()=>check(true));
      doc.addEventListener('visibilitychange',()=>{if(!doc.hidden)check();});
      env.addEventListener('ife-language-changed',render);
      check();
    }
    return {start,check,apply,missionReady};
  }
  return {VERSION,OFFICIAL,MANIFEST,PENDING,compare,validate,createController};
});

