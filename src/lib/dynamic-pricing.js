import history from "@/data/dynamic-demand-history.json";
import { driverMinimumNet, minimumPassengerTotal } from "./vtc-pricing";
export const DYNAMIC_KEY = "dynamic_pricing";
export const CATEGORY_IDS = ["economy", "comfort", "pet", "xl"];
export const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
export const LEVELS = [
  { id: "very_low", label: "Très faible", color: "#8b9099", percent: -30 },
  { id: "low", label: "Faible", color: "#42b978", percent: -25 },
  { id: "medium", label: "Moyenne", color: "#e5c94c", percent: -15 },
  { id: "high", label: "Forte", color: "#f09640", percent: -5 },
  { id: "very_high", label: "Très forte", color: "#e96868", percent: 0 },
];
const ZONES = [
  ["strasbourg-centre", "Strasbourg – Centre", 48.5839, 7.7455, 3],
  ["strasbourg-nord", "Strasbourg – Nord", 48.633, 7.744, 5],
  ["strasbourg-sud-ouest", "Strasbourg – Sud-Ouest", 48.561, 7.683, 4.5],
  ["strasbourg-nord-ouest", "Strasbourg – Nord-Ouest", 48.618, 7.69, 4.5],
  ["molsheim", "Molsheim et alentours", 48.543, 7.493, 8],
  ["haguenau", "Haguenau et alentours", 48.815, 7.791, 10],
  ["selestat", "Sélestat et alentours", 48.26, 7.455, 8],
];
const clone = (value) => JSON.parse(JSON.stringify(value));
export const roundPrice = (value) =>
  Math.round((value + Number.EPSILON * Math.max(1, Math.abs(value))) * 100) / 100;
export const emptySchedule = () => Array.from({ length: 7 }, () => Array(24).fill(null));
export function defaultDynamicConfig() {
  const zones = ZONES.map(([id, name, lat, lng, radiusKm]) => ({
    id,
    name,
    lat,
    lng,
    radiusKm,
    enabled: true,
    schedule: emptySchedule(),
  }));
  for (const record of history.records) {
    const zone = zones.find((item) => item.id === record.zoneId);
    record.levels.forEach((level, index) => {
      const hour = record.firstHour + index;
      zone.schedule[(record.day + Math.floor(hour / 24)) % 7][hour % 24] = LEVELS[level].id;
    });
  }
  return {
    version: 1,
    revision: 0,
    enabled: false,
    levels: LEVELS.map((level) => ({ ...level, byCategory: {} })),
    zones,
  };
}
export function validateDynamicConfig(input) {
  if (
    !input ||
    input.version !== 1 ||
    typeof input.enabled !== "boolean" ||
    !Array.isArray(input.levels) ||
    input.levels.length !== 5 ||
    !Array.isArray(input.zones) ||
    input.zones.length > 100
  )
    throw new Error("Configuration dynamique invalide");
  const percentage = (value) =>
    typeof value === "number" && Number.isFinite(value) && value >= -100 && value <= 10000;
  const levels = LEVELS.map((definition) => {
    const found = input.levels.filter((level) => level?.id === definition.id);
    if (found.length !== 1 || !percentage(found[0].percent))
      throw new Error("Chaque pourcentage doit être compris entre −100 % et +10 000 %.");
    const byCategory = {};
    for (const type of CATEGORY_IDS) {
      const value = found[0].byCategory?.[type];
      if (value !== null && value !== undefined && !percentage(value))
        throw new Error("Pourcentage de catégorie invalide");
      if (value !== null && value !== undefined) byCategory[type] = value;
    }
    return { ...definition, percent: found[0].percent, byCategory };
  });
  const ids = new Set();
  const zones = input.zones.map((zone) => {
    if (
      !zone ||
      typeof zone.id !== "string" ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(zone.id) ||
      ids.has(zone.id) ||
      typeof zone.name !== "string" ||
      !zone.name.trim() ||
      zone.name.length > 100 ||
      typeof zone.enabled !== "boolean"
    )
      throw new Error("Nom ou identifiant de zone invalide");
    ids.add(zone.id);
    if (
      !Number.isFinite(zone.lat) ||
      Math.abs(zone.lat) > 90 ||
      !Number.isFinite(zone.lng) ||
      Math.abs(zone.lng) > 180 ||
      !Number.isFinite(zone.radiusKm) ||
      zone.radiusKm < 0.1 ||
      zone.radiusKm > 200
    )
      throw new Error("Coordonnées ou rayon de zone invalides");
    if (
      !Array.isArray(zone.schedule) ||
      zone.schedule.length !== 7 ||
      zone.schedule.some(
        (day) =>
          !Array.isArray(day) ||
          day.length !== 24 ||
          day.some((level) => level !== null && !LEVELS.some((item) => item.id === level)),
      )
    )
      throw new Error("Chaque zone doit comporter exactement 7 jours et 24 heures par jour.");
    return {
      id: zone.id,
      name: zone.name.trim(),
      lat: zone.lat,
      lng: zone.lng,
      radiusKm: zone.radiusKm,
      enabled: zone.enabled,
      schedule: clone(zone.schedule),
    };
  });
  return {
    version: 1,
    revision: Number.isInteger(input.revision) && input.revision >= 0 ? input.revision : 0,
    enabled: input.enabled,
    levels,
    zones,
  };
}
export function parisSlot(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Date de départ invalide");
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris",
      weekday: "short",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((item) => [item.type, item.value]),
  );
  return {
    day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.weekday),
    hour: Number(parts.hour),
  };
}
export function zoneForPoint(zones, point) {
  if (
    !Number.isFinite(point?.lat) ||
    Math.abs(point.lat) > 90 ||
    !Number.isFinite(point?.lng) ||
    Math.abs(point.lng) > 180
  )
    return null;
  const radians = (n) => (n * Math.PI) / 180;
  let best = null,
    score = Infinity;
  for (const zone of zones) {
    if (!zone.enabled) continue;
    const a =
      Math.sin(radians(point.lat - zone.lat) / 2) ** 2 +
      Math.cos(radians(point.lat)) *
        Math.cos(radians(zone.lat)) *
        Math.sin(radians(point.lng - zone.lng) / 2) ** 2;
    const km = 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
    const distance = km / zone.radiusKm;
    if (distance <= 1 && distance < score) {
      best = zone;
      score = distance;
    }
  }
  return best;
}
export function slotAdjustment(config, zone, day, hour, category) {
  if (
    !config?.enabled ||
    !zone?.enabled ||
    !Number.isInteger(day) ||
    day < 0 ||
    day > 6 ||
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23 ||
    !CATEGORY_IDS.includes(category)
  )
    return { percent: 0, level: null };
  const level = config.levels.find((item) => item.id === zone.schedule[day][hour]);
  return {
    percent: level?.byCategory?.[category] ?? level?.percent ?? 0,
    level: level?.id ?? null,
  };
}
export function simulateDynamicPrice(config, { initialPrice, zoneId, day, hour, category }) {
  if (!Number.isFinite(initialPrice) || initialPrice < 0 || !CATEGORY_IDS.includes(category))
    throw new Error("Prix initial ou catégorie invalide");
  const zone = config?.zones.find((item) => item.id === zoneId);
  const adjustment = slotAdjustment(config, zone, day, hour, category);
  const finalPrice = roundPrice(initialPrice * (1 + adjustment.percent / 100));
  if (!Number.isFinite(finalPrice) || finalPrice * 100 > Number.MAX_SAFE_INTEGER)
    throw new Error("Montant de simulation invalide");
  return {
    initialPrice: roundPrice(initialPrice),
    percent: adjustment.percent,
    amount: roundPrice(finalPrice - initialPrice),
    finalPrice,
    level: adjustment.level,
  };
}
export function applyDynamicPricing(
  fare,
  { config, pickup, category, departureAt, meters, seconds },
) {
  if (!config?.enabled) return fare;
  try {
    const zone = zoneForPoint(config.zones, pickup);
    const { day, hour } = parisSlot(departureAt);
    const { percent, level } = slotAdjustment(config, zone, day, hour, category);
    if (!zone || !level) return fare;
    const nominalTotal = roundPrice(fare.total * (1 + percent / 100));
    const minimum = minimumPassengerTotal(
      driverMinimumNet(meters, seconds),
      fare.platformCommission,
    );
    const total = Math.max(nominalTotal, minimum);
    if (!Number.isFinite(total) || total * 100 > Number.MAX_SAFE_INTEGER) return fare;
    const platformFee = Math.round(total * fare.platformCommission) / 100;
    const amount = roundPrice(total - fare.total);
    return {
      ...fare,
      total,
      estimatedTotal: total,
      originalTotal: fare.total,
      platformFee,
      driverEarnings: roundPrice(total - platformFee),
      discount: Math.max(0, -amount),
      discountRate: amount < 0 && fare.total > 0 ? -amount / fare.total : 0,
      dynamicPricing: {
        version: 1,
        revision: config.revision,
        baseTotal: fare.total,
        percent,
        nominalTotal,
        amount,
        minimumProtected: total > nominalTotal,
        zoneId: zone.id,
        zoneName: zone.name,
        day,
        hour,
        level,
        departureAt: new Date(departureAt ?? Date.now()).toISOString(),
      },
    };
  } catch {
    return fare;
  }
}
