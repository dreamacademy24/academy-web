import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const applicationId = parseInt(id, 10);
    if (isNaN(applicationId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const body = await request.json();
    const { assignee } = body;

    const ALLOWED = ['jamie', 'may'];
    let normalizedAssignee: string | null = null;
    if (assignee && typeof assignee === 'string' && assignee.trim()) {
      const a = assignee.trim().toLowerCase();
      if (!ALLOWED.includes(a)) {
        return NextResponse.json(
          { error: 'Invalid assignee. Must be: jamie | may | null' },
          { status: 400 }
        );
      }
      normalizedAssignee = a;
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { error } = await supabase
      .from('minedu_applications')
      .update({ assignee: normalizedAssignee })
      .eq('id', applicationId);

    if (error) {
      console.error('[minedu-apply/PATCH] Supabase error:', error);
      return NextResponse.json({ error: '업데이트 실패' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[minedu-apply/PATCH] Unexpected error:', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
