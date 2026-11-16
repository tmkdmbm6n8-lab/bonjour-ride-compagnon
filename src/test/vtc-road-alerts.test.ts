import { describe, it, expect } from "vitest";
import {
  applyVote,
  beepIntervalMs,
  isAlertActive,
  findMergeTarget,
  RADAR_VALIDATIONS,
} from "@/lib/vtc-road-alerts";

const now = Date.parse("2026-11-16T10:00:00Z");
const base = { id: "a", lat: 48.58, lng: 7.75, confirmations: 1, denials: 0, is_permanent: false, created_at: new Date(now).toISOString(), last_confirmed_at: new Date(now).toISOString() };

describe("signalements police / radar", () => {
  it("un radar devient définitif à la 10e confirmation", () => {
    let a = { ...base, kind: "radar", confirmations: RADAR_VALIDATIONS - 2 };
    a = applyVote(a, true, new Date(now));
    expect(a.is_permanent).toBe(false);
    a = applyVote(a, true, new Date(now));
    expect(a.confirmations).toBe(10);
    expect(a.is_permanent).toBe(true);
  });

  it("une patrouille non reconfirmée disparaît après 45 minutes", () => {
    const a = { ...base, kind: "police" };
    expect(isAlertActive(a, now + 44 * 60_000)).toBe(true);
    expect(isAlertActive(a, now + 46 * 60_000)).toBe(false);
  });

  it("3 « plus là » retirent un repère non définitif, jamais un radar définitif", () => {
    expect(isAlertActive({ ...base, kind: "police", denials: 3 }, now)).toBe(false);
    expect(isAlertActive({ ...base, kind: "radar", denials: 3, is_permanent: true }, now + 365 * 864e5)).toBe(true);
  });

  it("le bip commence à 100 m et accélère tous les 10 m", () => {
    expect(beepIntervalMs(101)).toBeNull();
    const at100 = beepIntervalMs(100)!;
    const at90 = beepIntervalMs(90)!;
    const at10 = beepIntervalMs(10)!;
    expect(at100).toBeGreaterThan(at90);
    expect(at90).toBeGreaterThan(at10);
    expect(beepIntervalMs(95)).toBe(at100);
  });

  it("un nouveau signalement du même type à moins de 60 m confirme l'existant", () => {
    const radar = { ...base, kind: "radar" };
    expect(findMergeTarget([radar], "radar", { lat: 48.5803, lng: 7.75 }, now)?.id).toBe("a");
    expect(findMergeTarget([radar], "police", { lat: 48.5803, lng: 7.75 }, now)).toBeNull();
    expect(findMergeTarget([radar], "radar", { lat: 48.59, lng: 7.75 }, now)).toBeNull();
  });
});
