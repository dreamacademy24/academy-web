const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{createClient}=require('@supabase/supabase-js');
const base=process.argv[2]||'http://localhost:4198',db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}}),username='test-checkin-summary-'+randomUUID().slice(0,8),password=randomUUID()+'Ab9!';
const ok=r=>{if(r.error)throw Error(r.error.message);return r.data;};
(async()=>{try{
 ok(await db.rpc('exec_sql',{sql:`insert into staff_accounts(username,password_hash,role,name,is_active) values ('${username}',crypt('${password}',gen_salt('bf')),'korean_admin','[Test] Check-in summary',true)`}));
 const login=await fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
 const endpoint=base+'/api/dreamhouse/checklist/bookings',get=(suffix='',headers={Cookie:cookie})=>fetch(endpoint+suffix,{headers});
 assert.equal((await get('',{})).status,401);assert.equal((await get('',{Cookie:cookie,Origin:'https://other.invalid'})).status,401);assert.equal((await get('?bookingId=invalid')).status,400);
 const listResponse=await get();assert.equal(listResponse.status,200);const list=(await listResponse.json()).bookings;assert.ok(Array.isArray(list));
 if(list.length){const id=list[0].id;const before=ok(await db.from('checkin_details').select('*').eq('booking_id',id));const response=await get('?bookingId='+id);assert.equal(response.status,200);const data=await response.json();assert.deepEqual(Object.keys(data.summary).sort(),['beds','date','guest','house']);assert.equal(data.summary.date.length,10);assert.deepEqual(ok(await db.from('checkin_details').select('*').eq('booking_id',id)),before);}
 console.log('PASS authenticated reservation list and basic summary, invalid/anonymous/cross-origin denial, read-only detail lookup');
}finally{ok(await db.from('staff_accounts').delete().eq('username',username));}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
