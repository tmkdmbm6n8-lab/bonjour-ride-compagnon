import { parisDay, parisInstant, shiftDay, validDay } from "./vtc-dates";
export function plannedDeparture(value, now = Date.now()) {
  if (typeof value !== "string" || !/(Z|[+-]\d{2}:\d{2})$/i.test(value))
    throw new Error("La date de départ doit préciser son fuseau horaire.");
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= now)
    throw new Error("Choisissez une date et une heure futures.");
  return date.toISOString();
}
export function parisFormInstant(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const [day, time] = value.split("T");
  const [hour, minute] = time.split(":").map(Number);
  if (!validDay(day) || hour > 23 || minute > 59) return null;
  return parisInstant(day, hour * 3600 + minute * 60);
}
export function nextWeeklyDeparture(weekday, time, now = new Date()) {
  if (
    !Number.isInteger(weekday) ||
    weekday < 0 ||
    weekday > 6 ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time || "")
  )
    return null;
  const today = parisDay(now);
  const [hour, minute] = time.split(":").map(Number);
  for (let offset = 0; offset < 15; offset++) {
    const day = shiftDay(today, offset);
    if (new Date(day + "T12:00:00Z").getUTCDay() !== weekday) continue;
    const instant = parisInstant(day, hour * 3600 + minute * 60);
    if (instant && Date.parse(instant) > new Date(now).getTime()) return instant;
  }
  return null;
}
export function parisFormValue(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Europe/Paris",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .format(date)
        .replace(" ", "T")
    : "";
}
