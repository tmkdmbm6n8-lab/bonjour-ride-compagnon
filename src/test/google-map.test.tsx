import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import MapView from "@/components/maps/MapView";

const fakes = vi.hoisted(() => ({
  load: vi.fn(),
  marker: vi.fn(),
  camera: vi.fn(),
  panTo: vi.fn(),
  remove: vi.fn(),
  line: vi.fn(),
}));
vi.mock("@/lib/google-maps-browser", () => ({
  loadGoogleMaps: fakes.load,
  createHtmlMarker: fakes.marker,
  cameraViewport: fakes.camera,
}));
vi.mock("@/hooks/useMapSpeedCameras", () => ({
  default: () => [
    { id: "osm-1", source: "osm", kind: "radar", lat: 48.58, lng: 7.74, permanent: true },
  ],
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  fakes.marker.mockImplementation(() => ({ remove: fakes.remove }));
  fakes.load.mockResolvedValue({
    Map: class {
      addListener() {
        return { remove() {} };
      }
      panTo = fakes.panTo;
      setZoom() {}
      getZoom() {
        return 13;
      }
      setTilt() {}
      setHeading() {}
    },
    Polyline: class {
      constructor(options: unknown) {
        fakes.line(options);
      }
      setMap() {}
    },
    event: { trigger() {}, clearInstanceListeners() {} },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("carte Google et radars", () => {
  it("affiche une erreur exploitable quand Google ne peut pas charger", async () => {
    fakes.load.mockRejectedValueOnce(new Error("Clé navigateur manquante"));
    render(<MapView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Clé navigateur manquante");
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
  });
  it("conserve les radars OSM pour le chauffeur après le chargement asynchrone", async () => {
    render(<MapView showRoadAlerts userPosition={{ lat: 48.57, lng: 7.75 }} />);
    await waitFor(() =>
      expect(fakes.marker.mock.calls.some((call) => call[3].title === "Radar OpenStreetMap")).toBe(
        true,
      ),
    );
    expect(fakes.panTo).toHaveBeenCalledWith({ lat: 48.57, lng: 7.75 });
    expect(screen.getByText("© OpenStreetMap")).toBeTruthy();
  });
  it("ne dessine aucun radar dans les cartes passager et nettoie les marqueurs", async () => {
    const view = render(
      <MapView
        pickup={{ lat: 48.57, lng: 7.75 }}
        alerts={[{ id: "private", kind: "radar", lat: 48.58, lng: 7.76 }]}
      />,
    );
    await waitFor(() => expect(fakes.marker).toHaveBeenCalled());
    expect(fakes.marker.mock.calls.some((call) => call[3].className.includes("road-alert"))).toBe(
      false,
    );
    expect(screen.queryByText("© OpenStreetMap")).toBeNull();
    view.unmount();
    expect(fakes.remove).toHaveBeenCalled();
  });
  it("trace le parcours dans l’ordre latitude/longitude attendu par Google", async () => {
    render(
      <MapView
        routeGeometry={[
          [7.75, 48.57],
          [7.76, 48.58],
        ]}
      />,
    );
    await waitFor(() =>
      expect(fakes.line).toHaveBeenCalledWith(
        expect.objectContaining({
          path: [
            { lat: 48.57, lng: 7.75 },
            { lat: 48.58, lng: 7.76 },
          ],
        }),
      ),
    );
  });
});
