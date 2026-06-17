// Supabase SQL (meal_data 컬럼 추가 — Supabase SQL Editor에서 실행):
// ALTER TABLE meal_menus ADD COLUMN IF NOT EXISTS meal_data jsonb;

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const SYSTEM_PROMPT = `당신은 식단표(급식표) 이미지에서 메뉴 정보를 추출하는 도우미입니다.
표 이미지를 받으면 날짜별로 아침/점심/저녁(어른)/저녁(아동) 4가지를 분리하여 JSON으로 응답하세요.

표의 4열 순서: 아침 / 점심 / 저녁(어른) / 저녁(아동)

응답 형식 (순수 JSON만, 마크다운 코드블록 없이):
{
  "days": [
    {
      "date": 15,
      "weekday": "월",
      "breakfast": ["누룽지", "빨간오징어볶국", "김", "생선구이", "김치", "방울토마토"],
      "lunch": ["밥/김치찌개", "치킨", "양배추샐러드", "감자샐러드", "파인애플"],
      "dinner_adult": ["밥/미역국", "제육볶음", "깻잎무침", "김치"],
      "dinner_child": ["밥/미역국", "돈까스", "샐러드", "김치"]
    }
  ]
}

핵심 규칙:
- 날짜 구분자(15일 월, 16일 화 등)로 일별 분리
- date는 숫자(일자만), weekday는 한글 요일(월/화/수/목/금/토/일)
- 각 셀의 메뉴 항목(줄바꿈 구분)을 배열 아이템으로
- 빈 셀은 빈 배열 []
- 메뉴 텍스트는 원본 그대로 유지 (오탈자도 그대로)
- 날짜 순서대로 정렬
- JSON만 응답, 다른 텍스트 없이`

async function fileToBase64(file: File): Promise<{ b64: string; mediaType: string }> {
  const buf = Buffer.from(await file.arrayBuffer())
  const type = file.type || 'image/jpeg'
  const mediaType = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(type) ? type : 'image/jpeg'
  return { b64: buf.toString('base64'), mediaType }
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'ANTHROPIC_API_KEY missing' }, { status: 500 })
  }

  const form = await req.formData()
  const file = form.get('image')
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'image file required' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: 'image too large (max 10MB)' }, { status: 400 })
  }

  const { b64, mediaType } = await fileToBase64(file)

  const body = {
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
        { type: 'text', text: '이 식단표 이미지에서 날짜별 메뉴를 추출해 JSON으로만 응답해주세요.' },
      ],
    }],
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
      body: JSON.stringify(body),
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'anthropic fetch failed: ' + (e as Error).message }, { status: 502 })
  }

  if (!res.ok) {
    const errText = await res.text()
    return NextResponse.json({ ok: false, error: 'anthropic error: ' + errText }, { status: 502 })
  }

  const data = await res.json()
  const text: string = data?.content?.[0]?.text ?? ''
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim()

  let parsed: { days: any[] }
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ ok: false, error: 'parse failed', raw: text }, { status: 502 })
  }

  if (!parsed.days || !Array.isArray(parsed.days)) {
    return NextResponse.json({ ok: false, error: 'invalid format: days array missing', raw: text }, { status: 502 })
  }

  return NextResponse.json({ ok: true, days: parsed.days })
}
