import { useEffect, useState } from 'react';

/** Visible area above the on-screen keyboard: {top, height}, or null before hydration. */
export default function useVisualViewport(enabled = true) {
  const [vv, setVv] = useState(null);
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') { setVv(null); return undefined; }
    const v = window.visualViewport;
    const update = () => setVv(v ? { top: v.offsetTop, height: v.height } : { top: 0, height: window.innerHeight });
    update();
    v?.addEventListener('resize', update);
    v?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      v?.removeEventListener('resize', update);
      v?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [enabled]);
  return vv;
}
