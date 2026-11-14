// Seiten des Materialplaners (Menü UI-1: Start · Material & Lager · System).
import { Startseite } from "./seiten/Start.jsx";
import { MaterialListe } from "./seiten/Material.jsx";
import { ArtikelFormular, ArtikelDetail } from "./seiten/Artikel.jsx";
import { GeraeteListe, GeraetDetail, GeraetPerCode } from "./seiten/Geraete.jsx";
import { EtikettenSeite, BestellungNeu, BestellungDetail, VorlageDesigner, EtikettenDruck } from "./seiten/Etiketten.jsx";
import { KabelAssistent } from "./seiten/KabelAssistent.jsx";
import { ScanSeite, Packansicht, Rueckgabeansicht } from "./seiten/Scannen.jsx";
import { LadezonenSeite } from "./seiten/Ladezonen.jsx";
import { normalisiereCode, istGeraetecode, normalisiereProjektcode } from "@lager/domain/codes.js";

import { VerwaltungStart, ScannerVerwaltung, ArbeitsplatzVerwaltung } from "@lager/ui/verwaltung.jsx";

export const SEITEN = [
  { muster: "/", Komponente: Startseite },
  { muster: "/material", Komponente: MaterialListe },
  { muster: "/material/neu", Komponente: ArtikelFormular },
  { muster: "/material/kabel-assistent", Komponente: KabelAssistent },
  { muster: "/material/:id/bearbeiten", Komponente: ArtikelFormular },
  { muster: "/material/:id", Komponente: ArtikelDetail },
  { muster: "/geraete", Komponente: GeraeteListe },
  { muster: "/geraete/code/:code", Komponente: GeraetPerCode },
  { muster: "/geraete/:id", Komponente: GeraetDetail },
  { muster: "/etiketten", Komponente: EtikettenSeite },
  { muster: "/etiketten/druck", Komponente: EtikettenDruck },
  { muster: "/etiketten/bestellungen/neu", Komponente: BestellungNeu },
  { muster: "/etiketten/bestellungen/:id", Komponente: BestellungDetail },
  { muster: "/etiketten/vorlagen/:id", Komponente: VorlageDesigner },
  { muster: "/scan", Komponente: ScanSeite },
  { muster: "/projekte/:id/packen", Komponente: Packansicht },
  { muster: "/projekte/:id/rueckgabe", Komponente: Rueckgabeansicht },
  { muster: "/zonen", Komponente: LadezonenSeite },
  { muster: "/verwaltung", Komponente: VerwaltungStart },
  { muster: "/verwaltung/scanner", Komponente: ScannerVerwaltung },
  { muster: "/verwaltung/arbeitsplaetze", Komponente: ArbeitsplatzVerwaltung },
];

/** Globales Codefeld (FA-16): Gerät → hier, Projekt → Productionplaner. Vollständig in Phase 6. */
export function beiCode(code, { navigiere, oeffneAndereApp }) {
  const p = normalisiereProjektcode(code);
  if (p) return oeffneAndereApp(`/projekte/nummer/${p}`);
  const g = normalisiereCode(code);
  if (istGeraetecode(g)) return navigiere(`/geraete/code/${encodeURIComponent(g)}`);
  navigiere(`/geraete/code/${encodeURIComponent(code)}`);
}
