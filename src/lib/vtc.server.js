import { discoverBoard, returnHintForRide } from "./vtc-transport.server";
import { driverWeekSummary } from "./vtc-driver-stats";
import { parisDay, validDay } from "./vtc-dates";
import { inboxForDriver, sendSupportMessage } from "./vtc-support.server";
import { buildWaybill, sanitizeOperator } from "./vtc-waybill";
import { geoSearch } from "./vtc-geocoding.server";
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
  routeFromOsrm,
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
  canSeeOffer,
  distanceToPickupKm,
  approachSecondsFor,
  profitability,
  TEST_OFFER_SECONDS,
  pickupZoneProblem,
} from "./vtc-dispatch";
import { sanitizeTripPrefs, tripPrefsOf, riderAverage } from "./vtc-trip-prefs";
import { evaluateDriverProgress } from "./vtc-tracking";
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
  let driver;
  if (r.driver_id) {
    const p = required(await db.from("profiles").select("*").eq("id", r.driver_id).single());
    const d = required(await db.from("drivers").select("*").eq("user_id", r.driver_id).single());
    driver = {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      rating: p.rating.average,
      totalTrips: d.stats.totalTrips,
      vehicle: { ...d.vehicle, type: driverClass(d) },
      location: d.location,
    };
  }
  const out = {
    ...r,
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
      const rp = required(await db.from("profiles").select("name,phone,rating").eq("id", r.rider_id).single());
      out.rider = {
        name: rp.name || "Passager",
        phone: rp.phone || "",
        rating: rp.rating?.average || 5.0,
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
async function osrmRoute(a, b) {
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    return routeFromOsrm(await res.json());
  } catch {
    return null;
  }
}
function validPoint(p) {
  return p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
}
async function routeBetween(a, b) {
  if (!validPoint(a) || !validPoint(b)) throw new Error("Adresses invalides");
  // Google (trafic en temps réel) → OSRM (sans trafic) → estimation signalée, jamais de ligne droite.
  return (
    (await googleRoute(a, b)) ||
    (await osrmRoute(a, b)) ||
    approximateRoute(haversineDistance(a.lat, a.lng, b.lat, b.lng))
  );
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
    if (row.vehicle_type !== "uber_discount") {
      rules[row.vehicle_type] = row.rule;
    }
  }

  // Configuration de la réduction Uber (20 % par défaut, activée par défaut)
  const discountSetting = rows.find((r) => r.vehicle_type === "uber_discount")?.rule;
  const isDiscountActive = discountSetting ? Boolean(discountSetting.enabled) : true;
  const discountRate = discountSetting && Number.isFinite(discountSetting.rate) ? discountSetting.rate : 0.2; // 20 %

  // 1. Appel en direct de l'API Uber
  let uberList = null;
  try {
    const { uberProducts } = await import("./vtc-uber.server");
    uberList = await uberProducts(a, b);
  } catch {
    uberList = null;
  }

  // 2. Si Uber ne répond pas (cookie expiré, lenteur, erreur) : on ne bloque jamais le client,
  //    chaque gamme sans prix Uber retombe sur la grille StrasDrive (plancher ARPE inclus).
  if (!Array.isArray(uberList)) uberList = [];

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

  // 4. Repli : toute gamme non tarifée par Uber utilise la grille StrasDrive
  let fallback = false;
  for (const type of Object.keys(DEFAULT_PRICING)) {
    if (finalEstimates[type] || !rules[type]) continue;
    fallback = true;
    finalEstimates[type] = {
      ...calculateFare(rules[type], route.distanceMeters, route.durationSeconds),
      isUberPrice: false,
    };
  }

  return { route, estimates: finalEstimates, source: fallback ? (uberList.length ? "mixed" : "strasdrive") : "uber" };
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
  if (p.startsWith("/api/admin/") && role !== "admin") throw new Error("Accès administrateur requis");
  if (p.startsWith("/api/drivers/me") && role !== "driver") throw new Error("Accès chauffeur requis");
  // RLS has verified the role; privileged operations below use only the verified caller identity.
  const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
  const profile = required(await db.from("profiles").select("*").eq("id", uid).single());
  if (p === "/api/users/me/export") {
    // Droit d'accès et de portabilité (RGPD art. 15 et 20) : toutes les données liées au compte.
    const driver =
      role === "driver" ? required(await db.from("drivers").select("*").eq("user_id", uid).maybeSingle()) : null;
    const rides = required(
      await db
        .from("rides")
        .select("*")
        .or(`rider_id.eq.${uid},driver_id.eq.${uid}`)
        .order("created_at", { ascending: false })
        .limit(5000),
    ).map(({ pin, offer_driver_id, offer_expires_at, declined, ...rest }) => rest);
    const transactions = required(
      await db
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(10000),
    );
    const documents =
      role === "driver"
        ? required(await db.from("driver_documents").select("*").eq("user_id", uid)).map(docShape)
        : undefined;
    return {
      exportedAt: new Date().toISOString(),
      account: { email: context.claims.email || "", role, consent: context.claims.user_metadata?.consent || null },
      profile,
      driver,
      documents,
      rides,
      walletTransactions: transactions,
    };
  }
  if (p === "/api/users/me/deletion-request" && method === "POST") {
    // Droit à l'effacement (RGPD art. 17) : demande enregistrée et traitée sous un mois.
    required(
      await admin.from("contact_messages").insert({
        name: profile.name || profile.username || "Utilisateur",
        email: context.claims.email || "",
        topic: "data_request",
        message:
          `Demande de suppression du compte ${uid} (${role}). ${String(body.reason || "").slice(0, 1000)}`.trim(),
      }),
    );
    return { ok: true };
  }
  if (p === "/api/users/me") {
    if (method === "PATCH") {
      const payload = {};
      for (const k of ["name", "phone", "username"])
        if (typeof body[k] === "string") payload[k] = body[k].slice(0, 100);
      required(await db.from("profiles").update(payload).eq("id", uid));
    }
    const fresh = required(await db.from("profiles").select("*").eq("id", uid).single());
    return { user: { ...profileShape(fresh, context.claims.email), role } };
  }
  if (p === "/api/geo/search") return geoSearch(q);
  if (p === "/api/rides/estimate") return estimates(admin, body.pickup, body.dropoff);
  if (p === "/api/drivers/me/discover" && method === "GET") return discoverBoard(q.get("day") || parisDay());
  if (p === "/api/drivers/me/inbox" && method === "GET")
    return inboxForDriver(admin, uid, context.claims?.email, q.get("page"));
  if (p === "/api/drivers/me/inbox/support" && method === "POST")
    return sendSupportMessage(admin, { uid, email: context.claims?.email, name: profile.name, role, body });
  if (p.startsWith("/api/drivers/me/road-alerts") || p.startsWith("/api/admin/road-alerts"))
    return roadAlerts(admin, { p, method, body, q, uid, isAdmin: role === "admin" });
  if (p === "/api/admin/support/reply" && method === "POST")
    return sendSupportMessage(admin, { uid, email: context.claims?.email, name: profile.name, role, body });
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
    const week = driverWeekSummary(rows, day);
    const finishedThisWeek = rows.filter((ride) => {
      const completedDay = parisDay(ride.completed_at);
      return completedDay >= week.start && completedDay < week.end;
    });
    return {
      wallet: { balance: Number(profile.balance) },
      stats: driver.stats,
      today: week.today,
      week,
      recentRides: await Promise.all(finishedThisWeek.slice(0, 30).map((ride) => serialize(admin, ride, uid, true))),
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
    return { driver: driverShape(required(await db.from("drivers").select("*").eq("user_id", uid).single())) };
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
      if (!path.startsWith(`${uid}/`) || path.includes("..") || path.length > 200) throw new Error("Fichier invalide");
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
  if (p === "/api/drivers/me/status") {
    const d = required(await db.from("drivers").select("*").eq("user_id", uid).single());
    const current = required(await db.from("rides").select("id").eq("driver_id", uid).in("status", active));
    if (!body.online && current.length) throw new Error("Terminez votre course avant de passer hors ligne");
    if (body.online) {
      if (!d.is_approved) throw new Error("Votre inscription doit être approuvée");
      if (!d.vehicle.plate) throw new Error("Ajoutez votre véhicule");
      if (!d.documents_override) {
        const dc = driverCompliance(
          required(await db.from("driver_documents").select("doc_type,status,valid_until").eq("user_id", uid)),
        );
        if (!dc.canDrive) throw new Error(`${complianceProblem(dc)} — mettez à jour vos documents dans votre profil`);
      }
      if (Number(profile.balance) < -25) throw new Error("Régularisez votre solde avant de passer en ligne");
      if (!body.location || ![body.location.lat, body.location.lng].every(Number.isFinite))
        throw new Error("Position invalide");
    }
    required(
      await db
        .from("drivers")
        .update({
          is_online: Boolean(body.online),
          location: body.location || d.location,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", uid),
    );
    return { ok: true };
  }
  if (p === "/api/drivers/location") {
    if (role !== "driver") throw new Error("Accès refusé");
    if (![body.lat, body.lng].every(Number.isFinite)) throw new Error("Position invalide");
    required(
      await db
        .from("drivers")
        .update({
          location: { lat: body.lat, lng: body.lng, heading: body.heading },
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
  if (p === "/api/drivers/me/payouts") {
    const { handlePayments } = await import("./vtc-payments.server");
    return handlePayments({ admin, profile, uid, role, p, q, method, body });
  }
  // Validated live quote for a booking (shared by wallet/cash booking and card checkout).
  const quoteRide = async (b) => {
    if (!DEFAULT_PRICING[b.vehicleType]) throw new Error("Gamme invalide");
    const quote = await estimates(admin, b.pickup, b.dropoff);
    const fare = quote.estimates[b.vehicleType];
    if (!fare) throw new Error("Tarif indisponible pour cette gamme, réessayez");
    if (quote.route.distanceMeters < 100 || quote.route.distanceMeters > 200000)
      throw new Error("Le trajet doit être compris entre 100 m et 200 km");
    return { fare, route: quote.route };
  };
  const createRide = async ({ vehicleType, pickup, dropoff, route, fare, payment }) => {
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
      cardBookingProblem: (fare) => bookingPaymentProblem("card", profile.balance, fare.total),
      serializeRide: async (id) =>
        serialize(admin, required(await admin.from("rides").select("*").eq("id", id).single()), uid),
    });
  }
  if (p === "/api/rides" && method === "POST") {
    if (role !== "rider") throw new Error("Seuls les clients peuvent réserver");
    const paymentMethod = paymentMethodOf(body.paymentMethod);
    if (paymentMethod === "card") throw new Error("Le paiement par carte se fait depuis l’écran de paiement sécurisé");
    const { fare, route } = await quoteRide(body);
    const payProblem = bookingPaymentProblem(paymentMethod, profile.balance, fare.total);
    if (payProblem) throw new Error(payProblem);
    const ride = await createRide({
      vehicleType: body.vehicleType,
      pickup: body.pickup,
      dropoff: body.dropoff,
      route,
      fare,
      payment: { method: paymentMethod },
    });
    return { ride };
  }
  if (p === "/api/rides/active") {
    const list = required(
      await db
        .from("rides")
        .select("*")
        .eq(role === "driver" ? "driver_id" : "rider_id", uid)
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
    if (role !== "driver") throw new Error("Accès refusé");
    const pool = await dispatchPool(admin);
    let me = pool.find((d) => d.user_id === uid);
    const test = await pendingTestOffer(admin, uid);
    const rs = required(
      await admin.from("rides").select("*").eq("status", "searching").eq("is_test", false).limit(100),
    );
    const fresh = [];
    for (const r of rs) fresh.push(await assignOffer(admin, r, pool));
    let r = fresh
      .filter((x) => canSeeOffer(x, me, Date.now(), pool))
      .sort((a, b) => distanceToPickupKm(a, me) - distanceToPickupKm(b, me))[0];
    if (test) {
      r = test.ride;
      me = me || test.driver;
    }
    if (!r) return { offer: null };
    const approachKm = distanceToPickupKm(r, me),
      approachMeters = Number.isFinite(approachKm) ? Math.round(approachKm * 1350) : null;
    let profit = null;
    if (me.is_priority && approachMeters != null) {
      const approachSeconds = approachSecondsFor(approachMeters),
        tripSeconds = r.route.durationSeconds || 0;
      const expected = settleDriverEarnings(
        r.fare,
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
        airportReturn: await returnHintForRide(r, approachSecondsFor(approachMeters || 0), routeBetween),
        rideId: r.id,
        pickup: r.pickup,
        dropoff: r.dropoff,
        rider,
        earnings: r.fare.driverEarnings,
        distanceMeters: r.route.distanceMeters,
        durationSeconds: r.route.durationSeconds,
        routeQuality: routeQualityLabel(r.route),
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
  if (p === "/api/rides" || p === "/api/admin/rides") {
    const page = Math.max(1, Number(q.get("page")) || 1),
      limit = Math.min(100, Math.max(1, Number(q.get("limit")) || 15));
    let query = (role === "admin" ? admin : db)
      .from("rides")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });
    if (role !== "admin") query = query.eq(role === "driver" ? "driver_id" : "rider_id", uid);
    if (q.get("status")) query = query.eq("status", q.get("status"));
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
    const r = required(await admin.from("rides").select("*").eq("id", id).single());
    const participant = r.rider_id === uid || r.driver_id === uid;
    if (action === "accept") {
      if (r.is_test) {
        if (
          role !== "driver" ||
          r.status !== "searching" ||
          r.offer_driver_id !== uid ||
          !r.offer_expires_at ||
          new Date(r.offer_expires_at).getTime() <= Date.now()
        )
          throw new Error("Cette demande n’est plus disponible");
      } else {
        const pool = role === "driver" ? await dispatchPool(admin) : [];
        const me = pool.find((d) => d.user_id === uid) || null;
        if (!canSeeOffer(r, me, Date.now(), pool)) throw new Error("Cette demande n’est plus disponible");
      }
      let claim = admin
        .from("rides")
        .update({
          driver_id: uid,
          status: "accepted",
          accepted_at: new Date().toISOString(),
          offer_driver_id: null,
          offer_expires_at: null,
        })
        .eq("id", id)
        .eq("status", "searching")
        .eq("dispatch_phase", r.dispatch_phase);
      // En phase nearest, le plus proche peut accepter tout de suite ;
      // les autres peuvent accepter si le délai de priorité de 4 s est écoulé

      const claimed = required(await claim.select("*"))[0];
      if (!claimed) throw new Error("Course déjà acceptée");
      return { ride: await serialize(admin, claimed, uid) };
    }
    if (action === "decline") {
      if (role !== "driver") throw new Error("Accès refusé");
      required(await admin.rpc("decline_ride_offer", { _ride: id, _driver: uid }));
      return { ok: true };
    }
    if (!participant && role !== "admin") throw new Error("Course inaccessible");
    if (!action) return { ride: await serialize(admin, r, uid) };
    if (action === "route") {
      if (!participant) throw new Error("Accès refusé");
      return { route: await liveRoute(admin, r) };
    }
    if (action === "arrive" || action === "start" || action === "complete") {
      const previous = { arrive: "accepted", start: "arrived", complete: "in_progress" }[action];
      if (r.driver_id !== uid || r.status !== previous) throw new Error("Action non autorisée");
      if ((action === "arrive" || action === "start") && !r.is_test) {
        const loc = required(await admin.from("drivers").select("location").eq("user_id", uid).single()).location;
        const zone = pickupZoneProblem(loc, r.pickup);
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

    } else if (action === "messages") {
      if (!participant) throw new Error("Accès refusé");
      if (method === "GET") return { messages: r.messages };
      if (
        !["accepted", "arrived", "in_progress"].includes(r.status) ||
        typeof body.text !== "string" ||
        !body.text.trim() ||
        body.text.length > 500
      )
        throw new Error("Message invalide");
      required(
        await admin
          .from("rides")
          .update({
            messages: [
              ...r.messages,
              { from: r.rider_id === uid ? "rider" : "driver", text: body.text.trim(), at: new Date().toISOString() },
            ],
          })
          .eq("id", id),
      );
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
    return { ok: true, rideId: r.id, expiresInSeconds: TEST_OFFER_SECONDS, driverOnline: Boolean(d.is_online) };
  }
  if (p === "/api/admin/pricing") {
    if (method === "PUT") {
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
    return {
      rules: required(await admin.from("pricing_rules").select("*")).map((r) => ({
        ...r.rule,
        vehicleType: r.vehicle_type,
        city: r.city,
      })),
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
    const files = (await admin.storage.from(DOCUMENTS_BUCKET).list(target, { limit: 1000 })).data || [];
    const removed = required(await admin.rpc("admin_delete_account", { _user: target }));
    // Inbox threads are owned by immutable account id even after an e-mail change.
    required(
      await admin
        .from("contact_messages")
        .delete()
        .eq("topic", "driver_conversation")
        .like("message", '%"userId":"' + target + '"%'),
    );
    if (files.length) await admin.storage.from(DOCUMENTS_BUCKET).remove(files.map((f) => `${target}/${f.name}`));
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
    return {
      messages: required(
        await admin
          .from("contact_messages")
          .select("*")
          .eq("status", q.get("status") || "open"),
      ).map((m) => ({ ...m, _id: m.id, createdAt: m.created_at, resolvedAt: m.resolved_at })),
    };
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
      openSupport: (await admin.from("contact_messages").select("id", { count: "exact" }).eq("status", "open")).count,
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
    required(await db.from("rides").select("driver_id").in("status", ["accepted", "arrived", "in_progress"])).map(
      (b) => b.driver_id,
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
  const patch = planDispatch(r, pool || (await dispatchPool(db)));
  if (!patch) return r;
  let q = db.from("rides").update(patch).eq("id", r.id).eq("status", "searching");
  q = r.dispatch_phase ? q.eq("dispatch_phase", r.dispatch_phase) : q.is("dispatch_phase", null);
  return required(await q.select("*"))[0] || required(await db.from("rides").select("*").eq("id", r.id).single());
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
      await admin.from("road_alert_votes").select("alert_id, present").eq("driver_id", uid).in("alert_id", alerts.map((a) => a.id)),
    );
    const mine = new Map(votes.map((v) => [v.alert_id, v.present]));
    return alerts.map((a) => alertShape(a, uid, mine.get(a.id)));
  };

  if (p === "/api/admin/road-alerts") {
    if (!isAdmin) throw new Error("Accès administrateur requis");
    const all = required(await admin.from("road_alerts").select("*").order("created_at", { ascending: false }).limit(500));
    return {
      alerts: all.map((a) => ({ ...alertShape(a, uid), active: isAlertActive(a), denials: a.denials, validatedByAdmin: a.validated_by_admin })),
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
      return { alerts: await withVotes(await load(center)) };
    }
    if (method === "POST") {
      const point = validPoint(body);
      if (!point) throw new Error("Position GPS introuvable");
      if (!ALERT_KINDS.includes(body.kind)) throw new Error("Type de signalement invalide");
      const near = await load(point);
      const target = findMergeTarget(near, body.kind, point);
      if (target) {
        const already = required(
          await admin.from("road_alert_votes").select("alert_id").eq("alert_id", target.id).eq("driver_id", uid).maybeSingle(),
        );
        if (!already && target.reported_by !== uid) {
          required(await admin.from("road_alert_votes").insert({ alert_id: target.id, driver_id: uid, present: true }));
          const next = applyVote(target, true);
          required(
            await admin
              .from("road_alerts")
              .update({ confirmations: next.confirmations, last_confirmed_at: next.last_confirmed_at, is_permanent: next.is_permanent })
              .eq("id", target.id),
          );
        }
        return { merged: true, alerts: await withVotes(await load(point)) };
      }
      required(await admin.from("road_alerts").insert({ kind: body.kind, lat: point.lat, lng: point.lng, reported_by: uid }));
      return { merged: false, alerts: await withVotes(await load(point)) };
    }
  }

  const voteMatch = p.match(/^\/api\/drivers\/me\/road-alerts\/([0-9a-f-]{36})\/vote$/);
  if (voteMatch && method === "POST") {
    const id = voteMatch[1];
    const a = required(await admin.from("road_alerts").select("*").eq("id", id).maybeSingle());
    if (!a || !isAlertActive(a)) return { ok: true, gone: true };
    if (a.reported_by === uid) return { ok: true };
    const { error } = await admin.from("road_alert_votes").insert({ alert_id: id, driver_id: uid, present: Boolean(body.present) });
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
