import { goldDispatchPool, hasPaidDriverGold, loadDriverGold } from "./driver-gold.server";
import { restoreGoldCommission, waiveGoldCommission } from "./driver-gold-fare";
import { accountRating } from "./account-ratings.server";
import { recordOnlineTime } from "./driver-online-time.server";
import { driverReportMessage } from "./driver-reports";
import { visibleChatMessages, CHAT_ACTIVE_STATUSES } from "./ride-chat";
import { isPairBlocked, setUserBlock, listUserBlocks } from "./user-blocks.server";
import {
  closeRideChat,
  preserveRideChat,
  sendChatMessage,
  sendChatAttachment,
  chatFileUrl,
  adminChatEvidence,
  handleAdminReportAction,
} from "./ride-chat.server";

import { reportedRideCount, sendDriverReport } from "./driver-reports.server";
import { rideOwnerColumn } from "./account-mode";
import { preparePassengerBooking, hasPassengerRide, switchAccountMode } from "./vtc-account-mode.server";
import { supportOwnedBy } from "./vtc-support";
import { exportPageOptions, PERSONAL_DATA_PAGE_SIZE } from "./personal-data-export";
import { assertRideActionMethod, privateDocumentPath, validLocation, invoiceRequestMessage } from "./vtc-access";
import { discoverBoard, goldReturnHintForRide } from "./vtc-transport.server";
import { driverWeekSummary } from "./vtc-driver-stats";
import { parisDay, validDay } from "./vtc-dates";
import {
  inboxForDriver,
  sendSupportMessage,
  personalSupportRequests,
  hideDriverSupportThread,
} from "./vtc-support.server";
import { buildWaybill, sanitizeOperator } from "./vtc-waybill";
import { geoSearch } from "./vtc-geocoding.server";
import { passengerDisplayName } from "./passenger-name";
export function cityFromAddress(addr) {
  if (!addr || typeof addr !== "string") return "Ville";
  const parts = addr
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  for (const p of parts) {
    const m = p.match(/\b\d{5}\s+([A-Za-zÀ-ÿ\s'-]+)/);
    if (m && m[1]) {
      const clean = m[1].replace(/\(.*?\)/g, "").trim();
      if (clean) return clean;
    }
  }
  if (parts.length >= 2) {
    const cand = parts.length > 2 ? parts[parts.length - 2] : parts[1];
    const clean = cand
      .replace(/\b\d{5}\b/g, "")
      .replace(/\(.*?\)/g, "")
      .trim();
    if (clean) return clean;
  }
  return parts[0]?.replace(/\(.*?\)/g, "").trim() || "Ville";
}

import { speedCameras, requireCameraReader, routeCameras } from "./vtc-driver-cameras.server";
import { routeBounds, radarsOnRoute } from "./route-radars";
import { mergeCameraAlerts } from "./vtc-speed-cameras";
import { requireRadarReporter } from "./vtc-road-alerts.server";
import {
  DEFAULT_PRICING,
  calculateFare,
  settleDriverEarnings,
  paymentMethodOf,
  bookingPaymentProblem,
} from "./vtc-pricing";
import { haversineDistance } from "./utils/geo";
import {
  LOWER_CLASSES,
  isVehicleClass,
  driverClass,
  sanitizeAcceptedClasses,
  isLowerClassRide,
  availabilityByClass,
} from "./vtc-classes";
import {
  approximateRoute,
  routeFromGoogle,
  googleRouteRequest,
  GOOGLE_ROUTE_FIELDS,
  liveTarget,
  liveRouteFresh,
  routeQualityLabel,
} from "./vtc-routing";
import {
  DOCUMENTS_BUCKET,
  documentSpec,
  validateDocumentInput,
  driverCompliance,
  complianceProblem,
} from "./vtc-documents";
import {
  planDispatch,
  availableFor,
  canSeeOffer,
  distanceToPickupKm,
  approachSecondsFor,
  profitability,
  TEST_OFFER_SECONDS,
  pickupZoneProblem,
  ARRIVAL_ZONE_METERS,
} from "./vtc-dispatch";
import { sanitizeTripPrefs, tripPrefsOf, riderAverage } from "./vtc-trip-prefs";
import { evaluateDriverProgress } from "./vtc-tracking";
import { newlyOfferedDriverIds, validPushToken } from "./vtc-push";
import { pushRideOffer } from "./vtc-push.server";
import {
  ALERT_KINDS,
  NEARBY_RADIUS_KM,
  validPoint,
  isAlertActive,
  applyVote,
  findMergeTarget,
  alertShape,
} from "./vtc-road-alerts";
const active = ["searching", "accepted", "arrived", "in_progress"];
function required(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
function driverShape(d) {
  if (!d) return null;
  const vc = driverClass(d);
  return {
    ...d,
    vehicle: { ...(d.vehicle || {}), type: vc },
    _id: d.id,
    isOnline: d.is_online,
    isApproved: d.is_approved,
    isPriority: Boolean(d.is_priority),
    userId: d.user_id,
    vehicleClass: vc,
    acceptsClasses: sanitizeAcceptedClasses(vc, d.accepts_classes),
    lowerClasses: LOWER_CLASSES[vc],
    tripPrefs: tripPrefsOf(d),
  };
}
function docShape(d) {
  return {
    id: d.id,
    type: d.doc_type,
    fileName: d.file_name,
    number: d.document_number,
    referenceDate: d.reference_date,
    validUntil: d.valid_until,
    status: d.status,
    rejectionReason: d.rejection_reason,
    uploadedAt: d.uploaded_at,
    reviewedAt: d.reviewed_at,
  };
}
function profileShape(p, email) {
  return {
    ...p,
    _id: p.id,
    createdAt: p.created_at,
    email: email || "",
    wallet: { balance: Number(p.balance), currency: "EUR" },
  };
}
async function serialize(db, r, actor, raw = false) {
  if (!r) return null;
  if (!CHAT_ACTIVE_STATUSES.includes(r.status) && r.status !== "searching" && (r.messages || []).length) {
    try {
      await closeRideChat(db, r.id);
    } catch {
      console.warn("Chat cleanup pending: scheduled retry required");
    }
    r = { ...r, messages: [] };
  }
  let driver;
  let isPriorityDriver = false;
  if (r.driver_id) {
    const p = required(await db.from("profiles").select("*").eq("id", r.driver_id).single());
    const d = required(await db.from("drivers").select("*").eq("user_id", r.driver_id).single());
    isPriorityDriver = Boolean(d.is_priority);
    driver = {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      rating: (await accountRating(db, r.driver_id, "driver")).average ?? 5,
      totalTrips: d.stats.totalTrips,
      vehicle: { ...d.vehicle, type: driverClass(d) },
      location: d.location,
      isPriority: isPriorityDriver,
    };
  }

  // Règle d'anonymat : pour les chauffeurs normaux (non prioritaires et non admins),
  // dès que la course est terminée, masquer les adresses exactes et différer la note de 12 h.
  const isDriverViewingOwnCompletedRide = actor === r.driver_id && r.status === "completed";
  const mustAnonymize = isDriverViewingOwnCompletedRide && !isPriorityDriver;

  const completedAgeMs = r.completed_at ? Date.now() - new Date(r.completed_at).getTime() : 0;
  const ratingDelayed = mustAnonymize && completedAgeMs < 12 * 3600 * 1000;

  const pickupClean = mustAnonymize
    ? {
        ...r.pickup,
        address: cityFromAddress(r.pickup?.address),
        city: cityFromAddress(r.pickup?.address),
        lat: null,
        lng: null,
      }
    : r.pickup;

  const dropoffClean = mustAnonymize
    ? {
        ...r.dropoff,
        address: cityFromAddress(r.dropoff?.address),
        city: cityFromAddress(r.dropoff?.address),
        lat: null,
        lng: null,
      }
    : r.dropoff;

  const cleanRating = ratingDelayed
    ? r.rating
      ? { ...r.rating, byRider: undefined, riderComment: undefined }
      : undefined
    : r.rating;

  const out = {
    ...r,
    pickup: pickupClean,
    dropoff: dropoffClean,
    rating: cleanRating,
    route: mustAnonymize ? undefined : r.route,
    messages: CHAT_ACTIVE_STATUSES.includes(r.status) ? visibleChatMessages(r.messages) : [],
    id: r.id,
    _id: r.id,
    createdAt: r.created_at,
    completedAt: r.completed_at,
    vehicleType: r.vehicle_type,
    driver,
    pin: r.rider_id === actor || r.is_test ? r.pin : undefined,
    isTest: Boolean(r.is_test),
    live_route: undefined,
  };

  // Attacher les coordonnées du passager (nom, téléphone, note) au chauffeur
  if (r.rider_id && (actor === r.driver_id || raw)) {
    try {
      const rp = required(await db.from("profiles").select("name,phone,rating,avatar").eq("id", r.rider_id).single());
      out.rider = {
        name: raw ? rp.name || "Passager" : passengerDisplayName(rp.name),
        avatar: rp.avatar || "",
        phone: rp.phone || "",
        rating: (await accountRating(db, r.rider_id, "rider")).average ?? 5,
      };
    } catch {
      out.rider = { name: "Passager", phone: "", rating: 5.0 };
    }
  }

  if (raw) {
    const p = required(await db.from("profiles").select("id,name,username").eq("id", r.rider_id).single());
    out.riderId = p;
    out.driverId = driver;
  }
  return out;
}

const MAPS_GATEWAY = "https://connector-gateway.lovable.dev/google_maps";
async function googleRoute(a, b) {
  const lovable = process.env.LOVABLE_API_KEY,
    maps = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovable || !maps) {
    console.error("Google Routes: connector credentials missing");
    return null;
  }
  try {
    const res = await fetch(`${MAPS_GATEWAY}/routes/directions/v2:computeRoutes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovable}`,
        "X-Connection-Api-Key": maps,
        "Content-Type": "application/json",
        "X-Goog-FieldMask": GOOGLE_ROUTE_FIELDS,
      },
      body: JSON.stringify(googleRouteRequest(a, b)),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error(`Google Routes failed [${res.status}]: ${(await res.text()).slice(0, 500)}`);
      return null;
    }
    return routeFromGoogle(await res.json());
  } catch (e) {
    console.error("Google Routes error", e?.message);
    return null;
  }
}
async function routeBetween(a, b) {
  if (!validPoint(a) || !validPoint(b)) throw new Error("Adresses invalides");
  // Google only; an outage yields an explicitly approximate estimate without a road line.
  return (await googleRoute(a, b)) || approximateRoute(haversineDistance(a.lat, a.lng, b.lat, b.lng));
}
/** Live leg driver → pickup/destination, shared by rider and driver through rides.live_route. */
async function liveRoute(admin, r) {
  const target = liveTarget(r);
  if (!target || !r.driver_id) return null;
  if (liveRouteFresh(r.live_route, r.status)) return r.live_route;
  const d = required(await admin.from("drivers").select("location").eq("user_id", r.driver_id).single());
  if (!validPoint(d.location) || !validPoint(target)) return null;
  const route = await routeBetween(d.location, target);
  const value = { ...route, status: r.status, target: target.kind, at: new Date().toISOString() };
  required(await admin.from("rides").update({ live_route: value }).eq("id", r.id).eq("status", r.status));
  return value;
}
// === src/lib/vtc.server.js (autour de la ligne 229) ===
async function estimates(db, a, b) {
  const route = await routeBetween(a, b);
  const rows = required(await db.from("pricing_rules").select("*"));
  const rules = { ...DEFAULT_PRICING };
  for (const row of rows) {
    if (row.vehicle_type !== "uber_discount" && row.vehicle_type !== "uber_cookie" && row.vehicle_type !== "uber_hourly_checks" && row.vehicle_type !== "uber_ai_learning" && row.vehicle_type !== "pricing_source_mode") {
      rules[row.vehicle_type] = row.rule;
    }
  }

  // Configuration de la réduction Uber (20 % par défaut, activée par défaut)
  const discountSetting = rows.find((r) => r.vehicle_type === "uber_discount")?.rule;
  const isDiscountActive = discountSetting ? Boolean(discountSetting.enabled) : true;
  const discountRate = discountSetting && Number.isFinite(discountSetting.rate) ? discountSetting.rate : 0.2; // 20 %

  // Explicit source policy: automatic (Uber first), Uber only, or learned AI only.
  const sourceMode = rows.find(r => r.vehicle_type === "pricing_source_mode")?.rule?.mode || "auto";
  const mode = ["auto", "uber", "ai"].includes(sourceMode) ? sourceMode : "auto";
  let uberList = [];
  if (mode !== "ai") {
    try {
      const { uberProducts } = await import("./vtc-uber.server");
      const cookieRow = rows.find(r => r.vehicle_type === "uber_cookie");
      const result = await uberProducts(a, b, cookieRow?.rule?.cookie || null);
      if (Array.isArray(result)) uberList = result.filter(p => Number.isFinite(Number(p.price)) && Number(p.price) > 0);
    } catch (error) {
      console.warn("[pricing] Uber unavailable:", error?.message || error);
    }
    if (uberList.length) {
      try {
        const { recordClientUberQuote } = await import("./vtc-pricing-learning.server");
        await recordClientUberQuote(db, a, b, uberList, route);
      } catch (error) {
        console.error("[pricing-ai] Failed to record live Uber client quote:", error?.message || error);
      }
    }
  }

  // 3. Correspondance avec les gammes StrasDrive (Go, Comfort, Pet, XL)
  const findProduct = (keywords) => {
    for (const kw of keywords) {
      const match = uberList.find((p) => p.name?.toLowerCase().includes(kw.toLowerCase()));
      if (match) return match;
    }
    return null;
  };

  const uberX = findProduct(["uberx", "electric", "wait & save"]);
  const uberComfort = findProduct(["comfort"]);
  const uberPet = findProduct(["pet", "uber pet", "animal"]);
  const uberXL = findProduct(["uberxl", "xl"]);

  const finalEstimates = {};

  const applyUberPrice = (type, product) => {
    let rawPrice = product?.price;

    // Si Uber Pet n'est pas actif dans la ville, barème officiel Uber : UberX + 4,00 €
    if (!rawPrice && type === "pet" && uberX?.price) {
      rawPrice = Math.round((uberX.price + 4.0) * 100) / 100;
    }

    if (rawPrice && Number.isFinite(rawPrice) && rawPrice > 0) {
      const commRate = rules[type]?.platformCommission || 5;

      // Calcul du prix réduit de 20 %
      let price = rawPrice;
      if (isDiscountActive) {
        price = Math.round(rawPrice * (1 - discountRate) * 100) / 100;
      }

      // ── Plancher légal ARPE : 9,00 € nets min par course pour le chauffeur ──
      // Avec 5 % de commission, le prix payé par le client ne descend jamais sous 9,47 €
      const minNetDriver = 9.0;
      const minLegalPrice = Math.round((minNetDriver / (1 - commRate / 100)) * 100) / 100;
      if (price < minLegalPrice) {
        price = minLegalPrice;
      }

      const platformFee = Math.round(price * commRate) / 100;
      const driverEarnings = Math.round((price - platformFee) * 100) / 100;

      finalEstimates[type] = {
        total: price,
        estimatedTotal: price,
        originalTotal: rawPrice, // Le prix Uber de référence avant réduction
        platformFee,
        driverEarnings,
        uberProduct: product ? product.name : type === "pet" ? "Uber Pet" : null,
        isUberPrice: true,
        discountRate: isDiscountActive ? discountRate : 0,
      };
    }
  };

  applyUberPrice("economy", uberX);
  applyUberPrice("comfort", uberComfort);
  applyUberPrice("pet", uberPet);
  applyUberPrice("xl", uberXL);

  // In AI mode, or for missing Uber categories in automatic mode, predict each
  // category independently. Never present an untrained model as a valid fare.
  const aiNames = { economy: "UberX", comfort: "Comfort", pet: "Uber Pet", xl: "UberXL" };
  let aiUsed = false;
  if (mode !== "uber") {
    const { predictLearnedPrice } = await import("./vtc-pricing-learning.server");
    const distanceKm = Number(route.distanceMeters) / 1000;
    for (const type of Object.keys(DEFAULT_PRICING)) {
      if (mode === "auto" && finalEstimates[type]) continue;
      // AI-only mode must not retain Uber-derived estimates.
      if (mode === "ai") delete finalEstimates[type];
      let prediction;
      try {
        prediction = await predictLearnedPrice(db, { distanceKm, productName: aiNames[type] });
      } catch (error) {
        console.error("[pricing-ai] Prediction failed:", type, error?.message || error);
      }
      if (!prediction?.ready || !Number.isFinite(prediction.price) || prediction.price <= 0) continue;
      const commRate = Number(rules[type]?.platformCommission ?? 5);
      const commission = Math.min(95, Math.max(0, commRate));
      const rawPrice = prediction.price;
      let price = isDiscountActive ? rawPrice * (1 - discountRate) : rawPrice;
      const minLegalPrice = 9 / (1 - commission / 100);
      price = Math.round(Math.max(price, minLegalPrice) * 100) / 100;
      const platformFee = Math.round(price * commission) / 100;
      finalEstimates[type] = {
        total: price, estimatedTotal: price, originalTotal: rawPrice,
        platformFee, driverEarnings: Math.round((price-platformFee)*100)/100,
        uberProduct: aiNames[type], isUberPrice: false, isAiPrice: true,
        priceSource: "ai", predictionSamples: prediction.samples,
        discountRate: isDiscountActive ? discountRate : 0,
      };
      aiUsed = true;
    }
  }
  // Fail closed: no invented fixed-grid fares if Uber and AI cannot price a category.
  if (!Object.keys(finalEstimates).length) {
    throw new Error("Tarifs indisponibles : Uber ne répond pas et le modèle IA ne dispose pas encore de données suffisantes pour cette catégorie.");
  }
  return { route, estimates: finalEstimates, source: aiUsed ? (Object.values(finalEstimates).some(x=>x.isUberPrice) ? "mixed" : "ai") : "uber", pricingMode: mode };

}

export async function handleVtc(input, context) {
  const { path, method = "GET", body = {} } = input;
  const url = new URL(path, "http://app");
  const p = url.pathname;
  const q = url.searchParams;
  const db = context.supabase,
    uid = context.userId;
  const roles = required(await db.from("user_roles").select("role").eq("user_id", uid));
  const role = roles.some((r) => r.role === "admin")
    ? "admin"
    : roles.some((r) => r.role === "driver")
      ? "driver"
      : "rider";
  const canDrive = roles.some((r) => r.role === "driver");
  if (p.startsWith("/api/admin/") && role !== "admin") throw new Error("Accès administrateur requis");
  if (p.startsWith("/api/drivers/me") && !canDrive) throw new Error("Accès chauffeur requis");
  // RLS has verified the role; privileged operations below use only the verified caller identity.
  const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
  const profile = required(await db.from("profiles").select("*").eq("id", uid).single());
  if (p === "/api/admin/chat-evidence") {
    if (method === "GET") return adminChatEvidence(admin, q);
    if (method === "POST") return handleAdminReportAction(admin, body);
    throw new Error("Méthode non autorisée");
  }

  if (p === "/api/admin/content-reports") {
    if (method === "GET") {
      const rows = required(await admin.from("contact_messages").select("id,topic,name,message,created_at,status")
        .in("topic", ["safety", "safety_reviewed"]).order("created_at", { ascending: false }).limit(200));
      return { reports: rows.flatMap((row) => {
        try {
          const item = JSON.parse(row.message);
          return item.type === "ride_chat_report_v1" ? [{ ...item, id: row.id, status: row.topic === "safety_reviewed" ? "reviewed" : "pending" }] : [];
        } catch { return []; }
      }) };
    }
    if (method === "POST") {
      const id = String(body.id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Signalement invalide");
      const rows = required(await admin.from("contact_messages").select("id,message").eq("id", id).eq("topic", "safety").limit(1));
      if (!rows.length) throw new Error("Signalement introuvable");
      let parsed;
      try { parsed = JSON.parse(rows[0].message); } catch { throw new Error("Signalement invalide"); }
      if (parsed.type !== "ride_chat_report_v1") throw new Error("Signalement invalide");
      required(await admin.from("contact_messages").update({ topic: "safety_reviewed" }).eq("id", id).eq("topic", "safety"));
      return { ok: true };
    }
    throw new Error("Méthode non autorisée");
  }
  if (p === "/api/admin/monitoring") {
    if (method !== "GET") throw new Error("Méthode non autorisée");
    const { readSiteActivity } = await import("./site-monitoring.server");
    return readSiteActivity(admin);
  }
  if (p === "/api/users/me/blocks") {
    if (method !== "GET") throw new Error("Méthode non autorisée");
    return { blocks: await listUserBlocks(admin, uid) };
  }
  if (p === "/api/users/me/export") {
    if (method !== "GET") throw new Error("Méthode non autorisée");
    const { page, until, from, to } = exportPageOptions(q);
    const driver =
      page === 0 && role === "driver"
        ? required(await db.from("drivers").select("*").eq("user_id", uid).maybeSingle())
        : undefined;
    const rows = required(
      await db
        .from("rides")
        .select("*")
        .or(`rider_id.eq.${uid},driver_id.eq.${uid}`)
        .lte("created_at", until)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    );
    const walletRows = required(
      await db
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", uid)
        .lte("created_at", until)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    );
    const documents =
      page === 0 && role === "driver"
        ? required(await db.from("driver_documents").select("*").eq("user_id", uid)).map(docShape)
        : undefined;
    const email = context.claims.email;
    const escapedEmail = String(email || "").replace(/[\\%_]/g, "\\$&");
    const supportByEmail = email
      ? required(
          await admin
            .from("contact_messages")
            .select("id,email,topic,message,status,created_at,resolved_at")
            .ilike("email", escapedEmail)
            .lte("created_at", until)
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to),
        )
      : [];
    const supportByUser = required(
      await admin
        .from("contact_messages")
        .select("id,email,topic,message,status,created_at,resolved_at")
        .eq("topic", "driver_conversation")
        .like("message", '%"userId":"' + uid + '"%')
        .lte("created_at", until)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    );
    const supportRows = [
      ...new Map(
        [...supportByEmail.slice(0, PERSONAL_DATA_PAGE_SIZE), ...supportByUser.slice(0, PERSONAL_DATA_PAGE_SIZE)].map(
          (row) => [row.id, row],
        ),
      ).values(),
    ].filter((row) => supportOwnedBy(row, uid, email));
    return {
      exportedAt: until,
      ...(page === 0
        ? {
            account: { email: email || "", role, consent: context.claims.user_metadata?.consent || null },
            profile,
            driver,
            documents,
          }
        : {}),
      rides: rows
        .slice(0, PERSONAL_DATA_PAGE_SIZE)
        .map(({ pin, offer_driver_id, offer_expires_at, declined, ...rest }) => rest),
      walletTransactions: walletRows.slice(0, PERSONAL_DATA_PAGE_SIZE),
      supportRequests: supportRows,
      pagination: {
        page,
        hasMore: [rows, walletRows, supportByEmail, supportByUser].some(
          (items) => items.length > PERSONAL_DATA_PAGE_SIZE,
        ),
      },
    };
  }
  if (p === "/api/users/me/driver-application") {
    if (method === "GET") {
      const { data, error } = await admin.from("driver_applications").select("status,created_at,reviewed_at").eq("user_id", uid).maybeSingle();
      if (error) throw new Error("Impossible de charger votre candidature.");
      return { application: data || null, canDrive };
    }
    if (method === "POST") {
      if (canDrive) throw new Error("Votre compte possède déjà un espace chauffeur.");
      // Enforce the same complete document acknowledgment on the server.
      const { REQUIRED_DOCUMENTS } = await import("./vtc-documents");
      const confirmed = Array.isArray(body.confirmedDocuments) ? body.confirmedDocuments : [];
      if (!REQUIRED_DOCUMENTS.every((spec) => confirmed.includes(spec.type)))
        throw new Error("Confirmez que vous possédez tous les documents obligatoires avant de candidater.");

      const { data: existing, error: readError } = await admin.from("driver_applications").select("status").eq("user_id", uid).maybeSingle();
      if (readError) throw new Error("Impossible de vérifier votre candidature.");
      if (existing) return { application: existing, alreadySubmitted: true };
      const { data, error } = await admin.from("driver_applications").insert({ user_id: uid, status: "pending" }).select("status,created_at").single();
      if (error?.code === "23505") return { application: { status: "pending" }, alreadySubmitted: true };
      if (error) throw new Error("Impossible d'envoyer la candidature.");
      return { application: data };
    }
    throw new Error("Méthode non autorisée");
  }
  if (p === "/api/admin/driver-applications") {
    if (method === "GET") {
      const { data, error } = await admin.from("driver_applications").select("user_id,status,created_at,reviewed_at").order("created_at", { ascending: false }).limit(200);
      if (error) throw new Error("Impossible de charger les candidatures.");
      const users = await Promise.all((data || []).map(async (application) => {
        const { data: person } = await admin.from("profiles").select("name,username,phone").eq("id", application.user_id).maybeSingle();
        const { data: auth } = await admin.auth.admin.getUserById(application.user_id);
        return { ...application, name: person?.name || "Client", username: person?.username || "", phone: person?.phone || "", email: auth?.user?.email || "" };
      }));
      return { applications: users };
    }
    if (method === "POST") {
      const target = String(body.userId || "");
      if (!/^[0-9a-f-]{36}$/i.test(target)) throw new Error("Client invalide");
      if (body.action === "accept") {
        const { error } = await admin.rpc("accept_driver_application", { p_user_id: target, p_admin_id: uid });
        if (error) throw new Error("Impossible d'accepter la candidature. Vérifiez que la migration et le profil chauffeur sont configurés.");
        return { ok: true };
      }
      if (body.action === "reject") {
        const { data, error } = await admin.from("driver_applications").update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: uid }).eq("user_id", target).eq("status", "pending").select("user_id");
        if (error || !data?.length) throw new Error("Candidature déjà traitée ou introuvable");
        return { ok: true };
      }
      throw new Error("Action invalide");
    }
    throw new Error("Méthode non autorisée");
  }
  if (p === "/api/users/me/mode") {
    if (method !== "POST") throw new Error("Méthode non autorisée");
    return switchAccountMode(admin, { uid, canDrive, mode: body.mode });
  }
  if (p === "/api/users/me/support") {
    if (method === "GET") return personalSupportRequests(admin, uid, context.claims.email, Number(q.get("page") || 0));
    if (method === "POST")
      return sendSupportMessage(admin, { uid, email: context.claims.email, name: profile.name, role, body });
    throw new Error("Méthode non autorisée");
  }
  if (p === "/api/users/me/deletion-request" && method === "POST") {
    // Suppression immédiate et autonome du compte (exigence Apple 5.1.1(v) et RGPD)
    // Fail closed before any irreversible Stripe operation. The database RPC
    // must enforce the same rules transactionally (see Supabase migration).
    const linkedChecks = [
      ["rides", "rider_id", ["accepted", "arrived", "in_progress"]],
      ["rides", "driver_id", ["accepted", "arrived", "in_progress"]],
    ];
    for (const [table, column, statuses] of linkedChecks) {
      const { data, error } = await admin.from(table).select("id").eq(column, uid).in("status", statuses).eq("is_test", false).limit(1);
      if (error) throw new Error(error.message);
      if (data.length) throw new Error("Une course est en cours. Terminez-la avant de supprimer le compte.");
    }
    // Financial records must be reviewed/archived before erasure, not silently
    // deleted with wallet transactions or profile CASCADE relationships.
    for (const [table, column] of [
      ["wallet_transactions", "user_id"],
      ["payouts", "driver_id"],
      ["withdrawal_requests", "driver_id"],
    ]) {
      const { data, error } = await admin.from(table).select("id").eq(column, uid).limit(1);
      if (error) throw new Error(error.message);
      if (data.length) throw new Error("Ce compte comporte des opérations financières à conserver. Contactez l'assistance pour finaliser la suppression.");
    }
    const { data: files, error: listError } = await admin.storage.from(DOCUMENTS_BUCKET).list(uid, { limit: 1000 });
    if (listError) throw new Error(listError.message);
    if ((files || []).length === 1000) throw new Error("Trop de documents à effacer automatiquement. Contactez l'assistance.");
    const { closeGoldBillingForDeletedAccount } = await import("./driver-gold.server");
    await closeGoldBillingForDeletedAccount(admin, uid);
    const removed = required(await admin.rpc("admin_delete_account", { _user: uid }));
    required(await admin.from("push_tokens").delete().eq("user_id", uid));
    required(
      await admin
        .from("contact_messages")
        .delete()
        .eq("topic", "driver_conversation")
        .like("message", '%"userId":"' + uid + '"%'),
    );
    if ((files || []).length) {
      const { error: removeError } = await admin.storage.from(DOCUMENTS_BUCKET).remove(files.map((f) => `${uid}/${f.name}`));
      if (removeError) throw new Error(removeError.message);
    }
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (error && !/not.?found/i.test(error.message))
      throw new Error(`Données effacées, mais l'accès au compte n'a pas pu être supprimé : ${error.message}`);
    return { ok: true, removed };
  }
  if (p === "/api/users/me/avatar") {
    if (method !== "POST") throw new Error("Méthode non autorisée");
    const { validProfileAvatar } = await import("./profile-avatar");
    if (!validProfileAvatar(body.avatar)) throw new Error("Photo invalide. Choisissez une image JPEG, PNG ou WebP.");
    required(await db.from("profiles").update({ avatar: body.avatar }).eq("id", uid));
    return { avatar: body.avatar };
  }
  if (p === "/api/users/me") {
    if (method === "PATCH") {
      const payload = {};
      for (const k of ["name", "phone", "username"])
        if (typeof body[k] === "string") payload[k] = body[k].slice(0, 100);
      required(await db.from("profiles").update(payload).eq("id", uid));
    }
    const fresh = required(await db.from("profiles").select("*").eq("id", uid).single());
    const mode = q.get("view") === "driver" && canDrive ? "driver" : "rider";
    const rating = await accountRating(admin, uid, mode);
    return { user: { ...profileShape(fresh, context.claims.email), rating, role, canDrive } };
  }
  if (p === "/api/geo/search") return geoSearch(q);
  if (p === "/api/maps/speed-cameras" && method === "GET") {
    requireCameraReader(role);
    return speedCameras(q.get("bbox"));
  }
  if (p === "/api/rides/estimate") {
    const quote = await estimates(admin, body.pickup, body.dropoff);
    const { favoriteForQuote } = await import("./private-clients.server");
    const favorite = await favoriteForQuote(admin, uid, validPoint(body.pickup), quote, {
      loadPool: () => dispatchPool(admin),
      routeBetween,
    }).catch(() => null);
    return { ...quote, favorite };
  }
  if (p === "/api/riders/me/favorite") {
    const pc = await import("./private-clients.server");
    if (method === "GET") return pc.favoriteCard(admin, uid);
    if (method === "POST") return pc.setFavorite(admin, db, uid, body);
    if (method === "DELETE") return pc.removeFavorite(db);
    throw new Error("Méthode non autorisée");
  }
  if (p === "/api/private-clients/redeem" && method === "POST") {
    const { redeemClaim } = await import("./private-clients.server");
    return redeemClaim(admin, db, uid, body.claimToken, body.confirmReplacement);
  }
  if (p === "/api/drivers/me/gold" && method === "GET") {
    return { gold: await loadDriverGold(admin, uid) };
  }
  if (p === "/api/drivers/me/gold" && method === "POST") {
    const { openGoldBilling } = await import("./driver-gold.server");
    try {
      return await openGoldBilling(admin, uid, body.manage === true);
    } catch {
      throw new Error("Impossible d’ouvrir la facturation StrasDrive Gold. Réessayez ou contactez le support.");
    }
  }
  if (p === "/api/drivers/me/private-clients" && method === "GET") {
    const { privateClients } = await import("./private-clients.server");
    return privateClients(admin, uid);
  }
  const privateClientAction = p.match(/^\/api\/drivers\/me\/private-clients\/([0-9a-f-]{36})$/i);
  if (privateClientAction) {
    if (!canDrive) throw new Error("Accès chauffeur requis");
    const riderId = privateClientAction[1];
    const { removePrivateClient, privateClients } = await import("./private-clients.server");
    if (method === "DELETE") return removePrivateClient(admin, uid, riderId);
    if (method === "POST") {
      const links = await privateClients(admin, uid);
      if (!links.clients.some((client) => client.id === riderId)) throw new Error("Client privé introuvable");
      return setUserBlock(admin, uid, riderId, body.blocked === true);
    }
    throw new Error("Méthode non autorisée");
  }
  if (p === "/api/drivers/me/private-clients/qr" && method === "POST") {
    const { createInvitation } = await import("./private-clients.server");
    return createInvitation(admin, uid);
  }
  if (p === "/api/drivers/me/discover" && method === "GET") {
    if (!(await loadDriverGold(admin, uid)).active) throw new Error("Le trafic est réservé à StrasDrive Gold.");
    return discoverBoard(q.get("day") || parisDay());
  }
  if (p === "/api/drivers/me/inbox" && method === "GET")
    return inboxForDriver(admin, uid, context.claims?.email, q.get("page"));
  if (p === "/api/drivers/me/inbox/support" && method === "DELETE")
    return hideDriverSupportThread(admin, {
      uid,
      email: context.claims?.email,
      id: body.id,
      expectedUpdatedAt: body.expectedUpdatedAt,
    });
  if (p === "/api/drivers/me/inbox/support" && method === "POST")
    return sendSupportMessage(admin, { uid, email: context.claims?.email, name: profile.name, role, body });
  if (p.startsWith("/api/drivers/me/road-alerts") || p.startsWith("/api/admin/road-alerts"))
    return roadAlerts(admin, { p, method, body, q, uid, isAdmin: role === "admin" });
  if (p === "/api/admin/support/reply" && method === "POST")
    return sendSupportMessage(admin, { uid, email: context.claims?.email, name: profile.name, role, body });
  if (p === "/api/drivers/me/achievements") {
    if (method !== "GET") throw new Error("Méthode non autorisée");
    const { driverAchievements } = await import("./driver-achievements");
    const [driverResult, trips, stars, rating] = await Promise.all([
      admin.from("drivers").select("vehicle").eq("user_id", uid).single(),
      admin
        .from("rides")
        .select("id", { count: "exact", head: true })
        .eq("driver_id", uid)
        .eq("status", "completed")
        .eq("is_test", false),
      admin
        .from("rides")
        .select("id", { count: "exact", head: true })
        .eq("driver_id", uid)
        .eq("status", "completed")
        .eq("is_test", false)
        .eq("rating->>byRider", "5")
        .lte("completed_at", new Date(Date.now() - 12 * 3600000).toISOString()),
      accountRating(admin, uid, "driver"),
    ]);
    required(driverResult);
    required(trips);
    required(stars);
    return {
      name: profile.name,
      avatar: profile.avatar,
      memberSince: profile.created_at,
      vehicle: { make: driverResult.data.vehicle?.make || "", model: driverResult.data.vehicle?.model || "" },
      completedTrips: trips.count || 0,
      rating,
      achievements: driverAchievements(stars.count || 0),
    };
  }
  if (p === "/api/drivers/me/ratings-unlock") {
    if (method !== "POST") throw new Error("Méthode non autorisée");
    const { claimRatingCelebration } = await import("./driver-rating-unlock.server");
    return claimRatingCelebration(admin, uid);
  }
  if (p === "/api/drivers/me/ratings") {
    if (method !== "GET") throw new Error("Méthode non autorisée");
    const { driverRatingSummary } = await import("./driver-rating-summary");
    const driver = required(await admin.from("drivers").select("is_priority,stats").eq("user_id", uid).single());
    const rows = required(
      await admin
        .from("rides")
        .select("rating")
        .eq("driver_id", uid)
        .eq("status", "completed")
        .eq("is_test", false)
        .not("rating->byRider", "is", null)
        .lte("completed_at", new Date(Date.now() - 12 * 3600000).toISOString())
        .order("completed_at", { ascending: false })
        .limit(500),
    );
    const summary = driverRatingSummary(rows, Boolean(driver.is_priority));
    return summary.locked ? summary : { ...summary, unlockAnimationSeen: Boolean(driver.stats?.ratingUnlockSeenAt) };
  }
  if (p === "/api/drivers/me/earnings") {
    const day = q.get("day") || parisDay();
    if (!validDay(day)) throw new Error("Date invalide");
    const range = driverWeekSummary([], day);
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const batch = required(
        await db
          .from("rides")
          .select("*")
          .eq("driver_id", uid)
          .eq("is_test", false)
          .eq("status", "completed")
          .gte("completed_at", range.fromUtc)
          .or(`accepted_at.lt.${range.toUtc},and(accepted_at.is.null,completed_at.lt.${range.toUtc})`)
          .order("completed_at", { ascending: false })
          .range(offset, offset + 499),
      );
      rows.push(...batch);
      if (batch.length < 500) break;
    }
    const driver = required(await db.from("drivers").select("stats").eq("user_id", uid).single());
    const onlineTime = await recordOnlineTime(admin, uid);
    const week = driverWeekSummary(rows, day);
    for (const row of week.byDay) row.onlineSeconds = onlineTime.days[row._id] || 0;
    week.onlineSeconds = week.byDay.reduce((sum, row) => sum + row.onlineSeconds, 0);
    const finishedThisWeek = rows.filter((ride) => {
      const completedDay = parisDay(ride.completed_at);
      return completedDay >= week.start && completedDay < week.end;
    });
    return {
      wallet: { balance: Number(profile.balance) },
      stats: driver.stats,
      today: week.today,
      week,
      recentRides: await Promise.all(
        finishedThisWeek
          .filter((ride) => parisDay(ride.completed_at) === day)
          .map((ride) => serialize(admin, ride, uid, true)),
      ),
    };
  }
  if (p === "/api/drivers/me/operator" && method === "PATCH") {
    const current = required(await admin.from("drivers").select("vehicle").eq("user_id", uid).single());
    const operator = sanitizeOperator(body.operator);
    if (!operator.legalName || !operator.address || !operator.phone)
      throw new Error("Renseignez la raison sociale, l’adresse et le téléphone de l’exploitant");
    required(
      await admin
        .from("drivers")
        .update({ vehicle: { ...(current.vehicle || {}), operator } })
        .eq("user_id", uid),
    );
    return { operator };
  }
  if (p === "/api/drivers/me/waybill" && method === "GET") {
    const driver = required(await admin.from("drivers").select("vehicle").eq("user_id", uid).single());
    const operator = sanitizeOperator(driver.vehicle?.operator);
    const rides = required(
      await admin
        .from("rides")
        .select("*")
        .eq("driver_id", uid)
        .in("status", ["accepted", "arrived", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1),
    );
    const ride = rides[0];
    if (!ride) return { document: null, operator };
    const client = required(await admin.from("profiles").select("name,phone").eq("id", ride.rider_id).single());
    const documents = required(
      await admin
        .from("driver_documents")
        .select("doc_type,document_number,status")
        .eq("user_id", uid)
        .in("doc_type", ["company", "vtc_register"]),
    );
    return { document: buildWaybill(ride, client, operator, documents), operator };
  }
  if (p === "/api/drivers/me") {
    if (method === "PATCH") {
      const cur = required(await db.from("drivers").select("vehicle_class,vehicle").eq("user_id", uid).single());
      // La gamme est attribuée par StrasDrive : le chauffeur ne peut pas la changer lui-même.
      const v = { ...(body.vehicle || {}), operator: cur.vehicle?.operator || {}, type: driverClass(cur) };
      if (!v.make || !v.model || !v.plate || !Number.isInteger(v.year) || v.year < 1990 || v.year > 2030)
        throw new Error("Vérifiez les informations du véhicule");
      required(await db.from("drivers").update({ vehicle: v }).eq("user_id", uid));
    }
    const driverRow = required(await db.from("drivers").select("*").eq("user_id", uid).single());
    const { getDriverDecisions } = await import("./driver-warnings.server");
    const { countActiveWarnings, shouldSuspendDriver } = await import("./driver-warnings");
    const decisions = await getDriverDecisions(admin, uid);
    const driver = driverShape(driverRow);
    driver.activeWarningsCount = countActiveWarnings(decisions);
    driver.isReportSuspended = !driver.isApproved && shouldSuspendDriver(decisions);
    return { driver };
  }
  if (p === "/api/drivers/me/classes" && method === "PATCH") {
    const cur = required(await db.from("drivers").select("vehicle_class").eq("user_id", uid).single());
    const own = driverClass(cur);
    const wanted = Array.isArray(body.acceptsClasses) ? body.acceptsClasses : [];
    if (wanted.some((c) => !(LOWER_CLASSES[own] || []).includes(c)))
      throw new Error("Vous ne pouvez accepter que des courses de gamme inférieure autorisée pour votre véhicule");
    required(
      await admin
        .from("drivers")
        .update({ accepts_classes: sanitizeAcceptedClasses(own, wanted) })
        .eq("user_id", uid),
    );
    return { driver: driverShape(required(await db.from("drivers").select("*").eq("user_id", uid).single())) };
  }
  if (p === "/api/drivers/me/push-token" || p === "/api/notifications/push-token") {
    if (!canDrive && role !== "admin") throw new Error("Accès refusé");
    if (!["POST", "DELETE"].includes(method)) throw new Error("Méthode non autorisée");
    // Phone notification address: written only by the server, one owner per phone.
    const token = validPushToken(body.token);
    if (!token) throw new Error("Notification invalide");
    if (method === "DELETE") {
      required(await admin.from("push_tokens").delete().eq("token", token).eq("user_id", uid));
      return { ok: true };
    }
    const platform = ["android", "ios", "web"].includes(body.platform) ? body.platform : "android";
    required(
      await admin
        .from("push_tokens")
        .upsert({ token, user_id: uid, platform, updated_at: new Date().toISOString() }, { onConflict: "token" }),
    );
    return { ok: true };
  }
  if (p === "/api/drivers/me/preferences" && method === "PATCH") {
    // Préférences de course : écrites uniquement par le serveur, après nettoyage.
    const cur = required(await db.from("drivers").select("trip_prefs").eq("user_id", uid).single());
    const next = sanitizeTripPrefs({ ...tripPrefsOf(cur), ...(body.tripPrefs || {}) });
    required(await admin.from("drivers").update({ trip_prefs: next }).eq("user_id", uid));
    return { driver: driverShape(required(await db.from("drivers").select("*").eq("user_id", uid).single())) };
  }
  if (p === "/api/drivers/me/documents") {
    if (method === "POST") {
      const spec = documentSpec(body.type);
      if (!spec) throw new Error("Type de document inconnu");
      const fields = validateDocumentInput(body.type, body);
      const path = String(body.path || "");
      if (!privateDocumentPath(path, uid)) throw new Error("Fichier invalide");
      const check = await admin.storage.from(DOCUMENTS_BUCKET).createSignedUrl(path, 10);
      if (check.error) throw new Error("Fichier introuvable, renvoyez-le");
      const previous = required(
        await admin
          .from("driver_documents")
          .select("file_path")
          .eq("user_id", uid)
          .eq("doc_type", spec.type)
          .maybeSingle(),
      );
      required(
        await admin.from("driver_documents").upsert(
          {
            user_id: uid,
            doc_type: spec.type,
            file_path: path,
            file_name: String(body.fileName || "").slice(0, 150),
            ...fields,
            status: "pending",
            rejection_reason: "",
            uploaded_at: new Date().toISOString(),
            reviewed_at: null,
          },
          { onConflict: "user_id,doc_type" },
        ),
      );
      // Le document remplacé est supprimé immédiatement (minimisation RGPD).
      if (previous && previous.file_path !== path)
        await admin.storage.from(DOCUMENTS_BUCKET).remove([previous.file_path]);
    }
    const docs = required(await db.from("driver_documents").select("*").eq("user_id", uid));
    const c = driverCompliance(docs);
    return { documents: docs.map(docShape), compliance: { ...c, problem: complianceProblem(c) } };
  }
  if (p === "/api/drivers/me/online-time") {
    if (!canDrive || method !== "POST") throw new Error("Accès refusé");
    await recordOnlineTime(admin, uid);
    return { ok: true };
  }
  if (p === "/api/drivers/me/status") {
    if (method !== "POST") throw new Error("Méthode non autorisée");
    if (typeof body.online !== "boolean") throw new Error("Statut invalide");
    const d = required(await db.from("drivers").select("*").eq("user_id", uid).single());
    const current = required(await db.from("rides").select("id").eq("driver_id", uid).in("status", active));
    if (!body.online && current.length) throw new Error("Terminez votre course avant de passer hors ligne");
    if (body.online) {
      if (await hasPassengerRide(admin, uid)) throw new Error("Vous avez une course passager en cours");
      if (!d.is_approved) {
        if ((await reportedRideCount(admin, uid)) >= 3)
          throw new Error(
            "Votre activité chauffeur est suspendue à cause de plusieurs signalements. Contactez l’assistance.",
          );
        throw new Error("Votre inscription doit être approuvée");
      }
      if (!d.vehicle.plate) throw new Error("Ajoutez votre véhicule");
      if (!d.documents_override) {
        const dc = driverCompliance(
          required(await db.from("driver_documents").select("doc_type,status,valid_until").eq("user_id", uid)),
        );
        if (!dc.canDrive) throw new Error(`${complianceProblem(dc)} — mettez à jour vos documents dans votre profil`);
      }
      if (Number(profile.balance) < -25) throw new Error("Régularisez votre solde avant de passer en ligne");
      if (!validLocation(body.location)) throw new Error("Position invalide");
    }
    await recordOnlineTime(admin, uid, {
      online: body.online,
      patch: {
        is_online: body.online,
        location: body.online ? body.location : null,
        updated_at: new Date().toISOString(),
      },
    });
    return { ok: true };
  }
  if (p === "/api/drivers/location") {
    if (!canDrive) throw new Error("Accès refusé");
    if (method !== "POST") throw new Error("Méthode non autorisée");
    if (!validLocation(body)) throw new Error("Position invalide");
    const driver = required(await db.from("drivers").select("is_online").eq("user_id", uid).single());
    const ongoing = required(await db.from("rides").select("id").eq("driver_id", uid).in("status", active));
    if (!driver.is_online && !ongoing.length) return { ok: true, ignored: true };
    await recordOnlineTime(admin, uid);
    required(
      await db
        .from("drivers")
        .update({
          location: {
            lat: body.lat,
            lng: body.lng,
            heading: Number.isFinite(body.heading) ? ((body.heading % 360) + 360) % 360 : null,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", uid),
    );
    return { ok: true };
  }
  if (p === "/api/drivers/nearby") {
    const ds = await dispatchPool(admin);
    const lat = parseFloat(q.get("lat")),
      lng = parseFloat(q.get("lng"));
    const at = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    return {
      drivers: ds.filter((d) => d.location).map((d) => ({ id: d.id, location: d.location })),
      availability: availabilityByClass(ds, at),
    };
  }
  if (p === "/api/wallet") {
    if (method === "POST") throw new Error("Les recharges nécessitent un paiement Stripe vérifié.");
    const tx = required(
      await db
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(100),
    );
    return {
      wallet: { balance: Number(profile.balance), currency: "EUR" },
      transactions: tx.map((t) => ({
        ...t,
        _id: t.id,
        amount: Number(t.amount),
        balanceAfter: Number(t.balance_after),
        createdAt: t.created_at,
      })),
      stripeEnabled: Boolean(process.env.STRIPE_SANDBOX_API_KEY || process.env.STRIPE_LIVE_API_KEY),
    };
  }
  if (p === "/api/drivers/me/payouts" || p === "/api/admin/withdrawals") {
    const { handlePayments } = await import("./vtc-payments.server");
    return handlePayments({ admin, profile, uid, role, p, q, method, body });
  }
  // Validated live quote for a booking (shared by wallet/cash booking and card checkout).
  const quoteRide = async (b) => {
    if (!DEFAULT_PRICING[b.vehicleType]) throw new Error("Gamme invalide");
    const quote = await estimates(admin, b.pickup, b.dropoff);
    const fare = quote.estimates[b.vehicleType];
    if (!fare) throw new Error("Tarif indisponible pour cette gamme, réessayez");
    if (quote.route.distanceMeters < 100) throw new Error("Le trajet doit faire au moins 100 m");
    return { fare, route: quote.route };
  };
  // "Book my favorite driver": the server picks the driver and his class; the ride is first offered to him alone.
  const resolveFavorite = async () => {
    const { favoriteBooking } = await import("./private-clients.server");
    return favoriteBooking(admin, uid, await dispatchPool(admin));
  };
  const createRide = async ({ vehicleType, pickup, dropoff, route, fare, payment, favoriteDriverId = null }) => {
    await preparePassengerBooking(admin, uid, canDrive);
    const pin = String(crypto.getRandomValues(new Uint32Array(1))[0] % 10000).padStart(4, "0");
    // Note moyenne laissée par les chauffeurs, figée à la commande (filtre « note minimale » des chauffeurs).
    const past = required(
      await admin
        .from("rides")
        .select("rating")
        .eq("rider_id", uid)
        .eq("status", "completed")
        .eq("is_test", false)
        .order("completed_at", { ascending: false })
        .limit(200),
    );
    const riderRating = riderAverage(past.map((x) => x.rating?.byDriver).filter((n) => n != null));
    const r = required(
      await admin
        .from("rides")
        .insert({
          rider_id: uid,
          vehicle_type: vehicleType,
          pickup,
          dropoff,
          route,
          fare,
          pin,
          payment,
          rider_rating: riderRating,
          favorite_driver_id: favoriteDriverId,
        })
        .select("*")
        .single(),
    );
    await assignOffer(admin, r);
    return serialize(admin, r, uid);
  };
  if (p === "/api/wallet/checkout" || p === "/api/rides/card-checkout" || p === "/api/rides/card-confirm") {
    const { handleCheckout } = await import("./vtc-checkout.server");
    return handleCheckout({
      admin,
      uid,
      role,
      email: context.claims?.email,
      p,
      q,
      method,
      body,
      quoteRide,
      createRide,
      resolveFavorite,
      preparePassenger: () => preparePassengerBooking(admin, uid, canDrive),
      cardBookingProblem: (fare) => bookingPaymentProblem("card", profile.balance, fare.total),
      serializeRide: async (id) =>
        serialize(admin, required(await admin.from("rides").select("*").eq("id", id).single()), uid),
    });
  }
  if (p === "/api/rides" && method === "POST") {
    await preparePassengerBooking(admin, uid, canDrive);
    const paymentMethod = paymentMethodOf(body.paymentMethod);
    if (paymentMethod === "card") throw new Error("Le paiement par carte se fait depuis l’écran de paiement sécurisé");
    const favorite = body.favorite === true ? await resolveFavorite() : null;
    const vehicleType = favorite ? favorite.vehicleType : body.vehicleType;
    const { fare, route } = await quoteRide({ ...body, vehicleType });
    const payProblem = bookingPaymentProblem(paymentMethod, profile.balance, fare.total);
    if (payProblem) throw new Error(payProblem);
    const ride = await createRide({
      vehicleType,
      pickup: body.pickup,
      dropoff: body.dropoff,
      route,
      fare,
      payment: { method: paymentMethod },
      favoriteDriverId: favorite?.driverId || null,
    });
    return { ride };
  }
  if (p === "/api/rides/active") {
    const list = required(
      await db
        .from("rides")
        .select("*")
        .eq(rideOwnerColumn(role, q.get("view"), canDrive), uid)
        .in("status", active)
        .limit(1),
    );
    const r = list[0];
    if (r?.status === "searching") {
      const fresh = await assignOffer(admin, r);
      return { ride: fresh.status === "no_drivers" ? null : await serialize(admin, fresh, uid) };
    }
    return { ride: await serialize(admin, r, uid) };
  }
  if (p === "/api/drivers/offers") {
    if (!canDrive) throw new Error("Accès refusé");
    if (await hasPassengerRide(admin, uid)) return { offer: null };
    const pool = await dispatchPool(admin);
    let me = pool.find((d) => d.user_id === uid);
    const test = await pendingTestOffer(admin, uid);
    const rs = required(
      await admin.from("rides").select("*").eq("status", "searching").eq("is_test", false).limit(100),
    );
    if (
      me &&
      rs.some(
        (ride) =>
          (ride.dispatch_phase === "private" && ride.offer_driver_id === uid) ||
          (!ride.dispatch_phase && ride.favorite_driver_id === uid),
      )
    ) {
      me = await withDriverGold(admin, me);
    }
    const fresh = [];
    for (const r of rs) fresh.push(await assignOffer(admin, r, pool));
    const goldPool = fresh.some((ride) => ride.route?.goldReturn && ride.status === "searching")
      ? await goldDispatchPool(admin, pool)
      : pool;
    const goldMe = goldPool.find((driver) => driver.user_id === uid);
    let r = fresh
      .filter((ride) =>
        ride.route?.goldReturn
          ? canSeeOffer(ride, goldMe, Date.now(), goldPool)
          : canSeeOffer(ride, me, Date.now(), pool),
      )
      .sort((a, b) => distanceToPickupKm(a, me) - distanceToPickupKm(b, me))[0];
    if (r && await isPairBlocked(admin, r.rider_id, uid)) r = null;
    if (test) {
      r = test.ride;
      me = me || test.driver;
    }
    if (!r) return { offer: null };
    const offerFare =
      !r.is_test && (await hasPaidDriverGold(admin, uid).catch(() => false)) ? waiveGoldCommission(r.fare) : r.fare;
    const approachKm = distanceToPickupKm(r, me),
      approachMeters = Number.isFinite(approachKm) ? Math.round(approachKm * 1350) : null;
    let profit = null;
    if (me.is_priority && approachMeters != null) {
      const approachSeconds = approachSecondsFor(approachMeters),
        tripSeconds = r.route.durationSeconds || 0;
      const expected = settleDriverEarnings(
        offerFare,
        r.route.distanceMeters,
        approachSeconds + tripSeconds,
      ).driverEarnings;
      profit = {
        ...profitability(expected, approachSeconds, tripSeconds),
        expectedEarnings: expected,
        approachSeconds: Math.round(approachSeconds),
      };
    }
    const rider = required(await admin.from("profiles").select("name").eq("id", r.rider_id).single());
    return {
      offer: {
        airportReturn: r.route.goldReturn || null,
        rideId: r.id,
        pickup: r.pickup,
        dropoff: r.dropoff,
        rider: { ...rider, name: passengerDisplayName(rider.name) },
        earnings: offerFare.driverEarnings,
        distanceMeters: r.route.distanceMeters,
        durationSeconds: r.route.durationSeconds,
        routeQuality: routeQualityLabel(r.route),
        routeGeometry: r.route?.geometry || null,
        surgeMultiplier: r.fare.surgeMultiplier,
        expiresInSeconds: Math.max(0, Math.ceil((new Date(r.offer_expires_at) - Date.now()) / 1000)),
        ownClass: driverClass(me),
        lowerClass: isLowerClassRide(me, r.vehicle_type),
        distanceToPickupMeters: approachMeters ?? 0,
        etaMinutes: approachMeters == null ? 1 : Math.max(1, Math.round(approachSecondsFor(approachMeters) / 60)),
        profitability: profit,
        isTest: Boolean(r.is_test),
        testPin: r.is_test ? r.pin : undefined,
        paymentMethod: paymentMethodOf(r.payment?.method),
        total: r.fare.total,
        phase: r.dispatch_phase,
        isPriority: Boolean(me.is_priority),
        isNearest: r.offer_driver_id === me.user_id || !r.offer_driver_id,
        rideClass: r.vehicle_type,
      },
    };
  }
  const recordMatch = p.match(/^\/api\/admin\/rides\/([0-9a-f-]+)\/record$/i);
  if (recordMatch) {
    if (method !== "GET") throw new Error("Méthode non autorisée");
    const { adminRideRecord } = await import("./admin-ride-record.server");
    return adminRideRecord(admin, recordMatch[1], role, uid);
  }
  if (p === "/api/admin/rides") {
    if (role !== "admin") throw new Error("Accès administrateur requis");
    const { adminRideList } = await import("./admin-ride-list.server");
    return adminRideList(admin, uid, q, (r) => serialize(admin, r, uid, true));
  }
  if (p === "/api/rides" || p === "/api/admin/rides") {
    const page = Math.max(1, Number(q.get("page")) || 1),
      limit = Math.min(100, Math.max(1, Number(q.get("limit")) || 15));
    let query = (role === "admin" ? admin : db)
      .from("rides")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });
    if (p !== "/api/admin/rides") query = query.eq(rideOwnerColumn(role, q.get("view"), canDrive), uid);
    if (q.get("status")) query = query.eq("status", q.get("status"));
    if (p === "/api/admin/rides" && q.get("day")) {
      const { adminRideDateRange } = await import("./admin-ride-record");
      const range = adminRideDateRange(q.get("day"));
      query = query.gte("created_at", range.from).lt("created_at", range.to);
    }
    const res = await query.range((page - 1) * limit, page * limit - 1);
    const rows = required(res);
    return {
      rides: await Promise.all(rows.map((r) => serialize(admin, r, uid, true))),
      pagination: { page, pages: Math.ceil(res.count / limit), total: res.count },
    };
  }
  const match = p.match(/^\/api\/rides\/([^/]+)(?:\/(\w+))?$/);
  if (match) {
    const [, id, action] = match;
    assertRideActionMethod(action, method);
    const r = required(await admin.from("rides").select("*").eq("id", id).single());
    const participant = r.rider_id === uid || r.driver_id === uid;
    if (action === "accept") {
      if (!r.is_test && await isPairBlocked(admin, r.rider_id, uid)) throw new Error("Cette mise en relation est indisponible.");
      if (r.status === "searching" && (r.messages || []).length)
        await closeRideChat(admin, id, { allowSearching: true });
      const approval = required(await admin.from("drivers").select("is_approved").eq("user_id", uid).single());
      if (!approval.is_approved && (await reportedRideCount(admin, uid)) >= 3)
        throw new Error(
          "Votre activité chauffeur est suspendue à cause de plusieurs signalements. Contactez l’assistance.",
        );
      if (!canDrive || r.rider_id === uid || (await hasPassengerRide(admin, uid)))
        throw new Error("Vous ne pouvez pas accepter cette course");
      if (r.is_test) {
        if (
          !canDrive ||
          r.status !== "searching" ||
          r.offer_driver_id !== uid ||
          !r.offer_expires_at ||
          new Date(r.offer_expires_at).getTime() <= Date.now()
        )
          throw new Error("Cette demande n’est plus disponible");
      } else {
        const available = await dispatchPool(admin);
        const pool = r.route?.goldReturn ? await goldDispatchPool(admin, available) : available;
        const candidate = pool.find((d) => d.user_id === uid) || null;
        const me =
          r.dispatch_phase === "private" && !r.route?.goldReturn ? await withDriverGold(admin, candidate) : candidate;
        if (!canSeeOffer(r, me, Date.now(), pool)) throw new Error("Cette demande n’est plus disponible");
      }
      const fare = !r.is_test && (await hasPaidDriverGold(admin, uid)) ? waiveGoldCommission(r.fare) : r.fare;
      const claim = admin
        .from("rides")
        .update({
          fare,
          driver_id: uid,
          status: "accepted",
          accepted_at: new Date().toISOString(),
          offer_driver_id: null,
          offer_expires_at: null,
        })
        .eq("id", id)
        .eq("status", "searching")
        .eq("dispatch_phase", r.dispatch_phase)
        .eq("offer_expires_at", r.offer_expires_at)
        .gt("offer_expires_at", new Date().toISOString());
      // En phase nearest, le plus proche peut accepter tout de suite ;
      // les autres peuvent accepter si le délai de priorité de 4 s est écoulé

      const claimed = required(await claim.select("*"))[0];
      if (!claimed) throw new Error("Course déjà acceptée");
      return { ride: await serialize(admin, claimed, uid) };
    }
    if (action === "decline") {
      if (!canDrive) throw new Error("Accès refusé");
      required(await admin.rpc("decline_ride_offer", { _ride: id, _driver: uid }));
      return { ok: true };
    }
    if (!participant && role !== "admin") throw new Error("Course inaccessible");
    if (!action) return { ride: await serialize(admin, r, uid) };
    if (action === "report") {
      driverReportMessage(r, uid, body);
      if (!context.claims.email) throw new Error("Une adresse e-mail de compte est nécessaire");
      await preserveRideChat(admin, id, uid);
      return sendDriverReport(admin, { ride: r, uid, email: context.claims.email, name: profile.name, body });
    }
    if (action === "invoice") {
      const message = invoiceRequestMessage(r, uid, role);
      const email = context.claims.email;
      if (!email) throw new Error("Une adresse e-mail de compte est nécessaire");
      // Existing support storage provides an authenticated, persistent request without issuing a fiscal document.
      const previous = required(
        await admin
          .from("contact_messages")
          .select("id")
          .eq("email", email)
          .eq("topic", "payments")
          .eq("message", message)
          .limit(1),
      );
      if (!previous.length)
        required(
          await admin.from("contact_messages").insert({
            name: profile.name || "Utilisateur",
            email,
            topic: "payments",
            message,
          }),
        );
      return {
        ok: true,
        message: "Votre demande de facture a été transmise à l’assistance. Aucune facture n’a encore été émise.",
      };
    }
    if (action === "radars" && method === "GET") {
      requireCameraReader(role);
      if (r.driver_id !== uid) throw new Error("Accès refusé");
      if (!["accepted", "in_progress"].includes(r.status)) return { cameras: [], available: false };
      const route = await liveRoute(admin, r);
      const geometry = route?.geometry || (r.status === "in_progress" ? r.route?.geometry : null);
      const bounds = routeBounds(geometry);
      if (!bounds) return { cameras: [], available: false };
      const [west, south, east, north] = bounds;
      const result = await routeCameras(geometry);
      const reported = required(
        await admin
          .from("road_alerts")
          .select("*")
          .eq("kind", "radar")
          .gte("lng", west)
          .lte("lng", east)
          .gte("lat", south)
          .lte("lat", north),
      );
      return { ...result, cameras: radarsOnRoute(mergeCameraAlerts(reported, result.cameras), geometry) };
    }
    if (action === "route") {
      if (!participant) throw new Error("Accès refusé");
      return { route: await liveRoute(admin, r) };
    }
    if (action === "arrive" || action === "start" || action === "complete") {
      const previous = { arrive: "accepted", start: "arrived", complete: "in_progress" }[action];
      if (r.driver_id !== uid || r.status !== previous) throw new Error("Action non autorisée");
      if (action === "arrive" || (action === "start" && !r.is_test)) {
        const loc = required(await admin.from("drivers").select("location").eq("user_id", uid).single()).location;
        const zone =
          action === "arrive"
            ? pickupZoneProblem(loc, r.pickup, ARRIVAL_ZONE_METERS)
            : pickupZoneProblem(loc, r.pickup);
        if (zone) throw new Error(zone);
      }
      if (action === "start" && body.pin !== r.pin) throw new Error("Code PIN incorrect");
      if (action === "complete" && r.is_test) {
        required(
          await admin
            .from("rides")
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("id", id)
            .eq("status", "in_progress"),
        );
      } else if (action === "complete") {
        const since = new Date(r.accepted_at || r.arrived_at || r.created_at).getTime();
        const activitySeconds = Math.max(0, (Date.now() - since) / 1000);
        const fare = settleDriverEarnings(r.fare, r.route.distanceMeters, activitySeconds);
        required(await admin.from("rides").update({ fare }).eq("id", id).eq("status", "in_progress"));
        required(await admin.rpc("settle_ride", { _id: id, _actor: uid }));
      } else
        required(
          await admin
            .from("rides")
            .update({
              status: action === "arrive" ? "arrived" : "in_progress",
              ...(action === "arrive" ? { arrived_at: new Date().toISOString() } : {}),
            })
            .eq("id", id)
            .eq("status", previous),
        );
    } else if (action === "cancel") {
      if (!participant || !["searching", "accepted", "arrived"].includes(r.status))
        throw new Error("Annulation impossible");

      // ── A. Le CHAUFFEUR annule (remise en recherche + mémorisation du motif) ──
      if (r.driver_id === uid) {
        required(
          await admin
            .from("rides")
            .update({
              status: "searching",
              driver_id: null,
              offer_driver_id: null,
              offer_expires_at: null,
              dispatch_phase: null,
              accepted_at: null,
              fare: restoreGoldCommission(r.fare),
              declined: [...r.declined, uid],
            })
            .eq("id", id)
            .eq("status", r.status),
        );
      } else {
        // ── B. Le CLIENT annule ──
        const patch = {
          status: "cancelled",
          offer_driver_id: null,
        };

        // Vérification anti-fraude : le chauffeur était-il immobile ou en mauvaise direction ?
        const driverLoc = r.driver_id
          ? (await admin.from("drivers").select("location").eq("user_id", r.driver_id).single()).data?.location
          : null;
        const progress = evaluateDriverProgress(r, driverLoc);

        // Frais d'annulation de 3 € uniquement si le chauffeur est arrivé ET n'est pas en faute
        if (
          r.status === "arrived" &&
          !r.is_test &&
          paymentMethodOf(r.payment?.method) !== "cash" &&
          !progress.canCancelFree
        ) {
          required(await admin.rpc("wallet_entry", { _user: uid, _amount: -3, _type: "cancellation_fee", _ride: id }));
          if (r.driver_id)
            required(
              await admin.rpc("wallet_entry", { _user: r.driver_id, _amount: 2.76, _type: "ride_earning", _ride: id }),
            );
          patch.fare = { ...r.fare, cancellationFee: 3 };
        }
        required(await admin.from("rides").update(patch).eq("id", id).eq("status", r.status));
      }
    } else if (action === "block" || action === "unblock") {
      if (!participant || !r.driver_id) throw new Error("Accès refusé");
      const otherId = r.rider_id === uid ? r.driver_id : r.rider_id;
      return setUserBlock(admin, uid, otherId, action === "block");
    } else if (action === "report-message") {
      if (!participant || !r.driver_id) throw new Error("Accès refusé");
      const msg = visibleChatMessages(r.messages).find((m) => m.id === body.messageId);
      if (!msg || msg.from === (r.rider_id === uid ? "rider" : "driver")) throw new Error("Message introuvable");
      const reason = String(body.reason || "Contenu abusif").trim().slice(0, 200);
      if (!reason) throw new Error("Motif nécessaire");
      const reporter = r.rider_id === uid ? "passager" : "chauffeur";
      const report = JSON.stringify({ type: "ride_chat_report_v1", rideId: r.id, messageId: msg.id, messageType: msg.type, reporterId: uid, reportedUserId: r.rider_id === uid ? r.driver_id : r.rider_id, reason, createdAt: new Date().toISOString() });
      if (CHAT_ACTIVE_STATUSES.includes(r.status)) await preserveRideChat(admin, r.id, uid);
      required(await admin.from("contact_messages").insert({ topic: "safety", name: `Signalement chat ${r.id}`, email: context.claims.email || profile.email || "support@strasdrive.invalid", message: report }));
      return { ok: true };
    } else if (action === "attachment") {
      if (!participant) throw new Error("Accès refusé");
      await sendChatAttachment(admin, r, uid, body);
    } else if (action === "media") {
      return chatFileUrl(admin, r, uid, q.get("messageId"));
    } else if (action === "messages") {
      if (!participant || !CHAT_ACTIVE_STATUSES.includes(r.status)) throw new Error("Discussion fermée");
      if (method === "GET") return { messages: visibleChatMessages(r.messages) };
      await sendChatMessage(admin, r, uid, body);
    } else if (action === "rate") {
      if (r.is_test && participant && r.status === "completed") return { ride: await serialize(admin, r, uid) };
      if (
        !participant ||
        r.status !== "completed" ||
        !Number.isInteger(body.rating) ||
        body.rating < 1 ||
        body.rating > 5
      )
        throw new Error("Note invalide");
      const field = r.rider_id === uid ? "byRider" : "byDriver";
      if (r.rating[field]) throw new Error("Course déjà notée");
      required(
        await admin
          .from("rides")
          .update({
            rating: {
              ...r.rating,
              [field]: body.rating,
              [field === "byRider" ? "riderComment" : "driverComment"]: String(body.comment || "").slice(0, 500),
            },
          })
          .eq("id", id),
      );
    } else throw new Error("Action inconnue");
    if (action === "cancel") await closeRideChat(admin, id, { allowSearching: true });
    return { ride: await serialize(admin, required(await admin.from("rides").select("*").eq("id", id).single()), uid) };
  }
  if (p === "/api/admin/test-ride" && method === "POST") {
    // Fictitious ride sent to one chosen driver only, to test the request notification. No payment, no stats.
    const d = required(await admin.from("drivers").select("*").eq("id", body.driverId).maybeSingle());
    if (!d) throw new Error("Chauffeur introuvable");
    if (
      required(
        await admin
          .from("rides")
          .select("id")
          .eq("driver_id", d.user_id)
          .in("status", ["accepted", "arrived", "in_progress"]),
      ).length
    )
      throw new Error("Ce chauffeur est déjà en course");
    required(
      await admin
        .from("rides")
        .update({ status: "cancelled", dispatch_phase: null, offer_driver_id: null, offer_expires_at: null })
        .eq("is_test", true)
        .eq("status", "searching")
        .eq("offer_driver_id", d.user_id),
    );
    const at = d.location && Number.isFinite(d.location.lat) && Number.isFinite(d.location.lng) ? d.location : null;
    const pickup = at
      ? { lat: at.lat + 0.005, lng: at.lng + 0.004, address: "Point de prise en charge test (à ~600 m)" }
      : { ...TEST_PICKUP };
    const dropoff = at
      ? { lat: at.lat - 0.012, lng: at.lng + 0.022, address: "Destination test (à ~2 km)" }
      : { ...TEST_DROPOFF };
    const cls = driverClass(d);
    const quote = await estimates(admin, pickup, dropoff);
    const r = required(
      await admin
        .from("rides")
        .insert({
          rider_id: uid,
          vehicle_type: cls,
          pickup,
          dropoff,
          route: quote.route,
          fare: quote.estimates[cls],
          pin: TEST_PIN,
          is_test: true,
          dispatch_phase: "nearest",
          offer_driver_id: d.user_id,
          offer_expires_at: new Date(Date.now() + TEST_OFFER_SECONDS * 1000).toISOString(),
        })
        .select("id")
        .single(),
    );
    const testRide = required(await admin.from("rides").select("*").eq("id", r.id).single());
    await pushRideOffer(admin, testRide, [d.user_id]);
    return { ok: true, rideId: r.id, expiresInSeconds: TEST_OFFER_SECONDS, driverOnline: Boolean(d.is_online) };
  }
  if (p === "/api/admin/uber-benchmark") {
    if (method !== "GET") throw new Error("Méthode non autorisée");
    const { benchmarkStatus } = await import("./vtc-uber-benchmark.server");
    return benchmarkStatus(admin);
  }
  if (p === "/api/admin/pricing-ai-compare") {
    if (method !== "POST") throw new Error("Méthode non autorisée");
    const { compareRandomUberAi } = await import("./vtc-pricing-learning.server");
    return compareRandomUberAi(admin,{maxDistanceKm:Number(body.maxDistanceKm)});
  }
  if (p === "/api/admin/pricing-ai-observations") {
    if (method !== "GET") throw new Error("Méthode non autorisée");
    const { learningObservationsPage } = await import("./vtc-pricing-learning.server");
    return learningObservationsPage(admin, {
      offset: Number(q.get("offset") || 0),
      limit: Number(q.get("limit") || 500),
    });
  }
  if (p === "/api/admin/pricing-source") {
    if (method === "GET") {
      const row = required(await admin.from("pricing_rules").select("rule").eq("vehicle_type","pricing_source_mode").maybeSingle());
      return { mode: row?.rule?.mode || "auto" };
    }
    if (method === "PUT") {
      const mode = String(body.mode || "");
      if (!["auto","uber","ai"].includes(mode)) throw new Error("Mode de tarification invalide");
      required(await admin.from("pricing_rules").upsert({
        vehicle_type:"pricing_source_mode", is_active:false,
        rule:{mode,updatedAt:new Date().toISOString()}
      },{onConflict:"vehicle_type"}));
      return {ok:true,mode};
    }
    throw new Error("Méthode non autorisée");
  }
  if (p === "/api/admin/pricing-ai") {
    const { learningStatus, runLearningSample, predictLearnedPrice } = await import("./vtc-pricing-learning.server");
    if (method === "GET") return learningStatus(admin);
    if (method === "PUT") {
      const radiusKm = Math.max(1, Math.min(200, Number(body.radiusKm) || 100));
      const enabled = body.enabled === true;
      const requestedRate = Number(body.testsPerSecond ?? 0.2);
      if (!Number.isFinite(requestedRate) || requestedRate <= 0) throw new Error("La cadence doit être un nombre positif");
      required(await admin.from("pricing_rules").upsert({
        vehicle_type: "uber_ai_learning", is_active: false,
        rule: { enabled, radiusKm, testsPerSecond: requestedRate, updatedAt: new Date().toISOString() },
      }, { onConflict: "vehicle_type" }));
      return { ok: true, enabled, radiusKm, testsPerSecond: requestedRate };
    }
    if (method === "POST") {
      if (body.action === "sample") return runLearningSample(admin);
      if (body.action === "predict") {
        const distanceKm=Number(body.distanceKm);
        if (!Number.isFinite(distanceKm)||distanceKm<=0||distanceKm>500) throw new Error("Distance invalide");
        return predictLearnedPrice(admin,{distanceKm,productName:String(body.productName||"UberX")});
      }
    }
    throw new Error("Méthode non autorisée");
  }
  if (p === "/api/admin/pricing") {
    if (method === "PUT") {
      if (body.vehicleType === "uber_cookie") {
        const cookie = String(body.cookie || "").trim();
        const { testUberCookie } = await import("./vtc-uber.server");
        const check = await testUberCookie(cookie);
        if (!check.ok) throw new Error(check.error || "Session refusée par Uber");
        required(await admin.from("pricing_rules").upsert({
          vehicle_type: "uber_cookie",
          is_active: false,
          rule: { cookie, updatedAt: new Date().toISOString() },
        }, { onConflict: "vehicle_type" }));
        return { ok: true, count: check.count, products: check.products };
      }
      if (body.vehicleType === "uber_hourly_checks") {
        const enabled = body.enabled === true;
        required(await admin.from("pricing_rules").upsert({
          vehicle_type: "uber_hourly_checks",
          is_active: false,
          rule: { enabled, updatedAt: new Date().toISOString() },
        }, { onConflict: "vehicle_type" }));
        return { ok: true, enabled };
      }
      if (body.vehicleType === "uber_hourly_check_now") {
        const { runUberFareCheck } = await import("./vtc-uber-check.server");
        return runUberFareCheck(admin, { force: true });
      }
      // Configuration spéciale pour la réduction Uber
      if (body.vehicleType === "uber_discount") {
        const enabled = Boolean(body.enabled);
        const rate = Number.isFinite(Number(body.rate)) ? Number(body.rate) : 0.2;
        required(
          await admin
            .from("pricing_rules")
            .upsert({ vehicle_type: "uber_discount", rule: { enabled, rate } }, { onConflict: "vehicle_type" }),
        );
        return { rule: { vehicleType: "uber_discount", enabled, rate } };
      }

      if (
        !DEFAULT_PRICING[body.vehicleType] ||
        Object.values(DEFAULT_PRICING[body.vehicleType]).some(
          (_, i) => !Number.isFinite(body[Object.keys(DEFAULT_PRICING[body.vehicleType])[i]]),
        )
      )
        throw new Error("Tarif invalide");
      required(await admin.from("pricing_rules").upsert({ vehicle_type: body.vehicleType, rule: body }));
      return { rule: body };
    }
    const allRows = required(await admin.from("pricing_rules").select("*"));
    const cookieRow = allRows.find((r) => r.vehicle_type === "uber_cookie");
    const hourlyRow = allRows.find((r) => r.vehicle_type === "uber_hourly_checks");
    return {
      rules: allRows.filter((r) => r.vehicle_type !== "uber_cookie" && r.vehicle_type !== "uber_hourly_checks").map((r) => ({
        ...r.rule,
        vehicleType: r.vehicle_type,
        city: r.city,
      })),
      uberHourlyChecks: hourlyRow?.rule || { enabled: false },
      uberCookieStatus: {
        hasCustomCookie: Boolean(cookieRow?.rule?.cookie),
        updatedAt: cookieRow?.rule?.updatedAt || null,
      },
    };
  }

  if (p === "/api/admin/drivers/documents") {
    if (method === "PATCH") {
      if (!["approved", "rejected"].includes(body.status)) throw new Error("Statut invalide");
      const reason = String(body.reason || "")
        .trim()
        .slice(0, 300);
      if (body.status === "rejected" && reason.length < 3) throw new Error("Indiquez le motif du refus");
      const doc = required(
        await admin
          .from("driver_documents")
          .update({
            status: body.status,
            rejection_reason: body.status === "rejected" ? reason : "",
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", body.documentId)
          .select("user_id")
          .single(),
      );
      const c = driverCompliance(
        required(await admin.from("driver_documents").select("doc_type,status,valid_until").eq("user_id", doc.user_id)),
      );
      if (!c.canDrive)
        required(
          await admin
            .from("drivers")
            .update({ is_online: false })
            .eq("user_id", doc.user_id)
            .eq("documents_override", false),
        );
      return { ok: true };
    }
    const d = required(await admin.from("drivers").select("user_id").eq("id", q.get("driverId")).single());
    const docs = required(await admin.from("driver_documents").select("*").eq("user_id", d.user_id));
    const c = driverCompliance(docs);
    return {
      documents: await Promise.all(
        docs.map(async (x) => ({
          ...docShape(x),
          url: (await admin.storage.from(DOCUMENTS_BUCKET).createSignedUrl(x.file_path, 600)).data?.signedUrl || null,
        })),
      ),
      compliance: { ...c, problem: complianceProblem(c) },
    };
  }
  if (p === "/api/admin/drivers") {
    if (method === "PATCH") {
      if (body.isApproved === true && body.force !== true) {
        const t = required(await admin.from("drivers").select("user_id").eq("id", body.driverId).single());
        const c = driverCompliance(
          required(await admin.from("driver_documents").select("doc_type,status,valid_until").eq("user_id", t.user_id)),
        );
        if (!c.canBeApproved) throw new Error(`Validation impossible. ${complianceProblem(c)}`);
      }
      let patch;
      if ("vehicleClass" in body) {
        if (!isVehicleClass(body.vehicleClass)) throw new Error("Gamme invalide");
        const t = required(
          await admin.from("drivers").select("accepts_classes,vehicle").eq("id", body.driverId).single(),
        );
        patch = {
          vehicle_class: body.vehicleClass,
          accepts_classes: sanitizeAcceptedClasses(body.vehicleClass, t.accepts_classes),
          vehicle: { ...(t.vehicle || {}), type: body.vehicleClass },
        };
      } else
        patch =
          "isPriority" in body
            ? { is_priority: Boolean(body.isPriority) }
            : {
                is_approved: Boolean(body.isApproved),
                documents_override: body.isApproved === true && body.force === true,
                ...(body.isApproved ? {} : { is_online: false }),
              };
      required(await admin.from("drivers").update(patch).eq("id", body.driverId));
      return { ok: true };
    }
    let query = admin.from("drivers").select("*");
    if (q.get("pending")) query = query.eq("is_approved", false);
    const ds = required(await query);
    const allDocs = required(await admin.from("driver_documents").select("user_id,doc_type,status,valid_until"));
    return {
      drivers: await Promise.all(
        ds.map(async (d) => ({
          ...driverShape(d),
          documents: ((c) => ({
            override: Boolean(d.documents_override),
            approved: c.approved,
            required: c.required,
            canBeApproved: c.canBeApproved,
            problem: complianceProblem(c),
          }))(driverCompliance(allDocs.filter((x) => x.user_id === d.user_id))),
          userId: required(await admin.from("profiles").select("name,username,avatar").eq("id", d.user_id).single()),
        })),
      ),
    };
  }
  if (p === "/api/admin/users" && method === "DELETE") {
    // Full erasure chosen by the admin: account, documents, rides, wallet and payment history.
    const target = String(body.userId || "");
    if (!/^[0-9a-f-]{36}$/i.test(target)) throw new Error("Compte invalide");
    if (target === uid) throw new Error("Vous ne pouvez pas supprimer votre propre compte");
    // Do not erase payment/accounting records or cancel Gold before checking
    // whether the account can actually be deleted safely.
    for (const [table, column] of [["wallet_transactions", "user_id"], ["payouts", "driver_id"], ["withdrawal_requests", "driver_id"]]) {
      const { data, error } = await admin.from(table).select("id").eq(column, target).limit(1);
      if (error) throw new Error(error.message);
      if (data.length) throw new Error("Ce compte contient des opérations financières à archiver avant suppression. Contactez le responsable des données.");
    }
    const { data: files, error: fileListError } = await admin.storage.from(DOCUMENTS_BUCKET).list(target, { limit: 1000 });
    if (fileListError) throw new Error(fileListError.message);
    if ((files || []).length === 1000) throw new Error("Trop de documents à effacer automatiquement.");
    const { closeGoldBillingForDeletedAccount } = await import("./driver-gold.server");
    try {
      await closeGoldBillingForDeletedAccount(admin, target);
    } catch {
      throw new Error("La facturation StrasDrive Gold doit être clôturée avant la suppression du compte.");
    }
    const removed = required(await admin.rpc("admin_delete_account", { _user: target }));
    required(await admin.from("push_tokens").delete().eq("user_id", target));
    // Inbox threads are owned by immutable account id even after an e-mail change.
    required(
      await admin
        .from("contact_messages")
        .delete()
        .eq("topic", "driver_conversation")
        .like("message", '%"userId":"' + target + '"%'),
    );
    if (files?.length) required(await admin.storage.from(DOCUMENTS_BUCKET).remove(files.map((f) => `${target}/${f.name}`)));
    const { error } = await admin.auth.admin.deleteUser(target);
    if (error && !/not.?found/i.test(error.message))
      throw new Error(`Données effacées, mais l’accès au compte n’a pas pu être supprimé : ${error.message}`);
    return { ok: true, removed };
  }
  if (p === "/api/admin/users") {
    const ps = required(await admin.from("profiles").select("*").limit(100));
    const rs = required(await admin.from("user_roles").select("*"));
    return {
      users: ps
        .map((p) => ({ ...profileShape(p), role: rs.find((r) => r.user_id === p.id)?.role || "rider" }))
        .filter(
          (p) =>
            (!q.get("role") || p.role === q.get("role")) &&
            (!q.get("q") || (p.name + " " + p.username).toLowerCase().includes(q.get("q").toLowerCase())),
        ),
    };
  }
  if (p === "/api/admin/support") {
    if (method === "POST") {
      const { archiveSupport } = await import("./admin-support-archive.server");
      return archiveSupport(admin, body.id, body.expectedMessage);
    }
    if (method === "PATCH") {
      if (!["open", "resolved"].includes(body.status)) throw new Error("Statut invalide");
      required(
        await admin
          .from("contact_messages")
          .update({ status: body.status, resolved_at: body.status === "resolved" ? new Date().toISOString() : null })
          .eq("id", body.id),
      );
      return { ok: true };
    }
    const status = q.get("status") || "open";
    if (!["open", "resolved", "archive"].includes(status)) throw new Error("Statut invalide");
    const { adminSupportMessages } = await import("./admin-support-archive.server");
    return adminSupportMessages(admin, status);
  }
  if (p === "/api/admin/overview") {
    const rs = required(
      await (role === "admin" ? admin : db)
        .from("rides")
        .select("*")
        .eq("is_test", false)
        .order("created_at", { ascending: false })
        .limit(1000),
    );
    const completed = rs.filter((r) => r.status === "completed"),
      today = new Date().toISOString().slice(0, 10);
    const todayR = completed.filter((r) => r.completed_at?.startsWith(today));
    const sum = (rows, key) => rows.reduce((s, r) => s + Number(r.fare[key] || 0), 0);
    if (role === "driver") {
      const d = required(await db.from("drivers").select("*").eq("user_id", uid).single());
      const mine = completed.filter((r) => r.driver_id === uid);
      return {
        wallet: { balance: Number(profile.balance) },
        stats: d.stats,
        today: {
          earnings: sum(
            mine.filter((r) => r.completed_at?.startsWith(today)),
            "driverEarnings",
          ),
          trips: mine.filter((r) => r.completed_at?.startsWith(today)).length,
        },
        week: { total: sum(mine, "driverEarnings"), trips: mine.length, byDay: [] },
        recentRides: await Promise.all(mine.slice(0, 10).map((r) => serialize(admin, r, uid, true))),
      };
    }
    const ps = await admin.from("profiles").select("id", { count: "exact" });
    const ds = required(await admin.from("drivers").select("*"));
    return {
      ridesToday: rs.filter((r) => r.created_at.startsWith(today)).length,
      activeRides: rs.filter((r) => active.includes(r.status)).length,
      revenueToday: sum(todayR, "total"),
      platformFeesToday: sum(todayR, "platformFee"),
      onlineDrivers: ds.filter((d) => d.is_online).length,
      pendingDrivers: ds.filter((d) => !d.is_approved).length,
      totalUsers: ps.count,
      totalDrivers: ds.length,
      openSupport: (
        await admin
          .from("contact_messages")
          .select("id", { count: "exact" })
          .eq("status", "open")
          .not("topic", "in", "(ride_chat_archive,ride_chat_cleanup)")
      ).count,
      recentRides: await Promise.all(rs.slice(0, 10).map((r) => serialize(admin, r, uid, true))),
      revenue7d: [],
      statusBreakdown: { completed: completed.length },
    };
  }
  throw new Error("Ce service n’est pas encore disponible");
}
const TEST_PIN = "0000";
const TEST_PICKUP = { lat: 48.5833, lng: 7.7458, address: "Place Kléber, 67000 Strasbourg (test)" };
const TEST_DROPOFF = { lat: 48.585, lng: 7.7342, address: "Gare de Strasbourg, 67000 Strasbourg (test)" };
async function pendingTestOffer(db, uid) {
  const busy = required(
    await db.from("rides").select("id").eq("driver_id", uid).in("status", ["accepted", "arrived", "in_progress"]),
  );
  if (busy.length) return null;
  const ride = required(
    await db
      .from("rides")
      .select("*")
      .eq("status", "searching")
      .eq("is_test", true)
      .eq("offer_driver_id", uid)
      .gt("offer_expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1),
  )[0];
  if (!ride) return null;
  return { ride, driver: required(await db.from("drivers").select("*").eq("user_id", uid).single()) };
}
async function dispatchPool(db) {
  const ds = required(await db.from("drivers").select("*").eq("is_online", true).eq("is_approved", true));
  const busy = new Set(
    required(await db.from("rides").select("driver_id,rider_id").in("status", active)).flatMap((b) =>
      [b.driver_id, b.rider_id].filter(Boolean),
    ),
  );
  const free = ds.filter((d) => !busy.has(d.user_id));
  if (!free.length) return free;
  // Today's net earnings (Paris day) for the fair-share rule.
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const since = new Date(Date.parse(`${day}T00:00:00Z`) - 2 * 3600e3).toISOString();
  const done = required(
    await db
      .from("rides")
      .select("driver_id,fare,completed_at")
      .eq("status", "completed")
      .eq("is_test", false)
      .in(
        "driver_id",
        free.map((d) => d.user_id),
      )
      .gte("completed_at", since),
  );
  const earned = {};
  for (const x of done) {
    if (new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(x.completed_at)) !== day)
      continue;
    earned[x.driver_id] = (earned[x.driver_id] || 0) + (Number(x.fare?.driverEarnings) || 0);
  }
  return free.map((d) => ({ ...d, earned_today: Math.round((earned[d.user_id] || 0) * 100) / 100 }));
}
async function withDriverGold(db, driver) {
  if (!driver || driver.is_priority) return driver;
  const { driverGold } = await import("./driver-gold.server");
  return { ...driver, gold_active: (await driverGold(db, driver)).active };
}
async function assignOffer(db, r, pool) {
  if (r.status !== "searching") return r;
  if (r.is_test) {
    if (r.offer_expires_at && new Date(r.offer_expires_at).getTime() > Date.now()) return r;
    return (
      required(
        await db
          .from("rides")
          .update({ status: "no_drivers", dispatch_phase: null, offer_driver_id: null, offer_expires_at: null })
          .eq("id", r.id)
          .eq("status", "searching")
          .select("*"),
      )[0] || r
    );
  }
  let drivers = pool || (await dispatchPool(db));
  const blockResult = await db.from("user_blocks").select("blocker_id,blocked_id")
    .or(`blocker_id.eq.${r.rider_id},blocked_id.eq.${r.rider_id}`);
  const blocked = ["42P01", "PGRST205"].includes(blockResult.error?.code) ? [] : required(blockResult);
  const excluded = new Set(blocked.map((b) => b.blocker_id === r.rider_id ? b.blocked_id : b.blocker_id));
  drivers = drivers.filter((d) => !excluded.has(d.user_id));
  let route = r.route;
  if (!r.dispatch_phase && !route?.goldReturn) {
    const candidates = availableFor(r, drivers);
    const approachKm = candidates.reduce((best, driver) => Math.min(best, distanceToPickupKm(r, driver)), Infinity);
    const approachSeconds = Number.isFinite(approachKm) ? approachSecondsFor(approachKm * 1350) : 0;
    const goldReturn = await goldReturnHintForRide(r, approachSeconds, routeBetween);
    if (goldReturn) route = { ...route, goldReturn };
  }
  if (route?.goldReturn) drivers = await goldDispatchPool(db, drivers);
  const targetId = r.dispatch_phase === "private" ? r.offer_driver_id : !r.dispatch_phase ? r.favorite_driver_id : null;
  const target = targetId && drivers.find((driver) => driver.user_id === targetId);
  if (target && !route?.goldReturn) {
    const checked = await withDriverGold(db, target);
    drivers = drivers.map((driver) => (driver === target ? checked : driver));
  }
  const patch = planDispatch({ ...r, route }, drivers);
  if (!patch) return r;
  let q = db
    .from("rides")
    .update(route === r.route ? patch : { ...patch, route })
    .eq("id", r.id)
    .eq("status", "searching");
  q = r.dispatch_phase ? q.eq("dispatch_phase", r.dispatch_phase) : q.is("dispatch_phase", null);
  const won = required(await q.select("*"))[0];
  // Only the request whose phase-guarded update succeeded sends the pushes, so each step notifies once.
  if (won) await pushRideOffer(db, won, newlyOfferedDriverIds(r, won, drivers));
  return won || required(await db.from("rides").select("*").eq("id", r.id).single());
}

// Visiteurs non connectés (page d'accueil) : uniquement la recherche d'adresse et l'estimation.
export async function publicVtc(input) {
  const path = String(input?.path || "");
  const url = new URL(path, "http://app");
  if (url.pathname === "/api/geo/search") return geoSearch(url.searchParams);
  if (url.pathname === "/api/rides/estimate") {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return estimates(supabaseAdmin, input.body?.pickup, input.body?.dropoff);
  }
  if (url.pathname === "/api/private-clients/scan") {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { scanInvitation } = await import("./private-clients.server");
    return scanInvitation(supabaseAdmin, input.body?.token);
  }
  throw new Error("Accès refusé");
}

async function roadAlerts(admin, { p, method, body, q, uid, isAdmin }) {
  const load = async (center) => {
    let query = admin.from("road_alerts").select("*").order("created_at", { ascending: false }).limit(2000);
    if (center) {
      const dLat = NEARBY_RADIUS_KM / 111;
      const dLng = NEARBY_RADIUS_KM / (111 * Math.max(0.2, Math.cos((center.lat * Math.PI) / 180)));
      query = query
        .gte("lat", center.lat - dLat)
        .lte("lat", center.lat + dLat)
        .gte("lng", center.lng - dLng)
        .lte("lng", center.lng + dLng);
    }
    return required(await query).filter((a) => isAlertActive(a));
  };
  const withVotes = async (alerts) => {
    if (!alerts.length) return [];
    const votes = required(
      await admin
        .from("road_alert_votes")
        .select("alert_id, present")
        .eq("driver_id", uid)
        .in(
          "alert_id",
          alerts.map((a) => a.id),
        ),
    );
    const mine = new Map(votes.map((v) => [v.alert_id, v.present]));
    return alerts.map((a) => alertShape(a, uid, mine.get(a.id)));
  };

  if (p === "/api/admin/road-alerts") {
    if (!isAdmin) throw new Error("Accès administrateur requis");
    if (method === "DELETE") {
      const kind = q.get("kind");
      if (!ALERT_KINDS.includes(kind)) throw new Error("Type de signalement invalide");
      required(await admin.from("road_alerts").delete().eq("kind", kind));
      return { ok: true };
    }
    const all = required(
      await admin.from("road_alerts").select("*").order("created_at", { ascending: false }).limit(500),
    );
    return {
      alerts: all.map((a) => ({
        ...alertShape(a, uid),
        active: isAlertActive(a),
        denials: a.denials,
        validatedByAdmin: a.validated_by_admin,
      })),
    };
  }
  const adminMatch = p.match(/^\/api\/admin\/road-alerts\/([0-9a-f-]{36})(?:\/(validate))?$/);
  if (adminMatch) {
    if (!isAdmin) throw new Error("Accès administrateur requis");
    const [, id, action] = adminMatch;
    if (method === "DELETE") {
      required(await admin.from("road_alerts").delete().eq("id", id));
      return { ok: true };
    }
    if (action === "validate" && method === "POST") {
      required(
        await admin
          .from("road_alerts")
          .update({ is_permanent: true, validated_by_admin: true, last_confirmed_at: new Date().toISOString() })
          .eq("id", id),
      );
      return { ok: true };
    }
    throw new Error("Action inconnue");
  }

  if (p === "/api/drivers/me/road-alerts") {
    if (method === "GET") {
      const center = validPoint({ lat: q.get("lat"), lng: q.get("lng") });
      const alerts = await withVotes(await load(center));
      if (!center) return { alerts };
      const dLat = NEARBY_RADIUS_KM / 111;
      const dLng = Math.min(0.49, dLat / Math.max(0.2, Math.cos((center.lat * Math.PI) / 180)));
      const osm = await speedCameras([
        Math.max(-180, center.lng - dLng),
        Math.max(-90, center.lat - dLat),
        Math.min(180, center.lng + dLng),
        Math.min(90, center.lat + dLat),
      ]);
      return { alerts: mergeCameraAlerts(alerts, osm.cameras), osmAvailable: osm.available };
    }
    if (method === "POST") {
      const point = validPoint(body);
      if (!point) throw new Error("Position GPS introuvable");
      if (!ALERT_KINDS.includes(body.kind)) throw new Error("Type de signalement invalide");
      await requireRadarReporter(admin, uid, body.kind);
      const near = await load(point);
      const target = findMergeTarget(near, body.kind, point);
      if (target) {
        const already = required(
          await admin
            .from("road_alert_votes")
            .select("alert_id")
            .eq("alert_id", target.id)
            .eq("driver_id", uid)
            .maybeSingle(),
        );
        if (!already && target.reported_by !== uid) {
          required(await admin.from("road_alert_votes").insert({ alert_id: target.id, driver_id: uid, present: true }));
          const next = applyVote(target, true);
          required(
            await admin
              .from("road_alerts")
              .update({
                confirmations: next.confirmations,
                last_confirmed_at: next.last_confirmed_at,
                is_permanent: next.is_permanent,
              })
              .eq("id", target.id),
          );
        }
        return { merged: true, id: target.id, alerts: await withVotes(await load(point)) };
      }
      const created = required(
        await admin
          .from("road_alerts")
          .insert({
            kind: body.kind,
            lat: point.lat,
            lng: point.lng,
            reported_by: uid,
            is_permanent: body.kind === "radar", // un radar reste jusqu'à sa suppression par l'admin
          })
          .select("id")
          .single(),
      );
      return { merged: false, id: created?.id, alerts: await withVotes(await load(point)) };
    }
  }

  const voteMatch = p.match(/^\/api\/drivers\/me\/road-alerts\/([0-9a-f-]{36})\/vote$/);
  if (voteMatch && method === "POST") {
    const id = voteMatch[1];
    const a = required(await admin.from("road_alerts").select("*").eq("id", id).maybeSingle());
    if (!a || !isAlertActive(a)) return { ok: true, gone: true };
    if (a.reported_by === uid) return { ok: true };
    const { error } = await admin
      .from("road_alert_votes")
      .insert({ alert_id: id, driver_id: uid, present: Boolean(body.present) });
    if (error) return { ok: true, already: true }; // un seul vote par chauffeur
    const next = applyVote(a, Boolean(body.present));
    required(
      await admin
        .from("road_alerts")
        .update({
          confirmations: next.confirmations,
          denials: next.denials,
          last_confirmed_at: next.last_confirmed_at,
          is_permanent: next.is_permanent,
        })
        .eq("id", id),
    );
    return { ok: true };
  }
  throw new Error("Route introuvable");
}
// Public landing card: one random real completed ride. Visitors are anonymous,
// so only non-identifying fields leave the server (first name, car make/model/color,
// duration, distance, fare) — never the plate, rider, addresses or route geometry.
export async function getRandomRealRide() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rides, error } = await supabaseAdmin
    .from("rides")
    .select("driver_id, distance:route->distanceMeters, duration:route->durationSeconds, total:fare->total")
    .eq("status", "completed")
    .eq("is_test", false)
    .not("driver_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error || !rides?.length) return null;
  const ride = rides[Math.floor(Math.random() * rides.length)];
  const [{ data: driver }, { data: profile }] = await Promise.all([
    supabaseAdmin.from("drivers").select("vehicle").eq("user_id", ride.driver_id).maybeSingle(),
    supabaseAdmin.from("profiles").select("name, avatar").eq("id", ride.driver_id).maybeSingle(),
  ]);
  const v = driver?.vehicle || {};
  const clean = (x) => (typeof x === "string" ? x.trim() : "");
  const vehicleText = [clean(v.make), clean(v.model), clean(v.color).toLowerCase()].filter(Boolean).join(" ");
  const firstName = clean(profile?.name).split(/\s+/)[0] || "Chauffeur";
  const avatar = typeof profile?.avatar === "string" && profile.avatar.trim().length > 0 ? profile.avatar.trim() : null;
  const distance = Number(ride.distance);
  const duration = Number(ride.duration);
  const total = Number(ride.total);
  return {
    driverName: firstName,
    driverAvatar: avatar,
    vehicleText: vehicleText || "Véhicule StrasDrive",
    approachMin: Math.floor(Math.random() * 3) + 2,
    durationMin: duration > 0 ? Math.max(1, Math.round(duration / 60)) : 12,
    distanceKm: distance > 0 ? (distance / 1000).toFixed(1).replace(".", ",") : "4,8",
    fareTotal: total > 0 ? total.toFixed(2).replace(".", ",") : "11,20",
  };
}
