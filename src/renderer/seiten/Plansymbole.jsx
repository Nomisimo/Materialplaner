// Plan-Symbole für yEd (FA-53): Piktogramm je Artikel, Symbolbibliothek.graphml und alle SVG als ZIP.
import React, { useState } from "react";
import { Seite, Section, Knopf, Auswahl, Meldung, Eingabe, Leerzustand, useDaten } from "@lager/ui/bausteine.jsx";
import { useLager, useLive } from "@lager/ui/huelle.jsx";
import { ladeHerunter } from "@lager/ui/download.js";
import { fehlerText } from "@lager/ui/texte.js";
import { zeitpunktAnzeige } from "@lager/domain/zeit.js";
import { PIKTOGRAMM_LISTE } from "@lager/domain/plansymbole.js";

const bild = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export function PlansymboleSeite() {
  const { api, nutzer } = useLager();
  const d = useDaten(() => api.get("/api/v1/plansymbole"), []);
  useLive(["artikel"], () => d.laden());
  const [m, setM] = useState(null);
  const [q, setQ] = useState("");
  const darf = nutzer.admin || nutzer.rechte?.material === "w";
  const lade = (pfad, name) => ladeHerunter(api, pfad, name).catch((e) => setM({ level: "error", text: fehlerText(e) }));
  const setze = async (a, plansymbol) => {
    try { await api.put(`/api/v1/artikel/${a.id}`, { plansymbol }); setM({ level: "success", text: `Symbol für „${a.name}“ gespeichert. Die Symbolbibliothek ist aktualisiert.` }); d.laden(); }
    catch (e) { setM({ level: "error", text: fehlerText(e) }); }
  };
  const zeilen = (d.daten?.zeilen || []).filter((a) => !q || `${a.name} ${a.kategorie}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Seite titel="Plan-Symbole" untertitel="Piktogramme je Artikel für Pläne in yEd"
      aktionen={<>
        <Knopf icon="Download" onClick={() => lade("/api/v1/plansymbole/Symbolbibliothek.graphml", "Symbolbibliothek.graphml")}>Symbolbibliothek (yEd)</Knopf>
        <Knopf icon="Download" onClick={() => lade("/api/v1/plansymbole/svg.zip", "Plan-Symbole.zip")}>Alle SVG (ZIP)</Knopf></>}>
      {m && <Meldung level={m.level} text={m.text} onSchliessen={() => setM(null)} />}
      {d.fehler && <Meldung level="error" text={d.fehler} />}
      <p className="lp-hinweis" style={{ marginTop: 0 }}>In yEd: Palette → „Sektion importieren“ → Symbolbibliothek.graphml. Die Datei wird bei jeder Artikeländerung neu erzeugt{d.daten?.bibliothek ? ` (zuletzt ${zeitpunktAnzeige(d.daten.bibliothek)})` : ""}. Nicht in yEd selbst geprüft.</p>
      <Section>
        <div style={{ maxWidth: 320, marginBottom: 12 }}><Eingabe type="search" aria-label="Artikel filtern" placeholder="Artikel oder Kategorie" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {!zeilen.length ? <Leerzustand text="Keine Artikel. Lege Material an, dann erscheinen hier die Symbole." icon="Shapes" /> :
          <div className="lp-raster" data-testid="symbole">{zeilen.map((a) => (
            <div key={a.id} className="lp-section" style={{ padding: 12, display: "flex", gap: 12, alignItems: "center" }} data-symbol={a.id}>
              <img src={bild(a.svg)} width={64} height={76} alt={`Symbol ${a.titel}`} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{a.name}</strong>
                <div className="lp-hinweis">{a.kategorie} · {a.titel}{a.automatisch ? " (automatisch)" : ""}</div>
                {darf && <Auswahl aria-label={`Symbol für ${a.name}`} leer="automatisch" value={a.plansymbol} onChange={(e) => setze(a, e.target.value)} optionen={PIKTOGRAMM_LISTE} />}
                <Knopf klein art="geist" icon="Download" onClick={() => lade(`/api/v1/plansymbole/${a.id}.svg`, a.datei)}>SVG</Knopf>
              </div>
            </div>
          ))}</div>}
      </Section>
    </Seite>
  );
}
