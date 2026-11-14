/**
 * StrasDrive — brand mark: a centred S drawn as a road, with a gold
 * navigation arrow (Google Maps style) that has just set off from the
 * bottom end and follows the dashed centre line.
 * The S is two equal arcs, point-symmetric around the centre (24,24).
 * public/favicon.svg is a copy of this mark and must change with it.
 */

const ROAD = 'M29.2 15A6 6 0 1 0 24 24A6 6 0 1 1 18.8 33';
// Centre line stops just ahead of the arrow: the stretch behind it is already driven.
const CENTRE_LINE = 'M29.2 15A6 6 0 1 0 24 24A6 6 0 0 1 25.55 35.8';

export function KovaIcon({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      shapeRendering="geometricPrecision"
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="14" fill="#0C0A09" />
      {/* The S is the road */}
      <path d={ROAD} stroke="#FAFAF9" strokeWidth="8" strokeLinecap="round" />
      {/* Dashed centre line */}
      <path d={CENTRE_LINE} stroke="#0C0A09" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="2.2 2.4" />
      {/* Navigation arrow, a little way along the road from the bottom end */}
      <path
        d="M0 -3.5L2.9 3L0 1.5L-2.9 3Z"
        transform="translate(22.96 35.91) rotate(100)"
        fill="#CA8A04"
        stroke="#0C0A09"
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KovaLogo({ size = 32, showText = true, className = '', light = false }) {
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}
    >
      <KovaIcon size={size} />
      {showText && (
        <span
          style={{
            fontSize: size * 0.68,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: light ? '#FAFAF9' : '#0C0A09',
            lineHeight: 1,
          }}
        > StrasDrive </span>
      )}
    </span>
  );
}

export default KovaLogo;
