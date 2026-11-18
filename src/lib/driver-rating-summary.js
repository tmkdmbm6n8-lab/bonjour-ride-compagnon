/** No ride, passenger identity, contact details or precise date leaves this projection. */
export function driverRatingSummary(rows, priority = false) {
  const rated = rows.filter((row) => Number.isInteger(row.rating?.byRider) && row.rating.byRider >= 1 && row.rating.byRider <= 5);
  const distribution = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: rated.filter((row) => row.rating.byRider === stars).length }));
  const comments = rated.filter((row) => (priority || row.rating.byRider >= 4) && typeof row.rating.riderComment === 'string' && row.rating.riderComment.trim()).map((row) => ({
    stars: row.rating.byRider,
    text: row.rating.riderComment.trim().slice(0,500)
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[e-mail masqué]')
      .replace(/(?:\+\d{1,3}[ .-]?)?(?:\d[ .-]?){9,14}\d/g, '[numéro masqué]'),
  }));
  return { count: rated.length, average: rated.length ? rated.reduce((sum, row) => sum + row.rating.byRider, 0) / rated.length : null, distribution, comments, priority };
}
