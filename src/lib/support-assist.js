// Aide IA pour l'assistance admin : règles pures (testées). L'IA propose, l'admin décide et envoie lui-même.
export const ASSIST_CATEGORIES = ['general','ride_issue','driver_support','payments','safety','data_request'];
export const ASSIST_URGENCIES = ['basse','normale','haute','critique'];
export const ASSIST_MODEL = 'openai/gpt-6-astra';
const MAX_MESSAGES = 12, MAX_MESSAGE_CHARS = 1500, MAX_TOTAL_CHARS = 8000;

// Minimisation : e-mails, téléphones et IBAN ne partent jamais vers le modèle.
export function redactPersonal(text) {
  return String(text || '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[e-mail masqué]')
    .replace(/\bFR\d{2}(?:\s?[0-9A-Z]{4}){5}\s?[0-9A-Z]{3}\b/gi, '[IBAN masqué]')
    .replace(/(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}/g, '[téléphone masqué]');
}

export function buildAssistInput(row, thread) {
  const messages = (thread?.messages || []).slice(-MAX_MESSAGES);
  const lines = messages.map((m) => `${m.from === 'admin' ? 'Administration' : m.from === 'rider' ? 'Passager' : row?.topic === 'driver_conversation' ? 'Chauffeur' : 'Utilisateur'} : ${redactPersonal(m.text).slice(0, MAX_MESSAGE_CHARS)}`);
  let body = lines.join('\n\n');
  if (body.length > MAX_TOTAL_CHARS) body = body.slice(body.length - MAX_TOTAL_CHARS);
  return `Sujet : ${redactPersonal(thread?.subject || row?.topic || 'Assistance').slice(0, 160)}\nCatégorie déclarée : ${row?.topic || 'general'}\n\nConversation :\n${body}`;
}

export const ASSIST_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['category','urgency','summary','suggestedReply','toCheck'],
  properties: {
    category: { type: 'string', enum: ASSIST_CATEGORIES },
    urgency: { type: 'string', enum: ASSIST_URGENCIES },
    summary: { type: 'string' },
    suggestedReply: { type: 'string' },
    toCheck: { type: 'array', items: { type: 'string' } },
  },
};

export const ASSIST_INSTRUCTIONS = `Tu aides l'équipe d'assistance de StrasDrive, une centrale de réservation VTC à Strasbourg.
Tu lis une conversation d'assistance et tu proposes un tri et un brouillon de réponse. Un administrateur relit et envoie lui-même : tu ne parles jamais au nom d'une décision déjà prise.
Règles strictes :
- Ne promets jamais de remboursement, geste commercial, montant, délai de paiement, sanction ou changement de prix. N'invente aucune règle ni aucun fait sur la course, le paiement ou le compte : écris que l'équipe vérifie.
- Sécurité (agression, accident, harcèlement, menace, danger) : urgence "critique" si un danger peut être en cours, sinon "haute" ; la réponse rappelle d'appeler le 17 ou le 112 en cas de danger immédiat.
- category : la catégorie la plus juste parmi celles autorisées.
- summary : 1 ou 2 phrases neutres en français.
- suggestedReply : 2 à 6 phrases, vouvoiement, ton calme et poli, dans la langue de l'utilisateur (français par défaut), terminée par « L'équipe StrasDrive ». Pas de nom de personne, pas de coordonnées.
- toCheck : 0 à 4 points courts que l'administrateur doit vérifier avant d'envoyer.`;

export function normalizeAssist(out) {
  const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  return {
    category: ASSIST_CATEGORIES.includes(out?.category) ? out.category : 'general',
    urgency: ASSIST_URGENCIES.includes(out?.urgency) ? out.urgency : 'normale',
    summary: text(out?.summary, 500),
    suggestedReply: text(out?.suggestedReply, 3000),
    toCheck: (Array.isArray(out?.toCheck) ? out.toCheck : []).map((v) => text(v, 200)).filter(Boolean).slice(0, 4),
  };
}

export function assistErrorMessage(status) {
  if (status === 402) return "Crédits IA épuisés. Rechargez-les dans Paramètres → Plans et crédits, puis réessayez.";
  if (status === 403) return "L'aide IA n'est pas autorisée pour cet espace de travail pour le moment.";
  if (status === 429) return "Trop de demandes à l'IA en même temps. Réessayez dans une minute.";
  if (status === 401) return "L'aide IA n'est pas configurée.";
  return "L'aide IA n'a pas pu répondre. Réessayez dans un instant.";
}
