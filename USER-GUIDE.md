# Eurofighter IFE Fuel Calculator — User Guide
Version 1.9.19 · English

## Open and language
Launch the browser app at https://ife-eufi-fuelcalc-test.topstoni81.workers.dev/.
English is the default language. An explicitly saved language preference may be restored. Use SETTINGS to switch language if needed.

## Mission
Open MISSION and enter or review mission identification, aircraft/profile, start fuel (FOB), departure and arrival, mission start (Zulu), taxi time, reserve and any consumption surcharge. Check values before relying on outputs. Optional mission presets should be reviewed rather than assumed accurate for a new flight.

## Route
Use ROUTE to review waypoints, distances, altitudes, Mach and timing. On touch devices, tap a waypoint name to expand its card. Editing a field commits when you leave it or press Enter. Confirm waypoint order and total route distance after editing.

## Cruise
In CRUISE, review the chosen calculation mode and the relevant distance/time, altitude and Mach inputs. Outputs depend on the selected aircraft profile and bundled fuel-flow data.

## AAR (air-to-air refuelling)
Enter tanker details, planned times, target FOB and event parameters as applicable. Version 1.9.18+ supports an effective gross transfer rate (kg/min) and a separate AAR event duration. A transfer rate must be entered explicitly; the calculator does not supply a verified tanker rate. If the rate is missing, transfer time is not available. A CHECK or infeasible result requires you to review the inputs; do not assume the application corrected them automatically.

## BINGO / DIVERT
Review diversion selection, fuel reserve and calculated remaining fuel. Verify that the underlying mission, route and aircraft data are appropriate.

## DATA CARD
Use DATA CARD to review or print the calculated summary. Verify all fields and any warnings before sharing it.

## Save, export and import
Use the app's local save controls for browser-local storage. Use MISSION → EXPORT CURRENT MISSION to download a portable JSON backup and MISSION → IMPORT MISSION to restore it. Imported mission data are validated and recalculated. Keep backups of important missions; browser data can be cleared.

## Offline use
The application includes a web app manifest and service worker. Offline behavior depends on a successful prior load and browser support; confirm availability on your own device before relying on it.

## Troubleshooting
- Old interface after an update: refresh the page; if needed, close and reopen it.
- Unexpected language: check SETTINGS and any saved language preference.
- Transfer time unavailable: check that a valid effective gross transfer rate was entered.
- Missing or unexpected calculations: check mission, route, aircraft profile, fuel values and any warnings.
- Import rejected: verify the JSON came from a supported mission export and was not modified.

## Important limitations
This is a planning/simulation aid, not a certified aircraft performance or operational flight-planning system. Fuel-flow, navigation and tanker-transfer data require independent verification. Do not use the tool as the sole basis for real-world flight safety decisions.

Project: https://github.com/Verbal81/Eurofighter-IFE-Fuel-Calculator
