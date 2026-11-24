import { INAPPROPRIATE_MESSAGE } from "./message-moderation";

const CATEGORIES = ["harassment", "harassment/threatening", "hate", "hate/threatening"];

export async function moderateMessageText(text) {
  const key = process.env.OPENAI_MODERATION_API_KEY?.trim();
  if (!key) return; // The local filter covers environments without the optional integration.

  let categories;
  try {
    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
      signal: AbortSignal.timeout(1800),
    });
    if (!response.ok) return;
    categories = (await response.json())?.results?.[0]?.categories;
  } catch {
    // Pickup coordination must remain available if the remote check fails.
    // Callers already ran the local filter; never log message text here.
    return;
  }

  if (CATEGORIES.some((category) => categories?.[category] === true)) {
    throw new Error(INAPPROPRIATE_MESSAGE);
  }
}
