// FA-01 Materialliste, Kategorien verwalten (3.6).
import React, { useState } from "react";
import { Seite, Section, Knopf, Tabelle, Eingabe, Auswahl, Feld, Meldung, Modal, Tabs, useDaten, Icon, useBestaetigung } from "@lager/ui/bausteine.jsx";
import { useLager, useLive } from "@lager/ui/huelle.jsx";
import { euro } from "@lager/domain/geld.js";
import { fehlerText } from "@lager/ui/texte.js";

const TYPEN = [{ wert: "artikel", titel: "Artikel" }, { wert: "set", titel: "n-er-Set" }, { wert: "case", titel: "Case" }, { wert: "verbrauch", titel: "Verbrauch" }, { wert: "leistung", titel: "Dienstleistung" }, { wert: "kabel", titel: "Kabel" }];

export function MaterialListe({ query }) {
  const { api, navigiere, nutzer } = useLager();
  const [f, setF] = useState({ q: query.q || "", kategorie: query.kategorie || "", typ: query.typ || "" });
  const [tab, setTab] = useState(query.tab || "artikel");
  const kats = useDaten(() => api.get("/api/v1/kategorien"), []);
  const liste = useDaten(() => api.get(`/api/v1/artikel?${new URLSearchParams(Object.entries(f).filter(([, v]) => v))}`), [f.q, f.kategorie, f.typ]);
  useLive(["artikel", "geraet", "kategorie"], () => { liste.laden(); kats.laden(); });
  const darfAendern = nutzer.admin || nutzer.rechte.material === "w";
  return (
    <Seite titel="Material" untertitel="Materialstamm: Artikel, Cases, Verbrauch, Leistungen, Kabel"
      aktionen={darfAendern && <>
        <Knopf icon="Cable" onClick={() => navigiere("/material/kabel-assistent")}>Kabel-Assistent</Knopf>
        <Knopf art="primaer" icon="Plus" tour="material-aufnehmen" onClick={() => navigiere("/material/neu")}>Material aufnehmen</Knopf></>}>
      <Tabs tabs={[{ id: "artikel", titel: "Artikel" }, { id: "kategorien", titel: "Kategorien" }]} aktiv={tab} onWechsel={setTab} />
      {tab === "kategorien" ? <Kategorien kats={kats} darfAendern={darfAendern} /> : (
        <Section>
          <div className="lp-zeile" style={{ marginBottom: 12 }}>
            <div style={{ flex: "1 1 260px" }}><Eingabe placeholder="Suchen: Name, Hersteller, Kategorie" aria-label="Suchen" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></div>
            <div style={{ width: 200 }}><Auswahl aria-label="Kategorie" leer="Alle Kategorien" value={f.kategorie} onChange={(e) => setF({ ...f, kategorie: e.target.value })}
              optionen={(kats.daten || []).map((k) => ({ wert: String(k.id), titel: `${k.name} (${k.praefix})` }))} /></div>
            <div style={{ width: 170 }}><Auswahl aria-label="Typ" leer="Alle Typen" value={f.typ} onChange={(e) => setF({ ...f, typ: e.target.value })} optionen={TYPEN} /></div>
          </div>
          {liste.fehler && <Meldung level="error" text={liste.fehler} />}
          <Tabelle zeilen={liste.daten?.zeilen} leer={liste.laedt ? "Lädt …" : "Kein Material gefunden. Ändere die Suche oder lege neues Material an."}
            onZeile={(a) => navigiere(`/material/${a.id}`)}
            spalten={[
              { titel: "Name", wert: (a) => <span>{a.name}{!a.aktiv && <span className="lp-meta"> · inaktiv</span>}</span> },
              { titel: "Kategorie", feld: "kategorie" },
              { titel: "Typ", feld: "typ" },
              { titel: "Preis/Tag", rechts: true, wert: (a) => euro(a.preis_tag) },
              { titel: "Bestand / Geräte", rechts: true, wert: (a) => a.verbrauch
                ? <span data-niedrig={a.niedrig || undefined}>{a.niedrig && <Icon name="AlertTriangle" size={14} style={{ color: "var(--lp-warn)", verticalAlign: -2 }} aria-label="Mindestbestand erreicht" />} {a.bestand} {a.einheit}</span>
                : a.ist_leistung ? "–" : `${a.einsatzfaehig} / ${a.geraete}` },
              { titel: "Reservierungen", rechts: true, wert: (a) => a.reserviert ?? "–" },
            ]} />
          {liste.daten && <p className="lp-hinweis">{liste.daten.gesamt} Artikel</p>}
        </Section>
      )}
    </Seite>
  );
}

function Kategorien({ kats, darfAendern }) {
  const { api } = useLager();
  const [bearb, setBearb] = useState(null);
  const [meldung, setMeldung] = useState(null);
  const [fragen, dialog] = useBestaetigung();
  return (
    <Section titel="Kategorien" aktionen={darfAendern && <Knopf icon="Plus" onClick={() => setBearb({ name: "", praefix: "" })}>Neue Kategorie</Knopf>}>
      {meldung && <div style={{ marginBottom: 10 }}><Meldung {...meldung} onSchliessen={() => setMeldung(null)} /></div>}
      <Tabelle zeilen={kats.daten} spalten={[
        { titel: "Name", feld: "name" }, { titel: "Präfix", feld: "praefix" }, { titel: "Letzte Nummer", feld: "letzte_nummer", rechts: true },
        { titel: "Artikel", feld: "artikel", rechts: true },
        { titel: "", wert: (k) => darfAendern && <span className="lp-zeile"><Knopf klein art="geist" icon="Pencil" onClick={() => setBearb(k)} aria-label="Bearbeiten" />
          <Knopf klein art="geist" icon="Trash2" aria-label="Löschen" onClick={async () => {
            if (!(await fragen({ titel: "Kategorie löschen?", text: `„${k.name}“ wird gelöscht. Das geht nur, wenn keine Artikel darin sind.`, knopf: "Löschen" }))) return;
            try { await api.del(`/api/v1/kategorien/${k.id}`); kats.laden(); } catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); }
          }} /></span> },
      ]} />
      {bearb && <KategorieDialog start={bearb} onFertig={() => { setBearb(null); kats.laden(); }} onAbbruch={() => setBearb(null)} />}
      {dialog}
    </Section>
  );
}

function KategorieDialog({ start, onFertig, onAbbruch }) {
  const { api } = useLager();
  const [w, setW] = useState(start);
  const [fehler, setFehler] = useState({});
  const [text, setText] = useState(null);
  const vorschlag = async (name) => { if (!start.id && name) { const r = await api.get(`/api/v1/kategorien/praefix-vorschlag?name=${encodeURIComponent(name)}`); setW((x) => ({ ...x, praefix: x.praefixFest ? x.praefix : r.praefix })); } };
  const speichern = async () => {
    try { start.id ? await api.put(`/api/v1/kategorien/${start.id}`, w) : await api.post("/api/v1/kategorien", w); onFertig(); }
    catch (e) { setFehler(e.felder || {}); setText(fehlerText(e)); }
  };
  return (
    <Modal titel={start.id ? "Kategorie bearbeiten" : "Neue Kategorie"} onSchliessen={onAbbruch}
      fuss={<><Knopf art="geist" onClick={onAbbruch}>Abbrechen</Knopf><Knopf art="primaer" icon="Save" onClick={speichern}>Speichern</Knopf></>}>
      <div style={{ display: "grid", gap: 12 }}>
        <Feld label="Name" pflicht fehler={fehler.name}><Eingabe autoFocus value={w.name} onChange={(e) => setW({ ...w, name: e.target.value })} onBlur={(e) => vorschlag(e.target.value)} /></Feld>
        <Feld label="Präfix für Gerätecodes" pflicht fehler={fehler.praefix} hinweis={`1 bis 4 Buchstaben, z. B. LT → LT-0001. ${start.letzte_nummer ? "Bereits vergeben, daher fest." : "Wird aus dem Namen vorgeschlagen."}`}>
          <Eingabe value={w.praefix} maxLength={4} disabled={!!start.letzte_nummer} onChange={(e) => setW({ ...w, praefix: e.target.value.toUpperCase(), praefixFest: true })} /></Feld>
        {text && <Meldung level="error" text={text} />}
      </div>
    </Modal>
  );
}
