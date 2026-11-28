import { createFileRoute } from "@tanstack/react-router";
import PassengerTraffic from "@/components/ride/PassengerTraffic";

export const Route = createFileRoute("/_authenticated/transport")({
  head: () => ({ meta: [{"title": "Réservation · StrasDrive"}, {"name": "description", "content": "Réservez un trajet StrasDrive avec les horaires des trains et vols à Strasbourg."}, {"property": "og:title", "content": "Réservation · StrasDrive"}, {"property": "og:description", "content": "Réservez un trajet StrasDrive avec les horaires des trains et vols à Strasbourg."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}] }),
  component: PassengerTraffic,
});
