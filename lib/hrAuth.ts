import crypto from 'crypto'

// HR 세션 서명 토큰 (급여 등 민감정보 → 최소 서버 검증). HMAC-SHA256.
// 비밀키는 서버 전용 env. 클라이언트엔 토큰만 저장(localStorage hrSession).

function secret(): string {
  return process.env.HR_SESSION_SECRET || process.env.STAFF_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

export interface HrSession {
  username: string
  role: 'admin' | 'employee'
  name?: string
  employee_id?: string | null
  exp: number // epoch ms
}

const MAX_AGE = 1000 * 60 * 60 * 12 // 12h

export function signHr(payload: Omit<HrSession, 'exp'>): string {
  const body: HrSession = { ...payload, exp: Date.now() + MAX_AGE }
  const json = Buffer.from(JSON.stringify(body)).toString('base64url')
  const mac = crypto.createHmac('sha256', secret()).update(json).digest('base64url')
  return `${json}.${mac}`
}

export function verifyHr(token: string | null | undefined): HrSession | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
  const [json, mac] = token.split('.')
  if (!json || !mac) return null
  const expected = crypto.createHmac('sha256', secret()).update(json).digest('base64url')
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null
  try {
    const body = JSON.parse(Buffer.from(json, 'base64url').toString()) as HrSession
    if (!body.exp || body.exp < Date.now()) return null
    return body
  } catch { return null }
}

// 요청 헤더에서 HR 세션 추출 (Authorization: Bearer <token>)
export function hrSessionFromReq(req: Request): HrSession | null {
  const auth = req.headers.get('authorization') || ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  return verifyHr(m ? m[1] : null)
}
