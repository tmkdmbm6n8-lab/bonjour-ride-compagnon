import { createFileRoute } from "@tanstack/react-router";
import PassengerTraffic from "@/components/ride/PassengerTraffic";

export const Route = createFileRoute("/_authenticated/transport")({
  head: () => ({ meta: [{ title: "Réservation · StrasDrive" }] }),
  component: PassengerTraffic,
});
