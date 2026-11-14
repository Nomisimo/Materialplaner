// FA-07 Reparatur und Wartung: Defekt melden (mit Foto), Status bis „Repariert/geprüft“ (erst nach Prüfung zurück in den Bestand), Wartungsliste.
import React, { useState } from "react";
import { Seite, Section, Knopf, Tabelle, Auswahl, Eingabe, Textfeld, Feld, Meldung, Modal, Badge, Tabs, GeldEingabe, useDaten, useFormular } from "@lager/ui/bausteine.jsx";
import { useLager, useLive } from "@lager/ui/huelle.jsx";
import { fehlerText } from "@lager/ui/texte.js";
import { euro } from "@lager/domain/geld.js";
import { datumAnzeige, zeitpunktAnzeige } from "@lager/domain/zeit.js";
import { STATUS } from "@lager/domain/geraet.js";

const FARBE = { gemeldet: "#b3483f", in_reparatur: "#c07a12", repariert: "#1f6e32", ausgemustert: "#777" };
const RepBadge = ({ r }) => <Badge farbe={FARBE[r.status]} text="#fff">{r.status_text}</Badge>;

/** Dialog „Defekt melden“ – auch von der Geräteseite aus nutzbar. */
export function DefektMelden({ code = "", onFertig, onSchliessen }) {
  const { api } = useLager();
  const f = useFormular({ code, beschreibung: "", verantwortlich_id: "", kosten: null });
  const [foto, setFoto] = useState(null);
  const leute = useDaten(() => api.get("/api/v1/benutzer/auswahl").catch(() => ({ zeilen: [] })), []);
  const speichern = async () => {
    const r = await f.absenden((w) => api.post("/api/v1/reparaturen", { ...w, verantwortlich_id: w.verantwortlich_id ? Number(w.verantwortlich_id) : null }));
    if (!r) return;
    let text = r.text;
    if (foto) {
      try { await api.anfrage("POST", `/api/v1/reparaturen/${r.id}/foto`, foto, { headers: { "Content-Type": foto.type || "image/jpeg" } }); }
      catch (e) { text += ` Das Foto wurde nicht gespeichert: ${fehlerText(e)}`; }
    }
    onFertig({ ...r, text });
  };
  return (
    <Modal titel="Defekt melden" onSchliessen={onSchliessen} fuss={<><Knopf onClick={onSchliessen}>Abbrechen</Knopf><Knopf art="primaer" icon="AlertTriangle" onClick={speichern}>Melden</Knopf></>}>
      {f.meldung && <Meldung {...f.meldung} />}
      <Feld label="Gerätecode" pflicht fehler={f.fehler.geraet}><Eingabe value={f.werte.code} onChange={f.setze("code")} placeholder="z. B. LI-0001" autoFocus={!code} /></Feld>
      <Feld label="Was ist defekt?" pflicht fehler={f.fehler.beschreibung}><Textfeld rows={3} value={f.werte.beschreibung} onChange={f.setze("beschreibung")} autoFocus={!!code} /></Feld>
      <Feld label="Verantwortlich">
        <Auswahl value={f.werte.verantwortlich_id} leer="– niemand –" onChange={f.setze("verantwortlich_id")}
          optionen={(leute.daten?.zeilen || []).map((b) => ({ wert: String(b.id), titel: b.name || b.benutzername }))} />
      </Feld>
      <Feld label="Kosten (optional)" fehler={f.fehler.kosten}><GeldEingabe cent={f.werte.kosten} onCent={f.setze("kosten")} placeholder="0,00" /></Feld>
      <Feld label="Foto (optional)" hinweis="JPG, PNG, WEBP oder HEIC, höchstens 15 MB.">
        <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" aria-label="Foto" onChange={(e) => setFoto(e.target.files?.[0] || null)} />
      </Feld>
    </Modal>
  );
}

function ReparaturDialog({ id, onSchliessen, onGeaendert }) {
  const { api, nutzer } = useLager();
  const d = useDaten(() => api.get(`/api/v1/reparaturen/${id}`), [id]);
  const [pruefung, setPruefung] = useState(false);
  const [notiz, setNotiz] = useState("");
  const [kosten, setKosten] = useState(undefined);
  const [meldung, setMeldung] = useState(null);
  const [bild, setBild] = useState(null);
  const darf = nutzer.admin || nutzer.rechte.geraete === "w";
  const r = d.daten;
  const wechsel = async (status) => {
    setMeldung(null);
    try {
      const x = await api.post(`/api/v1/reparaturen/${id}/status`, { status, pruefung_ok: pruefung, notiz, ...(kosten !== undefined ? { kosten } : {}) });
      onGeaendert(x);
    } catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); }
  };
  const zeigeFoto = async () => {
    try { const x = await api.anfrage("GET", `/api/v1/reparaturen/${id}/foto`, undefined, { roh: true }); setBild(URL.createObjectURL(await x.blob())); }
    catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); }
  };
  return (
    <Modal titel={r ? `Reparatur ${r.code} ${r.artikel}` : "Reparatur"} onSchliessen={onSchliessen} breite={640} fuss={r?.offen && darf && <>
      {r.status === "gemeldet" && <Knopf icon="Wrench" onClick={() => wechsel("in_reparatur")}>In Reparatur</Knopf>}
      <Knopf art="gefahr" icon="Trash2" onClick={() => wechsel("ausgemustert")}>Ausmustern</Knopf>
      <Knopf art="primaer" icon="CheckCircle2" disabled={!pruefung} onClick={() => wechsel("repariert")}>Repariert/geprüft – zurück ins Lager</Knopf></>}>
      {d.fehler && <Meldung level="error" text={d.fehler} />}
      {meldung && <Meldung {...meldung} />}
      {r && <>
        <p style={{ marginTop: 0 }}><RepBadge r={r} /> <span className="lp-meta">Gerät: {STATUS[r.geraet_status]} · gemeldet {zeitpunktAnzeige(r.gemeldet)} von {r.gemeldet_von}{r.verantwortlich ? ` · verantwortlich ${r.verantwortlich}` : ""}</span></p>
        <p style={{ whiteSpace: "pre-wrap" }}>{r.beschreibung}</p>
        {r.notiz && <p className="lp-meta" style={{ whiteSpace: "pre-wrap" }}>{r.notiz}</p>}
        <p className="lp-meta">Kosten: {r.kosten == null ? "–" : euro(r.kosten)}{r.pruefung_ok ? " · Prüfung bestanden" : ""}</p>
        {r.foto && (bild ? <img src={bild} alt={`Foto zu ${r.code}`} style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 6 }} /> : <Knopf klein icon="Image" onClick={zeigeFoto}>Foto ansehen</Knopf>)}
        {r.offen && darf && <div style={{ marginTop: 12 }}>
          <Feld label="Notiz zur Reparatur"><Eingabe value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="z. B. Lüfter getauscht" /></Feld>
          <Feld label="Kosten"><GeldEingabe cent={kosten === undefined ? r.kosten : kosten} onCent={setKosten} placeholder="0,00" /></Feld>
          <label className="lp-zeile" style={{ gap: 8 }}><input type="checkbox" checked={pruefung} onChange={(e) => setPruefung(e.target.checked)} /> Prüfung bestanden (Sicht-, Funktions- und ggf. elektrische Prüfung)</label>
          <p className="lp-hinweis">Zurück in den Bestand geht das Gerät erst nach bestandener Prüfung.</p>
        </div>}
      </>}
    </Modal>
  );
}

export function ReparaturSeite({ query }) {
  const { api, nutzer } = useLager();
  const [tab, setTab] = useState(query?.tab || "offen");
  const l = useDaten(() => api.get(`/api/v1/reparaturen?status=${tab === "alle" ? "alle" : "offen"}`), [tab]);
  const w = useDaten(() => api.get("/api/v1/wartung"), []);
  const [melden, setMelden] = useState(query?.code ? { code: query.code } : null);
  const [offen, setOffen] = useState(null);
  const [meldung, setMeldung] = useState(null);
  useLive(["reparatur", "geraet"], () => { l.laden(); w.laden(); });
  const darfW = nutzer.admin || nutzer.rechte.geraete === "w";
  const darfMelden = nutzer.admin || nutzer.rechte.packen === "w";
  const fertig = (r) => { setMelden(null); setOffen(null); setMeldung({ level: r.level || "success", text: r.text }); l.laden(); w.laden(); };
  const gewartet = async (g) => {
    try { const r = await api.post(`/api/v1/geraete/${g.id}/gewartet`, {}); setMeldung({ level: "success", text: r.text }); w.laden(); }
    catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); }
  };
  return (
    <Seite titel="Reparatur & Wartung" untertitel="Defekte Geräte bis zur Prüfung verfolgen, fällige Wartungen erledigen."
      aktionen={darfMelden && <Knopf art="primaer" icon="AlertTriangle" onClick={() => setMelden({ code: "" })}>Defekt melden</Knopf>}>
      {meldung && <Meldung {...meldung} onSchliessen={() => setMeldung(null)} />}
      <Tabs tabs={[{ id: "offen", titel: "Offen" }, { id: "alle", titel: "Alle" }, { id: "wartung", titel: `Wartung fällig (${w.daten?.length ?? 0})` }]} aktiv={tab} onWechsel={setTab} />
      {tab !== "wartung" && <Section titel={tab === "offen" ? "Offene Reparaturen" : "Alle Reparaturen"} icon="Wrench">
        {l.fehler && <Meldung level="error" text={l.fehler} />}
        <Tabelle zeilen={l.daten || []} leer={tab === "offen" ? "Keine offenen Reparaturen." : "Noch keine Reparaturen."} onZeile={(r) => setOffen(r.id)} spalten={[
          { titel: "Gerät", wert: (r) => <div><strong>{r.code}</strong><div className="lp-meta">{r.artikel}</div></div> },
          { titel: "Defekt", wert: (r) => r.beschreibung },
          { titel: "Status", wert: (r) => <RepBadge r={r} /> },
          { titel: "Verantwortlich", wert: (r) => r.verantwortlich || "–" },
          { titel: "Gemeldet", wert: (r) => datumAnzeige(r.gemeldet) },
          { titel: "Kosten", rechts: true, wert: (r) => (r.kosten == null ? "–" : euro(r.kosten)) },
        ]} />
      </Section>}
      {tab === "wartung" && <Section titel="Wartung fällig (oder in 30 Tagen)" icon="CalendarClock">
        {w.fehler && <Meldung level="error" text={w.fehler} />}
        <Tabelle zeilen={w.daten || []} leer="Keine Wartung fällig. Wartungsintervalle stellst du am Artikel ein." spalten={[
          { titel: "Gerät", wert: (g) => <a href={`#/geraete/${g.id}`}><strong>{g.code}</strong></a> },
          { titel: "Artikel", feld: "artikel" },
          { titel: "Wartung", wert: (g) => `${g.wartung_text || "Wartung"} · alle ${g.wartung_intervall_monate} Monate` },
          { titel: "Letzte", wert: (g) => (g.letzte_wartung ? datumAnzeige(g.letzte_wartung) : "nie") },
          { titel: "Fällig", wert: (g) => (g.wartung.naechste ? datumAnzeige(g.wartung.naechste) : "sofort") },
          ...(darfW ? [{ titel: "", wert: (g) => <Knopf klein icon="Check" onClick={(e) => { e.stopPropagation(); gewartet(g); }}>Erledigt</Knopf> }] : []),
        ]} />
      </Section>}
      {melden && <DefektMelden code={melden.code} onSchliessen={() => setMelden(null)} onFertig={fertig} />}
      {offen && <ReparaturDialog id={offen} onSchliessen={() => setOffen(null)} onGeaendert={fertig} />}
    </Seite>
  );
}
