import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  // 먼저 대상 확인
  const { data: before, error: selErr } = await supabase
    .from('online_enrollments')
    .select('id, student_name, pre_sessions, post_sessions, class_period')
    .eq('student_name', '김하은')
    .eq('pre_sessions', 6)

  if (selErr) { console.error('SELECT error:', selErr.message); process.exit(1) }
  console.log('대상 행:', JSON.stringify(before, null, 2))

  const { data, error } = await supabase
    .from('online_enrollments')
    .update({ class_period: 'both' })
    .eq('student_name', '김하은')
    .eq('pre_sessions', 6)
    .select('id, student_name, pre_sessions, post_sessions, class_period')

  if (error) { console.error('UPDATE error:', error.message); process.exit(1) }
  console.log('수정 완료:', JSON.stringify(data, null, 2))
}

main()
