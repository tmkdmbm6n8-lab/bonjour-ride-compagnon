import { createFileRoute } from "@tanstack/react-router";
import ScheduledRequestsPage from "@/components/ride/ScheduledRequestsPage";

export const Route = createFileRoute("/_authenticated/recurring")({ component: () => <ScheduledRequestsPage kind="recurring" /> });
