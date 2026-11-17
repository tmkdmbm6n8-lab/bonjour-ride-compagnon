/** Conservative headers compatible with the app's managed preview, maps and payment frames. */
export function secureResponse(request: Request, response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  const url = new URL(request.url);
  const privateResponse =
    request.headers.has("authorization") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_serverFn/") ||
    /^\/(dashboard|driver|admin|profile|wallet|rides)(\/|$)/.test(url.pathname);
  if (privateResponse) headers.set("Cache-Control", "private, no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
