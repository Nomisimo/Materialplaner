// Etiketten (FA-10 Druck, FA-11 Designer, FA-12 Kabelfarben, FA-13 Bestellungen R-67–R-70).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Seite, Section, Knopf, Tabelle, Eingabe, Auswahl, Feld, Meldung, Tabs, useDaten, Icon, useBestaetigung, Textfeld, Toggle, Badge, Leerzustand } from "@lager/ui/bausteine.jsx";
import { plattform } from "@lager/ui/plattform.js";
import { useLager, useLive } from "@lager/ui/huelle.jsx";
import { fehlerText } from "@lager/ui/texte.js";
import { ladeHerunter } from "@lager/ui/download.js";
import { datumAnzeige, zeitpunktAnzeige } from "@lager/domain/zeit.js";
import { ELEMENT_TYPEN, BEISPIEL, etikettSvg, snap } from "@lager/domain/etiketten.js";
import { laengeText } from "@lager/domain/kabel.js";

const STATUS_TEXT = { offen: "offen", teilweise: "teilweise geliefert", geliefert: "geliefert" };
const STATUS_FARBE = { offen: "var(--lp-warn)", teilweise: "var(--lp-accent)", geliefert: "var(--lp-ok)" };
const darfMaterial = (n) => n.admin || n.rechte.material === "w";

/** Etikett als Bild (SVG vom Server oder aus der Vorschau). Maßstab px je mm. */
export const EtikettBild = ({ svg, breite_mm, hoehe_mm, mass = 4, ...p }) => (
  <div className="lp-etikett" style={{ width: breite_mm * mass, height: hoehe_mm * mass }} dangerouslySetInnerHTML={{ __html: svg }} {...p} />
);

/* ── Übersicht ── */
export function EtikettenSeite({ query }) {
  const { navigiere, nutzer } = useLager();
  const [tab, setTab] = useState(query.tab || "bestellungen");
  return (
    <Seite titel="Etiketten" untertitel="Bestellungen beim Lieferanten, Vorlagen und Kabelfarben"
      aktionen={darfMaterial(nutzer) && <Knopf art="primaer" icon="Plus" onClick={() => navigiere("/etiketten/bestellungen/neu")}>Etiketten bestellen</Knopf>}>
      <Tabs tabs={[{ id: "bestellungen", titel: "Bestellungen" }, { id: "vorlagen", titel: "Vorlagen" }, { id: "kabel", titel: "Kabelfarben" }]} aktiv={tab} onWechsel={setTab} />
      {tab === "bestellungen" && <Bestellungen />}
      {tab === "vorlagen" && <Vorlagen />}
      {tab === "kabel" && <Kabelfarben />}
    </Seite>
  );
}

function Bestellungen() {
  const { api, navigiere } = useLager();
  const [status, setStatus] = useState("");
  const l = useDaten(() => api.get(`/api/v1/etiketten/bestellungen${status ? `?status=${status}` : ""}`), [status]);
  useLive(["etiketten"], () => l.laden());
  return (
    <Section titel="Bestellungen" icon="Tags" aktionen={<div style={{ width: 200 }}><Auswahl aria-label="Status" leer="Alle Status" value={status} onChange={(e) => setStatus(e.target.value)}
      optionen={Object.entries(STATUS_TEXT).map(([wert, titel]) => ({ wert, titel }))} /></div>}>
      {l.fehler && <Meldung level="error" text={l.fehler} />}
      <Tabelle zeilen={l.daten?.zeilen} leer={l.laedt ? "Lädt …" : "Noch keine Etiketten-Bestellungen."} onZeile={(b) => navigiere(`/etiketten/bestellungen/${b.id}`)}
        spalten={[
          { titel: "Nummer", feld: "nummer" },
          { titel: "Lieferant", feld: "lieferant" },
          { titel: "Erstellt", wert: (b) => datumAnzeige(b.erstellt) },
          { titel: "Bestellt am", wert: (b) => (b.bestellt_am ? datumAnzeige(b.bestellt_am) : "–") },
          { titel: "Codes", rechts: true, wert: (b) => `${b.geliefert} / ${b.gesamt}` },
          { titel: "Status", wert: (b) => <Badge farbe={STATUS_FARBE[b.status]} text="#fff">{STATUS_TEXT[b.status]}</Badge> },
        ]} />
    </Section>
  );
}

/* ── Neue Bestellung (R-67) ── */
export function BestellungNeu({ query }) {
  const { api, navigiere } = useLager();
  const artikel = useDaten(() => api.get("/api/v1/artikel?aktiv=1&limit=500"), []);
  const [pos, setPos] = useState([{ artikel_id: query.artikel || "", menge: 1 }]);
  const [kopf, setKopf] = useState({ lieferant: "", notiz: "" });
  const [meldung, setMeldung] = useState(null);
  const [laeuft, setLaeuft] = useState(false);
  const wahl = (artikel.daten?.zeilen || []).filter((a) => !a.verbrauch && !a.ist_leistung).map((a) => ({ wert: String(a.id), titel: `${a.name} (${a.kategorie})` }));
  const setze = (i, k, v) => setPos(pos.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  const absenden = async () => {
    setLaeuft(true); setMeldung(null);
    try {
      const r = await api.post("/api/v1/etiketten/bestellungen", { ...kopf, positionen: pos.map((p) => ({ artikel_id: Number(p.artikel_id), menge: Number(p.menge) })) });
      navigiere(`/etiketten/bestellungen/${r.bestellung.id}`);
    } catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); } finally { setLaeuft(false); }
  };
  return (
    <Seite titel="Etiketten bestellen" untertitel="Codes werden fortlaufend reserviert. Geräte entstehen erst bei der Lieferung.">
      <Section titel="Positionen">
        {meldung && <div style={{ marginBottom: 10 }}><Meldung {...meldung} /></div>}
        {pos.map((p, i) => (
          <div key={i} className="lp-zeile" style={{ marginBottom: 8, alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 320px" }}><Feld label={`Artikel ${i + 1}`} pflicht><Auswahl leer="– Artikel wählen –" value={String(p.artikel_id)} onChange={(e) => setze(i, "artikel_id", e.target.value)} optionen={wahl} /></Feld></div>
            <div style={{ width: 120 }}><Feld label="Menge" pflicht><Eingabe type="number" min="1" max="500" value={p.menge} onChange={(e) => setze(i, "menge", e.target.value)} /></Feld></div>
            {pos.length > 1 && <Knopf art="geist" icon="Trash2" aria-label={`Position ${i + 1} entfernen`} onClick={() => setPos(pos.filter((_, j) => j !== i))} />}
          </div>
        ))}
        <Knopf icon="Plus" onClick={() => setPos([...pos, { artikel_id: "", menge: 1 }])}>Position hinzufügen</Knopf>
      </Section>
      <Section titel="Bestellung">
        <div className="lp-raster">
          <Feld label="Lieferant" hinweis="Leer lassen für den Standard aus der Verwaltung („Stromstoss“)."><Eingabe value={kopf.lieferant} onChange={(e) => setKopf({ ...kopf, lieferant: e.target.value })} /></Feld>
          <Feld label="Notiz"><Textfeld rows={2} value={kopf.notiz} onChange={(e) => setKopf({ ...kopf, notiz: e.target.value })} /></Feld>
        </div>
        <div className="lp-zeile" style={{ marginTop: 12 }}>
          <Knopf art="primaer" icon="Tags" disabled={laeuft} onClick={absenden}>Bestellung anlegen</Knopf>
          <Knopf art="geist" onClick={() => navigiere("/etiketten")}>Abbrechen</Knopf>
        </div>
      </Section>
    </Seite>
  );
}

/* ── Bestellung: Liste, Lieferung (R-68, R-69, 4.4) ── */
export function BestellungDetail({ params }) {
  const { api, navigiere, nutzer } = useLager();
  const d = useDaten(() => api.get(`/api/v1/etiketten/bestellungen/${params.id}`), [params.id]);
  useLive(["etiketten"], () => d.laden());
  const [meldung, setMeldung] = useState(null);
  const [scan, setScan] = useState("");
  const [haken, setHaken] = useState(new Set());
  const [ohneBindestrich, setOhne] = useState(false);
  const [fragen, dialog] = useBestaetigung();
  const scanRef = useRef(null);
  const darf = darfMaterial(nutzer);
  if (d.fehler) return <Seite titel="Bestellung"><Meldung level="error" text={d.fehler} /></Seite>;
  const b = d.daten;
  if (!b) return <Seite titel="Bestellung"><p className="lp-hinweis">Lädt …</p></Seite>;
  const aktion = async (fn) => { setMeldung(null); try { const r = await fn(); if (r?.text) setMeldung({ level: r.level || "success", text: r.text }); d.laden(); return r; } catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); return null; } };
  const liefern = async (codes) => { const r = await aktion(() => api.post(`/api/v1/etiketten/bestellungen/${b.id}/liefern`, { codes })); if (r) setHaken(new Set()); };
  const offen = b.codes.filter((c) => !c.geliefert_am);
  return (
    <Seite titel={`Etiketten-Bestellung ${b.nummer}`} untertitel={`${b.lieferant} · ${b.gesamt} Codes · ${STATUS_TEXT[b.status]}`}
      aktionen={<>
        <Knopf icon="Download" onClick={() => ladeHerunter(api, `/api/v1/etiketten/bestellungen/${b.id}/liste.pdf`, `${b.nummer}.pdf`).catch((e) => setMeldung({ level: "error", text: fehlerText(e) }))}>Liste (PDF)</Knopf>
        <Knopf icon="Download" onClick={() => ladeHerunter(api, `/api/v1/etiketten/bestellungen/${b.id}/liste.csv${ohneBindestrich ? "?ohne_bindestrich=1" : ""}`, `${b.nummer}.csv`).catch((e) => setMeldung({ level: "error", text: fehlerText(e) }))}>Liste (CSV)</Knopf>
        {darf && b.geliefert === 0 && <Knopf art="gefahr" icon="Trash2" onClick={async () => {
          if (!(await fragen({ titel: "Bestellung löschen?", text: `${b.nummer} wird gelöscht. Die reservierten Codes werden nicht neu vergeben.`, knopf: "Löschen" }))) return;
          if (await aktion(() => api.del(`/api/v1/etiketten/bestellungen/${b.id}`))) navigiere("/etiketten");
        }}>Löschen</Knopf>}
      </>}>
      {dialog}
      {meldung && <Meldung {...meldung} onSchliessen={() => setMeldung(null)} />}
      <div className="lp-zeile"><Toggle checked={ohneBindestrich} onChange={setOhne} label="CSV ohne Bindestrich (für Lieferanten, die keinen Bindestrich drucken)" /></div>
      {darf && offen.length > 0 && (
        <Section titel="Lieferung buchen" icon="ScanLine">
          <p className="lp-hinweis" style={{ marginTop: 0 }}>Scanne die gelieferten Etiketten oder hake sie unten ab. Groß-/Kleinschreibung und Bindestrich sind egal.</p>
          <form className="lp-zeile" onSubmit={(e) => { e.preventDefault(); const c = scan.split(/[\s,;]+/).filter(Boolean); if (c.length) { liefern(c); setScan(""); scanRef.current?.focus(); } }}>
            <div style={{ flex: "1 1 260px" }}><Eingabe ref={scanRef} autoFocus aria-label="Gelieferten Code scannen" placeholder="Code scannen, z. B. KT-0001" value={scan} onChange={(e) => setScan(e.target.value)} /></div>
            <Knopf type="submit" art="primaer" icon="Check">Buchen</Knopf>
            <Knopf disabled={!haken.size} icon="ListChecks" onClick={() => liefern([...haken])}>{haken.size} abgehakte buchen</Knopf>
          </form>
        </Section>
      )}
      <Section titel="Codes">
        <Tabelle zeilen={b.codes} spalten={[
          ...(darf ? [{ titel: "", breite: 40, wert: (c) => (c.geliefert_am ? <Icon name="CheckCircle2" style={{ color: "var(--lp-ok)" }} aria-label="geliefert" />
            : <input type="checkbox" aria-label={`${c.code} abhaken`} checked={haken.has(c.code)} onChange={(e) => { const n = new Set(haken); if (e.target.checked) n.add(c.code); else n.delete(c.code); setHaken(n); }} />) }] : []),
          { titel: "Code", wert: (c) => <strong>{c.code}</strong> },
          { titel: "Artikel", feld: "artikel" },
          { titel: "Länge", wert: (c) => (c.laenge_m != null ? <span>{c.hex && <span className="lp-farbfeld" style={{ background: c.hex }} />} {laengeText(c.laenge_m)}</span> : "–") },
          { titel: "Geliefert", wert: (c) => (c.geliefert_am ? <a href={`#/geraete/${c.geraet_id}`}>{zeitpunktAnzeige(c.geliefert_am)}</a> : "offen") },
        ]} />
      </Section>
      {darf && <Section titel="Angaben">
        <BestellKopf b={b} onSpeichern={(w) => aktion(() => api.put(`/api/v1/etiketten/bestellungen/${b.id}`, w))} />
      </Section>}
    </Seite>
  );
}

function BestellKopf({ b, onSpeichern }) {
  const [w, setW] = useState({ lieferant: b.lieferant, notiz: b.notiz, bestellt_am: b.bestellt_am || "", version: b.version });
  return (
    <>
      <div className="lp-raster">
        <Feld label="Lieferant"><Eingabe value={w.lieferant} onChange={(e) => setW({ ...w, lieferant: e.target.value })} /></Feld>
        <Feld label="Bestellt am"><Eingabe type="date" value={w.bestellt_am} onChange={(e) => setW({ ...w, bestellt_am: e.target.value })} /></Feld>
        <Feld label="Notiz" breit><Textfeld rows={2} value={w.notiz} onChange={(e) => setW({ ...w, notiz: e.target.value })} /></Feld>
      </div>
      <div style={{ marginTop: 12 }}><Knopf icon="Save" onClick={() => onSpeichern({ ...w, bestellt_am: w.bestellt_am || null })}>Speichern</Knopf></div>
    </>
  );
}

/* ── Vorlagen (FA-11) ── */
const PLATZHALTER_QR = Array.from({ length: 21 }, (_, y) => Array.from({ length: 21 }, (_, x) => {
  const ecke = (a, b) => a < 7 && b < 7 && (a === 0 || a === 6 || b === 0 || b === 6 || (a > 1 && a < 5 && b > 1 && b < 5));
  if (ecke(x, y) || ecke(20 - x, y) || ecke(x, 20 - y)) return true;
  if ((x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12)) return false;
  return ((x * 7 + y * 13 + x * y) % 5) < 2;
}));
const vorschau = (v, d = {}) => etikettSvg(v, { ...BEISPIEL, firma: "Deine Firma", qr: PLATZHALTER_QR, ...d });

function Vorlagen() {
  const { api, navigiere, nutzer } = useLager();
  const l = useDaten(() => api.get("/api/v1/etiketten/vorlagen"), []);
  useLive(["vorlage"], () => l.laden());
  const [meldung, setMeldung] = useState(null);
  const darf = darfMaterial(nutzer);
  const aktion = async (fn) => { setMeldung(null); try { const r = await fn(); setMeldung({ level: "success", text: r.text }); l.laden(); return r; } catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); } };
  return (
    <Section titel="Vorlagen" icon="Tag">
      {meldung && <div style={{ marginBottom: 10 }}><Meldung {...meldung} onSchliessen={() => setMeldung(null)} /></div>}
      {l.fehler && <Meldung level="error" text={l.fehler} />}
      <div className="lp-etiketten-raster">
        {(l.daten?.zeilen || []).map((v) => (
          <div key={v.id} className="lp-section" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }} data-vorlage={v.name}>
            <EtikettBild svg={vorschau(v)} breite_mm={v.breite_mm} hoehe_mm={v.hoehe_mm} mass={3.5} />
            <div><strong>{v.name}</strong> {v.standard && <Badge farbe="var(--lp-accent)" text="var(--lp-on-accent)">Standard{v.art === "kabel" ? " Kabel" : ""}</Badge>}</div>
            <div className="lp-meta">{v.breite_mm} × {v.hoehe_mm} mm · {v.art === "kabel" ? "für Kabel" : "allgemein"}</div>
            {darf && <div className="lp-zeile">
              <Knopf klein icon="Pencil" onClick={() => navigiere(`/etiketten/vorlagen/${v.id}`)}>Bearbeiten</Knopf>
              <Knopf klein icon="Copy" onClick={() => aktion(() => api.post(`/api/v1/etiketten/vorlagen/${v.id}/kopieren`, {}))}>Kopieren</Knopf>
              {!v.standard && <Knopf klein icon="Star" onClick={() => aktion(() => api.post(`/api/v1/etiketten/vorlagen/${v.id}/standard`, {}))}>Als Standard</Knopf>}
              {!v.standard && <Knopf klein art="geist" icon="Trash2" aria-label={`${v.name} löschen`} onClick={() => aktion(() => api.del(`/api/v1/etiketten/vorlagen/${v.id}`))} />}
            </div>}
          </div>
        ))}
      </div>
    </Section>
  );
}

/** FA-11 Designer: verschieben, vergrößern, drehen, zentrieren, Raster/Snap, mm, Vorschau. */
export function VorlageDesigner({ params }) {
  const { api, navigiere } = useLager();
  const d = useDaten(() => api.get(`/api/v1/etiketten/vorlagen/${params.id}`), [params.id]);
  const [v, setV] = useState(null);
  const [wahl, setWahl] = useState(0);
  const [raster, setRaster] = useState(true);
  const [meldung, setMeldung] = useState(null);
  const [felder, setFelder] = useState({});
  const zug = useRef(null);
  useEffect(() => { if (d.daten) setV(d.daten); }, [d.daten]);
  const MASS = 8; // px je mm
  const svg = useMemo(() => (v ? vorschau(v) : ""), [v]);
  if (d.fehler) return <Seite titel="Vorlage"><Meldung level="error" text={d.fehler} /></Seite>;
  if (!v) return <Seite titel="Vorlage"><p className="lp-hinweis">Lädt …</p></Seite>;
  const r = (n) => (raster ? snap(n) : Math.round(n * 10) / 10);
  const el = v.elemente[wahl];
  const setzeEl = (i, w) => setV((a) => ({ ...a, elemente: a.elemente.map((e, j) => (j === i ? { ...e, ...w } : e)) }));
  const unten = (e, i, art) => {
    e.preventDefault(); e.stopPropagation(); setWahl(i);
    zug.current = { i, art, x: e.clientX, y: e.clientY, start: { ...v.elemente[i] } };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const bewegen = (e) => {
    const z = zug.current; if (!z) return;
    const dx = (e.clientX - z.x) / MASS, dy = (e.clientY - z.y) / MASS;
    if (z.art === "verschieben") setzeEl(z.i, { x: r(Math.max(0, Math.min(v.breite_mm - z.start.b, z.start.x + dx))), y: r(Math.max(0, Math.min(v.hoehe_mm - z.start.h, z.start.y + dy))) });
    else setzeEl(z.i, { b: r(Math.max(1, z.start.b + dx)), h: r(Math.max(1, z.start.h + dy)) });
  };
  const zahl = (k) => (e) => setzeEl(wahl, { [k]: e.target.value === "" ? 0 : Number(e.target.value) });
  const speichern = async () => {
    setMeldung(null); setFelder({});
    try { const x = await api.put(`/api/v1/etiketten/vorlagen/${v.id}`, v); setV(x.vorlage); setMeldung({ level: "success", text: x.text }); }
    catch (e) { setFelder(e.felder || {}); setMeldung({ level: "error", text: fehlerText(e) }); }
  };
  return (
    <Seite titel={`Vorlage: ${v.name}`} untertitel="Ziehe Elemente mit der Maus. Ecke unten rechts ändert die Größe. Maße in mm."
      aktionen={<><Knopf art="geist" onClick={() => navigiere("/etiketten?tab=vorlagen")}>Zurück</Knopf><Knopf art="primaer" icon="Save" onClick={speichern}>Speichern</Knopf></>}>
      {meldung && <Meldung {...meldung} onSchliessen={() => setMeldung(null)} />}
      <div className="lp-zeile" style={{ alignItems: "flex-start", gap: 24 }}>
        <Section titel="Etikett">
          <div className="lp-designer" style={{ width: v.breite_mm * MASS, height: v.hoehe_mm * MASS }} onPointerMove={bewegen} onPointerUp={() => { zug.current = null; }} data-testid="designer">
            <div dangerouslySetInnerHTML={{ __html: svg }} style={{ position: "absolute", inset: 0 }} className="lp-etikett" />
            {raster && <div className="lp-designer-raster" style={{ backgroundSize: `${MASS}px ${MASS}px` }} />}
            {v.elemente.map((e, i) => (
              <button key={i} type="button" className="lp-designer-el" aria-pressed={i === wahl} aria-label={`${ELEMENT_TYPEN[e.typ]} auswählen`}
                style={{ left: e.x * MASS, top: e.y * MASS, width: e.b * MASS, height: e.h * MASS, transform: e.dreh ? `rotate(${e.dreh}deg)` : undefined }}
                onPointerDown={(ev) => unten(ev, i, "verschieben")} onClick={() => setWahl(i)}>
                {i === wahl && <span className="lp-designer-griff" onPointerDown={(ev) => unten(ev, i, "groesse")} />}
              </button>
            ))}
          </div>
          <div className="lp-zeile" style={{ marginTop: 12 }}>
            <Toggle checked={raster} onChange={setRaster} label="Raster 0,5 mm (Snap)" />
            <div style={{ width: 220 }}><Auswahl aria-label="Element hinzufügen" leer="+ Element hinzufügen" value="" onChange={(e) => {
              if (!e.target.value) return;
              setV({ ...v, elemente: [...v.elemente, { typ: e.target.value, x: 1, y: 1, b: e.target.value === "qr" ? 15 : 20, h: e.target.value === "qr" ? 15 : 5, dreh: 0 }] }); setWahl(v.elemente.length);
            }} optionen={Object.entries(ELEMENT_TYPEN).map(([wert, titel]) => ({ wert, titel }))} /></div>
          </div>
          <h3 className="lp-h2" style={{ marginTop: 16 }}>Vorschau mit Beispieldaten (Kabel 5 m)</h3>
          <EtikettBild svg={svg} breite_mm={v.breite_mm} hoehe_mm={v.hoehe_mm} mass={4} data-testid="vorschau" />
        </Section>
        <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: 16 }}>
          <Section titel="Vorlage">
            <div className="lp-raster">
              <Feld label="Name" pflicht fehler={felder.name} breit><Eingabe value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Feld>
              <Feld label="Breite (mm)" fehler={felder.breite_mm}><Eingabe type="number" step="0.5" value={v.breite_mm} onChange={(e) => setV({ ...v, breite_mm: Number(e.target.value) })} /></Feld>
              <Feld label="Höhe (mm)" fehler={felder.hoehe_mm}><Eingabe type="number" step="0.5" value={v.hoehe_mm} onChange={(e) => setV({ ...v, hoehe_mm: Number(e.target.value) })} /></Feld>
              <Feld label="Verwendung"><Auswahl value={v.art} onChange={(e) => setV({ ...v, art: e.target.value })} optionen={[{ wert: "allgemein", titel: "Allgemein" }, { wert: "kabel", titel: "Kabel" }]} /></Feld>
              <Feld label="Hintergrund"><Eingabe type="color" value={v.farbe} onChange={(e) => setV({ ...v, farbe: e.target.value })} /></Feld>
            </div>
            {felder.elemente && <Meldung level="error" text={felder.elemente} />}
          </Section>
          {el ? (
            <Section titel={`Element: ${ELEMENT_TYPEN[el.typ]}`}>
              <div className="lp-raster">
                <Feld label="X (mm)"><Eingabe type="number" step="0.5" value={el.x} onChange={zahl("x")} /></Feld>
                <Feld label="Y (mm)"><Eingabe type="number" step="0.5" value={el.y} onChange={zahl("y")} /></Feld>
                <Feld label="Breite (mm)"><Eingabe type="number" step="0.5" value={el.b} onChange={zahl("b")} /></Feld>
                <Feld label="Höhe (mm)"><Eingabe type="number" step="0.5" value={el.h} onChange={zahl("h")} /></Feld>
                <Feld label="Drehung (Grad)"><Eingabe type="number" step="90" value={el.dreh || 0} onChange={zahl("dreh")} /></Feld>
                {!["qr", "barcode", "logo"].includes(el.typ) && <Feld label="Schriftgröße (mm)"><Eingabe type="number" step="0.2" value={el.groesse || ""} onChange={zahl("groesse")} /></Feld>}
                {el.typ === "text" && <Feld label="Text" breit><Eingabe value={el.text || ""} onChange={(e) => setzeEl(wahl, { text: e.target.value })} /></Feld>}
              </div>
              <div className="lp-zeile" style={{ marginTop: 12 }}>
                <Knopf klein icon="RotateCw" onClick={() => setzeEl(wahl, { dreh: ((el.dreh || 0) + 90) % 360 })}>Drehen</Knopf>
                <Knopf klein icon="AlignCenter" onClick={() => setzeEl(wahl, { x: r((v.breite_mm - el.b) / 2) })}>Waagrecht zentrieren</Knopf>
                <Knopf klein onClick={() => setzeEl(wahl, { y: r((v.hoehe_mm - el.h) / 2) })}>Senkrecht zentrieren</Knopf>
                <Knopf klein art="gefahr" icon="Trash2" onClick={() => { setV({ ...v, elemente: v.elemente.filter((_, j) => j !== wahl) }); setWahl(0); }}>Entfernen</Knopf>
              </div>
            </Section>
          ) : <Section><Leerzustand text="Kein Element. Füge eines hinzu." /></Section>}
        </div>
      </div>
    </Seite>
  );
}

/* ── Kabelfarben (FA-12) ── */
function Kabelfarben() {
  const { api, nutzer } = useLager();
  const l = useDaten(() => api.get("/api/v1/kabel/farben"), []);
  useLive(["artikel"], () => l.laden());
  const [meldung, setMeldung] = useState(null);
  return (
    <Section titel="Kabelfarben" icon="Cable" aktionen={darfMaterial(nutzer) && <Knopf icon="RefreshCw" onClick={async () => {
      setMeldung(null);
      try { const r = await api.post("/api/v1/kabel/neu-erkennen", {}); setMeldung({ level: "success", text: r.text }); l.laden(); } catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); }
    }}>Längen aus Namen neu erkennen</Knopf>}>
      <p className="lp-hinweis" style={{ marginTop: 0 }}>Jede Länge bekommt beim ersten Auftreten die nächste freie Farbe und behält sie. Das Etikett zeigt Länge und Farbfeld.</p>
      {meldung && <div style={{ margin: "10px 0" }}><Meldung {...meldung} onSchliessen={() => setMeldung(null)} /></div>}
      {l.daten?.hinweis && <div style={{ margin: "10px 0" }}><Meldung level="warning" text={l.daten.hinweis} /></div>}
      <Tabelle zeilen={l.daten?.zeilen} schluessel="laenge_m" leer={l.laedt ? "Lädt …" : "Noch keine Kabellängen. Lege Kabel mit Länge an oder nutze den Kabel-Assistenten."} spalten={[
        { titel: "Länge", wert: (z) => <strong>{z.text}</strong> },
        { titel: "Farbe", wert: (z) => (z.farbcode ? <span><span className="lp-farbfeld" style={{ background: z.hex }} /> {z.farbcode}</span> : <span className="lp-meta">keine (alle vergeben)</span>) },
        { titel: "Artikel", rechts: true, feld: "artikel" },
      ]} />
    </Section>
  );
}

/* ── Etikettendruck (FA-10, FA-14) ── */
export function EtikettenDruck({ query }) {
  const { api } = useLager();
  const codes = String(query.codes || "").split(",").filter(Boolean);
  const ids = String(query.ids || "").split(",").filter(Boolean).map(Number);
  const vorlagen = useDaten(() => api.get("/api/v1/etiketten/vorlagen"), []);
  const [vorlage, setVorlage] = useState("");
  const d = useDaten(() => (codes.length || ids.length ? api.post("/api/v1/etiketten/druck", { codes, ids, vorlage_id: vorlage ? Number(vorlage) : undefined }) : Promise.resolve({ etiketten: [], fehlend: [] })), [query.codes, query.ids, vorlage]);
  const [bogen, setBogen] = useState(null);
  const [meldung, setMeldung] = useState(null);
  // Gruppen gleicher Größe = ein Druckauftrag (Seitengröße aus der Vorlage)
  const gruppen = useMemo(() => {
    const m = new Map();
    for (const e of d.daten?.etiketten || []) { const k = `${e.breite_mm}x${e.hoehe_mm}`; if (!m.has(k)) m.set(k, { breite_mm: e.breite_mm, hoehe_mm: e.hoehe_mm, etiketten: [] }); m.get(k).etiketten.push(e); }
    return [...m.values()];
  }, [d.daten]);
  const drucken = async (g) => {
    setMeldung(null);
    setBogen(g);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      // Desktop: druckt den Bogen mit Seitengröße der Vorlage; Browser: Druckfenster mit je einem Etikett pro Seite (WEB-04)
      const r = await plattform.drucken({ breite_mm: g.breite_mm, hoehe_mm: g.hoehe_mm, titel: "Etiketten", seiten: g.etiketten.map((e) => e.svg) });
      setMeldung(r.ok ? { level: "success", text: r.web ? `Druckfenster mit ${g.etiketten.length} Etikett(en) ${g.breite_mm} × ${g.hoehe_mm} mm geöffnet. Wähle dort den Etikettendrucker.` : `${g.etiketten.length} Etikett(en) ${g.breite_mm} × ${g.hoehe_mm} mm an den Drucker gesendet.` } : { level: r.abgebrochen ? "info" : "error", text: r.text });
    } catch (e) { setMeldung({ level: "error", text: `Drucken fehlgeschlagen: ${e.message}. Prüfe den Drucker und versuche es erneut.` }); }
    finally { setBogen(null); }
  };
  return (
    <Seite titel="Etiketten drucken" untertitel={`${d.daten?.etiketten.length ?? "…"} Etikett(en). QR für alle, Barcode für Kabel.`}
      aktionen={<div style={{ width: 240 }}><Auswahl aria-label="Vorlage" leer="Standardvorlage je Art" value={vorlage} onChange={(e) => setVorlage(e.target.value)}
        optionen={(vorlagen.daten?.zeilen || []).map((v) => ({ wert: String(v.id), titel: `${v.name} (${v.breite_mm}×${v.hoehe_mm})` }))} /></div>}>
      {meldung && <Meldung {...meldung} onSchliessen={() => setMeldung(null)} />}
      {d.fehler && <Meldung level="error" text={d.fehler} />}
      {d.daten?.fehlend?.length > 0 && <Meldung level="warning" text={`Nicht gefunden: ${d.daten.fehlend.join(", ")}. Prüfe die Codes.`} />}
      {!codes.length && !ids.length && <Leerzustand text="Keine Geräte gewählt. Öffne den Druck aus der Geräteliste oder einem Artikel." icon="Printer" />}
      {gruppen.map((g) => (
        <Section key={`${g.breite_mm}x${g.hoehe_mm}`} titel={`${g.breite_mm} × ${g.hoehe_mm} mm`} icon="Printer"
          aktionen={<Knopf art="primaer" icon="Printer" onClick={() => drucken(g)}>{g.etiketten.length} drucken</Knopf>}>
          <div className="lp-etiketten-raster">
            {g.etiketten.map((e) => <EtikettBild key={e.code} svg={e.svg} breite_mm={e.breite_mm} hoehe_mm={e.hoehe_mm} data-code={e.code} />)}
          </div>
        </Section>
      ))}
      {bogen && createPortal(<div className="lp-druckbogen" aria-hidden="true">
        {bogen.etiketten.map((e) => <div key={e.code} className="lp-druckseite" style={{ width: `${e.breite_mm}mm`, height: `${e.hoehe_mm}mm` }} dangerouslySetInnerHTML={{ __html: e.svg }} />)}
      </div>, document.body)}
      {codes.length > 0 && !d.laedt && <p className="lp-hinweis" data-testid="druck-hinweis"><Icon name="Info" size={14} /> {plattform.istWeb
        ? "Im Browser öffnet „Drucken“ das Druckfenster des Browsers mit der Seitengröße der Vorlage. Direktdruck auf den Etikettendrucker gibt es nur in der Desktop-App."
        : "Etikettendrucker (z. B. Brother/Zebra): Wähle im Druckdialog das Etikettenformat; die Seitengröße kommt aus der Vorlage."}</p>}
    </Seite>
  );
}
