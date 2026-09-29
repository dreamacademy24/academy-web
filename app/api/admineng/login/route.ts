import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { staffCookie } from '@/lib/portalAuth';
import { verifyStaffLogin } from '@/lib/staffLogin';

// 사전 준비 (Supabase SQL Editor에서 1회 실행):
// CREATE OR REPLACE FUNCTION verify_teacher_login(p_username text, p_password text)
// RETURNS TABLE(id uuid, username text, name text, role text, color text, initial text)
// LANGUAGE sql SECURITY DEFINER AS $$
//   SELECT id, username, name, role, color, initial
//   FROM staff_accounts
//   WHERE username = p_username
//     AND password_hash = crypt(p_password, password_hash)
//     AND is_active = true;
// $$;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: 'username and password are required.' },
        { status: 400 }
      );
    }
    const { row, error } = await verifyStaffLogin(supabase, String(username), String(password)); // 'admin-' 없이 이름만 입력해도 OK
    if (error) {
      return NextResponse.json({ success: false, message: 'Could not connect to the sign-in service. Please try again shortly.' }, { status: 503 });
    }
    
    if (!row) {
      return NextResponse.json(
        { success: false, message: 'Invalid username or password.' },
        { status: 401 }
      );
    }
    const response = NextResponse.json({
      success: true,
      staff: {
        username: row.username,
        name: row.name,
        role: row.role,
        color: row.color,
        initial: row.initial,
      },
    });
    response.cookies.set(staffCookie(row.username));
    return response;
  } catch {
    return NextResponse.json({ success: false, message: 'Could not process sign-in. Please try again shortly.' }, { status: 503 });
  }
}
