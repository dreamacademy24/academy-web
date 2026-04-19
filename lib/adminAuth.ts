const ADMIN_TOKEN_KEY = 'adminToken';
const ADMIN_INFO_KEY = 'adminInfo';
const VALID_TOKEN_PREFIX = 'da-admin-';

export function setAdminAuthed(userId: string, info?: { role: string; name: string; staffId: string }) {
  if (typeof window === 'undefined') return;
  const token = VALID_TOKEN_PREFIX + btoa(userId + ':' + Date.now());
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
  if (info) {
    localStorage.setItem(ADMIN_INFO_KEY, JSON.stringify(info));
  }
}

export function isAdminAuthed(): boolean {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  return !!token && token.startsWith(VALID_TOKEN_PREFIX);
}

export function clearAdminAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_INFO_KEY);
}

export function getAdminUserId(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token || !token.startsWith(VALID_TOKEN_PREFIX)) return null;
  try {
    return atob(token.replace(VALID_TOKEN_PREFIX, '')).split(':')[0];
  } catch { return null; }
}

export function getAdminInfo(): { role: string; name: string; staffId: string } | null {
  if (typeof window === 'undefined') return null;
  if (!isAdminAuthed()) return null;
  try {
    const raw = localStorage.getItem(ADMIN_INFO_KEY);
    if (!raw) return { role: '', name: '', staffId: '' };
    return JSON.parse(raw);
  } catch {
    return { role: '', name: '', staffId: '' };
  }
}

// ─────────────────────────────────────────────────────────────
// Online Class standalone login helper (additive; used by
// components/OnlineClassLoginScreen.tsx). Whitelist: 5 tutors
// + May + CEO only. Hashes mirror app/login/page.tsx values.
// ─────────────────────────────────────────────────────────────
function _onlineClassHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(36);
}

const ONLINE_CLASS_ACCOUNTS: { id: string; pw: string; role: 'tutor' | 'admin' }[] = [
  { id: 'admin-ann',     pw: 'h_bpke76', role: 'tutor' },
  { id: 'admin-angel',   pw: 'h_nn1req', role: 'tutor' },
  { id: 'admin-carla',   pw: 'h_8aonka', role: 'tutor' },
  { id: 'admin-amelyn',  pw: 'h_zbg7cn', role: 'tutor' },
  { id: 'admin-cristel', pw: 'h_hn7tab', role: 'tutor' },
  { id: 'admin-may',     pw: 'h_dyghlz', role: 'admin' },
  { id: 'admin-ceo',     pw: 'h_azeaz3', role: 'admin' },
];

export function validateOnlineClassLogin(
  username: string,
  password: string
): { success: boolean; role: 'tutor' | 'admin'; userId: string } | null {
  const id = (username || '').trim();
  if (!id || !password) return null;
  const account = ONLINE_CLASS_ACCOUNTS.find(
    a => a.id === id && a.pw === _onlineClassHash(password)
  );
  if (!account) return null;
  return { success: true, role: account.role, userId: account.id };
}
