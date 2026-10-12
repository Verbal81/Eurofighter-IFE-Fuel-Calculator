"""Verified v1.9.23 browser screenshots, Sentinel preset; documentation only."""
from pathlib import Path
from reportlab.platypus import Flowable, Spacer, Table, TableStyle
from reportlab.lib.utils import ImageReader

class ScreenshotCrop(Flowable):
    """Clip an original screenshot on the PDF canvas without changing its pixels."""
    def __init__(self, name, rect, width=499):
        Flowable.__init__(self)
        self.image=ImageReader(str(Path(__file__).with_name(name)))
        self.iw,self.ih=self.image.getSize()
        self.x,self.y,self.cw,self.ch=rect
        self.width=width;self.height=width*self.ch/self.cw
    def draw(self):
        c=self.canv;s=self.width/self.cw
        c.saveState();p=c.beginPath();p.rect(0,0,self.width,self.height);c.clipPath(p,stroke=0)
        c.drawImage(self.image,-self.x*s,(self.y+self.ch-self.ih)*s,width=self.iw*s,height=self.ih*s)
        c.restoreState()

def add_illustrations(g, lang):
    S,page,p,h,box,table,P=[g[k] for k in ('S','page','p','h','box','table','P')]
    de=lang=='de'
    def tr(a,b):return a if de else b
    def shot(name,rect,width=499):
        S.append(ScreenshotCrop(name,rect,width));S.append(Spacer(1,10))
    page(10,tr('AAR richtig einstellen','Set up AAR'),tr('Bildbeispiel: RHINE SENTINELLE / GHOST. Optional laden, nicht als Standard.','Worked example: RHINE SENTINELLE / GHOST. Load optionally, never as a default.'))
    shot('sentinel-aar.jpg',(34,263,847,570))
    h(tr('1 / Ort, Zeit und Flugzustand','1 / Position, time and flight condition'))
    p(tr('AAR after waypoint legt das Ereignis hinter RP ANGIE. ARCT PLAN 17:50Z und AAR OUT PLAN 18:00Z sind Planangaben. FL210, 280 KIAS und 3 BAGS bestimmen den verwendeten Verbrauchs- und Ratenansatz.','AAR after waypoint places the event after RP ANGIE. ARCT PLAN 17:50Z and AAR OUT PLAN 18:00Z are planned times. FL210, 280 KIAS and 3 BAGS determine the applicable consumption and transfer-rate model.'))
    h(tr('2 / Zwei unabhängige Entscheidungen','2 / Two independent choices'))
    p(tr('<b>Transfer rate mode AUTO</b> wählt die Rate aus den verfügbaren Daten. <b>Fixed / manual AAR onload</b> legt dagegen die Kraftstoffmenge fest. AUTO-Rate und manuelle 966 kg können gleichzeitig aktiv sein.','<b>Transfer rate mode AUTO</b> selects a rate from the available data. <b>Fixed / manual AAR onload</b> sets the fuel quantity instead. An AUTO rate and a manual 966 kg onload can be active together.'))
    box(tr('Schätzung erkennbar lassen','Keep estimates visible'),tr('AUTO REFERENCE ESTIMATE bedeutet hier: Referenzmessung S2, keine direkte Messung für FL210 / 280 KIAS / 3 BAGS. Den Eigenverbrauch ermittelt die App automatisch. N/A / RATE REQUIRED bedeutet: keine nutzbare Rate, keine bestätigte Transferzeit.','AUTO REFERENCE ESTIMATE here means reference run S2, not a direct measurement at FL210 / 280 KIAS / 3 BAGS. The app calculates receiver fuel flow automatically. N/A / RATE REQUIRED means no usable rate and no verified transfer time.'))

    page(11,tr('Den AAR-Bon lesen','Read the AAR ticket'),tr('Transfer, Eigenverbrauch und geplante Event-Dauer getrennt betrachten.','Read fuel transfer, receiver burn and planned event duration separately.'))
    pic=ScreenshotCrop('sentinel-aar-detail.jpg',(905,130,384,748),239)
    notes=[
      ('FOB IN',tr('6.256 kg vor dem Ereignis.','6,256 kg before the event.')),
      ('GROSS ONLOAD',tr('966 kg vom Tanker. Das ist nicht der Nettozuwachs im Tank.','966 kg from the tanker. This is not the net increase in tank contents.')),
      ('TRANSFER RATE / EST XFER TIME',tr('488,02 kg/min und 1,98 min sind hier modellierte Schätzwerte. RATE SOURCE nennt die Grundlage.','488.02 kg/min and 1.98 min are modeled estimates here. RATE SOURCE identifies the basis.')),
      ('AAR EVENT',tr('10 min insgesamt: etwa 1,98 min Transfer plus 8,02 min Orbit/Restzeit.','10 min overall: about 1.98 min transfer plus 8.02 min orbit/remaining time.')),
      ('AAR BURN',tr('324 kg insgesamt: 64 kg während Transfer plus 260 kg in der übrigen Zeit.','324 kg total: 64 kg during transfer plus 260 kg during the remaining time.')),
      ('FOB OUT / AAR OUT',tr('6.898 kg um 18:00Z. Nachfolgende Route rechnet von diesem Ergebnis weiter.','6,898 kg at 18:00Z. The subsequent route continues from this result.')),
    ]
    col=[]
    for title,body in notes:col += [P(title,'h2'),P(body)]
    t=Table([[pic,col]],colWidths=[252,247]);t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),9)]));S.append(t);S.append(Spacer(1,10))
    box('FOB AFTER LOAD = ACCOUNTING ONLY',tr('7.222 kg ist FOB IN + Gross Onload, kein physischer Tankstand. Während des Transfers wird bereits Fuel verbraucht. Die Kapazitätsprüfung betrachtet den tatsächlichen Tankinhalt. Alle Beispielzahlen sind gerundet.','7,222 kg is FOB IN + Gross Onload, not a physical tank state. Fuel is already being consumed during transfer. The capacity check uses actual tank contents. All example figures are rounded.'))

    page(12,tr('Fuel Order, Joker und Bingo','Fuel order, Joker and Bingo'),tr('Bedarf, tatsächlicher FOB und Entscheidungsschwellen nicht verwechseln.','Separate requirements, actual planned fuel and decision thresholds.'))
    shot('sentinel-fuel.jpg',(155,315,1022,359))
    h(tr('1 / REQUIRED ist ein Mindestbedarf','1 / REQUIRED is a minimum requirement'))
    p(tr('ON BOARD 7.213 kg ist der eingegebene Startfuel. Nach Ground Fuel bleiben PLANNED T/O FOB 7.085 kg. T/O REQ 6.264 kg ist dagegen der berechnete Bedarf beim Start. UPLIFT 0 kg heißt: Für diesen Plan muss am Boden nichts ergänzt werden.','ON BOARD 7,213 kg is the entered start fuel. After ground fuel, PLANNED T/O FOB is 7,085 kg. T/O REQ 6,264 kg is the calculated take-off requirement. UPLIFT 0 kg means no additional ground uplift is required for this plan.'))
    h(tr('2 / Referenzpunkt immer mitlesen','2 / Always read the reference point'))
    p(tr('JOKER 6.449 kg gilt hier für <b>S-PUSH IN</b>. Der dortige Hold ist noch zu fliegen und gehört zum verbleibenden Bedarf. Bei WP OUT wäre dieser Hold bereits verbraucht. Der Joker Buffer von 795 kg ist eine zusätzliche Marge.','JOKER 6,449 kg applies to <b>S-PUSH IN</b>. The hold there is still to be flown and is part of the remaining requirement. At WP OUT that hold would already be completed. The 795 kg Joker Buffer is an additional margin.'))
    h(tr('3 / USED bestimmt den Divert','3 / USED selects the divert'))
    p(tr('USED ETNN: 1.253 kg plus 600 kg Landing Reserve ergibt hier 1.853 kg Recovery Floor. Bingo bezieht sich auf Arrival ETSN IN; dort ist die verbleibende Mission null. BINGO 2 mit 1.953 kg und B2 → RTB ETNN ist ein separat geplanter Wert.','USED ETNN: 1,253 kg plus 600 kg landing reserve gives a 1,853 kg recovery floor here. Bingo is referenced to arrival ETSN IN; remaining mission fuel there is zero. BINGO 2 at 1,953 kg and B2 → RTB ETNN are separately planned entries.'))
    box(tr('Kein allgemeiner Grenzwert','Not a universal threshold'),tr('Joker und Bingo ändern sich mit Route, Referenzpunkt, Hold, Divert und Reserven. Die hier gezeigten Ergebnisse gehören zum geladenen Preset und zur aktuellen Datenbasis.','Joker and Bingo change with route, reference point, hold, divert and reserves. These results belong to the loaded preset and current performance data.'))

    page(13,tr('Hold, WP IN und WP OUT','Hold, WP IN and WP OUT'),tr('Flight Log: vom AAR-Ereignis über S-PUSH bis zum Hard-Time-Ziel.','Flight log: from the AAR event through S-PUSH to the hard-time target.'))
    shot('sentinel-flightlog.jpg',(157,446,1018,455))
    h(tr('S-PUSH im Detail','S-PUSH in detail'))
    table([
      ('WP IN','18:13Z',tr('FOB 6.475 kg vor dem Hold.','FOB 6,475 kg before the hold.')),
      ('HOLD','16.7 min',tr('668 kg Hold Burn; Anzeige gerundet.','668 kg hold burn; display rounded.')),
      ('WP OUT / GO','18:30Z',tr('FOB 5.807 kg nach dem Hold.','FOB 5,807 kg after the hold.')),
      ('TGT-SUIP','18:50Z',tr('HARD 18:50Z: verbindlicher TOT-Anker.','HARD 18:50Z: controlling TOT anchor.')),
    ],[115,95,289],[tr('BEZUG','REFERENCE'),tr('ZEIT','TIME'),tr('BEDEUTUNG','MEANING')])
    p(tr('Der Hold verschiebt die Folgezeiten und verbraucht Kraftstoff, verändert aber keine Koordinaten oder LEG NM. Die 47,1 NM zu S-PUSH bleiben bestehen. MIN EDIT / ETE beschreibt den Leg; HOLD ist die zusätzliche Zeit am Waypoint.','The hold shifts subsequent times and consumes fuel, but does not change coordinates or LEG NM. The 47.1 NM leg to S-PUSH remains unchanged. MIN EDIT / ETE describes the leg; HOLD is additional time at the waypoint.'))
    box(tr('PLAN und HARD unterscheiden','Distinguish PLAN and HARD'),tr('PLAN markiert einen Planwert. HARD kennzeichnet einen verbindlichen Zeitanker. Der Preset enthält bereits Speed-/Hold-Anpassungen für den TOT. M0,72 und M0,58 sind gerundete Anzeigen; intern bleibt die volle Präzision erhalten. Eine neue Zeitabweichung prüfen, nicht durch veränderte Distanzen kaschieren.','PLAN marks a planned value. HARD identifies a binding time anchor. The preset already includes speed/hold adjustments for the TOT. M0.72 and M0.58 are rounded displays; full precision is retained internally. Investigate a new timing conflict rather than hiding it with altered distances.'))

    page(14,tr('Abkürzungen & Leseschlüssel','Abbreviations & reading key'),tr('Englische App-Begriffe verständlich erklärt.','A quick reference for the terms used throughout the app.'))
    rows=[
      ('AAR','Air-to-Air Refuelling',tr('Luftbetankung; in dieser App Simulatorplanung.','Air refuelling; simulator planning in this app.')),
      ('ARIP','Air Refuelling Initial Point',tr('Anfangspunkt für die Annäherung zur Betankung.','Initial point for the approach to refuelling.')),
      ('ARCP','Air Refuelling Control Point',tr('Kontroll-/Rendezvous-Referenzpunkt; hier RP ANGIE.','Control/rendezvous reference point; RP ANGIE here.')),
      ('ARCT','Air Refuelling Control Time',tr('Zeitbezug für das Rendezvous am ARCP. PLAN und berechnete Zeit prüfen.','Time reference for the rendezvous at the ARCP. Compare PLAN and calculated time.')),
      ('FOB','Fuel on Board',tr('Kraftstoff an Bord; IN vor, OUT nach dem Ereignis.','Fuel carried; IN before, OUT after the event.')),
      ('FL / KIAS','Flight Level / Knots Indicated Airspeed',tr('FL210 = 21.000 ft Druckhöhe bei Standarddruck. KIAS ist angezeigte Fluggeschwindigkeit.','FL210 = 21,000 ft pressure altitude at standard pressure. KIAS is indicated airspeed.')),
      ('CONF / 3 BAGS','Configuration / three external tanks',tr('Konfiguration / drei Außentanks. CLEAN = ohne Außentanks.','Configuration / three external tanks. CLEAN = no external tanks.')),
      ('EST / XFER','Estimated / Transfer',tr('Geschätzt / Übertragung. EST XFER TIME ist die geschätzte reine Transferzeit.','Estimated / transfer. EST XFER TIME is estimated time with fuel flowing.')),
      ('FREQ / TBC','Frequency / To Be Confirmed',tr('Funkfrequenz / noch zu bestätigen; kein verifizierter Frequenzauftrag.','Radio frequency / to be confirmed; not a verified frequency assignment.')),
      ('WP / ETA / ETE','Waypoint / Estimated Time of Arrival / Estimated Time Enroute',tr('Wegpunkt / Ankunftszeit / Zeit unterwegs.','Route point / arrival time / time enroute.')),
      ('TOT / Z','Time on Target / Zulu',tr('Zeit am Ziel / UTC-Zeit, keine lokale Sommerzeit.','Time at target / UTC time, not local daylight time.')),
      ('B2 / RTB','Bingo 2 / Return to Base',tr('Separater zweiter Schwellwert / Rückkehr zur Basis.','Separate second threshold / return to base.')),
      ('REQ / T/O','Required / Take-off',tr('Erforderlicher Bedarf / Start. Nicht mit geplantem FOB gleichsetzen.','Required amount / take-off. Not the same as planned FOB.')),
    ]
    table([(a,'<b>'+b+'</b><br/>'+c) for a,b,c in rows],[110,389],[tr('KÜRZEL','TERM'),tr('BEDEUTUNG IN DER ANLEITUNG','MEANING IN THIS GUIDE')])
    p(tr('Bildquelle: offizielle Web-App v1.9.23, 12.10.2026, optionaler RHINE-SENTINELLE-Preset. Ausschnitte aus echten Screenshots; keine nachgebauten Benutzeroberflächen. Diese Ergänzung ändert keine App- oder Missionswerte.','Image source: official web app v1.9.23, 12 Oct 2026, optional RHINE SENTINELLE preset. Crops from actual screenshots, not recreated interfaces. This documentation update changes no app or mission values.'),'small')
