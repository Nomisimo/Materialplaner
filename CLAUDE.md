# Materialplaner

Electron-App der Planer-Familie für Material und Lager. **Projektweite Regeln, Fortschritt und Spec liegen im Repo `Planer-Lager-Core`** (CLAUDE.md, PROGRESS.md, docs/). Hier nur App-Spezifisches.

## Zuständig für
Material/Artikel (FA-01–05, R-71–73), Geräte + Codes (R-16–22), Etiketten, Designer, Bestellung, Kabel (FA-10–14, R-29, R-67–70), Scannen/Packen/Rückgabe (FA-15–22, Spec 5.5–5.7, R-46–54), Verladen (R-60/61), Prüfstatus (5.10), Ladezonen (FA-23/24, R-55–59), Arbeitsplätze + Mitarbeiter verwalten (FA-25), Inventur (FA-06), Reparatur/Wartung (FA-07), Lagerorte (FA-08), Schadensdoku (FA-09), Plan-Symbole yEd (FA-53), Verwaltung für Admins.

## Menü (UI-1, nur dieser App-Teil)
Start (Übersicht, Suche) · Material & Lager (Material, Geräte, Etiketten, Plan-Symbole, Ladezonen, Code scannen, Inventur, Reparatur) · System (Verwaltung). Aufträge-Einträge (Projekte, Angebote …) springen per Deep-Link in den Productionplaner.

## Besonderheiten
- Arbeitsplatz-Modus: Vollbild-Kiosk-Fenster lädt `station-web` vom Server (gleiche Seiten wie im Browser).
- Etikettendruck über Electron `webContents.print` mit Seitengröße aus der Vorlage (FA-14).
- Deep-Link-Protokoll `materialplaner://` (siehe Core docs/ARCHITEKTUR.md §4).

## Befehle
`npm start` (Build + Electron, Server-URL aus `LAGER_SERVER_URL`), `npm test`, `npm run dist:mac`, `npm run dist:win`.
