// Scannen (FA-15), Packansicht je Projekt (FA-17) mit Verladen (R-60/R-61), Rückgabeansicht (FA-18) mit Tasche (R-46, R-48) und Funktionstest (R-47).
import { SchadenListe } from "@lager/ui/schaeden.jsx";
import React, { useState } from "react";
import { Seite, Section, Knopf, Tabelle, Auswahl, Feld, Eingabe, Meldung, Badge, Leerzustand, Toggle, Icon, useDaten, useBestaetigung } from "@lager/ui/bausteine.jsx";
import { useLager, useLive } from "@lager/ui/huelle.jsx";
import { ScanPanel } from "@lager/ui/scannen.jsx";
import { TaschenKarte, FunktionstestKarte, useFunktionstestSchalter } from "@lager/ui/rueckgabe.jsx";
import { ladeHerunter } from "@lager/ui/download.js";
import { fehlerText } from "@lager/ui/texte.js";
import { SCAN_MODI } from "@lager/domain/scannen.js";
import { PROJEKT_STATUS } from "@lager/domain/projekt.js";
import { datumAnzeige, zeitpunktAnzeige } from "@lager/domain/zeit.js";

const MODUS_OPT = Object.entries(SCAN_MODI).map(([wert, titel]) => ({ wert, titel }));
const mengeText = (m) => String(Math.round(Number(m) * 100) / 100).replace(".", ",");
const zeitraum = (p) => (p.beginn ? `${datumAnzeige(p.beginn)}${p.ende && p.ende !== p.beginn ? ` – ${datumAnzeige(p.ende)}` : ""}` : "ohne Termin");

/* ── Scan-Seite (FA-15) ── */
export function ScanSeite({ query }) {
  const { api, navigiere } = useLager();
  const [modus, setModus] = useState(query.modus && SCAN_MODI[query.modus] ? query.modus : "packen");
  const [projektId, setProjektId] = useState(query.projekt || "");
  const [tasche, setTasche] = useState(null);
  const [ft, setFt] = useFunktionstestSchalter();
  const [test, setTest] = useState(null);
  const [ftMeldung, setFtMeldung] = useState(null);
  const projekte = useDaten(() => api.get("/api/v1/projekte?limit=500&status=anfrage,angebot_gesendet,bestaetigt,laeuft"), []);
  const beiErgebnis = (r) => {
    if (r.weiter && r.projekt) { navigiere(`/projekte/${r.projekt.id}/packen`); return; } // R-23
    if (modus === "rueckgabe" && r.tasche) setTasche(r.tasche);
    if (modus === "rueckgabe" && ft && r.gebucht) setTest(r.code);
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
      {modus === "rueckgabe" && <Section><Toggle label="Funktionstest nach jedem Scan" checked={ft} onChange={setFt} /></Section>}
      {ftMeldung && <Meldung {...ftMeldung} onSchliessen={() => setFtMeldung(null)} />}
      {modus === "rueckgabe" && test && <FunktionstestKarte key={test} code={test} onFertig={(m) => { setTest(null); setFtMeldung(m); }} />}
      {modus === "rueckgabe" && tasche && <TaschenKarte tasche={tasche} onNeu={(t) => t && setTasche(t)} onEnde={() => setTasche(null)} />}
    </Seite>
  );
}

/* ── Packansicht je Projekt (FA-17, FA-19) ── */
/** FA-20/FA-21: Verlauf je Durchgang (Verladen, Rückgabe) mit Lieferschein bzw. Rückgabeprotokoll. */
function DurchgangVerlauf({ projektId, onFehler }) {
  const { api } = useLager();
  const v = useDaten(() => api.get(`/api/v1/projekte/${projektId}/durchgaenge`), [projektId]);
  useLive(["packen", "projekt"], (m) => { if (!m.projekt || m.projekt === projektId || m.id === projektId) v.laden(); });
  const beleg = (d) => ladeHerunter(api, `/api/v1/durchgaenge/${d.id}/pdf?download=1`, `${d.art === "verladen" ? "Lieferschein" : "Rückgabeprotokoll"} ${d.nr}.pdf`).catch((e) => onFehler(fehlerText(e)));
  return (
    <Section titel="Verlauf (Verladen und Rückgaben)" icon="History">
      <Tabelle zeilen={v.daten?.zeilen || []} leer="Noch nicht verladen oder zurückgegeben." spalten={[
        { titel: "Durchgang", wert: (d) => <strong>{d.art === "verladen" ? (d.nr > 1 ? `Nachlieferung ${d.nr - 1}` : "Verladen") : `Rückgabe ${d.nr}`}</strong> },
        { titel: "Zeit", wert: (d) => zeitpunktAnzeige(d.zeit) },
        { titel: "Person", wert: (d) => d.von || "–" },
        { titel: "Geräte", wert: (d) => (d.art === "verladen" ? `${d.anzahl} übergeben${d.neu ? ` · ${d.neu} neu` : ""}` : `${d.anzahl} zurück · ${d.fehlt} fehlen · ${d.defekt} defekt`) },
        { titel: "", wert: (d) => <Knopf klein icon="FileText" onClick={() => beleg(d)}>{d.art === "verladen" ? "Lieferschein" : "Rückgabeprotokoll"}</Knopf> },
      ]} />
    </Section>
  );
}

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
        <Knopf icon="ScanLine" onClick={() => navigiere(`/projekte/${id}/rueckgabe`)}>Rückgabe</Knopf>
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
      {p.gepackt_am && meldung?.level !== "success" && <Meldung level="success" text={`Verladen am ${zeitpunktAnzeige(p.gepackt_am)}${p.gepackt_von_name ? ` von ${p.gepackt_von_name}` : ""}. Weitere Scans bleiben möglich (Nachpacken).`} />}
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
      <DurchgangVerlauf projektId={id} onFehler={(t) => setMeldung({ level: "error", text: t })} />
      <Section titel="Packliste" icon="ClipboardList">
        {!s.angebot ? <Leerzustand text="Für dieses Projekt gibt es noch kein Angebot. Gescannte Geräte erscheinen unten." icon="ClipboardList" /> :
          <Tabelle zeilen={s.zeilen} schluessel="artikel_id" leer="Keine packbaren Positionen." spalten={[
            { titel: "Artikel", wert: (z) => <div><strong>{z.artikel}</strong><span className="lp-meta"> · {z.kategorie}</span>
              {(z.lagerort || z.lagerorte_weitere?.length > 0) && <div className="lp-meta" data-testid="lagerort"><Icon name="MapPin" size={12} /> {[z.lagerort, ...(z.lagerorte_weitere || [])].filter(Boolean).join(", ")}</div>}
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

/* ── Rückgabeansicht je Projekt (FA-18) ── */
export function Rueckgabeansicht({ params }) {
  const { api, navigiere, nutzer } = useLager();
  const id = Number(params.id);
  const d = useDaten(() => api.get(`/api/v1/projekte/${id}/rueckgabe`), [id]);
  const [tasche, setTasche] = useState(null);
  const [ft, setFt] = useFunktionstestSchalter();
  const [test, setTest] = useState(null);
  const [meldung, setMeldung] = useState(null);
  const [fragen, dialog] = useBestaetigung();
  useLive(["packen", "geraet", "projekt"], (m) => { if (!m.projekt || m.projekt === id || m.id === id) d.laden(); });
  if (d.fehler) return <Seite titel="Rückgabe"><Meldung level="error" text={d.fehler} /></Seite>;
  const s = d.daten;
  if (!s) return <Seite titel="Rückgabe"><p className="lp-hinweis">Lädt …</p></Seite>;
  const p = s.projekt;
  const darf = nutzer.admin || nutzer.rechte.packen === "w";
  const geraetSpalten = [{ titel: "Code", wert: (g) => <strong>{g.code}</strong> }, { titel: "Artikel", feld: "artikel" }];
  return (
    <Seite titel={`Rückgabe ${p.nummer} ${p.name}`} untertitel={`${p.kunde_firma || p.kunde} · ${zeitraum(p)} · ${PROJEKT_STATUS[p.status]}`}
      aktionen={<>
        <Knopf icon="ClipboardList" onClick={() => navigiere(`/projekte/${id}/packen`)}>Packansicht</Knopf>
        {darf && <Knopf art="primaer" icon="FileCheck" onClick={async () => {
          if (!(await fragen({ titel: "Rückgabe abschließen?", knopf: "Abschließen", gefahr: false,
            text: `Hält fest, was seit dem letzten Abschluss zurückkam${s.offen.length ? `, und dass ${s.offen.length} Gerät(e) noch fehlen` : ""}. Danach kannst du das Rückgabeprotokoll drucken. Weitere Rückgaben bleiben möglich.` }))) return;
          try { const r = await api.post(`/api/v1/projekte/${id}/rueckgabe-abschliessen`, {}); setMeldung({ level: r.level, text: r.text }); d.laden(); }
          catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); }
        }}>Rückgabe abschließen</Knopf>}
        {darf && s.offen.length > 0 && <Knopf icon="AlertTriangle" onClick={async () => {
          if (!(await fragen({ titel: "Alle offenen als vermisst melden?", knopf: "Als vermisst melden",
            text: `${s.offen.length} Gerät(e) sind noch nicht zurück: ${s.offen.map((g) => g.code).join(", ")}. Sie bleiben am Projekt und gelten als vermisst, bis sie wieder auftauchen.` }))) return;
          try { const r = await api.post("/api/v1/vermisst", { codes: s.offen.map((g) => g.code) }); setMeldung({ level: "warning", text: r.text }); d.laden(); }
          catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); }
        }}>Alle offenen als vermisst melden</Knopf>}
      </>}>
      {dialog}
      {meldung && <Meldung {...meldung} onSchliessen={() => setMeldung(null)} />}
      <Section titel="Stand" icon="ListChecks">
        <div className="lp-zeile" data-testid="rueckgabe-stand">
          <Badge farbe={s.offen.length ? "#8a4b00" : "#1f6e32"} text="#fff">{s.offen.length} noch draußen</Badge>
          <Badge farbe="#1f6e32" text="#fff">{s.zurueck.length} zurück</Badge>
          {s.vermisst.length > 0 && <Badge farbe="#a3261b" text="#fff">{s.vermisst.length} vermisst</Badge>}
          {!s.offen.length && <span className="lp-meta">Alles zurück{s.vermisst.length ? " oder als vermisst gemeldet" : ""}.</span>}
        </div>
      </Section>
      {darf && <Section titel="Zurückscannen" icon="ScanLine" aktionen={<Toggle label="Funktionstest nach jedem Scan" checked={ft} onChange={setFt} />}>
        <ScanPanel modus="rueckgabe" tasche={tasche?.code || null} onErgebnis={(r) => { if (r.tasche) setTasche(r.tasche); if (ft && r.gebucht) setTest(r.code); d.laden(); }} />
      </Section>}
      {test && <FunktionstestKarte key={test} code={test} onFertig={(m) => { setTest(null); setMeldung(m); d.laden(); }} />}
      {tasche && <TaschenKarte tasche={tasche} onNeu={(t) => { if (t) setTasche(t); d.laden(); }} onEnde={() => setTasche(null)} />}
      <DurchgangVerlauf projektId={id} onFehler={(t) => setMeldung({ level: "error", text: t })} />
      <SchadenListe pfad={`/api/v1/projekte/${id}/schaeden`} projektId={id} darfMelden={darf} />
      <Section titel="Noch draußen" icon="Truck">
        <Tabelle zeilen={s.offen} leer="Alle Geräte sind zurück." onZeile={(g) => navigiere(`/geraete/${g.id}`)}
          spalten={[...geraetSpalten, { titel: "In Tasche", wert: (g) => g.tasche || "–" }]} />
      </Section>
      {s.vermisst.length > 0 && <Section titel="Vermisst" icon="AlertTriangle">
        <Tabelle zeilen={s.vermisst} onZeile={(g) => navigiere(`/geraete/${g.id}`)} spalten={geraetSpalten} />
      </Section>}
      <Section titel="Zurück" icon="CheckCircle2">
        <Tabelle zeilen={s.zurueck} leer="Noch nichts zurückgescannt." onZeile={(g) => navigiere(`/geraete/${g.id}`)}
          spalten={[...geraetSpalten, { titel: "Buchung", feld: "aktion" }, { titel: "Zeit", wert: (g) => zeitpunktAnzeige(g.zeit) }]} />
      </Section>
    </Seite>
  );
}
