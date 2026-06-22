import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const SYSTEM_PROMPT = `당신은 항공권/보딩패스/이티켓 이미지에서 항공편 정보를 추출하는 도우미입니다.
이 시스템은 필리핀 세부(Cebu, CEB) 어학원 픽업 관리용입니다.
이미지에서 입국편(in, 세부행)과 출국편(out, 세부 출발)을 찾아 아래 JSON 형식으로만 응답하세요.
마크다운 코드블록(\`\`\`)을 사용하지 말고, 순수 JSON 텍스트만 출력하세요.

{
  "in_airline": "입국편 항공사명 (예: 대한항공, Korean Air, Cathay Pacific, Air China 등)",
  "in_no": "입국편 편명 (예: KE601, 5J123, CA408)",
  "in_date": "YYYY-MM-DD 형식의 세부 도착 날짜",
  "in_dep_time": "HH:MM 형식의 출발지 출발 시간 (24시간제, departure time from origin)",
  "in_time": "HH:MM 형식의 세부(CEB) 도착 시간 (24시간제, arrival time at CEB)",
  "in_origin": "입국편 출발지 (예: 인천, ICN, Beijing, PEK)",
  "out_airline": "출국편 항공사명",
  "out_no": "출국편 편명",
  "out_date": "YYYY-MM-DD 형식의 세부 출발 날짜",
  "out_time": "HH:MM 형식의 세부(CEB) 출발 시간 (24시간제, departure time from CEB)",
  "out_arr_time": "HH:MM 형식의 도착지 도착 시간 (24시간제, arrival time at destination)",
  "out_destination": "출국편 도착지"
}

핵심 규칙:
- 입국편(in) = 세부(CEB/Cebu/Mactan)에 도착하는 편. in_time은 반드시 세부 도착 시간(Arrival time)
- 출국편(out) = 세부(CEB/Cebu/Mactan)에서 출발하는 편. out_time은 반드시 세부 출발 시간(Departure time)
- 출발지→도착지가 표시되면: 도착지가 CEB/Cebu/Philippines이면 입국편, 출발지가 CEB/Cebu/Philippines이면 출국편
- 경유편(1 stop 이상)이면: 최종 도착 시간이 in_time, 최초 출발 시간이 out_time
- 항공사명은 공항코드(PEK, ICN)가 아니라 실제 항공사 이름(Air China, Korean Air). 항공사를 모르면 빈 문자열
- 한 방향만 있는 티켓이면 해당 방향만 채우고, 반대 방향은 빈 문자열
- 정보를 확실히 알 수 없는 필드는 빈 문자열 ""
- 날짜 형식 변환: "15 May 2026" → "2026-05-15", "Saturday, June 20, 2026" → "2026-06-20"
- 시간 형식 변환: "11:30 PM" → "23:30", "9:05 AM" → "09:05", "06:10 PM" → "18:10"
- 연도가 없으면 올해(2026) 추정`

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
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
        { type: 'text', text: '이 이미지에서 항공편 정보를 추출해 JSON으로만 응답해주세요.' },
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

  let parsed: Record<string, string>
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ ok: false, error: 'parse failed', raw: text }, { status: 502 })
  }

  const keys = ['in_airline','in_no','in_date','in_dep_time','in_time','in_origin','out_airline','out_no','out_date','out_time','out_arr_time','out_destination']
  const fields: Record<string, string> = {}
  for (const k of keys) fields[k] = typeof parsed[k] === 'string' ? parsed[k] : ''

  return NextResponse.json({ ok: true, fields })
}
