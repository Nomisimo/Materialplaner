// R-73 Kabel-Assistent: Kabelart + Kategorie + Längen mit Preis und Stückzahl, danach Kennzeichnung wie R-72.
import React, { useState } from "react";
import { Seite, Section, Knopf, Eingabe, Auswahl, Feld, Meldung, GeldEingabe, useDaten } from "@lager/ui/bausteine.jsx";
import { useLager } from "@lager/ui/huelle.jsx";
import { fehlerText } from "@lager/ui/texte.js";
import { STANDARD_LAENGEN, laengeText, kabelName, zeilenpreis } from "@lager/domain/kabel.js";

export function KabelAssistent() {
  const { api, navigiere } = useLager();
  const kats = useDaten(() => api.get("/api/v1/kategorien"), []);
  const [art, setArt] = useState("");
  const [kat, setKat] = useState("");
  const [meterpreis, setMeterpreis] = useState(null);
  const [zeilen, setZeilen] = useState(STANDARD_LAENGEN.map((l) => ({ laenge_m: l, an: false, preis_tag: null, anzahl: 0 })));
  const [eigene, setEigene] = useState("");
  const [kennzeichnung, setKennzeichnung] = useState("qr");
  const [meldung, setMeldung] = useState(null);
  const [felder, setFelder] = useState({});
  const [laeuft, setLaeuft] = useState(false);
  const setze = (i, w) => setZeilen(zeilen.map((z, j) => (j === i ? { ...z, ...w } : z)));
  const meterpreisSetzen = (c) => {
    setMeterpreis(c);
    if (Number.isInteger(c)) setZeilen(zeilen.map((z) => ({ ...z, preis_tag: zeilenpreis(z.laenge_m, c) })));
  };
  const eigeneDazu = () => {
    const l = Number(String(eigene).replace(",", "."));
    if (!(l > 0)) { setFelder({ eigene: "Gib eine Länge größer als 0 ein, z. B. 12,5." }); return; }
    if (!zeilen.some((z) => z.laenge_m === l)) setZeilen([...zeilen, { laenge_m: l, an: true, preis_tag: Number.isInteger(meterpreis) ? zeilenpreis(l, meterpreis) : null, anzahl: 0 }].sort((a, b) => a.laenge_m - b.laenge_m));
    setEigene(""); setFelder({});
  };
  const anlegen = async () => {
    setLaeuft(true); setMeldung(null); setFelder({});
    try {
      const r = await api.post("/api/v1/kabel/assistent", { art, kategorie_id: kat ? Number(kat) : null, kennzeichnung,
        zeilen: zeilen.filter((z) => z.an).map((z) => ({ laenge_m: z.laenge_m, preis_tag: z.preis_tag, anzahl: Number(z.anzahl) || 0 })) });
      if (r.geraete?.codes?.length) navigiere(`/etiketten/druck?codes=${r.geraete.codes.join(",")}`); // R-73 → Barcode-Druck
      else if (r.bestellung) navigiere(`/etiketten/bestellungen/${r.bestellung.id}`);
      else setMeldung({ level: "success", text: r.text });
    } catch (e) { setFelder(e.felder || {}); setMeldung({ level: "error", text: fehlerText(e) }); } finally { setLaeuft(false); }
  };
  const gewaehlt = zeilen.filter((z) => z.an);
  return (
    <Seite titel="Kabel-Assistent" untertitel="Je angekreuzter Länge entsteht ein Artikel „<Art> <Länge> m“. Vorhandene Namen werden nicht doppelt angelegt.">
      {meldung && <Meldung {...meldung} onSchliessen={() => setMeldung(null)} />}
      <Section titel="Kabelart">
        <div className="lp-raster">
          <Feld label="Kabelart" pflicht fehler={felder.art} hinweis="z. B. Schuko-Kabel, DMX 3-pol"><Eingabe value={art} onChange={(e) => setArt(e.target.value)} /></Feld>
          <Feld label="Kategorie" pflicht fehler={felder.kategorie_id}><Auswahl leer="– wählen –" value={kat} onChange={(e) => setKat(e.target.value)}
            optionen={(kats.daten || []).map((k) => ({ wert: String(k.id), titel: `${k.name} (${k.praefix})` }))} /></Feld>
          <Feld label="Meterpreis pro Tag (€)" hinweis="Füllt die Zeilenpreise vor (Länge × Meterpreis). Jede Zeile bleibt änderbar."><GeldEingabe cent={meterpreis} onCent={meterpreisSetzen} /></Feld>
        </div>
      </Section>
      <Section titel="Längen">
        {felder.zeilen && <div style={{ marginBottom: 10 }}><Meldung level="error" text={felder.zeilen} /></div>}
        <table className="lp-tabelle">
          <thead><tr><th style={{ width: 40 }} /><th>Länge</th><th>Artikelname</th><th style={{ width: 160 }}>Preis/Tag (€)</th><th style={{ width: 120 }}>Stückzahl</th></tr></thead>
          <tbody>{zeilen.map((z, i) => (
            <tr key={z.laenge_m}>
              <td><input type="checkbox" aria-label={`${laengeText(z.laenge_m)} ankreuzen`} checked={z.an} onChange={(e) => setze(i, { an: e.target.checked })} /></td>
              <td>{laengeText(z.laenge_m)}</td>
              <td className="lp-meta">{art ? kabelName(art, z.laenge_m) : "–"}</td>
              <td><GeldEingabe aria-label={`Preis ${laengeText(z.laenge_m)}`} cent={z.preis_tag} onCent={(c) => setze(i, { preis_tag: c })} disabled={!z.an} /></td>
              <td><Eingabe type="number" min="0" max="500" aria-label={`Stückzahl ${laengeText(z.laenge_m)}`} value={z.anzahl} disabled={!z.an} onChange={(e) => setze(i, { anzahl: e.target.value })} /></td>
            </tr>
          ))}</tbody>
        </table>
        <form className="lp-zeile" style={{ marginTop: 12, alignItems: "flex-end" }} onSubmit={(e) => { e.preventDefault(); eigeneDazu(); }}>
          <div style={{ width: 200 }}><Feld label="Eigene Länge (m)" fehler={felder.eigene}><Eingabe inputMode="decimal" value={eigene} onChange={(e) => setEigene(e.target.value)} /></Feld></div>
          <Knopf type="submit" icon="Plus">Länge hinzufügen</Knopf>
        </form>
      </Section>
      <Section titel="Kennzeichnung">
        <div className="lp-raster">
          <Feld label="Kennzeichnung" hinweis="QR: Geräte sofort anlegen und Etiketten drucken. Bestellen: Etiketten beim Lieferanten bestellen, Geräte entstehen bei Lieferung.">
            <Auswahl value={kennzeichnung} onChange={(e) => setKennzeichnung(e.target.value)} optionen={[{ wert: "qr", titel: "Selbst – Geräte anlegen und drucken" }, { wert: "bestellen", titel: "Etiketten bestellen" }, { wert: "keine", titel: "Keine" }]} />
          </Feld>
        </div>
        <div className="lp-zeile" style={{ marginTop: 12 }}>
          <Knopf art="primaer" icon="Cable" disabled={laeuft || !gewaehlt.length} onClick={anlegen}>{gewaehlt.length} Kabel-Artikel anlegen</Knopf>
          <Knopf art="geist" onClick={() => navigiere("/material")}>Abbrechen</Knopf>
        </div>
      </Section>
    </Seite>
  );
}
