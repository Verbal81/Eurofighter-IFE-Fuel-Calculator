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
 p(f'{num:02d} / FUNKTIONSBEREICH','small');p(title,'h1');p(deck,'deck')
def formula(t):p(t,'formula')
# 1
p('BEDIENHANDBUCH / AUSGABE 12.10.2026','small')
p('EUROFIGHTER IFE<br/>FUEL CALCULATOR','hero')
p('Anleitung und Funktionsübersicht<br/><b>Version 1.9.23</b> | Missionsplanung im Simulator','deck')
box('Auftrag der Anwendung','Eine Mission von den ersten Eingaben bis zur druckbaren Data Card durchgängig planen: Route, Zeit, Fuel, Holds, AAR, Diverts und Fuel-Schwellen. Der aktuelle Plan lässt sich vollständig als JSON sichern und auf einem anderen Gerät wiederherstellen.')
h('Fähigkeitsprofil')
table([
('MISSION / ROUTE','Missionsdaten, SimBrief-Import, Waypoint-Editor und vertikales Routenprofil.','02'),
('FUEL / CRUISE','Vorwärtsrechnung ab eingegebenem Startfuel; eigener Reiseflugrechner.','03'),
('TIMING / RECOVERY','Hard Times, Holds, WP IN/OUT, Joker, Bingo und zwei Diverts.','04'),
('AAR','AUTO/MANUAL, Gross Onload, Transfer Rate, Transferzeit und Event-Burn.','05'),
('BACKUP / RESTORE','Vollständiger JSON-Export/-Import; lokale Missionsspeicherung.','06'),
('OUTPUT / INTERFACE','Data Card, AAR-Bon, Tablet-Bedienung, Sprache und Darstellung.','07'),
('WORKFLOW / GRENZEN','Planungsablauf, Modellgrenzen, Prüfstand und Begriffe.','08'),
('ONLINE / UPDATES','Web-App verwenden, Version prüfen, sicher aktualisieren.','09')
],[125,339,35],['BEREICH','LEISTUNG','S.'])
p('Dokumentcharakter: sachliche Produkt- und Bedienübersicht. Keine amtliche Flugunterlage, kein militärisches Vorschriftenwerk. Der Funktionsumfang bezieht sich auf den vorliegenden Softwarestand, nicht auf angekündigte Erweiterungen.','small')
# 2
p('Bildbeispiele: AAR-Einstellungen S. 10; Bon S. 11; Fuel-Schwellen S. 12; Holds S. 13; Abkürzungen S. 14. AAR-/Fuel-Hintergründe S. 15-19; Quellen S. 20.','small')
h('Direkt zur aktuellen App')
p('<link href="https://ife-eufi-fuelcalc-test.topstoni81.workers.dev/" color="#54624b">ife-eufi-fuelcalc-test.topstoni81.workers.dev</link><br/>Als Lesezeichen oder Home-Bildschirm-App verwenden. ZIP-/HTML-Downloads sind separate Kopien. Update-Anleitung: Seite 9.','small')
page(2,'Mission und Route','Plan erstellen, importieren und kontrolliert bearbeiten.')
h('Missionsanlage')
p('Erfasst werden Mission Name, Mission Type, Datum UTC, Start Z, Aircraft, Callsign, Departure/Arrival, Platzhöhen und Missionsnotizen. Startfuel, Taxi-Zeit, Reserve und Verbrauchszuschlag sind direkt planbar. Platzhöhen lassen sich aus der lokalen Datenbank übernehmen oder manuell eingeben.')
table([
('NEW MANUAL MISSION','Neue manuelle Planung mit anschließend frei bearbeitbaren Zwischen-Waypoints.'),
('LOAD DEMO','Lädt die bestehende Demonstrationsroute mit DIST-/TIME-Legs und zwei Diverts. Der App-Start verwendet weiterhin die Demo.'),
('SIMBRIEF','Import des letzten OFP über Pilot ID oder Alias. Übernommen werden unter anderem Datum, Route, Koordinaten, Höhen, Mach und Wind. Danach bleiben die Planungswerte bearbeitbar.'),
('LOAD PRESET','Explizites Laden eines separat angebotenen Missions-Presets. Auswahl allein ändert die aktive Mission nicht.')
],[130,369],['EINSTIEG','VERHALTEN'])
h('Route / Leg-Editor')
p('Die Reihenfolge lautet <b>WP - ALT ft - Mach - Zeit/ETA Z - NM - Hold/WP OUT</b>; danach folgen Wind, Modus, manuelle Leg-Minuten, ETE, Leg-Fuel, Recovery-Bedarf, FOB und Aktionen. Koordinaten bleiben Bestandteil des internen Routenplans und des Backups.')
p('Zwischen-Waypoints können hinzugefügt, gelöscht oder mit Auf/Ab verschoben werden. Referenzen für AAR, Bingo und Joker folgen beim Verschieben dem zugehörigen Waypoint. Bei einer bewussten Routenumsortierung können betroffene DIST-Legs aus vorhandenen Koordinaten neu bestimmt werden.')
h('Distanz oder Zeit - eine bewusste Eingabeentscheidung')
p('<b>DIST:</b> NM sind vorgegeben; ETE folgt aus Geschwindigkeit, Wind und Höhenwechsel. <b>TIME:</b> Die eingegebenen Leg-Minuten sind maßgeblich; daraus wird die Leg-Distanz berechnet. Das Bearbeiten von NM oder MIN wählt den jeweiligen Modus. Holds, AAR-Dauer und Hard Times verändern dagegen keine Leg-NM oder Koordinaten.')
box('Präzision und Bedienung','Mach erscheint mit maximal zwei Dezimalstellen. Intern bleiben die exakten Werte erhalten. Route-Eingaben werden mit Enter oder beim Verlassen des Feldes übernommen; ein unverändert verlassenes, gerundet dargestelltes Feld überschreibt den präzisen internen Wert nicht.')
# 3
page(3,'Fuel und Performance','Tatsächlichen Fuel-State und erforderlichen Mindestbedarf getrennt betrachten.')
p('<b>Start / On Board Fuel ist ein Input.</b> Die App rechnet den tatsächlichen Fuel-Verlauf von diesem Wert vorwärts. Eine gewünschte Landing-Menge oder ein AAR-Ziel schreibt den Startfuel nicht rückwärts um.')
table([
('FOB START / ON BOARD','Eingegebener Kraftstoff an Bord vor dem angesetzten Ground-Verbrauch.'),
('BLOCK REQ','Erforderlicher Planungsbedarf mit Route, Holds, Reserve, Divert/Recovery und AAR-Nettoeffekt.'),
('T/O REQ','Erforderlicher Kraftstoff zum Take-off; ausdrücklich kein Ist- oder geplanter Tankinhalt.'),
('PLANNED T/O FOB','Tatsächlicher Planwert nach Abzug des Ground-Verbrauchs vom Startfuel.'),
('UPLIFT / SPARE','Zusätzlicher Bedarf zum Blockwert beziehungsweise Differenz zwischen Onboard und Planungsbedarf.'),
('FOB IN / OUT / LANDING','Berechneter Fuel-State an Waypoints, nach Events und bei der Landung.')
],[152,347],['ANZEIGE','BEDEUTUNG'])
h('Rechenbasis')
p('Pro Leg werden Steig-/Sinkanteil und Reiseflug getrennt berechnet. Mach wird über ISA in TAS umgerechnet; die eingegebene Windkomponente beeinflusst die Groundspeed. Die Fuel-Kurve interpoliert zwischen Messpunkten. Außerhalb der gemessenen Mach-Spanne arbeitet sie mit dem hinterlegten Schätzmodell.')
p('Das mitgelieferte EF2000-Profil enthält Tankkapazität sowie Ground-, Climb- und Descent-Raten. Der aktive Mach-Bereich ist 0,48 bis 0,95; die Modellhöhe reicht bis 55.000 ft. Der Flugverbrauchszuschlag wirkt auf Flugphasen einschließlich Holds und AAR-Burn. Ground-Verbrauch wird separat aus Taxi-Minuten und Ground-Rate bestimmt.')
h('Eigenständiger Reiseflugrechner')
p('Berechnung über Gesamtdistanz oder Gesamtflugzeit. Die Distanz kann aus der aktuellen Route, aus DEP-ARR-Direktdistanz oder aus manueller Eingabe stammen. Einstellbar sind Reisehöhe, Mach, Wind und beide Platzhöhen. Ausgegeben werden Steig-, Reise-, Sink- und Gesamtverbrauch, Fuel Flow, ETE, Strecke und Blockbedarf einschließlich Reserve und Recovery/Divert.')
p('Zu kurze Legs für den Höhenwechsel, nichtpositive Groundspeed oder Werte außerhalb des Modells werden als Prüfbedarf angezeigt. Fehlende Performance-Daten werden nicht zu einem neuen, erfundenen Flugzeugprofil ergänzt.','small')
# 4
page(4,'Timing, Holds und Recovery','Zeitliche Bindungen und positionsbezogene Fuel-Schwellen.')
h('Hard Times und Holds')
p('Start und ETA werden in Zulu/UTC geführt. Eine manuelle ETA am Waypoint dient als Hard-Time-Anker. Zusätzliche Wartezeit wird als Hold mit Verbrauch berücksichtigt, bevorzugt an einem geplanten Hold-Waypoint vor dem Anker. Nicht erreichbare Zeiten werden als Konflikt markiert. Es werden dafür keine Distanzen erfunden.')
p('Ein Hold verändert <b>Zeit und Fuel</b>. Für jeden betroffenen Waypoint werden WP IN time/FOB, Hold-Dauer/-Burn und WP OUT time/FOB getrennt geführt. Der Verbrauch nutzt Höhe und Mach des Hold-Waypoints sowie den Flugverbrauchszuschlag. Nachfolgende ETAs verschieben sich entsprechend.')
h('Joker und Bingo')
table([
('JOKER @ WP IN','Enthält den Hold am ausgewählten Waypoint noch im verbleibenden Bedarf.'),
('JOKER @ WP OUT','Der Hold am ausgewählten Waypoint ist bereits absolviert und wird nicht erneut angesetzt.'),
('JOKER BUFFER','Zusätzlicher frei eingegebener Puffer über dem berechneten Bedarf am gewählten Bezugspunkt.'),
('BINGO REFERENCE','Positionsabhängiger Bedarf für verbleibende Mission plus Divert, Recovery Extra und Landing Reserve. Bei Arrival kann die Restmission null sein.'),
('MANUAL / AUTO','Bingo und Joker können berechnet oder durch explizite manuelle Schwellen ersetzt werden. Die App zeigt Bezugspunkt, geplanten FOB und Margin.'),
('BINGO 2 / B2 RTB','Separater eingegebener Schwellenwert mit eigener RTB-Basis auf dem AAR-Plan.')
],[142,357],['FUNKTION','LOGIK'])
h('Divert und Reserve')
p('Zwei Ausweichplätze sind planbar. Die Suche unterstützt ICAO, Namen, Land, Favoriten und zuletzt verwendete Plätze. Distanz und Platzhöhe können aus lokalen Daten stammen oder manuell vorgegeben werden. Divert-Höhe, Mach, Wind, Missed Approach / Recovery Extra und Landing Reserve bleiben editierbar.')
p('USED DIVERT kann automatisch den höheren gültigen Fuelbedarf wählen oder ausdrücklich auf Divert 1/2 gesetzt werden. Ein Preset kann gekennzeichnete Briefing-Fuelwerte enthalten. Noch nicht empfangener AAR-Onload wird den konservativen verbleibenden Fuel-Schwellen nicht als bereits vorhandener Kraftstoff gutgeschrieben.','small')
# 5
page(5,'AAR: automatisch planen','A330 MRTT, messwertbasierte Transferraten und klar getrennte Zeiten.')
p('PLAN AAR aktivieren und den Waypoint festlegen. FL, KIAS, Konfiguration, Event-Dauer, ARIP/ARCP, Callsign und Frequenz prüfen. <b>A330 MRTT ist fest hinterlegt.</b> AUTO-Ziel oder manuellen Gross Onload wählen. Die Rate muss im Normalfall nicht angeklickt oder eingegeben werden.')
table([
('RATE MODE: AUTO','Standard. Passende Messkurven werden automatisch gewählt. Vergleichbare Messpunkte werden innerhalb ihrer Abdeckung interpoliert; Referenz- und Fuel-Band-Schätzungen sind gekennzeichnet.'),
('RECEIVER FUEL FLOW','Eigenverbrauch aus AAR-Höhe, KIAS und vorhandenem Verbrauchsmodell. CLEAN verwendet das 3-BAGS-Modell ausdrücklich als Näherung.'),
('RATE MODE: MANUAL','Bewusster Override der effektiven Gross-Rate in kg/min. RATE SOURCE zeigt die tatsächlich verwendete Herkunft.'),
('TRANSFER / EVENT','TRANSFER TIME ist reine Übertragungszeit. AAR EVENT DURATION enthält zusätzlich geplante Orbit-/Wartezeit. Beide bleiben getrennt.')
],[142,357],['FELD','BEDEUTUNG'])
h('Messwerte und Berechnung')
p('Sechs ergänzende Messprofile mit 30 Zwischenständen liefern Netto-Fuelzuwachs über die Zeit. Gross-Rate = gemessene Netto-Rate + modellierter Receiver-Verbrauch. Die App integriert die einzelnen Tankfüllstandsabschnitte; der angezeigte effektive Mittelwert kann vom Gesamtmittel eines Excel-Messlaufs abweichen.')
formula('MANUAL: Gross Onload bleibt exakt der eingegebene Wert')
formula('AUTO: G = max(0, Target OUT - IN + F × EventDuration)')
formula('AAR Burn = TransferBurn + OrbitBurn')
formula('FOB OUT = FOB IN + Gross Onload - AAR Burn')
p('Bei konstanter Rate R gilt Transferzeit = G/R; bei der automatischen Messkurve werden die durchlaufenen Abschnitte einzeln berechnet. TARGET FOB OUT gilt am Ende des gesamten Events. Ein Onload von null kann korrekt sein.','small')
h('Warnungen und Grenzen')
p('Rate ≤ Eigenverbrauch, zu kurze Event-Dauer und Überschreitung der Tankkapazität werden gemeldet. Der Ablauf ist Transfer zuerst, Orbit danach; das Tankmaximum wird am Transfer-Ende geprüft. FOB AFTER LOAD bleibt Accounting. Fehlende nutzbare Rate: N/A / RATE REQUIRED; daraus wird keine Transferzeit erfunden. Startfuel, Leg-NM und Koordinaten werden nicht passend gemacht.')

page(6,'Vollständiges Backup','Eine Mission planen, als Datei sichern und geräteübergreifend wiederherstellen.')
h('EXPORT CURRENT MISSION / IMPORT MISSION')
p('Beide Funktionen stehen unter MISSION. Export erzeugt eine JSON-Datei des aktuellen Zustands; vorheriges SAVE LOCAL ist nicht erforderlich. Import validiert die Datei, stellt die Eingaben wieder her und berechnet den Plan erneut. Erfolgreiches Laden meldet: <b>Mission successfully imported</b>.')
table([
('Missions-Inputs','Name/Typ, Datum, Start, Aircraft, Callsign, DEP/ARR, Platzhöhen, Notizen und alle berechnungsrelevanten Formularwerte.'),
('Interner Routen-State','Reihenfolge, Namen, vorhandene Koordinaten, ALT, exakte Mach-Werte, Wind, NM, Modi, manuelle Zeiten, Hard Times, Planzeiten und Holds.'),
('Events und Schwellen','AAR-Schalter/-Referenz, sämtliche AAR-Inputs einschließlich Rate/Quelle; Bingo/Joker-Schalter, WP-Referenzen, IN/OUT-Basis und manuelle Werte.'),
('Recovery / Performance','Diverts, Reserve, manuelle Distanzen/Höhen, Cruise-Einstellungen, Metadaten sowie verwendetes Aircraft-Profil, Fuel-Kurve und Navigation.'),
('Ergebnisse','Kontroll-Snapshot von Leg-, Fuel-, AAR- und Summary-Werten. Er ersetzt beim Import niemals die Berechnung.')
],[142,357],['GESICHERT','UMFANG'])
h('Versionssicherheit')
p('Aktuell: <b>schemaVersion 3</b>, appVersion 1.9.23, Modell <b>ife-forward-auto-3</b>. AUTO-Modus und Messdaten werden mitgesichert. Schema 1/2 werden gezielt migriert: explizite Raten bleiben MANUAL, frühere leere Raten übernehmen AUTO mit den installierten Messdaten. Unbekannte Versionen und fehlende Pflichtfelder werden vor dem Laden abgewiesen.')
p('Dateigrenze: 5 MB; das vollständige Format unterstützt 2 bis 2.000 Waypoints. Es kürzt eine importierte Backup-Route nicht auf das frühere 40-WP-Limit. Leere Inputs bleiben leer; unbekannte Koordinaten werden nicht geschätzt.')
h('Lokaler Speicher')
p('SAVE LOCAL und LOAD LOCAL sichern/laden auf demselben Gerät. Neue lokale Saves nutzen dieselbe vollständige Struktur wie der JSON-Export; alte Browser-Saves bleiben über den bisherigen Loader lesbar. Export, Datei-Import und Preset-Laden überschreiben keine vorhandene lokale Mission. Nur bewusstes SAVE LOCAL ersetzt den lokalen Speicherplatz.')
p('JSON ist das maßgebliche vollständige Backupformat. PDF dient der Lesbarkeit, nicht dem Reimport. Ein zusätzlicher CSV-/Excel-Export ist in diesem Stand nicht implementiert.','small')
# 7
page(7,'Ausgabe und Oberfläche','Informationen im Cockpit-Stil, ohne die Berechnung mit der Anzeige zu vermischen.')
h('Data Card und AAR-Bon')
p('Die Data Card fasst Missionskopf, Fuel Order, Bingo/Joker, Diverts/Reserve und AAR zusammen. Der Fluglog enthält WP, ALT, Mach, Wind, Leg NM, ETE, WP IN, Hold/WP OUT, Leg-Fuel, Recovery-Bedarf und FOB IN/OUT; eine IST-kg-Spalte ist für die Dokumentation vorgesehen.')
p('PRINT / SAVE PDF nutzt den Browser-Druckdialog. Die komplette Data Card und der separate AAR-Bon sind druckbar. Das JSON-Backup bleibt für die vollständige Wiederherstellung zuständig.')
h('Tablet und Detailansichten')
p('Auf Touch-Geräten beziehungsweise schmaleren Ansichten werden Routenzeilen zu aufklappbaren Waypoint-Karten. Alle Felder sind anfangs geöffnet. Antippen des vollständigen Namens öffnet oder schließt die Felder. Die Desktop-Tabelle bleibt erhalten; ihre Waypoint-Spalte bleibt beim horizontalen Scrollen sichtbar.')
p('Das vertikale Routenprofil zeigt die Höhenfolge und markiert AAR. Waypoints im Profil öffnen Detailinformationen zu Leg, Zeit, Verbrauch und Fuel-State. Auch zentrale Fuel-Anzeigen besitzen Detailansichten.')
table([
('SPRACHE','Englisch ist Standard. Settings → Language wechselt zwischen English und Deutsch. Bereits gespeicherte Sprachwahlen bleiben erhalten; Zeiten in UTC.'),
('LAYOUT','OPS und OPERATIONAL EFB als Darstellungsvarianten.'),
('THEMES','Night Cyan, Night White, Ops Green und Day High Contrast.'),
('LOKALES ARBEITEN','Browserbasierte App mit Service-Worker-Cache. Berechnung lokal; Offline-Nutzung setzt zuvor geladene/verfügbare App-Dateien voraus.'),
('DATENSTATUS','Profil-/Fuel-Daten, AAR-Messdatenstatus und AIRAC-Kalenderzyklus. Der Zyklus bestätigt keine aktuelle oder zertifizierte Navdatenbank.'),
('DATENSCHUTZ','Kein App-Konto, keine Tracking-SDKs. SimBrief wird auf ausdrücklichen Import angesprochen. Lokale App-Daten lassen sich nach Bestätigung löschen.')
],[130,369],['BEREICH','FUNKTION'])
h('Optionaler Missions-Preset')
p('<b>RHINE SENTINELLE - GHOST - 10.10.2026</b> ist separat ladbar. Er enthält den hinterlegten Missionsplan mit Route, Timing, Holds, AAR und Briefing-Fuelwerten. Der Preset bleibt optional; Demo und allgemeine Funktionen sind nicht auf ihn festgelegt. Auch dort gilt die allgemeine AUTO-/MANUAL-Ratenlogik mit gekennzeichneten Schätzungen.','small')
# 8
page(8,'Planungsablauf und Grenzen','Kontrollierte Anwendung des vorhandenen Simulatormodells.')
table([
('01 / ANLEGEN','Manuelle Mission, SimBrief oder optionalen Preset wählen. Datum, Start, Plätze und Startfuel prüfen.'),
('02 / ROUTE','Reihenfolge, Koordinatenbasis, Höhen, Mach, Wind und DIST/TIME-Modi kontrollieren.'),
('03 / TIMING','Hard Times und Holds setzen. WP IN/OUT und mögliche Zeitkonflikte prüfen.'),
('04 / RECOVERY','Diverts, Used Divert, Recovery Extra, Reserve und Joker-/Bingo-Bezug festlegen.'),
('05 / AAR','AUTO/MANUAL, Gross/Target, Konfiguration, Rate und Event-Dauer prüfen. Zeit- und Tankwarnungen auflösen.'),
('06 / SICHERN','Neu berechneten Plan prüfen, JSON exportieren und bei Bedarf Data Card/AAR-Bon als PDF ausgeben.')
],[115,384],['ABLAUF','KONTROLLPUNKT'])
h('Modellgrenzen')
p('Der Fuel-Rechner nutzt Simulatormessungen, Interpolation und gekennzeichnete Modellannahmen. Unter 3.000 ft wird die 3.000-ft-Kurve verwendet; ein eigener gemessener Low-Level-Datensatz für jede Höhe liegt nicht vor. Wetter, Gewicht und Konfiguration sind nicht durch eine vollständige reale Performance-Datenbank abgedeckt.')
p('Die AAR-Grossraten sind aus gemessenem Nettozuwachs und modelliertem Eigenverbrauch abgeleitet. Für CLEAN dient das 3-BAGS-Verbrauchsmodell als Näherung. 3 BAGS ist bisher bei FL230 / 285 KIAS gemessen; andere Bedingungen nutzen eine gekennzeichnete Referenzschätzung. Außerhalb vergleichbarer Messabdeckung wird nicht scheinpräzise interpoliert.')
h('Prüfstand und Dokumentbasis')
p('Geprüft wurden unter anderem AUTO/MANUAL, sechs vollständige Messkurven, Interpolation, Tanklimit, unveränderte Geometrie, Export-Reset-Import und SimBrief 793765. Hinzu kommen gezielte Update-Tests für Versionsvergleich, Offline-Fälle und Missionswiederherstellung. Testabdeckung ersetzt keine reale Flugleistungsfreigabe.','small')
p('Grundlage: App-Paket v1.9.23; app.js, logic-core.js, mission-backup.js, index.html, Daten-Dateien, README und zugehörige Regressionstests. Beschrieben wird der implementierte Umfang zum 12.10.2026.','small')
box('Begriffe','<b>FOB</b> Fuel on Board · <b>ETE</b> Estimated Time Enroute · <b>ETA</b> Estimated Time of Arrival · <b>AAR</b> Air-to-Air Refuelling · <b>WP</b> Waypoint · <b>NM</b> Nautical Miles · <b>RTB</b> Return to Base · <b>TOT</b> Time on Target<br/><br/><b>SIMULATION ONLY.</b> Keine offizielle Flugunterlage und nicht für realweltliche Einsatzplanung freigegeben.')


# Illustrated operating guide, source screenshots deliberately kept unchanged.
page(9,'Online-App und Updates','Empfohlener Zugang: offizielle Web-App oder daraus installierte Startbildschirm-App.')
box('App öffnen statt ZIP herunterladen','<link href="https://ife-eufi-fuelcalc-test.topstoni81.workers.dev/" color="#54624b">ife-eufi-fuelcalc-test.topstoni81.workers.dev</link><br/><br/>Diesen Link als Lesezeichen sichern oder im Browser zum Home-Bildschirm hinzufügen. Eine solche PWA verwendet weiterhin die offizielle Adresse. Ein GitHub-ZIP beziehungsweise eine lokale HTML-Kopie ist dagegen eine eigenständige, statische Kopie.')
h('Was die App ab v1.9.23 erkennt')
p('Beim Öffnen wird die öffentliche Versionsdatei auf GitHub geprüft. Bei erneuter Aktivierung erfolgt dies höchstens stündlich; beim Wiederverbinden wird erneut geprüft. SETTINGS → APP UPDATES &amp; USER GUIDE bietet zusätzlich CHECK FOR UPDATES. Die Versionsabfrage überträgt keine Missionsdaten oder Pilot-ID.')
table([
('OFFIZIELLE APP / PWA','Neue Version: UPDATE NOW erscheint. Der aktuelle Plan wird im Sitzungsspeicher dieses Tabs gesichert, die App neu geladen und der Plan wiederhergestellt. SAVE LOCAL bleibt unberührt. Kein automatisches Neuladen während der Planung.'),
('SEPARATE KOPIE','Dauerhafter Hinweis auf die offizielle App. Vor dem Wechsel EXPORT CURRENT MISSION, danach OPEN LATEST APP und IMPORT MISSION. Browser können die heruntergeladenen Quelldateien nicht selbst überschreiben.'),
('OFFLINE / FEHLER','Keine Behauptung, die Version sei aktuell. Die letzte vorhandene App bleibt nutzbar, soweit ihre Dateien offline verfügbar sind. Später CHECK FOR UPDATES wählen.'),
('ÄLTER ALS v1.9.23','Diese alten Kopien besitzen noch keine Update-Erkennung. Einmal zur offiziellen Adresse wechseln oder die neue Fassung übernehmen.')
],[140,359],['SITUATION','ABLAUF'])
h('Mission und Wiederherstellung')
p('Wiederherstellung umfasst die Eingaben einschließlich der gesicherten Performance-Daten. Sie ersetzt keinen unabhängigen JSON-Backup. Falls die automatische Wiederherstellung fehlschlägt, bleibt die Sitzungskopie erhalten und DOWNLOAD RECOVERY JSON wird angeboten. Bei einem Wechsel von Adresse, Browser oder Gerät ist JSON-Export/-Import erforderlich.')
p('Die aktuellen deutschen und englischen Anleitungen stehen direkt in SETTINGS und im GitHub-README. Heruntergeladene PDFs sind Momentaufnahmen; die verlinkte Online-Fassung liefert den aktuellen Stand.','small')
import runpy
runpy.run_path(str(Path(__file__).with_name('illustrated-guide.py')))['add_illustrations'](globals(),'de')
runpy.run_path(str(Path(__file__).with_name('fuel-background.py')))['add_background'](globals(),'de')

def decorate(c,doc):
 w,h=doc.pagesize;c.saveState()
 c.setFillColor(OLIVE);c.rect(0,h-9,w,9,fill=1,stroke=0)
 c.setFont('Bold',8);c.setFillColor(OLIVE);c.drawString(48,h-32,'EUROFIGHTER IFE / USER GUIDE')
 c.setFont('Body',8);c.setFillColor(MUTED);c.drawRightString(w-48,h-32,'v1.9.23  |  12 OCT 2026')
 c.setStrokeColor(LINE);c.line(48,43,w-48,43)
 c.setFont('Body',7.5);c.drawString(48,29,'SIMULATION ONLY  /  BEDIENHANDBUCH')
 c.setFont('Bold',8);c.drawRightString(w-48,29,f'{doc.page:02d} / 20');c.restoreState()
out=str(Path(__file__).resolve().parent.parent / 'Eurofighter_IFE_Anleitung.pdf')
doc=SimpleDocTemplate(out,pagesize=(595.28,841.89),rightMargin=48,leftMargin=48,topMargin=58,bottomMargin=58,title='Eurofighter IFE - Bedienhandbuch v1.9.23',author='Eurofighter IFE',subject='Anleitung für Simulator-Missionsplanung')
doc.build(S,onFirstPage=decorate,onLaterPages=decorate)
print(out)
