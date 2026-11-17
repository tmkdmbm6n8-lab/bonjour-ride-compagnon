export const DRIVER_REPORT_REASONS = [
  ['dangerous_driving', 'Conduite dangereuse, vitesse ou téléphone au volant'],
  ['intoxication', 'Suspicion d’alcool ou de stupéfiants'],
  ['aggression', 'Agressivité, insultes, menaces ou violence'],
  ['harassment', 'Harcèlement, propos ou gestes sexuels inappropriés'],
  ['discrimination', 'Discrimination ou propos haineux'],
  ['unwanted_contact', 'Contact ou messages déplacés après la course'],
  ['wrong_driver', 'Chauffeur ou véhicule différent de celui annoncé'],
  ['unsafe_vehicle', 'Véhicule dangereux, sale ou équipement de sécurité défectueux'],
  ['route_issue', 'Détour injustifié ou refus de la destination'],
  ['payment_pressure', 'Demande d’argent supplémentaire ou paiement imposé'],
  ['refusal', 'Refus de prise en charge ou abandon du passager'],
  ['smoking', 'Tabac, vapotage ou comportement gênant dans le véhicule'],
  ['privacy', 'Atteinte à la vie privée, photo ou enregistrement non souhaité'],
  ['other', 'Autre'],
];

export function driverReportMessage(ride, uid, body) {
  if (ride.rider_id !== uid || !ride.driver_id) throw new Error('Signalement réservé au passager de cette course');
  const reason = DRIVER_REPORT_REASONS.find(([id]) => id === body.reason);
  if (!reason) throw new Error('Choisissez un motif de signalement');
  const details = typeof body.details === 'string' ? body.details.trim() : '';
  if (details.length > 2000) throw new Error('Le commentaire est limité à 2 000 caractères');
  if (body.reason === 'other' && details.length < 10) throw new Error('Précisez votre signalement en au moins 10 caractères');
  return `Signalement chauffeur — course ${ride.id}\nPassager : ${uid}\nChauffeur : ${ride.driver_id}\nMotif : ${reason[1]}\nDétails : ${details || 'Non précisés'}`;
}
