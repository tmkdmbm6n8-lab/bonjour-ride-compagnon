import { createFileRoute } from "@tanstack/react-router";

async function handle(request: Request): Promise<Response> {
  const { handleNativeApiRequest } = await import("@/lib/native-api.server");
  return handleNativeApiRequest(request);
}

// React Native is an external caller: this public-prefix route still requires a verified user bearer.
export const Route = createFileRoute("/api/public/native/$")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
      PUT: ({ request }) => handle(request),
      PATCH: ({ request }) => handle(request),
      DELETE: ({ request }) => handle(request),
      OPTIONS: ({ request }) => handle(request),
    },
  },
});
