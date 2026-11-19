import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import RiderLayout from "@/components/RiderLayout";
import FavoriteDriverCard from "@/components/private-clients/FavoriteDriverCard";
import { apiFetch as fetch } from "@/lib/archive-fetch";
import { useToast } from "@/components/ui/Toast";

function FavoritePage() {
  const toast = useToast();
  const [state, setState] = useState({ loading: true, driver: null, error: "" });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/riders/me/favorite");
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Impossible de charger votre chauffeur favori");
      setState({ loading: false, driver: data.driver, error: "" });
    } catch (e) {
      setState({ loading: false, driver: null, error: e.message });
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function remove() {
    const res = await fetch("/api/riders/me/favorite", { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Impossible de retirer ce chauffeur");
    toast("Chauffeur retiré de vos favoris", "info");
    setState({ loading: false, driver: null, error: "" });
  }

  return (
    <div className="content-pad" style={{ maxWidth: 640, margin: "0 auto" }}>
      <h1 className="h2 mb-2">Chauffeur favori</h1>
      <p className="small muted mb-4">
        Votre chauffeur favori apparaît en tête de vos recherches avec son temps d’arrivée. Si vous le choisissez, la course
        lui est proposée en premier ; sinon le choix d’une gamme se fait comme d’habitude.
      </p>
      {state.loading ? (
        <p className="small muted" role="status">
          <span className="spinner" /> Chargement…
        </p>
      ) : state.error ? (
        <div className="card card-pad" role="alert">
          <p>{state.error}</p>
          <button type="button" className="btn btn-secondary mt-3" onClick={load}>
            Réessayer
          </button>
        </div>
      ) : (
        <FavoriteDriverCard driver={state.driver} onRemove={remove} />
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/favorite")({
  head: () => ({
    meta: [
      { title: "Chauffeur favori · StrasDrive" },
      { name: "description", content: "StrasDrive — votre chauffeur favori, ses informations et vos courses ensemble." },
      { property: "og:title", content: "Chauffeur favori · StrasDrive" },
      { property: "og:description", content: "StrasDrive — votre chauffeur favori, ses informations et vos courses ensemble." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RiderLayout>
      <FavoritePage />
    </RiderLayout>
  ),
});
