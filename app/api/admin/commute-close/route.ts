import { NextResponse } from 'next/server';
import { getStaffIdentity, portalDb } from '@/lib/portalAuth';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const validDay=(d:unknown):d is string=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
const result=(r:any)=>({closedAt:r?.finalized_at||null,closedBy:r?.finalized_by||null,data:r?.finalized_at?r.finalized_data:null});
export async function GET(req:Request){try{
 if(!await getStaffIdentity(req))return reply({error:'직원 로그인이 필요합니다.'},401);
 const day=new URL(req.url).searchParams.get('day');if(!validDay(day))return reply({error:'날짜를 확인해주세요.'},400);
 const {data,error}=await portalDb().from('pickup_schedules').select('finalized_at,finalized_by,finalized_data').eq('day',day).maybeSingle();if(error)throw error;
 return reply(result(data));
}catch{return reply({error:'마감 상태를 불러오지 못했습니다.'},503);}}
export async function POST(req:Request){try{
 const staff=await getStaffIdentity(req);if(!staff)return reply({error:'직원 로그인이 필요합니다.'},401);
 const body=await req.json();if(!validDay(body.day)||!['close','reopen'].includes(body.action))return reply({error:'날짜와 처리 방법을 확인해주세요.'},400);
 const db=portalDb();
 if(body.action==='reopen'){
  const r=await db.from('pickup_schedules').update({finalized_at:null,finalized_by:null,finalized_data:null}).eq('day',body.day).select('finalized_at,finalized_by,finalized_data').maybeSingle();if(r.error)throw r.error;return reply(result(r.data));
 }
 const data=body.data;
 if(!data||!Array.isArray(data.drivers)||!data.drivers.length||!Array.isArray(data.legend)||!Array.isArray(data.absent)||JSON.stringify(data).length>1000000)return reply({error:'저장할 통학표를 확인해주세요.'},400);
 if(data.drivers.some((d:any)=>typeof d.name!=='string'||!d.name.trim()||['am','pm'].some(p=>!Array.isArray(d[p])||d[p].some((g:any)=>!Array.isArray(g.cards)))))return reply({error:'기사와 시간 그룹을 확인해주세요.'},400);
 const prior=await db.from('pickup_schedules').select('finalized_at,finalized_by,finalized_data').eq('day',body.day).maybeSingle();if(prior.error)throw prior.error;
 if(prior.data?.finalized_at)return reply(result(prior.data));
 // One write publishes an immutable snapshot; subsequent draft autosaves cannot alter it.
 const seed=await db.from('pickup_schedules').upsert({day:body.day,data},{onConflict:'day',ignoreDuplicates:true});if(seed.error)throw seed.error;
 const r=await db.from('pickup_schedules').update({data,updated_at:new Date().toISOString(),finalized_at:new Date().toISOString(),finalized_by:staff.username,finalized_data:data}).eq('day',body.day).is('finalized_at',null).select('finalized_at,finalized_by,finalized_data').maybeSingle();if(r.error)throw r.error;
 if(r.data)return reply(result(r.data));
 const current=await db.from('pickup_schedules').select('finalized_at,finalized_by,finalized_data').eq('day',body.day).single();if(current.error)throw current.error;return reply(result(current.data));
}catch{return reply({error:'마감 저장에 실패했습니다. 다시 시도해주세요.'},503);}}
