// Pictogrammes des signalements : képi de police et cabine de radar fixe à la française.
// Les mêmes dessins servent aux boutons (React) et aux repères de la carte (chaînes SVG).

const KEPI_BODY =
  '<path d="M7.6 6.6L18.2 3.8L17.6 15.2H8z" fill="currentColor" fill-opacity=".25"/>' +
  '<path d="M7.8 11.9h9.95"/>' +
  '<path d="M8 15.2h9.6" stroke-width="2.2"/>' +
  '<path d="M8.2 15.3C6.2 15.4 3.9 16.3 2.8 18c2.6.1 5.3-.5 7.6-1.4z" fill="currentColor" fill-opacity=".6"/>' +
  '<path d="M11.4 6.9l.8 1.6 1.8.25-1.3 1.25.3 1.8-1.6-.85-1.6.85.3-1.8-1.3-1.25 1.8-.25z" fill="currentColor" stroke="none"/>';

const RADAR_BODY =
  '<path d="M16 3.2l3 1.7v9.6L16 15.6z" fill="currentColor" fill-opacity=".45"/>' +
  '<rect x="4.6" y="3.2" width="11.4" height="12.4" rx="1.6" fill="currentColor" fill-opacity=".2"/>' +
  '<circle cx="10.3" cy="7.9" r="2.6"/>' +
  '<circle cx="10.3" cy="7.9" r=".9" fill="currentColor" stroke="none"/>' +
  '<rect x="7.2" y="11.9" width="6.2" height="1.7" rx=".5" fill="currentColor" stroke="none"/>' +
  '<path d="M11.2 15.6V21M8 21h7"/>';

const wrap = (body, size) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const policeCapSvg = (size = 18) => wrap(KEPI_BODY, size);
export const frenchRadarSvg = (size = 18) => wrap(RADAR_BODY, size);

export function PoliceCapIcon({ size = 18 }) {
  return <span style={{ display: "inline-flex", lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: policeCapSvg(size) }} />;
}

export function FrenchRadarIcon({ size = 18 }) {
  return <span style={{ display: "inline-flex", lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: frenchRadarSvg(size) }} />;
}
