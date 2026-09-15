import webpush from 'web-push';
import {portalDb} from './portalAuth';
export function allowedPushEndpoint(value:unknown){
 if(typeof value!=='string'||value.length>4096)return false;
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['fcm.googleapis.com','android.googleapis.com','web.push.apple.com','push.services.mozilla.com','notify.windows.com'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h));}catch{return false;}
}
export function pushKey(){return (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||'').trim().replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export async function sendChatPush(db:ReturnType<typeof portalDb>,ids:string[],room:string,message:string){
 if(!ids.length)return 'not_requested';
 if(!pushKey()||!process.env.VAPID_PRIVATE_KEY)return 'unavailable';
 webpush.setVapidDetails(process.env.VAPID_SUBJECT||'mailto:admin@dreamacademyph.com',pushKey(),process.env.VAPID_PRIVATE_KEY.trim().replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''));
 const result=await db.from('staff_message_push').select('*').in('employee',ids);if(result.error)throw result.error;
 const url='/admin/view?src='+encodeURIComponent('/staff?page=chat&room='+encodeURIComponent(room)+'&message='+message);
 let failed=false;
 await Promise.all((result.data||[]).map(async s=>{
  if(!allowedPushEndpoint(s.endpoint))return;
  try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify({title:'직원업무 · 새 메시지',body:room==='all'?'전체 채팅에서 나를 언급했습니다.':'새 개인 메시지가 도착했습니다.',url,tag:'staff-chat-'+room}),{TTL:3600,timeout:5000});}
  catch(e){const code=(e as any).statusCode;if(code===404||code===410)await db.from('staff_message_push').delete().eq('endpoint',s.endpoint);else failed=true;}
 }));return failed?'failed':result.data?.length?'sent':'no_subscription';
}
