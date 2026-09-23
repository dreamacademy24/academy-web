import {NextResponse} from 'next/server';
import {getStaffIdentity,portalDb} from '@/lib/portalAuth';
import {validAvatar,avatarPropCount} from '@/lib/staffAvatar';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie'}});
export async function GET(req:Request){
  try {
    const staff=await getStaffIdentity(req);
    if(!staff||!['korean_admin','local_teacher'].includes(staff.role))return reply({error:'직원 로그인이 필요합니다.'},403);
    const db=portalDb();
    const [{data:rows,error},{data:people,error:peopleError}]=await Promise.all([
      db.from('app_settings').select('key,value').like('key','staff_avatar:%'),
      db.from('staff_accounts').select('id,username').eq('is_active',true).in('role',['korean_admin','local_teacher'])
    ]);
    if(error||peopleError)throw error||peopleError;
    const avatars:Record<string,unknown>={};let avatar:unknown=null;
    for(const row of rows||[]){
      let value;try{value=typeof row.value==='string'?JSON.parse(row.value):row.value;}catch{continue;}
      if(!validAvatar(value))continue;
      const person=people?.find(p=>'staff_avatar:'+p.id===row.key);if(!person)continue;
      avatars[person.username.replace(/^admin-/,'')]=value;
      if(person.id===staff.id)avatar=value;
    }
    return reply({avatar,avatars});
  }catch{return reply({error:'아바타를 불러오지 못했습니다. 다시 시도해주세요.'},503);}
}
export async function PUT(req:Request){
  try {
    const staff=await getStaffIdentity(req);
    if(!staff||!['korean_admin','local_teacher'].includes(staff.role))return reply({error:'직원 로그인이 필요합니다.'},403);
    const body=await req.json().catch(()=>null);
    if(!validAvatar(body))return reply({error:'제공된 아바타와 소품 중에서 선택해주세요. 이니셜은 1~2글자입니다.'},400);
    if(avatarPropCount(body)>5)return reply({error:'소품은 최대 5개까지 저장할 수 있습니다.'},400);
    const {error}=await portalDb().from('app_settings').upsert({key:'staff_avatar:'+staff.id,value:JSON.stringify(body)},{onConflict:'key'});
    if(error)throw error;
    return reply({avatar:body});
  }catch{return reply({error:'아바타를 저장하지 못했습니다. 선택한 내용은 유지됩니다.'},503);}
}

