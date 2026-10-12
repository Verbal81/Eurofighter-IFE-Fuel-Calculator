# IFE Eurofighter Fuel Calculator FS2024 — User Guide
Version 1.9.23 · English · 12 October 2026

## Open the app and receive updates

**Use the [official web app](https://ife-eufi-fuelcalc-test.topstoni81.workers.dev/).**
Bookmark it or use your browser's **Add to Home Screen / Install app** action.
This installs the official web app (PWA), which continues to use the official address.
A downloaded GitHub ZIP/HTML package is a separate copy and does not replace itself.

From v1.9.23, the app checks the public GitHub version file on opening, on reconnection,
and at most hourly when returning to the app. SETTINGS → **CHECK FOR UPDATES** runs
an immediate check. Failed/offline checks are reported, never labelled up to date.
No mission data or Pilot ID is transmitted with version checks.

- **Official app/PWA:** a newer release offers **UPDATE NOW**. The current mission is
  secured in this tab's session storage before reload, then restored. The saved local
  mission slot is not overwritten. No forced reload during planning.
- **Downloaded/self-hosted copy:** export your mission JSON, choose **OPEN LATEST APP**,
  then import the JSON in the official app. Browsers cannot overwrite local source files.
- **Older copies:** v1.9.22 and earlier do not include this check. Switch to the official
  address or obtain v1.9.23+ once.
- **Restore failure:** retain the tab and use **DOWNLOAD RECOVERY JSON**. An independent
  mission JSON backup is still recommended. Restoration retains archived performance data.

Current PDF editions: [English](Eurofighter_IFE_User_Guide_EN.pdf) ·
[Deutsch](Eurofighter_IFE_Anleitung.pdf). These links are also in SETTINGS.
Downloaded PDFs are snapshots; use these links for the current edition.

## Mission and route

English is the default; SETTINGS can restore/change a saved language choice. Enter
mission identification, UTC date/start, aircraft, callsign, departure/arrival, start
fuel, taxi time and reserve. Start fuel is an input and is never back-calculated.
SimBrief imports the latest OFP using a Pilot ID/alias. Review imported values.
The demo remains the default; RHINE SENTINELLE is only loaded explicitly.

Route order: **WP → ALT ft → Mach → ETA Z → NM → HOLD / WP OUT**, then remaining fields.
Tablet cards start expanded; tap the waypoint title to collapse/expand. Commit edits
with Enter or by leaving the field. Mach displays at most two decimals while internal
precision is retained. Editing NM selects DIST; explicit leg-minute editing selects TIME.
Holds/AAR/hard-time changes do not alter leg NM or coordinates. Review timing conflicts.

## Fuel, cruise and recovery

T/O REQ is the required minimum; PLANNED T/O FOB is actual planned fuel after ground burn.
CRUISE provides distance/time planning with route, direct or manual distance inputs.
Holds have separate WP IN/OUT times and fuel states. Joker WP IN includes the selected
hold; WP OUT excludes it. Bingo is position-dependent. Plan diverts, Used Divert,
Recovery Extra, Landing Reserve, Joker Buffer and optional manual thresholds separately.

## AAR

Set waypoint, FL, KIAS, configuration, event duration and AUTO target/manual gross onload.
**A330 MRTT is fixed. AUTO is the default rate mode.** No S1–S6 selection is needed.
Receiver fuel flow follows the flight condition automatically. Gross transfer rates
are derived from measured net fuel gain plus modeled receiver burn. Individual fuel
bands are integrated; the displayed effective rate may differ from an Excel whole-run mean.

Comparable profiles are interpolated within measured coverage. Reference/fuel-band
estimates are labelled. 3 BAGS currently has one measured flight condition (FL230/285 KIAS).
CLEAN receiver burn uses the existing 3-BAGS model as an explicit approximation.
MANUAL is an optional rate override; manual gross onload remains exact in either rate mode.

TRANSFER TIME is time transferring fuel. AAR EVENT includes additional orbit/delay burn.
AUTO target is fuel at the end of the entire event. Zero onload may be correct.
Missing usable rate stays N/A / RATE REQUIRED. Rate ≤ receiver flow, insufficient event
time and tank-capacity violations are flagged; inputs are not silently adjusted.
FOB AFTER LOAD is accounting only. The modeled sequence is transfer, then orbit.

## Save, export, import and print

MISSION → EXPORT CURRENT MISSION creates the complete JSON backup from internal inputs,
including route/coordinates, exact values, holds, AAR, thresholds, diverts and the active
performance/navigation snapshots. IMPORT MISSION validates and recalculates it.
Schema 3 includes automatic rate mode and measurement data. Schema 1/2 migration keeps
explicit rates manual; blank legacy rates adopt AUTO. Unsupported versions are rejected.
SAVE LOCAL / LOAD LOCAL use this device/browser's local slot. Cross-device/origin transfer
requires JSON. Neither printouts nor PDFs are complete importable mission backups.

DATA CARD and the AAR ticket offer PRINT / SAVE PDF. Check warnings before sharing.
Offline use requires a successful prior online load and browser cache support.

Simulation only: IndiaFoxtEcho Eurofighter, tested with MSFS 2024. This is a simulator
model using measured data and identified approximations, not real-world performance approval.
