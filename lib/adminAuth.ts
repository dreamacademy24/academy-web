const KEYS = ['adminAuthed', 'adminRole', 'adminName', 'adminStaffId', 'adminExpiry'] as const;

export function isAdminAuthed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const authed = localStorage.getItem('adminAuthed');
    if (authed !== 'true') return false;
    const expiry = localStorage.getItem('adminExpiry');
    // 하위호환: expiry 없어도 adminAuthed만 있으면 통과
    if (!expiry) return true;
    if (Date.now() > Number(expiry)) {
      clearAdminAuth();
      return false;
    }
    return true;
  } catch {
    return false;
  }
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
