// Some iOS WebViews never invoke the GPS timeout callback while permission is pending.
export function withDeadline(operation, milliseconds, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), milliseconds);
    Promise.resolve(operation).then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}

export function getDriverLocation() {
  if (!window.isSecureContext) return Promise.reject(new Error('Ouvrez l’application via HTTPS pour utiliser la localisation.'));
  if (!navigator.geolocation) return Promise.reject(new Error('Géolocalisation non prise en charge.'));
  const request = highAccuracy => new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({lat: pos.coords.latitude, lng: pos.coords.longitude}),
      reject,
      {enableHighAccuracy: highAccuracy, timeout: 7000, maximumAge: 30000},
    );
  });
  const operation = request(true).catch(error => {
    if (error.code === 1) throw new Error('Localisation refusée : dans les Réglages de l’iPhone, autorisez StrasDrive à utiliser votre position pendant l’utilisation.');
    return request(false);
  });
  return withDeadline(operation, 16000, 'La localisation ne répond pas. Vérifiez l’autorisation de localisation de StrasDrive dans les Réglages de l’iPhone, puis réessayez.').catch(error => {
    if (error instanceof Error) throw error;
    throw new Error(error.code === 1 ? 'Localisation refusée : autorisez StrasDrive dans les Réglages de l’iPhone.' : 'Position GPS indisponible. Vérifiez la localisation et réessayez.');
  });
}
