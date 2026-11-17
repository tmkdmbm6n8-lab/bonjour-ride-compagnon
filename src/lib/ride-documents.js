import { paymentMethodLabel } from "./vtc-pricing";

const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const euros = (value) =>
  value != null && Number.isFinite(Number(value))
    ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value))
    : "Non renseigné";
export function receiptHtml(ride) {
  if (ride.isTest || !(ride.status === "completed" || ride.fare?.cancellationFee > 0))
    throw new Error("Reçu indisponible pour cette course.");
  const date = new Date(ride.completedAt || ride.createdAt);
  const dateLabel = Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "Europe/Paris",
      }).format(date)
    : "Non renseignée";
  const rows = [
    ["Référence", ride.id],
    ["Date", dateLabel],
    ["Prise en charge", ride.pickup?.address],
    ["Destination", ride.dropoff?.address],
    ["Chauffeur", ride.driver?.name || "Non renseigné"],
    [
      "Véhicule",
      [ride.driver?.vehicle?.make, ride.driver?.vehicle?.model, ride.driver?.vehicle?.plate]
        .filter(Boolean)
        .join(" ") || "Non renseigné",
    ],
    ["Mode de paiement", paymentMethodLabel(ride.payment?.method)],
    ["Statut", ride.status === "completed" ? "Course terminée" : "Course annulée"],
    ["Montant", euros(ride.status === "completed" ? ride.fare?.total : ride.fare?.cancellationFee)],
  ];
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reçu StrasDrive</title><style>body{font:16px system-ui;color:#111;max-width:760px;margin:40px auto;padding:24px}h1{font-size:26px}dl{display:grid;grid-template-columns:1fr 2fr;gap:16px}dt{font-weight:600}dd{margin:0;overflow-wrap:anywhere}@media(max-width:500px){dl{display:block}dd{margin:6px 0 18px}}@media print{body{margin:0}}</style><h1>Reçu de course · StrasDrive</h1><dl>${rows.map(([label, value]) => `<dt>${escape(label)}</dt><dd>${escape(value)}</dd>`).join("")}</dl><p>Récapitulatif du montant enregistré pour la course. Ce document ne remplace pas une facture de l’exploitant et ne certifie pas l’encaissement d’un paiement en espèces.</p><p>Réclamations : utilisez la rubrique Contact du site en indiquant la référence de la course.</p></html>`;
}

/** A user-triggered text summary, never an unauthenticated live tracking link. */
export function shareRideText(ride) {
  return [
    "Mon trajet StrasDrive",
    `Référence : ${ride.id}`,
    `Départ : ${ride.pickup?.address || "Non renseigné"}`,
    `Destination : ${ride.dropoff?.address || "Non renseignée"}`,
    ride.driver?.name ? `Chauffeur : ${ride.driver.name}` : "",
    ride.driver?.vehicle?.plate ? `Immatriculation : ${ride.driver.vehicle.plate}` : "",
    "Résumé partagé à cet instant, sans suivi en direct.",
  ]
    .filter(Boolean)
    .join("\n");
}
