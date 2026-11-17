import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
const state = vi.hoisted(() => ({
  path: "/dashboard",
  role: "driver",
  canDrive: true,
  fetch: vi.fn(),
}));
vi.mock("@/lib/archive-navigation", () => ({ usePathname: () => state.path }));
vi.mock("@/lib/archive-auth", () => ({
  useSession: () => ({
    status: "authenticated",
    data: { user: { id: "self", role: state.role, canDrive: state.canDrive } },
  }),
}));
vi.mock("@/lib/archive-fetch", () => ({ apiFetch: state.fetch }));
import { SocketProvider } from "@/context/SocketProvider";
beforeEach(() => {
  state.path = "/dashboard";
  state.role = "driver";
  state.canDrive = true;
  state.fetch.mockReset();
  state.fetch.mockImplementation(async () => ({
    ok: true,
    json: async () => ({ ride: null, offer: null }),
  }));
});
afterEach(cleanup);
describe("suivi selon l’espace ouvert", () => {
  it("ne demande pas d’offres chauffeur dans le mode passager du même compte", async () => {
    const view = render(
      <SocketProvider>
        <div />
      </SocketProvider>,
    );
    await waitFor(() => expect(state.fetch).toHaveBeenCalledWith("/api/rides/active?view=rider"));
    expect(state.fetch.mock.calls.some(([path]) => path === "/api/drivers/offers")).toBe(false);
    state.path = "/driver/dashboard";
    view.rerender(
      <SocketProvider>
        <div />
      </SocketProvider>,
    );
    await waitFor(() => expect(state.fetch).toHaveBeenCalledWith("/api/drivers/offers"));
    await waitFor(() => expect(state.fetch).toHaveBeenCalledWith("/api/rides/active?view=driver"));
  });
  it("permet aussi le suivi passager à un administrateur", async () => {
    state.role = "admin";
    state.canDrive = false;
    render(
      <SocketProvider>
        <div />
      </SocketProvider>,
    );
    await waitFor(() => expect(state.fetch).toHaveBeenCalledWith("/api/rides/active?view=rider"));
    expect(state.fetch.mock.calls.some(([path]) => path === "/api/drivers/offers")).toBe(false);
  });
});
