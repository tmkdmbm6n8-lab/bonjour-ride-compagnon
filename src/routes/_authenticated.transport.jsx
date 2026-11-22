import { createFileRoute } from "@tanstack/react-router";
import PassengerTraffic from "@/components/ride/PassengerTraffic";

export const Route = createFileRoute("/_authenticated/transport")({
  head: () => ({ meta: [{ title: "Vols et trains · StrasDrive" }] }),
  component: PassengerTraffic,
});
