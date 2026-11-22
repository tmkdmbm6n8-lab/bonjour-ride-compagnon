import { createFileRoute } from "@tanstack/react-router";
import ScheduledRequestsPage from "@/components/ride/ScheduledRequestsPage";

export const Route = createFileRoute("/_authenticated/transport")({ component: () => <ScheduledRequestsPage kind="transport" /> });
