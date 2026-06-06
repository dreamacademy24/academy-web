import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { data, error } = await supabase
    .from('online_sessions')
    .select('session_number, scheduled_date, status')
    .eq('enrollment_id', '9d42bd8b-93f7-4cdc-b5ff-a9a42d82753c')
    .gte('scheduled_date', '2026-06-01')
    .lte('scheduled_date', '2026-06-30')
    .order('scheduled_date')

  if (error) { console.error(error.message); process.exit(1) }
  for (const s of data ?? []) {
    const dow = ['일','월','화','수','목','금','토'][new Date(s.scheduled_date + 'T00:00:00').getDay()]
    console.log(`#${s.session_number}\t${s.scheduled_date} (${dow})\t${s.status}`)
  }
}

main()
