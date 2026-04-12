import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data, error } = await supabase
    .from('booking_comments')
    .select('*')
    .eq('booking_id', id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comments: data ?? [] })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { author, content } = body
  if (!author || !content?.trim()) {
    return NextResponse.json({ error: 'author, content required' }, { status: 400 })
  }
  const { data, error } = await supabase
    .from('booking_comments')
    .insert({ booking_id: id, author: author.trim(), content: content.trim() })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const commentId = searchParams.get('comment_id')
  const author = searchParams.get('author')
  if (!commentId) return NextResponse.json({ error: 'comment_id required' }, { status: 400 })

  // 본인 작성만 삭제 가능
  const { data: existing } = await supabase.from('booking_comments').select('author').eq('id', commentId).single()
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (author && existing.author !== author) {
    return NextResponse.json({ error: '본인이 작성한 코멘트만 삭제할 수 있습니다.' }, { status: 403 })
  }

  const { error } = await supabase.from('booking_comments').delete().eq('id', commentId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
