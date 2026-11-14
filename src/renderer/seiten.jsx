// Seiten des Materialplaners (Menü UI-1: Start · Material & Lager · System).
import { Startseite } from "./seiten/Start.jsx";
import { MaterialListe } from "./seiten/Material.jsx";
import { ArtikelFormular, ArtikelDetail } from "./seiten/Artikel.jsx";
import { GeraeteListe, GeraetDetail, GeraetPerCode } from "./seiten/Geraete.jsx";
import { normalisiereCode, istGeraetecode, normalisiereProjektcode } from "@lager/domain/codes.js";

export const SEITEN = [
  { muster: "/", Komponente: Startseite },
  { muster: "/material", Komponente: MaterialListe },
  { muster: "/material/neu", Komponente: ArtikelFormular },
  { muster: "/material/:id/bearbeiten", Komponente: ArtikelFormular },
  { muster: "/material/:id", Komponente: ArtikelDetail },
  { muster: "/geraete", Komponente: GeraeteListe },
  { muster: "/geraete/code/:code", Komponente: GeraetPerCode },
  { muster: "/geraete/:id", Komponente: GeraetDetail },
];

/** Globales Codefeld (FA-16): Gerät → hier, Projekt → Productionplaner. Vollständig in Phase 6. */
export function beiCode(code, { navigiere, oeffneAndereApp }) {
  const p = normalisiereProjektcode(code);
  if (p) return oeffneAndereApp(`/projekte/nummer/${p}`);
  const g = normalisiereCode(code);
  if (istGeraetecode(g)) return navigiere(`/geraete/code/${encodeURIComponent(g)}`);
  navigiere(`/geraete/code/${encodeURIComponent(code)}`);
}
