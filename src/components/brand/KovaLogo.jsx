/**
 * StrasDrive — brand mark (SD monogram with gold route dot)
 */

export function KovaIcon({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="14" fill="#0C0A09" />
      {/* S + D — same rounded ink strokes, with the gold route dot */}
      <path
        d="M20.5 17.2C19.4 15.7 17.7 15 15.6 15C12.6 15 10.6 16.7 10.6 19.3C10.6 21.9 12.8 23 15.6 23.9C18.6 24.9 21 26.1 21 29C21 31.8 18.8 33.6 15.6 33.6C13.2 33.6 11.2 32.7 10 31"
        stroke="#FAFAF9"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M26 15V33.6H29.2C33.9 33.6 37 29.9 37 24.3C37 18.7 33.9 15 29.2 15H26Z"
        stroke="#FAFAF9"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="38.5" cy="11.5" r="4" fill="#CA8A04" />
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
