// Legacy import path delegates to the same OpenStreetMap map as the rest of the app.
import ArchiveMap from "./ArchiveMap";
export default function MapView() {
  return (
    <div className="absolute inset-0 z-0">
      <ArchiveMap center={{ lat: 48.5734, lng: 7.7521 }} zoom={14} />
    </div>
  );
}
