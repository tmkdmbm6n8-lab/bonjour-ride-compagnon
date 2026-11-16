// Pictogrammes des signalements : képi de police et cabine de radar fixe à la française.
// Les mêmes dessins servent aux boutons (React) et aux repères de la carte (chaînes SVG).

const KEPI_BODY =
  '<path d="M6.8 15L7.9 5.6Q12 4.3 16.1 5.6L17.2 15Q12 16.4 6.8 15z" fill="currentColor" fill-opacity=".25"/>' +
  '<ellipse cx="12" cy="5.6" rx="4.1" ry="1.15"/>' +
  '<path d="M7.2 11.7Q12 12.9 16.8 11.7"/>' +
  '<path d="M6.8 15Q12 16.4 17.2 15Q16.7 19 12 19.5Q7.3 19 6.8 15z" fill="currentColor" fill-opacity=".7"/>' +
  '<path d="M12 6.9l.85 1.7 1.9.27-1.38 1.33.33 1.9-1.7-.9-1.7.9.33-1.9-1.38-1.33 1.9-.27z" fill="currentColor" stroke="none"/>';

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
