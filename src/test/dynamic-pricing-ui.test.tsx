import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import DynamicPricingPanel from "@/components/admin/DynamicPricingPanel";
import { defaultDynamicConfig } from "@/lib/dynamic-pricing";
const fixture = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/components/AdminLayout", () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@/lib/archive-fetch", () => ({ apiFetch: (...args: any[]) => fixture.request(...args) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => vi.fn() }));
afterEach(() => {
  cleanup();
  fixture.request.mockReset();
});
function setup() {
  let persisted = defaultDynamicConfig();
  fixture.request.mockImplementation(async (_path: string, options: any = {}) => {
    if (options.method) {
      const b = JSON.parse(options.body);
      persisted =
        options.method === "PATCH"
          ? { ...persisted, enabled: b.enabled, revision: persisted.revision + 1 }
          : { ...b.config, revision: persisted.revision + 1 };
    }
    return { ok: true, json: async () => ({ config: structuredClone(persisted) }) };
  });
  return () => persisted;
}
it("modifie un créneau et simule instantanément sans activer la production", async () => {
  const saved = setup();
  render(<DynamicPricingPanel />);
  await screen.findByText("Niveaux et pourcentages");
  fireEvent.change(screen.getByLabelText("Niveau du créneau"), { target: { value: "very_low" } });
  expect(screen.getByText("5,33 €")).toBeDefined();
  expect(screen.getByText("12,44 €")).toBeDefined();
  expect(saved().enabled).toBe(false);
  fireEvent.change(screen.getByLabelText("StrasDrive XL Très faible"), { target: { value: "25" } });
  fireEvent.change(screen.getByLabelText("Catégorie du simulateur"), { target: { value: "xl" } });
  expect(screen.getByText("22,21 €")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer les paramètres" }));
  await waitFor(() => expect(saved().levels[0].byCategory.xl).toBe(25));
  expect(saved().zones[0].schedule[0][12]).toBe("very_low");
});
it("persiste le switch immédiatement et conserve les brouillons à enregistrer", async () => {
  const saved = setup();
  render(<DynamicPricingPanel />);
  await screen.findByText("Niveaux et pourcentages");
  fireEvent.change(screen.getByLabelText("Pourcentage général Très faible"), {
    target: { value: "-20" },
  });
  fireEvent.click(screen.getByRole("switch"));
  await waitFor(() => expect(saved().enabled).toBe(true));
  expect(saved().levels[0].percent).toBe(-30);
  expect((screen.getByLabelText("Pourcentage général Très faible") as HTMLInputElement).value).toBe(
    "-20",
  );
  await waitFor(() => expect(screen.getByRole("switch")).not.toBeDisabled());
  fireEvent.click(screen.getByRole("switch"));
  await waitFor(() => expect(saved().enabled).toBe(false));
});
it("crée, modifie et supprime une zone indépendante", async () => {
  setup();
  render(<DynamicPricingPanel />);
  await screen.findByText("Niveaux et pourcentages");
  fireEvent.click(screen.getByRole("button", { name: "Ajouter une zone" }));
  expect((screen.getByLabelText("Nom de zone") as HTMLInputElement).value).toBe("Nouvelle zone");
  fireEvent.change(screen.getByLabelText("Nom de zone"), { target: { value: "Zone test" } });
  expect(screen.getAllByText("Zone test").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Supprimer cette zone" }));
  expect(screen.queryByText("Zone test")).toBe(null);
  expect((screen.getByLabelText("Nom de zone") as HTMLInputElement).value).toBe(
    "Strasbourg – Centre",
  );
});
it("ajoute un onglet en conservant le barème classique et son brouillon", async () => {
  const { Route } = await import("@/routes/_authenticated.admin.pricing");
  fixture.request.mockImplementation(async (path: string) => ({
    ok: true,
    json: async () =>
      path === "/api/admin/pricing"
        ? {
            rules: [
              {
                vehicleType: "economy",
                baseFare: 1.9,
                perKmRate: 0.99,
                perMinRate: 0.29,
                minimumFare: 12,
                supplement: 0,
              },
            ],
          }
        : path === "/api/admin/dynamic-pricing"
          ? { config: defaultDynamicConfig() }
          : { provider: "auto" },
  }));
  const Component = Route.options.component as any;
  render(<Component />);
  await screen.findByText("Règle de calcul");
  const field = screen.getAllByRole("spinbutton")[0] as HTMLInputElement;
  fireEvent.change(field, { target: { value: "2.5" } });
  fireEvent.click(screen.getByRole("tab", { name: "Tarification dynamique" }));
  expect(screen.getByRole("heading", { name: "Niveaux et pourcentages" })).toBeVisible();
  fireEvent.click(screen.getByRole("tab", { name: "Barème classique" }));
  expect(field).toBeVisible();
  expect(field.value).toBe("2.5");
});
