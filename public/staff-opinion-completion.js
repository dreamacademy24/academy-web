(function(){
 'use strict';
 var filter='active', detail={}, busy=false;
 var get=window.sbGet, list=window._renderOpListItems, vote=window._voteRender;
 window.sbGet=function(table,query){
  if(table==='staff_opinions'&&query==='order=ts.desc&limit=50')query='order=ts.desc&limit=1000';
  return get(table,query).then(function(rows){
   if(table==='staff_opinions')rows.forEach(function(op){if('completed_at' in op)detail[op.id]=op;});
   return rows;
  });
 };
 function button(label,handler){var b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=handler;b.style.cssText='padding:9px 14px;border:1px solid #d6d1ed;border-radius:8px;background:#fff;color:#5341a6;font:600 13px inherit;cursor:pointer';return b;}
 window._renderOpListItems=function(){
  var el=document.getElementById('opListItems');if(!el)return;
  var tabs=document.getElementById('opStatusTabs');
  if(!tabs){tabs=document.createElement('div');tabs.id='opStatusTabs';tabs.style.cssText='display:flex;gap:6px;padding:10px;flex-wrap:wrap';el.before(tabs);}
  tabs.replaceChildren();
  var all=window._opListCache||[];
  [['active','진행 중'],['done','완료'],['all','전체']].forEach(function(pair){
   var count=all.filter(function(o){return pair[0]==='all'||(pair[0]==='done'?!!o.completed_at:!o.completed_at);}).length;
   var b=button(pair[1]+' '+count,function(){filter=pair[0];window._renderOpListItems();});
   b.setAttribute('aria-pressed',String(filter===pair[0]));if(filter===pair[0]){b.style.background='#ede8fa';b.style.borderColor='#7960cf';}tabs.append(b);
  });
  window._opListCache=all.filter(function(o){return filter==='all'||(filter==='done'?!!o.completed_at:!o.completed_at);}).map(function(o){return Object.assign({},o,{title:(o.completed_at?'✓ 완료 · ':'')+o.title});});
  try{list();if(!window._opListCache.length)el.innerHTML='<div style="padding:24px;text-align:center;color:#64748b">'+(filter==='done'?'완료된 의견요청이 없습니다.':'진행 중인 의견요청이 없습니다.')+'</div>';}finally{window._opListCache=all;}
 };
 window._voteRender=function(op){
  // Reuse the existing result renderer, hiding voting controls for completed polls.
  return vote(op.completed_at?Object.assign({},op,{vote_deadline:'1900-01-01'}):op);
 };
 var cast=window.castVote;
 window.castVote=function(id,idx){
  get('staff_opinions','id=eq.'+id).then(function(rows){
   var op=rows[0];if(!op||op.completed_at){toast('완료된 투표입니다.');openOpinionDetail(id);return;}
   cast(id,idx);
  }).catch(function(){toast('투표 상태를 확인하지 못했습니다. 다시 시도해주세요.','#ef4444');});
 };
 function ask(message){return new Promise(function(resolve){
  var modal=document.createElement('dialog');modal.style.cssText='border:1px solid #ddd6ef;border-radius:16px;padding:24px;max-width:420px;color:#25304a';
  var text=document.createElement('p');text.textContent=message;text.style.lineHeight='1.7';modal.append(text);
  function end(value){modal.close();modal.remove();resolve(value);}
  modal.append(button('취소',function(){end(false);}),button('확인',function(){end(true);}));
  modal.addEventListener('cancel',function(e){e.preventDefault();end(false);});document.body.append(modal);modal.showModal();
 });}
 async function complete(op){
  if(busy)return;
  busy=true;
  if(!await ask(op.completed_at?'이 의견요청을 다시 진행할까요? 기존 투표 결과는 유지됩니다.':'의견요청을 완료할까요? 투표는 마감되며 결과와 답변은 그대로 남습니다.')){busy=false;return;}
  var b=document.getElementById('opCompleteButton');if(b){b.disabled=true;b.textContent='저장 중…';}
  try{
   var r=await fetch('/api/staff/opinion-completion',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:op.id,completed:!op.completed_at})});
   var body=await r.json();if(!r.ok)throw new Error(body.error||'저장 실패');
   detail[op.id]=body.opinion;
   window._opListCache=(window._opListCache||[]).map(function(o){return String(o.id)===String(op.id)?body.opinion:o;});
   filter=body.opinion.completed_at?'done':'active';
   toast(body.opinion.completed_at?'완료되었습니다. 투표 결과는 계속 볼 수 있습니다.':'다시 진행합니다.');
   openOpinionDetail(op.id);
  }catch(e){toast(e.message,'#ef4444');if(b){b.disabled=false;b.textContent=op.completed_at?'다시 진행':'✓ 완료';}}
  finally{busy=false;}
 }
 function decorate(){
  var det=document.getElementById('opDetail'),op=detail[window._opdCurId];
  if(!det||!op||!det.querySelector('#opdReplyBtn')||det.querySelector('#opCompletionBar'))return;
  var bar=document.createElement('div');bar.id='opCompletionBar';bar.style.cssText='display:flex;align-items:center;gap:12px;padding:12px 20px;background:'+(op.completed_at?'#ecfdf5':'#f7f5ff')+';border-bottom:1px solid #e5e7eb;flex-wrap:wrap';
  var label=document.createElement('span');label.style.cssText='flex:1;font-weight:700;font-size:13px;color:#334155';
  label.textContent=op.completed_at?'✓ 완료 · 결과와 답변을 보관하고 있습니다.':'진행 중 · 의견을 모두 확인한 후 완료해주세요.';bar.append(label);
  var me=window.CU;
  if(me&&(String(me.id)===String(op.from_id)||['ceo','admin','korean_admin'].includes(me.role))){var b=button(op.completed_at?'다시 진행':'✓ 완료',function(){complete(op);});b.id='opCompleteButton';bar.append(b);}
  det.prepend(bar);
 }
 new MutationObserver(decorate).observe(document.body,{childList:true,subtree:true});
 decorate();
})();

