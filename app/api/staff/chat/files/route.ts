import {NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {chatAccess,chatError,chatTask,uuid} from '@/lib/staffChat';
export const dynamic='force-dynamic';
export async function POST(req:Request){try{
 if(Number(req.headers.get('content-length'))>3.5*1024*1024)chatError('파일 한 개는 3MB 이하로 첨부해주세요.',413);
 const c=await chatAccess(req),form=await req.formData(),room=String(form.get('room')||'');c.checkRoom(room);const f=form.get('file');
 if(!f||typeof f==='string'||!f.size||f.size>3*1024*1024)chatError('파일 한 개는 3MB 이하로 첨부해주세요.');
 const name=f.name.slice(0,200).replace(/[\r\n]/g,''),ext=name.split('.').pop()?.toLowerCase();
 const buffer=Buffer.from(await f.arrayBuffer()),hex=buffer.subarray(0,12).toString('hex'),ascii=buffer.subarray(0,12).toString('ascii');
 const image=hex.startsWith('89504e470d0a1a0a')?'image/png':hex.startsWith('ffd8ff')?'image/jpeg':ascii.startsWith('GIF87a')||ascii.startsWith('GIF89a')?'image/gif':ascii.startsWith('RIFF')&&ascii.slice(8)==='WEBP'?'image/webp':null;
 if(!image&&!['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','csv','zip'].includes(ext||''))chatError('사진 또는 PDF·문서·엑셀·압축 파일을 선택해주세요.');
 const id=randomUUID(),path=c.actor+'/'+id,mime=image||'application/octet-stream';
 const upload=await c.db.storage.from('staff-chat-private').upload(path,buffer,{contentType:mime,upsert:false});if(upload.error)chatError('파일 업로드에 실패했습니다.',503);
 const saved=await c.db.from('staff_message_files').insert({id,room,owner:c.actor,path,name,mime,size:f.size}).select('id,name,mime,size').single();
 if(saved.error){await c.db.storage.from('staff-chat-private').remove([path]);throw saved.error;}
 return NextResponse.json({file:saved.data});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:(e as any).status||503});}}
export async function GET(req:Request){try{
 const c=await chatAccess(req),id=new URL(req.url).searchParams.get('id');if(!uuid(id))chatError('파일을 찾을 수 없습니다.',404);
 const f=await c.db.from('staff_message_files').select('*').eq('id',id).single();if(f.error)chatError('파일을 찾을 수 없습니다.',404);
 if(!c.rooms.includes(f.data.room)){
  // A linked task shares this selected message's attachments, not the DM history.
  const messages=await c.db.from('staff_messages').select('id').contains('files',JSON.stringify([{id}]));if(messages.error)throw messages.error;
  const ids=(messages.data||[]).map(m=>m.id);let allowed=false;
  if(ids.length){const links=await c.db.from('staff_message_links').select('task_id').in('message_id',ids);if(links.error)throw links.error;
   for(const l of links.data||[]){try{await chatTask(c.db,l.task_id,c.actor);allowed=true;break;}catch{}}
  }if(!allowed)chatError('이 파일에 접근할 수 없습니다.',403);
 }
 const download=await c.db.storage.from('staff-chat-private').download(f.data.path);if(download.error)throw download.error;
 const inline=f.data.mime.startsWith('image/');
 return new Response(await download.data.arrayBuffer(),{headers:{'Content-Type':f.data.mime,'Content-Disposition':(inline?'inline':'attachment')+"; filename*=UTF-8''"+encodeURIComponent(f.data.name),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:(e as any).status||503});}}
