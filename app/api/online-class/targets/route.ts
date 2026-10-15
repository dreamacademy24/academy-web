import { workspaceStaffIdentity } from '@/lib/portalAuth'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const EXCL_KEY = 'oc_targets_excluded'

// GET: 올해 다녀간(체크인 기준) 아이 전체 — 화상영어 등록 대상 목록
export async function GET(req: Request) {
  if(!await workspaceStaffIdentity(req)) return NextResponse.json({error:'직원 로그인이 필요합니다.'},{status:401})
  const memoMap = new Map<string,string>()
  for(let offset=0;;offset+=500){
    const {data,error}=await supabase.from('online_target_memos').select('target_key,memo').order('target_key').range(offset,offset+499)
    if(error)return NextResponse.json({error:'메모를 불러오지 못했습니다.'},{status:500})
    for(const row of data||[])memoMap.set(row.target_key,row.memo)
    if(!data||data.length<500)break
  }
  const year = new Date(Date.now() + 8 * 3600 * 1000).getFullYear()
  const { data: bks, error } = await supabase.from('bookings')
    .select('id, booker_name, checkin_date, checkout_date, house_no, accom_room, accom_type, students, portal_user_id, status')
    .gte('checkin_date', `${year}-01-01`)
    .neq('status', '취소')
    .order('checkin_date')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: enr } = await supabase.from('online_enrollments')
    .select('student_name, status')
  const enrolledActive = new Set((enr || []).filter(e => e.status === 'active' || e.status === 'scheduled').map(e => (e.student_name || '').trim()))
  const enrolledEver = new Set((enr || []).map(e => (e.student_name || '').trim()))

  const { data: ex } = await supabase.from('app_settings').select('value').eq('key', EXCL_KEY).maybeSingle()
  const excluded: string[] = Array.isArray(ex?.value) ? ex!.value : []
  const exSet = new Set(excluded)

  const rows: any[] = []
  for (const b of (bks || [])) {
    if ((b.accom_type || '').includes('통학')) continue // 통학형 제외 (화상영어 대상 아님)
    let arr: unknown = b.students
    if (typeof arr === 'string') { try { arr = JSON.parse(arr) } catch { arr = [] } }
    if (!Array.isArray(arr)) continue
    for (const st of arr) {
      const name = (st.korName || st.name_kr || st.name || '').trim()
      if (!name) continue
      const key = `${b.id}|${name}`
      rows.push({
        key,
        name_kr: name,
        name_en: (st.engName || st.name_en || '').trim(),
        birth: (st.birthYear || st.age || '').toString(),
        booker_name: b.booker_name,
        house: b.house_no || b.accom_room || b.accom_type || '',
        ci: b.checkin_date, co: b.checkout_date,
        portal_user_id: b.portal_user_id || null,
        enrolled: enrolledActive.has(name) ? 'active' : enrolledEver.has(name) ? 'past' : null,
        excluded: exSet.has(key),
        contact_memo: memoMap.get(key) || '',
      })
    }
  }
  return NextResponse.json({ targets: rows, excluded })
}

// POST: { action: 'exclude'|'restore', key }
export async function POST(req: Request) {
  const author=await workspaceStaffIdentity(req)
  if(!author)return NextResponse.json({error:'직원 로그인이 필요합니다.'},{status:401})
  const body=await req.json().catch(()=>null)
  if(!body)return NextResponse.json({error:'bad request'},{status:400})
  const {action,key,memo}=body
  if(action==='memo'){
    if(typeof key!=='string'||key.length>300||!key.includes('|')||typeof memo!=='string'||memo.length>1000)return NextResponse.json({error:'메모는 1000자 이내로 입력해주세요.'},{status:400})
    const {error}=await supabase.from('online_target_memos').upsert({target_key:key,memo,updated_by:author,updated_at:new Date().toISOString()},{onConflict:'target_key'})
    if(error)return NextResponse.json({error:'메모 저장에 실패했습니다.'},{status:500})
    return NextResponse.json({ok:true})
  }
  if (!key || !['exclude', 'restore'].includes(action)) return NextResponse.json({ error: 'bad request' }, { status: 400 })
  const { data: ex } = await supabase.from('app_settings').select('value').eq('key', EXCL_KEY).maybeSingle()
  let list: string[] = Array.isArray(ex?.value) ? ex!.value : []
  if (action === 'exclude') { if (!list.includes(key)) list.push(key) }
  else list = list.filter(k => k !== key)
  const { error } = await supabase.from('app_settings').upsert({ key: EXCL_KEY, value: list }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, excluded: list })
}
