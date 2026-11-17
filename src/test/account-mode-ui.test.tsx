import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AccountModeSwitch from "@/components/shell/AccountModeSwitch";
const state = vi.hoisted(() => ({ push: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/archive-navigation", () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock("@/lib/archive-fetch", () => ({ apiFetch: state.fetch }));
beforeEach(() => {
  state.push.mockReset();
  state.fetch.mockReset();
});
afterEach(cleanup);
describe("bouton de bascule", () => {
  it("attend la mise hors ligne avant d’ouvrir l’espace passager", async () => {
    state.fetch.mockResolvedValue({ ok: true, json: async () => ({ mode: "rider" }) });
    render(<AccountModeSwitch mode="rider" />);
    expect(state.fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Passer en mode Passager" }));
    await waitFor(() => expect(state.push).toHaveBeenCalledWith("/dashboard"));
    expect(state.fetch).toHaveBeenCalledWith(
      "/api/users/me/mode",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ mode: "rider" }) }),
    );
  });
  it("reste sur l’écran actuel si la course en cours empêche la bascule", async () => {
    state.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Terminez la course" }),
    });
    render(<AccountModeSwitch mode="driver" />);
    fireEvent.click(screen.getByRole("button", { name: "Espace Chauffeur" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Terminez la course");
    expect(state.push).not.toHaveBeenCalled();
  });
});
