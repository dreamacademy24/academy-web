import {randomUUID} from 'node:crypto';
import {portalDb,portalStaffIdentity} from '@/lib/portalAuth';
import {commentAccess,commentPhotoPrefix} from '@/lib/staffCommentMedia';
import {chatAccess,chatError} from '@/lib/staffChat';
import {STAFF_FILE_LIMIT,uploadTicket,readUploadTicket,imageKind,type UploadTicket} from '@/lib/staffUpload';
export const dynamic='force-dynamic';
async function access(req:Request,scope:string,context:string){
 if(scope==='chat'){const c=await chatAccess(req);c.checkRoom(context);return {db:c.db,author:c.actor};}
 if(scope==='comment')return commentAccess(req,context);
 const staff=await portalStaffIdentity(req),author=staff?.replace(/^admin-/,'');if(!author)chatError('직원 로그인이 필요합니다.',401);if(author==='jun')chatError('사용 권한이 없습니다.',403);if(scope!=='task')chatError('첨부 위치를 확인해주세요.');return {db:portalDb(),author};
}
export async function POST(req:Request){try{
 if(Number(req.headers.get('content-length'))>12000)chatError('잘못된 업로드 요청입니다.');
 const b=await req.json();
 if(b.action==='prepare'){
  const {db,author}=await access(req,b.scope,String(b.context||''));
  if(typeof b.name!=='string'||!b.name.trim()||b.name.length>250||!Number.isSafeInteger(b.size)||b.size<1||b.size>STAFF_FILE_LIMIT)chatError('파일 한 개는 50MB 이하로 선택해주세요.');
  if(typeof b.head!=='string'||!/^[0-9a-f]{0,24}$/i.test(b.head))chatError('파일 형식을 확인해주세요.');
  const kind=imageKind(Buffer.from(b.head,'hex')),ext=b.name.split('.').pop()?.toLowerCase();
  if(b.scope==='comment'&&!kind)chatError('댓글에는 JPG·PNG·WebP·GIF 사진을 첨부해주세요.');
  if(!kind&&!['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','csv','zip','hwp','hwpx','mp4','mov','mp3','m4a','heic','heif'].includes(ext||''))chatError('사진·문서·영상·압축 파일을 선택해주세요.');
  const id=randomUUID(),mime=kind?.[1]||'application/octet-stream',bucket=b.scope==='chat'?'staff-chat-private':'staff-files';
  const path=b.scope==='chat'?author+'/'+id:b.scope==='comment'?commentPhotoPrefix(author,b.context)+id+'.'+kind![0]:'task-files/'+id+'.'+(kind?.[0]||ext);
  const ticket:UploadTicket={id,scope:b.scope,context:String(b.context||''),author,bucket,path,name:b.name.replace(/[\r\n]/g,''),mime,size:b.size,expires:Date.now()+2*60*60*1000};
  const r=await db.storage.from(bucket).createSignedUploadUrl(path,{upsert:false});if(r.error)throw r.error;
  return Response.json({url:r.data.signedUrl,ticket:uploadTicket(ticket),mime});
 }
 if(b.action!=='complete')chatError('잘못된 업로드 요청입니다.');
 const t=readUploadTicket(b.ticket),{db,author}=await access(req,t.scope,t.context);if(author!==t.author)chatError('본인이 올린 파일만 첨부할 수 있습니다.',403);
 const bucket=db.storage.from(t.bucket),info=await bucket.info(t.path);if(info.error)chatError('파일 전송이 완료되지 않았습니다. 다시 시도해주세요.',409);
 if(info.data.size!==t.size||info.data.contentType!==t.mime){await bucket.remove([t.path]);chatError('전송된 파일의 크기·형식이 다릅니다. 다시 첨부해주세요.');}
 if(t.mime.startsWith('image/')){
  const signed=await bucket.createSignedUrl(t.path,60);if(signed.error)throw signed.error;
  const r=await fetch(signed.data.signedUrl,{headers:{Range:'bytes=0-11'},cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)chatError('사진을 확인하지 못했습니다.',503);
  const reader=r.body!.getReader();let head=new Uint8Array(0);try{while(head.length<12){const chunk=await reader.read();if(chunk.done)break;head=new Uint8Array([...head,...chunk.value.subarray(0,12-head.length)]);}}finally{void reader.cancel().catch(()=>{});}
  if(imageKind(head)?.[1]!==t.mime){await bucket.remove([t.path]);chatError('사진 형식이 올바르지 않습니다.');}
 }
 if(t.scope==='chat'){
  const result=await db.from('staff_message_files').upsert({id:t.id,room:t.context,owner:author,path:t.path,name:t.name,mime:t.mime,size:t.size},{onConflict:'id',ignoreDuplicates:true});if(result.error)throw result.error;
  return Response.json({file:{id:t.id,name:t.name,mime:t.mime,size:t.size}});
 }
 return Response.json({file:{name:t.name,url:bucket.getPublicUrl(t.path).data.publicUrl,type:t.mime,size:t.size}});
 }catch(e){const err=e as Error&{status?:number};console.error('staff upload',err.message);return Response.json({error:err.status?err.message:'파일을 저장하지 못했습니다. 다시 시도해주세요.'},{status:err.status||503});}}
