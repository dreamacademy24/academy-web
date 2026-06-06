import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ENROLLMENT_ID = '9d42bd8b-93f7-4cdc-b5ff-a9a42d82753c'

async function main() {
  // 기존 세션 1건에서 tutor_id / 시간 복사 (INSERT ... SELECT ... LIMIT 1 재현)
  const { data: src, error: selErr } = await supabase
    .from('online_sessions')
    .select('tutor_id, scheduled_time_kr, scheduled_time_ph')
    .eq('enrollment_id', ENROLLMENT_ID)
    .limit(1)
    .single()

  if (selErr) { console.error('SELECT error:', selErr.message); process.exit(1) }
  console.log('복사 원본:', JSON.stringify(src))

  const { data, error } = await supabase
    .from('online_sessions')
    .insert({
      enrollment_id: ENROLLMENT_ID,
      tutor_id: src.tutor_id,
      session_number: 6,
      scheduled_date: '2026-06-19',
      scheduled_time_kr: src.scheduled_time_kr,
      scheduled_time_ph: src.scheduled_time_ph,
      status: 'scheduled',
    })
    .select('id, session_number, scheduled_date, scheduled_time_kr, scheduled_time_ph, status')

  if (error) { console.error('INSERT error:', error.message); process.exit(1) }
  console.log('삽입 완료:', JSON.stringify(data, null, 2))
}

main()
