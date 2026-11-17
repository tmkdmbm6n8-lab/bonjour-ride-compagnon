import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import RidePauseButton from "@/components/driver/RidePauseButton";
import FinishRideButton from "@/components/driver/FinishRideButton";

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
describe("pause unique par course", () => {
  it("démarre au premier clic et interdit de réutiliser la minute restante après arrêt", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T12:00:00Z"));
    const view = render(<RidePauseButton rideId="one" />);
    fireEvent.click(screen.getByRole("button", { name: "Pause · 2 min" }));
    expect(screen.getByRole("button", { name: "Arrêter · 2:00" })).toBeTruthy();
    act(() => vi.advanceTimersByTime(60000));
    fireEvent.click(screen.getByRole("button", { name: "Arrêter · 1:00" }));
    expect(screen.getByRole("button", { name: "Pause utilisée" })).toBeDisabled();
    view.unmount();
    render(<RidePauseButton rideId="one" />);
    expect(screen.getByRole("button", { name: "Pause utilisée" })).toBeDisabled();
  });
  it("ne redonne pas deux minutes après un rechargement et expire à l’heure prévue", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T12:00:00Z"));
    const view = render(<RidePauseButton rideId="one" />);
    fireEvent.click(screen.getByRole("button"));
    act(() => vi.advanceTimersByTime(60000));
    view.unmount();
    render(<RidePauseButton rideId="one" />);
    expect(screen.getByRole("button", { name: "Arrêter · 1:00" })).toBeTruthy();
    act(() => vi.advanceTimersByTime(60000));
    expect(screen.getByRole("button", { name: "Pause utilisée" })).toBeDisabled();
  });
  it("donne une nouvelle pause à une autre course", () => {
    localStorage.setItem(
      "strasdrive:ride-pause:old",
      JSON.stringify({ startedAt: Date.now(), stopped: true }),
    );
    render(<RidePauseButton rideId="new" />);
    expect(screen.getByRole("button", { name: "Pause · 2 min" })).not.toBeDisabled();
  });
});
describe("confirmation de fin de course", () => {
  it("ne termine rien avant confirmation et permet d’annuler", () => {
    const finish = vi.fn();
    render(<FinishRideButton onConfirm={finish} />);
    fireEvent.click(screen.getByRole("button", { name: "Terminer la course" }));
    expect(screen.getByRole("dialog", { name: "Terminer cette course ?" })).toBeTruthy();
    expect(finish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Non, continuer la course" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(finish).not.toHaveBeenCalled();
  });
  it("envoie une seule confirmation même en cas de clics rapides", async () => {
    let resolve: (value: boolean) => void = () => {};
    const finish = vi.fn(
      () =>
        new Promise<boolean>((done) => {
          resolve = done;
        }),
    );
    render(<FinishRideButton onConfirm={finish} />);
    fireEvent.click(screen.getByRole("button", { name: "Terminer la course" }));
    const confirm = screen.getByRole("button", { name: "Oui, terminer la course" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(finish).toHaveBeenCalledTimes(1);
    await act(async () => resolve(true));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("garde la confirmation ouverte si la fin échoue", async () => {
    const finish = vi.fn().mockResolvedValue(false);
    render(<FinishRideButton onConfirm={finish} />);
    fireEvent.click(screen.getByRole("button", { name: "Terminer la course" }));
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Oui, terminer la course" })),
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
