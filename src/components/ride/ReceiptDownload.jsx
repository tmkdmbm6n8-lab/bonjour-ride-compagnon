import { useState } from "react";
import { Download } from "lucide-react";
import { receiptHtml } from "@/lib/ride-documents";

export default function ReceiptDownload({ ride }) {
  const [error, setError] = useState("");
  if (ride.isTest || !(ride.status === "completed" || ride.fare?.cancellationFee > 0)) return null;
  function download() {
    try {
      const blob = new Blob([receiptHtml(ride)], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `strasdrive-recu-${String(ride.id)
        .replace(/[^a-zA-Z0-9-]/g, "")
        .slice(0, 60)}.html`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      setError("Le reçu n’a pas pu être téléchargé. Réessayez.");
    }
  }
  return (
    <>
      <button type="button" className="btn btn-secondary btn-sm" onClick={download}>
        <Download size={16} />
        Télécharger le reçu
      </button>
      {error && (
        <p role="alert" className="input-error-msg">
          {error}
        </p>
      )}
    </>
  );
}
