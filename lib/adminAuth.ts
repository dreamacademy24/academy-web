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
