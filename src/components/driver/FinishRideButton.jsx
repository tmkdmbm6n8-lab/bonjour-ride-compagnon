import { useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import Modal from "@/components/ui/Modal";

export default function FinishRideButton({ onConfirm, disabled = false }) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  async function confirm() {
    if (pending.current || disabled) return;
    setError("");
    pending.current = true;
    setBusy(true);
    try {
      if ((await onConfirm()) !== false) setOpen(false);
    } catch {
      setError("La course n’a pas pu être terminée. Réessayez.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="btn btn-success btn-lg btn-full"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <CheckCircle2 size={18} />
        Terminer la course
      </button>
      <Modal
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        closable={!busy}
        title="Terminer cette course ?"
      >
        <p className="small mb-4">
          Êtes-vous sûr de vouloir terminer cette course ? Confirmez que le passager est arrivé à
          destination.
        </p>
        {error && (
          <p role="alert" className="input-error-msg mb-3">
            {error}
          </p>
        )}
        <div className="flex-col gap-3">
          <button
            type="button"
            className="btn btn-secondary btn-full"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Non, continuer la course
          </button>
          <button
            type="button"
            className="btn btn-success btn-full"
            disabled={busy || disabled}
            onClick={confirm}
          >
            {busy ? "Validation…" : "Oui, terminer la course"}
          </button>
        </div>
      </Modal>
    </>
  );
}
