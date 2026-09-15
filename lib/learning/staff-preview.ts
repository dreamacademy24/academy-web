import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { getStaffIdentity } from '@/lib/portalAuth';
import { STAFF_COOKIE } from '@/lib/staffSession';

export type LearningStaffAccess = { status: 'public' | 'staff' | 'error' };

// React cache only deduplicates checks within this server render, never across users.
export const getLearningStaffAccess = cache(async (): Promise<LearningStaffAccess> => {
  try {
    const value = (await cookies()).get(STAFF_COOKIE)?.value;
    if (!value || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) return { status: 'public' };

    // Forward only the signed staff cookie, not browser identity or proxy headers.
    const staff = await getStaffIdentity(new Request('https://staff.invalid/learn', {
      headers: { cookie: `${STAFF_COOKIE}=${value}` },
    }));
    return { status: staff && ['korean_admin', 'local_teacher'].includes(staff.role) ? 'staff' : 'public' };
  } catch {
    return { status: 'error' };
  }
});
