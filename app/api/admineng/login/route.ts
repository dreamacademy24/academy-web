import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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
    const { data, error } = await supabase.rpc('verify_teacher_login', {
      p_username: username,
      p_password: password,
    });
    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return NextResponse.json(
        { success: false, message: 'Invalid username or password.' },
        { status: 401 }
      );
    }
    return NextResponse.json({
      success: true,
      staff: {
        username: row.username,
        name: row.name,
        role: row.role,
        color: row.color,
        initial: row.initial,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
