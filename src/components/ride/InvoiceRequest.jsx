import { useRef, useState } from "react";
import { apiFetch } from "@/lib/archive-fetch";

/** Request only: issuance requires the real issuer and persistent accounting service. */
export default function InvoiceRequest({ ride }) {
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  if (ride.isTest || !(ride.status === "completed" || ride.fare?.cancellationFee > 0)) return null;
  async function requestInvoice() {
    if (pending.current || state === "sent") return;
    pending.current = true;
    setState("sending");
    setMessage("");
    try {
      const response = await apiFetch(`/api/rides/${ride.id}/invoice`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Demande indisponible. Réessayez.");
      setState("sent");
      setMessage(data.message);
    } catch (err) {
      setState("error");
      setMessage(err.message || "Demande indisponible. Réessayez.");
    } finally {
      pending.current = false;
    }
  }
  return (
    <div>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={state === "sending" || state === "sent"}
        onClick={requestInvoice}
      >
        {state === "sending"
          ? "Envoi…"
          : state === "sent"
            ? "Demande transmise"
            : "Demander une facture"}
      </button>
      {message && (
        <p className="small mt-2" role={state === "error" ? "alert" : "status"}>
          {message}
        </p>
      )}
    </div>
  );
}
