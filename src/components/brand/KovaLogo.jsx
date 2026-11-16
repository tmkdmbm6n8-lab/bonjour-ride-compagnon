/**
 * StrasDrive — brand mark: a centred S drawn as a road, with a gold
 * navigation arrow (Google Maps style) that has just set off from the
 * bottom end and follows the dashed centre line.
 * The S is two equal arcs, point-symmetric around the centre (24,24).
 * public/favicon.svg is a copy of this mark and must change with it.
 */

import { useId } from "react";

const ROAD = "M29.2 15A6 6 0 1 0 24 24A6 6 0 1 1 18.8 33";
// Centre line stops just ahead of the arrow: the stretch behind it is already driven.
const CENTRE_LINE = "M29.2 15A6 6 0 1 0 24 24A6 6 0 0 1 25.55 35.8";

export function KovaIcon({ size = 32, className = "" }) {
  const uid = useId().replace(/:/g, "");
  const tile = `sd-tile-${uid}`,
    road = `sd-road-${uid}`,
    arrow = `sd-arrow-${uid}`,
    glow = `sd-glow-${uid}`;
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
      <defs>
        {/* App palette: ink-800 → ink-950 tile, ink-50 road, gold-500 → gold-700 arrow */}
        <linearGradient id={tile} x1="8" y1="2" x2="40" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#292524" />
          <stop offset="1" stopColor="#0C0A09" />
        </linearGradient>
        <linearGradient id={road} x1="14" y1="8" x2="34" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FAFAF9" />
          <stop offset="1" stopColor="#E7E5E4" />
        </linearGradient>
        <linearGradient id={arrow} x1="0" y1="-3.5" x2="0" y2="3" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#EAB308" />
          <stop offset="1" stopColor="#A16207" />
        </linearGradient>
        <radialGradient
          id={glow}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(22.96 35.91) scale(6)"
        >
          <stop offset="0" stopColor="#EAB308" stopOpacity="0.35" />
          <stop offset="1" stopColor="#EAB308" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill={`url(#${tile})`} />
      <rect x="0.5" y="0.5" width="47" height="47" rx="13.5" stroke="#FAFAF9" strokeOpacity="0.08" />
      {/* The S is the road */}
      <path d={ROAD} stroke={`url(#${road})`} strokeWidth="8" strokeLinecap="round" />
      {/* Dashed centre line, stopping just ahead of the arrow */}
      <path d={CENTRE_LINE} stroke="#44403C" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="2.2 2.4" />
      {/* Soft gold halo, then the navigation arrow */}
      <circle cx="22.96" cy="35.91" r="6" fill={`url(#${glow})`} />
      <g transform="translate(22.96 35.91) rotate(100)">
        <path
          d="M0 -3.5L2.9 3L0 1.5L-2.9 3Z"
          fill={`url(#${arrow})`}
          stroke="#0C0A09"
          strokeWidth="0.7"
          strokeLinejoin="round"
        />
        <path d="M0 -2.3L1.2 0.6L0 0.1Z" fill="#FEF9C3" fillOpacity="0.55" />
      </g>
    </svg>
  );
}
export function KovaLogo({ size = 32, showText = true, className = "", light = false }) {
  return (
    <span
      className={`sd-brand-logo ${className}`}
      style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}
    >
      <KovaIcon size={size} />
      {showText && (
        <span
          className="sd-brand-text"
          style={{
            fontSize: size * 0.68,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: light ? "#FAFAF9" : "var(--text, #0C0A09)",
            lineHeight: 1,
          }}
        >
          StrasDrive
        </span>
      )}
    </span>
  );
}

export default KovaLogo;
