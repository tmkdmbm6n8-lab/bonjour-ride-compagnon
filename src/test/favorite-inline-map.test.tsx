// @ts-nocheck
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import FavoriteDriverLiveMap from "@/components/private-clients/FavoriteDriverLiveMap";

const mock = vi.hoisted(() => ({ refresh: null, request: vi.fn() }));
vi.mock("@/lib/live-refresh", () => ({
  watchRefresh: (refresh) => {
    mock.refresh = () => refresh(() => true, new AbortController().signal);
    return vi.fn();
  },
}));
vi.mock("@/lib/archive-fetch", () => ({ apiFetch: mock.request }));
vi.mock("@/components/maps/MapView", () => ({
  default: ({ drivers }) => <div aria-label="Carte GPS">{drivers.length} repère</div>,
}));

afterEach(cleanup);

it("garde la carte montée et ajoute ou retire le repère lorsque le statut change", async () => {
  render(<FavoriteDriverLiveMap driverId="driver" />);
  const map = await screen.findByLabelText("Carte GPS");
  expect(map.textContent).toBe("0 repère");

  for (const [data, count] of [
    [{ driverId: "driver", status: "online", position: { lat: 48.58, lng: 7.75 }, expiresInMs: 30000 }, 1],
    [{ driverId: "driver", status: "offline" }, 0],
    [{ driverId: "other", status: "online", position: { lat: 48.58, lng: 7.75 }, expiresInMs: 30000 }, 0],
  ]) {
    mock.request.mockResolvedValueOnce({ ok: true, json: async () => data });
    await act(async () => { await mock.refresh(); });
    expect(screen.getByLabelText("Carte GPS")).toBe(map);
    expect(map.textContent).toBe(`${count} repère`);
  }
  expect(screen.queryByRole("dialog")).toBeNull();
});
