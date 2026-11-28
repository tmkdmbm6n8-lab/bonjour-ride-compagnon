import { createFileRoute } from "@tanstack/react-router";
import ScheduledRequestsPage from "@/components/ride/ScheduledRequestsPage";

export const Route = createFileRoute("/_authenticated/recurring")({head: () => ({ meta: [{"title": "Réservations récurrentes · StrasDrive"}, {"name": "description", "content": "Consultez et gérez vos trajets récurrents StrasDrive."}, {"property": "og:title", "content": "Réservations récurrentes · StrasDrive"}, {"property": "og:description", "content": "Consultez et gérez vos trajets récurrents StrasDrive."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}] }),  component: () => <ScheduledRequestsPage kind="recurring" /> });
