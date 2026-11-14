// Tarifs Uber en direct (API web m.uber.com) avec le cookie stocké dans le secret UBER_COOKIE.
// Renvoie null si Uber refuse (cookie expiré…) : l'appelant bascule sur le moteur StrasDrive.
const QUERY = `query Products($destinations: [InputCoordinate!]!, $pickup: InputCoordinate!, $payment: InputPayment, $includeRecommended: Boolean = false, $isHcv: Boolean) {
  products(destinations: $destinations, pickup: $pickup, payment: $payment, includeRecommended: $includeRecommended, isHcv: $isHcv) {
    tiers { products { displayName description estimatedTripTime etaInMin currencyCode isAvailable fares { capacity fare fareAmountE5 } } }
  }
}`;

export async function uberProducts(pickup, dropoff) {
  const cookie = process.env.UBER_COOKIE;
  if (!cookie) return null;
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
    if (!res.ok) return null;
    const j = await res.json();
    const tiers = j?.data?.products?.tiers;
    if (!Array.isArray(tiers)) return null;
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
    return list.length ? list : null;
  } catch {
    return null;
  }
}
