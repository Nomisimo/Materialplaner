// Scannen (FA-15), Packansicht je Projekt (FA-17) mit Verladen (R-60/R-61), Rückgabe-Tasche (R-46, R-48).
import React, { useState } from "react";
import { Seite, Section, Knopf, Tabelle, Auswahl, Feld, Meldung, Badge, Leerzustand, useDaten, useBestaetigung } from "@lager/ui/bausteine.jsx";
import { useLager, useLive } from "@lager/ui/huelle.jsx";
import { ScanPanel } from "@lager/ui/scannen.jsx";
import { ladeHerunter } from "@lager/ui/download.js";
import { fehlerText } from "@lager/ui/texte.js";
import { SCAN_MODI } from "@lager/domain/scannen.js";
import { PROJEKT_STATUS } from "@lager/domain/projekt.js";
import { datumAnzeige, zeitpunktAnzeige } from "@lager/domain/zeit.js";

const MODUS_OPT = Object.entries(SCAN_MODI).map(([wert, titel]) => ({ wert, titel }));
const mengeText = (m) => String(Math.round(Number(m) * 100) / 100).replace(".", ",");
const zeitraum = (p) => (p.beginn ? `${datumAnzeige(p.beginn)}${p.ende && p.ende !== p.beginn ? ` – ${datumAnzeige(p.ende)}` : ""}` : "ohne Termin");

/** Aktive Tasche bei der Rückgabe (R-46/R-48): Stand, offene Teile, „Offene als vermisst melden“, „Tasche beenden“. */
function TaschenKarte({ tasche, onNeu, onEnde }) {
  const { api } = useLager();
  const [fragen, dialog] = useBestaetigung();
  const [meldung, setMeldung] = useState(null);
  return (
    <Section titel={`Aktive Tasche ${tasche.code}`} icon="Box" aktionen={<>
      {tasche.offen.length > 0 && <Knopf icon="AlertTriangle" onClick={async () => {
        if (!(await fragen({ titel: "Offene als vermisst melden?", knopf: "Als vermisst melden", text: `${tasche.offen.length} Teil(e) wurden nicht zurückgescannt: ${tasche.offen.join(", ")}. Sie bleiben am Projekt und gelten als vermisst, bis sie wieder auftauchen.` }))) return;
        try { const r = await api.post("/api/v1/vermisst", { codes: tasche.offen, tasche: tasche.code }); setMeldung({ level: "warning", text: r.text }); onNeu(r.tasche); }
        catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); }
      }}>Offene als vermisst melden</Knopf>}
      <Knopf icon="Check" onClick={onEnde}>Tasche beenden</Knopf></>}>
      {dialog}
      {meldung && <Meldung {...meldung} onSchliessen={() => setMeldung(null)} />}
      <p style={{ margin: 0 }} data-testid="tasche-stand"><strong>{tasche.name}: {tasche.anzahl} von {tasche.soll || "?"}</strong> Teilen eingetragen.
        {tasche.offen.length ? ` Noch nicht zurück: ${tasche.offen.join(", ")}.` : " Alle Teile sind zurück."}</p>
    </Section>
  );
}

/* ── Scan-Seite (FA-15) ── */
export function ScanSeite({ query }) {
  const { api, navigiere } = useLager();
  const [modus, setModus] = useState(query.modus && SCAN_MODI[query.modus] ? query.modus : "packen");
  const [projektId, setProjektId] = useState(query.projekt || "");
  const [tasche, setTasche] = useState(null);
  const projekte = useDaten(() => api.get("/api/v1/projekte?limit=500&status=anfrage,angebot_gesendet,bestaetigt,laeuft"), []);
  const beiErgebnis = (r) => {
    if (r.weiter && r.projekt) { navigiere(`/projekte/${r.projekt.id}/packen`); return; } // R-23
    if (modus === "rueckgabe" && r.tasche) setTasche(r.tasche);
  };
  return (
    <Seite titel="Code scannen" untertitel="Handscanner oder Netzwerk-Scanner: Code scannen, Enter bucht. Projektcode öffnet die Packansicht.">
      <Section>
        <div className="lp-zeile" style={{ marginBottom: 12 }}>
          <div style={{ width: 200 }}><Feld label="Modus"><Auswahl value={modus} onChange={(e) => { setModus(e.target.value); setTasche(null); }} optionen={MODUS_OPT} /></Feld></div>
          {modus !== "rueckgabe" && <div style={{ flex: "1 1 280px" }}><Feld label="Projekt"><Auswahl value={projektId} leer="Projekt wählen" onChange={(e) => setProjektId(e.target.value)}
            optionen={(projekte.daten?.zeilen || []).map((p) => ({ wert: String(p.id), titel: `${p.nummer} ${p.name} (${zeitraum(p)})` }))} /></Feld></div>}
          {modus !== "rueckgabe" && projektId && <div style={{ alignSelf: "flex-end" }}><Knopf icon="ClipboardList" onClick={() => navigiere(`/projekte/${projektId}/packen`)}>Packansicht</Knopf></div>}
        </div>
        <ScanPanel modus={modus} projektId={modus === "rueckgabe" ? null : Number(projektId) || null} tasche={modus === "rueckgabe" ? tasche?.code : null} onErgebnis={beiErgebnis}
          deaktiviert={modus !== "rueckgabe" && !projektId ? "Wähle zuerst ein Projekt (oder scanne den Projektcode)" : null} />
      </Section>
      {modus === "rueckgabe" && tasche && <TaschenKarte tasche={tasche} onNeu={(t) => t && setTasche(t)} onEnde={() => setTasche(null)} />}
    </Seite>
  );
}

/* ── Packansicht je Projekt (FA-17, FA-19) ── */
export function Packansicht({ params }) {
  const { api, navigiere, nutzer } = useLager();
  const id = Number(params.id);
  const d = useDaten(() => api.get(`/api/v1/projekte/${id}/packstatus`), [id]);
  const [meldung, setMeldung] = useState(null);
  const [fragen, dialog] = useBestaetigung();
  useLive(["packen", "geraet", "projekt", "angebot"], (m) => { if (!m.projekt || m.projekt === id || m.id === id) d.laden(); });
  if (d.fehler) return <Seite titel="Packen"><Meldung level="error" text={d.fehler} /></Seite>;
  const s = d.daten;
  if (!s) return <Seite titel="Packen"><p className="lp-hinweis">Lädt …</p></Seite>;
  const p = s.projekt;
  const darf = nutzer.admin || nutzer.rechte.packen === "w";
  const aktion = async (fn) => { setMeldung(null); try { const r = await fn(); setMeldung({ level: r.level || "success", text: r.text }); d.laden(); } catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); } };
  return (
    <Seite titel={`Packen ${p.nummer} ${p.name}`} untertitel={`${p.kunde_firma || p.kunde} · ${zeitraum(p)} · ${PROJEKT_STATUS[p.status]}${s.angebot ? ` · Packliste aus ${s.angebot.nummer}` : ""}`}
      aktionen={<>
        {s.angebot && <Knopf icon="Printer" onClick={() => ladeHerunter(api, `/api/v1/angebote/${s.angebot.id}/packliste.pdf?download=1`, `Packliste ${p.nummer}.pdf`).catch((e) => setMeldung({ level: "error", text: fehlerText(e) }))}>Packliste drucken</Knopf>}
        <Knopf icon="ScanLine" onClick={() => navigiere(`/scan?modus=rueckgabe`)}>Rückgabe</Knopf>
        {darf && !p.gepackt_am && <Knopf art="primaer" icon="Truck" onClick={async () => {
          const offen = s.zeilen.filter((z) => z.fertig === false);
          if (!(await fragen({ titel: "Packen abschließen und verladen?", knopf: "Verladen", gefahr: false,
            text: `${offen.length ? `Achtung: ${offen.length} Position(en) sind noch nicht vollständig gepackt. ` : ""}Die Ladezone wird frei${p.status === "bestaetigt" ? " und das Projekt wechselt auf „Läuft“" : ""}.` }))) return;
          aktion(() => api.post(`/api/v1/projekte/${id}/verladen`, {}));
        }}>Packen abgeschlossen & verladen</Knopf>}
        {darf && p.gepackt_am && <Knopf icon="RotateCw" onClick={() => aktion(() => api.post(`/api/v1/projekte/${id}/packen-oeffnen`, {}))}>Packen wieder öffnen</Knopf>}
      </>}>
      {dialog}
      {meldung && <Meldung {...meldung} onSchliessen={() => setMeldung(null)} />}
      {p.gepackt_am && <Meldung level="success" text={`Verladen am ${zeitpunktAnzeige(p.gepackt_am)}${p.gepackt_von_name ? ` von ${p.gepackt_von_name}` : ""}. Weitere Scans bleiben möglich (Nachpacken).`} />}
      <Section titel="Fortschritt" icon="ListChecks">
        <div className="lp-zeile" style={{ alignItems: "center" }}>
          <div className="lp-fortschritt" style={{ flex: 1 }} role="progressbar" aria-valuenow={s.fortschritt} aria-valuemin={0} aria-valuemax={100} aria-label="Packfortschritt"><div style={{ width: `${s.fortschritt}%` }} /></div>
          <strong data-testid="fortschritt">{s.fortschritt} %</strong>
          {s.vollstaendig ? <Badge farbe="#1f6e32" text="#fff">Packliste vollständig</Badge> : <span className="lp-meta">{s.gepackt} Gerät(e) gepackt</span>}
        </div>
      </Section>
      {darf && <Section titel="Scannen" icon="ScanLine">
        <ScanPanel modus="packen" projektId={id} angebotId={s.angebot?.id || null} onErgebnis={() => d.laden()} />
      </Section>}
      <Section titel="Packliste" icon="ClipboardList">
        {!s.angebot ? <Leerzustand text="Für dieses Projekt gibt es noch kein Angebot. Gescannte Geräte erscheinen unten." icon="ClipboardList" /> :
          <Tabelle zeilen={s.zeilen} schluessel="artikel_id" leer="Keine packbaren Positionen." spalten={[
            { titel: "Artikel", wert: (z) => <div><strong>{z.artikel}</strong><span className="lp-meta"> · {z.kategorie}</span>
              {z.set && <div className="lp-meta">{z.set.text}{z.set.vorschlag?.length ? ` · Vorschlag: ${z.set.vorschlag.map((t) => t.code).join(", ")}` : ""}</div>}
              {z.inhalt && <div className="lp-meta">{z.inhalt.text}</div>}
              {z.verbrauch && <div className="lp-meta">Verbrauch – von Hand kontrollieren</div>}</div> },
            { titel: "Soll", rechts: true, wert: (z) => `${mengeText(z.soll)} ${z.einheit}` },
            { titel: "Im Projekt", rechts: true, wert: (z) => z.ist ?? "–" },
            { titel: "Gepackt", rechts: true, wert: (z) => z.gepackt ?? "–" },
            { titel: "Stand", wert: (z) => (z.fertig == null ? "–" : z.fertig ? <Badge farbe="#1f6e32" text="#fff">fertig</Badge> : <Badge farbe="#8a4b00" text="#fff">offen</Badge>) },
          ]} />}
      </Section>
      {s.ausserhalb.length > 0 && <Section titel="Nicht in der Packliste" icon="AlertTriangle">
        <Tabelle zeilen={s.ausserhalb} spalten={[{ titel: "Code", feld: "code" }, { titel: "Artikel", feld: "artikel" }, { titel: "Status", feld: "status" }]} onZeile={(g) => navigiere(`/geraete/${g.id}`)} />
      </Section>}
    </Seite>
  );
}
