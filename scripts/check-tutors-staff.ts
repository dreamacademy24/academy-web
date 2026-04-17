import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  const { data, error } = await supabase
    .from('online_tutors')
    .select('id, name_display, name_en, staff_user_id, is_active')
    .order('name_display')
  if (error) { console.log('❌', error.message); return }
  console.log('online_tutors 전체:')
  ;(data || []).forEach(t => {
    console.log(`  ${t.id} | ${t.name_display} (${t.name_en}) | staff_user_id=${t.staff_user_id || 'null'} | active=${t.is_active}`)
  })
}
run().catch(console.error)
