import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import RideSafety from "@/components/ride/RideSafety";
vi.mock("@/lib/archive-navigation", () => ({
  default: ({ href, children, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const ride = {
  id: "abc",
  pickup: { address: "Départ" },
  dropoff: { address: "Arrivée" },
  pin: "9999",
};
describe("assistance volontaire", () => {
  it("n’envoie rien automatiquement et ne partage que sur action explicite", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share });
    render(<RideSafety ride={ride} />);
    expect(share).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sécurité et assistance" }));
    expect(screen.getByRole("link", { name: "Appeler le 112" })).toHaveAttribute("href", "tel:112");
    expect(share).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Partager le résumé du trajet" }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(share.mock.calls[0][0].text).not.toContain("9999");
  });
  it("propose un texte à copier lorsque le partage et le presse-papiers ne sont pas disponibles", () => {
    vi.stubGlobal("navigator", {});
    render(<RideSafety ride={ride} />);
    fireEvent.click(screen.getByRole("button", { name: "Sécurité et assistance" }));
    fireEvent.click(screen.getByRole("button", { name: "Partager le résumé du trajet" }));
    expect(
      (screen.getByLabelText("Résumé du trajet à copier") as HTMLTextAreaElement).value,
    ).toContain("Référence : abc");
  });
});
