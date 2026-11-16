import { describe, it, expect } from "vitest";
import { applyVote, beepIntervalMs, beepTarget, isAlertActive, findMergeTarget, radarBeepWindow } from "@/lib/vtc-road-alerts";

const now = Date.parse("2026-11-16T10:00:00Z");
const base = { id: "a", lat: 48.58, lng: 7.75, confirmations: 1, denials: 0, is_permanent: false, created_at: new Date(now).toISOString(), last_confirmed_at: new Date(now).toISOString() };

describe("signalements police / radar", () => {
  it('coupe le radar après dix secondes et ne le réarme qu’après éloignement', () => {
    const pos = { lat: 48.58, lng: 7.75 };
    const target = { alert: { ...pos, id: 'radar-1', kind: 'radar' }, distance: 0 };
    const first = radarBeepWindow(target, pos, new Map(), 0);
    expect(first.allowed).toBe(true);
    expect(radarBeepWindow(target, pos, first.windows, 9999).allowed).toBe(true);
    expect(radarBeepWindow(target, pos, first.windows, 10000).allowed).toBe(false);
    expect(radarBeepWindow(target, pos, first.windows, 60000).allowed).toBe(false);
    const away = radarBeepWindow(null, { lat: 48.59, lng: 7.75 }, first.windows, 61000);
    expect(radarBeepWindow(target, pos, away.windows, 62000).allowed).toBe(true);
  });
  it("un contrôle de police disparaît 2 h après son dernier signalement", () => {
    const a = { ...base, kind: "police" };
    expect(isAlertActive(a, now + 119 * 60_000)).toBe(true);
    expect(isAlertActive(a, now + 121 * 60_000)).toBe(false);
  });

  it("un radar reste fixe, même après un an et des « plus là »", () => {
    const radar = { ...base, kind: "radar", denials: 5 };
    expect(isAlertActive(radar, now + 365 * 864e5)).toBe(true);
    expect(applyVote(radar, false, new Date(now)).is_permanent).toBe(true);
  });

  it("3 « plus là » retirent une patrouille", () => {
    expect(isAlertActive({ ...base, kind: "police", denials: 3 }, now)).toBe(false);
  });

  it("le bip commence à 100 m, accélère tous les 10 m et reste espacé", () => {
    expect(beepIntervalMs(101)).toBeNull();
    expect(beepIntervalMs(100)).toBe(2600);
    expect(beepIntervalMs(95)).toBe(2600);
    expect(beepIntervalMs(90)).toBe(2400);
    expect(beepIntervalMs(10)).toBe(800);
  });

  it("le chauffeur qui vient de signaler n'entend pas de bip tant qu'il est sur place", () => {
    const radar = { ...base, kind: "radar" };
    const onSpot = { lat: 48.58, lng: 7.75 };
    const first = beepTarget([radar], onSpot, new Set(["a"]));
    expect(first.target).toBeNull();
    // Il s'éloigne (> 100 m) : le repère redevient bipable au prochain passage
    const away = beepTarget([radar], { lat: 48.582, lng: 7.75 }, first.silenced);
    expect(away.silenced.has("a")).toBe(false);
    expect(beepTarget([radar], onSpot, away.silenced).target?.alert.id).toBe("a");
  });

  it("un nouveau signalement du même type à moins de 60 m confirme l'existant", () => {
    const radar = { ...base, kind: "radar" };
    expect(findMergeTarget([radar], "radar", { lat: 48.5803, lng: 7.75 }, now)?.id).toBe("a");
    expect(findMergeTarget([radar], "police", { lat: 48.5803, lng: 7.75 }, now)).toBeNull();
    expect(findMergeTarget([radar], "radar", { lat: 48.59, lng: 7.75 }, now)).toBeNull();
  });
});
