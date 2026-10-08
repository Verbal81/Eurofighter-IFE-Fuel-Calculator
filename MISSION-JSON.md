# Update v1.9.18: Schema 2

The current portable format is schemaVersion 2, appVersion 1.9.18, performance.modelVersion
`ife-forward-transfer-2`. Two additional required fields: `aarTransferRate` (numeric text or empty)
and `aarRateSource` (MANUAL / TANKER PRESET / RECEIVER PRESET). Both persist through JSON and local saves.
An empty rate means N/A / RATE REQUIRED, never a default calibration. Editing a rate uses MANUAL provenance.

Schema 1 with `ife-forward-1` is migrated safely to schema 2: rate stays empty and source is MANUAL,
because these fields did not exist then. All previous inputs remain intact. Computed snapshots are ignored.
Unknown schemas/models still fail validation before mutation. See README v1.9.18 for the transfer/orbit
phase assumption, equations and capacity checks. The original schema-1 documentation follows for context.

---

# Vollständiges Missions-Backup – Schema 1

## Verwendung

Unter **MISSION / Einsatzdaten** stehen **EXPORT CURRENT MISSION** und **IMPORT MISSION**.
Export lädt den aktuellen Plan als JSON-Datei herunter. Es muss nicht vorher SAVE LOCAL gedrückt werden.
Import wählt eine zuvor exportierte JSON-Datei aus und meldet nach erfolgreicher Neuberechnung
**Mission successfully imported**. JSON ist das vollständige Backupformat. Die Datei enthält keine
Pilot-Anmeldung, keine Browser-Favoriten und keine Anzeigepräferenzen; diese beeinflussen die
Missionsberechnung nicht. Die Datei kann unabhängig vom Browser-Speicher archiviert werden.

## Struktur

```json
{
  "format": "eurofighter-ife-mission",
  "schemaVersion": 1,
  "appVersion": "1.9.17",
  "exportedAt": "UTC timestamp",
  "mission": {
    "fields": {},
    "route": [],
    "toggles": {},
    "references": {},
    "source": "manual",
    "missionMeta": null,
    "holdModel": "level-at-waypoint-v1",
    "performance": {
      "modelVersion": "ife-forward-1",
      "aircraftProfile": {},
      "fuelData": {}
    },
    "navigation": {"airports": [], "waypoints": []}
  },
  "calculated": {
    "informationalOnly": true,
    "summary": {},
    "legs": [],
    "aar": {},
    "diverts": []
  }
}
```

Das Beispiel zeigt nur die Struktur, es ist keine importierbare Mission. Eine vollständige Datei
wird von der App erzeugt. Die verbindlichen Pflichtfelder/Typen prüft `mission-backup.js`.

| Gesicherter Bereich | Quelle und Inhalt |
|---|---|
| Mission | `fields`: Name, Typ, Datum UTC, Startzeit, Aircraft, Callsign, DEP/ARR, Platzhöhen, Notizen |
| Fuel | `fields`: Onboard, Taxi-Minuten, Reserve, Zuschlag, sämtliche manuellen Schwellen und AAR-Inputs; Tankkapazität und Ground-Rate im aktiven `aircraftProfile` |
| Route | Exakte interne `state.route`: Reihenfolge, Namen, Koordinaten soweit vorhanden, ALT, Mach in voller Präzision, Wind, NM, DIST/TIME-Modus, manuelle Leg-Minuten, Hard Times und Planzeiten |
| Holds | `route[].holdMin`; 0 bedeutet aus, positiver Wert ein. In dieser App gibt es keinen separaten Hold-Schalter. `holdModel` fixiert Verbrauch aus Höhe/Mach am WP plus Zuschlag. WP IN/OUT wird neu berechnet; Joker-Basis steht in `fields.jokerBasis`. |
| AAR | Vier Schalter unter `toggles`, Referenz unter `references.aarWp`; ARIP, ARCP, geplantes ARCT/OUT, FL, KIAS, Konfiguration, Dauer, Target OUT, manueller Gross Onload, Tankermuster/Callsign/Frequenz, Bingo 2 und RTB unter `fields` |
| Bingo/Joker | Referenzindizes, Auto/Manual-Schalter, manuelle Werte, Joker-Puffer und IN/OUT-Basis |
| Diverts | Beide ICAOs, gewählter Divert, Höhe/Mach/Wind, manuelle Distanzen/Höhen, Recovery Extra, Reserve; etwaige Briefing-Fuelwerte exakt unter `missionMeta` |
| Cruise/Performance | Cruise-Distanzquelle (Route/Direkt/Manuell), DIST/TIME, NM/Minuten, Höhe/Mach/Wind, eigene Platzhöhen; Climb-/Descent-/Ground-Raten, Transition-TAS, Grenzen und gesamte aktive Fuel-Kurve im Performance-Snapshot |
| Low Level | Kein separater Low-Level-Schalter im Ausgangsstand: Eingaben stehen in den betroffenen Route-WPs; verwendete Interpolation und Messwerte in `fuelData`. |
| Navigation | Vollständiger verwendeter Navigations-Snapshot, damit etwa automatische Divert-Distanz und Platzhöhe auf einem anderen Gerät dieselbe Grundlage verwenden |
| Ergebnisse | Ground Fuel, Block Required, Required T/O, ETE, Holds, AAR Burn/FOB, Joker/Bingo, Landing FOB und übrige Ergebnisse nur unter `calculated`; werden beim Import nicht als Inputs gelesen |

Leere Eingaben bleiben leer; unbekannte Koordinaten bleiben abwesend. Import schätzt keine fehlenden
Werte, rundet kein Mach und kürzt die Route nicht auf das frühere Save-Limit von 40 WPs.
Performance-/Navigations-Snapshots gelten für die geladene Mission. NEW MANUAL MISSION, LOAD DEMO
und LOAD PRESET verwenden wieder die installierten App-Grundlagen. Eine bewusste neue
Aircraft-Auswahl verwendet dessen installiertes Profil. Der optionale Preset wird nie automatisch geladen.

## Versionen und Validierung

Schema 1 ist das erste vollständige portable Format. Derselbe Schema-/Modellstand wird direkt geladen.
Unbekannte Versionen, unbekannte Berechnungs-/Hold-Modelle, fehlende Pflichtfelder, ungültige Typen,
ungültige Koordinaten oder Referenzen, gefährliche Objektschlüssel und Dateien über 5 MB werden
vor der State-Änderung abgewiesen. Eine unvollständige Pflichtangabe wird mit ihrem JSON-Pfad gemeldet.
Für Schema 1 werden keine fehlenden Felder mit Defaultwerten aufgefüllt. Zusätzliche interne
Route-Annotationen werden unverändert mitgenommen. Eine Fehlerbehandlung stellt bei einem
unerwarteten Fehler während des Anwendens den vorigen Missionszustand wieder her.

Ältere Browser-Payloads (`version` statt `schemaVersion`) sind keine vollständigen portablen Backups:
Sie enthalten unter anderem keine Performance-/Navigations-Snapshots und keine Cruise-Distanzquelle.
Als Datei werden sie deshalb mit einer konkreten Erklärung abgewiesen, statt fehlende Werte zu erraten.
Auf dem ursprünglichen Gerät können sie weiterhin mit LOAD LOCAL geladen, geprüft und anschließend
mit EXPORT CURRENT MISSION vollständig gesichert werden. Es gibt keine ältere portable
Schema-Version, für die eine sichere Migration vorgetäuscht wird. Künftige Änderungen müssen explizite
Migrationen oder eine neue inkompatible Schema-/Modellversion erhalten.

## Browser-Speicher

Missionen stehen in `localStorage`, Hauptschlüssel `vgaf_mission_v08`, mit bestehenden Fallbacks
`vgaf_mission_v07`, `vgaf_mission_v05`, `vgaf_mission_v04`. Kein Missions-State in `sessionStorage`
oder IndexedDB gefunden. Der Service Worker speichert App-Dateien, keine Missions-Eingaben.

Neue SAVE-LOCAL-Aufrufe schreiben denselben vollständigen JSON-Umschlag wie der Datei-Export.
Bestehende Saves werden durch ein App-Update, Export, Datei-Import oder Preset-Laden nicht gelöscht
oder überschrieben. Nur bewusstes SAVE LOCAL ersetzt wie bisher den aktuellen lokalen Speicherplatz.
Alte Payloads bleiben über den bisherigen Loader lesbar, einschließlich seiner historischen Migrationen.
Eine App-Version vor 1.9.17 kann den neuen vollständigen Save-/Export-Umschlag nicht lesen.

## Verifikation

- Vollständige allgemeine Testmission konfigurieren → JSON serialisieren → Demo laden → JSON importieren.
  Exakte Gleichheit aller exportierten Inputs, Routenobjekte und neu berechneten Summary-/Leg-/AAR-/Divertwerte.
- Cruise-Ausgaben zusätzlich mit der echten Cruise-Funktion verglichen, einschließlich manueller Distanz,
  Route, Direktdistanz und Zeitmodus.
- AUTO und MANUAL AAR, manuelle/automatische Schwellen, Joker IN/OUT, Hard Time, nicht gerundete Holds/Mach.
- Zielgerät mit anderen Tank-/Ground-/Climb-/Fuel-/Navdaten: gleicher Plan durch die archivierten Grundlagen.
- Export-Download als JSON Blob und Import-Dateihandler geprüft; Browser-Saves bleiben unverändert.
- Fehlende Felder/Versionen/ungültige Daten werden ohne Änderungen abgewiesen. Ergebnis-Snapshots werden ignoriert.
- 52 WPs ohne Abschneiden; optionale Preset-Mission bleibt exakt und Demo bleibt Standard.
- Route: DOM-Ereignisse für Auf-/Zuklappen, neue Feldreihenfolge, Eingabe und Präzision geprüft.
- 15 bestehende Regressionsfälle weiterhin bestanden. Kein Test auf dem konkreten Tablet verfügbar.
