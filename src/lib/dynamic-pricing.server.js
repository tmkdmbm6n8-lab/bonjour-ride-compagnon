import { DYNAMIC_KEY, defaultDynamicConfig, validateDynamicConfig } from "./dynamic-pricing";
function required(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
export async function readDynamicSettings(admin) {
  const row = required(
    await admin.from("pricing_rules").select("rule").eq("vehicle_type", DYNAMIC_KEY).maybeSingle(),
  );
  return {
    raw: row?.rule ?? null,
    config: row ? validateDynamicConfig(row.rule) : defaultDynamicConfig(),
  };
}
export async function loadDynamicSettings(admin) {
  try {
    return (await readDynamicSettings(admin)).config;
  } catch {
    return null;
  } // A failed/missing settings read must never block the classic tariff.
}
export async function handleDynamicSettings(admin, { method, body = {} }) {
  if (method === "GET") return { config: (await readDynamicSettings(admin)).config };
  if (method !== "PUT" && method !== "PATCH") throw new Error("Méthode non autorisée");
  const current = await readDynamicSettings(admin);
  if (!Number.isInteger(body.expectedRevision) || body.expectedRevision !== current.config.revision)
    throw new Error("Ces paramètres ont été modifiés ailleurs. Rechargez avant d’enregistrer.");
  let config;
  if (method === "PATCH") {
    if (typeof body.enabled !== "boolean") throw new Error("Activation invalide");
    config = { ...current.config, enabled: body.enabled };
  } else config = validateDynamicConfig(body.config);
  config = { ...config, revision: current.config.revision + 1 };
  let result;
  if (current.raw !== null) {
    result = await admin
      .from("pricing_rules")
      .update({ rule: config, is_active: false })
      .eq("vehicle_type", DYNAMIC_KEY)
      .eq("rule", JSON.stringify(current.raw))
      .select("vehicle_type");
    if (result.error) throw new Error("Impossible d’enregistrer les paramètres dynamiques.");
    if (!result.data?.length)
      throw new Error("Ces paramètres ont été modifiés ailleurs. Rechargez avant d’enregistrer.");
  } else {
    result = await admin
      .from("pricing_rules")
      .insert({ vehicle_type: DYNAMIC_KEY, rule: config, is_active: false });
    if (result.error?.code === "23505")
      throw new Error("Ces paramètres ont été créés ailleurs. Rechargez avant d’enregistrer.");
    required(result);
  }
  return { config };
}
