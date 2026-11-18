import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import RiderAccountMenu from "@/components/shell/RiderAccountMenu";

const state = vi.hoisted(() => ({ driver: false }));
vi.mock("@/lib/archive-navigation", () => ({
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
  usePathname: () => "/dashboard",
}));
vi.mock("@/lib/archive-fetch", () => ({ apiFetch: async (path: string) => ({ ok: true, json: async () => path === "/api/drivers/me" ? { driver: { vehicle: { make: "Renault", model: "Scenic", plate: "AA-123-AA" } } } : { user: { id: "1", name: "Alex", canDrive: state.driver, wallet: { balance: 0 }, rating: { count: 1, average: 5 } } } }) }));
vi.mock("@/lib/archive-auth", () => ({ signOut: vi.fn() }));
vi.mock("@/components/shell/AccountModeSwitch", () => ({ default: () => <div>Espace Chauffeur</div> }));
vi.mock("@/components/driver/DriverProfileOverview", () => ({ default: ({ open }: any) => open ? <div>Distinctions chauffeur</div> : null }));
vi.mock("@/components/driver/Waybill", () => ({ default: ({ open }: any) => open ? <div>Bulletin chauffeur</div> : null }));
vi.mock("@/components/ui/Modal", () => ({ default: ({ open, children }: any) => open ? <div>{children}</div> : null }));

afterEach(cleanup);
describe("menu chauffeur sur ordinateur", () => {
  it("propose les outils du chauffeur et ouvre sa feuille de route", async () => {
    state.driver = true;
    render(<RiderAccountMenu user={{ id: "1", name: "Alex" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir le menu du compte" }));
    expect(await screen.findByText("Véhicule & Documents")).toBeTruthy();
    expect(screen.getByText("Portefeuille & Virements").closest("a")?.getAttribute("href")).toBe("/driver/wallet");
    await waitFor(() => expect(screen.getByText(/Renault Scenic/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Feuille de route VTC/ }));
    expect(screen.getByText("Bulletin chauffeur")).toBeTruthy();
  });
  it("ne présente pas les outils chauffeur à un compte passager", async () => {
    state.driver = false;
    render(<RiderAccountMenu user={{ id: "1", name: "Alex" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir le menu du compte" }));
    await waitFor(() => expect(screen.queryByText("Véhicule & Documents")).toBeNull());
  });
});
