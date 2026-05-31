import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

const SYSTEM_PROMPT = `다음 영어 튜터 수업 노트를 학부모가 읽을 자연스러운 한국어로 번역.
번역문만 출력, 군더더기 금지.`

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY missing' }, { status: 500 })
  }

  let body: { text?: string } = {}
  try { body = await req.json() } catch { /* noop */ }
  const text = (body.text || '').trim()
  if (!text) {
    return NextResponse.json({ error: 'text required' }, { status: 400 })
  }

  const payload = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: text }],
  }

  let res: Response
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  } catch (e) {
    return NextResponse.json({ error: 'anthropic fetch failed: ' + (e as Error).message }, { status: 502 })
  }

  if (!res.ok) {
    const errText = await res.text()
    return NextResponse.json({ error: 'anthropic error: ' + errText }, { status: 502 })
  }

  const data = await res.json()
  const translated: string = (data?.content?.[0]?.text ?? '').trim()
  if (!translated) {
    return NextResponse.json({ error: 'empty translation' }, { status: 500 })
  }
  return NextResponse.json({ translated })
}
