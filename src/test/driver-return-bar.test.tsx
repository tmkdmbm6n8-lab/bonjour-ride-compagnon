import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
const state = vi.hoisted(() => ({
  user: { id: "self", role: "rider", canDrive: false } as {
    id: string;
    role: string;
    canDrive: boolean;
  } | null,
  fetch: vi.fn(),
}));
vi.mock("@/lib/archive-auth", () => ({ useSession: () => ({ data: { user: state.user } }) }));
vi.mock("@/lib/archive-fetch", () => ({ apiFetch: state.fetch }));
vi.mock("@/components/shell/AccountModeSwitch", () => ({
  default: () => <button>Espace Chauffeur</button>,
}));
import DriverReturnBar from "@/components/shell/DriverReturnBar";
beforeEach(() => {
  state.user = { id: "self", role: "rider", canDrive: false };
  state.fetch.mockReset();
});
afterEach(cleanup);
describe("retour chauffeur réservé aux comptes chauffeurs", () => {
  it("rend le retour visible pour un chauffeur passé en mode passager", async () => {
    state.user = { id: "self", role: "driver", canDrive: true };
    state.fetch.mockResolvedValue({ ok: true, json: async () => ({ user: state.user }) });
    render(<DriverReturnBar />);
    expect(screen.getByRole("button", { name: "Espace Chauffeur" })).toBeVisible();
    await waitFor(() => expect(state.fetch).toHaveBeenCalled());
  });
  it("n’affiche jamais le retour pour un client normal", async () => {
    state.fetch.mockResolvedValue({ ok: true, json: async () => ({ user: state.user }) });
    render(<DriverReturnBar />);
    await waitFor(() => expect(state.fetch).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Espace Chauffeur" })).toBeNull();
  });
  it("retrouve le droit chauffeur depuis le serveur si la session affichée est ancienne", async () => {
    state.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ user: { id: "self", role: "driver", canDrive: true } }),
    });
    render(<DriverReturnBar />);
    expect(await screen.findByRole("button", { name: "Espace Chauffeur" })).toBeVisible();
  });
  it("reste masqué pendant le chargement du compte", () => {
    state.user = null;
    render(<DriverReturnBar />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(state.fetch).not.toHaveBeenCalled();
  });
});
