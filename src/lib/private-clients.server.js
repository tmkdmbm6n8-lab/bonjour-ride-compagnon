import { driverGold, loadDriverGold } from "./driver-gold.server";
// Private clients and favorite driver: server operations. Identity always comes from the verified session;
// links go through the manage_favorite_driver RPC (as the rider) which requires a ride together or a scanned QR.
import { PRIVATE_CLAIM_HOURS, favoriteStatus, favoriteEtaMinutes } from "./private-client-policy";
import { driverClass } from "./vtc-classes";
import { passengerDisplayName } from "./passenger-name";
import { accountRating } from "./account-ratings.server";

import { isPairBlocked } from "./user-blocks.server";
import { validLocation } from "./vtc-access";

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const ACTIVE = ["accepted", "arrived", "in_progress"];

function required(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const shortName = (name, fallback) => (typeof name === "string" && name.trim() ? passengerDisplayName(name) : fallback);

async function sha256(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function favoriteDriverId(admin, riderId) {
  const row = required(
    await admin.from("rider_favorite_drivers").select("driver_id").eq("rider_id", riderId).maybeSingle(),
  );
  return row?.driver_id || null;
}

const FAVORITE_LOCATION_TTL_MS = 35000;

export async function favoriteLiveLocation(admin, riderId, now = Date.now()) {
  const driverId = await favoriteDriverId(admin, riderId);
  if (!driverId || await isPairBlocked(admin, riderId, driverId)) return { status: "unavailable" };

  const driver = required(await admin.from("drivers")
    .select("is_online,is_approved,location")
    .eq("user_id", driverId)
    .maybeSingle());
  if (!driver?.is_approved || !driver.is_online) return { status: "offline", driverId };

  const location = driver.location;
  const age = now - Date.parse(location?.observedAt);
  if (!validLocation(location) || !Number.isFinite(age) || age < 0 || age >= FAVORITE_LOCATION_TTL_MS)
    return { status: "waiting", driverId };

  return {
    status: "online",
    driverId,
    position: {
      lat: Number(location.lat.toFixed(3)),
      lng: Number(location.lng.toFixed(3)),
    },
    expiresInMs: FAVORITE_LOCATION_TTL_MS - age,
  };
}

async function driverIdentity(admin, driverId) {
  const p = required(await admin.from("profiles").select("id,name,avatar").eq("id", driverId).maybeSingle());
  const d = required(await admin.from("drivers").select("*").eq("user_id", driverId).maybeSingle());
  if (!p || !d) return null;
  const v = d.vehicle || {};
  return {
    profile: p,
    row: d,
    card: {
      id: p.id,
      name: shortName(p.name, "Chauffeur StrasDrive"),
      avatar: p.avatar || "",
      vehicle: { make: v.make || "", model: v.model || "", color: v.color || "" },
      vehicleType: driverClass(d),
    },
  };
}

/** Rider's favorite driver card (Chauffeur favori tab). */
export async function favoriteCard(admin, riderId) {
  const id = await favoriteDriverId(admin, riderId);
  if (!id) return { driver: null };
  const who = await driverIdentity(admin, id);
  if (!who) return { driver: null };
  const together = await admin
    .from("rides")
    .select("id", { count: "exact", head: true })
    .eq("rider_id", riderId)
    .eq("driver_id", id)
    .eq("status", "completed")
    .eq("is_test", false);
  if (together.error) throw new Error(together.error.message);
  const rating = (await accountRating(admin, id, "driver")).average;
  return {
    driver: {
      ...who.card,
      rating: Number.isFinite(rating) ? rating : null,
      completedTogether: together.count || 0,
    },
  };
}

/** Favorite shown first in the ride comparator, with his live approach time and the fare of his own class. */
export async function favoriteForQuote(admin, riderId, pickup, quote, { loadPool, routeBetween }) {
  const id = await favoriteDriverId(admin, riderId);
  if (!id) return null;
  const who = await driverIdentity(admin, id);
  if (!who || !(await driverGold(admin, who.row)).active) return null;
  const pool = await loadPool();
  const inPool = pool.some((d) => d.user_id === id);
  let busy = false;
  if (!inPool && who.row.is_online && who.row.is_approved) {
    const rows = required(await admin.from("rides").select("id").eq("driver_id", id).in("status", ACTIVE).limit(1));
    busy = rows.length > 0;
  }
  const status = favoriteStatus({ driver: who.row, inPool, busy });
  let etaMinutes = null;
  if (status === "available" && who.row.location && pickup) {
    try {
      const leg = await routeBetween(who.row.location, pickup);
      etaMinutes = favoriteEtaMinutes(leg?.durationSeconds);
    } catch {
      etaMinutes = null;
    }
  }
  const fare = quote.estimates?.[who.card.vehicleType] || null;
  return { ...who.card, status, etaMinutes, fare };
}

/** Server-side resolution of "book my favorite": never trusts the browser for the driver or the class. */
export async function favoriteBooking(admin, riderId, pool) {
  const id = await favoriteDriverId(admin, riderId);
  if (!id) throw new Error("Vous n’avez pas de chauffeur favori");
  const fav = pool.find((d) => d.user_id === id);
  if (!fav) throw new Error("Votre chauffeur favori n’est plus disponible — choisissez une autre gamme");
  if (!(await driverGold(admin, fav)).active) throw new Error("L’option chauffeur favori n’est plus disponible — choisissez une autre gamme");
  return { driverId: id, vehicleType: driverClass(fav) };
}

/** Stable, unguessable per-driver QR token; only its fingerprint is stored. */
async function permanentDriverToken(driverId) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Configuration du serveur indisponible");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("strasdrive:private-qr:v1:" + driverId)));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Driver: the same QR code on every visit, without a time limit. */
export async function createInvitation(admin, driverId) {
  const gold = await loadDriverGold(admin, driverId);
  if (!gold.active) throw new Error("StrasDrive Gold est inactif.");
  const token = await permanentDriverToken(driverId);
  const hash = await sha256(token);
  const existing = required(await admin.from("driver_private_invitations").select("id,expires_at").eq("token_hash", hash).maybeSingle());
  const expiresAt = "9999-12-31T23:59:59.000Z";
  if (!existing) {
    const inserted = await admin.from("driver_private_invitations").insert({ driver_id: driverId, token_hash: hash, expires_at: expiresAt });
    if (inserted.error && inserted.error.code !== "23505") throw new Error(inserted.error.message);
  } else if (existing.expires_at !== expiresAt) {
    required(await admin.from("driver_private_invitations").update({ expires_at: expiresAt }).eq("id", existing.id));
  }
  return { token, permanent: true };
}

/** Driver: his private clients, with only a display name and avatar. */
export async function privateClients(admin, driverId) {
  const links = required(
    await admin
      .from("rider_favorite_drivers")
      .select("rider_id,created_at")
      .eq("driver_id", driverId)
      .order("created_at", { ascending: false })
      .limit(200),
  );
  const gold = await loadDriverGold(admin, driverId);
  if (!links.length) return { clients: [], gold };
  const profiles = required(
    await admin
      .from("profiles")
      .select("id,name,avatar")
      .in(
        "id",
        links.map((l) => l.rider_id),
      ),
  );
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const rideRows = required(await admin.from("rides").select("rider_id")
    .eq("driver_id", driverId).eq("status", "completed").eq("is_test", false)
    .in("rider_id", links.map((l) => l.rider_id)).limit(1000));
  const counts = new Map();
  for (const ride of rideRows) counts.set(ride.rider_id, (counts.get(ride.rider_id) || 0) + 1);
  const blocksResult = await admin.from("user_blocks").select("blocked_id").eq("blocker_id", driverId);
  if (blocksResult.error && !["42P01", "PGRST205"].includes(blocksResult.error.code)) throw new Error(blocksResult.error.message);
  const blockedIds = new Set((blocksResult.data || []).map((b) => b.blocked_id));
  return {
    gold,
    clients: links.map((l) => ({
      id: l.rider_id,
      name: shortName(byId.get(l.rider_id)?.name, "Client StrasDrive"),
      avatar: byId.get(l.rider_id)?.avatar || "",
      since: l.created_at,
      completedTogether: counts.get(l.rider_id) || 0,
      blocked: blockedIds.has(l.rider_id),
    })),
  };
}

/** Anyone holding a still-valid QR token: exchange it for a 24-hour claim (lets a new rider sign up first). */
export async function scanInvitation(admin, token) {
  if (typeof token !== "string" || !TOKEN.test(token)) throw new Error("QR code invalide");
  const inv = required(
    await admin
      .from("driver_private_invitations")
      .select("*")
      .eq("token_hash", await sha256(token))
      .maybeSingle(),
  );
  if (!inv || new Date(inv.expires_at).getTime() <= Date.now())
    throw new Error("Ce QR code a expiré — demandez au chauffeur d’afficher un nouveau code");
  const who = await driverIdentity(admin, inv.driver_id);
  if (!who || !(await driverGold(admin, who.row)).active) throw new Error("Ce QR code n’est plus disponible.");
  const claimToken = randomToken();
  const expiresAt = Date.now() + PRIVATE_CLAIM_HOURS * 3600 * 1000;
  required(
    await admin.from("driver_invitation_claims").insert({
      invitation_id: inv.id,
      driver_id: inv.driver_id,
      claim_token_hash: await sha256(claimToken),
      claim_expires_at: new Date(expiresAt).toISOString(),
    }),
  );
  if (!inv.used_at)
    await admin.from("driver_private_invitations").update({ used_at: new Date().toISOString() }).eq("id", inv.id).is("used_at", null);
  return { claimToken, expiresAt, driver: { name: who.card.name, avatar: who.card.avatar } };
}

/** Signed-in rider: finish the link from a claim. The claim belongs to the first account that redeems it. */
export async function redeemClaim(admin, db, uid, claimToken, confirmReplacement) {
  if (typeof claimToken !== "string" || !TOKEN.test(claimToken)) throw new Error("Invitation invalide");
  const hash = await sha256(claimToken);
  let claim = required(await admin.from("driver_invitation_claims").select("*").eq("claim_token_hash", hash).maybeSingle());
  if (!claim || new Date(claim.claim_expires_at).getTime() <= Date.now())
    throw new Error("Cette invitation a expiré — scannez un nouveau QR code du chauffeur");
  if (!(await loadDriverGold(admin, claim.driver_id)).active) throw new Error("Cette invitation est temporairement indisponible.");
  if (claim.driver_id === uid) throw new Error("Vous ne pouvez pas vous choisir vous-même");
  if (!claim.rider_id) {
    const won = required(
      await admin
        .from("driver_invitation_claims")
        .update({ rider_id: uid, completed_at: new Date().toISOString() })
        .eq("id", claim.id)
        .is("rider_id", null)
        .select("*"),
    )[0];
    claim = won || required(await admin.from("driver_invitation_claims").select("*").eq("id", claim.id).single());
  }
  if (claim.rider_id !== uid) throw new Error("Cette invitation a déjà été utilisée par un autre compte");
  const result = required(
    await db.rpc("manage_favorite_driver", {
      p_driver_id: claim.driver_id,
      p_action: "set",
      p_confirm_replacement: confirmReplacement === true,
    }),
  );
  const who = await driverIdentity(admin, claim.driver_id);
  return { ...result, driver: who ? { name: who.card.name, avatar: who.card.avatar } : null };
}

/** Rider: add/replace (after a ride together) or remove the favorite. */
export async function setFavorite(admin, db, uid, { driverId, confirmReplacement, expectedDriverId }) {
  if (typeof driverId !== "string" || !/^[0-9a-f-]{36}$/i.test(driverId)) throw new Error("Chauffeur invalide");
  if (!(await loadDriverGold(admin, driverId)).active) throw new Error("Ce chauffeur ne peut pas être ajouté en favori actuellement.");
  if (confirmReplacement === true) {
    const current = await favoriteDriverId(admin, uid);
    // Another change happened since the question was asked: ask again instead of replacing someone else.
    if (current && expectedDriverId && current !== expectedDriverId)
      return { ok: false, requiresConfirmation: true, previousDriverId: current };
  }
  return required(
    await db.rpc("manage_favorite_driver", {
      p_driver_id: driverId,
      p_action: "set",
      p_confirm_replacement: confirmReplacement === true,
    }),
  );
}

export async function removeFavorite(db) {
  return required(await db.rpc("manage_favorite_driver", { p_driver_id: null, p_action: "remove" }));
}

/** Driver may remove only their own private-client link; this also removes the rider's favorite. */
export async function removePrivateClient(admin, driverId, riderId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(riderId)) || driverId === riderId) throw new Error("Client invalide");
  const link = required(await admin.from("rider_favorite_drivers").select("rider_id")
    .eq("driver_id", driverId).eq("rider_id", riderId).maybeSingle());
  if (!link) throw new Error("Ce client ne figure pas dans votre clientèle privée");
  required(await admin.from("rider_favorite_drivers").delete().eq("driver_id", driverId).eq("rider_id", riderId));
  return { ok: true };
}
