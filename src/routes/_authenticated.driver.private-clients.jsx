import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { QrCode } from "lucide-react";
import QRCode from "qrcode";
import DriverLayout from "@/components/DriverLayout";
import useDriverData from "@/hooks/useDriverData";
import PrivateClientsPanel from "@/components/private-clients/PrivateClientsPanel";
import { apiFetch as fetch } from "@/lib/archive-fetch";

const brightness = registerPlugin("QrBrightness");
const QR_PREVIEW_MS = 5000;

function QrPreview({ src, onClose }) {
  const dialog = useRef(null);

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    const timer = window.setTimeout(onClose, QR_PREVIEW_MS);
    const native = Capacitor.isPluginAvailable("QrBrightness");
    if (native) void brightness.start().catch(() => {});
    const onVisibility = () => { if (document.hidden) onClose(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      if (native) void brightness.stop().catch(() => {});
      element.close();
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialog}
      className="private-qr-preview"
      aria-label="QR code d’invitation"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={onClose}
    >
      <img src={src} alt="QR code à scanner par votre client" />
    </dialog>
  );
}

function PrivateClientsPage() {
  const { data, error, reload } = useDriverData("/api/drivers/me/private-clients", 15000);
  const goldActive = data?.gold?.active === true && !error;
  const [src, setSrc] = useState(null);
  const [qrError, setQrError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState(false);
  const closePreview = useCallback(() => setPreview(false), []);
  const canPreview = goldActive && Boolean(src);

  useEffect(() => {
    closePreview();
    setSrc(null);
    setQrError("");
    if (!goldActive) return undefined;

    const controller = new AbortController();
    async function loadQr() {
      try {
        const res = await fetch("/api/drivers/me/private-clients/qr", {
          method: "POST",
          signal: controller.signal,
        });
        const invitation = await res.json();
        if (!res.ok || invitation.error || !invitation.token)
          throw new Error(invitation.error || "Impossible de charger le QR code.");
        // Keep the invitation token in the URL fragment.
        const url = `${window.location.origin}/join#invite=${invitation.token}`;
        const svg = await QRCode.toString(url, {
          type: "svg",
          margin: 4,
          errorCorrectionLevel: "M",
          color: { dark: "#0b0b0f", light: "#ffffff" },
        });
        if (!controller.signal.aborted) setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      } catch (err) {
        if (!controller.signal.aborted) setQrError(err.message || "Impossible de charger le QR code.");
      }
    }
    void loadQr();
    return () => controller.abort();
  }, [goldActive, attempt, closePreview]);

  async function changeClient(clientId, action, blocked) {
    const response = await fetch(`/api/drivers/me/private-clients/${encodeURIComponent(clientId)}`, {
      method: action === "remove" ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      ...(action === "block" ? { body: JSON.stringify({ blocked }) } : {}),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.error) throw new Error(result.error || "Impossible de modifier ce client.");
    await reload();
  }

  return (
    <div className="driver-tab-page drv-cockpit-page">
      <header className="driver-account-heading">
        <div>
          <h1>Votre clientèle privée</h1>
        </div>
        <button
          type="button"
          className="sd-close-control private-qr-launch"
          aria-label="Afficher mon QR code"
          disabled={!canPreview}
          onClick={() => setPreview(true)}
        >
          <QrCode size={22} aria-hidden="true" />
        </button>
      </header>
      {!error && (
        <PrivateClientsPanel
          clients={data?.clients ?? null}
          goldActive={goldActive}
          onRemove={(id) => changeClient(id, "remove")}
          onBlock={(id, blocked) => changeClient(id, "block", blocked)}
        />
      )}
      {preview && canPreview && <QrPreview src={src} onClose={closePreview} />}
      {error && <p role="alert">{error} <button type="button" className="btn btn-secondary" onClick={reload}>Réessayer</button></p>}
      {qrError && (
        <p role="alert">
          {qrError} <button type="button" className="btn btn-secondary" onClick={() => setAttempt((value) => value + 1)}>Réessayer</button>
        </p>
      )}
      {!error && data?.gold && !goldActive && (
        <p className="small muted">Le QR code est disponible avec StrasDrive Gold.</p>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/driver/private-clients")({
  head: () => ({
    meta: [
      { title: "Clients privés · StrasDrive chauffeur" },
      { name: "description", content: "StrasDrive — QR code d’invitation pour vos clients privés." },
      { property: "og:title", content: "Clients privés · StrasDrive chauffeur" },
      { property: "og:description", content: "StrasDrive — QR code d’invitation pour vos clients privés." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <DriverLayout>
      <PrivateClientsPage />
    </DriverLayout>
  ),
});
