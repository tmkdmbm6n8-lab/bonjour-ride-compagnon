import { useState } from "react";
import { ShieldCheck, Share2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Link from "@/lib/archive-navigation";
import { shareRideText } from "@/lib/ride-documents";

export default function RideSafety({ ride }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [copyText, setCopyText] = useState("");
  async function share() {
    const text = shareRideText(ride);
    setMessage("");
    try {
      if (navigator.share) await navigator.share({ title: "Mon trajet StrasDrive", text });
      else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setMessage("Résumé copié. Envoyez-le à la personne de votre choix.");
      } else setCopyText(text);
    } catch (err) {
      if (err.name !== "AbortError") {
        setCopyText(text);
        setMessage("Vous pouvez copier le résumé ci-dessous.");
      }
    }
  }
  return (
    <>
      <button
        type="button"
        className="btn ride-safety-button"
        aria-label="Sécurité et assistance"
        title="Sécurité et assistance"
        onClick={() => {
          setMessage("");
          setCopyText("");
          setOpen(true);
        }}
      >
        <ShieldCheck size={24} strokeWidth={2.3} aria-hidden="true" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Sécurité et assistance">
        <p className="small mb-4">
          En cas de danger immédiat, appelez les secours. StrasDrive ne contacte pas les secours à
          votre place.
        </p>
        <a href="tel:112" className="btn btn-danger btn-full mb-3">
          Appeler le 112
        </a>
        <a href="sms:114" className="btn btn-secondary btn-full mb-3">
          Contacter le 114 par SMS
        </a>
        <p className="tiny muted mb-4">
          Le 114 est accessible par SMS, notamment aux personnes sourdes ou malentendantes.
        </p>
        <button type="button" className="btn btn-secondary btn-full mb-3" onClick={share}>
          <Share2 size={16} />
          Partager le résumé du trajet
        </button>
        <p className="tiny muted mb-3">
          Vous choisissez le destinataire. Le résumé contient les adresses et le véhicule, sans code
          PIN ni lien de suivi public.
        </p>
        <Link
          href={`/contact?topic=safety&ride=${encodeURIComponent(ride.id)}`}
          className="btn btn-ghost btn-full"
        >
          Signaler un problème de sécurité
        </Link>
        <Link
          href={`/contact?topic=ride_issue&ride=${encodeURIComponent(ride.id)}`}
          className="btn btn-ghost btn-full"
        >
          Contacter l’assistance pour cette course
        </Link>
        {message && (
          <p role="status" className="small mt-3">
            {message}
          </p>
        )}
        {copyText && (
          <textarea
            className="input mt-3"
            aria-label="Résumé du trajet à copier"
            readOnly
            rows={7}
            value={copyText}
          />
        )}
      </Modal>
    </>
  );
}
