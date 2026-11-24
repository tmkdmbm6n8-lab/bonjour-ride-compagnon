import { INAPPROPRIATE_MESSAGE } from "./message-moderation";

const CATEGORIES = ["harassment", "harassment/threatening", "hate", "hate/threatening", "sexual", "sexual/minors"];


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

function hasBlockedCategory(categories) {
  return CATEGORIES.some((name) => categories[name] === true);
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
