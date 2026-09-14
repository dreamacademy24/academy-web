import {NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {commentAccess,commentPhotoPrefix} from '@/lib/staffCommentMedia';
export async function POST(req:Request){try{
 if(Number(req.headers.get('content-length'))>3.5*1024*1024)return NextResponse.json({error:'사진은 최적화 후 3MB 이하로 첨부해주세요.'},{status:413});
 const form=await req.formData(),taskId=String(form.get('taskId')||'');const {db,author}=await commentAccess(req,taskId);const file=form.get('photo');
 if(!file||typeof file==='string'||file.size<1||file.size>3*1024*1024)return NextResponse.json({error:'사진 한 장은 3MB 이하로 첨부해주세요.'},{status:400});
 const buffer=Buffer.from(await file.arrayBuffer());const hex=buffer.subarray(0,12).toString('hex'),ascii=buffer.subarray(0,12).toString('ascii');
 const kind=hex.startsWith('89504e470d0a1a0a')?['png','image/png']:hex.startsWith('ffd8ff')?['jpg','image/jpeg']:ascii.startsWith('GIF87a')||ascii.startsWith('GIF89a')?['gif','image/gif']:ascii.startsWith('RIFF')&&ascii.slice(8)==='WEBP'?['webp','image/webp']:null;
 if(!kind)return NextResponse.json({error:'JPG·PNG·WebP·GIF 사진만 첨부할 수 있습니다.'},{status:400});
 const path=commentPhotoPrefix(author,taskId)+randomUUID()+'.'+kind[0];const result=await db.storage.from('staff-files').upload(path,buffer,{contentType:kind[1],upsert:false});
 if(result.error)return NextResponse.json({error:'사진을 올리지 못했습니다. 다시 시도해주세요.'},{status:503});
 return NextResponse.json({photo:{name:file.name.slice(0,250),url:db.storage.from('staff-files').getPublicUrl(path).data.publicUrl,type:kind[1],size:file.size}});
 }catch(e){return NextResponse.json({error:(e as Error).message||'사진을 올리지 못했습니다.'},{status:(e as any).status||400});}}
