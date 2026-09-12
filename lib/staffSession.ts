import {createHmac,timingSafeEqual} from 'node:crypto';
export const STAFF_COOKIE='portal_staff_session';
export type StaffIdentity={id:string;username:string;role:string;name:string};
export function signStaffSession(username:string,key:string,now=Date.now()){
 if(!key)throw new Error('Staff session key required');
 const payload=Buffer.from(JSON.stringify({username,expires:now+8*3600000})).toString('base64url');
 return `${payload}.${createHmac('sha256',key).update('portal-staff-v1:'+payload).digest('base64url')}`;
}
export async function resolveStaffSession(req:Request,key:string,lookup:(username:string)=>Promise<StaffIdentity|null>,now=Date.now()):Promise<StaffIdentity|null>{
 try{
  if(!key)return null;
  const origin=req.headers.get('origin');
  if(origin&&origin!==new URL(req.url).origin)return null;
  const value=req.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(STAFF_COOKIE+'='))?.slice(STAFF_COOKIE.length+1);
  if(!value)return null;
  const parts=value.split('.');if(parts.length!==2)return null;
  const [payload,signature]=parts;
  const expected=Buffer.from(createHmac('sha256',key).update('portal-staff-v1:'+payload).digest('base64url'));
  const actual=Buffer.from(signature);
  if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return null;
  const claim=JSON.parse(Buffer.from(payload,'base64url').toString());
  if(typeof claim.username!=='string'||!claim.username.trim()||!Number.isFinite(claim.expires)||claim.expires<=now)return null;
  return await lookup(claim.username);
 }catch{return null;}
}
export const canReviewStudents=(staff:StaffIdentity|null)=>staff?.role==='korean_admin';
