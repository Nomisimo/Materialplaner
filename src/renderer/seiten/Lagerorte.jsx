// FA-08 Lagerorte/Regalplätze: Liste, anlegen, bearbeiten, löschen. Zuordnung am Artikel bzw. Gerät, Anzeige beim Packen.
import React, { useState } from "react";
import { Seite, Section, Knopf, Tabelle, Eingabe, Feld, Meldung, Modal, Toggle, useDaten, useFormular, useBestaetigung } from "@lager/ui/bausteine.jsx";
import { useLager, useLive } from "@lager/ui/huelle.jsx";
import { fehlerText } from "@lager/ui/texte.js";

function OrtDialog({ ort, onFertig, onSchliessen }) {
  const { api } = useLager();
  const f = useFormular({ name: ort?.name || "", bereich: ort?.bereich || "", notiz: ort?.notiz || "", aktiv: ort?.aktiv ?? true });
  const speichern = async () => {
    const r = await f.absenden((w) => (ort ? api.put(`/api/v1/lagerorte/${ort.id}`, w) : api.post("/api/v1/lagerorte", w)));
    if (r) onFertig(r);
  };
  return (
    <Modal titel={ort ? `${ort.name} bearbeiten` : "Lagerort anlegen"} onSchliessen={onSchliessen} fuss={<><Knopf onClick={onSchliessen}>Abbrechen</Knopf><Knopf art="primaer" icon="Save" onClick={speichern}>Speichern</Knopf></>}>
      {f.meldung && <Meldung {...f.meldung} />}
      <Feld label="Name" pflicht fehler={f.fehler.name}><Eingabe value={f.werte.name} onChange={f.setze("name")} placeholder="z. B. Regal A3" autoFocus /></Feld>
      <Feld label="Bereich" hinweis="z. B. Halle 1, Keller"><Eingabe value={f.werte.bereich} onChange={f.setze("bereich")} /></Feld>
      <Feld label="Notiz"><Eingabe value={f.werte.notiz} onChange={f.setze("notiz")} /></Feld>
      <Feld label="Status"><Toggle checked={f.werte.aktiv} onChange={f.setze("aktiv")} label="in Benutzung" /></Feld>
    </Modal>
  );
}

export function LagerorteSeite() {
  const { api, nutzer } = useLager();
  const l = useDaten(() => api.get("/api/v1/lagerorte"), []);
  const [form, setForm] = useState(null);
  const [meldung, setMeldung] = useState(null);
  const [fragen, dialog] = useBestaetigung();
  useLive(["lagerort"], () => l.laden());
  const darf = nutzer.admin || nutzer.rechte.material === "w";
  const loeschen = async (o) => {
    if (!(await fragen({ titel: `${o.name} löschen?`, text: "Der Lagerort wird entfernt.", knopf: "Löschen" }))) return;
    try { const r = await api.del(`/api/v1/lagerorte/${o.id}`); setMeldung({ level: "success", text: r.text }); l.laden(); }
    catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); }
  };
  return (
    <Seite titel="Lagerorte" untertitel="Regalplätze für Artikel und Geräte. Beim Packen steht der Platz an jeder Position."
      aktionen={darf && <Knopf art="primaer" icon="Plus" onClick={() => setForm({})}>Lagerort anlegen</Knopf>}>
      {dialog}
      {meldung && <Meldung {...meldung} onSchliessen={() => setMeldung(null)} />}
      {l.fehler && <Meldung level="error" text={l.fehler} />}
      <Section titel="Lagerorte" icon="MapPin">
        <Tabelle zeilen={l.daten?.zeilen || []} leer="Noch keine Lagerorte. Lege den ersten mit „Lagerort anlegen“ an." onZeile={darf ? (o) => setForm(o) : undefined} spalten={[
          { titel: "Name", wert: (o) => <strong style={{ opacity: o.aktiv ? 1 : 0.55 }}>{o.name}{o.aktiv ? "" : " (inaktiv)"}</strong> },
          { titel: "Bereich", wert: (o) => o.bereich || "–" },
          { titel: "Artikel", rechts: true, feld: "artikel" },
          { titel: "Geräte (abweichend)", rechts: true, feld: "geraete" },
          { titel: "Notiz", wert: (o) => o.notiz || "" },
          ...(darf ? [{ titel: "", wert: (o) => <Knopf klein art="gefahr" icon="Trash2" aria-label={`${o.name} löschen`} onClick={(e) => { e.stopPropagation(); loeschen(o); }} /> }] : []),
        ]} />
      </Section>
      {form && <OrtDialog ort={form.id ? form : null} onSchliessen={() => setForm(null)} onFertig={(r) => { setForm(null); setMeldung({ level: "success", text: r.text }); l.laden(); }} />}
    </Seite>
  );
}
