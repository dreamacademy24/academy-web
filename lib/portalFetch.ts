import { supabase } from '@/lib/supabase';

/** Add the current Auth token only to our own API; never to third party URLs. */
export async function portalFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) return fetch(input, init);
  const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
  const { data } = await supabase.auth.getSession();
  if (data.session) headers.set('Authorization', `Bearer ${data.session.access_token}`);
  return fetch(input, { ...init, headers, cache: 'no-store' });
}
