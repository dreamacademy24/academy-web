import { NextResponse } from 'next/server';
import { portalDb, workspaceStaffIdentity } from '@/lib/portalAuth';

export async function POST(req: Request, {params}: {params: Promise<{id:string}>}) {
  if (!await workspaceStaffIdentity(req)) return NextResponse.json({error:'직원 로그인이 필요합니다.'},{status:403});
  const {id} = await params;
  const fields = await req.json().catch(()=>null);
  if (!fields || typeof fields.name_kr !== 'string' || !fields.name_kr.trim() || fields.name_kr.length>100)
    return NextResponse.json({error:'학생 이름을 확인해주세요.'},{status:400});
  for (const key of ['academy_start','academy_end']) {
    const value = fields[key];
    if (value && (typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value))
      return NextResponse.json({error:'수업 날짜를 확인해주세요.'},{status:400});
  }
  if (fields.academy_start && fields.academy_end && fields.academy_end<fields.academy_start)
    return NextResponse.json({error:'종료일은 시작일 이후여야 합니다.'},{status:400});
  const {data,error} = await portalDb().rpc('staff_add_booking_student',{p_booking_id:id,p_fields:fields});
  if (error) return NextResponse.json({error:error.code==='23505'?'같은 이름의 학생이 이미 등록되어 있습니다. 새로고침 후 확인해주세요.':'학생을 저장하지 못했습니다. 기존 정보는 유지됩니다.'},{status:400});
  return NextResponse.json({student:data});
}
