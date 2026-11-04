import { portalStaffIdentity } from '@/lib/portalAuth'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const KEYS: Record<string, string> = { confirm: 'oc_confirmed_enrollments', close: 'oc_closed_enrollments' }

export async function GET(req: Request) {
  if(!await portalStaffIdentity(req))return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:401})
  const out: Record<string, string[]> = {}
  for (const [kind, key] of Object.entries(KEYS)) {
    const { data } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle()
    out[kind] = Array.isArray(data?.value) ? data!.value : []
  }
  return NextResponse.json({ ids: out.confirm, confirm: out.confirm, close: out.close })
}

// POST { id, on, kind?: 'confirm'|'close' }
export async function POST(req:Request){
 const actor=await portalStaffIdentity(req);
 if(!actor)return NextResponse.json({error:'관리자 승인 권한이 필요합니다.'},{status:403});
 const origin=req.headers.get('origin');
 if(origin&&new URL(origin).host!==new URL(req.url).host)return NextResponse.json({error:'현재 사이트에서 다시 시도해주세요.'},{status:403});
 const {id,on,kind='confirm',expectedTutorId}=await req.json();
 if(typeof id!=='string'||typeof on!=='boolean'||!KEYS[kind])return NextResponse.json({error:'잘못된 요청입니다.'},{status:400});
 const {data,error}=await supabase.rpc('set_online_application_approval',{p_id:id,p_on:on,p_kind:kind,p_actor:actor,p_expected_tutor:expectedTutorId||null});
 if(error)return NextResponse.json({error:error.message.includes('ASSIGN_FIRST')?'현지직원이 선생님을 배정한 뒤 승인해주세요.':error.message.includes('STALE')?'배정이 변경되었습니다. 새로고침 후 다시 확인해주세요.':'승인 상태를 저장하지 못했습니다.'},{status:409});
 return NextResponse.json({ok:true,ids:data});
}
