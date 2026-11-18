/** Query-specific tabs take precedence over the general tab for the same page. */
export function navigationActive(href, pathname, search, nav) {
  const target = new URL(href, 'https://navigation.invalid');
  if (pathname !== target.pathname && !pathname.startsWith(`${target.pathname}/`)) return false;
  const matches = (params) => [...params].every(([key, value]) => search.get(key) === value);
  if ([...target.searchParams].length) return matches(target.searchParams);
  return !nav.some((item) => {
    const candidate = new URL(item.href, 'https://navigation.invalid');
    return candidate.pathname === target.pathname && [...candidate.searchParams].length > 0 && matches(candidate.searchParams);
  });
}
