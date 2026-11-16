import { useState } from "react";
import { Navigation } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { NAV_APPS, getNavApp, getNavAuto, setNavApp, openNavigation } from "@/lib/navigation";

/** Only a deliberate click may open a GPS app, never accepting a ride or starting its PIN. */
export default function ExternalNavigationButton({ destination }) {
  const [choosing, setChoosing] = useState(false);
  const [error, setError] = useState("");
  function launch(app) {
    setError("");
    if (openNavigation(app, destination)) {
      setNavApp(app);
      setChoosing(false);
    } else setError("Le GPS n’a pas pu s’ouvrir. Réessayez ou choisissez une autre application.");
  }
  function startJourney() {
    if (getNavAuto()) launch(getNavApp());
    else {
      setError("");
      setChoosing(true);
    }
  }
  return (
    <>
      <button type="button" className="btn btn-secondary btn-full mb-3" onClick={startJourney}>
        <Navigation size={18} /> Démarrer le trajet
      </button>
      {error && !choosing && (
        <p className="input-error-msg mb-3" role="alert">
          {error}
        </p>
      )}
      <Modal open={choosing} onClose={() => setChoosing(false)} title="Choisir votre GPS">
        <p className="muted small mb-4">Ouvrir le trajet dans :</p>
        <div className="flex-col gap-3">
          {Object.entries(NAV_APPS).map(([id, label]) => (
            <button
              type="button"
              key={id}
              className="btn btn-secondary btn-full"
              onClick={() => launch(id)}
            >
              <Navigation size={18} />
              {label}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="input-error-msg mt-3">
            {error}
          </p>
        )}
      </Modal>
    </>
  );
}
