// Startseite (FA-35) des Materialplaners: Lager, Prüfungen, Packen und Rückgabe zuerst.
import React from "react";
import { Startseite as Uebersicht } from "@lager/ui/uebersicht.jsx";

const SCHNELL = [
  { titel: "Code scannen", icon: "ScanLine", pfad: "/scan" },
  { titel: "Geräte", icon: "Package", pfad: "/geraete" },
  { titel: "Material", icon: "Boxes", pfad: "/material" },
  { titel: "Ladezonen", icon: "LayoutGrid", pfad: "/zonen" },
  { titel: "Etiketten", icon: "Tag", pfad: "/etiketten" },
];

export function Startseite() {
  return <Uebersicht untertitel="Material und Lager" schnell={SCHNELL} />;
}
