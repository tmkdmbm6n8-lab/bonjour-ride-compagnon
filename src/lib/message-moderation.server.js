import { INAPPROPRIATE_MESSAGE, rejectInappropriateMessage } from "./message-moderation";

const CATEGORIES = ["harassment", "harassment/threatening", "hate", "hate/threatening", "sexual", "sexual/minors"];

const MEDIA_UNAVAILABLE = "Vérification de la pièce jointe indisponible. Réessayez ou envoyez un message texte.";
const MEDIA_BLOCKED = "Contenu inapproprié. Cette pièce jointe ne peut pas être envoyée.";

async function queryModeration(input, key, timeout) {
  const response = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "omni-moderation-latest", input }),
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error("Moderation unavailable");
  const categories = (await response.json())?.results?.[0]?.categories;
  if (!categories || typeof categories !== "object") throw new Error("Moderation response missing");
  return categories;
}

function hasBlockedCategory(categories, names = CATEGORIES) {
  return names.some((name) => categories[name] === true);
}

export async function moderateMessageText(text) {
  const key = process.env.OPENAI_MODERATION_API_KEY?.trim();
  if (!key) return;

  let categories;
  try {
    categories = await queryModeration(text, key, 1800);
  } catch {
    // Text coordination remains available, with the existing local filter.
    return;
  }
  if (hasBlockedCategory(categories)) throw new Error(INAPPROPRIATE_MESSAGE);
}

async function transcribeAttachment(file, key) {
  const form = new FormData();
  form.set("model", "gpt-transcribe");
  form.set("file", new Blob([file.bytes], { type: file.mime }), `message.${file.ext}`);
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Transcription unavailable");
  const { text } = await response.json();
  if (typeof text !== "string" || !text.trim()) throw new Error("Transcription missing");
  return text.trim();
}

export async function moderateChatAttachment(file) {
  const key = process.env.OPENAI_MODERATION_API_KEY?.trim();
  if (!key) throw new Error(MEDIA_UNAVAILABLE);

  if (file.type === "image") {
    const imageCategories = ["sexual", "sexual/minors", "violence", "violence/graphic"];
    let categories;
    try {
      const url = `data:${file.mime};base64,${file.bytes.toString("base64")}`;
      categories = await queryModeration([{ type: "image_url", image_url: { url } }], key, 7000);
      // Never accept an image if none of its supported checks returned a decision.
      if (imageCategories.some((name) => typeof categories[name] !== "boolean")) throw new Error("Incomplete result");
    } catch {
      throw new Error(MEDIA_UNAVAILABLE);
    }
    if (hasBlockedCategory(categories, imageCategories)) throw new Error(MEDIA_BLOCKED);
    return;
  }

  if (file.type !== "audio" || process.env.OPENAI_CHAT_AUDIO_MODERATION !== "true") {
    throw new Error("La vérification des vocaux n’est pas disponible. Vous pouvez envoyer un message texte.");
  }

  let transcript;
  try {
    transcript = await transcribeAttachment(file, key);
  } catch {
    throw new Error(MEDIA_UNAVAILABLE);
  }
  try {
    rejectInappropriateMessage(transcript);
  } catch {
    throw new Error(MEDIA_BLOCKED);
  }
  let categories;
  try {
    categories = await queryModeration(transcript, key, 5000);
    if (CATEGORIES.some((name) => typeof categories[name] !== "boolean")) throw new Error("Incomplete result");
  } catch {
    throw new Error(MEDIA_UNAVAILABLE);
  }
  if (hasBlockedCategory(categories)) throw new Error(MEDIA_BLOCKED);
}
