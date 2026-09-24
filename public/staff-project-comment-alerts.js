(function(){
 'use strict';
 var expanded=false,refreshQueued=false;
 function comments(){return (myNotifs||[]).filter(function(n){return !n.is_read&&(n.type==='task_comment'||(n.type==='project'||n.type==='opinion')&&/댓글|답변/.test(n.message||''));});}
 function forNode(id){return comments().filter(function(n){return n.type==='project'&&String(n.ref_id)===String(id);});}
 function el(tag,text,cls){var n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
 function person(n){return (typeof ALL==='undefined'?[]:ALL).find(function(p){return String(n.message||'').includes('('+p.name+')')||String(n.message||'').startsWith(p.name+'님');});}
 function avatar(p){var a=el('span',p?(p.initial||p.name.slice(0,1)):'💬','pca-avatar');a.title=p?p.name:'댓글';if(p&&/^#[0-9a-f]{3,8}$/i.test(p.color||''))a.style.background=p.color;return a;}
 var style=el('style');style.textContent='.pca-home{padding:18px;margin:0 0 16px;background:#fff;border:1px solid #d9d1f0;border-left:5px solid #7756c8;border-radius:12px}.pca-home h2{font-size:17px;margin:0 0 6px}.pca-home p{font-size:13px;color:#64748b;margin:0 0 10px}.pca-row{display:flex;gap:10px;align-items:center;width:100%;text-align:left;padding:12px;border:0;border-top:1px solid #eeedf4;background:white;cursor:pointer;font:inherit}.pca-row:hover{background:#f7f4ff}.pca-row small{display:block;color:#64748b;margin-top:5px}.pca-avatar{display:inline-flex;justify-content:center;align-items:center;width:30px;height:30px;border-radius:50%;background:#7866b5;color:white;flex-shrink:0;font-size:14px}.pca-label{display:inline-flex;gap:5px;align-items:center;margin:6px 0;color:#a13929;font-size:12px}.pca-label .pca-avatar{width:23px;height:23px;font-size:11px}.pca-confirm{padding:10px 14px;border:1px solid #bbaade;border-radius:8px;background:#f2edff;color:#50359b;margin:8px 0;cursor:pointer;font:700 13px inherit}';document.head.append(style);
 async function read(rows){
  if(!CU||!rows.length)return;
  var actor=CU,ids=rows.map(function(n){return n.id;});
  try{await sbPatch('staff_notifications','to_id=eq.'+encodeURIComponent(actor.id)+'&id=in.('+ids.map(encodeURIComponent).join(',')+')',{is_read:true});if(CU!==actor)return;myNotifs=myNotifs.filter(function(n){return !ids.includes(n.id);});renderNotifBadges();refresh();}
  catch(e){toast('댓글 확인 상태를 저장하지 못했습니다. 다시 눌러주세요.','#ef4444');}
 }
 function open(n){
  if(n.type==='project'){
   window._ptPendingSel=String(n.ref_id);showPage('ptree');
   var wait=setInterval(function(){if(typeof PT!=='undefined'&&String(PT.sel)===String(n.ref_id)){var box=document.getElementById('ptCmtList');if(box&&PT.comments[n.ref_id]!==undefined){clearInterval(wait);box.scrollIntoView({behavior:'smooth',block:'center'});}}},150);setTimeout(function(){clearInterval(wait);},15000);
  }else if(n.type==='task_comment'){selectEmpTask(String(n.ref_id));}
  else{showPage('opinions');if(n.ref_id)setTimeout(function(){openOpinionDetail(n.ref_id);},200);}
 }
 function renderHome(host){
  var rows=comments(),sig=rows.map(function(n){return n.id;}).join('|')+'|'+expanded;
  if(host.dataset.signature===sig)return;host.dataset.signature=sig;host.replaceChildren();
  host.append(el('h2','💬 확인할 댓글 '+rows.length+'건'),el('p','댓글 확인 → 해당 글로 이동합니다. 프로젝트 댓글은 읽은 뒤 확인 버튼을 눌러주세요.'));
  if(!rows.length){host.append(el('p','확인할 새 댓글이 없습니다.'));return;}
  rows.slice(0,expanded?rows.length:6).forEach(function(n){var b=el('button',null,'pca-row');b.type='button';var text=el('span',n.message||'새 댓글');text.style.flex='1';text.append(el('small',typeof _actWhen==='function'?_actWhen(n.created_at):''));b.append(avatar(person(n)),text,el('strong','댓글 확인 →'));b.onclick=function(){open(n);};host.append(b);});
  if(rows.length>6){var more=el('button',expanded?'접기':'댓글 '+(rows.length-6)+'건 더 보기','pca-confirm');more.onclick=function(){expanded=!expanded;refresh();};host.append(more);}
 }
 function refresh(){
  document.querySelectorAll('[data-staff-chat-home]').forEach(function(anchor){var host=anchor.nextElementSibling;if(!host||!host.classList.contains('pca-home')){host=el('section',null,'pca-home');host.setAttribute('aria-label','확인할 댓글');anchor.after(host);}renderHome(host);});
  document.querySelectorAll('#pwRows tr').forEach(function(row){var id=row.dataset.nodeId;if(!id)return;var notes=forNode(id),cell=row.querySelector('td'),old=row.querySelector('.pca-label'),sig=notes.map(function(n){return n.id;}).join('|');if(old&&old.dataset.signature===sig)return;if(old)old.remove();if(!notes.length||!cell)return;var label=el('span',null,'pca-label');label.dataset.signature=sig;var people=[];notes.forEach(function(n){var p=person(n);if(p&&!people.some(function(x){return x.id===p.id;}))people.push(p);});people.slice(0,4).forEach(function(p){label.append(avatar(p));});label.append(el('b','새 댓글 '+notes.length));cell.append(label);});
  var list=document.getElementById('ptCmtList');if(list&&typeof PT!=='undefined'&&PT.sel&&PT.comments[PT.sel]!==undefined){var notes=forNode(PT.sel),old=document.getElementById('pcaConfirm'),sig=notes.map(function(n){return n.id;}).join('|');if(old&&old.dataset.signature!==sig)old.remove();if(notes.length&&!document.getElementById('pcaConfirm')){var b=el('button','✓ 댓글 '+notes.length+'건 확인했어요','pca-confirm');b.id='pcaConfirm';b.dataset.signature=sig;b.onclick=function(){read(notes);};list.after(b);}}
 }
 var priorLoad=loadMyNotifs;loadMyNotifs=function(){return Promise.resolve(priorLoad()).then(function(){refresh();});};
 // Opening a project is not an acknowledgement of its comments.
 ptMarkNodeRead=function(id){read((myNotifs||[]).filter(function(n){return n.type==='project'&&String(n.ref_id)===String(id)&&!/댓글|답변/.test(n.message||'');}));};
 var priorDetail=ptRenderDetail;ptRenderDetail=function(id){if(id&&typeof PT!=='undefined')delete PT.comments[id];return priorDetail(id);};
 var priorGo=_empNotifGo;_empNotifGo=function(idx){var n=(window._empNotifList||[])[idx];if(n&&n.type==='project'&&/댓글|답변/.test(n.message||'')){open(n);return;}return priorGo(idx);};
 new MutationObserver(function(){if(refreshQueued)return;refreshQueued=true;setTimeout(function(){refreshQueued=false;refresh();},50);}).observe(document.body,{childList:true,subtree:true});
 refresh();
})();

