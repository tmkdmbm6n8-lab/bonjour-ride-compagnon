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
  traffic: vi.fn(),
  path: vi.fn(),
  markerPosition: vi.fn(),
  mapOptions: vi.fn(),
  moveCamera: vi.fn(),
  rendering: "VECTOR",
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
  fakes.rendering = "VECTOR";
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  fakes.marker.mockImplementation(() => ({
    remove: fakes.remove,
    setPosition: fakes.markerPosition,
  }));
  fakes.load.mockResolvedValue({
    TrafficLayer: class {
      setMap = fakes.traffic;
    },
    RenderingType: { VECTOR: "VECTOR", RASTER: "RASTER" },
    ColorScheme: { DARK: "DARK" },
    Map: class {
      constructor(_container: unknown, options: unknown) {
        fakes.mapOptions(options);
      }
      getRenderingType() {
        return fakes.rendering;
      }
      getHeading() {
        return 0;
      }
      moveCamera = fakes.moveCamera;
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
      setPath = fakes.path;
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
      expect(fakes.path).toHaveBeenCalledWith([
        { lat: 48.57, lng: 7.75 },
        { lat: 48.58, lng: 7.76 },
      ]),
    );
  });
  it("active le rendu vectoriel et suit le cap en vue inclinée", async () => {
    render(<MapView navigationMode followPosition={{ lat: 48.57, lng: 7.75, heading: 95 }} />);
    await waitFor(() =>
      expect(fakes.moveCamera).toHaveBeenCalledWith({
        center: { lat: 48.57, lng: 7.75 },
        zoom: 18,
        tilt: 60,
        heading: 95,
      }),
    );
    expect(fakes.mapOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        renderingType: "VECTOR",
        tiltInteractionEnabled: true,
        headingInteractionEnabled: true,
      }),
    );
  });
  it("signale le mode 2D si l’appareil refuse le rendu vectoriel", async () => {
    fakes.rendering = "RASTER";
    render(<MapView navigationMode followPosition={{ lat: 48.57, lng: 7.75, heading: 95 }} />);
    expect(await screen.findByText(/Vue 3D indisponible/)).toBeTruthy();
    await waitFor(() =>
      expect(fakes.moveCamera).toHaveBeenLastCalledWith(
        expect.objectContaining({ tilt: 0, heading: 0 }),
      ),
    );
  });
  it("conserve le curseur bleu entre deux positions GPS", async () => {
    const view = render(
      <MapView navigationMode userPosition={{ lat: 48.57, lng: 7.75, heading: 0 }} />,
    );
    await waitFor(() =>
      expect(
        fakes.marker.mock.calls.some((call) => call[3].className === "google-navigation-marker"),
      ).toBe(true),
    );
    view.rerender(
      <MapView navigationMode userPosition={{ lat: 48.5701, lng: 7.7501, heading: 10 }} />,
    );
    expect(
      fakes.marker.mock.calls.filter((call) => call[3].className === "google-navigation-marker"),
    ).toHaveLength(1);
    expect(fakes.markerPosition).toHaveBeenCalled();
  });
  it("active le trafic Google et le détache au démontage", async () => {
    const view = render(<MapView />);
    await waitFor(() => expect(fakes.traffic).toHaveBeenCalled());
    expect(fakes.traffic.mock.calls[0][0]).toBeTruthy();
    view.unmount();
    expect(fakes.traffic).toHaveBeenLastCalledWith(null);
  });
});
