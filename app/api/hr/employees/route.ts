import { NextResponse } from 'next/server'
import { validHrDate } from '@/lib/hrTasks'
import { displayName } from '@/lib/hr'
import { currentHr, hrDb, hrError } from '@/lib/hrServer'
export const dynamic = 'force-dynamic'
const EDITABLE = new Set([
  'employee_id','biometrics_id','cost_center','company',
  'last_name','first_name','middle_name','suffix','name_display','photo_url',
  'gender','civil_status','date_of_birth','place_of_birth','nationality','religion',
  'contact_number','personal_email','company_email','current_address','permanent_address',
  'emergency_contact_name','emergency_contact_number','emergency_contact_address','emergency_relationship',
  'status','position','division','department','job_level','date_hired','eval_3month','eval_6month',
  'regularization_date','separation_date','contract_start','contract_end','next_salary_review','work_location','shift_schedule','time_in','time_out',
  'reporting_to','employment_status','salary_type','basic_salary','tax_status',
  'allow_position','allow_transpo','allow_tutorial','allow_load','bank_name','bank_account','bank_status',
  'sss_no','philhealth_no','pagibig_no','tin','application_no','position_applied','date_of_application',
  'application_status','date_submitted','requirement_status','onboarding_date','requirements','documents','notes',
])
const DATE_FIELDS = new Set(['date_of_birth','date_hired','eval_3month','eval_6month','regularization_date','separation_date','contract_start','contract_end','next_salary_review','date_of_application','date_submitted','onboarding_date'])
const NUM_FIELDS = new Set(['basic_salary','allow_position','allow_transpo','allow_tutorial','allow_load'])

function clean(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) {
    if (!EDITABLE.has(k)) continue
    if (DATE_FIELDS.has(k)) out[k] = (v === '' || v == null) ? null : v
    else if (NUM_FIELDS.has(k)) out[k] = (v === '' || v == null) ? 0 : Number(v)
    else out[k] = v
  }
  return out
}

function invalid(fields: Record<string, unknown>) {
  for (const key of NUM_FIELDS) if (key in fields && (!Number.isFinite(fields[key]) || Number(fields[key]) < 0)) return true
  for (const key of DATE_FIELDS) if (fields[key] && !validHrDate(fields[key])) return true
  if ('status' in fields && !['Active', 'Inactive'].includes(String(fields.status))) return true
  if (fields.contract_start && fields.contract_end && String(fields.contract_end)<String(fields.contract_start)) return true
  for (const [key, value] of Object.entries(fields)) if (typeof value === 'string' && value.length > (key === 'notes' ? 12000 : 2000)) return true
  if (fields.photo_url && !/^https:\/\//i.test(String(fields.photo_url))) return true
  if (fields.requirements && (typeof fields.requirements !== 'object' || Array.isArray(fields.requirements) || Object.values(fields.requirements).some(v => typeof v !== 'boolean'))) return true
  if ('documents' in fields && (!Array.isArray(fields.documents) || fields.documents.length > 50 || fields.documents.some(d => !d || typeof d.name !== 'string' || !d.name.trim() || typeof d.url !== 'string' || !/^https:\/\//i.test(d.url)))) return true
  return false
}
const LIST_FIELDS = 'id,employee_id,company,first_name,last_name,middle_name,name_display,status,position,department,employment_status,date_hired,eval_3month,eval_6month,regularization_date,requirements,updated_at'
const headers = { 'Cache-Control': 'no-store' }
export async function GET(req: Request) {
  try {
    const s = await currentHr(req)
    if (!s) return NextResponse.json({ error: 'Sign in required / 로그인이 필요합니다.' }, { status: 401 })
    const id = new URL(req.url).searchParams.get('id')
    let q = hrDb.from('hr_employees').select(id ? '*' : LIST_FIELDS).in('company', s.companies)
    if (id) q = q.eq('id', id)
    const { data, error } = await q.order('status').order('last_name')
    if (error) throw error
    if (id && !data?.length) return NextResponse.json({ error: 'Employee not available / 접근할 수 없는 직원입니다.' }, { status: 404 })
    return NextResponse.json({ employees: data || [], user: { username: s.username, role: s.role, name: s.name, companies: s.companies, language: s.language, full: s.full, must_change_pw: s.must_change_pw } }, { headers })
  } catch (e) { return hrError(e) }
}
export async function POST(req: Request) {
  try {
    const s = await currentHr(req)
    if (!s) return NextResponse.json({ error: 'Sign in required / 로그인이 필요합니다.' }, { status: 401 })
    const fields = clean(await req.json())
    if (!s.companies.includes(String(fields.company))) return NextResponse.json({ error: 'Company access denied / 회사 접근 권한이 없습니다.' }, { status: 403 })
    if (!String(fields.first_name || '').trim() || !String(fields.last_name || '').trim() || invalid(fields)) return NextResponse.json({ error: 'Check required names, dates and amounts. / 이름·날짜·금액을 확인해주세요.' }, { status: 400 })
    fields.name_display = displayName(fields)
    // Random suffix avoids two managers allocating the same sequence concurrently.
    if (!fields.employee_id) fields.employee_id = 'EMP-' + crypto.randomUUID().slice(0, 8).toUpperCase()
    const { data, error } = await hrDb.from('hr_employees').insert(fields).select('*').single()
    if (error?.code === '23505') return NextResponse.json({ error: 'Employee ID already exists. / 이미 사용 중인 사원번호입니다.' }, { status: 409 })
    if (error) throw error
    return NextResponse.json({ employee: data }, { headers })
  } catch (e) { return hrError(e) }
}
export async function PATCH(req: Request) {
  try {
    const s = await currentHr(req)
    if (!s) return NextResponse.json({ error: 'Sign in required / 로그인이 필요합니다.' }, { status: 401 })
    const body = await req.json(), fields = clean(body)
    const { data: existing, error: readError } = await hrDb.from('hr_employees').select('*').eq('id', body.id).in('company', s.companies).maybeSingle()
    if (readError) throw readError
    if (!existing) return NextResponse.json({ error: 'Employee not available / 접근할 수 없는 직원입니다.' }, { status: 404 })
    if ('company' in fields && !s.companies.includes(String(fields.company))) return NextResponse.json({ error: 'Company access denied / 회사 접근 권한이 없습니다.' }, { status: 403 })
    const merged = { ...existing, ...fields }
    if (!String(merged.first_name || '').trim() || !String(merged.last_name || '').trim() || invalid(merged)) return NextResponse.json({ error: 'Check required names, dates and amounts. / 이름·날짜·금액을 확인해주세요.' }, { status: 400 })
    if (body.updated_at !== existing.updated_at) return NextResponse.json({ error: 'Someone updated this employee. Reload before saving. Your changes remain here. / 다른 사용자가 수정했습니다. 입력한 내용을 확인한 뒤 다시 불러와주세요.' }, { status: 409 })
    fields.name_display = displayName(merged); fields.updated_at = new Date().toISOString()
    let q = hrDb.from('hr_employees').update(fields).eq('id', body.id).in('company', s.companies)
    q = existing.updated_at ? q.eq('updated_at', existing.updated_at) : q.is('updated_at', null)
    const { data, error } = await q.select('*').maybeSingle()
    if (error?.code === '23505') return NextResponse.json({ error: 'Employee ID already exists. / 이미 사용 중인 사원번호입니다.' }, { status: 409 })
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Record changed. Reload before saving. / 다른 변경이 있어 저장하지 않았습니다.' }, { status: 409 })
    return NextResponse.json({ employee: data }, { headers })
  } catch (e) { return hrError(e) }
}

