from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, Image
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pathlib import Path
F='/usr/share/fonts/truetype/dejavu/'
for n,f in [('Body','DejaVuSans.ttf'),('Bold','DejaVuSans-Bold.ttf'),('Mono','DejaVuSansMono.ttf')]:pdfmetrics.registerFont(TTFont(n,F+f))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='Bold',italic='Body',boldItalic='Bold')
INK=HexColor('#24302e'); OLIVE=HexColor('#54624b'); MUTED=HexColor('#64706b'); PALE=HexColor('#edf0ea'); LINE=HexColor('#ccd3c9'); AMBER=HexColor('#8b6c32')
styles={
'body':ParagraphStyle('body',fontName='Body',fontSize=9.5,leading=13,textColor=INK,spaceAfter=6),
'small':ParagraphStyle('small',fontName='Body',fontSize=8.5,leading=12,textColor=MUTED,spaceAfter=6),
'h1':ParagraphStyle('h1',fontName='Bold',fontSize=25,leading=29,textColor=INK,spaceAfter=11),
'hero':ParagraphStyle('hero',fontName='Bold',fontSize=32,leading=37,textColor=INK,spaceAfter=16),
'h2':ParagraphStyle('h2',fontName='Bold',fontSize=11.5,leading=15,textColor=OLIVE,spaceBefore=9,spaceAfter=5),
'deck':ParagraphStyle('deck',fontName='Body',fontSize=10.5,leading=15,textColor=MUTED,spaceAfter=12),
'cell':ParagraphStyle('cell',fontName='Body',fontSize=8.8,leading=12,textColor=INK),
'headcell':ParagraphStyle('headcell',fontName='Bold',fontSize=8.5,leading=12,textColor=white),
'formula':ParagraphStyle('formula',fontName='Mono',fontSize=9,leading=14,textColor=INK,spaceAfter=4)
}
S=[]
def P(t,sty='body'):return Paragraph(t,styles[sty])
def p(t,sty='body'):S.append(P(t,sty))
def h(t):p(t,'h2')
def table(rows,widths,heads=None):
 data=[]
 if heads:data.append([P(x,'headcell') for x in heads])
 data += [[P(str(x),'cell') for x in row] for row in rows]
 t=Table(data,colWidths=widths,hAlign='LEFT');cmd=[('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),('LINEBELOW',(0,0),(-1,-1),.4,LINE)]
 if heads:cmd += [('BACKGROUND',(0,0),(-1,0),OLIVE)]
 for i in range(1 if heads else 0,len(data)):
  if i%2==0:cmd.append(('BACKGROUND',(0,i),(-1,i),PALE))
 t.setStyle(TableStyle(cmd));S.append(t);S.append(Spacer(1,9))
def box(title,text):
 t=Table([[P(title,'h2')],[P(text)]],colWidths=[499]);t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),PALE),('LINEBEFORE',(0,0),(0,-1),3,OLIVE),('LEFTPADDING',(0,0),(-1,-1),13),('RIGHTPADDING',(0,0),(-1,-1),13),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),6)]));S.append(t)
def page(num,title,deck):
 if S:S.append(PageBreak())
 p(f'{num:02d} / SECTION','small');p(title,'h1');p(deck,'deck')
def formula(t):p(t,'formula')
p('USER GUIDE / EDITION 12 OCTOBER 2026','small')
p('EUROFIGHTER IFE<br/>FUEL CALCULATOR','hero')
p('Operating guide and capability overview<br/><b>Version 1.9.23</b> | Simulator mission planning','deck')
box('Purpose','Plan a mission from initial inputs to a printable Data Card: route, timing, fuel, holds, AAR, diverts and fuel thresholds. Save the complete current plan as JSON and restore it on another device.')
h('Capabilities at a glance')
table([
('MISSION / ROUTE','Mission details, SimBrief import, waypoint editor and vertical route profile.','02'),
('FUEL / CRUISE','Forward calculation from entered start fuel; separate cruise calculator.','03'),
('TIMING / RECOVERY','Hard times, holds, WP IN/OUT, Joker, Bingo and two diverts.','04'),
('AAR','AUTO/MANUAL, gross onload, transfer rate, transfer time and event burn.','05'),
('BACKUP / RESTORE','Complete JSON export/import and local mission storage.','06'),
('OUTPUT / INTERFACE','Data Card, AAR ticket, tablet controls, language and appearance.','07'),
('WORKFLOW / LIMITS','Planning sequence, model limitations, validation and terminology.','08'),
('ONLINE / UPDATES','Open the web app, check versions and update safely.','09')
],[125,339,35],['AREA','CAPABILITY','P.'])
p('Document scope: a practical product and operating overview. This is not an official flight document or military regulation. It describes implemented features in this software version, not planned extensions.','small')
h('Open the current app')
p('<link href="https://ife-eufi-fuelcalc-test.topstoni81.workers.dev/" color="#54624b">ife-eufi-fuelcalc-test.topstoni81.workers.dev</link><br/>Bookmark or install this web app to the home screen. ZIP/HTML downloads are separate copies. Update guidance: page 9.','small')
page(2,'Mission and route','Create, import and edit a plan while retaining control of its inputs.')
h('Mission setup')
p('Enter Mission Name, Mission Type, UTC date, Start Z, Aircraft, Callsign, Departure/Arrival, airfield elevations and mission notes. Start fuel, taxi time, reserve and a fuel consumption surcharge are editable. Airfield elevations can be taken from the local database or entered manually.')
table([
('NEW MANUAL MISSION','Start a manual plan with editable intermediate waypoints.'),
('LOAD DEMO','Load the existing demonstration route with DIST/TIME legs and two diverts. The app still starts with the demo.'),
('SIMBRIEF','Import the latest OFP using a Pilot ID or alias. Imported data include date, route, coordinates, altitudes, Mach and wind. Planning values remain editable afterwards.'),
('LOAD PRESET','Explicitly load a separately offered mission preset. Selecting a preset in the list alone does not change the active mission.')
],[130,369],['ENTRY POINT','BEHAVIOUR'])
h('Route / leg editor')
p('Fields are ordered <b>WP - ALT ft - Mach - time/ETA Z - NM - Hold/WP OUT</b>, followed by wind, mode, manual leg minutes, ETE, leg fuel, recovery requirement, FOB and actions. Coordinates remain part of the internal route state and backup.')
p('Intermediate waypoints can be added, deleted or moved up/down. AAR, Bingo and Joker references follow their associated waypoint when it moves. Deliberately reordering a route may recalculate affected DIST legs from available coordinates.')
h('Distance or time: choose the governing input')
p('<b>DIST:</b> NM is specified; ETE follows from speed, wind and altitude changes. <b>TIME:</b> entered leg minutes govern the calculation; leg distance is derived from them. Editing NM or MIN selects the corresponding mode. Holds, AAR duration and hard times do not change leg NM or coordinates.')
box('Precision and editing','Mach is displayed with no more than two decimal places. Full precision is retained internally. Route edits commit on Enter or when leaving the field. Leaving a rounded field unchanged does not overwrite its precise internal value.')
page(3,'Fuel and performance','Separate the planned fuel state from the required minimum.')
p('<b>Start / On Board Fuel is an input.</b> The app calculates fuel states forwards from this value. A desired landing quantity or AAR target does not back-calculate and overwrite start fuel.')
table([
('FOB START / ON BOARD','Entered fuel on board before the planned ground consumption.'),
('BLOCK REQ','Planning requirement including route, holds, reserve, divert/recovery and the net AAR effect.'),
('T/O REQ','Required take-off fuel; this is not the actual or planned tank content.'),
('PLANNED T/O FOB','Planned fuel on board after subtracting ground consumption from start fuel.'),
('UPLIFT / SPARE','Additional fuel needed to meet the block requirement, or the difference between on-board fuel and the planning requirement.'),
('FOB IN / OUT / LANDING','Calculated fuel states at waypoints, after events and at landing.')
],[152,347],['DISPLAY','MEANING'])
h('Calculation basis')
p('Climb/descent and cruise portions are calculated separately for each leg. Mach is converted to TAS using ISA; the entered wind component affects groundspeed. The fuel curve interpolates between measured points and uses the stored estimation model outside the measured Mach range.')
p('The supplied EF2000 profile contains tank capacity and ground, climb and descent rates. The active Mach range is 0.48 to 0.95; model altitude extends to 55,000 ft. The airborne consumption surcharge applies to flight phases including holds and AAR burn. Ground consumption is calculated separately from taxi minutes and the ground rate.')
h('Separate cruise calculator')
p('Calculate by total distance or total flight time. Distance may come from the current route, the direct DEP-ARR distance or manual entry. Set cruise altitude, Mach, wind and both airfield elevations. Outputs include climb, cruise, descent and total fuel, fuel flow, ETE, distance and block requirement including reserve and recovery/divert.')
p('Legs too short for an altitude change, non-positive groundspeed and out-of-model values are flagged for review. Missing performance data are not filled by inventing a new aircraft profile.','small')
page(4,'Timing, holds and recovery','Time constraints and position-dependent fuel thresholds.')
h('Hard times and holds')
p('Start time and ETA use Zulu/UTC. A manual waypoint ETA acts as a hard-time anchor. Additional waiting time is treated as a hold with fuel consumption, preferably at a planned hold waypoint before the anchor. Unreachable times are flagged as conflicts; distances are not invented to make them fit.')
p('A hold changes <b>time and fuel</b>. Each affected waypoint has separate WP IN time/FOB, hold duration/burn and WP OUT time/FOB. Consumption uses the hold waypoint altitude and Mach plus the airborne consumption surcharge. Subsequent ETAs shift accordingly.')
h('Joker and Bingo')
table([
('JOKER @ WP IN','The hold at the selected waypoint is still included in the remaining requirement.'),
('JOKER @ WP OUT','The hold at the selected waypoint is complete and is not counted again.'),
('JOKER BUFFER','An editable additional buffer above the calculated requirement at the selected reference point.'),
('BINGO REFERENCE','Position-dependent requirement for the remaining mission plus divert, recovery extra and landing reserve. At arrival, remaining mission fuel may be zero.'),
('MANUAL / AUTO','Bingo and Joker can be calculated or replaced with explicit manual thresholds. The app shows the reference point, planned FOB and margin.'),
('BINGO 2 / B2 RTB','A separate entered threshold with its own RTB airfield on the AAR plan.')
],[142,357],['FUNCTION','LOGIC'])
h('Divert and reserve')
p('Plan two alternate airfields. Search supports ICAO, name, country, favourites and recent airfields. Distance and elevation may use local data or manual entries. Divert altitude, Mach, wind, Missed Approach / Recovery Extra and Landing Reserve remain editable.')
p('USED DIVERT can automatically select the higher valid fuel requirement or explicitly use Divert 1/2. A preset may contain labelled briefing fuel values. AAR onload that has not yet been received is not credited as fuel already available when determining conservative remaining fuel thresholds.','small')
page(5,'AAR: automatic planning','A330 MRTT, measurement-based transfer rates and separate time quantities.')
p('Enable PLAN AAR and select the waypoint. Review FL, KIAS, configuration, event duration, ARIP/ARCP, callsign and frequency. <b>A330 MRTT is fixed.</b> Choose an AUTO target or manual gross onload. Normal use does not require selecting a measurement button or entering a rate.')
table([
('RATE MODE: AUTO','Default. Matching measurement curves are selected automatically. Comparable points are interpolated within their coverage; reference and fuel-band estimates are labelled.'),
('RECEIVER FUEL FLOW','Own consumption from AAR altitude, KIAS and the available consumption model. CLEAN explicitly uses the 3-BAGS model as an approximation.'),
('RATE MODE: MANUAL','Explicit override of effective gross rate in kg/min. RATE SOURCE identifies the basis actually used.'),
('TRANSFER / EVENT','TRANSFER TIME is fuel-transfer time. AAR EVENT DURATION also includes planned orbit/waiting time. The two remain separate.')
],[142,357],['FIELD','MEANING'])
h('Measurements and calculation')
p('Six supplemental profiles with 30 checkpoints measure net fuel gain over time. Gross rate = measured net rate + modeled receiver consumption. The app integrates individual fuel-fill segments; the displayed effective average can differ from a complete Excel measurement-run average.')
formula('MANUAL: Gross Onload remains exactly the entered value')
formula('AUTO: G = max(0, Target OUT - IN + F × EventDuration)')
formula('AAR Burn = TransferBurn + OrbitBurn')
formula('FOB OUT = FOB IN + Gross Onload - AAR Burn')
p('For a constant rate R, transfer time = G/R. Automatic measurement curves integrate each crossed fuel segment. TARGET FOB OUT applies at the end of the entire event. Zero onload may be correct.','small')
h('Warnings and limits')
p('Rate ≤ receiver flow, insufficient event duration and tank-capacity violations are flagged. Transfer is modeled first, then orbit; peak tank content is checked at transfer end. FOB AFTER LOAD is accounting only. Missing usable rate: N/A / RATE REQUIRED, without inventing a transfer time. Start fuel, leg NM and coordinates are not changed to fit the result.')

page(6,'Complete mission backup','Plan once, save to a file and restore on another device.')
h('EXPORT CURRENT MISSION / IMPORT MISSION')
p('Both controls are under MISSION. Export creates a JSON file of the current state; SAVE LOCAL is not required first. Import validates the file, restores the inputs and recalculates the plan. A successful import displays <b>Mission successfully imported</b>.')
table([
('Mission inputs','Name/type, date, start, aircraft, callsign, DEP/ARR, elevations, notes and all calculation-relevant form values.'),
('Internal route state','Order, names, available coordinates, ALT, exact Mach values, wind, NM, modes, manual times, hard times, planned times and holds.'),
('Events and thresholds','AAR switch/reference and all AAR inputs including rate/source; Bingo/Joker switches, WP references, IN/OUT basis and manual values.'),
('Recovery / performance','Diverts, reserve, manual distances/elevations, cruise settings, metadata and the aircraft profile, fuel curve and navigation data in use.'),
('Results','A reference snapshot of leg, fuel, AAR and summary values. It never replaces recalculation on import.')
],[142,357],['SAVED','COVERAGE'])
h('Version handling')
p('Current format: <b>schemaVersion 3</b>, appVersion 1.9.23, model <b>ife-forward-auto-3</b>. AUTO mode and measurement data are archived. Schema 1/2 migrations preserve explicit rates as MANUAL; former blank rates adopt AUTO with installed measurements. Unknown versions and missing required fields are rejected before loading.')
p('File limit: 5 MB. The complete format supports 2 to 2,000 waypoints and does not truncate a backup route to the earlier 40-WP limit. Blank inputs stay blank; unknown coordinates are not estimated.')
h('Local storage')
p('SAVE LOCAL and LOAD LOCAL save/restore on the same device. New local saves use the same complete structure as JSON export; older browser saves remain readable through the existing loader. Export, file import and preset loading do not overwrite the saved local mission. Deliberate SAVE LOCAL replaces the local storage slot.')
p('JSON is the authoritative complete backup format. PDF is for reading, not reimporting. An additional CSV/Excel export is not implemented in this version.','small')
page(7,'Output and interface','Cockpit-style information with display precision separate from calculation precision.')
h('Data Card and AAR ticket')
p('The Data Card combines the mission header, fuel order, Bingo/Joker, diverts/reserve and AAR. The flight log includes WP, ALT, Mach, wind, leg NM, ETE, WP IN, Hold/WP OUT, leg fuel, recovery requirement and FOB IN/OUT. An actual-fuel column (IST kg) is provided for recording observations.')
p('PRINT / SAVE PDF uses the browser print dialogue. Print the complete Data Card or the separate AAR ticket. Use the JSON backup for full restoration.')
h('Tablet controls and detail views')
p('On touch devices or narrower screens, route rows become expandable waypoint cards. Fields start expanded. Tap the full waypoint name to open or close the fields. The desktop table remains available, with a waypoint column that stays visible during horizontal scrolling.')
p('The vertical route profile shows the altitude sequence and marks AAR. Selecting a waypoint in the profile opens leg, timing, consumption and fuel-state details. Key fuel displays also provide detail views.')
table([
('LANGUAGE','English is the default. Settings → Language switches between English and German. Previously saved choices remain effective; times use UTC.'),
('LAYOUT','OPS and OPERATIONAL EFB display variants.'),
('THEMES','Night Cyan, Night White, Ops Green and Day High Contrast.'),
('LOCAL OPERATION','Browser-based app with a service-worker cache. Calculations run locally; offline use requires previously loaded/available app files.'),
('DATA STATUS','Profile/fuel data, AAR measurement status and AIRAC calendar cycle. The cycle does not certify that navigation data are current or approved.'),
('PRIVACY','No app account or tracking SDKs. SimBrief is contacted on explicit import. Local app data can be deleted after confirmation.')
],[130,369],['AREA','FUNCTION'])
h('Optional mission preset')
p('<b>RHINE SENTINELLE - GHOST - 10.10.2026</b> can be loaded separately. It contains the stored route, timing, holds, AAR and briefing fuel values. It remains optional and is not the app default. The general AUTO/MANUAL rate logic and labelled estimates also apply to this preset.','small')
page(8,'Workflow and limitations','Use the simulator model with its assumptions in view.')
table([
('01 / CREATE','Choose a manual mission, SimBrief or an optional preset. Check date, start, airfields and start fuel.'),
('02 / ROUTE','Check order, coordinates, altitudes, Mach, wind and DIST/TIME modes.'),
('03 / TIMING','Set hard times and holds. Check WP IN/OUT and timing conflicts.'),
('04 / RECOVERY','Set diverts, Used Divert, Recovery Extra, reserve and Joker/Bingo references.'),
('05 / AAR','Check AUTO/MANUAL, gross/target, configuration, rate and event duration. Resolve time and tank warnings.'),
('06 / SAVE','Review recalculated results, export JSON and print the Data Card/AAR ticket to PDF if needed.')
],[115,384],['SEQUENCE','CHECK'])
h('Model limitations')
p('The calculator uses simulator measurements, interpolation and identified model assumptions. Below 3,000 ft it uses the 3,000-ft curve; a separate measured low-level dataset for every altitude is not available. Weather, weight and configuration are not covered by a complete real-world performance database.')
p('Gross AAR rates are derived from measured net gain and modeled receiver burn. CLEAN uses the 3-BAGS consumption model as an approximation. 3 BAGS is currently measured at FL230 / 285 KIAS; other conditions use a labelled reference estimate. Interpolation requires comparable measurement coverage.')
h('Validation and document basis')
p('Checks cover AUTO/MANUAL, six complete measurement curves, interpolation, capacity, unchanged geometry, export-reset-import and SimBrief 793765. Focused update tests cover version comparison, offline failures and mission restoration. These tests are not real-world aircraft performance approval.','small')
p('Basis: app package v1.9.23; app.js, logic-core.js, mission-backup.js, index.html, data files, README and related regression tests. This guide describes the implemented scope as of 12 October 2026.','small')
box('Terminology','<b>FOB</b> Fuel on Board · <b>ETE</b> Estimated Time Enroute · <b>ETA</b> Estimated Time of Arrival · <b>AAR</b> Air-to-Air Refuelling · <b>WP</b> Waypoint · <b>NM</b> Nautical Miles · <b>RTB</b> Return to Base · <b>TOT</b> Time on Target<br/><br/><b>SIMULATION ONLY.</b> Not an official flight document or approved for real-world operational planning.')
page(9,'Online app and updates','Recommended access: the official web app or its home-screen installation.')
box('Open the app instead of downloading a ZIP','<link href="https://ife-eufi-fuelcalc-test.topstoni81.workers.dev/" color="#54624b">ife-eufi-fuelcalc-test.topstoni81.workers.dev</link><br/><br/>Bookmark this address or add it to your home screen through the browser. This PWA still uses the official address. A GitHub ZIP or local HTML copy is a separate, static copy.')
h('What the app detects from v1.9.23')
p('Opening the app checks the public GitHub version file. Returning to the app checks at most hourly; reconnecting also triggers a check. SETTINGS → APP UPDATES &amp; USER GUIDE provides CHECK FOR UPDATES. No mission data or Pilot ID is sent with version checks.')
table([
('OFFICIAL APP / PWA','A newer version offers UPDATE NOW. The current plan is secured in this tab’s session storage, the app reloads and the plan is restored. SAVE LOCAL is untouched. No forced reload while planning.'),
('SEPARATE COPY','A persistent notice points to the official app. Use EXPORT CURRENT MISSION, then OPEN LATEST APP and IMPORT MISSION. A browser cannot replace downloaded source files by itself.'),
('OFFLINE / FAILURE','The app does not claim to be current. The available version remains usable where its files are cached. Choose CHECK FOR UPDATES after reconnecting.'),
('OLDER THAN v1.9.23','These old copies do not have update detection. Switch once to the official address or obtain the new version.')
],[140,359],['SITUATION','ACTION'])
h('Mission preservation and recovery')
p('Restoration includes inputs and archived performance data. It does not replace an independent JSON backup. If automatic restoration fails, the session copy is retained and DOWNLOAD RECOVERY JSON is offered. Moving to a different address, browser or device requires JSON export/import.')
p('Current English and German guides are linked directly in SETTINGS and the GitHub README. Downloaded PDFs are snapshots; the online links provide the current edition.','small')
page(10,'AAR interface overview','Current operation since v1.9.22; an example view, not prescribed mission inputs.')

im=Image(str(Path(__file__).with_name('aar-interface.jpg')));im.drawHeight=im.imageHeight*499/im.imageWidth;im.drawWidth=499;S.append(im);S.append(Spacer(1,14))
box('How to use it','Set FL, KIAS and configuration; AUTO selects the applicable rate and receiver burn. The ticket separates gross onload, transfer time, event duration and burn. Estimates and missing data remain visible. Do not copy these demo inputs into a new mission without review.')
p('Source: official app v1.9.22, demo view. v1.9.23 adds update detection and current guide links without changing fuel mathematics.','small')

def decorate(c,doc):
 w,h=doc.pagesize;c.saveState();c.setFillColor(OLIVE);c.rect(0,h-9,w,9,fill=1,stroke=0)
 c.setFont('Bold',8);c.setFillColor(OLIVE);c.drawString(48,h-32,'EUROFIGHTER IFE / USER GUIDE')
 c.setFont('Body',8);c.setFillColor(MUTED);c.drawRightString(w-48,h-32,'v1.9.23  |  ENGLISH  |  12 OCT 2026')
 c.setStrokeColor(LINE);c.line(48,43,w-48,43);c.setFont('Body',7.5);c.drawString(48,29,'SIMULATION ONLY  /  USER GUIDE')
 c.setFont('Bold',8);c.drawRightString(w-48,29,f'{doc.page:02d} / 10');c.restoreState()
out=str(Path(__file__).resolve().parent.parent / 'Eurofighter_IFE_User_Guide_EN.pdf')
doc=SimpleDocTemplate(out,pagesize=(595.28,841.89),rightMargin=48,leftMargin=48,topMargin=58,bottomMargin=58,title='Eurofighter IFE - User Guide v1.9.23',author='Eurofighter IFE',subject='English operating guide for simulator mission planning')
doc.build(S,onFirstPage=decorate,onLaterPages=decorate)
print(out)
