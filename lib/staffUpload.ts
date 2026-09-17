import {createHmac, timingSafeEqual} from 'node:crypto';
export const STAFF_FILE_LIMIT = 50 * 1024 * 1024;
export const STAFF_FILE_COUNT = 30;
export type UploadTicket = {id:string;author:string;scope:'task'|'comment'|'chat';context:string;bucket:string;path:string;name:string;mime:string;size:number;expires:number};
const key=()=>process.env.STAFF_SESSION_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY!;
export function uploadTicket(value:UploadTicket){const body=Buffer.from(JSON.stringify(value)).toString('base64url');return body+'.'+createHmac('sha256',key()).update('staff-upload:'+body).digest('base64url');}
export function readUploadTicket(value:unknown):UploadTicket{
 if(typeof value!=='string'||value.length>6000)throw Object.assign(Error('업로드 확인 정보가 올바르지 않습니다.'),{status:400});
 const [body,mac,...extra]=value.split('.'),expected=createHmac('sha256',key()).update('staff-upload:'+body).digest(),actual=Buffer.from(mac||'','base64url');
 if(extra.length||actual.length!==expected.length||!timingSafeEqual(actual,expected))throw Object.assign(Error('업로드 확인 정보가 올바르지 않습니다.'),{status:400});
 const t=JSON.parse(Buffer.from(body,'base64url').toString());if(t.expires<Date.now())throw Object.assign(Error('업로드 시간이 만료되었습니다. 파일을 다시 선택해주세요.'),{status:400});return t;
}
export function imageKind(bytes:Uint8Array){const b=Buffer.from(bytes),hex=b.subarray(0,12).toString('hex'),ascii=b.subarray(0,12).toString('ascii');return hex.startsWith('89504e470d0a1a0a')?['png','image/png']:hex.startsWith('ffd8ff')?['jpg','image/jpeg']:ascii.startsWith('GIF87a')||ascii.startsWith('GIF89a')?['gif','image/gif']:ascii.startsWith('RIFF')&&ascii.slice(8)==='WEBP'?['webp','image/webp']:null;}
