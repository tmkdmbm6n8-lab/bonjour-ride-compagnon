import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ExternalNavigationButton from "@/components/driver/ExternalNavigationButton";
import { navigationUrl, setNavAuto, setNavApp } from "@/lib/navigation";

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(window, "open").mockReturnValue({ opener: null } as Window);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const destination = { lat: 48.57, lng: 7.75 };
describe("GPS uniquement au clic sur Démarrer le trajet", () => {
  it("n’ouvre rien à l’affichage et propose les trois GPS en mode manuel", () => {
    setNavAuto(false);
    render(<ExternalNavigationButton destination={destination} />);
    expect(window.open).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Démarrer le trajet" }));
    expect(screen.getByRole("button", { name: "Plans (Apple)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Google Maps" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Waze" }));
    expect(window.open).toHaveBeenCalledWith(navigationUrl("waze", destination), "_blank");
  });
  it("ouvre directement le GPS préféré seulement après le clic, en mode automatique", () => {
    setNavAuto(true);
    setNavApp("apple");
    render(<ExternalNavigationButton destination={destination} />);
    expect(window.open).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Démarrer le trajet" }));
    expect(window.open).toHaveBeenCalledWith(navigationUrl("apple", destination), "_blank");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("annuler le choix n’ouvre aucune application", () => {
    setNavAuto(false);
    render(<ExternalNavigationButton destination={destination} />);
    fireEvent.click(screen.getByRole("button", { name: "Démarrer le trajet" }));
    fireEvent.click(screen.getByLabelText("Fermer la boîte de dialogue"));
    expect(window.open).not.toHaveBeenCalled();
  });
  it("utilise la destination de la nouvelle étape sans ouvrir le GPS au changement", () => {
    setNavAuto(true);
    const view = render(<ExternalNavigationButton destination={destination} />);
    const dropoff = { lat: 48.6, lng: 7.8 };
    view.rerender(<ExternalNavigationButton destination={dropoff} />);
    expect(window.open).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Démarrer le trajet" }));
    expect(window.open).toHaveBeenCalledWith(navigationUrl("google", dropoff), "_blank");
  });
  it("refuse des coordonnées invalides", () => {
    expect(navigationUrl("google", { lat: 91, lng: 0 })).toBeNull();
    expect(navigationUrl("apple", {})).toBeNull();
  });
});
