const fs=require('node:fs'),{createClient}=require('@supabase/supabase-js');
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const oldIds=[1,6,8,10],title='[사용 예시 · 투표] 직원홈 색상 시안 4개 중 골라주세요';
const body=`직원홈에서 업무와 알림이 더 잘 보이도록 색상 시안 4개를 준비했습니다. 기존 화면 구성을 기준으로 색감과 대비를 비교하는 예시이며, 실제 홈페이지 색상은 아직 바뀌지 않았습니다. 이미지 속 이름·숫자·업무 내용은 시안용입니다.

참여 방법
1. 각 시안 이미지를 눌러 크게 확인해주세요.
2. 가장 보기 편한 시안의 ‘투표하기’를 누르세요. 한 사람당 1개를 선택합니다.
3. 선택 이유나 추가 의견은 선택사항입니다. 투표만 하셔도 됩니다. 남기고 싶은 의견이 있으면 아래 답변란에 적고 ‘등록’을 눌러주세요.

A안 · 퍼플·네이비: 기존 보라색 계열을 살리고 제목과 구역을 또렷하게 구분합니다.
B안 · 딥 틸·민트: 청록과 민트로 차분하게 구분합니다.
C안 · 로열 블루·스카이: 파란색 대비로 버튼과 업무 상태를 선명하게 표시합니다.
D안 · 웜 오렌지·차콜: 따뜻한 배경과 진한 글자, 오렌지 포인트를 사용합니다.

답변 예시(실제 직원 의견이 아닙니다)
“B안이 오래 보기 편합니다. 새 댓글 표시는 조금 더 진하게 해주세요.”

의견요청을 직접 올리는 방법
‘+ 의견 요청’ → 제목·질문·대상 작성 → 선택지를 비교하려면 ‘투표’ 선택 → 항목과 이미지 추가 → 등록.
여러 사람의 의견을 모을 때 사용하고, 결정 후 실행할 일은 기존 업무에 연결하거나 업무로 등록해주세요.

이 글은 사용법을 보여주는 샘플이면서 실제 색상 선호도를 받는 투표입니다. 마감일은 지정하지 않았습니다.`;
const options=[['A','퍼플·네이비','a-purple-navy'],['B','딥 틸·민트','b-teal-mint'],['C','로열 블루·스카이','c-blue-sky'],['D','웜 오렌지·차콜','d-orange-charcoal']].map(([id,label,file])=>({label:id+'안 · '+label,url:'/staff-home-colors/'+file+'.png'}));
const ok=r=>{if(r.error)throw Error(r.error.message);return r.data;},lit=s=>"'"+String(s).replaceAll("'","''")+"'";
(async()=>{
 fs.mkdirSync('tmp/home-color-vote',{recursive:true});
 const opinions=ok(await db.from('staff_opinions').select('*').in('id',oldIds)),replies=ok(await db.from('staff_op_replies').select('*').in('opinion_id',oldIds)),votes=ok(await db.from('staff_votes').select('*').in('opinion_id',oldIds)),notifications=ok(await db.from('staff_notifications').select('*').eq('type','opinion'));
 const related=notifications.filter(n=>oldIds.map(String).includes(n.ref_id)||opinions.some(o=>String(n.message).includes(o.title)));
 const backup='tmp/home-color-vote/backup-'+Date.now()+'.json';fs.writeFileSync(backup,JSON.stringify({opinions,replies,votes,notifications:related},null,2));console.log('Backed up existing opinions:',opinions.length,'replies:',replies.length,'votes:',votes.length,'to',backup);
 if(!process.argv.includes('--apply'))return;
 for(const o of options){if(!fs.existsSync('public'+o.url))throw Error('Missing image '+o.url);const r=await fetch('https://www.dreamacademyph.com'+o.url);if(!r.ok||!r.headers.get('content-type')?.startsWith('image/'))throw Error('Image not deployed '+o.url);}
 const deleteNotifications=related.length?'delete from staff_notifications where id in ('+related.map(n=>lit(n.id)).join(',')+');':'';
 // A single exec_sql RPC runs atomically in the function's transaction.
 const sql=`
 insert into staff_opinions(from_id,target,title,body,ts,type,vote_options,vote_deadline,files)
 select 'ceo','all',${lit(title)},${lit(body)},${Date.now()},'vote',${lit(JSON.stringify(options))}::jsonb,null,'[]'::jsonb
 where not exists(select 1 from staff_opinions where title=${lit(title)});
 delete from staff_votes where opinion_id in (1,6,8,10);
 delete from staff_op_replies where opinion_id in (1,6,8,10);
 ${deleteNotifications}
 delete from staff_opinions where id in (1,6,8,10);`;
 ok(await db.rpc('exec_sql',{sql}));
 const remaining=ok(await db.from('staff_opinions').select('id,title,type,vote_options').order('id'));
 console.log(JSON.stringify(remaining.map(o=>({id:o.id,title:o.title,type:o.type,options:o.vote_options?.length})),null,2));
 fs.writeFileSync('tmp/home-color-vote/published.json',JSON.stringify(remaining.find(o=>o.title===title)));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
