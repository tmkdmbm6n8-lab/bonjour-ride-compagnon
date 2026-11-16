// Pictogrammes des signalements : képi de police et cabine de radar fixe à la française.
// Les mêmes dessins servent aux boutons (React) et aux repères de la carte (chaînes SVG).

const KEPI_BODY =
  '<path d="M5.8 14L7 5.8Q12 4.6 17 5.8L18.2 14z" fill="currentColor" fill-opacity=".22"/>' +
  '<path d="M6.3 11h11.4l.5 3H5.8z" fill="currentColor" stroke="none"/>' +
  '<path d="M4.2 14h15.6Q19 18 12 18.2Q5 18 4.2 14z" fill="currentColor" fill-opacity=".55"/>' +
  '<path d="M12 6.4l.95 1.9 2.1.3-1.52 1.48.36 2.1L12 11.2l-1.89 1-.01-.02.37-2.08L8.95 8.6l2.1-.3z" fill="currentColor" stroke="none"/>';

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
