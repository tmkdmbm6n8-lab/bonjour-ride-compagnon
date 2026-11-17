import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ExternalNavigationButton from "@/components/driver/ExternalNavigationButton";
import { navigationUrl, setNavAuto, setNavApp } from "@/lib/navigation";

const openedUrls: string[] = [];
beforeEach(() => {
  localStorage.clear();
  openedUrls.length = 0;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    expect(this.target).toBe("_self");
    openedUrls.push(this.href);
  });
  vi.spyOn(window, "open").mockReturnValue(null);
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
    expect(openedUrls).toHaveLength(0);
    expect(window.open).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Démarrer le trajet" }));
    expect(screen.getByRole("button", { name: "Plans (Apple)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Google Maps" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Waze" }));
    expect(openedUrls).toEqual([navigationUrl("waze", destination)]);
  });
  it("ouvre directement le GPS préféré seulement après le clic, en mode automatique", () => {
    setNavAuto(true);
    setNavApp("apple");
    render(<ExternalNavigationButton destination={destination} />);
    expect(openedUrls).toHaveLength(0);
    expect(window.open).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Démarrer le trajet" }));
    expect(openedUrls).toEqual([navigationUrl("apple", destination)]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("annuler le choix n’ouvre aucune application", () => {
    setNavAuto(false);
    render(<ExternalNavigationButton destination={destination} />);
    fireEvent.click(screen.getByRole("button", { name: "Démarrer le trajet" }));
    fireEvent.click(screen.getByLabelText("Fermer la boîte de dialogue"));
    expect(openedUrls).toHaveLength(0);
    expect(window.open).not.toHaveBeenCalled();
  });
  it("utilise la destination de la nouvelle étape sans ouvrir le GPS au changement", () => {
    setNavAuto(true);
    setNavApp("google");
    const view = render(<ExternalNavigationButton destination={destination} />);
    const dropoff = { lat: 48.6, lng: 7.8 };
    view.rerender(<ExternalNavigationButton destination={dropoff} />);
    expect(openedUrls).toHaveLength(0);
    expect(window.open).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Démarrer le trajet" }));
    expect(openedUrls).toEqual([navigationUrl("google", dropoff)]);
  });
  it("refuse des coordonnées invalides", () => {
    expect(navigationUrl("google", { lat: 91, lng: 0 })).toBeNull();
    expect(navigationUrl("apple", {})).toBeNull();
  });
  it("ne signale pas de faux échec lorsque Safari ne fournit pas de fenêtre", () => {
    setNavAuto(true);
    setNavApp("google");
    render(<ExternalNavigationButton destination={destination} />);
    fireEvent.click(screen.getByRole("button", { name: "Démarrer le trajet" }));
    expect(openedUrls).toHaveLength(1);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(window.open).not.toHaveBeenCalled();
  });
  it("signale une destination invalide sans lancer de lien", () => {
    setNavAuto(true);
    setNavApp("google");
    render(<ExternalNavigationButton destination={{ lat: 91, lng: 7 }} />);
    fireEvent.click(screen.getByRole("button", { name: "Démarrer le trajet" }));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(openedUrls).toHaveLength(0);
  });
  it("ouvre le GPS enregistré même si l’ancien réglage automatique était désactivé", () => {
    setNavAuto(false);
    setNavApp("waze");
    render(<ExternalNavigationButton destination={destination} />);
    fireEvent.click(screen.getByRole("button", { name: "Démarrer le trajet" }));
    expect(openedUrls).toEqual([navigationUrl("waze", destination)]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("mémorise le premier choix et ne redemande pas lors du trajet suivant", () => {
    render(<ExternalNavigationButton destination={destination} />);
    fireEvent.click(screen.getByRole("button", { name: "Démarrer le trajet" }));
    fireEvent.click(screen.getByRole("button", { name: "Plans (Apple)" }));
    fireEvent.click(screen.getByRole("button", { name: "Démarrer le trajet" }));
    expect(openedUrls).toEqual([
      navigationUrl("apple", destination),
      navigationUrl("apple", destination),
    ]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
