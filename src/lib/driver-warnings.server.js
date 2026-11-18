import { createHmac } from "node:crypto";
import { WARNING_DEGREES, calculateWarningExpiry, countActiveWarnings, shouldSuspendDriver } from "./driver-warnings";
import { newSupportThread } from "./vtc-support";

const required = (r) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};

const signPayload = (payload) => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Service indisponible");
  return createHmac("sha256", key)
    .update("driver-decision:v1:" + payload)
    .digest("hex");
};

export function decodeDecision(row) {
  try {
    const data = JSON.parse(row.message);
    if (!data.payload || !data.signature) return null;
    if (signPayload(data.payload) !== data.signature) return null;
    return { ...JSON.parse(data.payload), id: row.id, createdAt: row.created_at };
  } catch {
    return null;
  }
}

// L ancien déclenchement automatique sur signalements bruts est neutralisé.
// Seules les décisions administratives vérifiées déclenchent avertissements et suspensions.
return { ok: true };

export async function getDriverDecisions(admin, driverId) {
  const rows = required(await admin.from("contact_messages").select("*").eq("topic", "safety_decision"));
  return rows.map(decodeDecision).filter((d) => d && d.driverId === driverId);
}

export async function recordAdminDecision(admin, { rideId, degree: degreeId, comment, isDismissed = false }) {
  if (!rideId) throw new Error("Identifiant de course requis");
  const ride = required(await admin.from("rides").select("id, driver_id, rider_id").eq("id", rideId).single());
  if (!ride.driver_id) throw new Error("Chauffeur introuvable pour cette course");

  const driverId = ride.driver_id;
  const nowIso = new Date().toISOString();

  let expiresAt = null;
  if (!isDismissed && degreeId) {
    if (!WARNING_DEGREES[degreeId]) throw new Error("Degré de gravité invalide");
    expiresAt = calculateWarningExpiry(degreeId, nowIso);
  }

  const decisionPayload = {
    rideId: ride.id,
    driverId,
    degree: isDismissed ? null : degreeId,
    isDismissed: Boolean(isDismissed),
    decidedAt: nowIso,
    expiresAt,
    comment: typeof comment === "string" ? comment.trim() : "",
  };

  const payloadStr = JSON.stringify(decisionPayload);
  const envelope = JSON.stringify({
    payload: payloadStr,
    signature: signPayload(payloadStr),
  });

  const existing = required(
    await admin
      .from("contact_messages")
      .select("id")
      .eq("topic", "safety_decision")
      .eq("name", `Decision ${ride.id}`)
      .limit(1),
  );

  if (existing.length) {
    required(await admin.from("contact_messages").update({ message: envelope }).eq("id", existing[0].id));
  } else {
    required(
      await admin.from("contact_messages").insert({
        topic: "safety_decision",
        name: `Decision ${ride.id}`,
        email: "internal-safety@strasdrive.invalid",
        message: envelope,
      }),
    );
  }

  if (isDismissed) {
    await admin
      .from("contact_messages")
      .update({ topic: "safety_dismissed" })
      .like("message", `Signalement chauffeur — course ${ride.id}\n%`);
  }

  const allDriverDecisions = await getDriverDecisions(admin, driverId);
  const activeCount = countActiveWarnings(allDriverDecisions);
  const mustSuspend = shouldSuspendDriver(allDriverDecisions);

  if (mustSuspend) {
    required(
      await admin
        .from("drivers")
        .update({
          is_approved: false,
          is_online: false,
          documents_override: false,
          updated_at: nowIso,
        })
        .eq("user_id", driverId),
    );
  }

  return {
    ok: true,
    decision: decisionPayload,
    activeWarningsCount: activeCount,
    driverSuspended: mustSuspend,
  };
}
