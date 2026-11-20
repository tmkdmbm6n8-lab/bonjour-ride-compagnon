import {
  getRideDecision,
  recordAdminDecision,
  getDriverDecisions,
} from "./driver-warnings.server";
import { countActiveWarnings, WARNING_DEGREES } from "./driver-warnings";
import { newSupportThread } from "./vtc-support";
import { createHmac } from "node:crypto";
import {
  CHAT_ACTIVE_STATUSES,
  CHAT_RETENTION_MS,
  chatRetention,
  visibleChatMessages,
  newChatMessage,
  decodeChatAttachment,
} from "./ride-chat";
export const CHAT_BUCKET = "ride-chat-private";
const ARCHIVE = "ride_chat_archive",
  CLEANUP = "ride_chat_cleanup";
const required = (r) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};
const mac = (value) => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Service de discussion indisponible");
  return createHmac("sha256", key)
    .update("chat-evidence:v1:" + value)
    .digest("hex");
};
function encode(value) {
  const payload = JSON.stringify(value);
  return JSON.stringify({ payload, signature: mac(payload) });
}
export function decodeEvidence(row) {
  try {
    const data = JSON.parse(row.message);
    if (data.signature !== mac(data.payload)) return null;
    return { ...JSON.parse(data.payload), archiveId: row.id };
  } catch {
    return null;
  }
}
const pathsOf = (messages) =>
  visibleChatMessages(messages)
    .filter((m) => ["audio", "image"].includes(m.type) && typeof m.path === "string")
    .map((m) => m.path);
async function loadRide(admin, id) {
  return required(await admin.from("rides").select("*").eq("id", id).single());
}
async function evidenceRows(admin, rideId) {
  const rows = required(
    await admin.from("contact_messages").select("*").eq("topic", ARCHIVE).eq("name", `Course ${rideId}`),
  );
  return rows.map((row) => ({ row, evidence: decodeEvidence(row) })).filter((x) => x.evidence?.rideId === rideId);
}
async function saveEvidence(admin, ride, marker) {
  const evidence = {
    rideId: ride.id,
    riderId: ride.rider_id,
    driverId: ride.driver_id,
    reportedAt: marker.at,
    expiresAt: marker.expiresAt,
    messages: visibleChatMessages(ride.messages),
  };
  const previous = await evidenceRows(admin, ride.id);
  const combined = [...previous.flatMap((x) => x.evidence.messages || []), ...evidence.messages];
  evidence.messages = [...new Map(combined.map((m) => [m.id || JSON.stringify(m), m])).values()].sort(
    (a, b) => Date.parse(a.at) - Date.parse(b.at),
  );
  const message = encode(evidence);
  if (previous.length) {
    for (const { row } of previous) required(await admin.from("contact_messages").update({ message }).eq("id", row.id));
  } else
    required(
      await admin.from("contact_messages").insert({
        topic: ARCHIVE,
        name: `Course ${ride.id}`,
        email: "internal-chat-archive@strasdrive.invalid",
        message,
      }),
    );
}
export async function preserveRideChat(admin, rideId, uid, now = Date.now()) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const ride = await loadRide(admin, rideId);
    if (![ride.rider_id, ride.driver_id].includes(uid) || !ride.driver_id || !CHAT_ACTIVE_STATUSES.includes(ride.status))
      throw new Error("Signalez la course avant sa clôture pour conserver les échanges");
    const previous = ride.messages || [];
    const marker = chatRetention(previous) || {
      type: "retention",
      at: new Date(now).toISOString(),
      expiresAt: new Date(now + CHAT_RETENTION_MS).toISOString(),
    };
    if (!chatRetention(previous)) {
      const updated = required(
        await admin
          .from("rides")
          .update({ messages: [...previous, marker] })
          .eq("id", rideId)
          .in("status", CHAT_ACTIVE_STATUSES)
          .eq("messages", JSON.stringify(previous))
          .select("id"),
      );
      if (!updated.length) continue;
    }
    if (Date.parse(marker.expiresAt) > now) await saveEvidence(admin, { ...ride, messages: previous }, marker);
    return;
  }
  throw new Error("La course a changé. Réessayez le signalement.");
}
export async function appendChat(admin, rideId, uid, message) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const ride = await loadRide(admin, rideId);
    if (![ride.rider_id, ride.driver_id].includes(uid) || !CHAT_ACTIVE_STATUSES.includes(ride.status))
      throw new Error("Discussion fermée");
    const previous = ride.messages || [];
    if (visibleChatMessages(previous).length >= 200) throw new Error("Limite de messages atteinte pour cette course");
    const changed = required(
      await admin
        .from("rides")
        .update({ messages: [...previous, message] })
        .eq("id", rideId)
        .in("status", CHAT_ACTIVE_STATUSES)
        .eq("messages", JSON.stringify(previous))
        .select("id"),
    );
    if (changed.length) return;
  }
  throw new Error("Envoi concurrent. Réessayez.");
}
async function queueDeletion(admin, paths) {
  if (!paths.length) return;
  required(
    await admin.from("contact_messages").insert({
      topic: CLEANUP,
      name: "Suppression de fichiers de discussion",
      email: "internal-chat-archive@strasdrive.invalid",
      message: encode({ paths }),
    }),
  );
}
export async function closeRideChat(admin, id, { allowSearching = false } = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const ride = await loadRide(admin, id);
    if (
      CHAT_ACTIVE_STATUSES.includes(ride.status) ||
      (ride.status === "searching" && !allowSearching) ||
      !(ride.messages || []).length
    )
      return;
    const marker = chatRetention(ride.messages);
    if (marker && Date.parse(marker.expiresAt) > Date.now()) await saveEvidence(admin, ride, marker);
    else await queueDeletion(admin, pathsOf(ride.messages));
    const changed = required(
      await admin
        .from("rides")
        .update({ messages: [] })
        .eq("id", id)
        .eq("status", ride.status)
        .eq("messages", JSON.stringify(ride.messages))
        .select("id"),
    );
    if (changed.length) {
      await purgeChatFiles(admin);
      return;
    }
  }
  throw new Error("Suppression des échanges à réessayer");
}
export async function purgeChatFiles(admin, now = Date.now()) {
  const rows = required(await admin.from("contact_messages").select("*").in("topic", [ARCHIVE, CLEANUP]).limit(1000));
  let deleted = 0;
  for (const row of rows) {
    const evidence = decodeEvidence(row);
    if (!evidence || (row.topic === ARCHIVE && Date.parse(evidence.expiresAt) > now)) continue;
    const paths = row.topic === CLEANUP ? evidence.paths : pathsOf(evidence.messages);
    if (paths.length) required(await admin.storage.from(CHAT_BUCKET).remove(paths));
    required(await admin.from("contact_messages").delete().eq("id", row.id));
    deleted++;
  }
  return deleted;
}
export async function purgeRideChats(admin) {
  // Repeat bounded batches so failures can be retried by the scheduler.
  const rides = required(
    await admin
      .from("rides")
      .select("id")
      .in("status", ["completed", "cancelled", "no_drivers"])
      .neq("messages", "[]")
      .limit(500),
  );
  for (const ride of rides) await closeRideChat(admin, ride.id);
  return { closed: rides.length, deleted: await purgeChatFiles(admin) };
}
export async function sendChatMessage(admin, ride, uid, body) {
  const from = ride.rider_id === uid ? "rider" : "driver";
  await appendChat(admin, ride.id, uid, newChatMessage(body, from));
}
let bucketReady = false;
export async function sendChatAttachment(admin, ride, uid, body) {
  if (![ride.rider_id, ride.driver_id].includes(uid) || !CHAT_ACTIVE_STATUSES.includes(ride.status))
    throw new Error("Discussion fermée");
  const file = decodeChatAttachment(body);
  if (!bucketReady) {
    const bucket = await admin.storage.getBucket(CHAT_BUCKET);
    if (!bucket.error && bucket.data?.public) throw new Error("Le stockage de discussion doit être privé");
    if (bucket.error) {
      const created = await admin.storage.createBucket(CHAT_BUCKET, {
        public: false,
        fileSizeLimit: 4 * 1024 * 1024,
        allowedMimeTypes: ["audio/webm", "audio/ogg", "audio/mp4", "image/jpeg", "image/png", "image/webp"],
      });
      if (created.error && !/already exists/i.test(created.error.message))
        throw new Error("Stockage des pièces jointes indisponible");
    }
    bucketReady = true;
  }
  const id = crypto.randomUUID(),
    path = `${ride.id}/${id}.${file.ext}`;
  required(
    await admin.storage
      .from(CHAT_BUCKET)
      .upload(path, file.bytes, { contentType: file.mime, cacheControl: "0", upsert: false }),
  );
  try {
    await appendChat(admin, ride.id, uid, {
      id,
      from: ride.rider_id === uid ? "rider" : "driver",
      at: new Date().toISOString(),
      type: file.type,
      text: file.type === "audio" ? "Message vocal" : "Image",
      path,
      ...(file.duration ? { duration: file.duration } : {}),
    });
  } catch (err) {
    await queueDeletion(admin, [path]);
    await purgeChatFiles(admin);
    throw err;
  }
}
export async function chatFileUrl(admin, ride, uid, messageId) {
  if (![ride.rider_id, ride.driver_id].includes(uid) || !CHAT_ACTIVE_STATUSES.includes(ride.status))
    throw new Error("Accès refusé");
  const m = visibleChatMessages(ride.messages).find((m) => m.id === messageId && ["audio", "image"].includes(m.type));
  if (!m) throw new Error("Fichier indisponible");
  return { url: required(await admin.storage.from(CHAT_BUCKET).createSignedUrl(m.path, 60)).signedUrl };
}
import { reportedRideCount } from "./driver-reports.server";

export async function adminChatEvidence(admin, q) {
  await purgeRideChats(admin);
  if (q.get("id")) {
    const row = required(
      await admin.from("contact_messages").select("*").eq("topic", ARCHIVE).eq("id", q.get("id")).single(),
    );
    let evidence = decodeEvidence(row);
    if (!evidence || Date.parse(evidence.expiresAt) <= Date.now()) throw new Error("Les échanges ont expiré");
    const live = await loadRide(admin, evidence.rideId);
    if (CHAT_ACTIVE_STATUSES.includes(live.status) && chatRetention(live.messages)) {
      await saveEvidence(admin, live, chatRetention(live.messages));
      const fresh = await evidenceRows(admin, evidence.rideId);
      evidence = fresh.find((x) => x.row.id === row.id)?.evidence || evidence;
    }
    const ttl = Math.max(1, Math.min(60, Math.floor((Date.parse(evidence.expiresAt) - Date.now()) / 1000)));

    // 1. Récupération du signalement initial (motif et détails)
    const reportRow = await admin
      .from("contact_messages")
      .select("*")
      .in("topic", ["safety", "safety_dismissed"])
      .like("message", `Signalement chauffeur — course ${evidence.rideId}\n%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let reportInfo = null;
    if (reportRow?.data) {
      const msg = reportRow.data.message || "";
      const motifMatch = msg.match(/Motif : (.*)/);
      const detailsMatch = msg.match(/Détails : ([\s\S]*?)(?:\nAuthentification :|$)/);
      reportInfo = {
        messageId: reportRow.data.id,
        isDismissed: reportRow.data.topic === "safety_dismissed",
        reason: motifMatch ? motifMatch[1] : "Non précisé",
        details: detailsMatch ? detailsMatch[1].trim() : "Non précisés",
        createdAt: reportRow.data.created_at,
      };
    }

    // 2. Récupération des profils passager, chauffeur et course
    const [riderProfile, driverProfile, driverRecord, rideData, driverReports] = await Promise.all([
      admin
        .from("profiles")
        .select("id, name, phone, email")
        .eq("id", evidence.riderId)
        .maybeSingle()
        .then((r) => r.data),
      admin
        .from("profiles")
        .select("id, name, phone, email")
        .eq("id", evidence.driverId)
        .maybeSingle()
        .then((r) => r.data),
      admin
        .from("drivers")
        .select("is_approved, is_online, vehicle_class, vehicle")
        .eq("user_id", evidence.driverId)
        .maybeSingle()
        .then((r) => r.data),
      admin
        .from("rides")
        .select("id, pickup, dropoff, fare, status, created_at")
        .eq("id", evidence.rideId)
        .maybeSingle()
        .then((r) => r.data),
      reportedRideCount(admin, evidence.driverId),
    ]);

    const decision = await getRideDecision(admin, evidence.rideId);
    const driverDecisions = await getDriverDecisions(admin, evidence.driverId);
    const activeWarningsCount = countActiveWarnings(driverDecisions);

    return {
      evidence: {
        ...evidence,
        reportInfo,
        decision,
        activeWarningsCount,
        rideData,
        rider: riderProfile || { id: evidence.riderId, name: "Passager" },
        driver: {
          ...(driverProfile || { id: evidence.driverId, name: "Chauffeur" }),
          isApproved: driverRecord?.is_approved ?? false,
          isOnline: driverRecord?.is_online ?? false,
          vehicle: driverRecord?.vehicle || null,
          reportCount: driverReports || 0,
        },
        messages: await Promise.all(
          evidence.messages.map(async (m) => {
            if (!["audio", "image"].includes(m.type)) return m;
            return {
              ...m,
              url: required(await admin.storage.from(CHAT_BUCKET).createSignedUrl(m.path, ttl)).signedUrl,
              path: undefined,
            };
          }),
        ),
      },
    };

    return {
      evidence: {
        ...evidence,
        reportInfo,
        rideData,
        rider: riderProfile || { id: evidence.riderId, name: "Passager" },
        driver: {
          ...(driverProfile || { id: evidence.driverId, name: "Chauffeur" }),
          isApproved: driverRecord?.is_approved ?? false,
          isOnline: driverRecord?.is_online ?? false,
          vehicle: driverRecord?.vehicle || null,
          reportCount: driverReports || 0,
        },
        messages: await Promise.all(
          evidence.messages.map(async (m) => {
            if (!["audio", "image"].includes(m.type)) return m;
            return {
              ...m,
              url: required(await admin.storage.from(CHAT_BUCKET).createSignedUrl(m.path, ttl)).signedUrl,
              path: undefined,
            };
          }),
        ),
      },
    };
  }
  const rows = required(
    await admin
      .from("contact_messages")
      .select("*")
      .eq("topic", ARCHIVE)
      .order("created_at", { ascending: false })
      .limit(100),
  );
  const evidence = rows.map(decodeEvidence).filter((e) => e && Date.parse(e.expiresAt) > Date.now());
  if (!evidence.length) return { archives: [] };
  const rideIds = [...new Set(evidence.map((item) => item.rideId).filter(Boolean))];
  const driverIds = [...new Set(evidence.map((item) => item.driverId).filter(Boolean))];
  const [rides, drivers] = await Promise.all([
    rideIds.length ? admin.from("rides").select("id,created_at").in("id", rideIds) : { data: [], error: null },
    driverIds.length ? admin.from("profiles").select("id,name").in("id", driverIds) : { data: [], error: null },
  ]);
  const rideDates = new Map(required(rides).map((ride) => [ride.id, ride.created_at]));
  const driverNames = new Map(required(drivers).map((driver) => [driver.id, driver.name]));
  return {
    archives: evidence.map((e) => ({
      ...e,
      messages: undefined,
      messageCount: e.messages.length,
      rideCreatedAt: rideDates.get(e.rideId) || null,
      driverName: driverNames.get(e.driverId) || null,
    })),
  };
}

export async function handleAdminReportAction(admin, body) {
  const { action, driverId, messageId, warningText, warningTarget, restoreDriver } = body;

  if (action === "dismiss_report") {
    if (messageId) {
      await admin.from("contact_messages").update({ topic: "safety_dismissed" }).eq("id", messageId);
    }
    if (restoreDriver && driverId) {
      await admin
        .from("drivers")
        .update({ is_approved: true, updated_at: new Date().toISOString() })
        .eq("user_id", driverId);
    }
    return { ok: true, message: "Signalement classé sans suite (injustifié)." };
  }

  if (action === "classify_report") {
    const { rideId, degree, comment, warningText, dismiss } = body;
    const result = await recordAdminDecision(admin, {
      rideId,
      degree,
      comment,
      isDismissed: Boolean(dismiss),
    });

    if (!dismiss && WARNING_DEGREES[degree]?.countsAsWarning) {
      const ride = await loadRide(admin, rideId);
      const authUser = required(await admin.auth.admin.getUserById(ride.driver_id)).user;
      if (!authUser?.email) throw new Error("Décision enregistrée, mais l’avertissement n’a pas pu être envoyé : adresse du chauffeur indisponible.");
      {
        const recipient = required(await admin.from("profiles").select("name").eq("id", ride.driver_id).single());
        const explanation = typeof warningText === "string" && warningText.trim().length >= 5
          ? warningText.trim().slice(0, 4000)
          : "L’administration vous a adressé un avertissement à la suite d’un signalement vérifié. Contactez l’assistance si vous avez besoin de précisions.";
        const thread = newSupportThread(
          ride.driver_id,
          "Avertissement officiel",
          explanation,
          new Date().toISOString(),
          "driver",
        );
        thread.messages[0].from = "admin";
        required(await admin.from("contact_messages").insert({
          topic: "driver_conversation",
          name: recipient?.name || "Chauffeur",
          email: authUser.email.toLowerCase(),
          message: JSON.stringify(thread),
        }));
      }
    }

    return {
      ok: true,
      message: dismiss
        ? "Signalement classé sans suite (injustifié)."
        : result.driverSuspended
          ? "Décision enregistrée. Le compte chauffeur est suspendu."
          : "Décision enregistrée et avertissement comptabilisé.",
      decision: result.decision,
      activeWarningsCount: result.activeWarningsCount,
      driverSuspended: result.driverSuspended,
    };
  }

  if (action === "suspend_driver") {
    await admin
      .from("drivers")
      .update({
        is_approved: false,
        is_online: false,
        documents_override: false,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", driverId);
    return { ok: true, message: "Chauffeur suspendu avec succès." };
  }

  if (action === "unsuspend_driver") {
    await admin
      .from("drivers")
      .update({
        is_approved: true,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", driverId);
    return { ok: true, message: "Suspension levée, chauffeur réactivé." };
  }

  if (action === "send_warning") {
    if (typeof warningText !== "string" || warningText.trim().length < 5 || warningText.trim().length > 4000)
      throw new Error("Rédigez un avertissement (minimum 5 caractères)");
    if (!["driver", "rider"].includes(warningTarget)) throw new Error("Destinataire invalide");
    const ride = await loadRide(admin, body.rideId);
    const recipientId = warningTarget === "driver" ? ride.driver_id : ride.rider_id;
    if (!recipientId) throw new Error("Destinataire indisponible");
    const authUser = required(await admin.auth.admin.getUserById(recipientId)).user;
    if (!authUser?.email) throw new Error("Adresse du destinataire indisponible");
    const recipient = required(await admin.from("profiles").select("name").eq("id", recipientId).single());
    const thread = newSupportThread(
      recipientId,
      "Avertissement",
      warningText.trim(),
      new Date().toISOString(),
      warningTarget,
    );
    thread.messages[0].from = "admin";
    required(
      await admin.from("contact_messages").insert({
        topic: "driver_conversation",
        name: recipient?.name || "Utilisateur",
        email: authUser.email.toLowerCase(),
        message: JSON.stringify(thread),
      }),
    );
    return { ok: true, message: "Avertissement envoyé dans la messagerie du destinataire." };
  }

  throw new Error("Action inconnue");
}
