// FA-06 Inventur: Lauf je Kategorie starten, Geräte scannen, Abweichungen sehen, abschließen (fehlt → vermisst), Protokoll-PDF.
import React, { useRef, useState } from "react";
import { Seite, Section, Knopf, Tabelle, Auswahl, Feld, Meldung, Modal, Badge, Leerzustand, Tabs, useDaten, useBestaetigung } from "@lager/ui/bausteine.jsx";
import { useLager, useLive, useScanZiel } from "@lager/ui/huelle.jsx";
import { fehlerText } from "@lager/ui/texte.js";
import { ladeHerunter } from "@lager/ui/download.js";
import { STATUS } from "@lager/domain/geraet.js";
import { zeitpunktAnzeige } from "@lager/domain/zeit.js";

const FARBE = { offen: "#2f6fb0", abgeschlossen: "#1f6e32", abgebrochen: "#777" };
const LEVEL_FARBE = { ok: "var(--lp-ok)", info: "var(--lp-info, #2f6fb0)", warn: "var(--lp-warn)", error: "var(--lp-err)" };

export function InventurListe() {
  const { api, nutzer, navigiere } = useLager();
  const l = useDaten(() => api.get("/api/v1/inventuren"), []);
  const kats = useDaten(() => api.get("/api/v1/kategorien"), []);
  const [neu, setNeu] = useState(null);
  const [fehler, setFehler] = useState(null);
  useLive(["inventur"], () => l.laden());
  const darf = nutzer.admin || nutzer.rechte.geraete === "w";
  const starten = async () => {
    setFehler(null);
    try { const r = await api.post("/api/v1/inventuren", { kategorie_id: neu.kategorie_id ? Number(neu.kategorie_id) : null }); navigiere(`/inventur/${r.id}`); }
    catch (e) { setFehler(fehlerText(e)); }
  };
  const katListe = kats.daten || [];
  return (
    <Seite titel="Inventur" untertitel="Bestand je Kategorie zählen: Geräte scannen, Abweichungen prüfen, abschließen."
      aktionen={darf && <Knopf art="primaer" icon="Plus" onClick={() => { setFehler(null); setNeu({ kategorie_id: "" }); }}>Inventur starten</Knopf>}>
      {l.fehler && <Meldung level="error" text={l.fehler} />}
      <Section titel="Inventurläufe" icon="ClipboardList">
        <Tabelle zeilen={l.daten || []} leer="Noch keine Inventur. Starte eine mit „Inventur starten“." onZeile={(i) => navigiere(`/inventur/${i.id}`)} spalten={[
          { titel: "Bereich", wert: (i) => <strong>{i.kategorie || "Gesamter Bestand"}</strong> },
          { titel: "Status", wert: (i) => <Badge farbe={FARBE[i.status]} text="#fff">{i.status_text}</Badge> },
          { titel: "Gestartet", wert: (i) => `${zeitpunktAnzeige(i.gestartet)} · ${i.gestartet_von}` },
          { titel: "Gezählt", rechts: true, feld: "gescannt" },
          { titel: "Fehlt", rechts: true, wert: (i) => (i.fehlt == null ? "–" : i.fehlt) },
        ]} />
      </Section>
      {neu && <Modal titel="Inventur starten" onSchliessen={() => setNeu(null)} fuss={<>
        <Knopf onClick={() => setNeu(null)}>Abbrechen</Knopf>
        <Knopf art="primaer" icon="Play" onClick={starten}>Starten</Knopf></>}>
        {fehler && <Meldung level="error" text={fehler} />}
        <Feld label="Bereich (Kategorie)" hinweis="Soll-Bestand: alle Geräte der Kategorie, die im Lager stehen müssen (nicht unterwegs, nicht ausgemustert).">
          <Auswahl value={neu.kategorie_id} leer="Gesamter Bestand" onChange={(e) => setNeu({ kategorie_id: e.target.value })}
            optionen={katListe.map((k) => ({ wert: String(k.id), titel: k.name }))} />
        </Feld>
      </Modal>}
    </Seite>
  );
}

export function InventurDetail({ params }) {
  const { api, nutzer, navigiere } = useLager();
  const id = Number(params.id);
  const d = useDaten(() => api.get(`/api/v1/inventuren/${id}`), [id]);
  const [code, setCode] = useState("");
  const [letzte, setLetzte] = useState(null);
  const [meldung, setMeldung] = useState(null);
  const [tab, setTab] = useState("fehlt");
  const [fragen, dialog] = useBestaetigung();
  const feld = useRef(null);
  useLive(["inventur"], (m) => { if (!m.id || m.id === id) d.laden(); });
  const darf = nutzer.admin || nutzer.rechte.geraete === "w";
  const buche = async (c) => {
    if (!c?.trim()) return;
    try { const r = await api.post(`/api/v1/inventuren/${id}/scan`, { code: c.trim() }); setLetzte(r); d.laden(); }
    catch (e) { setLetzte({ level: "error", text: fehlerText(e) }); }
    feld.current?.focus();
  };
  const offen = d.daten?.inventur.status === "offen";
  useScanZiel((c) => { if (offen && darf) buche(c); });
  if (d.fehler) return <Seite titel="Inventur"><Meldung level="error" text={d.fehler} /></Seite>;
  if (!d.daten) return <Seite titel="Inventur"><p className="lp-hinweis">Lädt …</p></Seite>;
  const x = d.daten, i = x.inventur;
  const aktion = async (fn) => { setMeldung(null); try { const r = await fn(); setMeldung({ level: r.level || "success", text: r.text }); d.laden(); } catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); } };
  const codeSpalten = [{ titel: "Code", wert: (g) => <a href={`#/geraete/code/${g.code}`}><strong>{g.code}</strong></a> }, { titel: "Artikel", wert: (g) => g.artikel || "–" }];
  const status = { titel: "Status", wert: (g) => STATUS[g.status] || "–" };
  const tabellen = {
    fehlt: <Tabelle zeilen={x.fehlt} schluessel="code" leer="Nichts fehlt." spalten={[...codeSpalten, status]} />,
    zuViel: <Tabelle zeilen={x.zuViel} schluessel="code" leer="Nichts zu viel." spalten={[...codeSpalten, { titel: "Kategorie", feld: "kategorie" }, status]} />,
    unbekannt: <Tabelle zeilen={x.unbekannt} schluessel="code" leer="Keine unbekannten Codes." spalten={[{ titel: "Code", feld: "code" }, { titel: "Gescannt", wert: (s) => `${zeitpunktAnzeige(s.zeit)} · ${s.von}` }]} />,
    ok: <Tabelle zeilen={x.ok} schluessel="code" leer="Noch nichts gezählt." spalten={[...codeSpalten, status]} />,
  };
  return (
    <Seite titel={`Inventur ${i.kategorie || "Gesamter Bestand"}`} untertitel={`${i.status_text} · gestartet ${zeitpunktAnzeige(i.gestartet)} von ${i.gestartet_von}${i.abgeschlossen ? ` · beendet ${zeitpunktAnzeige(i.abgeschlossen)} von ${i.abgeschlossen_von}` : ""}`}
      aktionen={<>
        <Knopf icon="ArrowLeft" onClick={() => navigiere("/inventur")}>Alle Inventuren</Knopf>
        <Knopf icon="Printer" onClick={() => ladeHerunter(api, `/api/v1/inventuren/${id}/protokoll.pdf?download=1`, `Inventur ${id}.pdf`).catch((e) => setMeldung({ level: "error", text: fehlerText(e) }))}>Protokoll (PDF)</Knopf>
        {darf && offen && <Knopf icon="X" onClick={async () => { if (await fragen({ titel: "Inventur abbrechen?", text: "Die Zählung wird verworfen. Es wird nichts gebucht.", knopf: "Abbrechen" })) aktion(() => api.post(`/api/v1/inventuren/${id}/abbrechen`, {})); }}>Abbrechen</Knopf>}
        {darf && offen && <Knopf art="primaer" icon="CheckCircle2" onClick={async () => {
          if (!(await fragen({ titel: "Inventur abschließen?", gefahr: x.fehlt.length > 0, knopf: "Abschließen und buchen",
            text: `${x.fehlt.length ? `${x.fehlt.length} Gerät(e) wurden nicht gefunden und werden als vermisst gemeldet. ` : "Alle Geräte wurden gefunden. "}${x.zuViel.filter((s) => s.status === "vermisst").length ? "Gefundene vermisste Geräte kommen zurück ins Lager. " : ""}Danach ist keine Zählung mehr möglich.` }))) return;
          aktion(() => api.post(`/api/v1/inventuren/${id}/abschliessen`, {}));
        }}>Abschließen</Knopf>}
      </>}>
      {dialog}
      {meldung && <Meldung {...meldung} onSchliessen={() => setMeldung(null)} />}
      <div className="lp-raster" data-testid="inventur-zahlen">
        {[["Soll", x.soll_anzahl], ["Gezählt", x.ok.length], ["Fehlt", x.fehlt.length], ["Zu viel", x.zuViel.length], ["Unbekannt", x.unbekannt.length]].map(([t, n]) => (
          <div key={t} className="lp-section" style={{ padding: 14 }}><div className="lp-label">{t}</div><strong style={{ fontSize: 22 }} data-testid={`inventur-${t.toLowerCase().replace(" ", "-")}`}>{n}</strong></div>))}
      </div>
      {darf && offen && <Section titel="Scannen" icon="ScanLine">
        <form onSubmit={(e) => { e.preventDefault(); buche(code); setCode(""); }} className="lp-zeile">
          <input ref={feld} autoFocus className="lp-input" style={{ flex: 1, fontSize: 18 }} placeholder="Code scannen oder eingeben …" aria-label="Code für die Inventur" data-testid="inventur-scanfeld" value={code} onChange={(e) => setCode(e.target.value)} />
          <Knopf art="primaer" icon="Check">Zählen</Knopf>
        </form>
        {letzte && <div className="lp-scan-ergebnis" data-testid="inventur-ergebnis" data-level={letzte.level} role="status" aria-live="assertive" style={{ borderColor: LEVEL_FARBE[letzte.level] || "var(--lp-err)", marginTop: 8 }}>{letzte.text}</div>}
      </Section>}
      <Section titel="Abgleich" icon="ListChecks">
        <Tabs tabs={[{ id: "fehlt", titel: `Fehlt (${x.fehlt.length})` }, { id: "zuViel", titel: `Zu viel (${x.zuViel.length})` }, { id: "unbekannt", titel: `Unbekannt (${x.unbekannt.length})` }, { id: "ok", titel: `Gezählt (${x.ok.length})` }]} aktiv={tab} onWechsel={setTab} />
        {x.soll_anzahl === 0 && !x.gescannt ? <Leerzustand text="Im Bereich stehen keine Geräte im Lager." icon="ClipboardList" /> : tabellen[tab]}
      </Section>
    </Seite>
  );
}
