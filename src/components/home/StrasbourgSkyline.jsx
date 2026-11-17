import { useId } from 'react';

export default function StrasbourgSkyline() {
  const id = `strasbourg-${useId().replace(/:/g, '')}`;
  return <div className="strasbourg-skyline">
    <svg viewBox="0 0 1200 290" role="img" aria-labelledby={`${id}-title`} preserveAspectRatio="xMidYMax meet">
      <title id={`${id}-title`}>Strasbourg : la cathédrale, la Petite France et les Ponts Couverts, en noir et doré</title>
      <defs>
        <radialGradient id={`${id}-glow`} cx="62%" cy="60%" r="58%"><stop offset="0" stopColor="#d4af55" stopOpacity=".15"/><stop offset="1" stopColor="#d4af55" stopOpacity="0"/></radialGradient>
        <linearGradient id={`${id}-water`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#c8a458" stopOpacity=".23"/><stop offset="1" stopColor="#c8a458" stopOpacity="0"/></linearGradient>
      </defs>
      <rect width="1200" height="290" fill={`url(#${id}-glow)`}/>
      <g fill="#171c22" opacity=".7">
        <path d="M0 235v-37l28-21 28 21v37h9v-52l33-27 33 27v52h17v-67l30-25 29 25v67h18v-40l23-18 23 18v40h34v-61l27-19 29 19v61h27v-48l31-28 31 28v48h23v-64l31-26 31 26v64h26v-40l25-20 25 20v40h315v-58l30-28 30 28v58h26v-47l30-24 30 24v47h18v-62l32-27 32 27v62h20v-36l34-24 34 24v36h24v-51l27-24 27 24v51z"/>
      </g>
      <g fill="#10151b" stroke="#bc9a53" strokeOpacity=".55" strokeWidth="1.1" strokeLinejoin="round">
        {[130,245,360].map((x,i)=><g key={x}>
          <path d={`M${x-23} 226v-89h46v89zm-5-89 28-35 28 35z`}/>
          <path d={`M${x-14} 153h5v13h-5zm23 0h5v13h-5zm-23 34h5v13h-5zm23 0h5v13h-5z`} fill="#c5a45d" fillOpacity=".18" stroke="none"/>
          {i<2&&<path d={`M${x+23} 203h69v24h-11v-8a12 12 0 0 0-24 0v8h-13v-8a11 11 0 0 0-21 0z`}/>}
        </g>)}
        <path d="M75 228h360" fill="none"/>
      </g>
      <g stroke="#c5a45d" strokeOpacity=".45" strokeWidth="1.05" strokeLinejoin="round">
        {[{x:445,w:53,h:57},{x:500,w:47,h:75},{x:549,w:58,h:62},{x:609,w:47,h:81},{x:947,w:53,h:66},{x:1002,w:58,h:49},{x:1062,w:46,h:70}].map(({x,w,h})=><g key={x}>
          <path d={`M${x} 231v-${h}l${w/2}-${w*.7} ${w/2} ${w*.7}v${h}z`} fill="#131920"/>
          <path d={`M${x-3} ${231-h}l${w/2+3}-${w*.7+4} ${w/2+3} ${w*.7+4}`} fill="none"/>
          <path d={`M${x+w/2} ${231-h-w*.7}V231m-${w/2} -${h*.65}h${w}m-${w} ${h*.33}h${w}m-${w} -${h*.33} ${w/2} ${h*.33} ${w/2}-${h*.33}m-${w} ${h*.33} ${w/2} ${h*.32} ${w/2}-${h*.32}`} fill="none"/>
          <path d={`M${x+8} ${231-h+10}h7v10h-7zm${w-23} 0h7v10h-7z`} fill="#d4b56a" fillOpacity=".2" stroke="none"/>
        </g>)}
      </g>
      <g fill="#151a20" stroke="#d2b36d" strokeOpacity=".8" strokeWidth="1.15" strokeLinejoin="round">
        <path d="M690 232v-115h54v115zM744 232V105h75v127zM819 232V122h40v110z"/>
        <path d="M689 118V83h9V71h8V56h8V43h7v13h8v15h8v12h9v35z"/>
        <path d="m704 57 13-44 13 44m-13-44V5" fill="none" strokeWidth="1.5"/>
        <path d="m695 83 22-40 22 40m-40-12 18-15 18 15m-33 13v34m15-48v48m15-34v34m-40-17h53" fill="none" strokeOpacity=".55"/>
        <path d="M695 232V121m15 0v111m15-111v111m14-111v111m9-123h66m-66 10h66m-66 74h66m-66 9h66m4-83h45m-45 12h45m-45 68h45" fill="none" strokeOpacity=".4"/>
        <path d="m748 107 33-24 33 24m5 15 20-24 20 24M753 115v21m10-21v21m12-25v25m12-25v25m12-21v21m10-21v21" fill="none"/>
        <circle cx="781" cy="159" r="18" fill="#0d1118"/>
        <circle cx="781" cy="159" r="11" fill="none" strokeOpacity=".5"/>
        {Array.from({length:12},(_,i)=><path key={i} d="M781 141v36" transform={`rotate(${i*15} 781 159)`} fill="none" strokeOpacity=".38" strokeWidth=".8"/>)}
        <path d="M752 232v-19q10-26 20 0v19m-16 0v-17q6-17 12 0v17m4 0v-24q10-33 20 0v24m-15 0v-22q5-19 10 0v22m6 0v-19q10-26 20 0v19M697 135v21q6-14 12 0v-21m9 0v21q6-14 12 0v-21m98 12v26q6-17 12 0v-26" fill="#0c1117"/>
        <path d="M679 232v-34h11m168 34v-43h10v43m-39-84v-17m14 17v-17" fill="none"/>
      </g>
      <g fill="#10151b" stroke="#a98849" strokeOpacity=".35"><path d="M866 231v-65l29-35 30 35v65zm-4-65 33-41 34 41m-34-36v101m-26-44h52m-52 22h52m-52-22 26 22 26-22m-52 22 26 22 26-22"/></g>
      <path d="M20 233h1160" stroke="#c5a45d" strokeOpacity=".4" fill="none"/>
      <path d="m100 243 280-3 70 8 220-4 230 6 190-8M150 255l220-4 120 9 180-5 190 7 180-8m-780 15 220-2 170 6 190-3" stroke={`url(#${id}-water)`} strokeWidth="2" strokeLinecap="round" fill="none"/>
      <path d="m705 239 11 36 13-36m30 0 22 46 23-46" stroke={`url(#${id}-water)`} strokeWidth="6" fill="none"/>
    </svg>
  </div>;
}
