export function canApplyAppUpdate({ pathname, status, live, dirty, idleMs, focusedTag, dialogOpen }) {
  if (dialogOpen) return false;
  if (dirty || idleMs < 15000 || /^(INPUT|TEXTAREA|SELECT|IFRAME)$/.test(focusedTag || '')) return false;
  if (/\/(login|signup|contact|recover-account|wallet|payment|checkout)(?:\/|$)/.test(pathname)) return false;
  if (status === 'loading') return false;
  if (status === 'unauthenticated' && !['/', '/privacy', '/terms', '/mentions-legales'].includes(pathname)) return false;
  if (status === 'authenticated' && (!live || !Number.isFinite(live.checkedAt) || Date.now() - live.checkedAt > 15000 || live.hasActiveRide)) return false;
  return true;
}
