// A passenger receives byDriver; a driver receives byRider. Never merge the roles.
export function accountRatingSummary(rows, mode = 'rider') {
  const field = mode === 'driver' ? 'byRider' : 'byDriver';
  const scores = rows.map((row) => row.rating?.[field]).filter((score) => Number.isInteger(score) && score >= 1 && score <= 5);
  return { average: scores.length ? scores.reduce((a,b) => a+b,0) / scores.length : null, count: scores.length };
}
