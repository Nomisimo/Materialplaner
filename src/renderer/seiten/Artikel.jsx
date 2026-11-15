// R-71 Material aufnehmen / bearbeiten (eine Maske, Felder je Art), R-72 Kennzeichnung, FA-02 löschen, FA-04 Bestand, FA-05 Detail.
import { AenderungsVerlauf } from "@lager/ui/aenderungen.jsx";
import React, { useEffect, useState } from "react";
import { Seite, Section, Knopf, Feld, Eingabe, Auswahl, Textfeld, Toggle, Meldung, Tabelle, GeldEingabe, useDaten, useFormular, useBestaetigung, Badge } from "@lager/ui/bausteine.jsx";
import { useLager, useLive } from "@lager/ui/huelle.jsx";
import { ARTEN, ART_TITEL, ART_FELDER, artVon, wendeArtAn } from "@lager/domain/artikel.js";
import { euro } from "@lager/domain/geld.js";
import { STATUS } from "@lager/domain/geraet.js";
import { PRUEF_TEXT } from "@lager/domain/pruefung.js";
import { fehlerText } from "@lager/ui/texte.js";
import { PIKTOGRAMM_LISTE } from "@lager/domain/plansymbole.js";

const LEER = { name: "", kategorie_id: null, hersteller: "", beschreibung: "", aktiv: true, preis_tag: 0, folgetag_prozent: null, verkaeuflich: false,
  verkaufspreis: null, mengenschritt: 1, inhalt_artikel_id: null, verpackungseinheit: null, zeitmodell: "tag", preis_erweitert: null,
  bestand: 0, mindestbestand: null, einheit: "Stück", pruefpflichtig: true, pruef_intervall_monate: 12, wartung_intervall_monate: null, wartung_text: "", gewicht_kg: null, lagerort_id: null, plansymbol: "", laenge_m: null };

export function ArtikelFormular({ params }) {
  const { api, navigiere } = useLager();
  const neu = !params.id;
  const kats = useDaten(() => api.get("/api/v1/kategorien"), []);
  const orte = useDaten(() => api.get("/api/v1/lagerorte"), []);
  const cases = useDaten(() => api.get("/api/v1/artikel?limit=500"), []);
  const f = useFormular({ ...LEER, anzahl: 0, kennzeichnung: "qr" }, { live: neu ? null : { typ: "artikel", id: params.id }, laden: () => api.get(`/api/v1/artikel/${params.id}`), zurueck: () => navigiere("/material") });
  const [art, setArt] = useState("geraet");
  useEffect(() => {
    if (neu) return;
    api.get(`/api/v1/artikel/${params.id}`).then((a) => { f.setWerte({ ...LEER, ...a }); setArt(artVon(a)); });
  }, [params.id]);
  const sichtbar = new Set(ART_FELDER[art]);
  const w = f.werte;
  const zahl = (k) => (e) => f.setze(k)(e.target.value === "" ? null : Number(e.target.value));
  const speichern = () => f.absenden(async (werte) => {
    const daten = wendeArtAn(werte, art);
    const r = neu ? await api.post("/api/v1/artikel", daten) : await api.put(`/api/v1/artikel/${params.id}`, daten);
    const id = r.artikel.id;
    if (neu && r.geraete?.codes?.length) navigiere(`/etiketten/druck?codes=${r.geraete.codes.join(",")}`); // R-72 qr: Etikettendruck öffnet
    else if (neu && r.bestellung) navigiere(`/etiketten/bestellungen/${r.bestellung.id}`); // R-72 bestellen
    else navigiere(`/material/${id}`);
    return r;
  });
  const geraeteArt = art === "geraet" || art === "case" || art === "kabel";
  return (
    <Seite titel={neu ? "Material aufnehmen" : `Bearbeiten: ${w.name}`} aktionen={<Knopf art="geist" onClick={() => history.back()}>Zurück</Knopf>}>
      <Section titel="Art" icon="Package">
        <div className="lp-zeile" role="radiogroup" aria-label="Art">
          {ARTEN.map((a) => <Knopf key={a} art={art === a ? "primaer" : "normal"} role="radio" aria-checked={art === a} onClick={() => setArt(a)}>{ART_TITEL[a]}</Knopf>)}
        </div>
      </Section>
      <Section titel="Stammdaten">
        <div className="lp-raster">
          <Feld label="Name" pflicht fehler={f.fehler.name}><Eingabe value={w.name} onChange={f.setze("name")} autoFocus={neu} /></Feld>
          <Feld label="Kategorie" pflicht fehler={f.fehler.kategorie_id}><Auswahl leer="– wählen –" value={w.kategorie_id ?? ""} onChange={(e) => f.setze("kategorie_id")(e.target.value ? Number(e.target.value) : null)}
            optionen={(kats.daten || []).map((k) => ({ wert: k.id, titel: `${k.name} (${k.praefix})` }))} /></Feld>
          {sichtbar.has("lagerort_id") && <Feld label="Lagerort" hinweis="Regalplatz, wird beim Packen angezeigt"><Auswahl leer="– kein fester Platz –" value={w.lagerort_id ?? ""} onChange={(e) => f.setze("lagerort_id")(e.target.value ? Number(e.target.value) : null)}
            optionen={(orte.daten?.zeilen || []).filter((o) => o.aktiv || o.id === w.lagerort_id).map((o) => ({ wert: o.id, titel: o.bereich ? `${o.name} (${o.bereich})` : o.name }))} /></Feld>}
          {sichtbar.has("hersteller") && <Feld label="Hersteller"><Eingabe value={w.hersteller} onChange={f.setze("hersteller")} /></Feld>}
          {art === "kabel" && <Feld label="Länge in m" pflicht fehler={f.fehler.laenge_m}><Eingabe type="number" step="0.5" min="0" value={w.laenge_m ?? ""} onChange={zahl("laenge_m")} /></Feld>}
          <Feld label={art === "leistung" ? "Tagessatz" : "Mietpreis pro Stück und Tag"} fehler={f.fehler.preis_tag}><GeldEingabe cent={w.preis_tag} onCent={f.setze("preis_tag")} /></Feld>
          {sichtbar.has("folgetag_prozent") && <Feld label="Folgetage in %" fehler={f.fehler.folgetag_prozent} hinweis="Leer = Standard aus den Einstellungen"><Eingabe type="number" min="0" max="100" value={w.folgetag_prozent ?? ""} onChange={zahl("folgetag_prozent")} /></Feld>}
          {sichtbar.has("mengenschritt") && <Feld label="Nur in Sets zu … Stück" fehler={f.fehler.mengenschritt}><Eingabe type="number" min="1" value={w.mengenschritt} onChange={zahl("mengenschritt")} /></Feld>}
          {art === "case" && <>
            <Feld label="Inhalt-Artikel" fehler={f.fehler.inhalt_artikel_id}><Auswahl leer="– keiner –" value={w.inhalt_artikel_id ?? ""} onChange={(e) => f.setze("inhalt_artikel_id")(e.target.value ? Number(e.target.value) : null)}
              optionen={(cases.daten?.zeilen || []).filter((a) => !a.ist_case && !a.ist_leistung && a.id !== Number(params.id)).map((a) => ({ wert: a.id, titel: a.name }))} /></Feld>
            <Feld label="Teile pro Case (Verpackungseinheit)" fehler={f.fehler.verpackungseinheit}><Eingabe type="number" min="0" value={w.verpackungseinheit ?? ""} onChange={zahl("verpackungseinheit")} /></Feld>
          </>}
          {art === "leistung" && <>
            <Feld label="Zeitmodell" fehler={f.fehler.zeitmodell}><Auswahl value={w.zeitmodell || "tag"} onChange={f.setze("zeitmodell")} optionen={[{ wert: "tag", titel: "Tagessatz" }, { wert: "stunde", titel: "Stundensatz" }, { wert: "pauschale", titel: "Pauschale" }]} /></Feld>
            <Feld label="Preis erweiterter Tag (Überstunden)" fehler={f.fehler.preis_erweitert}><GeldEingabe cent={w.preis_erweitert} onCent={f.setze("preis_erweitert")} /></Feld>
          </>}
          {art === "verbrauch" && <>
            <Feld label="Bestand" fehler={f.fehler.bestand}><Eingabe type="number" min="0" value={w.bestand} onChange={zahl("bestand")} /></Feld>
            <Feld label="Mindestbestand" fehler={f.fehler.mindestbestand}><Eingabe type="number" min="0" value={w.mindestbestand ?? ""} onChange={zahl("mindestbestand")} /></Feld>
            <Feld label="Einheit"><Eingabe value={w.einheit} onChange={f.setze("einheit")} /></Feld>
          </>}
          {sichtbar.has("verkaeuflich") && <Feld label="Verkauf"><Toggle checked={w.verkaeuflich} onChange={f.setze("verkaeuflich")} label="auch zum Verkauf" /></Feld>}
          {sichtbar.has("verkaufspreis") && w.verkaeuflich && <Feld label="Verkaufspreis" fehler={f.fehler.verkaufspreis}><GeldEingabe cent={w.verkaufspreis} onCent={f.setze("verkaufspreis")} /></Feld>}
          {sichtbar.has("pruefpflichtig") && <Feld label="Prüfung"><Toggle checked={w.pruefpflichtig} onChange={f.setze("pruefpflichtig")} label="prüfpflichtig" /></Feld>}
          {sichtbar.has("pruef_intervall_monate") && w.pruefpflichtig && <Feld label="Prüfintervall (Monate)" fehler={f.fehler.pruef_intervall_monate}><Eingabe type="number" min="1" max="120" value={w.pruef_intervall_monate} onChange={zahl("pruef_intervall_monate")} /></Feld>}
          {sichtbar.has("wartung_intervall_monate") && <Feld label="Wartungsintervall (Monate)" fehler={f.fehler.wartung_intervall_monate} hinweis="Für Wartung ohne Prüfpflicht, leer = keine"><Eingabe type="number" min="1" max="120" value={w.wartung_intervall_monate} onChange={zahl("wartung_intervall_monate")} /></Feld>}
          {sichtbar.has("wartung_text") && w.wartung_intervall_monate && <Feld label="Was wird gewartet?"><Eingabe value={w.wartung_text} onChange={f.setze("wartung_text")} placeholder="z. B. Lüfter reinigen" /></Feld>}
          {sichtbar.has("gewicht_kg") && <Feld label="Gewicht (kg)" fehler={f.fehler.gewicht_kg} hinweis="Für Ladelisten und Fahrzeug-Zuladung"><Eingabe type="number" min="0" step="0.1" value={w.gewicht_kg ?? ""} onChange={zahl("gewicht_kg")} /></Feld>}
          {sichtbar.has("plansymbol") && <Feld label="Plan-Symbol (yEd)" fehler={f.fehler.plansymbol} hinweis="Piktogramm für die Symbolbibliothek"><Auswahl aria-label="Plan-Symbol" leer="automatisch (aus dem Namen)" value={w.plansymbol} onChange={f.setze("plansymbol")} optionen={PIKTOGRAMM_LISTE} /></Feld>}
          <Feld label="Status"><Toggle checked={w.aktiv} onChange={f.setze("aktiv")} label="aktiv" /></Feld>
          <Feld label="Beschreibung" breit><Textfeld value={w.beschreibung} onChange={f.setze("beschreibung")} /></Feld>
        </div>
      </Section>
      {neu && geraeteArt && <Section titel="Bestand anlegen" icon="QrCode">
        <div className="lp-raster">
          <Feld label="Anzahl Geräte" fehler={f.fehler.anzahl}><Eingabe type="number" min="0" max="500" value={w.anzahl} onChange={zahl("anzahl")} /></Feld>
          {w.anzahl > 0 && <Feld label="Kennzeichnung" fehler={f.fehler.kennzeichnung} hinweis="QR: Geräte sofort anlegen und Etiketten drucken. Bestellen: Etiketten beim Lieferanten bestellen, Geräte entstehen bei Lieferung.">
            <Auswahl value={w.kennzeichnung} onChange={f.setze("kennzeichnung")} optionen={[{ wert: "qr", titel: "QR – jetzt anlegen und drucken" }, { wert: "bestellen", titel: "Etiketten bestellen" }, { wert: "keine", titel: "Keine" }]} /></Feld>}
        </div>
      </Section>}
      {f.band}
      {f.meldung && <Meldung {...f.meldung} />}
      <div className="lp-zeile"><Knopf art="primaer" icon="Save" onClick={speichern}>Speichern</Knopf></div>
    </Seite>
  );
}

export function ArtikelDetail({ params }) {
  const { api, navigiere, nutzer } = useLager();
  const d = useDaten(() => api.get(`/api/v1/artikel/${params.id}`), [params.id]);
  const [meldung, setMeldung] = useState(null);
  const [menge, setMenge] = useState("");
  const [fragen, dialog] = useBestaetigung();
  useLive(["artikel", "geraet"], () => d.laden());
  const a = d.daten;
  if (d.fehler) return <Seite titel="Material"><Meldung level="error" text={d.fehler} /></Seite>;
  if (!a) return <Seite titel="Material"><p className="lp-hinweis">Lädt …</p></Seite>;
  const darfM = nutzer.admin || nutzer.rechte.material === "w";
  const darfP = nutzer.admin || nutzer.rechte.packen === "w";
  const darfG = nutzer.admin || nutzer.rechte.geraete === "w";
  const aktion = async (fn) => { try { const r = await fn(); setMeldung({ level: r.level || "success", text: r.text }); d.laden(); } catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); } };
  return (
    <Seite titel={a.name} untertitel={`${a.kategorie} · ${a.typ}${a.hersteller ? " · " + a.hersteller : ""}`}
      aktionen={<>
        {darfM && <Knopf icon="Pencil" onClick={() => navigiere(`/material/${a.id}/bearbeiten`)}>Bearbeiten</Knopf>}
        {darfM && <Knopf art="gefahr" icon="Trash2" onClick={async () => {
          if (!(await fragen({ titel: "Artikel löschen?", text: `„${a.name}“ und seine Geräte ohne Verlauf werden gelöscht.`, knopf: "Löschen" }))) return;
          try { await api.del(`/api/v1/artikel/${a.id}`); navigiere("/material"); } catch (e) { setMeldung({ level: "error", text: fehlerText(e) }); }
        }}>Löschen</Knopf>}
      </>}>
      {meldung && <Meldung {...meldung} onSchliessen={() => setMeldung(null)} />}
      <Section titel="Daten">
        <div className="lp-raster">
          <div><div className="lp-label">Mietpreis/Tag</div>{euro(a.preis_tag)}</div>
          {a.lagerort && <div><div className="lp-label">Lagerort</div>{a.lagerort}</div>}
          {a.folgetag_prozent != null && <div><div className="lp-label">Folgetage</div>{a.folgetag_prozent} %</div>}
          {a.mengenschritt > 1 && <div><div className="lp-label">Set</div>{a.mengenschritt} Stück</div>}
          {a.laenge_m && <div><div className="lp-label">Länge</div>{String(a.laenge_m).replace(".", ",")} m</div>}
          {a.ist_case && <div><div className="lp-label">Inhalt</div>{a.inhalt_artikel || "–"} · {a.verpackungseinheit || a.inhalt_mengenschritt || 0} Teile</div>}
          {a.verkaeuflich && <div><div className="lp-label">Verkaufspreis</div>{euro(a.verkaufspreis)}</div>}
          <div><div className="lp-label">Prüfung</div>{a.pruefpflichtig ? `alle ${a.pruef_intervall_monate} Monate` : "keine Prüfpflicht"}</div>
          {!a.aktiv && <div><Badge farbe="var(--lp-warn)" text="#000">inaktiv</Badge></div>}
        </div>
        {a.beschreibung && <p>{a.beschreibung}</p>}
      </Section>
      {a.verbrauch && <Section titel="Bestand (Verbrauchsmaterial)" icon="Box">
        <p style={{ marginTop: 0 }}>Aktuell <b>{a.bestand} {a.einheit}</b>{a.mindestbestand != null && <> · Mindestbestand {a.mindestbestand}</>}</p>
        {a.niedrig && <Meldung level="warning" text="Mindestbestand erreicht. Bitte nachbestellen." />}
        {darfP && <div className="lp-zeile" style={{ marginTop: 10 }}>
          <div style={{ width: 140 }}><Eingabe type="number" aria-label="Menge" placeholder="Menge" value={menge} onChange={(e) => setMenge(e.target.value)} /></div>
          <Knopf icon="Plus" onClick={() => aktion(() => api.post(`/api/v1/artikel/${a.id}/bestand`, { aenderung: Number(menge) }))}>Zubuchen</Knopf>
          <Knopf onClick={() => aktion(() => api.post(`/api/v1/artikel/${a.id}/bestand`, { aenderung: -Number(menge) }))}>Abbuchen</Knopf>
          <Knopf art="geist" onClick={() => aktion(() => api.post(`/api/v1/artikel/${a.id}/bestand`, { neu: Number(menge) }))}>Bestand setzen</Knopf>
        </div>}
      </Section>}
      {!a.verbrauch && !a.ist_leistung && <Section titel={`Geräte (${a.geraete.length})`} icon="Boxes"
        aktionen={darfG && <Knopf icon="Plus" onClick={() => aktion(() => api.post(`/api/v1/artikel/${a.id}/geraete`, { anzahl: 1 }))}>Gerät anlegen</Knopf>}>
        <Tabelle zeilen={a.geraete} leer="Noch keine Geräte." onZeile={(g) => navigiere(`/geraete/${g.id}`)} spalten={[
          { titel: "Code", feld: "code" }, { titel: "Status", wert: (g) => STATUS[g.status] }, { titel: "Prüfung", wert: (g) => PRUEF_TEXT[g.pruefstatus] },
        ]} />
      </Section>}
      <Reservierungen artikelId={a.id} />
      <AenderungsVerlauf tabelle="artikel" id={a.id} />
      {dialog}
    </Seite>
  );
}

/** FA-05: Reservierungen (vorgemerkt/fest) im Zeitraum. */
function Reservierungen({ artikelId }) {
  const { api } = useLager();
  const [zr, setZr] = useState({ von: "", bis: "" });
  const qs = new URLSearchParams(Object.entries(zr).filter(([, v]) => v)).toString();
  const r = useDaten(() => api.get(`/api/v1/artikel/${artikelId}/reservierungen${qs ? `?${qs}` : ""}`).catch((e) => (e.status === 404 ? null : Promise.reject(e))), [artikelId, qs]);
  useLive(["angebot", "projekt"], () => r.laden());
  return (
    <Section titel="Reservierungen" icon="CalendarDays">
      <div className="lp-raster">
        <Feld label="Von" hinweis="Leer = ab heute"><Eingabe type="date" value={zr.von} onChange={(e) => setZr({ ...zr, von: e.target.value })} /></Feld>
        <Feld label="Bis" hinweis="Leer = ohne Ende"><Eingabe type="date" value={zr.bis} onChange={(e) => setZr({ ...zr, bis: e.target.value })} /></Feld>
      </div>
      {r.fehler && <Meldung level="error" text={r.fehler} />}
      {!r.daten ? <p className="lp-hinweis">Reservierungen erscheinen, sobald Angebote dieses Material enthalten.</p> :
        <Tabelle zeilen={r.daten} leer="Keine Reservierungen." spalten={[
          { titel: "Projekt", wert: (x) => `${x.projekt_nummer} ${x.projekt_name}` }, { titel: "Zeitraum", wert: (x) => `${x.von_text} – ${x.bis_text}` },
          { titel: "Menge", feld: "menge", rechts: true }, { titel: "Art", wert: (x) => (x.fest ? "fest" : "vorgemerkt") },
        ]} />}
    </Section>
  );
}
