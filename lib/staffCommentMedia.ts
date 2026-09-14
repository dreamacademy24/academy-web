import {createHash} from 'node:crypto';
import {portalDb,portalStaffIdentity} from './portalAuth';
export type CommentPhoto={name:string;url:string;type:string;size:number};
export const commentPhotoPrefix=(author:string,taskId:string)=>'comment-photos/'+createHash('sha256').update(author+'\0'+taskId).digest('hex').slice(0,32)+'/';
export async function commentAccess(req:Request,taskId:string){
 const username=await portalStaffIdentity(req),author=username?.replace(/^admin-/,'');
 if(!author)throw Object.assign(Error('로그인이 만료되었습니다. 다시 로그인해주세요.'),{status:401});
 if(author==='jun')throw Object.assign(Error('사용 권한이 없습니다.'),{status:403});
 if(!taskId||taskId.length>200)throw Object.assign(Error('업무를 확인해주세요.'),{status:400});
 const db=portalDb(),r=await db.from('staff_tasks').select('id,secret,created_by,assignee,assignees').eq('id',taskId).maybeSingle();
 if(r.error)throw Object.assign(Error('업무 권한을 확인하지 못했습니다.'),{status:503});
 let ids=r.data?.assignees; if(typeof ids==='string'){try{ids=JSON.parse(ids);}catch{ids=[];}}
 if(!r.data||(r.data.secret&&r.data.created_by!==author&&r.data.assignee!==author&&!(Array.isArray(ids)&&ids.includes(author))))throw Object.assign(Error('이 업무에 접근할 수 없습니다.'),{status:403});
 return {db,author};
}
export function validateCommentPhotos(value:unknown,author:string,taskId:string):CommentPhoto[]{
 if(!Array.isArray(value)||value.length>10)throw Error('댓글에는 사진을 10장까지 첨부할 수 있습니다.');
 const prefix=process.env.NEXT_PUBLIC_SUPABASE_URL+'/storage/v1/object/public/staff-files/'+commentPhotoPrefix(author,taskId);
 return value.map(f=>{if(!f||typeof f.name!=='string'||!f.name||f.name.length>250||typeof f.url!=='string'||!f.url.startsWith(prefix)||!/^[a-f\d-]{36}\.(jpg|png|webp|gif)$/.test(f.url.slice(prefix.length))||!['image/jpeg','image/png','image/webp','image/gif'].includes(f.type)||!Number.isSafeInteger(f.size)||f.size<1||f.size>3*1024*1024)throw Error('사진 첨부 정보를 확인해주세요. 다시 첨부한 뒤 저장해주세요.');return {name:f.name,url:f.url,type:f.type,size:f.size};});
}
