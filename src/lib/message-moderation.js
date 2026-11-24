// Match whole words and common expressions, without altering the original draft.
const blockedExpressions = [
  "connards?|connasses?|connes?|cons?",
  "encul(?:e|ee|es|ees|er)|fdp|putes?|fils de pute|fille de pute",
  "salopes?|salopards?|batards?|abrutis?|abruties?|debiles?|imbeciles?",
  "idiots?|idiotes?|bouffons?|bouffonnes?|trous? du cul",
  "va te faire foutre|nique ta mere|ntm",
  "fuck you|assholes?|bitches?|bastards?|motherfuckers?",
];
const insults = new RegExp(`(?:^| )(?:${blockedExpressions.join("|")})(?=$| )`, "u");

export function rejectInappropriateMessage(text) {
  const normalized = text.normalize("NFKD").toLowerCase()
    .replace(/[\p{M}\p{Cf}]/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ");
  if (insults.test(normalized)) {
    throw new Error("Contenu inapproprié. Retirez les insultes avant d’envoyer votre message.");
  }
}
