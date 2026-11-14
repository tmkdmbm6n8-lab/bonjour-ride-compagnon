// Documents obligatoires pour exercer comme chauffeur VTC en France (Code des transports,
// Code des assurances, Code du travail). Module pur : partagé par l'interface et le serveur.

export const DOCUMENTS_BUCKET = 'driver-documents';
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
export const EXPIRING_SOON_DAYS = 30;

// dateKind : 'expiry' = date de fin de validité saisie ; 'issued' = date de délivrance, valable maxAgeDays.
export const DRIVER_DOCUMENTS = [
  { type: 'identity', label: 'Pièce d’identité', required: true, dateKind: 'expiry',
    hint: 'Carte nationale d’identité ou passeport en cours de validité, recto et verso. Hors Union européenne : titre de séjour autorisant à travailler.' },
  { type: 'driving_license', label: 'Permis de conduire B', required: true, dateKind: 'expiry',
    hint: 'Recto et verso. Permis B obtenu depuis plus de 3 ans (2 ans après une conduite accompagnée), hors période probatoire.' },
  { type: 'vtc_card', label: 'Carte professionnelle VTC', required: true, dateKind: 'expiry', numberLabel: 'Numéro de carte',
    hint: 'Délivrée par la préfecture après réussite à l’examen VTC, valable 5 ans.' },
  { type: 'company', label: 'Immatriculation de l’entreprise', required: true, dateKind: 'issued', maxAgeDays: 90, numberLabel: 'Numéro SIRET',
    hint: 'Extrait Kbis, extrait du Registre national des entreprises (RNE) ou avis de situation SIRENE de moins de 3 mois.' },
  { type: 'vtc_register', label: 'Inscription au registre VTC', required: true, dateKind: 'expiry', numberLabel: 'Numéro d’inscription (EVTC…)',
    hint: 'Attestation d’inscription de l’exploitant au registre des VTC (ministère des Transports), valable 5 ans.' },
  { type: 'vehicle_registration', label: 'Carte grise du véhicule', required: true, dateKind: null,
    hint: 'Certificat d’immatriculation du véhicule utilisé pour les courses.' },
  { type: 'vehicle_insurance', label: 'Assurance transport de personnes', required: true, dateKind: 'expiry',
    hint: 'Attestation d’assurance du véhicule couvrant le transport de personnes à titre onéreux (VTC). Une assurance auto classique ne suffit pas.' },
  { type: 'rc_pro', label: 'Responsabilité civile professionnelle', required: true, dateKind: 'expiry',
    hint: 'Attestation d’assurance responsabilité civile professionnelle de l’exploitant VTC.' },
  { type: 'vtc_sticker', label: 'Signalétique VTC (macaron)', required: true, dateKind: null,
    hint: 'Photo de la vignette VTC apposée à l’avant et à l’arrière du véhicule.' },
  { type: 'urssaf', label: 'Attestation de vigilance URSSAF', required: true, dateKind: 'issued', maxAgeDays: 182,
    hint: 'De moins de 6 mois, à renouveler tous les 6 mois (obligation de vigilance, article L8222-1 du Code du travail).' },
  { type: 'technical_inspection', label: 'Contrôle technique', required: false, dateKind: 'expiry',
    hint: 'Procès-verbal en cours de validité, si votre véhicule y est soumis.' },
];

export const REQUIRED_DOCUMENTS = DRIVER_DOCUMENTS.filter((d) => d.required);

export function documentSpec(type) {
  return DRIVER_DOCUMENTS.find((d) => d.type === type) || null;
}

const DAY = 86400000;
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const parseDay = (s) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.parse(`${s}T00:00:00Z`) : NaN);

export function todayIso(now = Date.now()) {
  return isoDay(now);
}

export function dateLabel(spec) {
  if (spec?.dateKind === 'expiry') return 'Date de fin de validité';
  if (spec?.dateKind === 'issued') return 'Date de délivrance';
  return null;
}

// Vérifie la saisie d'un document et renvoie les champs à enregistrer.
export function validateDocumentInput(type, { date, number } = {}, today = todayIso()) {
  const spec = documentSpec(type);
  if (!spec) throw new Error('Type de document inconnu');
  const t = parseDay(today);
  const out = { reference_date: null, valid_until: null, document_number: '' };
  if (spec.numberLabel) {
    const n = String(number || '').trim().replace(/\s+/g, ' ');
    if (n.length < 3 || n.length > 40) throw new Error(`${spec.numberLabel} requis`);
    if (spec.type === 'company' && !/^\d{14}$/.test(n.replace(/\s/g, ''))) throw new Error('Le numéro SIRET doit comporter 14 chiffres');
    out.document_number = spec.type === 'company' ? n.replace(/\s/g, '') : n.toUpperCase();
  }
  if (spec.dateKind) {
    const d = parseDay(date);
    if (!Number.isFinite(d)) throw new Error(`${dateLabel(spec)} requise`);
    out.reference_date = isoDay(d);
    if (spec.dateKind === 'expiry') {
      if (d < t) throw new Error(`${spec.label} : ce document est expiré`);
      out.valid_until = isoDay(d);
    } else {
      if (d > t) throw new Error('La date de délivrance ne peut pas être dans le futur');
      const until = d + spec.maxAgeDays * DAY;
      if (until < t) throw new Error(`${spec.label} : document trop ancien (${spec.maxAgeDays === 90 ? 'moins de 3 mois' : 'moins de 6 mois'} exigé)`);
      out.valid_until = isoDay(until);
    }
  }
  return out;
}

// missing | pending | approved | expiring | rejected | expired
export function documentState(doc, today = todayIso()) {
  if (!doc) return 'missing';
  const expired = doc.valid_until && doc.valid_until < today;
  if (expired) return 'expired';
  if (doc.status === 'rejected') return 'rejected';
  if (doc.status === 'pending') return 'pending';
  const soon = doc.valid_until && parseDay(doc.valid_until) - parseDay(today) <= EXPIRING_SOON_DAYS * DAY;
  return soon ? 'expiring' : 'approved';
}

export function driverCompliance(docs = [], today = todayIso()) {
  const byType = Object.fromEntries(docs.map((d) => [d.doc_type, d]));
  const res = { required: REQUIRED_DOCUMENTS.length, approved: 0, missing: [], pending: [], rejected: [], expired: [], expiring: [] };
  for (const spec of DRIVER_DOCUMENTS) {
    const doc = byType[spec.type];
    const state = documentState(doc, today);
    if (state === 'expiring') res.expiring.push(spec.type);
    if (state === 'expired' && doc) res.expired.push(spec.type);
    if (!spec.required) continue;
    if (state === 'approved' || state === 'expiring') res.approved += 1;
    else res[state === 'missing' ? 'missing' : state].push(spec.type);
  }
  const requiredExpired = res.expired.filter((t) => documentSpec(t).required);
  // Validation initiale : tous les documents obligatoires vérifiés et en cours de validité.
  res.canBeApproved = res.approved === res.required;
  // Passage en ligne : un document renouvelé peut être en cours de vérification, mais aucun ne doit manquer, être refusé ou expiré.
  res.canDrive = res.missing.length === 0 && res.rejected.length === 0 && requiredExpired.length === 0;
  return res;
}

const labels = (types) => types.map((t) => documentSpec(t).label).join(', ');

export function complianceProblem(c) {
  const expired = c.expired.filter((t) => documentSpec(t).required);
  if (expired.length) return `Document expiré : ${labels(expired)}`;
  if (c.rejected.length) return `Document refusé, à renvoyer : ${labels(c.rejected)}`;
  if (c.missing.length) return `Documents manquants : ${labels(c.missing)}`;
  if (c.pending.length) return `Documents en cours de vérification : ${labels(c.pending)}`;
  return null;
}
