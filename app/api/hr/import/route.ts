import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { hrSessionFromReq } from '@/lib/hrAuth'
import { displayName } from '@/lib/hr'

export const dynamic = 'force-dynamic'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALLOW = new Set([
  'employee_id','biometrics_id','cost_center','last_name','first_name','middle_name','suffix','photo_url',
  'gender','civil_status','date_of_birth','place_of_birth','nationality','religion','contact_number',
  'personal_email','company_email','current_address','permanent_address','emergency_contact_name',
  'emergency_contact_number','emergency_contact_address','emergency_relationship','status','position','division',
  'department','job_level','date_hired','eval_3month','eval_6month','regularization_date','separation_date',
  'work_location','shift_schedule','time_in','time_out','reporting_to','employment_status','salary_type',
  'basic_salary','tax_status','allow_position','allow_transpo','allow_tutorial','allow_load','bank_name',
  'bank_account','bank_status','sss_no','philhealth_no','pagibig_no','tin','application_no','position_applied',
  'date_of_application','application_status','date_submitted','requirement_status','onboarding_date','requirements','documents','notes',
])
const DATE = new Set(['date_of_birth','date_hired','eval_3month','eval_6month','regularization_date','separation_date','date_of_application','date_submitted','onboarding_date'])
const NUM = new Set(['basic_salary','allow_position','allow_transpo','allow_tutorial','allow_load'])

// POST { employees:[...] } → 사원번호(employee_id) 기준 upsert
export async function POST(req: Request) {
  const s = hrSessionFromReq(req)
  if (!s || s.role !== 'admin') return NextResponse.json({ error: '관리자만 가능합니다.' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const emps = Array.isArray(body.employees) ? body.employees : []
  if (!emps.length) return NextResponse.json({ error: 'employees 배열이 필요합니다.' }, { status: 400 })

  const rows = emps.map((e: Record<string, unknown>) => {
    const o: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(e)) {
      if (!ALLOW.has(k)) continue
      if (DATE.has(k)) o[k] = (v === '' || v == null) ? null : v
      else if (NUM.has(k)) o[k] = (v === '' || v == null) ? 0 : Number(v)
      else o[k] = v
    }
    o.name_display = displayName(o)
    o.updated_at = new Date().toISOString()
    return o
  }).filter((o: Record<string, unknown>) => o.employee_id)

  const { data, error } = await db.from('hr_employees').upsert(rows, { onConflict: 'employee_id' }).select('employee_id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, imported: (data ?? []).length })
}
