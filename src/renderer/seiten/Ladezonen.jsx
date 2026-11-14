// Ladezonen (FA-23): Belegung, Zuweisen/Freigeben, automatische Verteilung (R-58), Prioritätsliste (R-55), Verwaltung für Admins.
import React, { useState } from "react";
import { Seite, Section, Knopf, Tabelle, Auswahl, Eingabe, Feld, Meldung, Modal, Badge, Toggle, Leerzustand, useDaten, useFormular, useBestaetigung } from "@lager/ui/bausteine.jsx";
import { useLager, useLive } from "@lager/ui/huelle.jsx";
import { fehlerText } from "@lager/ui/texte.js";
import { PROJEKT_STATUS } from "@lager/domain/projekt.js";
import { datumAnzeige, zeitpunktAnzeige } from "@lager/domain/zeit.js";

const LEER = { bezeichnung: "", plaetze: 1, flaeche_m2: "", beschreibung: "", aktiv: true, reihenfolge: 0 };
const termin = (p) => (p.beginn ? datumAnzeige(p.beginn) : "ohne Termin");

export function LadezonenSeite() {
  const { api, nutzer, navigiere } = useLager();
  const zonen = useDaten(() => api.get("/api/v1/zonen"), []);
  const prio = useDaten(() => api.get("/api/v1/zonen/prioritaet"), []);
  const [meldung, setMeldung] = useState(null);
  const [form, setForm] = useState(null);
  const [wahl, setWahl] = useState({});
  const [fragen, dialog] = useBestaetigung();
  const f = useFormular(LEER);
  const laden = () => { zonen.laden(); prio.laden(); };
  useLive(["zonen", "projekt", "packen"], laden);
  const darf = nutzer.admin || nutzer.rechte.zonen === "w";
  const aktion = async (fn) => { setMeldung(null); try { const r = await fn(); setMeldung({ level: r.level || "success", text: r.text }); laden(); } catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); } };
  const oeffne = (z) => { f.setWerte(z ? { ...LEER, ...z, flaeche_m2: z.flaeche_m2 ?? "" } : LEER); f.setFehler({}); f.setMeldung(null); setForm(z || {}); };
  const speichern = async () => {
    const r = await f.absenden((w) => (form.id ? api.put(`/api/v1/verwaltung/zonen/${form.id}`, w) : api.post("/api/v1/verwaltung/zonen", w)));
    if (r) { setForm(null); setMeldung({ level: "success", text: r.text }); laden(); }
  };
  const liste = zonen.daten?.zonen || [];
  const ohneZone = (prio.daten?.zeilen || []).filter((p) => !p.ladezone_id);
  return (
    <Seite titel="Ladezonen" untertitel="Welches Projekt wird wo gepackt? Freie Plätze, Zuweisung und die Reihenfolge „Als Nächstes zu packen“."
      aktionen={<>
        {darf && <Knopf icon="RefreshCw" onClick={() => aktion(() => api.post("/api/v1/zonen/verteilen", {}))}>Automatisch verteilen</Knopf>}
        {nutzer.admin && <Knopf art="primaer" icon="Plus" onClick={() => oeffne(null)}>Ladezone anlegen</Knopf>}
      </>}>
      {dialog}
      {meldung && <Meldung {...meldung} onSchliessen={() => setMeldung(null)} />}
      {zonen.fehler && <Meldung level="error" text={zonen.fehler} />}
      {!zonen.laedt && !liste.length && <Leerzustand icon="LayoutGrid" text={nutzer.admin ? "Noch keine Ladezonen. Lege die erste an, z. B. „Zone A“." : "Noch keine Ladezonen. Ein Administrator legt sie an."} />}
      <div className="lp-raster">
        {liste.map((z) => (
          <Section key={z.id} titel={z.bezeichnung} icon="LayoutGrid" aktionen={nutzer.admin && <>
            <Knopf klein icon="Pencil" aria-label={`${z.bezeichnung} bearbeiten`} onClick={() => oeffne(z)} />
            <Knopf klein art="geist" icon="Trash2" aria-label={`${z.bezeichnung} löschen`} onClick={async () => {
              if (await fragen({ titel: "Ladezone löschen?", text: `„${z.bezeichnung}“ wird gelöscht. Projekte darin haben danach keine Zone.`, knopf: "Löschen", gefahr: true }))
                aktion(() => api.del(`/api/v1/verwaltung/zonen/${z.id}`));
            }} /></>}>
            <div className="lp-zeile" data-testid={`zone-${z.bezeichnung}`} style={{ alignItems: "center", marginBottom: 8 }}>
              {!z.aktiv ? <Badge farbe="#6b7280" text="#fff">inaktiv</Badge> : z.frei ? <Badge farbe="#1f6e32" text="#fff">{z.frei} frei</Badge> : <Badge farbe="#a3261b" text="#fff">voll</Badge>}
              <span className="lp-meta">{z.belegt} von {z.plaetze} Plätzen belegt{z.flaeche_m2 ? ` · ${String(z.flaeche_m2).replace(".", ",")} m²` : ""}</span>
            </div>
            {z.beschreibung && <p className="lp-meta" style={{ marginTop: 0 }}>{z.beschreibung}</p>}
            {z.projekte.length === 0 ? <p className="lp-hinweis" style={{ margin: 0 }}>Leer.</p> :
              <ul className="lp-liste">{z.projekte.map((p) => (
                <li key={p.id} className="lp-zeile" style={{ alignItems: "center" }}>
                  <span style={{ flex: 1 }}><strong>{p.nummer}</strong> {p.name}<span className="lp-meta"> · {termin(p)} · seit {zeitpunktAnzeige(p.zone_seit)}</span></span>
                  <Knopf klein icon="ClipboardList" onClick={() => navigiere(`/projekte/${p.id}/packen`)}>Packen</Knopf>
                  {darf && <Knopf klein art="geist" onClick={() => aktion(() => api.post(`/api/v1/projekte/${p.id}/zone-freigeben`, {}))}>Freigeben</Knopf>}
                </li>))}</ul>}
            {darf && z.aktiv && z.frei > 0 && ohneZone.length > 0 && <div className="lp-zeile" style={{ marginTop: 8 }}>
              <div style={{ flex: 1 }}><Auswahl aria-label={`Projekt für ${z.bezeichnung}`} leer="Projekt wählen" value={wahl[z.id] || ""} onChange={(e) => setWahl({ ...wahl, [z.id]: e.target.value })}
                optionen={ohneZone.map((p) => ({ wert: String(p.id), titel: `${p.nummer} ${p.name} (${termin(p)})` }))} /></div>
              <Knopf icon="Plus" disabled={!wahl[z.id]} onClick={() => aktion(() => api.post(`/api/v1/zonen/${z.id}/zuweisen`, { projekt: Number(wahl[z.id]) }))}>Zuweisen</Knopf>
            </div>}
          </Section>
        ))}
      </div>
      <Section titel="Als Nächstes zu packen" icon="ListChecks">
        <Tabelle zeilen={prio.daten?.zeilen} leer="Keine Projekte zu packen (Bestätigt oder Läuft, noch nicht verladen)." onZeile={(p) => navigiere(`/projekte/${p.id}/packen`)} spalten={[
          { titel: "#", wert: (p, i) => i + 1 },
          { titel: "Projekt", wert: (p) => <span><strong>{p.nummer}</strong> {p.name}</span> },
          { titel: "Kunde", wert: (p) => p.kunde_firma || p.kunde },
          { titel: "Beginn", wert: termin },
          { titel: "Status", wert: (p) => PROJEKT_STATUS[p.status] },
          { titel: "Ladezone", wert: (p) => liste.find((z) => z.id === p.ladezone_id)?.bezeichnung || "–" },
        ]} />
      </Section>
      {form && <Modal titel={form.id ? "Ladezone bearbeiten" : "Ladezone anlegen"} onSchliessen={() => setForm(null)}
        fuss={<><Knopf onClick={() => setForm(null)}>Abbrechen</Knopf><Knopf art="primaer" icon="Save" onClick={speichern}>Speichern</Knopf></>}>
        {f.meldung && <Meldung {...f.meldung} />}
        <Feld label="Bezeichnung" pflicht fehler={f.fehler.bezeichnung}><Eingabe value={f.werte.bezeichnung} onChange={f.setze("bezeichnung")} /></Feld>
        <Feld label="Plätze" fehler={f.fehler.plaetze} hinweis="Wie viele Projekte gleichzeitig hier gepackt werden"><Eingabe type="number" min="1" value={f.werte.plaetze} onChange={f.setze("plaetze")} /></Feld>
        <Feld label="Fläche (m²)" fehler={f.fehler.flaeche_m2}><Eingabe value={f.werte.flaeche_m2} onChange={f.setze("flaeche_m2")} /></Feld>
        <Feld label="Reihenfolge" fehler={f.fehler.reihenfolge} hinweis="Kleinere Zahl wird zuerst belegt"><Eingabe type="number" min="0" value={f.werte.reihenfolge} onChange={f.setze("reihenfolge")} /></Feld>
        <Feld label="Beschreibung"><Eingabe value={f.werte.beschreibung} onChange={f.setze("beschreibung")} /></Feld>
        <Toggle label="Aktiv" checked={f.werte.aktiv} onChange={f.setze("aktiv")} />
      </Modal>}
    </Seite>
  );
}
