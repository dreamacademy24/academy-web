import {NextResponse} from 'next/server';
import {getStaffIdentity,portalDb} from '@/lib/portalAuth';

export const dynamic='force-dynamic';
const fields='id,title,text,files,done,date,require_read,teacher_shared';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
const unavailable=()=>reply({error:'공지를 처리하지 못했습니다. 잠시 후 다시 시도해주세요. / Notices are temporarily unavailable.'},503);
const validId=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(value);
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const string=(value:unknown,max:number):value is string=>typeof value==='string'&&value.length<=max;

type Attachment={name:string;type:string;size?:number;url?:string;data?:string};
function attachment(value:unknown):Attachment|null{
 if(!object(value)||!string(value.name,500)||!string(value.type,100))return null;
 if(value.size!==undefined&&(typeof value.size!=='number'||!Number.isSafeInteger(value.size)||value.size<0||value.size>30*1024*1024))return null;
 const result:Attachment={name:value.name,type:value.type};
 if(value.size!==undefined)result.size=value.size as number;
 if(value.url!==undefined){
  if(!string(value.url,4096)||/[\\\u0000-\u001f]/.test(value.url))return null;
  try{const url=new URL(value.url,'https://staff.invalid');if(url.protocol!=='https:'||value.url.startsWith('//')||(!value.url.startsWith('/')&&!value.url.startsWith('https://')))return null;}catch{return null;}
  result.url=value.url;
 }
 // Older notices contain inline JPEG attachments. Preserve safe image data on edits.
 if(value.data!==undefined){
  if(!string(value.data,768*1024)||!/^data:image\/(?:png|jpeg|gif|webp);base64,[a-zA-Z0-9+/=\r\n]+$/.test(value.data))return null;
  result.data=value.data;
 }
 return result.url||result.data?result:null;
}
function notice(value:unknown){
 if(!object(value)||!validId(value.id)||!string(value.title,500)||!string(value.text,200000)||!string(value.date,100)||/[\u0000-\u001f]/.test(value.date)||typeof value.done!=='boolean'||typeof value.require_read!=='boolean'||typeof value.teacher_shared!=='boolean'||!Array.isArray(value.files)||value.files.length>20)return null;
 const files=value.files.map(attachment);
 if(files.some(file=>file===null)||(!value.title.trim()&&!value.text.trim()&&!files.length))return null;
 return {id:value.id,title:value.title,text:value.text,files,done:value.done,date:value.date,require_read:value.require_read,teacher_shared:value.teacher_shared};
}

export async function GET(req:Request){
 try{
  const staff=await getStaffIdentity(req);
  if(!staff)return reply({error:'Please sign in. / 로그인이 필요합니다.'},401);
  if(!['korean_admin','local_teacher'].includes(staff.role))return reply({error:'Access denied.'},403);
  const isAdmin=staff.role==='korean_admin',db=portalDb(),notices:unknown[]=[];
  for(let offset=0;offset<10000;offset+=100){
   let query=db.from('staff_notices').select(fields);
   if(!isAdmin)query=query.eq('teacher_shared',true);
   const {data,error}=await query.order('date',{ascending:false}).order('id',{ascending:false}).range(offset,offset+99);
   if(error||!Array.isArray(data))return unavailable();
   notices.push(...data);
   if(data.length<100)return reply({notices,isAdmin});
  }
  return unavailable();
 }catch{return unavailable();}
}

export async function POST(req:Request){
 try{
  const staff=await getStaffIdentity(req);
  if(!staff)return reply({error:'Please sign in. / 로그인이 필요합니다.'},401);
  if(staff.role!=='korean_admin')return reply({error:'Access denied.'},403);
  const raw=await req.text();
  if(Buffer.byteLength(raw,'utf8')>1024*1024)return reply({error:'공지 내용이나 첨부가 너무 큽니다. / Notice is too large.'},413);
  let input;try{input=JSON.parse(raw);}catch{return reply({error:'Invalid notice. / 올바른 공지 형식이 필요합니다.'},400);}
  const row=notice(input);
  if(!row)return reply({error:'Invalid notice. / 공지 내용과 공유 대상을 확인해주세요.'},400);
  const {data,error}=await portalDb().from('staff_notices').upsert(row,{onConflict:'id'}).select(fields).single();
  if(error||!data)return unavailable();
  return reply({notice:data});
 }catch{return unavailable();}
}

export async function DELETE(req:Request){
 try{
  const staff=await getStaffIdentity(req);
  if(!staff)return reply({error:'Please sign in. / 로그인이 필요합니다.'},401);
  if(staff.role!=='korean_admin')return reply({error:'Access denied.'},403);
  const id=new URL(req.url).searchParams.get('id');
  if(!validId(id))return reply({error:'Invalid notice ID. / 공지 번호를 확인해주세요.'},400);
  const {error}=await portalDb().from('staff_notices').delete().eq('id',id);
  if(error)return unavailable();
  return reply({deleted:true,id});
 }catch{return unavailable();}
}
