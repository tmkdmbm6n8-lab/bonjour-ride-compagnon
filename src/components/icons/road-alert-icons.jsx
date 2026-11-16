// Pictogrammes des signalements : képi de police et cabine de radar fixe à la française.
// Les mêmes dessins servent aux boutons (React) et aux repères de la carte (chaînes SVG).

const KEPI_BODY =
  '<path d="M5.6 4.6h12.8l-1.4 10.3H7z" fill="currentColor" fill-opacity=".22"/>' +
  '<ellipse cx="12" cy="4.6" rx="6.4" ry="1.5"/>' +
  '<path d="M6.7 12.4h10.6"/>' +
  '<path d="M7 14.9c-1.7.4-3.1 1.3-3.4 2.6 2.5 1.4 6 1.9 8.4 1.9s5.9-.5 8.4-1.9c-.3-1.3-1.7-2.2-3.4-2.6z" fill="currentColor" fill-opacity=".5"/>' +
  '<path d="M12 6.9l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 9l2-.3z" fill="currentColor" stroke="none"/>';

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
