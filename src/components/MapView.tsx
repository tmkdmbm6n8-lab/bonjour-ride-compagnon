import { useEffect, useRef } from "react";
import L from "leaflet";

// Centre de Strasbourg
const STRASBOURG: [number, number] = [48.5734, 7.7521];

// Quelques chauffeurs fictifs autour du centre, pour le rendu carte
const CHAUFFEURS: Array<[number, number]> = [
  [48.5795, 7.7415],
  [48.5688, 7.7601],
  [48.5762, 7.7689],
  [48.5651, 7.7442],
  [48.5821, 7.7558],
];

const iconePosition = L.divIcon({
  className: "",
  html: `<div style="width:18px;height:18px;border-radius:9999px;background:#000;border:4px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.4)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const iconeChauffeur = L.divIcon({
  className: "",
  html: `<div style="width:30px;height:30px;border-radius:9999px;background:#000;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 6px rgba(0,0,0,.4)">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
  </div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

export default function MapView() {
  const conteneur = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conteneur.current) return;

    const carte = L.map(conteneur.current, {
      center: STRASBOURG,
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(carte);

    L.marker(STRASBOURG, { icon: iconePosition }).addTo(carte);
    for (const position of CHAUFFEURS) {
      L.marker(position, { icon: iconeChauffeur }).addTo(carte);
    }

    return () => {
      carte.remove();
    };
  }, []);

  return <div ref={conteneur} className="absolute inset-0 z-0" />;
}
