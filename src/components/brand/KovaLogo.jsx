/**
 * StrasDrive — brand mark (S as a road with a small gold car driving on it)
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
      {/* The S is the road: a wide rounded stroke with a dashed center line */}
      <path
        d="M16 37C27 37 36 32 34.5 25.5C33 19 15 20 13.5 13.5C12 7 21 5.5 32 6.5"
        stroke="#FAFAF9"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 37C27 37 36 32 34.5 25.5C33 19 15 20 13.5 13.5C12 7 21 5.5 32 6.5"
        stroke="#0C0A09"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray="3.2 3.2"
      />
      {/* Small gold car driving on the road, at the middle straight */}
      <g>
        <path
          d="M18.5 24.2C18.5 23.3 19.2 22.7 20.1 22.6L21.6 20.9C21.9 20.5 22.4 20.3 22.9 20.3H26.1C26.6 20.3 27.1 20.5 27.4 20.9L28.9 22.6C29.8 22.7 30.5 23.3 30.5 24.2V26H18.5V24.2Z"
          fill="#CA8A04"
        />
        <circle cx="21.4" cy="26.4" r="1.5" fill="#0C0A09" />
        <circle cx="27.6" cy="26.4" r="1.5" fill="#0C0A09" />
      </g>
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
