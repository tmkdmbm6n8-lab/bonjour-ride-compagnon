import { describe, expect, it } from 'vitest';
import { navigationActive } from '@/lib/navigation-active';

describe('sélection de la navigation administrateur', () => {
  const nav = [{ href: '/admin/support' }, { href: '/admin/support?archive=1' }];
  it('sélectionne Archives, et pas Assistance, sur la page des archives', () => {
    const query = new URLSearchParams('archive=1');
    expect(navigationActive(nav[1].href, '/admin/support', query, nav)).toBe(true);
    expect(navigationActive(nav[0].href, '/admin/support', query, nav)).toBe(false);
  });
  it('sélectionne Assistance lorsque les archives ne sont pas ouvertes', () => {
    const query = new URLSearchParams();
    expect(navigationActive(nav[0].href, '/admin/support', query, nav)).toBe(true);
    expect(navigationActive(nav[1].href, '/admin/support', query, nav)).toBe(false);
  });
});
