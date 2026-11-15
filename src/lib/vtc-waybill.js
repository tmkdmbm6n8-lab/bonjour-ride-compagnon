// Arrêté du 6 août 2025, art. 1 : justificatif papier ou électronique.
export function sanitizeOperator(value = {}) {
  const out = {};
  for (const [key, max] of [
    ["legalName", 180],
    ["address", 400],
    ["phone", 40],
  ]) {
    out[key] = typeof value?.[key] === "string" ? value[key].trim().slice(0, max) : "";
  }
  return out;
}

export function buildWaybill(ride, client, operator, documents = []) {
  const number = (type) => documents.find((d) => d.doc_type === type && d.status === "approved")?.document_number || "";
  const siret = String(number("company")).replace(/\s/g, "");
  const siren = /^\d{14}$/.test(siret) ? siret.slice(0, 9) : "";
  const document = {
    reference: ride.id,
    isTest: Boolean(ride.is_test),
    operator: { ...sanitizeOperator(operator), siren, revtc: number("vtc_register") },
    client: { name: client?.name || "", phone: client?.phone || "" },
    bookedAt: ride.created_at,
    // Booking currently supports immediate pickup only. Never substitute arrival or acceptance time.
    pickupAt: ride.created_at,
    pickupMode: "immediate",
    pickup: ride.pickup?.address || "",
    dropoff: ride.dropoff?.address || "",
  };
  const fields = [
    [document.operator.legalName, "Nom ou raison sociale de l’exploitant"],
    [document.operator.address, "Adresse de l’exploitant"],
    [document.operator.phone, "Téléphone de l’exploitant"],
    [document.operator.siren, "SIREN de l’exploitant (document entreprise approuvé)"],
    [document.operator.revtc, "Inscription REVTC (document registre VTC approuvé)"],
    [document.client.name, "Nom du client"],
    [document.client.phone, "Téléphone du client"],
    [document.bookedAt && Number.isFinite(Date.parse(document.bookedAt)), "Date et heure de réservation"],
    [document.pickup, "Lieu de prise en charge"],
  ];
  return { ...document, missing: fields.filter(([value]) => !value).map(([, label]) => label) };
}

export function waybillRows(doc) {
  const date = (value) =>
    value && Number.isFinite(Date.parse(value))
      ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "medium", timeZone: "Europe/Paris" }).format(
          new Date(value),
        )
      : "Non renseigné";
  return [
    ["Référence", doc.reference],
    ["Exploitant", doc.operator.legalName],
    ["Adresse de l’exploitant", doc.operator.address],
    ["Téléphone de l’exploitant", doc.operator.phone],
    ["SIREN", doc.operator.siren],
    ["REVTC", doc.operator.revtc],
    ["Client", doc.client.name],
    ["Téléphone du client", doc.client.phone],
    ["Réservation effectuée le", date(doc.bookedAt)],
    ["Prise en charge souhaitée le", date(doc.pickupAt)],
    ["Type de réservation", "Départ immédiat demandé à la réservation"],
    ["Lieu de prise en charge", doc.pickup],
    ["Destination", doc.dropoff],
  ];
}

export function waybillHtml(doc) {
  if (doc.missing.length || doc.isTest) throw new Error("Justificatif incomplet ou course de test");
  const escape = (value) =>
    String(value || "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Réservation préalable ${escape(doc.reference)}</title><style>body{font:16px system-ui;max-width:800px;margin:40px auto;padding:20px;color:#111}h1{font-size:26px}dl{display:grid;grid-template-columns:1fr 2fr;gap:14px}dt{font-weight:600}dd{margin:0;overflow-wrap:anywhere}@media(max-width:500px){dl{display:block}dd{margin:6px 0 20px}}</style><h1>Justificatif de réservation préalable</h1><p>StrasDrive · VTC · Horaires : Europe/Paris</p><dl>${waybillRows(
    doc,
  )
    .map(([label, value]) => `<dt>${escape(label)}</dt><dd>${escape(value || "Non renseigné")}</dd>`)
    .join(
      "",
    )}</dl><p>Arrêté du 6 août 2025 relatif au justificatif de la réservation préalable applicable aux VTC.</p></html>`;
}
