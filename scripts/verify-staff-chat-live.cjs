// Uses isolated, temporary employee-role accounts and a private task. Never messages real employees.
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{createClient}=require('@supabase/supabase-js');
const base=process.argv[2]||'http://localhost:4193',db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}}),run=randomUUID().slice(0,8),ids=['a','b','c'].map(i=>'test-chat-'+run+'-'+i),task='test-chat-task-'+run,room='dm:'+ids.slice(0,2).sort().join(':'),message=randomUUID(),reply=randomUUID(),password=randomUUID()+'Ab9!',paths=[];
const ok=r=>{if(r.error)throw Error(r.error.message);return r.data;};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMioAAAAASUVORK5CYII=','base64');
(async()=>{try{
 for(const id of ids)ok(await db.rpc('exec_sql',{sql:`insert into staff_accounts(username,password_hash,role,name,is_active) values ('${id}',crypt('${password}',gen_salt('bf')),'korean_admin','[검증용] 채팅 테스트',true)`}));
 const cookies=[];for(const username of ids){const r=await fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});assert.equal(r.status,200);cookies.push(r.headers.get('set-cookie').split(';')[0]);}
 const api=async(i,body,query='')=>{const r=await fetch(base+'/api/staff/chat'+query,{method:body?'POST':'GET',headers:{...(i>=0?{Cookie:cookies[i]}:{}),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
 assert.equal((await api(-1,null)).status,401);assert.equal((await api(2,null,'?room='+encodeURIComponent(room))).status,403);
 const form=new FormData();form.set('room',room);form.set('file',new File([png],'검증 사진.png',{type:'image/png'}));const uploaded=await fetch(base+'/api/staff/chat/files',{method:'POST',headers:{Cookie:cookies[0]},body:form}),f=await uploaded.json();assert.equal(uploaded.status,200,JSON.stringify(f));paths.push(ids[0]+'/'+f.file.id);
 const body={id:message,room,text:'[검증용] 저장·읽음·권한 테스트',files:[f.file.id],mentions:[ids[2]],sender:ids[2]};
 const sent=await Promise.all([api(0,body),api(0,body)]);sent.forEach(r=>assert.equal(r.status,200,JSON.stringify(r.data)));assert.equal(sent.filter(r=>r.data.created).length,1);assert.equal(sent[0].data.message.sender,ids[0]);assert.equal(sent[0].data.message.mentions.length,0);
 assert.equal((await api(0,{...body,text:'different'})).status,409);
 assert.equal((await api(1,{id:reply,room,text:'[검증용] 답장',files:[],reply:message})).status,200);
 const list=await api(1,null,'?room='+encodeURIComponent(room));assert.equal(list.data.messages.length,2);assert.equal(list.data.replies[0].id,message);
 const seq=list.data.messages[1].seq;await Promise.all([api(1,{action:'read',room,seq}),api(1,{action:'read',room,seq:list.data.messages[0].seq})]);
 const reads=await api(1,null,'?room='+encodeURIComponent(room));assert.equal(reads.data.reads.find(r=>r.employee===ids[1]).seq,seq);
 assert.equal((await api(1,null,'?room='+encodeURIComponent(room)+'&q='+encodeURIComponent('저장'))).data.messages.length,1);
 const fileUrl=base+'/api/staff/chat/files?id='+f.file.id;assert.equal((await fetch(fileUrl)).status,401);assert.equal((await fetch(fileUrl,{headers:{Cookie:cookies[2]}})).status,403);assert.equal((await fetch(fileUrl,{headers:{Cookie:cookies[1]}})).status,200);
 const publicFile=db.storage.from('staff-chat-private').getPublicUrl(paths[0]).data.publicUrl;assert.notEqual((await fetch(publicFile)).status,200);
 ok(await db.from('staff_tasks').insert({id:task,title:'[검증용 비공개] 채팅 연결',secret:true,created_by:ids[0],assignee:ids[2],assignees:JSON.stringify([ids[0],ids[2]])}));
 for(let i=0;i<2;i++)assert.equal((await api(0,{action:'link',message,task})).status,200);
 assert.equal((await api(2,null,'?task='+task)).data.messages[0].canOpen,false);assert.equal((await fetch(fileUrl,{headers:{Cookie:cookies[2]}})).status,200);assert.equal((await api(2,null,'?room='+encodeURIComponent(room))).status,403);
 const push=await fetch(base+'/api/staff/chat/push',{headers:{Cookie:cookies[0]}});assert.equal(push.status,200);console.log('PASS real employee-role login; DM isolation; photo upload/private download; concurrent idempotent send/read; reply/search; task link with selected-file sharing; push config',await push.json());
 }finally{
  ok(await db.from('staff_message_links').delete().eq('task_id',task));ok(await db.from('staff_messages').delete().eq('room',room));ok(await db.from('staff_message_reads').delete().eq('room',room));ok(await db.from('staff_message_files').delete().eq('room',room));if(paths.length)ok(await db.storage.from('staff-chat-private').remove(paths));ok(await db.from('staff_tasks').delete().eq('id',task));ok(await db.from('staff_message_push').delete().in('employee',ids));ok(await db.from('staff_accounts').delete().in('username',ids));console.log('Removed only this run’s private test data.');
 }
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
