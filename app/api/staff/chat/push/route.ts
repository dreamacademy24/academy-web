import {NextResponse} from 'next/server';
import {chatAccess,chatError} from '@/lib/staffChat';
import {allowedPushEndpoint,pushKey} from '@/lib/staffChatPush';
export async function GET(req:Request){try{await chatAccess(req);return NextResponse.json({publicKey:pushKey(),available:!!pushKey()&&!!process.env.VAPID_PRIVATE_KEY});}catch(e){return NextResponse.json({error:(e as Error).message},{status:(e as any).status||503});}}
export async function POST(req:Request){try{
 const c=await chatAccess(req),b=await req.json();
 if(!allowedPushEndpoint(b.endpoint)||!b.keys||!['p256dh','auth'].every(k=>typeof b.keys[k]==='string'&&/^[A-Za-z0-9_=-]{16,200}$/.test(b.keys[k])))chatError('알림 구독 정보가 올바르지 않습니다.');
 const r=await c.db.from('staff_message_push').upsert({endpoint:b.endpoint,employee:c.actor,p256dh:b.keys.p256dh,auth:b.keys.auth,updated_at:new Date().toISOString()});if(r.error)throw r.error;
 return NextResponse.json({ok:true});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:(e as any).status||503});}}
export async function DELETE(req:Request){try{const c=await chatAccess(req),b=await req.json();const r=await c.db.from('staff_message_push').delete().eq('employee',c.actor).eq('endpoint',String(b.endpoint));if(r.error)throw r.error;return NextResponse.json({ok:true});}catch(e){return NextResponse.json({error:(e as Error).message},{status:(e as any).status||503});}}
