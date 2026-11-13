import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { lazy, useState } from "react";
import { MapPin, Navigation, User } from "lucide-react";

const MapView = lazy(() => import("@/components/MapView"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StrasDrive — Votre chauffeur VTC à Strasbourg" },
      {
        name: "description",
        content:
          "Commandez un chauffeur VTC à Strasbourg en quelques secondes. Prix en euros, suivi en direct, paiement simple.",
      },
      { property: "og:title", content: "StrasDrive — Votre chauffeur VTC à Strasbourg" },
      {
        property: "og:description",
        content:
          "Commandez un chauffeur VTC à Strasbourg en quelques secondes. Prix en euros, suivi en direct, paiement simple.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Accueil,
});

type Gamme = {
  id: string;
  nom: string;
  description: string;
  places: number;
  prix: number;
  delai: number;
};

const GAMMES: Array<Gamme> = [
  { id: "berline", nom: "Berline", description: "Confort au quotidien", places: 4, prix: 8.4, delai: 3 },
  { id: "confort", nom: "Confort", description: "Voitures récentes, chauffeurs expérimentés", places: 4, prix: 11.9, delai: 5 },
  { id: "van", nom: "Van", description: "Pour les groupes et les bagages", places: 6, prix: 15.5, delai: 7 },
];

function formatPrix(prix: number) {
  return prix.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function Accueil() {
  const [destination, setDestination] = useState("");
  const [etape, setEtape] = useState<"recherche" | "devis" | "confirmee">("recherche");
  const [gammeChoisie, setGammeChoisie] = useState<string>("berline");

  const gamme = GAMMES.find((g) => g.id === gammeChoisie) ?? GAMMES[0];

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-background">
      {/* Carte plein écran */}
      <ClientOnly fallback={<div className="absolute inset-0 bg-muted" />}>
        <MapView />
      </ClientOnly>

      {/* Logo */}
      <div className="absolute left-4 top-4 z-10 rounded-lg bg-primary px-4 py-2 shadow-lg">
        <span className="text-lg font-bold tracking-tight text-primary-foreground">StrasDrive</span>
      </div>

      {/* Bouton profil */}
      <button
        type="button"
        aria-label="Mon profil"
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-lg"
      >
        <User className="h-5 w-5 text-foreground" />
      </button>

      {/* Panneau qui monte depuis le bas */}
      <div className="absolute inset-x-0 bottom-0 z-10 rounded-t-3xl bg-card shadow-2xl">
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-muted" />

        {etape === "recherche" && (
          <div className="space-y-3 p-5 pb-8">
            <h1 className="text-2xl font-bold text-card-foreground">Où allez-vous ?</h1>

            <div className="flex items-center gap-3 rounded-xl bg-muted px-4 py-3.5">
              <Navigation className="h-5 w-5 shrink-0 text-foreground" />
              <span className="text-sm font-medium text-foreground">Ma position actuelle</span>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-muted px-4 py-3.5">
              <MapPin className="h-5 w-5 shrink-0 text-foreground" />
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Saisissez votre destination"
                className="w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>

            <button
              type="button"
              disabled={destination.trim().length === 0}
              onClick={() => setEtape("devis")}
              className="w-full rounded-xl bg-primary py-4 text-base font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
            >
              Voir les prix
            </button>
          </div>
        )}

        {etape === "devis" && (
          <div className="space-y-3 p-5 pb-8">
            <h1 className="text-xl font-bold text-card-foreground">Choisissez votre course</h1>

            <div className="divide-y divide-border rounded-xl border border-border">
              {GAMMES.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGammeChoisie(g.id)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left ${
                    gammeChoisie === g.id ? "bg-muted" : "bg-card"
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">
                      {g.nom} <span className="font-normal text-muted-foreground">· {g.places} places</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{g.description}</p>
                    <p className="mt-0.5 text-xs font-medium text-foreground">Arrivée dans {g.delai} min</p>
                  </div>
                  <p className="text-base font-bold text-card-foreground">{formatPrix(g.prix)}</p>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setEtape("confirmee")}
              className="w-full rounded-xl bg-primary py-4 text-base font-semibold text-primary-foreground"
            >
              Confirmer {gamme.nom} — {formatPrix(gamme.prix)}
            </button>

            <button
              type="button"
              onClick={() => setEtape("recherche")}
              className="w-full py-1 text-sm font-medium text-muted-foreground"
            >
              Retour
            </button>
          </div>
        )}

        {etape === "confirmee" && (
          <div className="space-y-4 p-5 pb-8">
            <div className="text-center">
              <h1 className="text-xl font-bold text-card-foreground">Chauffeur en route</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Karim arrive dans {gamme.delai} min — Berline noire · AB-123-CD
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3.5">
              <div>
                <p className="text-xs text-muted-foreground">Code à donner au chauffeur</p>
                <p className="text-2xl font-bold tracking-widest text-foreground">4 8 2 1</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Prix de la course</p>
                <p className="text-lg font-bold text-foreground">{formatPrix(gamme.prix)}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setEtape("recherche");
                setDestination("");
              }}
              className="w-full rounded-xl bg-secondary py-4 text-base font-semibold text-secondary-foreground"
            >
              Annuler la course
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
