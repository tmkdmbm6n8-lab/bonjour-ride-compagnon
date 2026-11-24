import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import QRCode from "qrcode";
import DriverLayout from "@/components/DriverLayout";
import useDriverData from "@/hooks/useDriverData";
import PrivateClientsPanel from "@/components/private-clients/PrivateClientsPanel";
import { apiFetch as fetch } from "@/lib/archive-fetch";

function PrivateClientsPage() {
  const { data, error, reload } = useDriverData("/api/drivers/me/private-clients", 15000);
  const { clients = null, gold } = data || {};

  const changeClient = useCallback(async (clientId, action, blocked) => {
    const res = await fetch(`/api/drivers/me/private-clients/${encodeURIComponent(clientId)}`, {
      method: action === 'remove' ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(action === 'block' ? { body: JSON.stringify({ blocked }) } : {}),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok || result.error) throw new Error(result.error || 'Impossible de modifier ce client');
    await reload();
  }, [reload]);
  const loadQr = useCallback(async () => {
    const res = await fetch("/api/drivers/me/private-clients/qr", { method: "POST" });
    const data = await res.json();
    if (!res.ok || data.error || !data.token) throw new Error(data.error || "Impossible de créer le QR code");
    // Token in the fragment: it never reaches a server log or an analytics URL.
    const url = `${window.location.origin}/join#invite=${data.token}`;
    const svg = await QRCode.toString(url, { type: "svg", margin: 4, errorCorrectionLevel: "M", color: { dark: "#0b0b0f", light: "#ffffff" } });
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
          <span className="sd-settings-brand">Espace chauffeur</span>
          <h1>Votre clientèle privée</h1>
        </div>
      </header>
      {error && <p role="alert">{error} <button type="button" className="btn btn-secondary" onClick={reload}>Réessayer</button></p>}
      <div className="flex-col gap-4">
        {gold && !gold.active && !error && (
          <section className="card card-pad">
            <h2>Votre QR code permanent</h2>
            <p className="small muted mt-2">Activez StrasDrive Gold dans Menu → Espace de conduite pour accéder à votre QR code.</p>
          </section>
        )}
        {(gold?.active || clients?.length > 0) && (
          <PrivateClientsPanel clients={clients} loadQr={loadQr} goldActive={gold?.active === true && !error} onRemove={(id) => changeClient(id, 'remove')} onBlock={(id, blocked) => changeClient(id, 'block', blocked)} />
        )}
      </div>
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
