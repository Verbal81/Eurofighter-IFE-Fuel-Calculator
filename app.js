const $ = (id) => document.getElementById(id);
const clamp = (x,a,b) => Math.min(b,Math.max(a,x));
const parseNum = (v,d=0) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : d;
  if (v === null || v === undefined || v === '') return d;
  const n = Number(String(v).trim().replace(/\s/g,'').replace(',','.'));
  return Number.isFinite(n) ? n : d;
};
const uiLang = () => (window.IFE_I18N?.getLang?.() || document.documentElement.lang || 'en');
const uiText = (de,en) => uiLang()==='en' ? en : de;
const fmt = (v,d=0) => Number.isFinite(Number(v))?Number(v).toLocaleString(uiLang()==='en'?'en-US':'de-DE',{maximumFractionDigits:d,minimumFractionDigits:d}):'—';
// Display only: never feed rounded Mach text back into the route model.
const displayMach = v => {const n=parseNum(v,NaN);return Number.isFinite(n)?n.toLocaleString('en-US',{maximumFractionDigits:2,useGrouping:false}):'';};
const displayMachText = v => String(v??'').replace(/\bM(\d+[.,]\d{3,})/g,(_,n)=>'M'+displayMach(n));
const ceilKg = v => Number.isFinite(Number(v))?Math.ceil(Number(v)-1e-9):NaN;
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const deg = Math.PI/180;

const state = {
  navData:null,
  profiles:[],
  selectedAircraft:'EF2000',
  fuelData:null,
  fuelCache:{},
  route:[],
  calc:[],
  summary:{},
  source:'manual',
  missionMeta:null,
  missionPerformance:null,
  missionNavigation:null,
  diverts:[],
  aar:{enabled:false},
  lastError:'',
  airbaseMeta:null,
  aarMeasurements:null
};

async function boot(){
  try{
    const [nav, profileData, intl, aarMeasurements] = await Promise.all([
      fetch('data/navdata.json',{cache:'no-store'}).then(checkJson),
      fetch('data/aircraft-profiles.json',{cache:'no-store'}).then(checkJson),
      fetch('data/international-airbases.json',{cache:'no-store'}).then(checkJson),
      fetch('data/aar-measurements-2026-10-03.json',{cache:'no-store'}).then(checkJson).catch(()=>null)
    ]);
    const baseAirports=(nav.airports||[]).map(a=>({
      ...a,
      country:a.country||'DE',
      facility:a.facility||(String(a.category||'').toLowerCase().includes('zivil')?'CIV-MIL':String(a.category||'').toLowerCase().includes('militär')?'MIL':'OTHER'),
      source:a.source||'Eurofighter IFE local navdata',
      sourceStatus:a.sourceStatus||'LOCAL'
    }));
    const merged=new Map(baseAirports.map(a=>[String(a.icao||'').toUpperCase(),a]));
    for(const a of intl.airbases||[]){
      const key=String(a.icao||'').toUpperCase();
      if(key&&!merged.has(key)) merged.set(key,a);
    }
    nav.airports=[...merged.values()];
    state.navData=nav;
    state.airbaseMeta=intl.meta||null;
    state.aarMeasurements=aarMeasurements;
    state.profiles=profileData.profiles||[];
    populateAirports();
    populateAircraft();
    loadPrefs();
    populateAlternatePresets();
    await selectAircraft($('aircraft').value || state.selectedAircraft, false);
    $('dataStatus').textContent=`${state.profiles.length} ACFT · ${(nav.airports||[]).length} AIRPORTS`;
    $('dataStatus').className='chip ok';
    $('settingsAirports').textContent=fmt((nav.airports||[]).length);
    $('settingsFuelRows').textContent=fmt((state.fuelData?.rows||[]).length);
    if($('settingsAarRuns')){const n=(state.aarMeasurements?.runs||[]).length;$('settingsAarRuns').textContent=n?`${n} · ${uiText('VORLÄUFIG','PROVISIONAL')}`:'—';}
  }catch(e){
    console.error(e);
    $('dataStatus').textContent='DATA ERROR';
    $('dataStatus').className='chip bad';
  }
  wire();
  loadDemo();
  tick(); setInterval(tick,30000);
  if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{});
}
function checkJson(r){ if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }
function hardenDOM(){
  const limits={callsign:24,departure:8,arrival:8,alternate1:8,alternate2:8,alternate1Search:80,alternate2Search:80,simbriefUser:64,startZulu:6};
  Object.entries(limits).forEach(([id,n])=>{const el=$(id);if(el)el.maxLength=n;});
  ['callsign','departure','arrival','alternate1','alternate2','alternate1Search','alternate2Search'].forEach(id=>{const el=$(id);if(el)el.setAttribute('autocomplete','off');});
}

function wire(){
  hardenDOM();
  document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
  document.querySelectorAll('.jump').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.target)));

  ['departure','arrival'].forEach(id=>{
    $(id).addEventListener('change',()=>{
      $(id).value=$(id).value.trim().toUpperCase();
      setEndpointElevationFromAirport(id==='departure'?'dep':'arr');
      syncEndpoints(); renderRoute(); useMissionAirportElevations(); recalc();
    });
    $(id).addEventListener('blur',()=>{$(id).value=$(id).value.trim().toUpperCase();});
  });
  bindNumber('depElevation',()=>{syncEndpoints();renderRoute();useMissionAirportElevations();recalc();});
  bindNumber('arrElevation',()=>{syncEndpoints();renderRoute();useMissionAirportElevations();recalc();});
  $('depElevAuto').onclick=()=>{setEndpointElevationFromAirport('dep');syncEndpoints();renderRoute();useMissionAirportElevations();recalc();};
  $('arrElevAuto').onclick=()=>{setEndpointElevationFromAirport('arr');syncEndpoints();renderRoute();useMissionAirportElevations();recalc();};
  $('aircraft').addEventListener('change',async()=>{await selectAircraft($('aircraft').value,true); recalc();});
  $('callsign').addEventListener('input',()=>{updateMissionOverview();renderDataCard();});
  bindText('missionDate',()=>{normalizeMissionDate();renderDataCard();});
  bindText('startZulu',()=>{normalizeStartZulu();recalc();});
  if($('layoutSelect')) $('layoutSelect').addEventListener('change',()=>applyLayout($('layoutSelect').value));
  if($('themeSelect')) $('themeSelect').addEventListener('change',()=>applyTheme($('themeSelect').value));
  if($('languageSelect')) $('languageSelect').addEventListener('change',()=>{window.IFE_I18N?.apply($('languageSelect').value,true);tick();recalc();renderDataCard();});
  if($('clearLocalData')) $('clearLocalData').addEventListener('click',clearAllLocalData);
  window.addEventListener('ife-language-changed',()=>{tick();renderProfileList();populateAlternatePresets();syncAlternatePreset(1);syncAlternatePreset(2);updateBingoOptions();updateAarOptions();renderDataCard();});
  ['tankOnBoard','taxiMin','reserveKg','surchargePct'].forEach(id=>bindNumber(id,recalc));

  $('newManualMission').onclick=newManualMission;
  $('loadDemo').onclick=loadDemo;
  $('addWaypoint').onclick=addWaypoint;
  $('recalculate').onclick=recalc;
  $('saveMission').onclick=saveMission;
  $('loadMission').onclick=loadMission;
  $('exportCurrentMission').onclick=exportCurrentMission;
  $('importMission').onclick=()=>{$('missionImportFile').click();};
  $('missionImportFile').addEventListener('change',e=>importMissionFile(e.target.files?.[0]));
  $('missionPreset')?.addEventListener('change',()=>{$('loadMissionPreset').disabled=!$('missionPreset').value;});
  if($('loadMissionPreset'))$('loadMissionPreset').onclick=loadMissionPreset;
  ['missionName','missionType','missionNotes','aarTankerType','aarTankerCallsign','aarFrequency','aarPlannedArct','aarPlannedOut'].forEach(id=>bindText(id,recalc));
  $('divertSelection')?.addEventListener('change',recalc);

  $('savePilot').onclick=()=>{
    localStorage.setItem('ife_pilot',$('simbriefUser').value.trim());
    $('simbriefMessage').textContent=uiText('Pilot ID / Alias lokal gespeichert.','Pilot ID / Alias saved locally.');
  };
  $('importSimbrief').onclick=importSimBrief;

  ['divertAltitude','divertMach','divertWind','recoveryExtra','divert1ManualDist','divert1ManualElev','divert2ManualDist','divert2ManualElev'].forEach(id=>bindNumber(id,recalc));
  ['alternate1','alternate2'].forEach(id=>{
    $(id).addEventListener('input',()=>{syncAlternatePreset(id==='alternate1'?1:2);recalc();});
    $(id).addEventListener('change',()=>{$(id).value=$(id).value.trim().toUpperCase();syncAlternatePreset(id==='alternate1'?1:2);recalc();});
  });
  [1,2].forEach(n=>{
    const search=$(`alternate${n}Search`),country=$(`alternate${n}Country`);
    search?.addEventListener('input',()=>renderAirbaseSearch(n));
    search?.addEventListener('focus',()=>renderAirbaseSearch(n));
    country?.addEventListener('change',()=>renderAirbaseSearch(n));
  });

  $('bingoWp').addEventListener('change',recalc);
  $('jokerWp').addEventListener('change',recalc);
  if($('jokerBasis')) $('jokerBasis').addEventListener('change',recalc);
  if($('useArrivalReference')) $('useArrivalReference').addEventListener('click',()=>{if(state.route.length){$('bingoWp').value=String(state.route.length-1);updateBingo();}});
  $('bingoManualToggle').addEventListener('change',()=>{
    $('bingoManual').disabled=!$('bingoManualToggle').checked;
    if($('bingoManualToggle').checked && $('bingoManual').value==='') $('bingoManual').value=Math.round(state.summary.bingoAuto||0);
    updateBingo();
  });
  $('jokerManualToggle').addEventListener('change',()=>{
    $('jokerManual').disabled=!$('jokerManualToggle').checked;
    if($('jokerManualToggle').checked && $('jokerManual').value==='') $('jokerManual').value=Math.round(state.summary.jokerAuto||0);
    updateBingo();
  });
  bindNumber('bingoManual',updateBingo); bindNumber('jokerManual',updateBingo); bindNumber('jokerBuffer',updateBingo);

  $('aarEnabled').addEventListener('change',recalc);
  $('aarWp').addEventListener('change',recalc);
  $('aarManualToggle').addEventListener('change',()=>{
    $('aarManualKg').disabled=!$('aarManualToggle').checked;
    if($('aarManualToggle').checked && $('aarManualKg').value==='') $('aarManualKg').value=Math.round(state.aar.suggested||0);
    recalc();
  });
  bindNumber('aarManualKg',recalc);
  bindNumber('aarTransferRate',()=>{$('aarRateSource').value='MANUAL';recalc();});
  ['aarAlt','aarSpeed','aarDuration','aarBingo2','aarTargetOut'].forEach(id=>bindNumber(id,recalc));
  ['aarArip','aarArcp','aarB2Rtb'].forEach(id=>bindText(id,recalc));
  $('aarConfig')?.addEventListener('change',recalc);

  ['cruiseDistance','cruiseTimeInput','cruiseAltitude','cruiseMach','cruiseWind','cruiseDepElev','cruiseArrElev'].forEach(id=>bindNumber(id,calcCruise));
  $('cruiseMode').addEventListener('change',()=>{toggleCruiseMode();syncCruiseDistanceSource();calcCruise();});
  $('cruiseDistanceSource').addEventListener('change',()=>{syncCruiseDistanceSource();calcCruise();});
  $('cruiseUseMissionAirports').onclick=()=>{useMissionAirportElevations();$('cruiseDistanceSource').value='route';syncCruiseDistanceSource();calcCruise();};

  $('printCard').onclick=()=>{renderDataCard();window.print();};
  if($('printAarTicket')) $('printAarTicket').onclick=()=>{recalc();document.body.classList.add('print-aar-ticket');window.print();setTimeout(()=>document.body.classList.remove('print-aar-ticket'),250);};
  window.addEventListener('afterprint',()=>document.body.classList.remove('print-aar-ticket'));
  $('refreshCard').onclick=renderDataCard;
  $('infoClose').onclick=closeInfo;
  $('infoOverlay').addEventListener('click',e=>{if(e.target===$('infoOverlay'))closeInfo();});
  document.querySelectorAll('.info-card').forEach(el=>el.addEventListener('click',()=>openSummaryInfo(el.dataset.info)));
}
function bindNumber(id,fn){ const el=$(id); if(!el)return; el.addEventListener('input',fn); el.addEventListener('change',fn); }
function bindText(id,fn){ const el=$(id); if(!el)return; el.addEventListener('input',fn); el.addEventListener('change',fn); }

function showView(view){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(v=>v.classList.toggle('active',v.dataset.view===view));
  $('view-'+view)?.classList.add('active');
  if(view==='card') renderDataCard();
  if(view==='cruise') calcCruise();
  window.scrollTo({top:0,behavior:'smooth'});
}
function currentAiracCycle(date=new Date()){
  const day=86400000, step=28*day;
  const anchor=Date.UTC(2026,0,22); // EUROCONTROL AIRAC 2601 effective date
  const now=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate());
  if(now<anchor)return '—';
  let t=anchor, year=2026, cycle=1;
  while(t+step<=now){
    t+=step;
    const y=new Date(t).getUTCFullYear();
    if(y!==year){year=y;cycle=1;}else cycle+=1;
  }
  return `${String(year).slice(-2)}${String(cycle).padStart(2,'0')}`;
}
function updateAiracStatus(){
  const cycle=currentAiracCycle();
  if($('airacStatus'))$('airacStatus').textContent=`AIRAC ${cycle} · LOCAL NAVDATA`;
  if($('settingsAirac'))$('settingsAirac').textContent=cycle;
  if($('settingsNavdataStatus'))$('settingsNavdataStatus').textContent=uiText('LOKAL / NICHT ZYKLUS-VERIFIZIERT','LOCAL / NOT CYCLE-VERIFIED');
}
function tick(){ $('clock').textContent=new Date().toLocaleTimeString(uiLang()==='en'?'en-GB':'de-DE',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'UTC'})+' UTC'; updateAiracStatus(); }

function populateAirports(){
  const dl=$('airportList'); dl.innerHTML='';
  for(const a of state.navData?.airports||[]){
    const o=document.createElement('option'); o.value=a.icao; o.label=`${a.name||''} · ${a.elevationFt??'?'} ft`; dl.appendChild(o);
  }
}
const AIRBASE_FAV_KEY='ife_airbase_favorites';
const AIRBASE_RECENT_KEY='ife_airbase_recent';
const COUNTRY_NAMES={DE:['Deutschland','Germany'],GB:['Vereinigtes Königreich','United Kingdom'],FR:['Frankreich','France'],BE:['Belgien','Belgium'],NL:['Niederlande','Netherlands'],DK:['Dänemark','Denmark'],NO:['Norwegen','Norway'],SE:['Schweden','Sweden'],FI:['Finnland','Finland'],PL:['Polen','Poland'],CZ:['Tschechien','Czechia'],HU:['Ungarn','Hungary'],GR:['Griechenland','Greece'],RO:['Rumänien','Romania'],IT:['Italien','Italy'],ES:['Spanien','Spain'],PT:['Portugal','Portugal'],AT:['Österreich','Austria'],CH:['Schweiz','Switzerland'],EE:['Estland','Estonia'],LV:['Lettland','Latvia'],LT:['Litauen','Lithuania'],US:['USA','USA'],CA:['Kanada','Canada']};
function countryName(code){const pair=COUNTRY_NAMES[String(code||'').toUpperCase()];return pair?(uiLang()==='en'?pair[1]:pair[0]):String(code||'—');}
function safeLocalList(key){try{const a=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(a)?a.filter(x=>typeof x==='string').slice(0,50):[];}catch{return [];}}
function saveLocalList(key,a){localStorage.setItem(key,JSON.stringify([...new Set(a)].slice(0,50)));}
function isAirbase(a){const cat=String(a?.category||'').toLowerCase(),fac=String(a?.facility||'').toUpperCase();return (fac==='MIL'||fac==='CIV-MIL'||cat.includes('militär'))&&!cat.includes('hubschrauber');}
function airbases(){return (state.navData?.airports||[]).filter(isAirbase);}
function populateAlternatePresets(){
  const codes=[...new Set(airbases().map(a=>String(a.country||'').toUpperCase()).filter(Boolean))].sort((a,b)=>countryName(a).localeCompare(countryName(b),uiLang()==='en'?'en':'de'));
  [1,2].forEach(n=>{
    const sel=$(`alternate${n}Country`);if(sel){const prior=sel.value||'ALL';sel.replaceChildren();const all=document.createElement('option');all.value='ALL';all.textContent=uiText('ALLE LÄNDER','ALL COUNTRIES');sel.appendChild(all);for(const c of codes){const o=document.createElement('option');o.value=c;o.textContent=`${countryName(c)} · ${c}`;sel.appendChild(o);}sel.value=[...sel.options].some(o=>o.value===prior)?prior:'ALL';}
    renderAirbaseSearch(n);
    syncAlternatePreset(n);
  });
}
function airbaseSearchText(a){return [a.icao,a.name,a.city,a.country,countryName(a.country),a.category,a.facility].filter(Boolean).join(' ').toUpperCase();}
function scoreAirbase(a,q,favs,recents){
  const icao=String(a.icao||'').toUpperCase(),name=String(a.name||'').toUpperCase(),city=String(a.city||'').toUpperCase();
  if(q){if(icao===q)return 0;if(icao.startsWith(q))return 1;if(name.startsWith(q)||city.startsWith(q))return 2;return 4;}
  const fi=favs.indexOf(icao);if(fi>=0)return fi/100;
  const ri=recents.indexOf(icao);if(ri>=0)return 1+ri/100;
  return 10+icao.charCodeAt(0)/1000;
}
function renderAirbaseSearch(n){
  const box=$(`alternate${n}Results`);if(!box)return;
  const q=String($(`alternate${n}Search`)?.value||'').trim().toUpperCase();
  const country=$(`alternate${n}Country`)?.value||'ALL';
  const favs=safeLocalList(AIRBASE_FAV_KEY),recents=safeLocalList(AIRBASE_RECENT_KEY);
  let list=airbases().filter(a=>(country==='ALL'||a.country===country)&&(q===''||airbaseSearchText(a).includes(q)));
  list.sort((a,b)=>scoreAirbase(a,q,favs,recents)-scoreAirbase(b,q,favs,recents)||String(a.icao).localeCompare(String(b.icao)));
  list=list.slice(0,10);box.replaceChildren();
  if(!list.length){const empty=document.createElement('div');empty.className='airbase-empty';empty.textContent=uiText('Keine Air Base gefunden. ICAO kann weiterhin manuell eingegeben werden.','No air base found. You can still enter the ICAO manually.');box.appendChild(empty);return;}
  for(const a of list){
    const row=document.createElement('div');row.className='airbase-result';
    const main=document.createElement('button');main.type='button';main.className='airbase-result-main';
    const title=document.createElement('strong');title.textContent=`${a.icao} · ${a.name||''}`;
    const sub=document.createElement('span');sub.textContent=`${countryName(a.country)}${a.city?` · ${a.city}`:''} · ${Number.isFinite(Number(a.elevationFt))?fmt(a.elevationFt)+' ft':'elev. ?'} · ${a.facility||'MIL'}`;
    main.append(title,sub);main.addEventListener('click',()=>selectAirbase(n,a));
    const star=document.createElement('button');star.type='button';star.className='airbase-fav';star.setAttribute('aria-label',uiText('Favorit umschalten','Toggle favorite'));star.textContent=favs.includes(a.icao)?'★':'☆';star.addEventListener('click',e=>{e.stopPropagation();toggleAirbaseFavorite(a.icao);renderAirbaseSearch(n);});
    row.append(main,star);box.appendChild(row);
  }
}
function toggleAirbaseFavorite(icao){let favs=safeLocalList(AIRBASE_FAV_KEY);favs=favs.includes(icao)?favs.filter(x=>x!==icao):[icao,...favs];saveLocalList(AIRBASE_FAV_KEY,favs);}
function rememberAirbase(icao){const rec=safeLocalList(AIRBASE_RECENT_KEY).filter(x=>x!==icao);saveLocalList(AIRBASE_RECENT_KEY,[icao,...rec].slice(0,8));}
function selectAirbase(n,a){
  $(`alternate${n}`).value=a.icao;$(`divert${n}ManualDist`).value='';$(`divert${n}ManualElev`).value='';
  if($(`alternate${n}Search`))$(`alternate${n}Search`).value=`${a.icao} · ${a.name||''}`;
  rememberAirbase(a.icao);syncAlternatePreset(n);renderAirbaseSearch(n);recalc();
}
function updateAirbaseSelected(n){
  const el=$(`alternate${n}Selected`);if(!el)return;el.replaceChildren();
  const icao=$(`alternate${n}`)?.value.trim().toUpperCase();if(!icao){el.textContent=uiText('Keine Air Base gewählt.','No air base selected.');return;}
  const a=airport(icao);if(!a){el.textContent=uiText(`${icao} · manuell · Distanz/Höhe falls nötig eingeben.`,`${icao} · manual · enter distance/elevation if required.`);return;}
  const strong=document.createElement('strong');strong.textContent=`${a.icao} · ${a.name||''}`;
  const detail=document.createElement('span');detail.textContent=`${countryName(a.country)} · ${Number.isFinite(Number(a.elevationFt))?fmt(a.elevationFt)+' ft':'elev. ?'} · ${a.sourceStatus||'DATA'}`;
  const src=document.createElement('small');src.textContent=uiText(`Quelle: ${a.officialReference||a.source||'lokale Daten'}`,`Source: ${a.officialReference||a.source||'local data'}`);
  el.append(strong,detail,src);
}
function syncAlternatePreset(n){
  const icao=$(`alternate${n}`)?.value.trim().toUpperCase()||'';
  const search=$(`alternate${n}Search`),a=airport(icao);if(search&&!search.matches(':focus'))search.value=a?`${a.icao} · ${a.name||''}`:'';
  updateAirbaseSelected(n);
}
function setEndpointElevationFromAirport(which){
  const id=which==='dep'?'departure':'arrival',eid=which==='dep'?'depElevation':'arrElevation';
  const a=airport($(id).value); if(a&&Number.isFinite(Number(a.elevationFt)))$(eid).value=Math.round(Number(a.elevationFt));
}
function missionDepElev(){return parseNum($('depElevation').value,airportElev($('departure').value));}
function missionArrElev(){return parseNum($('arrElevation').value,airportElev($('arrival').value));}

function activeNavigation(){return state.missionNavigation||state.navData;}
function activeFuelData(){return state.missionPerformance?.fuelData||state.fuelData;}
function airport(icao){ return (activeNavigation()?.airports||[]).find(a=>a.icao===String(icao||'').trim().toUpperCase()); }
function waypoint(ident){ return (activeNavigation()?.waypoints||[]).find(a=>a.ident===String(ident||'').trim().toUpperCase()); }
function pointForIdent(ident){ const a=airport(ident), w=waypoint(ident); return a||w||null; }
function airportElev(icao){ const e=airport(icao)?.elevationFt; return Number.isFinite(Number(e))?Number(e):0; }

function populateAircraft(){
  const sel=$('aircraft'); sel.innerHTML='';
  state.profiles.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.name;sel.appendChild(o)});
  const more=document.createElement('option'); more.disabled=true; more.textContent=uiText('— weitere Muster nach Datenimport —','— more aircraft after data import —'); sel.appendChild(more);
  const saved=localStorage.getItem('ife_aircraft');
  if(saved&&state.profiles.some(p=>p.id===saved))sel.value=saved; else if(state.profiles[0])sel.value=state.profiles[0].id;
  renderProfileList();
}
function profile(){ return state.missionPerformance?.aircraftProfile||state.profiles.find(p=>p.id===state.selectedAircraft)||state.profiles[0]||{tankCapacityKg:7213,groundFuelKgPerMin:16,climbRateFpm:8000,climbFuelKgPerMin:77.6,descentRateFpm:3333.33,descentFuelKgPerMin:21.33,transitionTasKt:300,minMach:.48,maxMach:.95}; }
function normalizeMachForModel(value){
  const p=profile(), raw=parseNum(value,NaN);
  if(!Number.isFinite(raw))return {value:raw,corrected:false};
  // Only invalid low Mach values are raised. Valid measured values such as M0.48/M0.56 remain untouched.
  if(raw<p.minMach)return {value:.60,corrected:true,original:raw};
  return {value:raw,corrected:false};
}
async function selectAircraft(id,resetTank=true){
  state.missionPerformance=null;
  const p=state.profiles.find(x=>x.id===id)||state.profiles[0]; if(!p)return;
  state.selectedAircraft=p.id; $('aircraft').value=p.id; localStorage.setItem('ife_aircraft',p.id);
  if(p.fuelTable){
    if(!state.fuelCache[p.fuelTable]) state.fuelCache[p.fuelTable]=await fetch('data/'+p.fuelTable,{cache:'no-store'}).then(checkJson);
    state.fuelData=state.fuelCache[p.fuelTable];
  }
  if(resetTank)$('tankOnBoard').value=p.tankCapacityKg;
  if($('aarCapacity'))$('aarCapacity').value=Math.round(p.tankCapacityKg||0);
  $('settingsFuelRows').textContent=fmt((state.fuelData?.rows||[]).length);
  renderProfileList();
}
function renderProfileList(){
  if(!$('aircraftProfileList'))return;
  $('aircraftProfileList').innerHTML=state.profiles.map(p=>`<div class="profile-row"><span><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.source||'')}</small></span><b>${fmt(p.tankCapacityKg)} kg</b><em>${p.status==='data'?uiText('DATEN BEREIT','DATA READY'):uiText('KEINE DATEN','NO DATA')}</em></div>`).join('');
}
function loadPrefs(){
  const savedLang=localStorage.getItem('ife_language');
  window.IFE_I18N?.apply(savedLang==='de'?'de':'en',false);
  $('simbriefUser').value=localStorage.getItem('ife_pilot')||'';
  // v1.4 migration: OPS GREEN becomes the standard theme once, including existing installs
  // that inherited the former NIGHT CYAN default. Afterwards the user's selection persists normally.
  if(localStorage.getItem('vgaf_theme_default_v14')!=='1'){
    localStorage.setItem('vgaf_theme','ops-green');
    localStorage.setItem('vgaf_theme_default_v14','1');
  }
  // v1.9.1: OPERATIONAL EFB is the standard interface. Existing explicit choices remain untouched.
  const layout=localStorage.getItem('ife_layout')||'efb'; applyLayout(layout);
  const theme=localStorage.getItem('vgaf_theme')||'ops-green'; applyTheme(theme);
  if($('themeSelect'))$('themeSelect').value=theme;
  if($('missionDate')&&!$('missionDate').value)$('missionDate').value=currentUtcDateInput();
  if($('startZulu')&&!$('startZulu').value)$('startZulu').value=currentZulu();
}

function clearMissionMetadata(){
  $('aarTransferRate').value='';$('aarRateSource').value='MANUAL';
  state.missionPerformance=null;state.missionNavigation=null;
  state.missionMeta=null;
  ['missionName','missionType','missionNotes','aarTankerType','aarTankerCallsign','aarFrequency','aarPlannedArct','aarPlannedOut','missionPreset'].forEach(id=>{if($(id))$(id).value='';});
  if($('divertSelection'))$('divertSelection').value='auto';
  if($('loadMissionPreset'))$('loadMissionPreset').disabled=true;
  if($('missionPresetNote')){$('missionPresetNote').textContent='';$('missionPresetNote').className='hint hidden';}
}

function newManualMission(){
  clearMissionMetadata();
  state.source='manual';
  $('callsign').value=''; $('missionDate').value=currentUtcDateInput(); $('startZulu').value=currentZulu(); $('departure').value='ETNN'; $('arrival').value='ETNN'; setEndpointElevationFromAirport('dep'); setEndpointElevationFromAirport('arr');
  $('alternate1').value=''; $('alternate2').value=''; syncAlternatePreset(1); syncAlternatePreset(2); $('divert1ManualDist').value=''; $('divert2ManualDist').value='';
  $('taxiMin').value='8'; $('reserveKg').value='600'; $('surchargePct').value='0'; $('recoveryExtra').value='0';
  $('bingoManualToggle').checked=false; $('jokerManualToggle').checked=false; $('bingoManual').disabled=true; $('jokerManual').disabled=true; if($('jokerBasis'))$('jokerBasis').value='in';
  $('aarEnabled').checked=false; $('aarManualToggle').checked=false; $('aarManualKg').disabled=true; $('aarManualKg').value=''; if($('aarDuration'))$('aarDuration').value='10'; if($('aarTargetOut'))$('aarTargetOut').value='';
  const cap=profile().tankCapacityKg||7213; $('tankOnBoard').value=cap;
  const depElev=airportElev('ETNN');
  state.route=[
    {wp:'ETNN',lat:airport('ETNN')?.lat,lon:airport('ETNN')?.lon,alt:depElev,mach:'',wind:0,mode:'distance',dist:0,inputTime:0,holdMin:0,etaOverride:''},
    {wp:'WP01',alt:30000,mach:.85,wind:0,mode:'distance',dist:100,inputTime:0,holdMin:0,etaOverride:''},
    {wp:'ETNN',lat:airport('ETNN')?.lat,lon:airport('ETNN')?.lon,alt:depElev,mach:.70,wind:0,mode:'distance',dist:100,inputTime:0,holdMin:0,etaOverride:''}
  ];
  renderRoute(); useMissionAirportElevations(); if($('cruiseDistanceSource'))$('cruiseDistanceSource').value='route'; recalc();
  $('simbriefMessage').textContent=uiText('Manuelle Mission erstellt. Waypoints können frei editiert werden.','Manual mission created. Waypoints can be edited freely.');
  showView('route');
}

function loadDemo(){
  clearMissionMetadata();
  state.source='demo';
  $('departure').value='ETNN'; $('arrival').value='ETNN'; setEndpointElevationFromAirport('dep'); setEndpointElevationFromAirport('arr'); $('callsign').value='TEST01'; $('missionDate').value=currentUtcDateInput(); $('startZulu').value=currentZulu();
  $('alternate1').value='ETAD'; $('alternate2').value='ETAR'; syncAlternatePreset(1); syncAlternatePreset(2);
  $('divert1ManualDist').value=''; $('divert2ManualDist').value=''; $('divert1ManualElev').value=''; $('divert2ManualElev').value='';
  $('divertAltitude').value='30000'; $('divertMach').value='.85'; $('divertWind').value='0';
  $('taxiMin').value='8'; $('reserveKg').value='600'; $('surchargePct').value='0'; $('recoveryExtra').value='0'; $('jokerBuffer').value='795';
  $('bingoManualToggle').checked=false; $('jokerManualToggle').checked=false; $('bingoManual').disabled=true; $('jokerManual').disabled=true; if($('jokerBasis'))$('jokerBasis').value='in';
  $('aarEnabled').checked=false; $('aarManualToggle').checked=false; $('aarManualKg').disabled=true; $('aarManualKg').value=''; if($('aarDuration'))$('aarDuration').value='10'; if($('aarTargetOut'))$('aarTargetOut').value='';
  $('tankOnBoard').value=profile().tankCapacityKg||7213;
  const dep=airport('ETNN');
  state.route=[
    {wp:'ETNN',lat:dep?.lat,lon:dep?.lon,alt:dep?.elevationFt||380,mach:'',wind:0,mode:'distance',dist:0,inputTime:0,holdMin:0,etaOverride:''},
    {wp:'KOMUT',alt:15000,mach:.70,wind:-5,mode:'distance',dist:54,inputTime:0,holdMin:0,etaOverride:''},
    {wp:'NARAK',alt:28000,mach:.80,wind:-10,mode:'distance',dist:132,inputTime:0,holdMin:0,etaOverride:''},
    {wp:'TUDRA',alt:36000,mach:.85,wind:-15,mode:'distance',dist:186,inputTime:0,holdMin:0,etaOverride:''},
    {wp:'ROMOK',alt:36000,mach:.85,wind:12,mode:'time',dist:0,inputTime:18,holdMin:0,etaOverride:''},
    {wp:'OVTIL',alt:28000,mach:.80,wind:8,mode:'distance',dist:164,inputTime:0,holdMin:0,etaOverride:''},
    {wp:'ETNN',lat:dep?.lat,lon:dep?.lon,alt:dep?.elevationFt||380,mach:.70,wind:0,mode:'distance',dist:74,inputTime:0,holdMin:0,etaOverride:''}
  ];
  renderRoute(); useMissionAirportElevations(); if($('cruiseDistanceSource'))$('cruiseDistanceSource').value='route'; recalc();
  $('simbriefMessage').textContent=uiText('Demo geladen: DIST- und TIME-Legs, Gegen-/Rückenwind, zwei Diverts.','Demo loaded: DIST and TIME legs, head/tailwind, two diverts.');
}

function syncEndpoints(){
  const dep=$('departure').value.trim().toUpperCase()||'DEP';
  const arr=$('arrival').value.trim().toUpperCase()||'ARR';
  const depObj=airport(dep),arrObj=airport(arr),depElev=missionDepElev(),arrElev=missionArrElev();
  if(state.route.length<2) state.route=[
    {wp:dep,alt:depElev,mach:'',wind:0,mode:'distance',dist:0,inputTime:0,holdMin:0,etaOverride:''},
    {wp:arr,alt:arrElev,mach:.70,wind:0,mode:'distance',dist:50,inputTime:0,holdMin:0,etaOverride:''}
  ];
  const first=state.route[0],last=state.route[state.route.length-1];
  if(first.wp!==dep||!Number.isFinite(parseNum(first.lat,NaN))||!Number.isFinite(parseNum(first.lon,NaN))){first.lat=depObj?.lat??first.lat;first.lon=depObj?.lon??first.lon;}
  if(last.wp!==arr||!Number.isFinite(parseNum(last.lat,NaN))||!Number.isFinite(parseNum(last.lon,NaN))){last.lat=arrObj?.lat??last.lat;last.lon=arrObj?.lon??last.lon;}
  first.wp=dep; first.alt=depElev;
  last.wp=arr; last.alt=arrElev;
}
function captureRouteReferences(){
  const ref=id=>{const n=parseInt($(id)?.value??'',10);return Number.isInteger(n)?state.route[n]||null:null;};
  return {bingo:ref('bingoWp'),joker:ref('jokerWp'),aar:ref('aarWp')};
}
function restoreRouteReferences(refs){
  if(!refs)return;
  [['bingoWp','bingo'],['jokerWp','joker'],['aarWp','aar']].forEach(([id,key])=>{
    const el=$(id),obj=refs[key]; if(!el||!obj)return;
    const i=state.route.indexOf(obj); if(i>=0&&[...el.options].some(o=>Number(o.value)===i))el.value=String(i);
  });
}
function addWaypoint(){
  syncEndpoints(); const refs=captureRouteReferences(); const idx=state.route.length-1; const prev=state.route[Math.max(0,idx-1)];
  state.route.splice(idx,0,{wp:`WP${String(idx).padStart(2,'0')}`,alt:parseNum(prev?.alt,30000),mach:parseNum(prev?.mach,.85)||.85,wind:parseNum(prev?.wind,0),mode:'distance',dist:50,inputTime:0,holdMin:0,etaOverride:''});
  renderRoute(); restoreRouteReferences(refs); recalc();
}
function refreshMovedLegDistances(a,b){
  const from=Math.max(1,Math.min(a,b));
  const to=Math.min(state.route.length-1,Math.max(a,b)+1);
  for(let j=from;j<=to;j++){
    const leg=state.route[j],prev=state.route[j-1]; if(!leg||!prev||leg.mode==='time')continue;
    const d=haversineNM(prev,leg); if(Number.isFinite(d)&&d>0)leg.dist=d;
  }
}
function moveWaypoint(i,delta){
  const target=i+delta;
  if(i<=0||i>=state.route.length-1||target<=0||target>=state.route.length-1)return;
  const refs=captureRouteReferences();
  const item=state.route.splice(i,1)[0]; state.route.splice(target,0,item);
  refreshMovedLegDistances(i,target);
  renderRoute(); restoreRouteReferences(refs); recalc();
}
function deleteWaypoint(i){
  if(i<=0||i>=state.route.length-1)return;
  const refs=captureRouteReferences(); state.route.splice(i,1);
  renderRoute(); restoreRouteReferences(refs); recalc();
}

function renderRoute(){
  syncEndpoints(); const body=$('routeBody'); body.innerHTML='';
  state.route.forEach((r,i)=>{
    const first=i===0,last=i===state.route.length-1, endpoint=first||last;
    const tr=document.createElement('tr'); tr.dataset.i=i;
    tr.innerHTML=`
      <td class="route-index">${i+1}<span class="aar-mark"></span><span class="joker-mark"></span><span class="bingo-mark"></span></td>
      <td><button type="button" class="route-card-toggle" aria-expanded="false"><strong>${escapeHtml(r.wp||'—')}</strong><small>${uiText('Felder öffnen / schließen','Open / close fields')}</small></button><input data-k="wp" value="${escapeHtml(r.wp||'')}" ${endpoint?'readonly':''}></td>
      <td><input data-k="alt" inputmode="numeric" value="${fmt(parseNum(r.alt),0).replace(/\./g,'')}" ${endpoint?'readonly':''}></td>
      <td class="mach-cell"><input data-k="mach" inputmode="decimal" class="${r.machAutoCorrected?'auto-corrected':''}" title="${r.machAutoCorrected?`AUTO: M${fmt(r.machOriginal,2)} → M0,60`:'Mach'}" value="${first?'':displayMach(r.mach)}" ${first?'disabled':''}>${r.machAutoCorrected?'<small class="mach-auto-note">AUTO 0,60</small>':''}</td>
      <td class="calc-zulu"><input class="eta-zulu-input" inputmode="numeric" maxlength="6" aria-label="ETA Z" title="${uiText('ETA Z = Hard Time. Zusätzliche Wartezeit wird als HOLD mit Fuel berechnet; unerreichbare Zeiten werden markiert. NM bleiben unverändert. Leeren = AUTO.','ETA Z = hard time. Extra waiting becomes a fuel-burning HOLD; unreachable times are flagged. NM stay unchanged. Clear = AUTO.')}" value=""><small class="eta-note"></small></td>
      <td><input data-k="dist" inputmode="decimal" value="${first?'':(r.mode==='distance'?fmt(parseNum(r.dist),1):'')}" ${first?'disabled':''} title="${uiText('NM eingeben = DIST-Modus','Enter NM = DIST mode')}"></td>
      <td class="hold-cell">${endpoint?'—':`<input data-k="holdMin" inputmode="decimal" value="${fmt(parseNum(r.holdMin,0),1)}" aria-label="HOLD MIN" title="${uiText('Warte-/Hold-Zeit an diesem Waypoint. Verschiebt alle folgenden ETA-Zeiten und berechnet zusätzlichen Hold-Verbrauch aus Höhe und Mach dieses Waypoints, ohne Mach oder Leg-Zeit zu verändern.','Delay/hold time at this waypoint. Shifts all following ETA times and adds hold fuel using this waypoint altitude and Mach, without changing Mach or leg time.')}" /><small class="hold-out"></small>`}</td>
      <td><input data-k="wind" inputmode="decimal" value="${first?'':String(parseNum(r.wind)).replace('.',',')}" ${first?'disabled':''}></td>
      <td>${first?'—':`<select data-k="mode"><option value="distance" ${r.mode!=='time'?'selected':''}>DIST</option><option value="time" ${r.mode==='time'?'selected':''}>TIME</option></select>`}</td>
      <td><input data-k="inputTime" inputmode="decimal" value="${first?'':(r.mode==='time'?fmt(parseNum(r.inputTime),1):'')}" ${first?'disabled':''} title="${uiText('Direkt editierbar: Tippen und Minuten ändern. Die Eingabe schaltet dieses Leg automatisch auf TIME.','Directly editable: tap and change minutes. Editing automatically switches this leg to TIME.')}"></td>
      <td class="calc-time">—</td>
      <td class="calc-fuel">—</td>
      <td class="calc-cont">—</td>
      <td class="calc-fob">—</td>
      <td>${endpoint?'':`<div class="row-actions"><button class="row-move row-up" aria-label="${uiText('Waypoint nach oben verschieben','Move waypoint up')}" title="${uiText('Nach oben','Move up')}" ${i<=1?'disabled':''}>↑</button><button class="row-move row-down" aria-label="${uiText('Waypoint nach unten verschieben','Move waypoint down')}" title="${uiText('Nach unten','Move down')}" ${i>=state.route.length-2?'disabled':''}>↓</button><button class="row-delete" aria-label="${uiText('Waypoint löschen','Delete waypoint')}">×</button></div>`}</td>`;
    body.appendChild(tr);
    const labels=['#','WP','ALT ft','MACH','ZEIT / ETA Z · WP IN','NM','HOLD min / WP OUT','WIND kt','MODE','MIN EDIT','ETE min','LEG kg','RECOV kg','FOB IN / OUT','MOVE'];
    tr.querySelectorAll('td').forEach((cell,j)=>{cell.dataset.label=labels[j];});
    const cardToggle=tr.querySelector('.route-card-toggle');
    if(cardToggle)cardToggle.addEventListener('click',()=>{
      const open=tr.classList.toggle('route-expanded');
      cardToggle.setAttribute('aria-expanded',String(open));
    });
    tr.querySelectorAll('[data-k]').forEach(el=>{
      let machEdited=false, fieldEdited=false;
      const selectDirectMode=()=>{
        const k=el.dataset.k;
        if(i===0)return;
        if(k==='dist' && state.route[i].mode!=='distance'){
          state.route[i].mode='distance';
          const mode=tr.querySelector('[data-k="mode"]'); if(mode)mode.value='distance';
        }else if(k==='inputTime' && state.route[i].mode!=='time'){
          state.route[i].mode='time';
          const mode=tr.querySelector('[data-k="mode"]'); if(mode)mode.value='time';
        }
      };
      const commit=()=>{
        const k=el.dataset.k;
        if(k!=='mach'&&!fieldEdited)return;
        fieldEdited=false;
        if(k==='wp'){
          state.route[i][k]=el.value.trim().toUpperCase();
          if(cardToggle)cardToggle.querySelector('strong').textContent=state.route[i][k]||'—';
          const p=pointForIdent(state.route[i][k]); if(p){state.route[i].lat=p.lat;state.route[i].lon=p.lon;}
        }else if(k==='mode'){
          const c=state.calc[i];
          if(el.value==='time' && !(parseNum(state.route[i].inputTime,0)>0) && c && !c.error) state.route[i].inputTime=c.time;
          if(el.value==='distance' && !(parseNum(state.route[i].dist,0)>0) && c && !c.error) state.route[i].dist=c.distance;
          state.route[i].mode=el.value;
        }else if(k==='mach'){
          if(!machEdited)return;
          machEdited=false;
          if(el.value===''){state.route[i].mach='';delete state.route[i].machAutoCorrected;delete state.route[i].machOriginal;}
          else{
            const nm=normalizeMachForModel(el.value);
            state.route[i].mach=nm.value;
            if(nm.corrected){state.route[i].machAutoCorrected=true;state.route[i].machOriginal=nm.original;renderRoute();}
            else{delete state.route[i].machAutoCorrected;delete state.route[i].machOriginal;}
          }
          el.value=displayMach(state.route[i].mach);
        }else{
          if(k==='dist'||k==='inputTime')selectDirectMode();
          if(k==='holdMin') state.route[i][k]=clamp(parseNum(el.value,0),0,720);
          else state.route[i][k]=el.value===''?'':parseNum(el.value);
        }
        recalc();
      };
      if(el.dataset.k==='inputTime' || el.dataset.k==='dist' || el.dataset.k==='holdMin') el.addEventListener('focus',()=>{
        if(i>0){
          const c=state.calc[i];
          if(c && !c.error){
            if(el.dataset.k==='inputTime' && state.route[i].mode!=='time' && Number.isFinite(c.time)) el.value=fmt(c.time,1);
            if(el.dataset.k==='dist' && state.route[i].mode!=='distance' && Number.isFinite(c.distance)) el.value=fmt(c.distance,1);
          }
        }
        requestAnimationFrame(()=>{try{el.select();}catch{}});
      });
      if(el.dataset.k==='mach'){
        // v1.9.10: keep transient edits (e.g. deleting the 6 from 0,60) untouched.
        // Validation/autocorrection happens only when the field is committed on change/blur.
        el.addEventListener('focus',()=>requestAnimationFrame(()=>{try{el.select();}catch{}}));
        el.addEventListener('input',()=>{
          machEdited=true;
          el.classList.remove('auto-corrected');
          const note=tr.querySelector('.mach-auto-note'); if(note)note.style.visibility='hidden';
        });
        el.addEventListener('change',commit);
        el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();el.blur();}});
      }else{
        // Keep partial text intact; rounded displays must not write back on focus/blur.
        el.addEventListener('input',()=>{fieldEdited=true;});
        el.addEventListener('change',()=>{if(el.tagName==='SELECT')fieldEdited=true;commit();});
        el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();el.blur();}});
      }
    });

    const eta=tr.querySelector('.eta-zulu-input');
    if(eta){
      eta.addEventListener('focus',()=>requestAnimationFrame(()=>{try{eta.select();}catch{}}));
      const commitEta=()=>{
        const raw=String(eta.value||'').trim();
        if(i===0){
          if(!raw){updateUI();return;}
          const target=parseZulu(raw);
          if(!Number.isFinite(target)){updateUI();return;}
          $('startZulu').value=formatZulu(target);
          recalc();
          return;
        }
        // A hard time may add a computed HOLD, never change leg geometry or speed inputs.
        if(!raw){state.route[i].etaOverride='';recalc();return;}
        const target=parseZulu(raw);
        if(!Number.isFinite(target)){updateUI();return;}
        state.route[i].etaOverride=formatZulu(target);
        recalc();
      };
      eta.addEventListener('change',commitEta);
      eta.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();eta.blur();}});
    }
    const up=tr.querySelector('.row-up'); if(up)up.onclick=()=>moveWaypoint(i,-1);
    const down=tr.querySelector('.row-down'); if(down)down.onclick=()=>moveWaypoint(i,1);
    const del=tr.querySelector('.row-delete'); if(del)del.onclick=()=>deleteWaypoint(i);
  });
  updateBingoOptions();
  updateAarOptions();
}

function machTas(mach,alt){
  return mach*661.478*Math.sqrt(alt<36089?Math.max(.05,1-.00000687535*alt):.75188);
}
// Approximate calibrated/indicated airspeed -> Mach using the ISA pressure ratio.
// This is used only to obtain the receiver's own AAR-duration fuel burn from the
// same fuel-flow model that is already active for the mission.
function kiasToMach(kias,altFt){
  const v=Math.max(0,parseNum(kias,0)),h=Math.max(0,parseNum(altFt,0));
  if(!(v>0))return NaN;
  const gamma=1.4,a0=661.478;
  const qcP0=Math.pow(1+((gamma-1)/2)*Math.pow(v/a0,2),gamma/(gamma-1))-1;
  const pP0=h<=36089
    ? Math.pow(Math.max(.01,1-6.87535e-6*h),5.2561)
    : .22336*Math.exp(-(h-36089)/20806.7);
  const qcP=qcP0/Math.max(.001,pP0);
  return Math.sqrt((2/(gamma-1))*(Math.pow(1+qcP,(gamma-1)/gamma)-1));
}
function fuelFlow(alt,mach){
  const p=profile(),fuelData=activeFuelData();
  if(!fuelData || !mach || mach<p.minMach || mach>p.maxMach) return {value:0,status:'range'};
  const model=(fuelData.modelAnchors||[]).slice().sort((a,b)=>parseNum(a.altitudeFt)-parseNum(b.altitudeFt));
  const factor=parseNum(fuelData.machExtrapolationFactor,.5);
  // Exact mirror of the active Excel v18 model:
  // linear interpolation between measured Mach anchors, quadratic Mach scaling outside
  // the measured Mach envelope, then linear interpolation between altitude anchors.
  if(model.length){
    const q=m=>1-factor+factor*(m/.9)**2;
    const atAltitude=row=>{
      const pts=(row.points||[]).slice().sort((a,b)=>parseNum(a.mach)-parseNum(b.mach));
      if(!pts.length)return NaN;
      const first=pts[0], last=pts[pts.length-1], fm=parseNum(first.mach), lm=parseNum(last.mach);
      if(mach<fm)return parseNum(first.kgMin)*q(mach)/q(fm);
      for(let i=0;i<pts.length-1;i++){
        const a=pts[i],b=pts[i+1],m1=parseNum(a.mach),m2=parseNum(b.mach);
        if(mach<=m2){
          const t=(mach-m1)/Math.max(.000001,m2-m1);
          return parseNum(a.kgMin)+(parseNum(b.kgMin)-parseNum(a.kgMin))*t;
        }
      }
      return parseNum(last.kgMin)*q(mach)/q(lm);
    };
    let lo=model[0],hi=model[0];
    if(alt<=parseNum(model[0].altitudeFt)){lo=hi=model[0];}
    else if(alt>=parseNum(model[model.length-1].altitudeFt)){lo=hi=model[model.length-1];}
    else{
      for(let i=0;i<model.length-1;i++){
        const a1=parseNum(model[i].altitudeFt),a2=parseNum(model[i+1].altitudeFt);
        if(alt>=a1&&alt<=a2){lo=model[i];hi=model[i+1];break;}
      }
    }
    const v1=atAltitude(lo),v2=atAltitude(hi),a1=parseNum(lo.altitudeFt),a2=parseNum(hi.altitudeFt);
    if(!Number.isFinite(v1)||!Number.isFinite(v2))return {value:0,status:'range'};
    const t=a1===a2?0:(alt-a1)/(a2-a1);
    const value=v1+(v2-v1)*t;
    const measured=(lo===hi)&&((lo.points||[]).some(x=>Math.abs(parseNum(x.mach)-mach)<1e-8));
    return {value,status:measured?'measured':'interp'};
  }
  // Fallback for future aircraft profiles that only provide the reference grid.
  const rows=fuelData.rows||[], cols=[{m:.70,k:'m070'},{m:.80,k:'m080'},{m:.85,k:'m085'},{m:.90,k:'m090'},{m:.95,k:'m095'}];
  if(!rows.length)return {value:0,status:'range'};
  let c1=cols[0],c2=cols[1];
  if(mach>=.95){c1=cols[3];c2=cols[4];}
  else if(mach>.70){for(let i=0;i<cols.length-1;i++)if(mach>=cols[i].m&&mach<=cols[i+1].m){c1=cols[i];c2=cols[i+1];break;}}
  const atMach=row=>parseNum(row[c1.k])+(parseNum(row[c2.k])-parseNum(row[c1.k]))*((mach-c1.m)/(c2.m-c1.m));
  let r1=rows[0],r2=rows[0];
  if(alt<=rows[0].altitudeFt){r1=r2=rows[0];}
  else if(alt>=rows[rows.length-1].altitudeFt){r1=r2=rows[rows.length-1];}
  else for(let i=0;i<rows.length-1;i++)if(alt>=rows[i].altitudeFt&&alt<=rows[i+1].altitudeFt){r1=rows[i];r2=rows[i+1];break;}
  const v1=atMach(r1),v2=atMach(r2),t=r1===r2?0:(alt-r1.altitudeFt)/(r2.altitudeFt-r1.altitudeFt);
  return {value:v1+(v2-v1)*t,status:'interp'};
}

function calculateLeg(prev,curr){
  const p=profile(), fromAlt=parseNum(prev.alt), toAlt=parseNum(curr.alt), mach=parseNum(curr.mach), wind=parseNum(curr.wind);
  const mode=curr.mode==='time'?'time':'distance';
  if(toAlt<0||toAlt>55000)return resultErr('ALT prüfen');
  if(!mach||mach<p.minMach||mach>p.maxMach)return resultErr(`Mach ${p.minMach.toFixed(2)}–${p.maxMach.toFixed(2)}`);
  const climbing=toAlt>=fromAlt, rate=climbing?p.climbRateFpm:p.descentRateFpm, transitionFuel=climbing?p.climbFuelKgPerMin:p.descentFuelKgPerMin;
  const transitionMin=Math.abs(toAlt-fromAlt)/Math.max(rate,1);
  const transitionGs=p.transitionTasKt+wind;
  const gs=machTas(mach,Math.max(0,toAlt))+wind;
  const ff=fuelFlow(Math.max(0,toAlt),mach);
  if(transitionGs<=0||gs<=0)return resultErr('Wind / GS prüfen',ff);
  const transitionDist=transitionMin*transitionGs/60;
  let totalMin=0,dist=0,cruiseMin=0;
  if(mode==='time'){
    totalMin=parseNum(curr.inputTime);
    if(totalMin<=0)return resultErr('Zeit fehlt',ff);
    cruiseMin=totalMin-transitionMin;
    if(cruiseMin<-.001)return resultErr('Leg zu kurz für Höhenwechsel',ff);
    cruiseMin=Math.max(0,cruiseMin); dist=transitionDist+cruiseMin*gs/60;
  }else{
    dist=parseNum(curr.dist);
    // Co-located event markers (e.g. AAR / AAR OUT) may have an explicit zero leg.
    if(dist===0&&curr.dist!==''&&curr.dist!=null&&transitionMin===0&&haversineNM(prev,curr)<1e-7){
      return {error:'',fuel:0,time:0,distance:0,transitionMin:0,transitionDist:0,cruiseMin:0,gs,ff:ff.value,ffStatus:ff.status};
    }
    if(dist<=0)return resultErr('Distanz fehlt',ff);
    const cruiseDist=dist-transitionDist;
    if(cruiseDist<-.01)return resultErr('Leg zu kurz für Höhenwechsel',ff);
    cruiseMin=Math.max(0,cruiseDist)/gs*60; totalMin=transitionMin+cruiseMin;
  }
  const fuel=transitionMin*transitionFuel+cruiseMin*ff.value;
  return {error:'',fuel,time:totalMin,distance:dist,transitionMin,transitionDist,cruiseMin,gs,ff:ff.value,ffStatus:ff.status};
}
function resultErr(error,ff={value:0,status:'range'}){return {error,fuel:0,time:0,distance:0,transitionMin:0,transitionDist:0,cruiseMin:0,gs:0,ff:ff.value||0,ffStatus:ff.status||'range'};}

function haversineNM(a,b){
  if(!a||!b||!Number.isFinite(parseNum(a.lat,NaN))||!Number.isFinite(parseNum(a.lon,NaN))||!Number.isFinite(parseNum(b.lat,NaN))||!Number.isFinite(parseNum(b.lon,NaN)))return NaN;
  const lat1=Number(a.lat)*deg,lat2=Number(b.lat)*deg,dLat=(Number(b.lat)-Number(a.lat))*deg,dLon=(Number(b.lon)-Number(a.lon))*deg;
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2; return 3440.065*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}

function calculateDivert(n){
  const p=profile(), arrIcao=$('arrival').value.trim().toUpperCase(), altIcao=$(`alternate${n}`).value.trim().toUpperCase();
  if(!altIcao)return {name:'—',fuel:0,time:0,distance:0,status:n===1?'NOT SET':'OPTIONAL',valid:false};
  const arr=airport(arrIcao), alt=airport(altIcao); const manualDist=parseNum($(`divert${n}ManualDist`).value,NaN), manualElev=parseNum($(`divert${n}ManualElev`).value,NaN);
  const arrElev=missionArrElev(); const altElev=Number.isFinite(manualElev)?manualElev:alt?.elevationFt;
  const routeArrival=state.route[state.route.length-1], arrPoint=arr||((Number.isFinite(Number(routeArrival?.lat))&&Number.isFinite(Number(routeArrival?.lon)))?routeArrival:null);
  const direct=haversineNM(arrPoint,alt), usedDist=Number.isFinite(manualDist)&&manualDist>0?manualDist:direct;
  if(altIcao===arrIcao)return {name:altIcao,fuel:0,time:0,distance:usedDist,status:'SAME AS ARR',valid:false};
  if(!Number.isFinite(Number(arrElev))||!Number.isFinite(Number(altElev)))return {name:altIcao,fuel:0,time:0,distance:usedDist,status:'ELEVATION REQUIRED',valid:false};
  if(!Number.isFinite(usedDist)||usedDist<=0)return {name:altIcao,fuel:0,time:0,distance:0,status:'DISTANCE REQUIRED',valid:false};
  const cruiseAlt=parseNum($('divertAltitude').value,30000), mach=parseNum($('divertMach').value,.85), wind=parseNum($('divertWind').value,0);
  if(cruiseAlt<Math.max(arrElev,altElev))return {name:altIcao,fuel:0,time:0,distance:usedDist,status:'ALT TOO LOW',valid:false};
  if(mach<p.minMach||mach>p.maxMach)return {name:altIcao,fuel:0,time:0,distance:usedDist,status:'MACH CHECK',valid:false};
  const climbMin=Math.max(0,cruiseAlt-arrElev)/p.climbRateFpm, descentMin=Math.max(0,cruiseAlt-altElev)/p.descentRateFpm;
  const transGs=p.transitionTasKt+wind, cruiseGs=machTas(mach,cruiseAlt)+wind; if(transGs<=0||cruiseGs<=0)return {name:altIcao,fuel:0,time:0,distance:usedDist,status:'WIND CHECK',valid:false};
  const transDist=(climbMin+descentMin)*transGs/60, cruiseDist=usedDist-transDist;
  if(cruiseDist<-.01)return {name:altIcao,fuel:0,time:0,distance:usedDist,status:'ROUTE TOO SHORT',valid:false};
  const cruiseMin=Math.max(0,cruiseDist)/cruiseGs*60, ff=fuelFlow(cruiseAlt,mach);
  const surcharge=1+parseNum($('surchargePct').value)/100;
  const fuel=(climbMin*p.climbFuelKgPerMin+cruiseMin*ff.value+descentMin*p.descentFuelKgPerMin)*surcharge;
  return {name:altIcao,fuel,time:climbMin+cruiseMin+descentMin,distance:usedDist,directDistance:direct,status:(Number.isFinite(manualDist)&&manualDist>0)?'MANUAL DIST':(alt?'AUTO DB':'MANUAL'),valid:true};
}
function updateDiverts(){
  state.diverts=[calculateDivert(1),calculateDivert(2)];
  // An explicitly loaded preset may carry briefed fuel requirements instead of
  // derived profile values. This does not change the default divert calculation.
  const brief=state.missionMeta;
  if(brief?.divertFuelArrival===$('arrival').value.trim().toUpperCase()){
    state.diverts=state.diverts.map(d=>{
      const fuel=brief.divertFuelKg?.[d.name];
      return d.valid&&Number.isFinite(fuel)&&fuel>=0
        ? {...d,calculatedFuel:d.fuel,fuel,status:'PRESET FUEL · ETE MODEL'}:d;
    });
  }
  state.diverts.forEach((d,i)=>{
    const n=i+1; $(`divert${n}Status`).textContent=d.status; $(`divert${n}Status`).style.color=d.valid?'var(--green)':'var(--muted)';
    $(`divert${n}Distance`).value=d.distance?fmt(d.distance,1):''; $(`divert${n}Fuel`).textContent=d.valid?fmt(d.fuel):'—'; $(`divert${n}Time`).textContent=d.valid?formatTime(d.time):'—';
  });
  const selection=$('divertSelection')?.value||'auto';
  const valid=state.diverts.filter(d=>d.valid);
  const used=selection==='auto'?valid.slice().sort((a,b)=>b.fuel-a.fuel)[0]:state.diverts[Number(selection)-1];
  const usable=!!used?.valid;
  $('divertUsedFuel').textContent=usable?fmt(used.fuel):'—'; $('divertUsedName').textContent=usable?`(${used.name})`:'NO VALID SELECTED DIVERT';
  return {fuel:usable?used.fuel:0,name:usable?used.name:'—',validCount:usable?1:0};
}

function recalc(){
  if(!state.route.length)return; syncEndpoints();
  const surcharge=1+parseNum($('surchargePct').value)/100; state.calc=[];
  let routeTrip=0,time=0,dist=0;
  for(let i=1;i<state.route.length;i++){
    const c=calculateLeg(state.route[i-1],state.route[i]); state.calc[i]=c;
    if(!c.error){routeTrip+=c.fuel*surcharge;time+=c.time;dist+=c.distance;}
  }

  // v1.9.10: HOLD is a real mission-fuel block, not timeline-only.
  // It is flown at the altitude/Mach stored for the waypoint where the hold occurs.
  // The level fuel-flow model already used by the route is reused here and the normal
  // mission surcharge is applied. Endpoints cannot carry HOLD values.
  const plannedHoldAt=state.route.map((r,i)=>(i>0&&i<state.route.length-1)?clamp(parseNum(r?.holdMin,0),0,720):0);
  const aarTimelineRequested=!!$('aarEnabled')?.checked;
  const aarTimelineIndex=clamp(parseInt($('aarWp')?.value||'0',10),0,Math.max(0,state.route.length-1));
  const aarTimelineEnabled=aarTimelineRequested&&aarTimelineIndex>0&&aarTimelineIndex<state.route.length-1;
  const aarDuration=aarTimelineEnabled?clamp(parseNum($('aarDuration')?.value,10),0,240):0;
  const routeTime=time, startZuluMin=parseZulu($('startZulu')?.value);
  let lastTarget=startZuluMin;
  const hardTimeMinutes=state.route.map((r,i)=>{
    let target=parseZulu(r?.etaOverride);
    if(i===0||!Number.isFinite(startZuluMin)||!Number.isFinite(target))return NaN;
    // Resolve clock rollover against requested anchors, never against a late actual ETA.
    while(target<lastTarget-1e-7)target+=1440;
    lastTarget=target;
    return target-startZuluMin;
  });
  const timeline=window.IFECore.buildSimpleTimeline({
    legMinutes:state.route.slice(1).map((_,i)=>state.calc[i+1]?.error?0:state.calc[i+1].time),
    holdMinutes:plannedHoldAt,aarIndex:aarTimelineEnabled?aarTimelineIndex:-1,aarDuration,hardTimeMinutes
  });
  const holdAt=timeline.holdMinutes, scheduleHoldAt=timeline.scheduleHoldMinutes;
  const holdRateAt=state.route.map((r,i)=>{
    if(!(holdAt[i]>0))return 0;
    const fromCalc=parseNum(state.calc[i]?.ff,NaN);
    if(Number.isFinite(fromCalc)&&fromCalc>0)return fromCalc;
    const ff=fuelFlow(Math.max(0,parseNum(r?.alt,0)),parseNum(r?.mach,NaN));
    return Number.isFinite(ff?.value)&&ff.value>0?ff.value:0;
  });
  const holdFuelAt=holdAt.map((m,i)=>m>0?m*holdRateAt[i]*surcharge:0);
  const holdFuel=holdFuelAt.reduce((a,b)=>a+b,0);
  const holdTime=holdAt.reduce((a,b)=>a+b,0);
  const trip=routeTrip+holdFuel;

  const p=profile(), ground=parseNum($('taxiMin').value,8)*p.groundFuelKgPerMin, reserve=parseNum($('reserveKg').value,600), recovery=parseNum($('recoveryExtra').value,0);
  const div=updateDiverts();
  const baseBlock=ground+trip+reserve+recovery+div.fuel;

  // Fuel still required when arriving at each waypoint. This now includes a HOLD at
  // that waypoint itself plus every downstream leg/HOLD, so Bingo/Joker/Recovery react
  // immediately when HOLD MIN is changed.
  const remaining=new Array(state.route.length).fill(0); let future=0;
  for(let j=state.route.length-2;j>=0;j--){
    const next=j+1;
    if(!state.calc[next]?.error)future+=state.calc[next].fuel*surcharge;
    future+=holdFuelAt[next]||0;
    remaining[j]=(holdFuelAt[j]||0)+future;
  }

  const cumulative=timeline.etaIn, etaOverrideDeltaAt=timeline.hardTimeDeltaAt;
  // Hard-time delays are physical holds and burn fuel. An impossible early anchor is flagged.
  time=cumulative.length?cumulative[cumulative.length-1]:routeTime+holdTime+aarDuration;
  const etaAt=cumulative.map(m=>Number.isFinite(startZuluMin)?formatZulu(startZuluMin+m):'—');
  const wpOutAt=timeline.wpOut.map(m=>Number.isFinite(startZuluMin)?formatZulu(startZuluMin+m):'—');
  const holdOutAt=wpOutAt.map((t,i)=>holdAt[i]>0?t:'—');
  const routeErrors=state.calc.filter(Boolean).filter(c=>c.error);
  state.summary={trip,routeTrip,holdFuel,holdFuelAt,holdRateAt,ground,reserve,recovery,divert:div.fuel,divertName:div.name,divertValid:div.validCount>0,routeValid:routeErrors.length===0,routeErrorCount:routeErrors.length,baseBlock,block:baseBlock,time,routeTime,holdTime,holdAt,plannedHoldAt,scheduleHoldAt,holdOutAt,wpOutAt,dist,remaining,remainingRoute:remaining.slice(),surcharge,cumulative,startZuluMin,etaAt,etaOverrideDeltaAt,hardTimeIssues:timeline.hardTimeIssues,aarTimelineEnabled,aarTimelineIndex,aarDuration};
  updateAAR();
  updateUI(); calcCruise();
}
function updateUI(){
  const s=state.summary,p=profile(),cap=p.tankCapacityKg||7213,onboard=parseNum($('tankOnBoard').value,0);
  updateBingo();
  $('totalDistance').textContent=fmt(s.dist,1)+' NM'; $('totalTime').textContent=formatTime(s.time); $('totalTripFuel').textContent=fmt(s.missionTrip??s.trip)+' kg';
  document.querySelectorAll('#routeBody tr').forEach((tr,i)=>{
    const isAar=!!s.aar?.enabled && s.aar.index===i;
    const isJoker=s.jokerIndex===i, isBingo=s.bingoIndex===i;
    tr.classList.toggle('aar-row',isAar);
    const mark=tr.querySelector('.aar-mark'); if(mark){mark.textContent=isAar?'AAR':'';mark.classList.toggle('visible',isAar);}
    const jm=tr.querySelector('.joker-mark');if(jm){jm.textContent=isJoker?`JOKER ${(s.jokerBasis||$('jokerBasis')?.value||'in').toUpperCase()}`:'';jm.classList.toggle('visible',isJoker);}
    const bm=tr.querySelector('.bingo-mark');if(bm){bm.textContent=isBingo?'BINGO':'';bm.classList.toggle('visible',isBingo);}
    if(i===0){
      tr.querySelector('.calc-time').textContent='—';
      const eta=tr.querySelector('.eta-zulu-input'); if(eta){eta.value=s.etaAt?.[0]&&s.etaAt[0]!=='—'?s.etaAt[0]:'';eta.classList.remove('manual-eta');}
      const etaNote=tr.querySelector('.eta-note');if(etaNote)etaNote.textContent='START';
      tr.querySelector('.calc-fuel').textContent='—';tr.querySelector('.calc-cont').textContent=s.divertValid?fmt(ceilKg((s.remaining[0]??0)+s.divert+s.recovery+s.reserve)):'DIVERT';tr.querySelector('.calc-fob').textContent=Number.isFinite(s.fobInAt?.[0])?fmt(s.fobInAt[0]):'—';return;}
    const c=state.calc[i]; tr.classList.toggle('error',!!c?.error);
    tr.querySelector('.calc-time').textContent=c?.error?c.error:fmt(c?.time,1);
    const eta=tr.querySelector('.eta-zulu-input');
    if(eta){
      eta.value=c?.error?'':(s.etaAt?.[i]&&s.etaAt[i]!=='—'?s.etaAt[i]:'');
      eta.classList.toggle('manual-eta',!!state.route[i]?.etaOverride);
      eta.title=state.route[i]?.etaOverride
        ? uiText('HARD TIME · Zusatz-Hold mit Verbrauch; Konflikte werden markiert. NM bleiben unverändert. Leeren = AUTO.','HARD TIME · extra hold burns fuel; conflicts are flagged. NM stay unchanged. Clear = AUTO.')
        : uiText('AUTO ETA · Eingabe setzt eine Hard Time; zusätzliche Wartezeit verbraucht Fuel.','AUTO ETA · enter a hard time; additional waiting burns fuel.');
    }
    const etaNote=tr.querySelector('.eta-note');
    if(etaNote){
      const issue=s.hardTimeIssues?.find(x=>x.index===i);
      etaNote.textContent=state.route[i]?.etaOverride?`HARD ${state.route[i].etaOverride}Z · ${issue?`${issue.reason} ${fmt(Math.abs(issue.delta),1)}m`:'MET'}`:(state.route[i]?.plannedEta?`PLAN ${state.route[i].plannedEta}Z · IN`:((s.holdAt?.[i]||0)>0?'AUTO · IN':'AUTO'));
    }
    const holdOut=tr.querySelector('.hold-out');
    if(holdOut){
      const hm=s.holdAt?.[i]||0, hf=s.holdFuelAt?.[i]||0;
      holdOut.textContent=(hm>0)?`${s.etaAt?.[i]&&s.etaAt[i]!=='—'?`IN ${s.etaAt[i]}Z → `:''}${s.wpOutAt?.[i]&&s.wpOutAt[i]!=='—'?`OUT ${s.wpOutAt[i]}Z · `:''}${fmt(hm,1)}m · ${fmt(hf)} kg${s.scheduleHoldAt?.[i]>0?` · +${fmt(s.scheduleHoldAt[i],1)}m HARD`:''}`:'';
    }
    tr.querySelector('.calc-fuel').textContent=c?.error?'—':fmt((c?.fuel||0)*s.surcharge);
    tr.querySelector('.calc-cont').textContent=s.divertValid?fmt(ceilKg((s.remaining[i]??0)+s.divert+s.recovery+s.reserve)):'DIVERT';
    {const fi=s.fobInAt?.[i],fo=s.fobOutAt?.[i],hm=s.holdAt?.[i]||0;tr.querySelector('.calc-fob').innerHTML=Number.isFinite(fi)?((hm>0||isAar)?`<span class="fob-io">IN ${fmt(fi)}<br><small>OUT ${fmt(fo)}</small></span>`:fmt(fi)):'—';}
    if(!c?.error){
      const d=tr.querySelector('[data-k="dist"]'),t=tr.querySelector('[data-k="inputTime"]');
      if(d && state.route[i].mode==='time'){
        // TIME mode: show the calculated NM as a real value. Editing it switches the leg back to DIST.
        d.value=fmt(c.distance,1);
        d.placeholder='';
      }
      if(t && state.route[i].mode==='distance'){
        // SimBrief imports use DIST mode. Show the calculated minutes as a real value, not a placeholder,
        // so tablet users can tap the number and immediately overwrite it. The first edit switches to TIME mode.
        t.value=fmt(c.time,1);
        t.placeholder='';
      }
    }
  });
  updateMissionOverview(); drawRoute(); renderDataCard();
  const errors=state.calc.filter(Boolean).filter(c=>c.error); const over=s.block>cap;
  let status='PLAN READY',cls='badge ok';
  if(errors.length){status='CHECK ROUTE';cls='badge bad';}
  else if(s.aar?.enabled&&!['PLAN OK','NOT REQUIRED'].includes(s.aar.status)){status='AAR CHECK';cls='badge bad';}
  else if(s.hardTimeIssues?.length){status='HARD TIME CHECK';cls='badge bad';}
  else if(!s.fuelPathValid){status='FUEL STATE CHECK';cls='badge bad';}
  else if(!s.divertValid){status='DIVERT REQUIRED';cls='badge';}
  else if(onboard<s.block-.5){status='FUEL SHORTFALL';cls='badge bad';}
  else if(over){status='OVER CAPACITY';cls='badge bad';}
  $('planStatus').textContent=status; $('planStatus').className=cls;
  $('missionFob').textContent=fmt(onboard); $('missionSpare').textContent=s.routeValid?fmt(onboard-s.block):'CHECK';
}

function updateBingoOptions(){
  const sel=$('bingoWp'), jokerSel=$('jokerWp'), old=sel.value, oldJoker=jokerSel?.value??''; sel.innerHTML=''; if(jokerSel)jokerSel.innerHTML='';
  state.route.forEach((r,i)=>{
    if(i===0) return;
    const o=document.createElement('option'); o.value=String(i);
    o.textContent=(i===state.route.length-1)
      ? `ARRIVAL · ${r.wp||'—'} · RECOVERY FLOOR`
      : `WP ${i+1} · ${r.wp||'—'}`;
    sel.appendChild(o);
    if(jokerSel){const j=o.cloneNode(true);j.textContent=(i===state.route.length-1)?`ARRIVAL · ${r.wp||'—'}`:`WP ${i+1} · ${r.wp||'—'}`;jokerSel.appendChild(j);}
  });
  const oldValid=old!=='' && Number.isInteger(Number(old)) && Number(old)>0 && Number(old)<state.route.length;
  sel.value=oldValid?String(old):String(Math.max(1,state.route.length-1));
  if(jokerSel){const jv=oldJoker!==''&&Number.isInteger(Number(oldJoker))&&Number(oldJoker)>0&&Number(oldJoker)<state.route.length;jokerSel.value=jv?String(oldJoker):String(Math.max(1,state.route.length-2));}
}

function updateAarOptions(){
  const sel=$('aarWp'); if(!sel)return; const old=sel.value; sel.innerHTML='';
  const candidates=state.route.map((r,i)=>({r,i})).filter(x=>x.i>0&&x.i<state.route.length-1);
  if(!candidates.length){const o=document.createElement('option');o.value='';o.textContent='NO INTERMEDIATE WAYPOINT';sel.appendChild(o);sel.disabled=true;return;}
  sel.disabled=false;
  candidates.forEach(({r,i})=>{const o=document.createElement('option');o.value=i;o.textContent=`WP ${i+1} · ${r.wp||'—'}`;sel.appendChild(o)});
  sel.value=(old!==''&&candidates.some(x=>String(x.i)===String(old)))?old:String(candidates[Math.floor(candidates.length/2)].i);
}

function aarBurnProfile(surcharge=1){
  const p=profile(),aarFl=parseNum($('aarAlt')?.value,230),aarAltFt=aarFl*100;
  const aarKias=parseNum($('aarSpeed')?.value,285),aarMach=kiasToMach(aarKias,aarAltFt);
  const conf=String($('aarConfig')?.value||'CLEAN').toUpperCase();
  const measuredConf=String(p.measurementConfiguration||'').toUpperCase();
  // Do not pretend the 3 BAGS calibration is a CLEAN performance model.
  const configurationValid=!!measuredConf&&conf===measuredConf;
  const aarFlow=fuelFlow(aarAltFt,aarMach);
  const valid=configurationValid&&aarAltFt>=0&&aarAltFt<=55000&&aarKias>0&&aarFlow.status!=='range';
  return {aarFl,aarAltFt,aarKias,aarMach,aarModelMach:aarMach,configurationValid,measuredConf,
    aarBurnRate:valid?aarFlow.value*surcharge:NaN,profileValid:valid};
}

function updateAAR(){
  const s=state.summary,p=profile(),enabled=!!$('aarEnabled')?.checked,cap=parseNum(p.tankCapacityKg,0),currentStart=parseNum($('tankOnBoard').value,0);
  const index=clamp(parseInt($('aarWp')?.value||'0',10),0,Math.max(0,state.route.length-1));
  const duration=enabled?clamp(parseNum($('aarDuration')?.value,10),0,240):0;
  const burnProfile=aarBurnProfile(s.surcharge);
  const {aarFl,aarAltFt,aarKias,aarMach,aarModelMach,aarBurnRate}=burnProfile;
  const durationBurn=enabled&&duration>0?aarBurnRate*duration:0;

  let routeBurnTo=0;
  for(let i=1;i<=index;i++){
    if(i>1)routeBurnTo+=s.holdFuelAt?.[i-1]||0;
    if(!state.calc[i]?.error)routeBurnTo+=(state.calc[i].fuel||0)*s.surcharge;
  }
  const burnToWp=s.ground+routeBurnTo;
  const currentFobBefore=currentStart-burnToWp;

  // TARGET FOB is explicitly the desired ACTUAL fuel state at AAR OUT.
  const requiredAfter=(s.remainingRoute[index]||0)+s.divert+s.recovery+s.reserve;
  const manualOn=!!$('aarManualToggle')?.checked;
  const explicitTarget=parseNum($('aarTargetOut')?.value,NaN);
  const targetOutFob=!manualOn&&Number.isFinite(explicitTarget)?explicitTarget:requiredAfter;
  const manual=parseNum($('aarManualKg')?.value,NaN);
  const core=window.IFECore.computeAarFuelState({
    fobIn:currentStart>=0&&currentStart<=cap?currentFobBefore:NaN,targetOutFob,durationBurn,
    requestedOnload:manual,manual:manualOn,capacity:cap
  });

  const rateRaw=$('aarTransferRate').value;
  const transfer=window.IFECore.computeAarTransfer({rate:rateRaw===''?null:parseNum(rateRaw,NaN),receiverFlow:burnProfile.profileValid?aarBurnRate:NaN,eventDuration:duration,fobIn:currentFobBefore,targetOutFob,grossOnload:manual,manual:manualOn,capacity:cap});
  const rateSource=$('aarRateSource').value;
  if(enabled&&!transfer.missingRate){
    core.grossCapacity=Number.isFinite(transfer.rate)&&transfer.rate>aarBurnRate?Math.max(0,Math.min(transfer.rate*duration,(cap-currentFobBefore)/(1-aarBurnRate/transfer.rate))):NaN;
    core.capacityLimited=core.requested>core.grossCapacity+1e-7;
    // Exact onload with known rate; never cap an infeasible transfer into a different plan.
    core.valid=core.valid&&transfer.valid;
    if(core.valid){core.accepted=transfer.grossOnload;core.requested=transfer.grossOnload;core.fobOut=transfer.fobOut;core.fobAfterLoad=currentFobBefore+core.accepted;core.netGain=core.accepted-durationBurn;core.shortfall=Math.max(0,targetOutFob-core.fobOut);}
    else {core.accepted=NaN;core.fobOut=NaN;core.fobAfterLoad=NaN;core.netGain=NaN;core.shortfall=NaN;}
  }
  const autoNeed=core.requiredGross, requested=core.requested, accepted=core.accepted;
  const fobAfterLoad=core.fobAfterLoad, fobOut=core.fobOut, netGain=core.netGain, shortfall=core.shortfall;
  const currentTankSpace=Math.max(0,cap-Math.max(0,currentFobBefore));
  const currentGrossOnloadCapacity=core.grossCapacity;

  // Planning block may benefit from the NET AAR effect, but MANUAL never rewrites the
  // user's actual Mission/Tank-On-Board value. Actual FOB path below always starts from currentStart.
  const blockWithAar=enabled?Math.max(burnToWp,s.baseBlock-netGain):s.baseBlock;
  const minimumStart=Math.max(0,burnToWp);

  let status='OFF',detail='AAR not planned';
  if(enabled){
    if(!s.routeValid){status='CHECK ROUTE';detail='Fix invalid route legs before AAR planning';}
    else if(index<=0||index>=state.route.length-1){status='CHECK';detail='Select an intermediate waypoint';}
    else if(currentStart<0||currentStart>cap){status='START CAP';detail=`Entered start fuel must be between 0 and ${fmt(cap)} kg; the input is unchanged`;}
    else if(currentFobBefore<0){status='UNREACHABLE';detail=`Start fuel is ${fmt(minimumStart-currentStart)} kg short of reaching AAR`;}
    else if(duration>0&&!burnProfile.profileValid){status='AAR PROFILE';detail=!burnProfile.configurationValid?`No fuel-flow calibration for this configuration; available: ${burnProfile.measuredConf||'none'}`:'AAR altitude/speed outside the active fuel-flow model; no clamping to another Mach';}
    else if(burnToWp>cap+.5){status='UNREACHABLE';detail=`Fuel to AAR (${fmt(burnToWp)} kg) exceeds aircraft tank capacity`;}
    else if(!manualOn&&core.targetOverCapacity){status='TARGET CAP';detail=`Target FOB OUT ${fmt(targetOutFob)} kg exceeds tank capacity ${fmt(cap)} kg`;}
    else if(!manualOn&&targetOutFob<0){status='TARGET CHECK';detail='Target FOB OUT must be non-negative';}
    else if(!transfer.missingRate&&!transfer.valid){status=transfer.status;detail=transfer.status==='EVENT TOO SHORT'?`Transfer requires ${fmt(transfer.transferTime,2)} min; planned event remains ${fmt(duration,2)} min. Increase event duration explicitly or change inputs.`:'No feasible transfer: check rate, receiver flow and peak tank content (transfer before orbit).';}
    else if(core.capacityLimited){status='CAP LIMIT';detail=`Requested ${fmt(requested)} kg gross onload exceeds ${fmt(core.grossCapacity)} kg event capacity. Manual input unchanged; no feasible FOB OUT`;}
    else if(!core.valid){status=core.fuelExhausted?'FUEL EXHAUSTED':'ONLOAD CHECK';detail=core.fuelExhausted?'Fuel exhausted during AAR; no feasible downstream fuel state':'Enter a non-negative manual gross onload';}
    else if(blockWithAar>cap+.5){status='START CAP';detail=`Planning block ${fmt(blockWithAar)} kg exceeds tank capacity ${fmt(cap)} kg`;}
    else if(fobOut<requiredAfter-.5){status='SHORTFALL';detail=`FOB OUT ${fmt(fobOut)} kg is ${fmt(requiredAfter-fobOut)} kg below continuation requirement`;}
    else if(accepted<0.5){status='NOT REQUIRED';detail=`No tanker onload required; AAR burn ${fmt(durationBurn)} kg leaves FOB OUT ${fmt(fobOut)} kg`;}
    else if(manualOn){status='PLAN OK';detail=`Manual gross onload ${fmt(accepted)} kg: ${fmt(currentFobBefore)} IN + ${fmt(accepted)} - ${fmt(durationBurn)} burn = ${fmt(fobOut)} OUT`;}
    else {status='PLAN OK';detail=`AUTO gross onload ${fmt(accepted)} kg = Target OUT ${fmt(targetOutFob)} - FOB IN ${fmt(currentFobBefore)} + burn ${fmt(durationBurn)}`;}
  }

  if(enabled&&transfer.missingRate)detail+=' TRANSFER TIME: N/A / RATE REQUIRED; fuel values use planned event burn only, transfer feasibility unverified.';
  // Actual fuel path. fobInAt = arrival before any waypoint dwell/AAR event.
  // fobOutAt = state after all waypoint events (AAR + HOLD) before the next leg.
  const legFuelAt=state.route.map((_,i)=>i===0?0:state.calc[i]?.error?NaN:state.calc[i].fuel*s.surcharge);
  const path=window.IFECore.propagateFuelPath({startFob:currentStart,groundFuel:s.ground,legFuelAt,holdFuelAt:s.holdFuelAt||[],aarIndex:enabled?index:-1,aarNetGain:enabled?netGain:0,capacity:cap});
  const fobInAt=path?.fobInAt||new Array(state.route.length).fill(NaN);
  const fobOutAt=path?.fobOutAt||new Array(state.route.length).fill(NaN);
  const fobAt=fobInAt; // backward-compatible alias = WP IN / arrival fuel.

  const aarOut=(enabled&&Number.isFinite(s.startZuluMin))?formatZulu(s.startZuluMin+parseNum(s.cumulative?.[index],0)+duration)+'Z':'—';
  const landingFob=Number.isFinite(path?.landingFob)?path.landingFob:NaN;
  state.aar={transfer,rateSource,enabled,index,duration,aarFl,aarAltFt,aarKias,aarMach,aarModelMach,aarBurnRate,durationBurn,routeBurnTo,burnToWp,currentStart,currentFobBefore,targetOutFob,requiredAfter,suggested:autoNeed,currentTankSpace,currentGrossOnloadCapacity,requested,accepted,netGain,fobAfterLoad,fobAfter:fobOut,shortfall,blockWithAar,status,detail,manualOn,valid:core.valid,afterLoadWithinStaticCapacity:core.afterLoadWithinStaticCapacity,landingFob,aarOut};
  s.aar=state.aar;s.block=blockWithAar;s.missionTrip=s.trip+(enabled?durationBurn:0);s.fobAt=fobAt;s.fobInAt=fobInAt;s.fobOutAt=fobOutAt;s.landingFob=landingFob;s.fuelPathValid=path.valid;s.fuelInvalidIndex=path.firstInvalidIndex;
  s.plannedTakeoffFob=fobInAt[0];s.requiredTakeoff=Math.max(0,blockWithAar-s.ground);
  // Thresholds do not credit an unreceived onload. Remaining planned event burn still counts.
  s.remaining=s.remainingRoute.map((r,i)=>r+(enabled&&i<=index?durationBurn:0));

  if($('aarCapacity'))$('aarCapacity').value=fmt(cap);
  const put=(id,v)=>{if($(id))$(id).textContent=v};
  put('aarCurrentStart',enabled?fmt(currentStart):'—');
  put('aarBurnToPoint',enabled?fmt(burnToWp):'—');
  put('aarFobBefore',enabled&&core.initialValid?fmt(currentFobBefore):'—');
  put('aarRequiredAfter',enabled?fmt(targetOutFob):'—');
  put('aarRequiredAfterLabel',manualOn?'CONTINUATION REQ':'TARGET FOB OUT');
  if($('aarTargetOut'))$('aarTargetOut').disabled=manualOn;
  put('aarDurationBurn',enabled?fmt(durationBurn):'—');
  put('aarSuggested',enabled?fmt(autoNeed):'—');
  put('aarTankSpace',enabled?fmt(currentTankSpace):'—');
  put('aarPlanned',enabled?fmt(manualOn?requested:accepted):'—');
  put('aarFobAfterLoad',enabled?fmt(fobAfterLoad):'—');
  put('aarFobAfter',enabled?fmt(fobOut):'—');
  put('aarOutTime',enabled?aarOut:'—');
  put('aarBlockRequired',enabled?fmt(blockWithAar):'—');
  put('aarStatus',status);put('aarStatusDetail',detail);
  put('aarBurnToWp',enabled?fmt(burnToWp)+' kg':'—');put('aarBaseBlock',fmt(s.baseBlock)+' kg');put('aarAccepted',enabled?fmt(accepted)+' kg':'—');put('aarShortfall',enabled?fmt(shortfall)+' kg':'—');
  if($('missionAar'))$('missionAar').textContent=enabled?fmt(accepted):'OFF';
  if($('missionAarUnit'))$('missionAarUnit').textContent=enabled?'kg gross onload':'planned';
  if($('missionLandingFob'))$('missionLandingFob').textContent=Number.isFinite(landingFob)?fmt(landingFob):'—';

  const ticket=(id,v)=>{if($(id))$(id).textContent=v};
  const arip=($('aarArip')?.value||'').trim().toUpperCase();
  const arcp=($('aarArcp')?.value||'').trim().toUpperCase() || (state.route[index]?.wp||'—');
  const arct=(enabled && s.etaAt?.[index] && s.etaAt[index]!=='—')?s.etaAt[index]+'Z':'—';
  const conf=$('aarConfig')?.value||'CLEAN';
  const bingo2=parseNum($('aarBingo2')?.value,NaN);
  const b2rtb=($('aarB2Rtb')?.value||'').trim().toUpperCase();
  ticket('aarTicketArip',enabled?(arip||'—'):'—');ticket('aarTicketArcp',enabled?arcp:'—');ticket('aarTicketArct',arct);
  const tankerType=$('aarTankerType')?.value||'',tankerCallsign=$('aarTankerCallsign')?.value||'',frequency=$('aarFrequency')?.value||'',plannedArct=$('aarPlannedArct')?.value||'',plannedOut=$('aarPlannedOut')?.value||'';
  ticket('aarTicketTanker',enabled?(tankerType||'—'):'—');ticket('aarTicketCallsign',enabled?(tankerCallsign||'—'):'—');ticket('aarTicketFrequency',enabled?(frequency||'—'):'—');
  ticket('aarTicketPlanTimes',enabled&&(plannedArct||plannedOut)?`${plannedArct||'—'}Z / ${plannedOut||'—'}Z`:'—');
  ticket('aarTicketAlt',enabled?`FL${fmt(aarFl,0)}`:'—');ticket('aarTicketSpeed',enabled?`${fmt(aarKias,0)} KIAS`:'—');ticket('aarTicketConfig',enabled?conf:'—');
  ticket('aarTicketFobIn',enabled&&core.initialValid?`${fmt(currentFobBefore)} KG`:'—');ticket('aarTicketTarget',enabled&&!manualOn?`${fmt(targetOutFob)} KG`:'—');ticket('aarTicketOnload',enabled?`+${fmt(manualOn?requested:accepted)} KG`:'—');
  if($('aarTicketTargetRow')){
    $('aarTicketTargetRow').hidden=manualOn;
    $('aarTicketTargetRow').className=manualOn?'aar-ticket-row hidden':'aar-ticket-row';
  }
  ticket('aarTicketAfterLoad',enabled?`${fmt(fobAfterLoad)} KG*`:'—');ticket('aarTicketBurn',enabled?`-${fmt(durationBurn)} KG`:'—');ticket('aarTicketFobOut',enabled?`${fmt(fobOut)} KG`:'—');
  const xferText=Number.isFinite(transfer.transferTime)?`${fmt(transfer.transferTime,2)} MIN${transfer.valid?'':' · CHECK'}`:`N/A / ${transfer.status}`;
  ticket('aarTicketRate',enabled&&Number.isFinite(transfer.rate)?`${fmt(transfer.rate,2)} KG/MIN`:'N/A / RATE REQUIRED');
  ticket('aarTicketRateSource',rateSource);ticket('aarTicketTransferTime',enabled?xferText:'—');ticket('aarTicketEvent',enabled?`${fmt(duration,1)} MIN`:'—');
  ticket('aarTransferStatus',enabled?`TRANSFER TIME: ${xferText} · ${transfer.status}${Number.isFinite(transfer.orbitTime)?` · ORBIT ${fmt(transfer.orbitTime,2)} MIN`:''}`:'AAR OFF');
  ticket('aarTicketTime',enabled&&transfer.valid&&Number.isFinite(transfer.transferBurn)?`${fmt(transfer.transferBurn)} / ${fmt(transfer.orbitBurn)} KG`:'N/A');ticket('aarTicketOut',aarOut);
  ticket('aarTicketBingo2',enabled&&Number.isFinite(bingo2)?`${fmt(bingo2)} KG`:'—');ticket('aarTicketRtb',enabled?(b2rtb||'—'):'—');
  const bingoUsed=Number.isFinite(s.bingo)?s.bingo:NaN,jokerUsed=Number.isFinite(s.joker)?s.joker:NaN,jokerIndex=Number.isInteger(s.jokerIndex)?s.jokerIndex:Math.max(1,state.route.length-2),jokerWp=state.route[jokerIndex]?.wp||'—';
  ticket('aarTicketBingo',enabled&&Number.isFinite(bingoUsed)?`${fmt(bingoUsed)} KG`:'—');ticket('aarTicketJoker',enabled&&Number.isFinite(jokerUsed)?`${fmt(jokerUsed)} KG`:'—');ticket('aarTicketJokerWp',enabled?`${jokerWp} ${(s.jokerBasis||'in').toUpperCase()}`:'—');
  state.aar.ticket={transfer,rateSource,arip,arcp,arct,tankerType,tankerCallsign,frequency,plannedArct,plannedOut,alt:aarFl,speed:aarKias,conf,duration,out:aarOut,bingo2,b2rtb,bingo:bingoUsed,joker:jokerUsed,jokerWp,fobIn:core.initialValid?currentFobBefore:NaN,target:manualOn?NaN:targetOutFob,onload:manualOn?requested:accepted,fobAfterLoad,burn:durationBurn,fobOut,netGain};
}
function updateBingo(){
  if(!state.route.length||!state.summary.remaining)return;
  updateBingoOptions();
  const selected=$('bingoWp').value;
  const i=clamp(parseInt(selected||String(state.route.length-1),10),1,state.route.length-1);
  const remaining=state.summary.remaining[i]??0;
  const recoveryFloor=state.summary.divert+state.summary.recovery+state.summary.reserve;
  const autoValid=!!state.summary.divertValid && !!state.summary.routeValid;
  const bingoValid=autoValid&&Number.isFinite(remaining);
  const auto=bingoValid?ceilKg(remaining+recoveryFloor):NaN;
  const bingoManualOn=$('bingoManualToggle').checked, bingoManual=parseNum($('bingoManual').value,NaN);
  const bingoUsed=bingoManualOn&&Number.isFinite(bingoManual)?bingoManual:auto;
  const bingoPredicted=state.summary.fobInAt?.[i];
  const bingoMargin=Number.isFinite(bingoPredicted)&&Number.isFinite(bingoUsed)?bingoPredicted-bingoUsed:NaN;

  const jokerSelected=$('jokerWp')?.value;
  const jokerI=clamp(parseInt(jokerSelected||String(Math.max(1,state.route.length-2)),10),1,state.route.length-1);
  const jokerBasis=$('jokerBasis')?.value==='out'?'out':'in';
  const jokerRemainingIn=state.summary.remaining[jokerI]??0;
  const jokerHold=state.summary.holdFuelAt?.[jokerI]||0;
  const aarBurnAtWp=state.aar?.enabled&&state.aar.index===jokerI?state.aar.durationBurn:0;
  const core=Number.isFinite(jokerRemainingIn)?window.IFECore.computeJokerRequirement({remainingAtWp:jokerRemainingIn,holdFuelAtWp:jokerHold,aarBurnAtWp,recoveryFloor,buffer:parseNum($('jokerBuffer').value,795),basis:jokerBasis}):null;
  const jokerRemaining=core?core.remaining:(jokerBasis==='out'?Math.max(0,jokerRemainingIn-jokerHold):jokerRemainingIn);
  const jokerBase=autoValid&&Number.isFinite(jokerRemainingIn)?ceilKg((core?core.base:jokerRemaining+recoveryFloor)):NaN;
  const jokerBuffer=parseNum($('jokerBuffer').value,795);
  const jokerAuto=Number.isFinite(jokerBase)?ceilKg((core?core.base:jokerRemaining+recoveryFloor)+jokerBuffer):NaN;
  const jokerManualOn=$('jokerManualToggle').checked, jokerManual=parseNum($('jokerManual').value,NaN), jokerUsed=jokerManualOn&&Number.isFinite(jokerManual)?jokerManual:jokerAuto;
  const jokerPredicted=jokerBasis==='out'?state.summary.fobOutAt?.[jokerI]:state.summary.fobInAt?.[jokerI];
  const jokerMargin=Number.isFinite(jokerPredicted)&&Number.isFinite(jokerUsed)?jokerPredicted-jokerUsed:NaN;

  $('bingoAuto').textContent=bingoValid?fmt(auto)+' kg':(!state.summary.routeValid?'CHECK ROUTE':'DIVERT REQUIRED');
  $('bingoUsed').textContent=Number.isFinite(bingoUsed)?fmt(bingoUsed)+' kg':'—'; $('bingoMode').textContent=bingoManualOn?'MANUAL':(bingoValid?'AUTO':'CHECK');
  $('jokerAuto').textContent=Number.isFinite(jokerAuto)?fmt(jokerAuto)+' kg':'—'; $('jokerUsed').textContent=Number.isFinite(jokerUsed)?fmt(jokerUsed)+' kg':'—'; $('jokerMode').textContent=jokerManualOn?'MANUAL':(Number.isFinite(jokerAuto)?'AUTO':'CHECK');
  if($('jokerAutoLabel'))$('jokerAutoLabel').textContent=`Joker auto @ selected WP ${jokerBasis.toUpperCase()}`;
  $('bingoRemaining').textContent=fmt(remaining)+' kg'; if($('bingoFobAt'))$('bingoFobAt').textContent=Number.isFinite(bingoPredicted)?fmt(bingoPredicted)+' kg':'—'; if($('bingoMargin'))$('bingoMargin').textContent=Number.isFinite(bingoMargin)?`${bingoMargin>=0?'+':''}${fmt(bingoMargin)} kg`:'—'; if($('jokerRemaining'))$('jokerRemaining').textContent=fmt(jokerRemaining)+' kg';
  if($('jokerRemainingLabel'))$('jokerRemainingLabel').textContent=`Remaining mission @ Joker WP ${jokerBasis.toUpperCase()}`;
  if($('jokerFobAt'))$('jokerFobAt').textContent=Number.isFinite(jokerPredicted)?fmt(jokerPredicted)+' kg':'—';
  if($('jokerMargin'))$('jokerMargin').textContent=Number.isFinite(jokerMargin)?`${jokerMargin>=0?'+':''}${fmt(jokerMargin)} kg`:'—';
  $('bingoDivert').textContent=state.summary.divertValid?fmt(state.summary.divert)+' kg':'REQUIRED'; $('bingoRecovery').textContent=fmt(state.summary.recovery)+' kg'; $('bingoReserve').textContent=fmt(state.summary.reserve)+' kg';
  if($('arrivalRecoveryFloor')) $('arrivalRecoveryFloor').textContent=state.summary.divertValid?fmt(recoveryFloor)+' kg':'DIVERT REQUIRED';
  state.summary.arrivalRecoveryFloor=recoveryFloor;
  Object.assign(state.summary,{bingoAuto:auto,bingo:bingoUsed,bingoIndex:i,bingoPredicted,bingoMargin,jokerAuto,joker:jokerUsed,jokerIndex:jokerI,jokerBase,jokerBasis,jokerRemaining,jokerPredicted,jokerMargin});
  if(state.aar?.enabled){
    if($('aarTicketBingo')) $('aarTicketBingo').textContent=Number.isFinite(bingoUsed)?`${fmt(bingoUsed)} KG`:'—';
    if($('aarTicketJoker')) $('aarTicketJoker').textContent=Number.isFinite(jokerUsed)?`${fmt(jokerUsed)} KG`:'—';
    if($('aarTicketJokerWp')) $('aarTicketJokerWp').textContent=`${state.route[jokerI]?.wp||'—'} ${jokerBasis.toUpperCase()}`;
    if(state.aar.ticket){state.aar.ticket.bingo=bingoUsed;state.aar.ticket.joker=jokerUsed;state.aar.ticket.jokerWp=state.route[jokerI]?.wp||'—';state.aar.ticket.jokerBasis=jokerBasis;}
  }
  $('missionBingo').textContent=Number.isFinite(bingoUsed)?fmt(bingoUsed):'—'; $('missionJoker').textContent=Number.isFinite(jokerUsed)?fmt(jokerUsed):'—';
  renderDataCard();
}

function updateMissionOverview(){
  const s=state.summary,dep=$('departure').value.trim().toUpperCase()||'—',arr=$('arrival').value.trim().toUpperCase()||'—';
  $('missionRoute').textContent=`${dep} → ${arr}`; $('missionCallsign').textContent=($('callsign').value.trim()||uiText('KEIN CALLSIGN','NO CALLSIGN')).toUpperCase();
  $('missionBlock').textContent=s.routeValid?fmt(ceilKg(s.block)):'CHECK'; $('missionDistance').textContent=s.routeValid?fmt(s.dist,1):'CHECK'; $('missionTime').textContent=s.routeValid?formatTime(s.time):'CHECK'; $('missionDivert').textContent=s.divertValid?fmt(s.divert):'—';
  if($('missionEtaZulu'))$('missionEtaZulu').textContent=Number.isFinite(s.startZuluMin)?`ETA ${formatZulu(s.startZuluMin+s.time)}Z`:'SET START Z';
  if($('missionLandingFob'))$('missionLandingFob').textContent=Number.isFinite(s.landingFob)?fmt(s.landingFob):'—';
}

function drawRoute(){drawProfile($('routeSvg'),1100,260);drawProfile($('missionProfile'),1100,240);}
function drawProfile(svg,w,h){
  const pts=state.route;if(!svg||!pts.length)return;
  const maxAlt=Math.max(10000,...pts.map(x=>parseNum(x.alt))),x=i=>50+(w-100)*(i/Math.max(1,pts.length-1)),y=a=>(h-34)-(h-75)*parseNum(a)/maxAlt;
  let html=`<line x1="35" y1="${h-34}" x2="${w-35}" y2="${h-34}" stroke="#31443b"/><polyline points="${pts.map((p,i)=>`${x(i)},${y(p.alt)}`).join(' ')}" fill="none" stroke="#9bcf59" stroke-width="3"/>`;
  for(let a=0;a<=maxAlt;a+=10000)html+=`<line x1="35" y1="${y(a)}" x2="${w-35}" y2="${y(a)}" stroke="#16231e"/><text x="38" y="${Math.max(12,y(a)-3)}" fill="#667b70" font-size="10">${Math.round(a/1000)}k</text>`;
  pts.forEach((p,i)=>{const aar=!!state.aar?.enabled&&state.aar.index===i;html+=`<g class="wp-hit" data-i="${i}" tabindex="0">${aar?`<circle cx="${x(i)}" cy="${y(p.alt)}" r="14" fill="none" stroke="#8be7e0" stroke-width="3"/><text x="${x(i)}" y="${Math.min(h-8,y(p.alt)+28)}" fill="#8be7e0" font-size="10" font-weight="800" text-anchor="middle">AAR</text>`:''}<circle cx="${x(i)}" cy="${y(p.alt)}" r="8" fill="#9bcf59" stroke="#050807" stroke-width="3"/><circle cx="${x(i)}" cy="${y(p.alt)}" r="18" fill="transparent"/><text x="${x(i)}" y="${Math.max(16,y(p.alt)-12)}" fill="#e2ece6" font-size="11" text-anchor="middle">${escapeHtml(p.wp||'WP')}</text></g>`;});
  svg.innerHTML=html;
  svg.querySelectorAll('.wp-hit').forEach(g=>{const open=()=>openWaypointInfo(parseInt(g.dataset.i,10));g.addEventListener('click',open);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});});
}

function useMissionAirportElevations(){ $('cruiseDepElev').value=missionDepElev(); $('cruiseArrElev').value=missionArrElev(); }
function missionDirectDistance(){
  const dep=airport($('departure').value.trim().toUpperCase()) || state.route[0];
  const arr=airport($('arrival').value.trim().toUpperCase()) || state.route[state.route.length-1];
  return haversineNM(dep,arr);
}
function syncCruiseDistanceSource(){
  const source=$('cruiseDistanceSource')?.value||'route', input=$('cruiseDistance');
  const isTime=$('cruiseMode')?.value==='time';
  if($('cruiseDistanceSourceLabel')) $('cruiseDistanceSourceLabel').classList.toggle('hidden',isTime);
  if(!input)return;
  if(isTime){ input.readOnly=true; return; }
  if(source==='manual'){
    input.readOnly=false; input.removeAttribute('aria-readonly');
    if(parseNum(input.value)<=0) input.value='';
    input.placeholder='Enter NM';
    return;
  }
  input.readOnly=true; input.setAttribute('aria-readonly','true');
  input.placeholder=source==='direct'?'DEP → ARR direct':'Current route total';
  let d=NaN;
  if(source==='direct') d=missionDirectDistance();
  else d=Number(state.summary?.dist);
  input.value=Number.isFinite(d)&&d>0?String(Math.round(d*10)/10):'0';
}
function toggleCruiseMode(){
  const isTime=$('cruiseMode').value==='time'; $('cruiseDistanceLabel').classList.toggle('hidden',isTime); $('cruiseTimeLabel').classList.toggle('hidden',!isTime); if($('cruiseDistanceSourceLabel'))$('cruiseDistanceSourceLabel').classList.toggle('hidden',isTime);
}
function calcCruise(){
  syncCruiseDistanceSource();
  if(!activeFuelData())return; const p=profile(),mode=$('cruiseMode').value,alt=parseNum($('cruiseAltitude').value),mach=parseNum($('cruiseMach').value),wind=parseNum($('cruiseWind').value),depElev=parseNum($('cruiseDepElev').value),arrElev=parseNum($('cruiseArrElev').value),surcharge=1+parseNum($('surchargePct').value)/100;
  const fail=(m)=>{$('cruiseStatus').textContent='CHECK';$('cruiseStatus').className='badge bad';['cruiseClimbFuel','cruiseCruiseFuel','cruiseDescentFuel','cruiseFlightFuel','cruiseResultTime','cruiseResultDistance','cruiseBlockFuel','cruiseFlow'].forEach(id=>$(id).textContent='—');$('cruiseDetails').textContent=m;};
  if(alt<Math.max(depElev,arrElev)||alt>55000)return fail('Cruise altitude passt nicht zu den Platzhöhen.');
  if(mach<p.minMach||mach>p.maxMach)return fail(uiText('Mach außerhalb des Performance-Bereichs.','Mach outside performance range.')); 
  const climbMin=Math.max(0,alt-depElev)/p.climbRateFpm, descentMin=Math.max(0,alt-arrElev)/p.descentRateFpm, transDist=(climbMin+descentMin)*(p.transitionTasKt+wind)/60, gs=machTas(mach,alt)+wind, ff=fuelFlow(alt,mach);
  if(gs<=0||p.transitionTasKt+wind<=0)return fail('Wind ergibt keine gültige Groundspeed.');
  let cruiseMin,totalMin,distance;
  if(mode==='time'){
    totalMin=parseNum($('cruiseTimeInput').value); cruiseMin=totalMin-climbMin-descentMin; if(cruiseMin<0)return fail('Gesamtzeit ist zu kurz für Steig- und Sinkflug.'); distance=transDist+cruiseMin*gs/60;
  }else{
    distance=parseNum($('cruiseDistance').value);
    if(distance<=0){
      const source=$('cruiseDistanceSource')?.value||'route';
      return fail(source==='manual'?'Bitte eine manuelle Distanz > 0 NM eingeben.':source==='direct'?'Keine gültigen Koordinaten für DEP → ARR verfügbar.':'Aktuelle Route enthält noch keine gültige Gesamtdistanz.');
    }
    const cruiseDist=distance-transDist;if(cruiseDist<0)return fail('Strecke ist zu kurz für die gewählte Reiseflughöhe.'); cruiseMin=cruiseDist/gs*60;totalMin=climbMin+cruiseMin+descentMin;
  }
  const climbFuel=climbMin*p.climbFuelKgPerMin*surcharge,cruiseFuel=cruiseMin*ff.value*surcharge,descentFuel=descentMin*p.descentFuelKgPerMin*surcharge,flight=climbFuel+cruiseFuel+descentFuel;
  const ground=parseNum($('taxiMin').value)*p.groundFuelKgPerMin,reserve=parseNum($('reserveKg').value),recovery=parseNum($('recoveryExtra').value),divert=state.summary.divert||0,block=flight+ground+reserve+recovery+divert;
  $('cruiseClimbFuel').textContent=fmt(climbFuel); $('cruiseCruiseFuel').textContent=fmt(cruiseFuel); $('cruiseDescentFuel').textContent=fmt(descentFuel); $('cruiseFlightFuel').textContent=fmt(flight); $('cruiseResultTime').textContent=formatTime(totalMin); $('cruiseResultDistance').textContent=fmt(distance,1); $('cruiseBlockFuel').textContent=fmt(ceilKg(block)); $('cruiseFlow').textContent=fmt(ff.value,1);
  $('cruiseStatus').textContent='VALID';$('cruiseStatus').className='badge ok';
  const source=mode==='time'?'TOTAL TIME':({route:'CURRENT ROUTE',direct:'DEP → ARR DIRECT',manual:'MANUAL DISTANCE'}[$('cruiseDistanceSource')?.value]||'DISTANCE');
  $('cruiseDetails').textContent=`${uiText('Quelle','Source')} ${source} · TAS ${fmt(machTas(mach,alt),0)} kt · GS ${fmt(gs,0)} kt · Höhenwechsel ${fmt(transDist,1)} NM · Cruise ${fmt(cruiseMin,1)} min · Block inkl. Taxi, Divert, Recovery und Reserve.`;
}

function formatUtcDate(){
  const raw=$('missionDate')?.value||currentUtcDateInput();
  const m=String(raw).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(m)return uiLang()==='en'?`${m[1]}-${m[2]}-${m[3]}`:`${m[3]}.${m[2]}.${m[1]}`;
  return raw||'—';
}

function renderDataCard(){
  if(!state.route.length||!state.summary.remaining)return; const s=state.summary,p=profile(),dep=$('departure').value.trim().toUpperCase()||'—',arr=$('arrival').value.trim().toUpperCase()||'—',onboard=parseNum($('tankOnBoard').value),uplift=Math.max(0,s.block-onboard),takeoff=s.requiredTakeoff,bingoI=s.bingoIndex??Math.max(0,state.route.length-1),jokerI=s.jokerIndex??Math.max(0,state.route.length-2);
  const rows=state.route.map((r,i)=>{
    const c=state.calc[i],isAar=!!s.aar?.enabled&&s.aar.index===i; const legNm=i===0?'—':(c?.error?'CHK':fmt(c?.distance,1));
    const wpLabel=`${escapeHtml(r.wp)}${isAar?`<span class="dc-aar-tag">AAR ${fmt(s.aar.accepted)} kg ONLOAD</span>`:''}`;
    const eta=s.etaAt?.[i]&&s.etaAt[i]!=='—'?s.etaAt[i]+'Z':'—';
    const hm=s.holdAt?.[i]||0;
    const hold=hm>0?`IN ${eta} → OUT ${s.wpOutAt?.[i]&&s.wpOutAt[i]!=='—'?s.wpOutAt[i]+'Z':'—'} · ${fmt(hm,1)}m / ${fmt(s.holdFuelAt?.[i]||0)}kg`:'—';
    const fIn=s.fobInAt?.[i],fOut=s.fobOutAt?.[i];
    const fob=Number.isFinite(fIn)?((hm>0||isAar)?`IN ${fmt(fIn)} / OUT ${fmt(fOut)}`:fmt(fIn)):'—';
    return `<tr class="${isAar?'dc-aar-row':''}"><td>${String(i+1).padStart(2,'0')}</td><td>${wpLabel}</td><td>${fmt(parseNum(r.alt))}</td><td>${i===0?'—':escapeHtml(displayMach(r.mach)||'—')}</td><td>${i===0?'—':fmt(parseNum(r.wind))}</td><td>${legNm}</td><td>${i===0?'—':c?.error?'CHK':fmt(c?.time,1)}</td><td>${eta}${r.etaOverride?`<br><small>HARD ${escapeHtml(r.etaOverride)}Z</small>`:r.plannedEta?`<br><small>PLAN ${escapeHtml(r.plannedEta)}Z</small>`:''}</td><td>${hold}</td><td>${i===0?'—':c?.error?'CHK':fmt(c.fuel*s.surcharge)}</td><td>${s.divertValid?fmt(ceilKg((s.remaining[i]??0)+s.divert+s.recovery+s.reserve)):'DIVERT'}</td><td>${fob}</td><td></td></tr>`;
  }).join('');
  const d1=state.diverts[0]||{},d2=state.diverts[1]||{};
  $('dataCardSheet').innerHTML=`
    <header class="dc-header"><div><h1>EUROFIGHTER IFE | FUEL DATA CARD</h1><p>${uiText('SIMULATION · FUELPLAN / FLUGLOG · kg · NM · ft MSL','SIMULATION · FUEL PLAN / FLIGHT LOG · kg · NM · ft MSL')}</p></div><div class="dc-mark">${escapeHtml(($('callsign').value||p.id).toUpperCase())}</div></header>
    <div class="dc-meta"><div><span>DATE UTC</span><b>${formatUtcDate()}</b></div><div><span>START Z</span><b>${escapeHtml($('startZulu').value||'—')}Z</b></div><div><span>AIRCRAFT</span><b>${escapeHtml(p.id)}</b></div><div><span>CALLSIGN</span><b>${escapeHtml($('callsign').value||'—')}</b></div><div><span>DEPARTURE</span><b>${escapeHtml(dep)} · ${fmt(missionDepElev())} ft</b></div><div><span>ARRIVAL</span><b>${escapeHtml(arr)} · ${fmt(missionArrElev())} ft</b></div></div>
    ${$('missionName')?.value?`<p class="dc-note"><b>${escapeHtml($('missionName').value)} · ${escapeHtml($('missionType')?.value||'')}</b></p>`:''}
    ${$('missionNotes')?.value?`<p class="dc-note">${escapeHtml(displayMachText($('missionNotes').value))}</p>`:''}
    <h2>01 | ${uiText('FUEL ORDER','FUEL ORDER')}</h2><div class="dc-kpis"><div><span>BLOCK REQ</span><strong>${s.routeValid?fmt(ceilKg(s.block))+' kg':'CHECK ROUTE'}</strong></div><div><span>ON BOARD</span><strong>${fmt(onboard)} kg</strong></div><div><span>UPLIFT</span><strong>${fmt(uplift)} kg</strong></div><div><span>T/O REQ</span><strong>${fmt(ceilKg(takeoff))} kg</strong></div></div>
    <p class="dc-note">PLANNED T/O FOB: <b>${fmt(s.plannedTakeoffFob)} kg</b> · START FOB − GROUND</p>
    <h2>02 | BINGO / JOKER</h2><div class="dc-kpis two"><div><span>BINGO ${$('bingoManualToggle').checked?'MANUAL':'AUTO'}</span><strong>${Number.isFinite(s.bingo)?fmt(s.bingo)+' kg':'—'}</strong></div><div><span>JOKER ${$('jokerManualToggle').checked?'MANUAL':'AUTO'}</span><strong>${Number.isFinite(s.joker)?fmt(s.joker)+' kg':'—'}</strong></div></div><p class="dc-note">BINGO REF WP ${String(bingoI+1).padStart(2,'0')} · ${escapeHtml(state.route[bingoI]?.wp||'—')} IN · JOKER @ ${escapeHtml(state.route[jokerI]?.wp||'—')} ${(s.jokerBasis||'in').toUpperCase()} · Joker = selected IN/OUT recovery requirement + briefed margin.</p>
    <h2>03 | ${uiText('DIVERT / RESERVE','DIVERT / RESERVE')}</h2><div class="dc-kpis"><div><span>DIVERT 1</span><strong>${escapeHtml(d1.name||'—')} ${d1.valid?fmt(d1.fuel)+' kg':''}</strong></div><div><span>DIVERT 2</span><strong>${escapeHtml(d2.name||'—')} ${d2.valid?fmt(d2.fuel)+' kg':''}</strong></div><div><span>USED</span><strong>${s.divertValid?escapeHtml(s.divertName)+' '+fmt(s.divert)+' kg':'—'}</strong></div><div><span>ARR RECOV FLOOR</span><strong>${fmt((s.divert||0)+(s.reserve||0)+(s.recovery||0))} kg</strong></div></div>
    <h2>04 | AAR</h2>${s.aar?.enabled?`<div class="dc-aar-ticket"><div class="dc-aar-title">AAR PLAN 01</div><div class="dc-aar-rule"></div><div><span>ARIP</span><b>${escapeHtml(s.aar.ticket?.arip||'—')}</b></div><div><span>ARCP</span><b>${escapeHtml(s.aar.ticket?.arcp||state.route[s.aar.index]?.wp||'—')}</b></div><div><span>ARCT</span><b>${escapeHtml(s.aar.ticket?.arct||'—')}</b></div><div class="dc-aar-space"></div><div><span>ALT</span><b>FL${fmt(s.aar.ticket?.alt||230,0)}</b></div><div><span>SPD</span><b>${fmt(s.aar.ticket?.speed||285,0)} KIAS</b></div><div><span>CONF</span><b>${escapeHtml(s.aar.ticket?.conf||'CLEAN')}</b></div><div><span>TANKER</span><b>${escapeHtml(s.aar.ticket?.tankerType||'—')}</b></div><div><span>CALLSIGN</span><b>${escapeHtml(s.aar.ticket?.tankerCallsign||'—')}</b></div><div><span>FREQ / STATUS</span><b>${escapeHtml(s.aar.ticket?.frequency||'—')}</b></div>${s.aar.ticket?.plannedArct||s.aar.ticket?.plannedOut?`<div><span>ARCT / OUT PLAN</span><b>${escapeHtml(s.aar.ticket?.plannedArct||'—')}Z / ${escapeHtml(s.aar.ticket?.plannedOut||'—')}Z</b></div>`:''}<div class="dc-aar-rule"></div><div><span>FOB IN</span><b>${fmt(s.aar.ticket?.fobIn)} KG</b></div>${s.aar.manualOn?'':`<div><span>TARGET FOB OUT</span><b>${fmt(s.aar.ticket?.target)} KG</b></div>`}<div><span>GROSS ONLOAD</span><b>+${fmt(s.aar.ticket?.onload)} KG</b></div><div><span>TRANSFER RATE</span><b>${Number.isFinite(s.aar.transfer?.rate)?fmt(s.aar.transfer.rate,2)+' KG/MIN':'N/A / RATE REQUIRED'}</b></div><div><span>RATE SOURCE</span><b>${escapeHtml(s.aar.rateSource||'MANUAL')}</b></div><div><span>EST XFER TIME</span><b>${Number.isFinite(s.aar.transfer?.transferTime)?fmt(s.aar.transfer.transferTime,2)+' MIN'+(s.aar.transfer.valid?'':' · CHECK'):'N/A / '+escapeHtml(s.aar.transfer?.status||'RATE REQUIRED')}</b></div><div><span>AAR EVENT</span><b>${fmt(s.aar.duration,1)} MIN</b></div><div><span>FOB AFTER LOAD</span><b>${fmt(s.aar.ticket?.fobAfterLoad)} KG*</b></div><div><span>AAR BURN</span><b>-${fmt(s.aar.ticket?.burn)} KG</b></div><div><span>FOB OUT</span><b>${fmt(s.aar.ticket?.fobOut)} KG</b></div><div><span>AAR OUT</span><b>${escapeHtml(s.aar.ticket?.out||'—')}</b></div><div class="dc-aar-rule"></div><div><span>BINGO 2</span><b>${Number.isFinite(s.aar.ticket?.bingo2)?fmt(s.aar.ticket.bingo2)+' KG':'—'}</b></div><div><span>B2 → RTB</span><b>${escapeHtml(s.aar.ticket?.b2rtb||'—')}</b></div><div><span>BINGO (NO AAR)</span><b>${Number.isFinite(s.aar.ticket?.bingo)?fmt(s.aar.ticket.bingo)+' KG':'—'}</b></div><div><span>JOKER</span><b>${Number.isFinite(s.aar.ticket?.joker)?fmt(s.aar.ticket.joker)+' KG':'—'}</b></div><div><span>JOKER @</span><b>${escapeHtml((s.aar.ticket?.jokerWp||'—')+' '+(s.jokerBasis||'in').toUpperCase())}</b></div><small>SIMULATION ONLY · *FOB AFTER LOAD is accounting only; Known rate: simultaneous transfer/burn followed by orbit burn; peak checked at transfer end. Without rate, transfer time/feasibility unverified.</small></div>`:`<div class="dc-kpis"><div><span>STATUS</span><strong>OFF</strong></div></div>`}
    <h2>05 | ${uiText('FLUGLOG','FLIGHT LOG')}</h2><table class="dc-table"><thead><tr><th>NR</th><th>WAYPOINT</th><th>ALT</th><th>M</th><th>WIND</th><th>LEG NM</th><th>ETE</th><th>WP IN Z</th><th>HOLD / WP OUT</th><th>LEG kg</th><th>RECOV kg</th><th>FOB IN / OUT</th><th>IST kg</th></tr></thead><tbody>${rows}</tbody></table>
    <footer class="dc-footer">Eurofighter IFE Fuel Calculator v1.9.19 · by Verbal · ${uiText('SIMULATION / TESTBUILD · KEIN OFFIZIELLES FLUGDOKUMENT','SIMULATION / TEST BUILD · NOT AN OFFICIAL FLIGHT DOCUMENT')}</footer>`;
}

function openInfo(title,html){$('infoTitle').textContent=title;$('infoBody').innerHTML=html;$('infoOverlay').classList.remove('hidden');$('infoOverlay').setAttribute('aria-hidden','false');}
function closeInfo(){$('infoOverlay').classList.add('hidden');$('infoOverlay').setAttribute('aria-hidden','true');}
function infoRows(rows){return `<div class="info-grid">${rows.map(([a,b,c=''])=>`<div><span>${escapeHtml(a)}</span><strong>${escapeHtml(String(b))}</strong>${c?`<small>${escapeHtml(c)}</small>`:''}</div>`).join('')}</div>`;}
function openWaypointInfo(i){
  const r=state.route[i];if(!r)return;const c=state.calc[i],s=state.summary,cont=(s.remaining?.[i]||0)+s.divert+s.recovery+s.reserve,fob=s.fobAt?.[i];
  const rows=[['WAYPOINT',`WP ${i+1} · ${r.wp||'—'}`],['ALTITUDE',`${fmt(r.alt)} ft`],['MODE',i===0?'START':String(r.mode||'distance').toUpperCase()]];
  if(i>0){rows.push(['LEG DISTANCE',c?.error?'CHECK':`${fmt(c?.distance,1)} NM`],['LEG ETE',c?.error?'CHECK':formatTime(c?.time)],['LEG FUEL',c?.error?'CHECK':`${fmt((c?.fuel||0)*(s.surcharge||1))} kg`],['MACH',displayMach(r.mach)],['WIND COMPONENT',`${fmt(parseNum(r.wind))} kt`],['GROUND SPEED',c?.error?'—':`${fmt(c?.gs)} kt`],['FUEL FLOW',c?.error?'—':`${fmt(c?.ff,1)} kg/min`]);}
  if(r.coordText)rows.push(['COORDINATES (SOURCE)',r.coordText]);
  if(r.plannedEta)rows.push(['ETA PLAN',r.plannedEta+'Z',r.etaOverride?'HARD TIME':'Nominal plan value; no timeline override']);
  if(r.plannedOut)rows.push(['WP OUT PLAN',r.plannedOut+'Z']);
  if(r.note)rows.push(['NOTE',displayMachText(r.note)]);
  if(s.etaAt?.[i]&&s.etaAt[i]!=='—')rows.push(['WP IN / ETA',`${s.etaAt[i]}Z`]);
  if((s.holdAt?.[i]||0)>0){rows.push(['HOLD IN',`${s.etaAt?.[i]||'—'}Z · ${fmt(s.fobInAt?.[i]||0)} kg`],['HOLD',`${fmt(s.holdAt?.[i],1)} min · ${fmt(s.holdFuelAt?.[i]||0)} kg`,`${fmt(s.holdRateAt?.[i]||0,1)} kg/min`],['WP OUT / PUSH',`${s.wpOutAt?.[i]||'—'}Z · ${fmt(s.fobOutAt?.[i]||0)} kg`]);}
  if(state.aar?.enabled&&state.aar.index===i)rows.push(['AAR EVENT',`${fmt(state.aar.accepted)} kg gross`,`${fmt(state.aar.currentFobBefore)} kg IN + ${fmt(state.aar.accepted)} onload - ${fmt(state.aar.durationBurn)} burn → ${fmt(state.aar.fobAfter)} kg OUT`]);
  rows.push(['CONTINUATION REQ',`${fmt(cont)} kg`,'No-AAR contingency'],['FOB IN',Number.isFinite(s.fobInAt?.[i])?`${fmt(s.fobInAt[i])} kg`:'—'],['FOB OUT',Number.isFinite(s.fobOutAt?.[i])?`${fmt(s.fobOutAt[i])} kg`:'—']);
  openInfo(`${r.wp||'WAYPOINT'} · DETAIL`,infoRows(rows));
}
function openSummaryInfo(kind){
  const s=state.summary||{},a=s.aar||{};let title='DETAIL',rows=[];
  if(kind==='block'){title='BLOCK REQUIRED';rows=[['GROUND',`${fmt(s.ground)} kg`],['ROUTE LEGS',`${fmt(s.routeTrip??s.trip)} kg`],['HOLD',`${fmt(s.holdFuel||0)} kg`,`${fmt(s.holdTime||0,1)} min`],['TRIP TOTAL',`${fmt(s.trip)} kg`],['DIVERT',`${fmt(s.divert)} kg`],['MISSED / RECOVERY EXTRA',`${fmt(s.recovery)} kg`],['LANDING RESERVE',`${fmt(s.reserve)} kg`],['NO-AAR BLOCK',`${fmt(s.baseBlock)} kg`],['GROSS AAR ONLOAD',a.enabled?`− ${fmt(a.accepted)} kg`:'OFF'],['AAR DURATION BURN',a.enabled?`+ ${fmt(a.durationBurn)} kg`:'—'],['NET AAR EFFECT',a.enabled?`− ${fmt(a.netGain)} kg`:'—'],['BLOCK REQ (FIXED ONLOAD)',`${fmt(s.block)} kg`],['T/O REQ',`${fmt(ceilKg(s.requiredTakeoff))} kg`],['PLANNED T/O FOB',`${fmt(s.plannedTakeoffFob)} kg`]];}
  else if(kind==='fob'){title='FUEL ON BOARD';rows=[['TANK ON BOARD',`${fmt(parseNum($('tankOnBoard').value))} kg`],['TANK CAPACITY',`${fmt(profile().tankCapacityKg)} kg`],['BLOCK REQUIRED',`${fmt(s.block)} kg`],['SPARE',`${fmt(parseNum($('tankOnBoard').value)-s.block)} kg`]];}
  else if(kind==='spare'){title='SPARE FUEL';rows=[['FOB',`${fmt(parseNum($('tankOnBoard').value))} kg`],['BLOCK REQUIRED',`${fmt(s.block)} kg`],['SPARE',`${fmt(parseNum($('tankOnBoard').value)-s.block)} kg`]];}
  else if(kind==='bingo'){title='BINGO';rows=[['REFERENCE WP',state.route[s.bingoIndex]?.wp||'—'],['ARRIVAL RECOVERY FLOOR',`${fmt(s.arrivalRecoveryFloor||0)} kg`],['REMAINING PLANNED ROUTE',`${fmt(s.remaining?.[s.bingoIndex]||0)} kg`],['DIVERT',`${fmt(s.divert)} kg`],['MISSED / RECOVERY EXTRA',`${fmt(s.recovery)} kg`],['RESERVE',`${fmt(s.reserve)} kg`],['BINGO USED',`${fmt(s.bingo)} kg`,$('bingoManualToggle').checked?'MANUAL':'AUTO'],['EST FOB @ REF',Number.isFinite(s.bingoPredicted)?`${fmt(s.bingoPredicted)} kg`:'—'],['MARGIN',Number.isFinite(s.bingoMargin)?`${s.bingoMargin>=0?'+':''}${fmt(s.bingoMargin)} kg`:'—'],['DEFINITION','POSITION-SPECIFIC','Fuel needed from the selected point to complete planned recovery'],['AAR ASSUMPTION','NO ONLOAD CREDIT','Planned AAR burn is included before the event']];}
  else if(kind==='joker'){title='JOKER';const ji=s.jokerIndex??Math.max(1,state.route.length-2);rows=[['JOKER @',`${state.route[ji]?.wp||'—'} ${(s.jokerBasis||'in').toUpperCase()}`],['REQUIREMENT AT BASIS',`${fmt(s.jokerBase||0)} kg`],['JOKER BUFFER',`${fmt(parseNum($('jokerBuffer').value,795))} kg`],['JOKER USED',`${fmt(s.joker)} kg`,$('jokerManualToggle').checked?'MANUAL':'AUTO'],['EST FOB AT BASIS',Number.isFinite(s.jokerPredicted)?`${fmt(s.jokerPredicted)} kg`:'—'],['MARGIN',Number.isFinite(s.jokerMargin)?`${s.jokerMargin>=0?'+':''}${fmt(s.jokerMargin)} kg`:'—'],['DEFINITION','WP-SPECIFIC',s.jokerBasis==='out'?'After HOLD / PUSH':'Arrival before HOLD']];}
  else if(kind==='divert'){title='DIVERT';rows=[['USED DIVERT',s.divertValid?`${s.divertName} · ${fmt(s.divert)} kg`:'NO VALID DIVERT'],['ARRIVAL ELEVATION',`${fmt(missionArrElev())} ft`],['PROFILE',`${fmt(parseNum($('divertAltitude').value))} ft · M ${fmt(parseNum($('divertMach').value),2)}`],['WIND',`${fmt(parseNum($('divertWind').value))} kt`]];}
  else if(kind==='aar'){title='AAR PLAN';rows=[['STATUS',a.enabled?a.status:'OFF'],['WAYPOINT',a.enabled?state.route[a.index]?.wp||'—':'—'],['FOB IN',a.enabled?`${fmt(a.currentFobBefore)} kg`:'—'],[a.manualOn?'CONTINUATION REQ':'TARGET FOB OUT',a.enabled?`${fmt(a.targetOutFob)} kg`:'—'],['GROSS ONLOAD',a.enabled?`${fmt(a.accepted)} kg`:'—',$('aarManualToggle').checked?'MANUAL':'AUTO'],['FOB AFTER LOAD',a.enabled?`${fmt(a.fobAfterLoad)} kg (accounting)`:'—'],['AAR BURN',a.enabled?`${fmt(a.durationBurn)} kg`:'—'],['FOB OUT',a.enabled?`${fmt(a.fobAfter)} kg`:'—'],['AAR OUT',a.enabled?a.aarOut:'—'],['LANDING FOB',a.enabled&&Number.isFinite(a.landingFob)?`${fmt(a.landingFob)} kg`:'—'],['AAR BURN PROFILE',a.enabled?`FL${fmt(a.aarFl,0)} · ${fmt(a.aarKias,0)} KIAS · M${fmt(a.aarModelMach,2)} model`:'—'],['DETAIL',a.enabled?a.detail:'AAR not planned']];}
  openInfo(title,infoRows(rows));
}

async function clearAllLocalData(){
  const ok=confirm(uiText('Wirklich alle lokal gespeicherten Missionen, Pilot-ID und Einstellungen auf diesem Gerät löschen?','Delete all locally stored missions, Pilot ID and settings on this device?'));
  if(!ok)return;
  localStorage.clear();
  try{if('caches' in window){for(const k of await caches.keys()){if(k.startsWith('vgaf-')||k.startsWith('eurofighter-ife-'))await caches.delete(k);}}}catch{}
  if($('securityMessage'))$('securityMessage').textContent=uiText('Lokale App-Daten wurden gelöscht. Die App wird neu geladen.','Local app data deleted. The app will reload.');
  setTimeout(()=>location.reload(),700);
}

function sanitizeIdent(v,max=32){return String(v??'').toUpperCase().replace(/[^A-Z0-9 ._\/-]/g,'').trim().slice(0,max);}
function sanitizeRoute(raw){
  if(!Array.isArray(raw)) return [];
  return raw.slice(0,40).map((r,i)=>({
    wp:sanitizeIdent(r?.wp||`WP${i+1}`),
    lat:Number.isFinite(parseNum(r?.lat,NaN))?clamp(parseNum(r.lat),-90,90):undefined,
    lon:Number.isFinite(parseNum(r?.lon,NaN))?clamp(parseNum(r.lon),-180,180):undefined,
    alt:clamp(parseNum(r?.alt,0),0,55000),
    mach:i===0?'':r?.mach??'',
    machAutoCorrected:i===0?false:!!r?.machAutoCorrected,
    machOriginal:i===0?undefined:r?.machOriginal,
    wind:clamp(parseNum(r?.wind,0),-300,300),
    mode:r?.mode==='time'?'time':'distance',
    dist:clamp(parseNum(r?.dist,0),0,10000),
    inputTime:clamp(parseNum(r?.inputTime,0),0,1440),
    holdMin:clamp(parseNum(r?.holdMin,0),0,720),
    etaOverride:Number.isFinite(parseZulu(r?.etaOverride))?formatZulu(parseZulu(r?.etaOverride)):'',
    plannedEta:Number.isFinite(parseZulu(r?.plannedEta))?formatZulu(parseZulu(r?.plannedEta)):'',
    plannedOut:Number.isFinite(parseZulu(r?.plannedOut))?formatZulu(parseZulu(r?.plannedOut)):'',
    coordText:String(r?.coordText||'').slice(0,40),
    note:String(r?.note||'').slice(0,240)
  }));
}

const MISSION_FIELD_IDS=window.IFEMissionBackup.FIELD_IDS;
function captureMissionState(){
  const copy=window.IFEMissionBackup.clone;
  const reference=id=>{const value=$(id).value;return value===''?null:Number(value);};
  // Forms are the existing engine's scalar inputs. Route, metadata, profile and
  // navigation come from the actual model, never from rounded route-table text.
  return copy({
    fields:Object.fromEntries(MISSION_FIELD_IDS.map(id=>[id,String($(id)?.value??'')])),
    route:state.route,source:state.source,missionMeta:state.missionMeta,
    toggles:{bingo:$('bingoManualToggle').checked,joker:$('jokerManualToggle').checked,aar:$('aarEnabled').checked,aarManual:$('aarManualToggle').checked},
    references:{bingoWp:reference('bingoWp'),jokerWp:reference('jokerWp'),aarWp:reference('aarWp')},
    holdModel:'level-at-waypoint-v1',
    performance:{modelVersion:window.IFEMissionBackup.MODEL_VERSION,aircraftProfile:profile(),fuelData:activeFuelData()},
    navigation:activeNavigation()
  });
}
function createMissionBackup(){
  recalc();
  const b=window.IFEMissionBackup;
  return b.validate({format:'eurofighter-ife-mission',schemaVersion:b.SCHEMA_VERSION,appVersion:b.APP_VERSION,
    exportedAt:new Date().toISOString(),mission:captureMissionState(),
    calculated:b.clone({informationalOnly:true,summary:state.summary,legs:state.calc,aar:state.aar,diverts:state.diverts})});
}
function backupMessage(text,error=false){
  const el=$('missionBackupStatus');if(el){el.textContent=text;el.className='message'+(error?' backup-error':'');}
}
function restoreMissionState(m){
  const copy=window.IFEMissionBackup.clone;
  state.missionPerformance=copy(m.performance);state.missionNavigation=copy(m.navigation);
  state.selectedAircraft=m.fields.aircraft;state.route=copy(m.route);state.source=m.source;state.missionMeta=copy(m.missionMeta);
  const select=$('aircraft');
  if(![...select.options].some(o=>o.value===m.fields.aircraft)){
    const option=document.createElement('option');option.value=m.fields.aircraft;option.textContent=m.performance.aircraftProfile.name||m.fields.aircraft;select.appendChild(option);
  }
  MISSION_FIELD_IDS.forEach(id=>{$(id).value=m.fields[id];});
  $('bingoManualToggle').checked=m.toggles.bingo;$('jokerManualToggle').checked=m.toggles.joker;
  $('aarEnabled').checked=m.toggles.aar;$('aarManualToggle').checked=m.toggles.aarManual;
  $('bingoManual').disabled=!m.toggles.bingo;$('jokerManual').disabled=!m.toggles.joker;$('aarManualKg').disabled=!m.toggles.aarManual;
  $('missionPreset').value='';$('loadMissionPreset').disabled=true;
  $('missionPresetNote').textContent=displayMachText(m.missionMeta?.basisNote||'');
  $('missionPresetNote').className=m.missionMeta?.basisNote?'hint':'hint hidden';
  $('aarCapacity').value=m.performance.aircraftProfile.tankCapacityKg;
  $('settingsFuelRows').textContent=fmt(m.performance.fuelData.rows.length);
  syncAlternatePreset(1);syncAlternatePreset(2);toggleCruiseMode();renderRoute();
  for(const [id,value] of Object.entries(m.references))$(id).value=value===null?'':String(value);
  recalc();
}
function applyMissionBackup(data){
  const b=window.IFEMissionBackup;data=b.validate(data); // all checks/migrations before any mutation
  const previous=captureMissionState(),oldPerformance=state.missionPerformance,oldNavigation=state.missionNavigation;
  try{restoreMissionState(data.mission);}
  catch(e){
    restoreMissionState(previous);state.missionPerformance=oldPerformance;state.missionNavigation=oldNavigation;
    throw new Error('Import could not be applied; previous mission restored. '+e.message);
  }
  backupMessage('Mission successfully imported');
}
function exportCurrentMission(){
  try{
    document.activeElement?.blur?.(); // commit any pending route edit first
    const data=createMissionBackup(),body=JSON.stringify(data,null,2);
    const blob=new Blob([body],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;
    const name=(data.mission.fields.missionName||data.mission.fields.callsign||'mission').replace(/[^a-z0-9_-]+/gi,'_').slice(0,70);
    link.download=`${name}_${data.mission.fields.missionDate||'undated'}.json`;
    document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    backupMessage(uiText('Missions-JSON zum Download erstellt.','Mission JSON download created.'));
  }catch(e){backupMessage(uiText('Export fehlgeschlagen: ','Export failed: ')+e.message,true);}
}
async function importMissionFile(file){
  if(!file)return;
  try{
    if(file.size>window.IFEMissionBackup.MAX_BYTES)throw new Error('Mission file exceeds 5 MB');
    const data=window.IFEMissionBackup.parse(await file.text());
    applyMissionBackup(data);
  }catch(e){backupMessage(uiText('Import abgewiesen; Mission unverändert: ','Import rejected; mission unchanged: ')+e.message,true);}
  finally{if($('missionImportFile'))$('missionImportFile').value='';}
}
function saveMission(){
  try{
    localStorage.setItem('vgaf_mission_v08',JSON.stringify(createMissionBackup()));
    $('simbriefMessage').textContent=uiText('Mission lokal auf diesem Gerät gespeichert.','Mission saved locally on this device.');
  }catch(e){backupMessage(uiText('Speichern fehlgeschlagen: ','Save failed: ')+e.message,true);}
}

async function applyMissionPayload(p,source='saved'){
  if(p&&Object.prototype.hasOwnProperty.call(p,'schemaVersion'))return applyMissionBackup(p);
  if(!Array.isArray(p?.route)||p.route.length<2)throw new Error('Mission route missing');
  if(p.fields?.aircraft)await selectAircraft(p.fields.aircraft,false);
  clearMissionMetadata();
  state.source=source;
  state.route=sanitizeRoute(p.route);
  Object.entries(p.fields||{}).forEach(([k,v])=>{if(MISSION_FIELD_IDS.includes(k)&&$(k))$(k).value=k==='missionNotes'?displayMachText(v):v;});
  if(p.fields?.aarDuration===undefined)$('aarDuration').value='10';
  if(p.fields?.aarTargetOut===undefined)$('aarTargetOut').value='';
  if(p.fields?.jokerBasis===undefined)$('jokerBasis').value='in';
  state.missionMeta=p.missionMeta?JSON.parse(JSON.stringify(p.missionMeta)):null;
  if(state.missionMeta?.basisNote){$('missionPresetNote').textContent=displayMachText(state.missionMeta.basisNote);$('missionPresetNote').className='hint';}
  $('bingoManualToggle').checked=!!p.toggles?.bingo;$('jokerManualToggle').checked=!!p.toggles?.joker;
  $('bingoManual').disabled=!$('bingoManualToggle').checked;$('jokerManual').disabled=!$('jokerManualToggle').checked;
  $('aarEnabled').checked=!!p.toggles?.aar;$('aarManualToggle').checked=!!p.toggles?.aarManual;$('aarManualKg').disabled=!$('aarManualToggle').checked;
  syncAlternatePreset(1);syncAlternatePreset(2);toggleCruiseMode();renderRoute();
  if(p.bingoWp!==undefined)$('bingoWp').value=p.bingoWp;
  if(p.jokerWp!==undefined)$('jokerWp').value=p.jokerWp;
  if(p.aarWp!==undefined)$('aarWp').value=p.aarWp;
  recalc();
}

async function loadMissionPreset(){
  const id=$('missionPreset')?.value;
  if(!id)return false;
  try{
    const pack=await fetch('data/mission-presets.json',{cache:'no-store'}).then(checkJson);
    const preset=(pack.presets||[]).find(p=>p.missionMeta?.id===id);
    if(!preset)throw new Error('Preset not found');
    await applyMissionPayload(preset,'preset');
    $('missionPreset').value=id;$('loadMissionPreset').disabled=false;
    $('simbriefMessage').textContent=uiText('Optionaler Preset geladen. Lokale Mission-Saves unverändert.','Optional preset loaded. Local mission saves unchanged.');
    return true;
  }catch(e){$('simbriefMessage').textContent=uiText('Preset konnte nicht geladen werden: ','Preset could not be loaded: ')+e.message;return false;}
}

async function loadMission(){
  try{
    const p=JSON.parse(localStorage.getItem('vgaf_mission_v08')||localStorage.getItem('vgaf_mission_v07')||localStorage.getItem('vgaf_mission_v05')||localStorage.getItem('vgaf_mission_v04')||'null'); if(!p)throw new Error('none');
    await applyMissionPayload(p);
    $('simbriefMessage').textContent=uiText('Gespeicherte Mission geladen.','Saved mission loaded.');
  }catch(e){$('simbriefMessage').textContent=uiText('Gespeicherte Mission konnte nicht geladen werden: ','Saved mission could not be loaded: ')+e.message;}
}

async function importSimBrief(){
  const user=$('simbriefUser').value.trim(); if(!user){$('simbriefMessage').textContent=uiText('Bitte Pilot ID oder Navigraph Alias eingeben.','Enter Pilot ID or Navigraph Alias.');return;}
  if(user.length>64 || !/^[A-Za-z0-9._-]+$/.test(user)){$('simbriefMessage').textContent=uiText('Pilot ID / Alias enthält ungültige Zeichen.','Pilot ID / Alias contains invalid characters.');return;}
  localStorage.setItem('ife_pilot',user); $('simbriefState').textContent='LOADING'; $('simbriefState').className='badge'; $('simbriefMessage').textContent=uiText('SimBrief OFP wird geladen …','Loading SimBrief OFP …');
  const isId=/^\d{1,12}$/.test(user), url=`https://www.simbrief.com/api/xml.fetcher.php?${isId?'userid':'username'}=${encodeURIComponent(user)}&json=v2`;
  try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const d=await r.json();applySimBrief(d);$('simbriefState').textContent='IMPORTED';$('simbriefState').className='badge ok';$('simbriefMessage').textContent=uiText('OFP importiert. Datum, Startzeit, Route, Höhe, Mach und Wind bleiben editierbar. ETA-Anker planen zusätzliche Holds mit Verbrauch; NM bleiben unverändert. Ungültige Mach-Werte unter dem Modellbereich werden automatisch auf M0,60 gesetzt und markiert.','OFP imported. Date, start time, route, altitude, Mach and wind remain editable. ETA anchors plan additional holds with fuel burn; NM remain unchanged. Invalid Mach values below the model range are automatically changed to M0.60 and marked.');}
  catch(e){console.error(e);$('simbriefState').textContent='FAILED';$('simbriefState').className='badge bad';$('simbriefMessage').textContent=uiText('Direkter Import fehlgeschlagen: ','Direct import failed: ')+e.message+uiText(' · Für die veröffentlichte Version kann eine kleine Proxy-Funktion nötig sein.',' · A small proxy function may be required for the published version.');}
}
function first(...v){return v.find(x=>x!==undefined&&x!==null&&x!=='');}
function windComponentFromFix(f){
  const explicit=first(f.wind_component,f.wind_comp,f.wind_component_kts,f.wind_component_kts_avg); if(explicit!==undefined)return parseNum(explicit,0);
  const spd=parseNum(first(f.wind_spd,f.wind_speed,f.wind_speed_kts),NaN),dir=parseNum(first(f.wind_dir,f.wind_direction,f.wind_dir_degrees),NaN),course=parseNum(first(f.track_true,f.true_track,f.course_true,f.heading_true),NaN);
  if(Number.isFinite(spd)&&Number.isFinite(dir)&&Number.isFinite(course))return -spd*Math.cos((dir-course)*deg); // + tailwind, − headwind
  return 0;
}
function applySimBrief(d){
  const o=d.origin||{},de=d.destination||{},al=Array.isArray(d.alternate)?d.alternate[0]||{}:d.alternate||{};
  const dep=String(first(o.icao_code,o.icao,'')||'DEP').toUpperCase(),arr=String(first(de.icao_code,de.icao,'')||'ARR').toUpperCase(),alternate=String(first(al.icao_code,al.icao,'')||'').toUpperCase();
  $('departure').value=dep;$('arrival').value=arr;$('alternate1').value=alternate;$('alternate2').value='';
  if($('missionDate'))$('missionDate').value=simbriefMissionDate(d)||$('missionDate').value||currentUtcDateInput();
  const depDb=airport(dep),arrDb=airport(arr); $('depElevation').value=parseNum(first(o.elevation,o.elevation_ft,depDb?.elevationFt),depDb?.elevationFt||0); $('arrElevation').value=parseNum(first(de.elevation,de.elevation_ft,arrDb?.elevationFt),arrDb?.elevationFt||0); syncAlternatePreset(1); syncAlternatePreset(2);
  const fixes=Array.isArray(d.navlog?.fix)?d.navlog.fix:(Array.isArray(d.navlog)?d.navlog:[]), route=[];
  const depObj=airport(dep);route.push({wp:dep,lat:parseNum(first(o.pos_lat,o.latitude,depObj?.lat),depObj?.lat),lon:parseNum(first(o.pos_long,o.longitude,depObj?.lon),depObj?.lon),alt:parseNum(first(o.elevation,o.elevation_ft,depObj?.elevationFt),depObj?.elevationFt||0),mach:'',wind:0,mode:'distance',dist:0,inputTime:0,holdMin:0,etaOverride:''});
  for(const f of fixes){
    const ident=String(first(f.ident,f.name,f.fix_ident,'')||'').toUpperCase(); if(!ident||ident===dep)continue;
    let mach=parseNum(first(f.mach,f.mach_plan,d.general?.cruise_mach),.85);if(mach>2)mach/=100;
    const originalMach=mach, nm=normalizeMachForModel(mach); mach=nm.value;
    const alt=parseNum(first(f.altitude_feet,f.altitude,f.altitude_feet_plan,d.general?.initial_altitude),30000),dist=parseNum(first(f.distance,f.leg_dist,f.distance_nm),0),lat=parseNum(first(f.pos_lat,f.latitude),NaN),lon=parseNum(first(f.pos_long,f.longitude),NaN);
    route.push({wp:ident,lat:Number.isFinite(lat)?lat:undefined,lon:Number.isFinite(lon)?lon:undefined,alt,mach,machAutoCorrected:nm.corrected,machOriginal:nm.corrected?originalMach:undefined,wind:windComponentFromFix(f),mode:'distance',dist,inputTime:0,holdMin:0,etaOverride:''});
  }
  if(route.length===1)throw new Error('Keine Navlog-Waypoints gefunden');
  const arrObj=airport(arr), last=route[route.length-1];
  if(last.wp===arr){last.alt=arrObj?.elevationFt??parseNum(last.alt);last.lat=arrObj?.lat??last.lat;last.lon=arrObj?.lon??last.lon;}
  else{
    const prevPoint={lat:last.lat,lon:last.lon},arrPoint=arrObj||{lat:parseNum(first(de.pos_lat,de.latitude),NaN),lon:parseNum(first(de.pos_long,de.longitude),NaN)};let dist=haversineNM(prevPoint,arrPoint);if(!Number.isFinite(dist))dist=25;
    const arrMachNorm=normalizeMachForModel(parseNum(last.mach,.70));
    route.push({wp:arr,lat:arrPoint.lat,lon:arrPoint.lon,alt:arrObj?.elevationFt??parseNum(first(de.elevation,de.elevation_ft),0),mach:arrMachNorm.value,machAutoCorrected:arrMachNorm.corrected,machOriginal:arrMachNorm.corrected?parseNum(last.mach,.70):undefined,wind:0,mode:'distance',dist,inputTime:0,holdMin:0,etaOverride:''});
  }
  clearMissionMetadata();state.route=route.slice(0,40);state.source='simbrief';renderRoute();useMissionAirportElevations();if($('cruiseDistanceSource'))$('cruiseDistanceSource').value='route';recalc();showView('route');
}


function currentUtcDateInput(){
  const d=new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}
function dateInputFromAny(v){
  if(v===undefined||v===null||v==='')return '';
  const raw=String(v).trim();
  let m=raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if(m)return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
  m=raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if(m)return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
  m=raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if(m)return `${m[1]}-${m[2]}-${m[3]}`;
  const n=Number(raw);
  if(Number.isFinite(n)&&n>100000000){
    const ms=n<100000000000?n*1000:n;
    const d=new Date(ms);
    if(!Number.isNaN(d.getTime()))return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  }
  const d=new Date(raw);
  if(!Number.isNaN(d.getTime()))return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  return '';
}
function simbriefMissionDate(d){
  const candidates=[d?.general?.date,d?.general?.flight_date,d?.params?.flight_date,d?.times?.sched_out,d?.times?.sched_off,d?.times?.est_out,d?.params?.time_generated];
  for(const v of candidates){const q=dateInputFromAny(v);if(q)return q;}
  return currentUtcDateInput();
}
function normalizeMissionDate(){
  if(!$('missionDate'))return;
  const q=dateInputFromAny($('missionDate').value);
  if(q)$('missionDate').value=q;
}
function currentZulu(){return new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'UTC'});}
function parseZulu(v){
  const t=String(v||'').trim().replace(/Z$/i,'').replace(/\s/g,'');
  let h,m;if(/^\d{1,2}:\d{2}$/.test(t)){[h,m]=t.split(':').map(Number);}else if(/^\d{3,4}$/.test(t)){const q=t.padStart(4,'0');h=Number(q.slice(0,2));m=Number(q.slice(2));}else return NaN;
  return h>=0&&h<24&&m>=0&&m<60?h*60+m:NaN;
}
function formatZulu(min){const m=((Math.round(min)%1440)+1440)%1440;return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;}
function normalizeStartZulu(){if(!$('startZulu'))return;const m=parseZulu($('startZulu').value);if(Number.isFinite(m))$('startZulu').value=formatZulu(m);}
function applyLayout(layout){
  const allowed=['ops','efb']; if(!allowed.includes(layout))layout='ops';
  document.documentElement.dataset.layout=layout; localStorage.setItem('ife_layout',layout); if($('layoutSelect'))$('layoutSelect').value=layout;
}

function applyTheme(theme){
  const allowed=['night-cyan','night-white','ops-green','day']; if(!allowed.includes(theme))theme='ops-green';
  document.documentElement.dataset.theme=theme; localStorage.setItem('vgaf_theme',theme); if($('themeSelect'))$('themeSelect').value=theme;
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',theme==='day'?'#e8ece8':'#050807');
}

function formatTime(min){const m=Math.max(0,Math.round(parseNum(min)));return `${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}`;}

toggleCruiseMode();
boot();
