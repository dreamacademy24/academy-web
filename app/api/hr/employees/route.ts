import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { hrSessionFromReq, canSeeCompany } from '@/lib/hrAuth'
import { displayName, makeEmployeeId } from '@/lib/hr'

export const dynamic = 'force-dynamic'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 관리자만 수정 가능한 필드 화이트리스트 (employee는 조회만)
const EDITABLE = new Set([
  'employee_id','biometrics_id','cost_center','company',
  'last_name','first_name','middle_name','suffix','name_display','photo_url',
  'gender','civil_status','date_of_birth','place_of_birth','nationality','religion',
  'contact_number','personal_email','company_email','current_address','permanent_address',
  'emergency_contact_name','emergency_contact_number','emergency_contact_address','emergency_relationship',
  'status','position','division','department','job_level','date_hired','eval_3month','eval_6month',
  'regularization_date','separation_date','work_location','shift_schedule','time_in','time_out',
  'reporting_to','employment_status','salary_type','basic_salary','tax_status',
  'allow_position','allow_transpo','allow_tutorial','allow_load','bank_name','bank_account','bank_status',
  'sss_no','philhealth_no','pagibig_no','tin','application_no','position_applied','date_of_application',
  'application_status','date_submitted','requirement_status','onboarding_date','requirements','documents','notes',
])
const DATE_FIELDS = new Set(['date_of_birth','date_hired','eval_3month','eval_6month','regularization_date','separation_date','date_of_application','date_submitted','onboarding_date'])
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

// GET  (admin: 전체 / employee: 본인만)   ?id=<uuid> 단건
export async function GET(req: Request) {
  const s = hrSessionFromReq(req)
  if (!s) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')

  let q = db.from('hr_employees').select('*')
  if (s.role === 'employee') {
    if (!s.employee_id) return NextResponse.json({ employees: [] })
    q = q.eq('employee_id', s.employee_id)
  }
  else if (s.companies && s.companies.length) q = q.in('company', s.companies) // 회사별 매니저는 자기 회사만
  if (id) q = q.eq('id', id)
  const { data, error } = await q.order('status').order('last_name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ employees: data ?? [] })
}

// POST 신규 (admin)
export async function POST(req: Request) {
  const s = hrSessionFromReq(req)
  if (!s || s.role !== 'admin') return NextResponse.json({ error: '관리자만 등록할 수 있습니다.' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const fields = clean(body)
  fields.name_display = displayName(fields)
  if (!fields.company) fields.company = s.companies?.[0] || '아카데미'
  if (!canSeeCompany(s, fields.company as string)) return NextResponse.json({ error: '이 회사 직원은 등록할 수 없습니다.' }, { status: 403 })

  // 사원번호 자동 생성 (미입력 시): YYYY-MMDD-seq
  if (!fields.employee_id) {
    const hired = (fields.date_hired as string) || new Date().toISOString().slice(0, 10)
    const y = hired.slice(0, 4), md = hired.slice(5, 7) + hired.slice(8, 10)
    const { data: sameDay } = await db.from('hr_employees').select('employee_id').like('employee_id', `${y}-${md}-%`)
    fields.employee_id = makeEmployeeId(hired, (sameDay ?? []).length)
  }
  const { data, error } = await db.from('hr_employees').insert(fields).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, employee: data })
}

// PATCH 수정 (admin)   { id, ...fields }
export async function PATCH(req: Request) {
  const s = hrSessionFromReq(req)
  if (!s || s.role !== 'admin') return NextResponse.json({ error: '관리자만 수정할 수 있습니다.' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 })
  const fields = clean(body)
  if (s.companies && s.companies.length) {
    const { data: cur } = await db.from('hr_employees').select('company').eq('id', id).single()
    if (!cur || !canSeeCompany(s, cur.company) || ('company' in fields && !canSeeCompany(s, fields.company as string)))
      return NextResponse.json({ error: '이 회사 직원은 수정할 수 없습니다.' }, { status: 403 })
  }
  if ('first_name' in fields || 'last_name' in fields || 'middle_name' in fields) fields.name_display = displayName(fields)
  fields.updated_at = new Date().toISOString()
  const { data, error } = await db.from('hr_employees').update(fields).eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, employee: data })
}
