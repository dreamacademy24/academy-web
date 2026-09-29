import { currentHr, hrDb, hrError } from '@/lib/hrServer'
export const dynamic = 'force-dynamic'
const UUID = /^[a-f0-9-]{36}$/i
async function allowed(req: Request, id: string) {
  const user = await currentHr(req)
  if (!user) return { response: Response.json({ error: 'Sign in required / 로그인이 필요합니다.' }, { status: 401 }) }
  if (!UUID.test(id)) return { response: Response.json({ error: 'Invalid employee ID' }, { status: 400 }) }
  const { data, error } = await hrDb.from('hr_employees').select('id').eq('id', id).in('company', user.companies).maybeSingle()
  if (error) throw error
  if (!data) return { response: Response.json({ error: 'Employee not available / 접근할 수 없는 직원입니다.' }, { status: 404 }) }
  return { user }
}
export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get('employee') || ''
    const access = await allowed(req, id); if (access.response) return access.response
    const { data, error } = await hrDb.from('hr_employee_records').select('*').eq('employee_id', id).order('occurred_on', { ascending: false }).order('created_at', { ascending: false })
    if (error) throw error
    return Response.json({ records: data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) { return hrError(e) }
}
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const access = await allowed(req, String(body.employee_id || '')); if (access.response) return access.response
    if (!['note','evaluation','training','meeting'].includes(body.kind) || typeof body.title !== 'string' || !body.title.trim() || body.title.length > 160 || typeof body.content !== 'string' || !body.content.trim() || body.content.length > 12000 || !/^\d{4}-\d{2}-\d{2}$/.test(body.occurred_on) || (body.follow_up_on && !/^\d{4}-\d{2}-\d{2}$/.test(body.follow_up_on))) return Response.json({ error: 'Check the record title, content and dates. / 제목·내용·날짜를 확인해주세요.' }, { status: 400 })
    const { data, error } = await hrDb.from('hr_employee_records').insert({ employee_id: body.employee_id, kind: body.kind, title: body.title.trim(), content: body.content.trim(), occurred_on: body.occurred_on, follow_up_on: body.follow_up_on || null, created_by: access.user!.username }).select('*').single()
    if (error) throw error
    return Response.json({ record: data })
  } catch (e) { return hrError(e) }
}
