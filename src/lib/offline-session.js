// The phone keeps the signed-in session in its own memory. Without network the
// app trusts that saved session instead of asking the server (which would fail
// and send the driver to the login page). The server still checks every request.
import {supabase} from '@/integrations/supabase/client';

const KEY = /^sb-.+-auth-token$/;

/** Saved session user from the phone's memory, without any network call. */
export function storedSessionUser() {
  try {
    if (typeof localStorage === 'undefined') return null;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !KEY.test(key)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const value = JSON.parse(raw);
      const session = value?.currentSession ?? value?.session ?? value;
      if (session?.user?.id && session?.refresh_token) return session.user;
    }
  } catch { /* unreadable memory: treat as signed out */ }
  return null;
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);
}

/** Local session user: the auth client's session, else the raw saved one. Never waits on the network. */
export async function localSessionUser() {
  try {
    const res = await withTimeout(supabase.auth.getSession(), 1500);
    const user = res?.data?.session?.user;
    if (user) return user;
  } catch { /* refresh failed offline: fall back to the saved copy */ }
  return storedSessionUser();
}
