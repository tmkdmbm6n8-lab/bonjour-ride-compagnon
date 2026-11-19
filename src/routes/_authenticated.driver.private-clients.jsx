import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import DriverLayout from "@/components/DriverLayout";
import PrivateClientsPanel from "@/components/private-clients/PrivateClientsPanel";
import { apiFetch as fetch } from "@/lib/archive-fetch";

function PrivateClientsPage() {
  const [clients, setClients] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/drivers/me/private-clients")
      .then((r) => r.json())
      .then((d) => alive && setClients(Array.isArray(d.clients) ? d.clients : []))
      .catch(() => alive && setClients([]));
    return () => {
      alive = false;
    };
  }, []);

  const loadQr = useCallback(async () => {
    const res = await fetch("/api/drivers/me/private-clients/qr", { method: "POST" });
    const data = await res.json();
    if (!res.ok || data.error || !data.token) throw new Error(data.error || "Impossible de créer le QR code");
    // Token in the fragment: it never reaches a server log or an analytics URL.
    const url = `${window.location.origin}/join#invite=${data.token}`;
    const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0b0b0f", light: "#ffffff" } });
    return {
      expiresAt: data.expiresAt,
      image: (
        <img
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
          alt="QR code à scanner par votre client"
          width={240}
          height={240}
          style={{ display: "block", margin: "0 auto", background: "#fff", borderRadius: 12, padding: 8 }}
        />
      ),
    };
  }, []);

  return (
    <div className="driver-tab-page drv-cockpit-page">
      <header className="driver-account-heading">
        <div>
          <span className="sd-settings-brand">StrasDrive · Votre clientèle</span>
          <h1>Clients privés</h1>
        </div>
      </header>
      <PrivateClientsPanel clients={clients} loadQr={loadQr} />
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/driver/private-clients")({
  head: () => ({
    meta: [
      { title: "Clients privés · StrasDrive chauffeur" },
      { name: "description", content: "StrasDrive — QR code d’invitation et liste de vos clients privés." },
      { property: "og:title", content: "Clients privés · StrasDrive chauffeur" },
      { property: "og:description", content: "StrasDrive — QR code d’invitation et liste de vos clients privés." },
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
