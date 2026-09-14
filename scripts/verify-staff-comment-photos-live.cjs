// Real login and HTTP/storage lifecycle. Only run-owned, private fixtures are touched.
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{createClient}=require('@supabase/supabase-js');
const base=process.argv[2]||process.env.BASE_URL||'http://localhost:4187';
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const ok=r=>{if(r.error)throw Error(r.error.message);return r.data;};
const run=randomUUID(),username='test-photo-'+run.slice(0,8),password=randomUUID()+'Aa9!',taskId='test-comment-'+run,commentId=randomUUID(),keys=[];
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMioAAAAASUVORK5CYII=','base64');
(async()=>{try{
 ok(await db.rpc('exec_sql',{sql:`insert into staff_accounts(username,password_hash,role,name,is_active) values ('${username}',crypt('${password}',gen_salt('bf')),'korean_admin','[TEST] Comment photos',true)`}));
 ok(await db.from('staff_tasks').insert({id:taskId,title:'[TEST private] comment photo verification',secret:true,created_by:username,assignee:username,assignees:[username]}));
 const login=await fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
 const json=async(method,body)=>{const r=await fetch(base+'/api/staff/comments',{method,headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 const upload=async()=>{const form=new FormData();form.set('taskId',taskId);form.set('photo',new File([png],'test.png',{type:'image/png'}));const r=await fetch(base+'/api/staff/comments/photos',{method:'POST',headers:{Cookie:cookie},body:form}),data=await r.json();assert.equal(r.status,200,JSON.stringify(data));keys.push(data.photo.url.split('/staff-files/')[1]);assert.equal((await fetch(data.photo.url)).status,200);return data.photo;};
 const photo=await upload(),second=await upload();console.log('PASS authenticated image upload and public preview');
 const body={id:commentId,taskId,text:'',files:[photo]};let r=await json('POST',body);assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.comment.from_id,username);assert.equal(r.data.comment.files.length,1);
 assert.equal((await json('POST',body)).status,200);assert.equal(ok(await db.from('staff_task_comments').select('id').eq('task_id',taskId)).length,1);console.log('PASS photo-only comment, persisted author, idempotent retry');
 r=await json('PATCH',{...body,originalText:'',originalFiles:[photo],text:'[TEST] edited',files:[photo,second]});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.comment.files.length,2);
 assert.equal((await json('PATCH',{...body,originalText:'',originalFiles:[photo],text:'stale',files:[]})).status,409);
 r=await json('PATCH',{...body,originalText:'[TEST] edited',originalFiles:[photo,second],text:'[TEST] edited',files:[second]});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.comment.files.length,1);
 r=await json('DELETE',{id:commentId,taskId,originalText:'[TEST] edited',originalFiles:[second]});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.deleted,true);assert.equal(ok(await db.from('staff_task_comments').select('id').eq('id',commentId)).length,0);console.log('PASS edit/add/remove photos, stale conflict, delete and database confirmation');
 const anon=await fetch(base+'/api/staff/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(anon.status,401);console.log('PASS anonymous write denied');
 }finally{
  ok(await db.from('staff_task_comments').delete().eq('task_id',taskId));ok(await db.from('staff_tasks').delete().eq('id',taskId));if(keys.length)ok(await db.storage.from('staff-files').remove(keys));ok(await db.from('staff_accounts').delete().eq('username',username));console.log('Exact private test task, comments, images and account removed');
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
