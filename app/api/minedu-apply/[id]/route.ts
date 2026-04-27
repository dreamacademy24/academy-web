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
    const { assignee, status } = body;

    const updates: Record<string, string | null> = {};

    if (assignee !== undefined) {
      const ALLOWED_ASSIGNEE = ['jamie', 'may'];
      if (assignee && typeof assignee === 'string' && assignee.trim()) {
        const a = assignee.trim().toLowerCase();
        if (!ALLOWED_ASSIGNEE.includes(a)) {
          return NextResponse.json(
            { error: 'Invalid assignee. Must be: jamie | may | null' },
            { status: 400 }
          );
        }
        updates.assignee = a;
      } else {
        updates.assignee = null;
      }
    }

    if (status !== undefined) {
      const ALLOWED_STATUS = ['new', 'contacted', 'in_progress', 'paused', 'recheck', 'confirmed'];
      if (status && typeof status === 'string' && status.trim()) {
        const s = status.trim().toLowerCase();
        if (!ALLOWED_STATUS.includes(s)) {
          return NextResponse.json(
            { error: 'Invalid status. Must be one of: ' + ALLOWED_STATUS.join(', ') },
            { status: 400 }
          );
        }
        updates.status = s;
      } else {
        updates.status = 'new';
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { error } = await supabase
      .from('minedu_applications')
      .update(updates)
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const applicationId = parseInt(id, 10);
    if (isNaN(applicationId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { error } = await supabase
      .from('minedu_applications')
      .delete()
      .eq('id', applicationId);

    if (error) {
      console.error('[minedu-apply/DELETE] Supabase error:', error);
      return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[minedu-apply/DELETE] Unexpected error:', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
