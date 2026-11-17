/** Security checks independent from pricing, dispatch and fare calculations. */
export function assertRideActionMethod(action, method) {
  const readOnly = ["route", "radars"];
  const mutations = [
    "accept",
    "decline",
    "arrive",
    "start",
    "complete",
    "cancel",
    "rate",
    "invoice",
    "report",
  ];
  if (
    (readOnly.includes(action) && method !== "GET") ||
    (mutations.includes(action) && method !== "POST") ||
    (action === "messages" && !["GET", "POST"].includes(method)) ||
    (!action && method !== "GET")
  )
    throw new Error("Méthode non autorisée");
}

export function requireParticipant(ride, userId) {
  if (ride?.rider_id !== userId && ride?.driver_id !== userId)
    throw new Error("Course inaccessible");
}

export function privateDocumentPath(path, userId) {
  if (typeof path !== "string" || !path.startsWith(`${userId}/`) || path.length > 200) return false;
  // Only the uploader's flat namespace. Do not let URL/path normalization change ownership.
  const file = path.slice(userId.length + 1);
  return (
    /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(pdf|jpg|jpeg|png|webp)$/i.test(file) && !file.includes("..")
  );
}

export function validLocation(point) {
  return (
    Number.isFinite(point?.lat) &&
    Number.isFinite(point?.lng) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180
  );
}

export function invoiceRequestMessage(ride, userId, role) {
  requireParticipant(ride, userId);
  if (ride.is_test || !(ride.status === "completed" || ride.fare?.cancellationFee > 0)) {
    throw new Error(
      "La demande de facture est disponible pour les courses terminées ou les annulations facturées.",
    );
  }
  return `Demande de facture — course ${ride.id}. Demandeur authentifié : ${userId} (${role}). Vérifier l’émetteur et les informations fiscales avant émission. Ne pas confondre cette demande avec une facture émise.`;
}
