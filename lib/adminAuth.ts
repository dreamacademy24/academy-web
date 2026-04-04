const KEYS = ['adminAuthed', 'adminRole', 'adminName', 'adminStaffId', 'adminExpiry'] as const;

export function isAdminAuthed(): boolean {
  if (typeof window === 'undefined') return false;
  const authed = localStorage.getItem('adminAuthed');
  const expiry = localStorage.getItem('adminExpiry');
  if (!authed || !expiry) return false;
  if (Date.now() > Number(expiry)) {
    clearAdminAuth();
    return false;
  }
  return true;
}

export function getAdminInfo() {
  if (typeof window === 'undefined') return null;
  if (!isAdminAuthed()) return null;
  return {
    role: localStorage.getItem('adminRole') || '',
    name: localStorage.getItem('adminName') || '',
    staffId: localStorage.getItem('adminStaffId') || '',
  };
}

export function clearAdminAuth() {
  KEYS.forEach(k => localStorage.removeItem(k));
}
