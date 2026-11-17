export const PERSONAL_DATA_PAGE_SIZE = 250;

export function exportPageOptions(params, now = Date.now()) {
  const page = Number(params.get("page") || 0);
  if (!Number.isSafeInteger(page) || page < 0 || page > 100000)
    throw new Error("Page d’export invalide");
  const requested = params.get("until");
  const time = requested ? Date.parse(requested) : now;
  if (!Number.isFinite(time) || time > now + 1000) throw new Error("Date d’export invalide");
  return {
    page,
    until: new Date(time).toISOString(),
    from: page * PERSONAL_DATA_PAGE_SIZE,
    to: (page + 1) * PERSONAL_DATA_PAGE_SIZE,
  };
}

/** Gather authenticated pages without silently truncating the user's history. */
export async function downloadPersonalData(fetcher, onProgress = () => {}) {
  let result;
  const collections = ["rides", "walletTransactions", "supportRequests"];
  const seen = Object.fromEntries(collections.map((key) => [key, new Set()]));
  for (let page = 0; ; page++) {
    const query = new URLSearchParams({ page: String(page) });
    if (result) query.set("until", result.exportedAt);
    const response = await fetcher(`/api/users/me/export?${query}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Export indisponible");
    if (data.pagination?.page !== page) throw new Error("Réponse d’export invalide");
    if (!result) result = { ...data, rides: [], walletTransactions: [], supportRequests: [] };
    for (const key of collections) {
      for (const row of data[key] || []) {
        const id = row.id;
        if (id && seen[key].has(id)) continue;
        if (id) seen[key].add(id);
        result[key].push(row);
      }
    }
    onProgress(page + 1);
    if (!data.pagination.hasMore) {
      delete result.pagination;
      return result;
    }
    if (page >= 100000) throw new Error("Export trop volumineux ; contactez l’assistance.");
  }
}
