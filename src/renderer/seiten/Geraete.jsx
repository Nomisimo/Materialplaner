// FA-03 Geräteliste (Status-, Prüf-, Projektfilter) und Gerätedetail (Verlauf, Prüfstatus, Case-Inhalt, Aktionen).
import React, { useState } from "react";
import { Seite, Section, Knopf, Tabelle, Eingabe, Auswahl, Feld, Meldung, Textfeld, useDaten, useBestaetigung, Badge, Modal } from "@lager/ui/bausteine.jsx";
import { useLager, useLive } from "@lager/ui/huelle.jsx";
import { STATUS, MANUELLER_STATUS, uebergangErlaubt, istGesperrt } from "@lager/domain/geraet.js";
import { PRUEF_TEXT } from "@lager/domain/pruefung.js";
import { datumAnzeige, zeitpunktAnzeige } from "@lager/domain/zeit.js";
import { fehlerText } from "@lager/ui/texte.js";

const PRUEF_FARBE = { ueberfaellig: "var(--lp-err)", bald: "var(--lp-warn)", offen: "var(--lp-warn)", ok: "var(--lp-ok)", keine: "var(--lp-mid)" };
export const PruefBadge = ({ s }) => <span className="lp-chip" style={{ borderColor: PRUEF_FARBE[s] }}><span className="lp-punkt" style={{ background: PRUEF_FARBE[s] }} aria-hidden="true" />{PRUEF_TEXT[s]}</span>;
export const StatusChip = ({ s }) => <span className="lp-chip" style={{ borderColor: istGesperrt(s) ? "var(--lp-err)" : "var(--lp-line)" }}>{STATUS[s]}</span>;

export function GeraeteListe({ query }) {
  const { api, navigiere } = useLager();
  const [f, setF] = useState({ q: query.q || "", status: query.status || "", pruef: query.pruef || "", projekt: query.projekt || "" });
  const l = useDaten(() => api.get(`/api/v1/geraete?${new URLSearchParams(Object.entries(f).filter(([, v]) => v))}`), [f.q, f.status, f.pruef, f.projekt]);
  useLive("geraet", () => l.laden());
  return (
    <Seite titel="Geräte" untertitel="Einzelstücke mit Code" tour="geraete">
      <Section>
        <div className="lp-zeile" style={{ marginBottom: 12 }}>
          <div style={{ flex: "1 1 240px" }}><Eingabe placeholder="Code, Artikel, Seriennummer, alte Prüf-ID" aria-label="Suchen" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></div>
          <div style={{ width: 180 }}><Auswahl aria-label="Status" leer="Alle Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} optionen={Object.entries(STATUS).map(([wert, titel]) => ({ wert, titel }))} /></div>
          <div style={{ width: 170 }}><Auswahl aria-label="Prüfung" leer="Alle Prüfstände" value={f.pruef} onChange={(e) => setF({ ...f, pruef: e.target.value })} optionen={Object.entries(PRUEF_TEXT).map(([wert, titel]) => ({ wert, titel }))} /></div>
          <div style={{ width: 170 }}><Auswahl aria-label="Projekt" leer="Mit und ohne Projekt" value={f.projekt} onChange={(e) => setF({ ...f, projekt: e.target.value })} optionen={[{ wert: "mit", titel: "in einem Projekt" }, { wert: "ohne", titel: "ohne Projekt" }]} /></div>
        </div>
        {l.fehler && <Meldung level="error" text={l.fehler} />}
        <Tabelle zeilen={l.daten?.zeilen} leer={l.laedt ? "Lädt …" : "Keine Geräte gefunden."} onZeile={(g) => navigiere(`/geraete/${g.id}`)} spalten={[
          { titel: "Code", wert: (g) => <b>{g.code}</b> }, { titel: "Artikel", feld: "artikel" }, { titel: "Kategorie", feld: "kategorie" },
          { titel: "Status", wert: (g) => <StatusChip s={g.status} /> }, { titel: "Prüfung", wert: (g) => <PruefBadge s={g.pruefstatus} /> },
          { titel: "Nächste Prüfung", wert: (g) => datumAnzeige(g.naechste_pruefung) },
        ]} />
      </Section>
    </Seite>
  );
}

/** Code aus Deep-Link / Codefeld → Gerätedetail. */
export function GeraetPerCode({ params }) {
  const { api, navigiere } = useLager();
  const d = useDaten(() => api.get(`/api/v1/geraete/code/${encodeURIComponent(params.code)}`).then((g) => { navigiere(`/geraete/${g.id}`); return g; }), [params.code]);
  return <Seite titel={params.code}>{d.fehler && <Meldung level="error" text={d.fehler} />}</Seite>;
}

export function GeraetDetail({ params }) {
  const { api, navigiere, nutzer, oeffneAndereApp } = useLager();
  const d = useDaten(() => api.get(`/api/v1/geraete/${params.id}`), [params.id]);
  const orte = useDaten(() => api.get("/api/v1/lagerorte").catch(() => ({ zeilen: [] })), []);
  const [meldung, setMeldung] = useState(null);
  const [inhaltCode, setInhaltCode] = useState("");
  const [statusDialog, setStatusDialog] = useState(false);
  const [fragen, dialog] = useBestaetigung();
  useLive("geraet", () => d.laden());
  const g = d.daten;
  if (d.fehler) return <Seite titel="Gerät"><Meldung level="error" text={d.fehler} /></Seite>;
  if (!g) return <Seite titel="Gerät"><p className="lp-hinweis">Lädt …</p></Seite>;
  const darfG = nutzer.admin || nutzer.rechte.geraete === "w";
  const darfP = nutzer.admin || nutzer.rechte.packen === "w";
  const aktion = async (fn) => { try { const r = await fn(); setMeldung({ level: r.level || "success", text: r.text }); d.laden(); return true; } catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); return false; } };
  return (
    <Seite titel={g.code} untertitel={`${g.artikel} · ${g.kategorie}`} aktionen={<>
      {darfP && !["defekt", "reparatur", "ausgemustert", "verkauft"].includes(g.status) && <Knopf icon="Wrench" onClick={() => navigiere(`/reparatur?code=${encodeURIComponent(g.code)}`)}>Defekt melden</Knopf>}
      {["defekt", "reparatur"].includes(g.status) && <Knopf icon="Wrench" onClick={() => navigiere("/reparatur")}>Zur Reparatur</Knopf>}
      {darfP && g.status !== "vermisst" && uebergangErlaubt(g.status, "vermisst") && <Knopf icon="AlertTriangle" onClick={() => aktion(() => api.post(`/api/v1/geraete/${g.id}/vermisst`))}>Vermisst</Knopf>}
      {darfP && g.status === "vermisst" && <Knopf icon="Check" onClick={() => aktion(() => api.post(`/api/v1/geraete/${g.id}/gefunden`))}>Gefunden</Knopf>}
      {darfP && g.pruefpflichtig && <Knopf icon="ShieldCheck" onClick={() => aktion(() => api.post(`/api/v1/geraete/${g.id}/geprueft`))}>Heute geprüft</Knopf>}
      <Knopf icon="Printer" onClick={() => navigiere(`/etiketten/druck?codes=${g.code}`)}>Etikett</Knopf>
      {darfG && <Knopf icon="RefreshCw" onClick={() => setStatusDialog(true)}>Status ändern</Knopf>}
      {darfG && <Knopf art="gefahr" icon="Trash2" onClick={async () => {
        if (!(await fragen({ titel: "Gerät löschen?", text: `${g.code} wird gelöscht. Geräte mit Verlauf oder in einem Projekt lassen sich nicht löschen – mustere sie stattdessen aus. Der Code wird nie neu vergeben.`, knopf: "Löschen" }))) return;
        try { await api.del(`/api/v1/geraete/${g.id}`); navigiere("/geraete"); } catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); }
      }}>Löschen</Knopf>}
    </>}>
      {meldung && <Meldung {...meldung} onSchliessen={() => setMeldung(null)} />}
      <Section titel="Übersicht">
        <div className="lp-raster">
          <div><div className="lp-label">Status</div><StatusChip s={g.status} /></div>
          <div><div className="lp-label">Prüfung</div><PruefBadge s={g.pruefstatus} />{g.letzte_pruefung && <div className="lp-meta">zuletzt {datumAnzeige(g.letzte_pruefung)} · nächste {datumAnzeige(g.naechste_pruefung)}</div>}</div>
          <div><div className="lp-label">Projekt</div>{g.projekt_id ? <a href="#" onClick={(e) => { e.preventDefault(); oeffneAndereApp(`/projekte/${g.projekt_id}`); }}>{g.projekt_nummer || `Projekt ${g.projekt_id}`}</a> : "–"}</div>
          {g.wartung_intervall_monate && <div><div className="lp-label">Wartung</div>{g.wartung_text || "Wartung"} alle {g.wartung_intervall_monate} Monate<div className="lp-meta">zuletzt {g.letzte_wartung ? datumAnzeige(g.letzte_wartung) : "nie"}</div></div>}
          <div><div className="lp-label">Liegt in Case</div>{g.case_code ? <a href={`#/geraete/${g.case_id}`}>{g.case_code}</a> : "–"}</div>
          <div><div className="lp-label">Lagerort</div>{darfG
            ? <Auswahl aria-label="Lagerort" leer={g.artikel_lagerort_id ? "wie Artikel" : "– kein fester Platz –"} value={g.lagerort_id ?? ""}
              onChange={(e) => aktion(() => api.put(`/api/v1/geraete/${g.id}`, { lagerort_id: e.target.value ? Number(e.target.value) : null, version: g.version }))}
              optionen={(orte.daten?.zeilen || []).filter((o) => o.aktiv || o.id === g.lagerort_id).map((o) => ({ wert: o.id, titel: o.name }))} />
            : g.lagerort || "–"}{darfG && !g.eigener_lagerort && g.lagerort && <div className="lp-meta">{g.lagerort} (vom Artikel)</div>}</div>
          <div><div className="lp-label">Seriennummer</div>{g.seriennummer || "–"}</div>
          <div><div className="lp-label">Alte Prüf-ID</div>{g.alte_pruef_id || "–"}</div>
          <div><div className="lp-label">Artikel</div><a href={`#/material/${g.artikel_id}`}>{g.artikel}</a></div>
        </div>
        {g.notizen && <p>{g.notizen}</p>}
        {darfG && <Stammfelder g={g} onGespeichert={() => d.laden()} />}
      </Section>
      {g.ist_case && <Section titel={`Case-Inhalt (${g.inhalt.length}${g.verpackungseinheit ? ` von ${g.verpackungseinheit}` : ""})`} icon="Box">
        <Tabelle zeilen={g.inhalt} leer="Das Case ist leer." onZeile={(x) => navigiere(`/geraete/${x.id}`)} spalten={[
          { titel: "Code", feld: "code" }, { titel: "Artikel", feld: "artikel" }, { titel: "Status", wert: (x) => STATUS[x.status] },
          { titel: "", wert: (x) => darfG && <Knopf klein art="geist" onClick={(e) => { e.stopPropagation(); return aktion(() => api.post(`/api/v1/geraete/${g.id}/inhalt`, { code: x.code, austragen: true })); }}>Austragen</Knopf> },
        ]} />
        {darfG && <form className="lp-zeile" style={{ marginTop: 10 }} onSubmit={async (e) => { e.preventDefault(); if (await aktion(() => api.post(`/api/v1/geraete/${g.id}/inhalt`, { code: inhaltCode }))) setInhaltCode(""); }}>
          <div style={{ width: 220 }}><Eingabe placeholder="Code scannen oder tippen" aria-label="Gerät eintragen" value={inhaltCode} onChange={(e) => setInhaltCode(e.target.value)} /></div>
          <Knopf type="submit" icon="Plus">Eintragen</Knopf>
        </form>}
      </Section>}
      <Section titel="Verlauf" icon="History">
        <Tabelle zeilen={g.bewegungen} leer="Noch keine Bewegungen." spalten={[
          { titel: "Zeit", wert: (b) => zeitpunktAnzeige(b.zeit) }, { titel: "Aktion", feld: "aktion" }, { titel: "Wer", feld: "wer" },
        ]} />
      </Section>
      {statusDialog && <StatusDialog g={g} onFertig={(r) => { setStatusDialog(false); if (r) { setMeldung(r); d.laden(); } }} />}
      {dialog}
    </Seite>
  );
}

function Stammfelder({ g, onGespeichert }) {
  const { api } = useLager();
  const [offen, setOffen] = useState(false);
  const [w, setW] = useState({ seriennummer: g.seriennummer, alte_pruef_id: g.alte_pruef_id, notizen: g.notizen, version: g.version });
  if (!offen) return <div style={{ marginTop: 10 }}><Knopf klein icon="Pencil" onClick={() => setOffen(true)}>Seriennummer / Notizen</Knopf></div>;
  return (
    <div className="lp-raster" style={{ marginTop: 12 }}>
      <Feld label="Seriennummer"><Eingabe value={w.seriennummer} onChange={(e) => setW({ ...w, seriennummer: e.target.value })} /></Feld>
      <Feld label="Alte Prüf-ID"><Eingabe value={w.alte_pruef_id} onChange={(e) => setW({ ...w, alte_pruef_id: e.target.value })} /></Feld>
      <Feld label="Notizen" breit><Textfeld value={w.notizen} onChange={(e) => setW({ ...w, notizen: e.target.value })} /></Feld>
      <div className="lp-zeile"><Knopf art="primaer" icon="Save" onClick={async () => { await api.put(`/api/v1/geraete/${g.id}`, w); setOffen(false); onGespeichert(); }}>Speichern</Knopf><Knopf art="geist" onClick={() => setOffen(false)}>Abbrechen</Knopf></div>
    </div>
  );
}

function StatusDialog({ g, onFertig }) {
  const { api } = useLager();
  const [nach, setNach] = useState("");
  const [notiz, setNotiz] = useState("");
  const [fehler, setFehler] = useState(null);
  const moeglich = MANUELLER_STATUS.filter((s) => uebergangErlaubt(g.status, s));
  const endgueltig = nach === "ausgemustert" || nach === "verkauft";
  return (
    <Modal titel={`Status von ${g.code} ändern`} onSchliessen={() => onFertig(null)}
      fuss={<><Knopf art="geist" onClick={() => onFertig(null)}>Abbrechen</Knopf>
        <Knopf art={endgueltig ? "gefahr" : "primaer"} disabled={!nach} onClick={async () => {
          try { onFertig(await api.post(`/api/v1/geraete/${g.id}/status`, { status: nach, notiz })); } catch (e) { setFehler(fehlerText(e)); }
        }}>{endgueltig ? "Endgültig ändern" : "Ändern"}</Knopf></>}>
      <div style={{ display: "grid", gap: 12 }}>
        <Feld label="Neuer Status" pflicht><Auswahl leer="– wählen –" value={nach} onChange={(e) => setNach(e.target.value)} optionen={moeglich.map((s) => ({ wert: s, titel: STATUS[s] }))} /></Feld>
        {endgueltig && <Meldung level="warning" text="Ausgemustert und Verkauft sind endgültig. Das Gerät bleibt mit Verlauf als Nachweis erhalten." />}
        <Feld label="Notiz (erscheint im Verlauf)"><Eingabe value={notiz} onChange={(e) => setNotiz(e.target.value)} /></Feld>
        {fehler && <Meldung level="error" text={fehler} />}
        {!moeglich.length && <p>Kein Wechsel möglich (Status ist endgültig).</p>}
      </div>
    </Modal>
  );
}
