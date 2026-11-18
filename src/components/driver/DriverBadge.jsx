import { useId } from 'react';
const STAR='0,-12 3.5,-4.3 12,-3.5 5.3,2.2 7.5,10.5 0,6.2 -7.5,10.5 -5.3,2.2 -12,-3.5 -3.5,-4.3';
export default function DriverBadge({ badge }) {
  const uid=useId().replace(/:/g,''); const metal=`metal-${uid}`, glow=`glow-${uid}`;
  const outline = badge.shape==='shield' ? 'M60 7 104 25 101 67Q93 100 60 114 27 100 19 67L16 25Z' : badge.shape==='hexagon' ? 'M60 5 106 31 106 86 60 114 14 86 14 31Z' : badge.shape==='royal' ? 'M60 3 75 14 94 12 100 31 115 43 108 63 110 84 90 94 78 111 60 106 42 111 30 94 10 84 12 63 5 43 20 31 26 12 45 14Z' : 'M60 6a54 54 0 1 0 0 108a54 54 0 1 0 0-108';
  return <svg viewBox="0 0 120 120" className={`driver-badge-art ${badge.earned?'earned':'locked'}`} role="img" aria-label={`${badge.name}, ${badge.threshold.toLocaleString('fr-FR')} notes cinq étoiles${badge.earned?', obtenu':', à obtenir'}`}>
    <defs><linearGradient id={metal} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff3cf"/><stop offset=".22" stopColor={badge.accent}/><stop offset=".53" stopColor="#846033"/><stop offset=".76" stopColor={badge.accent}/><stop offset="1" stopColor="#fff1c6"/></linearGradient><radialGradient id={glow}><stop stopColor={badge.accent} stopOpacity=".23"/><stop offset="1" stopColor="#10131b"/></radialGradient></defs>
    <path d={outline} fill="#12151e" stroke={`url(#${metal})`} strokeWidth="3"/>
    <circle cx="60" cy="59" r="42" fill={`url(#${glow})`} stroke={badge.accent} strokeOpacity=".4"/>
    <circle cx="60" cy="59" r="36" fill="none" stroke={badge.accent} strokeOpacity=".3" strokeDasharray="1 5"/>
    {['laurel','legend'].includes(badge.motif) && <g stroke={`url(#${metal})`} strokeWidth="2" fill="none"><path d="M42 87Q15 61 37 35M78 87Q105 61 83 35"/>{[0,1,2,3,4].map(i=><g key={i} transform={`translate(0 ${i*9})`}><path d="m31 39-8-3 4 9 8 2M89 39l8-3-4 9-8 2"/></g>)}</g>}
    {badge.motif==='wings' && <g fill={`url(#${metal})`}><path d="m48 54-30-8 7 12 20 5-17-1 8 9 13-1M72 54l30-8-7 12-20 5 17-1-8 9-13-1"/></g>}
    {badge.motif==='diamond' ? <path d="m60 31 22 20-22 30-22-30Z M38 51h44M50 41l10 40 10-40" fill="none" stroke={`url(#${metal})`} strokeWidth="3"/> : ['crown','legend'].includes(badge.motif) ? <g fill={`url(#${metal})`}><path d="m37 46 11 10 12-22 12 22 11-10-5 27H42Z"/><rect x="42" y="77" width="36" height="4" rx="2"/>{badge.motif==='legend'&&<polygon points={STAR} transform="translate(60 27) scale(.5)"/>}</g> : <g fill={`url(#${metal})`}><polygon points={STAR} transform="translate(60 57) scale(1.55)"/>{badge.motif==='double'&&<><polygon points={STAR} transform="translate(38 78) scale(.5)"/><polygon points={STAR} transform="translate(82 78) scale(.5)"/></>}</g>}
    <path d="M46 97h28" stroke={badge.accent} strokeWidth="2" strokeLinecap="round"/>
  </svg>;
}
