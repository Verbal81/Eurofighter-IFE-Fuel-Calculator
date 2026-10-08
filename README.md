# IFE Eurofighter Fuel Calculator FS2024 v1.9.19

![IFE Eurofighter Fuel Calculator FS2024 app icon](icons/icon.svg)

## 🌐 Open the app

[✈️ Launch IFE Eurofighter Fuel Calculator FS2024](https://ife-eufi-fuelcalc-test.topstoni81.workers.dev/)

[📘 Ausführliche Bedienungsanleitung (PDF, Deutsch)](Eurofighter_IFE_Anleitung_v1.9.19.pdf)

[📘 Full User Guide (PDF, English)](Eurofighter_IFE_User_Guide_v1.9.19_EN.pdf)

[📖 Quick Guide (English)](USER-GUIDE.md)

## v1.9.19 — English default

English is the default language, independent of device language. Explicitly saved language preferences remain available. Fuel, timing, AAR and mission data are unchanged.

## v1.9.18 — Effective transfer rate and transfer time

AAR has an editable **Effective transfer rate (GROSS kg/min)** and an independent **AAR EVENT DURATION**.
No unverified real rate or tanker preset is supplied. Enter a rate explicitly; RATE SOURCE is MANUAL.
The serialized source supports MANUAL / TANKER PRESET / RECEIVER PRESET, including external mission
snapshots carrying that provenance. Editing the numeric rate resets its source to MANUAL.

- No rate: `TRANSFER TIME: N/A / RATE REQUIRED`. Existing fuel arithmetic based on planned event burn
  remains available, explicitly labelled as unverified transfer feasibility. No numeric transfer time is inferred.
- MANUAL: `t = gross / rate`; transfer burn `flow × t`.
- AUTO, transfer only: `t = max(0, target − IN) / (rate − flow)`.
- AUTO with a longer fixed event D: `gross = max(0, target − IN + flow × D)` and `t = gross / rate`.
  This preserves TARGET FOB OUT as the fuel state at the end of the entire event.
- Total burn = transfer burn + `flow × (D − t)` for extra event time. Same altitude/speed/configuration
  and mission surcharge as the existing AAR receiver-flow model.
- Assumed phase order: transfer first, remaining event time as orbit afterward. Tank capacity is checked
  at IN, transfer end (peak), and OUT. An otherwise feasible later-transfer schedule is not silently substituted.
- Rate <= receiver flow: no valid transfer time. Too short event: required time shown with CHECK,
  no feasible FOB OUT or downstream fuel state, event duration not automatically extended.
- No route distances, coordinates, mission input fuel or preset onload changed.

Bon and printable data card include TRANSFER RATE, RATE SOURCE, EST XFER TIME and AAR EVENT between
GROSS ONLOAD and AAR BURN. Full JSON/local saves now use **schemaVersion 2**, model `ife-forward-transfer-2`.
Schema 1 (`ife-forward-1`) migrates by adding only empty rate + MANUAL source. New schema 2 files must
contain both fields. Existing saved files are not rewritten on load.

Validation: **9 new AAR transfer regression groups**, the existing **15 regressions**, **10 backup groups**
and route interaction tests. Test rates are synthetic, not published tanker calibration. No real-device PDF
rendering check. Run `node tests/aar-transfer.cjs` alongside the existing scripts.

## v1.9.17 — Complete mission backup and route editing (historical)

**MISSION → EXPORT CURRENT MISSION / IMPORT MISSION** saves/loads a portable `.json` file.
The file uses `format: "eurofighter-ife-mission"`, `schemaVersion: 1`, `appVersion: "1.9.17"`.
See [MISSION-JSON.md](MISSION-JSON.md) for fields, validation, local storage and model compatibility.

The export includes current scalar inputs AND the exact internal route, metadata, active aircraft
profile, fuel-flow data and navigation data. Computed outputs are reference snapshots only;
import always recalculates. No network request or browser-save overwrite is required to import.
New `SAVE LOCAL` saves use the same complete envelope. Existing legacy save keys/loaders remain.

Route order: **WP → ALT ft → MACH → time/ETA Z → NM → HOLD/WP OUT → remaining fields**.
Touch/tablet route cards open and close by tapping the full waypoint name. Editing commits on
Enter or leaving the field; untouched rounded displays preserve exact internal values.

Validation: 15 previous regressions; 10 backup test groups including full reset/roundtrip,
changed target-device models, malformed/missing data, ignored calculated snapshots, file handlers
and 52-waypoint preservation; route DOM interaction checks. No real-device rendering test.
Run `node tests/regression.cjs`, `node tests/mission-backup.cjs`, `node tests/route-editing.cjs`.
The original uploaded v1.9.15 is the base. Fuel equations, all bundled data and optional preset
are unchanged. Boot still loads the demo. No automatic mission corrections were added.

## v1.9.15 — Display precision only

Mach values in the route editor, waypoint details, plan notes and printable data card use at most two decimal places (0.72 / 0.58). Route calculation and save/load retain the exact internal values. An untouched rounded input never writes back to the route model; only explicit input edits commit. Fuel, timing, preset data and the calculation core are unchanged. The preset remains optional and the default/demo is unchanged. All 15 focused checks pass, including actual route-render/change and PDF-card markup checks plus exact fuel/timing equality across rendering and save/load.

## v1.9.14 — Preset-only fuel-state and timing correction

The optional RHINE SENTINELLE preset now uses the supplied briefing fuel requirements: **ETAD 1119 kg, ETNN 1253 kg (USED), reserve 600 kg, Joker buffer 795 kg, AUTO Bingo at Arrival 1853 kg**. These are explicitly marked `PRESET FUEL · ETE MODEL`, not inferred from the older FL300 default profile. This preset-only override applies to the matching arrival/alternate and is cleared with the preset metadata when starting a demo/new mission. Other missions retain their existing calculation. The AAR/Hold/Joker calculation core is byte-for-byte unchanged from v1.9.13.

Authorized pre-target planning adjustments, visible in the preset note and waypoint details:

| Input | Original | Planned |
| --- | ---: | ---: |
| Leg to RP ANGIE | M0.65 | M0.724209185211 |
| Leg to IP | M0.55 | M0.582383733703 |
| S-PUSH hold | 17 min | 16.736402166549 min (16:44.184) |

These are speed/hold input adjustments, not ETA overrides or fabricated distances. All coordinates, leg NM, altitudes, winds and waypoint order remain unchanged. TOT remains the only hard-time anchor. The existing hard-time warning is exercised by reverting IP to its original speed in the regression test. Original/planned inputs are retained in `missionMeta.planningAdjustments`.

Control results: **Bingo 1853 kg; Joker IN 6449 kg; ETNN 1253 kg; reserve 600 kg.** Joker is recalculated from the adjusted mission (9 kg below the approximate original 6458-kg reference); the 795-kg buffer remains unchanged.

Timing: **RP ANGIE 17:50:00Z; AAR OUT 18:00:00Z; S-PUSH IN 18:13:16Z / OUT 18:30:00Z; TGT 18:50:00Z; landing 19:39:58Z.** The fresh preset has no hard-time conflict. Full results: `verification/rhine-sentinelle-calculation.json`.

**14 regression checks pass.** Preset remains explicitly selected/loaded; demo/startup and user saves remain intact. Earlier release notes below describe the earlier versions and are superseded by this section.

## v1.9.13 — Optional RHINE SENTINELLE preset (historical)

Select **RHINE SENTINELLE – GHOST – 10.10.2026** under **MISSION → Optional mission preset**, then press **LOAD PRESET / PRESET LADEN**. Selection alone does not change the active mission. Boot still loads the original demo; the existing demo route and defaults remain. Preset loading never writes the local mission save.

- The supplied 26-waypoint plan is in `data/mission-presets.json`. Mission/type/date/callsign, all coordinates, leg NM, altitudes, Mach, winds, planned times, notes and fuel settings are retained. DMS coordinates are converted arithmetically to decimal degrees; ETSN coordinates use the existing nav database, with the supplied 1249-ft endpoint elevations. MEXIT is retained.
- **Only TGT-SUIP 18:50Z is a hard-time anchor.** The other supplied times are labelled PLAN and do not override the computed timeline. S-PUSH retains its entered 17-minute MVFR hold and nominal 18:30Z GO.
- **One AAR event** is applied after RP ANGIE: 10 minutes, FL210, 280 KIAS, 3 BAGS, MANUAL gross 966 kg. The AAR EVENT and AAR OUT route markers retain their supplied 0.1-NM legs, coordinates, Mach and wind; neither adds another 10-minute hold. Their small travel time/burn remains part of the route.
- Tanker KC-30M (A332MRTT), callsign MMF15, frequency `118.680 MHz TBC / provisional`, ARIP NOT DEFINED and nominal ARCT/OUT are retained. Frequency, AAR speed, onload and all other mission inputs remain editable and survive explicit save/load.
- Joker is S-PUSH IN with 795-kg buffer. Bingo is AUTO at Arrival. Bingo 2 is separately 1953 kg / ETNN. **Used divert is explicitly DIVERT 2 / ETNN**. Other missions retain the existing AUTO higher-requirement selection unless changed.
- Values not newly specified in the supplied mission use the existing app basis, explicitly shown after loading: **taxi 8 min (128 kg), surcharge 0%, recovery extra 0 kg, divert FL300/M0.85/wind 0, database distances**. No new performance values or distances are estimated. Expected Joker/Bingo/divert values are comparison references, not constraints that alter fuel inputs.
- Save schema 16 extends existing saves with mission/tanker fields, nominal time annotations and provenance. Old save keys/fallbacks remain. The preset's 966 kg exists only in its data file, not as an engine default. The v1.9.12 calculation core is retained.

### Preset calculation

The original v1.9.13 late-TOT/default-divert report is superseded by v1.9.14 above. Current full results are in `verification/rhine-sentinelle-calculation.json`.

### Focused verification

Run `node tests/regression.cjs`; append `--write-report` to regenerate the supplied calculation JSON. **14 targeted checks pass**: the 10 requested logic cases, save/profile checks, and explicit preset/load/edit/persistence checks. The existing ten scenarios use a synthetic route; the additional preset checks use the complete supplied mission. Actual calculation, save/load, loader and data-card functions run in a minimal DOM. A graphical browser rendering check was unavailable in this environment.

## v1.9.12 — Fuel / AAR / Hold / Joker correction

- Start FOB remains an input. Required block / **T/O REQ** and **PLANNED T/O FOB = Start FOB − ground fuel** are separate.
- MANUAL: `FOB OUT = FOB IN + exact entered gross onload − AAR burn`. An infeasible manual request is flagged, never silently reduced. Invalid/unreachable fuel states stop propagation instead of becoming zero or a fictional valid landing state.
- AUTO: `gross = max(0, target OUT − IN + burn)`. The optional target field defaults to the continuation requirement when empty. It is ignored in MANUAL; manual receipts show no AUTO target.
- Capacity model: constant simultaneous transfer/burn, so physical FOB is linear from IN to OUT. `gross capacity = tank capacity − FOB IN + event burn`; both physical endpoints must be in range. **FOB AFTER LOAD is always an accounting sum**, including values above tank capacity. A zero-duration event is an instantaneous accounting transfer with zero burn; no tanker transfer-rate calibration is assumed.
- AAR burn uses altitude, KIAS→Mach, the active calibrated configuration, fuel flow, duration and the entered surcharge. The bundled active calibration is **3 BAGS**. CLEAN has no active calibration and is reported as **AAR PROFILE** for a positive duration. Provisional measurements are unchanged and remain inactive; speeds are no longer silently clamped to another Mach.
- Hold IN/OUT fuel and time are propagated separately. AAR is applied first, then any hold at the same waypoint. No hold/AAR timing edit changes route geometry or leg distance.
- Hard-time ETA inputs now add an explicit computed hold before the anchor (prefer an already planned hold waypoint). This added time burns fuel and appears in HOLD totals; stored hold inputs stay unchanged. An earlier, unreachable anchor is flagged without moving the aircraft forward in time or changing distance/speed. Remove the anchor to remove its computed hold. Old ETA anchors remain stored, but their newly accounted waiting fuel can change results.
- Joker IN includes the selected hold; Joker OUT excludes it exactly once. AAR event burn at the selected waypoint is likewise excluded at OUT. Requirements do not credit future onload; remaining planned event burn counts. Bingo at Arrival is the recovery floor. Bingo 2/RTB remain independent.
- Saved waypoint labels retain spaces, saved Mach is no longer rewritten while loading/saving, and recalculation preserves supplied endpoint coordinates. Existing local save keys and fallback loading remain intact; schema 15 adds only the optional AAR target. Nothing automatically saves or overwrites a mission. Fresh launch still calls the existing `loadDemo()`.
- `sw.js` cache and entry asset versions are bumped so a deployed update requests the corrected code. Fuel/performance/nav datasets and styling are unchanged.

Earlier notes below are historical; v1.9.12/v1.9.13 behavior above supersedes prior ETA and fuel labels.

Bilingual DE/EN mobile-ready simulator build based on the verified v1.4 calculation core and v1.5 mobile/privacy structure.

## New in v1.6 – international divert search
- International military / joint-use air-base catalogue added to the existing German aerodrome data.
- 129 curated international entries covering USA (including Alaska), Canada, UK, France and a broad European/NATO selection.
- Search by ICAO, air-base name, city or country.
- Country filter, favorites and recently used air bases.
- Selecting a known air base automatically supplies its stored coordinates/elevation; divert distance is calculated from Arrival as before.
- Manual ICAO, distance and elevation remain available for any missing or special case.
- Search is fully local/offline; search terms are not transmitted.
- The bundled list is intentionally not claimed to be exhaustive and does not check current operational availability.

## Data approach
The bundled international subset uses the MIT-licensed `airportsdata` location dataset as the redistributable baseline. That project states that new contributions are checked against national AIP/equivalent, ARINC, IATA or ch-aviation sources, while also warning that accuracy cannot be guaranteed. Official references are retained in the bundled records where applicable (e.g. FAA NASR, NATS UK AIP, French DIRCAM MILAIP, NAV CANADA CFS reference). NAV CANADA proprietary CFS data is not redistributed.

## Existing features
- PWA/web build (Cloudflare Pages compatible)
- German / English language selection; device language used on first start
- OPS GREEN default theme plus Night Cyan, Night White and Day High Contrast
- Security & Privacy section and one-click local-data deletion
- SimBrief import remains user-triggered only
- Local calculation and local mission storage

## Security design
- No advertising, analytics or tracking SDKs
- No camera, microphone, location, payment or USB permission
- CSP restricts scripts/styles/images to the app and network connections to the app origin + SimBrief
- No passwords stored
- Cross-origin SimBrief responses are never cached by the service worker
- Air-base search uses only bundled local data and performs no network lookup

Simulation/test build. Not an official flight document and not for real-world operational planning.


## v1.7 preview
- Selectable interface layout: existing OPS layout or PROFESSIONAL EFB.
- Layout switch is presentation-only; calculation functions and performance data are unchanged from v1.6.
- Added provisional receiver-side AAR measurements from 2026-10-03 as a separate calibration dataset.
- Provisional AAR measurements are not active in calculation outputs yet; final calibration waits for the remaining test runs.


## v1.8 Operational EFB refresh
- PROFESSIONAL EFB renamed to OPERATIONAL EFB and visually rebuilt as a restrained monochrome/graphite EFB-style interface.
- Navigation stays horizontal on desktop, tablet and mobile; no game-like hero imagery or decorative cockpit graphics.
- Monospace working-data presentation, flatter tables, compact AAR worksheet and monochrome paper-style Data Card.
- Header shows the current AIRAC calendar cycle plus `LOCAL NAVDATA`. This is a cycle/date indicator only and does not claim that the bundled local database is AIRAC-certified or synchronized to that cycle.
- Current provisional AAR measurements remain bundled but are not activated in calculations until the remaining calibration runs are supplied.
- Calculation functions and performance datasets remain unchanged from v1.7.


## v1.9 Theme fix
- OPERATIONAL · EFB now honors NIGHT · CYAN, NIGHT · WHITE, OPS · GREEN and DAY · HIGH CONTRAST.
- Data Card stays deliberately monochrome for consistent readability and printing.
- No calculation or dataset changes.


## v1.9.1
- OPERATIONAL EFB is the default interface for fresh installs.
- AAR receipt is permanently visible in the right column on tablet/desktop.
- Dedicated PRINT / SAVE PDF prints only the AAR receipt.
- No calculation functions or performance data changed.


## v1.9.2
- Independent Joker checkpoint selector.
- Bingo reference and Joker checkpoint are stored separately.
- Joker AUTO = recovery requirement at selected Joker WP + Joker margin.
- Route table marks AAR, JOKER and BINGO reference points independently.
- Existing route/fuel-flow/divert/AAR core calculations unchanged.

## v1.9.3
- Fixes stale JavaScript delivery: `index.html` now requests the matching v1.9.3 assets instead of the old v1.7.0 script URLs.
- Service worker cache bumped to v1.9.3 and update checks bypass the HTTP cache.
- AAR receipt now shows BINGO 2, B2 → RTB, BINGO (no-AAR contingency), JOKER and JOKER waypoint.
- Printing the AAR receipt forces a fresh synchronous recalculation before opening the print dialog.
- No performance/fuel-flow datasets changed.



## v1.9.4
- Adds an editable Mission date (UTC) field. SimBrief import fills it from the OFP when a usable date/timestamp is available, but the field remains editable afterwards.
- Data Card DATE UTC now uses the mission date instead of the device's current date.
- Route NM and MIN fields are both directly editable on every leg. Focusing/editing NM selects DIST mode; focusing/editing MIN selects TIME mode.
- In DIST mode the MIN field shows the calculated leg time as a placeholder; in TIME mode the NM field shows the calculated distance as a placeholder.
- Local mission save/load now includes the mission date.
- Service worker/cache and asset query versions bumped to v1.9.4.
- No fuel-flow/performance datasets changed.


## v1.9.5

- Fixed route-time editing after SimBrief import on tablet/mobile.
- In DIST mode, the calculated leg minutes are now shown as an actual editable value in **MIN EDIT** instead of only as a placeholder.
- Editing **MIN EDIT** automatically switches that leg to **TIME** mode and recalculates distance/fuel.
- **ETA Z EDIT** is now directly editable. Changing an ETA converts the affected leg to TIME mode using the previous waypoint ETA as the reference; downstream ETAs update automatically.
- Departure ETA editing updates Mission Start Z.
- Service worker/cache and asset query versions bumped to v1.9.5.


## v1.9.6

- Added editable **AAR duration / delay (min)**, default 10 min.
- AAR duration is a separate timeline block: it shifts all downstream ETA Z values and total mission ETE without falsifying leg Mach, distance or leg ETE.
- AAR receipt/Data Card now show **AAR DURATION** and **AAR OUT**.
- AAR duration is stored in local mission save/load. No extra AAR fuel burn is assumed automatically.
- Intermediate route waypoints can now be moved with touch-friendly **↑ / ↓** controls; departure and arrival remain fixed.
- Bingo, Joker and AAR selections follow the same waypoint when it is moved.
- For moved DIST legs, geographic leg distances are refreshed automatically when coordinates are available.
- Service worker/cache and asset query versions bumped to v1.9.6.


## v1.9.7

- Added editable **HOLD MIN** to every intermediate route waypoint.
- A HOLD is a separate timeline block at the selected waypoint: it shifts every downstream **ETA Z** and the total mission ETE without changing leg Mach, leg distance or leg ETE.
- The route table shows the computed **OUT hh:mmZ** below a non-zero HOLD value, so e.g. arrival 18:10Z + HOLD 20 gives OUT 18:30Z.
- ETA Z editing now accounts for HOLD at the previous waypoint as well as AAR duration.
- HOLD values follow the waypoint when it is moved and are stored in local mission save/load.
- The Data Card flight log now includes a **HOLD** column.
- No additional HOLD fuel burn is assumed automatically; HOLD currently changes the timeline only.
- Service worker/cache and asset query versions bumped to v1.9.7.


## v1.9.8

- Fixed manual **ETA Z EDIT** so typing a target ETA no longer converts the leg to TIME mode or changes leg minutes/distance.
- Manual ETA is now a **schedule-only anchor**. It may shift that waypoint and all downstream ETA values, but leaves NM, Mach, physical leg ETE and fuel calculation untouched.
- SimBrief-imported route geometry and fuel math therefore remain unchanged when the user edits only ETA Z.
- Clearing a manual ETA field returns that waypoint to automatic ETA calculation.
- Manual ETA anchors stay attached to their waypoint when the waypoint is moved and are saved/loaded locally.
- Route table marks ETA values as **AUTO** or **MANUAL ±Xm** so the timeline adjustment is visible.
- Total displayed mission ETE follows the resulting timeline; physical routeTime remains separate internally for calculation integrity.
- Service worker/cache and asset query versions bumped to v1.9.8.


## v1.9.11

- **HOLD MIN now burns fuel.** Hold fuel uses the same level fuel-flow model as the route at the hold waypoint's altitude and Mach, including the normal mission surcharge.
- Hold fuel is included in trip fuel, required block, continuation/recovery requirements, Bingo/Joker calculations, AAR fuel-to-point where applicable, and downstream FOB estimates.
- The route HOLD cell now shows calculated hold fuel next to the OUT time; the Data Card HOLD column shows minutes and kg.
- Mach fields are now edit-safe: temporary values while typing are not auto-corrected. Validation / the existing low-Mach correction happens only when the field is committed (blur/change/Enter).
- This fixes the case where deleting the `6` from `0,60` immediately forced the value back before another Mach could be typed.
- Service worker/cache and asset query versions bumped to v1.9.11.


## v1.9.11 — AAR gross-onload / duration-burn logic
- AUTO AAR now uses: `Required Onload = Target AAR-OUT FOB - FOB IN + AAR-duration burn`.
- Target AAR-OUT FOB is the continuation requirement after the selected AAR waypoint (remaining mission + divert/recovery + reserve).
- AAR-duration burn is the receiver's own fuel consumption during the entered AAR duration, calculated with the active fuel-flow model from AAR altitude and KIAS (KIAS converted to approximate Mach using ISA pressure).
- Gross onload and receiver burn are separated: `FOB OUT = FOB IN + gross onload - AAR-duration burn`.
- The AAR ticket now shows REQ ONLOAD, AAR BURN and NET GAIN separately.
- Mission FOB after the AAR waypoint now applies gross onload minus AAR-duration burn.
- Existing route, hold, Mach editing, Bingo/Joker, Divert and fuel-flow datasets are otherwise unchanged.


## v1.9.11 — AAR fuel-state clarity / HOLD IN-OUT / Joker basis
- TARGET FOB is explicitly TARGET FOB OUT (actual receiver fuel at end of AAR).
- AUTO: Gross Onload = Target FOB OUT + AAR burn - FOB IN, subject to tank capacity during simultaneous transfer/burn.
- MANUAL gross onload is fixed and no longer back-solves/replaces the user's Mission Tank-On-Board value.
- Displays FOB IN, Gross Onload, FOB AFTER LOAD (accounting), AAR Burn, FOB OUT and AAR OUT time separately.
- Actual fuel path now stores WP IN and WP OUT states. HOLD consumes fuel and changes time, never leg distance.
- HOLD waypoints show IN/OUT time and fuel; Data Card does the same.
- Joker basis can be selected as WP IN (before HOLD) or WP OUT (after HOLD/PUSH). Old saved plans migrate to WP IN, matching prior behavior.
- Saved mission schema bumped to v14; old plans remain loadable.
- Added standalone regression tests under tests/regression-v1.9.11.js.
