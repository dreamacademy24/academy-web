import {NextResponse} from 'next/server';
import {getStaffIdentity,portalDb} from '@/lib/portalAuth';
import {avatarEmojis} from '@/lib/staffAvatar';
export const dynamic='force-dynamic';
const emojis=avatarEmojis;
export async function GET(req:Request){
 try {
  const staff=await getStaffIdentity(req);
  if(!staff||!['korean_admin','local_teacher'].includes(staff.role))return NextResponse.json({error:'직원 로그인이 필요합니다.'},{status:403});
  const {data,error}=await portalDb().from('staff_accounts').select('initial,color,signature').eq('id',staff.id).single();
  if(error)throw error;
  return NextResponse.json({profile:data},{headers:{'Cache-Control':'private, no-store',Vary:'Cookie'}});
 }catch{return NextResponse.json({error:'프로필을 불러오지 못했습니다.'},{status:503});}
}
export async function PATCH(req:Request){
 try {
  const staff=await getStaffIdentity(req);
  if(!staff||!['korean_admin','local_teacher'].includes(staff.role))return NextResponse.json({error:'직원 로그인이 필요합니다.'},{status:403});
  const b=await req.json().catch(()=>null);
  if(!b||typeof b!=='object'||Array.isArray(b)||!Object.keys(b).length||Object.keys(b).some(k=>!['initial','color','signature'].includes(k))||('initial' in b&&(typeof b.initial!=='string'||!(/^[A-Z0-9가-힣]{1,2}$/.test(b.initial)||emojis.includes(b.initial))))||('color' in b && (typeof b.color!=='string'||!/^#[0-9a-f]{6}$/i.test(b.color)))||('signature' in b && (typeof b.signature!=='string'||b.signature.length>10000)))return NextResponse.json({error:'입력 내용을 확인해주세요.'},{status:400});
  const {data,error}=await portalDb().from('staff_accounts').update(b).eq('id',staff.id).select('initial,color,signature').single();
  if(error)throw error;
  return NextResponse.json({profile:data},{headers:{'Cache-Control':'private, no-store',Vary:'Cookie'}});
 }catch{return NextResponse.json({error:'프로필을 저장하지 못했습니다.'},{status:503});}
}
export async function PUT(req:Request){
 try{
  const staff=await getStaffIdentity(req);
  if(!staff||!['korean_admin','local_teacher'].includes(staff.role))return NextResponse.json({error:'직원 로그인이 필요합니다.'},{status:403});
  const body=await req.json();
  if(typeof body.initial!=='string'||!(/^[A-Z0-9가-힣]{1,2}$/.test(body.initial)||emojis.includes(body.initial))||typeof body.color!=='string'||!/^#[0-9a-f]{6}$/i.test(body.color)||typeof body.signature!=='string'||body.signature.length>10000)return NextResponse.json({error:'이니셜은 1~2글자 또는 제공된 캐릭터로 선택해주세요.'},{status:400});
  const {data,error}=await portalDb().from('staff_accounts').update({initial:body.initial,color:body.color,signature:body.signature}).eq('id',staff.id).select('initial,color').single();
  if(error)throw error;
  return NextResponse.json({profile:data},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return NextResponse.json({error:'프로필을 저장하지 못했습니다.'},{status:503});}
}
