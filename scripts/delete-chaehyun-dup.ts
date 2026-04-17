import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TARGET_ENROLLMENT_ID = '99170f89-ff33-4072-9428-69cdb8de17cf'

async function run() {
  console.log('========================================')
  console.log('STEP a. online_sessions DELETE')
  console.log(`  enrollment_id = ${TARGET_ENROLLMENT_ID}`)
  console.log('========================================')
  const { data: sesDel, error: sesErr } = await supabase
    .from('online_sessions')
    .delete()
    .eq('enrollment_id', TARGET_ENROLLMENT_ID)
    .select('id')
  if (sesErr) { console.log('❌ ERROR:', sesErr.message); return }
  console.log(`→ 삭제된 rows: ${sesDel?.length || 0}`)

  console.log('\n========================================')
  console.log('STEP b. online_enrollments DELETE')
  console.log(`  id = ${TARGET_ENROLLMENT_ID}`)
  console.log('========================================')
  const { data: enrDel, error: enrErr } = await supabase
    .from('online_enrollments')
    .delete()
    .eq('id', TARGET_ENROLLMENT_ID)
    .select('id, student_name, tutor_id, created_at')
  if (enrErr) { console.log('❌ ERROR:', enrErr.message); return }
  console.log(`→ 삭제된 rows: ${enrDel?.length || 0}`)
  ;(enrDel || []).forEach(r => console.log(`  - ${r.id} | ${r.student_name} | tutor=${r.tutor_id || 'null'}`))

  console.log('\n========================================')
  console.log('STEP c. 삭제 후 검증 — 이채현 남은 enrollments')
  console.log('========================================')
  const { data: remain, error: remErr } = await supabase
    .from('online_enrollments')
    .select('id, student_name, student_name_en, tutor_id, days_of_week, class_time_kr, start_date, end_date, status, total_sessions, used_sessions, created_at')
    .eq('student_name', '이채현')
    .order('created_at', { ascending: true })
  if (remErr) { console.log('❌ ERROR:', remErr.message); return }
  console.log(`→ 남은 rows: ${remain?.length || 0}건`)
  ;(remain || []).forEach(r => {
    const tag = r.tutor_id ? '✅ tutor 있음' : '⚠️ tutor_id=null (확인 필요)'
    console.log(`  [${tag}]`)
    console.log(`    id=${r.id}`)
    console.log(`    name=${r.student_name} (${r.student_name_en || '-'})`)
    console.log(`    tutor_id=${r.tutor_id || 'null'} | time=${r.class_time_kr} | days=${(r.days_of_week || []).join('/')}`)
    console.log(`    period=${r.start_date} ~ ${r.end_date} | status=${r.status} | ${r.used_sessions}/${r.total_sessions}`)
    console.log(`    created_at=${r.created_at}`)
  })

  if ((remain?.length || 0) === 1 && remain![0].tutor_id) {
    console.log('\n🎉 검증 통과: tutor 있는 1건만 남음')
  } else {
    console.log('\n⚠️  검증 실패: 기대와 다름 (1건이고 tutor_id 있어야 함)')
  }
}

run().catch(console.error)
