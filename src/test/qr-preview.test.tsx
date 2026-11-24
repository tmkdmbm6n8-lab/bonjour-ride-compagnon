// @ts-nocheck
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Route } from "../routes/_authenticated.driver.private-clients";

const native = vi.hoisted(() => ({ start: vi.fn(async () => {}), stop: vi.fn(async () => {}) }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isPluginAvailable: () => true },
  registerPlugin: () => native,
}));
vi.mock("@/components/DriverLayout", () => ({ default: ({ children }) => children }));
vi.mock("@/hooks/useDriverData", () => ({ default: () => ({
  data: { clients: [], gold: { active: true } },
}) }));
vi.mock("@/lib/archive-fetch", () => ({
  apiFetch: async () => ({ ok: true, json: async () => ({ token: "test-token" }) }),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete HTMLDialogElement.prototype.showModal;
  delete HTMLDialogElement.prototype.close;
  vi.clearAllMocks();
});

it("shows the existing QR alone, then closes and restores native brightness after five seconds", async () => {
  const prototype = HTMLDialogElement.prototype;
  Object.defineProperties(prototype, {
    showModal: { configurable: true, value() { this.open = true; } },
    close: { configurable: true, value() { this.open = false; } },
  });
  const Page = Route.options.component;
  render(<Page />);
  await screen.findByRole("img", { name: "QR code à scanner par votre client" });
  await waitFor(() => expect(screen.getByRole("button", { name: "Afficher mon QR code" })).toBeEnabled());
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole("button", { name: "Afficher mon QR code" }));
  const preview = screen.getByLabelText("QR code d’invitation");
  expect(preview.children).toHaveLength(1);
  expect(preview.firstElementChild.src).toBe(screen.getAllByRole("img")[0].src);
  expect(native.start).toHaveBeenCalledOnce();
  act(() => vi.advanceTimersByTime(4999));
  expect(preview.isConnected).toBe(true);
  act(() => vi.advanceTimersByTime(1));
  expect(preview.isConnected).toBe(false);
  expect(native.stop).toHaveBeenCalledOnce();
});
