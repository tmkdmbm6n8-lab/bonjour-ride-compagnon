import { describe, expect, it } from "vitest";
import { interpolateFix, interpolateHeading } from "@/lib/map-motion";

describe("animation du suivi GPS", () => {
  it("traverse le nord sans faire un tour complet", () => {
    expect(interpolateHeading(359, 1, 0.5)).toBe(0);
    expect(interpolateHeading(1, 359, 0.5)).toBe(0);
  });
  it("interpole le trajet sans dépasser la position GPS reçue", () => {
    const from = { lat: 48, lng: 7, heading: 350 };
    const to = { lat: 49, lng: 8, heading: 10 };
    expect(interpolateFix(from, to, 0.5)).toEqual({ lat: 48.5, lng: 7.5, heading: 0 });
    expect(interpolateFix(from, to, 1)).toEqual(to);
  });
});
