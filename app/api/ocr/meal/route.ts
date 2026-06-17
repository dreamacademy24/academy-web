// Supabase SQL (meal_data 컬럼 추가 — Supabase SQL Editor에서 실행):
// ALTER TABLE meal_menus ADD COLUMN IF NOT EXISTS meal_data jsonb;

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

/* ---- 드림하우스 올인원 식단 프롬프트 ---- */
const PROMPT_DREAMHOUSE = `당신은 드림하우스 올인원 식단표 이미지에서 메뉴 정보를 추출하는 도우미입니다.
이 표는 4열 구조입니다: 아침 / 점심 / 저녁(어른) / 저녁(아동)
날짜별로 4가지 식사를 분리하여 JSON으로만 응답하세요.

응답 형식 (순수 JSON만, 마크다운 코드블록 없이):
{
  "days": [
    {
      "date": 15,
      "weekday": "월",
      "breakfast": ["누룽지", "김", "생선구이", "김치"],
      "lunch": ["밥/김치찌개", "치킨", "샐러드"],
      "dinner_adult": ["밥/미역국", "제육볶음"],
      "dinner_child": ["밥/미역국", "돈까스"]
    }
  ]
}

핵심 규칙:
- 날짜 구분자(15일 월, 16일 화 등)로 일별 분리
- date는 숫자(일자만), weekday는 한글 요일
- 각 셀의 메뉴 항목을 배열로
- 빈 셀은 빈 배열 []
- 메뉴 텍스트는 원본 그대로 유지
- 날짜 순서대로 정렬
- JSON만 응답`

/* ---- 아카데미 학생 식단 프롬프트 ---- */
const PROMPT_ACADEMY = `당신은 학원(아카데미) 학생 식단표 이미지에서 메뉴 정보를 추출하는 도우미입니다.

이 표는 학생 점심 + 간식 식단표입니다. 구조:
- 열(가로)이 요일별 날짜 (월~금)
- 각 열 아래로 메뉴 항목이 나열됨
- 일반 배경(흰색/노란색) 행 = 점심 메뉴
- 초록색/연두색 배경 행 = 간식 메뉴
- "휴무" 또는 빈 열은 해당 날짜 쉬는 날

주간별로 묶여 있을 수 있습니다 (예: 6월 1일~5일, 6월 8일~12일...).

응답 형식 (순수 JSON만, 마크다운 코드블록 없이):
{
  "days": [
    {
      "date": 15,
      "weekday": "월",
      "lunch": ["밥/오징어무국", "간장양념목살구이", "오이맛살샐러드", "두부구이", "찐고구마"],
      "snack": ["소시지야채볶음", "과일마카로니샐러드", "요구르트", "찐옥수수"]
    }
  ]
}

핵심 규칙:
- 점심과 간식을 반드시 분리. 초록/연두 배경이 간식(snack)
- 배경색 구분이 안 보이면: 표 하단 3~4개 항목이 보통 간식 (과일, 요구르트, 찐옥수수 등 가벼운 항목)
- date는 숫자(일자만), weekday는 한글 요일
- "휴무"인 날짜는 lunch와 snack 모두 빈 배열이고 건너뛰지 말고 포함
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
  const kind = (form.get('kind') as string) || 'dreamhouse'
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'image file required' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: 'image too large (max 10MB)' }, { status: 400 })
  }

  const systemPrompt = kind === 'academy' ? PROMPT_ACADEMY : PROMPT_DREAMHOUSE
  const { b64, mediaType } = await fileToBase64(file)

  const body = {
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
        { type: 'text', text: kind === 'academy'
          ? '이 학생 식단표 이미지에서 날짜별 점심 메뉴와 간식을 분리하여 JSON으로만 응답해주세요.'
          : '이 식단표 이미지에서 날짜별 메뉴를 추출해 JSON으로만 응답해주세요.' },
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
