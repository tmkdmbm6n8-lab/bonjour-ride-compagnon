// Tarifs Uber en direct (API web m.uber.com) avec le cookie stocké dans le secret UBER_COOKIE.
// Renvoie null si Uber refuse (cookie expiré…) : l'appelant bascule sur le moteur StrasDrive.
const QUERY = `query Products($destinations: [InputCoordinate!]!, $pickup: InputCoordinate!, $payment: InputPayment, $includeRecommended: Boolean = false, $isHcv: Boolean) {
  products(destinations: $destinations, pickup: $pickup, payment: $payment, includeRecommended: $includeRecommended, isHcv: $isHcv) {
    tiers { products { displayName description estimatedTripTime etaInMin currencyCode isAvailable fares { capacity fare fareAmountE5 } } }
  }
}`;

export async function uberProducts(pickup, dropoff, customCookie = null, diagnostic = null) {
  const cookie = customCookie || process.env.UBER_COOKIE;
  if (diagnostic) Object.assign(diagnostic, { source: 'Uber GraphQL Products', httpStatus: null, graphqlCode: null, graphqlMessage: null, priceCount: 0, checkedAt: new Date().toISOString(), error: null });
  if (!cookie) { if (diagnostic) diagnostic.error = 'Cookie absent'; return null; }
  const startedAt = Date.now();
  try {
    const res = await fetch("https://m.uber.com/go/graphql", {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: {
        "content-type": "application/json",
        "x-csrf-token": "x",
        "x-uber-client-name": "web-plan",
        cookie,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        operationName: "Products",
        query: QUERY,
        variables: {
          includeRecommended: false,
          isHcv: false,
          destinations: [{ latitude: dropoff.lat, longitude: dropoff.lng }],
          pickup: { latitude: pickup.lat, longitude: pickup.lng },
          payment: { uberCashToggleOn: true },
        },
      }),
    });
    if (diagnostic) { diagnostic.httpStatus = res.status; diagnostic.durationMs = Date.now() - startedAt; }
    if (!res.ok) { if (diagnostic) diagnostic.error = `HTTP ${res.status}`; return null; }
    const j = await res.json();
    if (diagnostic && Array.isArray(j?.errors) && j.errors.length) { diagnostic.graphqlCode = j.errors[0]?.extensions?.code || 'graphql_error'; diagnostic.graphqlMessage = j.errors[0]?.message || 'Erreur GraphQL'; }

    const tiers = j?.data?.products?.tiers;
    if (!Array.isArray(tiers)) { if (diagnostic && !diagnostic.graphqlCode) diagnostic.error = 'Aucun produit dans la réponse'; return null; }
    const list = [];
    for (const t of tiers)
      for (const pr of t.products || []) {
        const f = pr.fares?.[0];
        if (!f || f.fareAmountE5 == null) continue;
        list.push({
          name: pr.displayName,
          description: pr.description,
          price: Number(f.fareAmountE5) / 1e5,
          currency: pr.currencyCode || "EUR",
          capacity: f.capacity,
          tripSeconds: pr.estimatedTripTime,
          etaMinutes: pr.etaInMin,
        });
      }
    if (diagnostic) { diagnostic.priceCount = list.length; if (!list.length) diagnostic.error = 'Aucun tarif exploitable'; }
    return list.length ? list : null;
  } catch (error) {
    if (diagnostic) diagnostic.error = error?.name === 'TimeoutError' ? 'Délai dépassé' : 'Erreur réseau ou réponse invalide';
    return null;
  } finally {
    if (diagnostic) diagnostic.durationMs = Date.now() - startedAt;
  }
}

export async function testUberCookie(cookie) {
  if (!cookie || typeof cookie !== "string" || cookie.trim().length < 20) {
    return { ok: false, error: "Le cookie est vide ou trop court." };
  }
  const products = await uberProducts(
    { lat: 48.5734, lng: 7.7521 },
    { lat: 48.5839, lng: 7.7455 },
    cookie.trim(),
  );
  if (Array.isArray(products) && products.length > 0) {
    return { ok: true, count: products.length, products: products.map((p) => p.name) };
  }
  return { ok: false, error: "Session refusée ou expirée par Uber." };
}
