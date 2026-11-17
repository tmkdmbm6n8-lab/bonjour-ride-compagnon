let pending;
/** Only the browser-restricted connector key may be sent to Maps JavaScript API. */
export function loadGoogleMaps() {
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (pending) return pending;
  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  if (!key) return Promise.reject(new Error('La configuration de Google Maps est indisponible.'));
  pending = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const callback = '__strasdriveGoogleMapsReady';
    let timeout;
    const failed = () => { clearTimeout(timeout); delete window[callback]; script.remove(); pending = undefined; reject(new Error('Google Maps n’a pas pu être chargé. Réessayez.')); };
    window[callback] = () => { clearTimeout(timeout); delete window[callback]; if (window.google?.maps?.Map) resolve(window.google.maps); else failed(); };
    const params = new URLSearchParams({ key, v: 'weekly', language: 'fr', region: 'FR', loading: 'async', callback });
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true; script.onerror = failed;
    timeout = setTimeout(failed, 20000);
    document.head.appendChild(script);
  });
  return pending;
}
