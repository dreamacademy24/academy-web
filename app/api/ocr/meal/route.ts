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
const PROMPT_ACADEMY = `당신은 학원(아카데미) 학생 식단표 이미지에서 메뉴 정보를 추출하는 전문가입니다.

## 표 구조 (매우 중요!)
이 표는 월간 학생 점심+간식 식단입니다.
- 가로축(열, column) = 요일별 날짜: 월 / 화 / 수 / 목 / 금
- 세로축(행, row) = 그 날의 메뉴 항목들이 위에서 아래로 나열됨
- 한 주(월~금)가 하나의 블록이고, 월간 표는 보통 4~5개 주 블록으로 구성됨
- 각 날짜 칸(셀) 안에 메뉴 항목이 보통 4~8줄 세로로 나열됨

⚠️ 핵심: 반드시 각 날짜 열을 위에서 아래로 읽어서 그 날짜의 모든 메뉴를 빠짐없이 추출하세요!
행(가로)으로 읽지 마세요. 열(세로)으로 읽으세요.

## 점심 vs 간식 구분
- 일반 배경(흰색/노란색) = 점심(lunch)
- 초록/연두/민트 배경 = 간식(snack) — 보통 각 날짜 열의 맨 아래 1~4줄
- 배경색 구분이 안 보이면: 과일, 음료, 요구르트, 빵, 떡 등 가벼운 항목이 간식

## 응답 (순수 JSON만, 코드블록 없이)
{
  "days": [
    {
      "date": 1,
      "weekday": "월",
      "lunch": ["밥/오징어무국", "간장양념목살구이", "오이맛살샐러드", "두부구이"],
      "snack": ["찐고구마"]
    },
    {
      "date": 2,
      "weekday": "화",
      "lunch": ["밥/버섯된장찌개", "보쌈(수육)", "야채샐러드", "오이부추무침"],
      "snack": ["토마토스파게티"]
    },
    {
      "date": 3,
      "weekday": "수",
      "lunch": ["스팸김밥/계란국", "간장떡볶이", "만두튀김", "단무지"],
      "snack": ["바나나"]
    }
  ]
}

## 규칙
- date = 숫자(일자만), weekday = 한글 요일 1글자
- 각 날짜의 lunch 배열에 4~8개 항목이 있는 것이 정상 (1~2개만 있으면 놓친 것!)
- 메뉴 텍스트 원본 그대로 유지 (오탈자도 보존)
- "휴무" = lunch/snack 빈 배열 (건너뛰지 말고 포함)
- 월~금 전체 날짜를 날짜순 정렬
- JSON만 응답`

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
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
        { type: 'text', text: kind === 'academy'
          ? '이 학생 식단표를 날짜별로 세로 방향(열 단위)으로 읽어서, 각 날짜의 모든 메뉴 항목(보통 4~8개)을 lunch 배열에, 간식을 snack 배열에 넣어 JSON으로만 응답해주세요. 날짜당 1~2개만 나오면 잘못 읽은 것입니다.'
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
