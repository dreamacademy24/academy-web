/* Staff chat: authenticated API, private attachments, explicit task handoff. */
(function(){
'use strict';
var s={actor:'',employees:[],room:'all',counts:[],messages:[],reads:[],links:[],replies:[],q:'',target:'',more:false,busy:false,loading:false,draft:null,version:0},pendingTask=null;
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function name(id){var p=s.employees.find(function(e){return e.id===id;});return p?p.name:id;}
function roomName(room){return room==='all'?'전체 채팅':name(room.split(':').filter(function(id){return id!=='dm'&&id!==s.actor;})[0]);}
function dm(id){return 'dm:'+ [s.actor,id].sort().join(':');}
async function api(query,body){var r=await fetch('/api/staff/chat'+(query||''),{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});var d=await r.json();if(!r.ok)throw Error(d.error||'요청에 실패했습니다.');return d;}
function host(){return document.getElementById('scRoot');}
function active(){var p=document.getElementById('page-chat');return p&&!p.classList.contains('hidden')&&!document.hidden;}
function error(e){var el=document.getElementById('scError');if(el)el.textContent=e.message||e;}
function key(){return 'staff-chat-draft:'+s.actor+':'+s.room;}
function empty(){return {id:crypto.randomUUID(),text:'',files:[],reply:null,mentions:[],refs:[]};}
function persist(){if(!s.draft)return;try{sessionStorage.setItem(key(),JSON.stringify(s.draft));}catch{}}
function readDraft(){try{s.draft=JSON.parse(sessionStorage.getItem(key())||'null')||empty();}catch{s.draft=empty();}}
function count(room){return s.counts.find(function(c){return c.room===room;})||{unread:0,attention:0};}
async function overview(){if(typeof CU==='undefined'||!CU)return;try{
 var d=await api('');if(s.actor&&s.actor!==d.actor){s.messages=[];s.draft=null;}s.actor=d.actor;s.employees=d.employees;s.counts=d.counts||[];
 var total=s.counts.reduce(function(n,c){return n+Number(c.unread);},0),attention=s.counts.reduce(function(n,c){return n+Number(c.attention);},0),badge=document.getElementById('scBadge');if(badge){badge.textContent=total||'';badge.style.display=total?'inline-flex':'none';}
 document.querySelectorAll('[data-staff-chat-home]').forEach(function(el){el.innerHTML='<strong>직원 채팅</strong><button data-sc-home>새 메시지 <span class="sc-count">'+total+'</span></button><span class="sc-muted">개인 메시지·직접 언급 '+attention+'건</span>';el.querySelector('button').onclick=function(){window._staffChatOpen('all');};});
 if(host())renderRooms();
 }catch(e){if(active())error(e);}}
function renderRooms(){var box=document.getElementById('scRooms');if(!box)return;
 box.innerHTML='<strong>직원 채팅</strong>'+['all'].concat(s.employees.filter(function(e){return e.id!==s.actor;}).map(function(e){return dm(e.id);})).map(function(r){var c=count(r);return '<button data-room="'+esc(r)+'" aria-pressed="'+(s.room===r)+'">'+esc(roomName(r))+(c.unread?'<span class="sc-count">'+c.unread+'</span>':'')+'</button>';}).join('')+'<p class="sc-push-help">급한 일은 전화하고, 결정한 내용은 관련 업무에 짧게 기록해주세요.</p>';
 box.querySelectorAll('[data-room]').forEach(function(b){b.onclick=function(){if(s.busy)return;persist();s.room=b.dataset.room;s.q='';s.target='';s.messages=[];s.version++;readDraft();shell();load(true);};});}
function fileHtml(files){return '<div class="sc-files">'+(files||[]).map(function(f){var url='/api/staff/chat/files?id='+encodeURIComponent(f.id);return '<a href="'+url+'" target="_blank" rel="noopener">'+(String(f.mime).startsWith('image/')?'<img loading="lazy" src="'+url+'" alt="'+esc(f.name)+'">':'📎 ')+esc(f.name)+'</a>';}).join('')+'</div>';}
function taskUrl(id){return '/admin/view?src='+encodeURIComponent('/staff?page=board&task='+encodeURIComponent(id));}
function refsHtml(refs){return '<div class="sc-ref-cards">'+(refs||[]).map(function(r){if(r.unavailable)return '<div class="sc-ref-card sc-muted">'+esc(r.label)+'</div>';var url=r.kind==='booking'?'/admin/bookings/'+encodeURIComponent(r.id):taskUrl(r.id);return '<a class="sc-ref-card" href="'+url+'" target="_blank" rel="noopener"><strong>'+(r.kind==='booking'?'예약 · ':'업무 · ')+esc(r.label)+'</strong><small>'+esc(r.detail||'')+'</small><span>상세 보기 ↗</span></a>';}).join('')+'</div>';}
function sourcePicker(){var box=document.getElementById('scSources');box.hidden=!box.hidden;if(box.hidden)return;
 box.innerHTML='<div class="sc-link-picker"><select aria-label="가져올 정보 종류" id="scSourceKind"><option value="task">직원 업무</option><option value="booking">예약</option></select><input id="scSourceQuery" placeholder="업무 제목 또는 예약자명·예약번호 (두 글자 이상)" aria-label="가져올 업무 또는 예약 검색"><button id="scSourceSearch">검색</button><div class="sc-link-results" id="scSourceResults"></div></div>';
 var search=async function(){var result=document.getElementById('scSourceResults');result.textContent='검색 중…';try{var d=await api('?lookup='+document.getElementById('scSourceKind').value+'&q='+encodeURIComponent(document.getElementById('scSourceQuery').value.trim()));result.textContent=d.results.length?'':'검색 결과가 없습니다. 두 글자 이상 입력해주세요.';d.results.forEach(function(r){var b=document.createElement('button');b.textContent=r.label+' · '+r.detail;b.onclick=function(){s.draft.refs=s.draft.refs||[];if(s.draft.refs.length>=5){error('업무·예약은 최대 5개까지 가져올 수 있습니다.');return;}if(!s.draft.refs.some(function(x){return x.kind===r.kind&&x.id===r.id;}))s.draft.refs.push(r);persist();draftUI();box.hidden=true;};result.appendChild(b);});}catch(e){result.textContent=e.message;}};
 document.getElementById('scSourceSearch').onclick=search;document.getElementById('scSourceQuery').onkeydown=function(e){if(e.key==='Enter')search();};
}
function shell(){var page=document.getElementById('page-chat');if(!page)return;
 page.innerHTML='<div class="sc" id="scRoot"><aside class="sc-side" id="scRooms"></aside><section class="sc-main"><header class="sc-head"><strong>'+esc(roomName(s.room))+'</strong><input id="scSearch" aria-label="대화 검색" placeholder="이 대화에서 검색" value="'+esc(s.q)+'"><button id="scSearchBtn">검색</button><button id="scSearchClear">최신 대화</button><button id="scPush">알림 설정</button></header><div class="sc-note">업무의 질문·진행·결과는 해당 업무에서 이어가세요. 후속 처리가 필요하면 메시지를 업무에 연결할 수 있습니다.</div><div class="sc-list" id="scList" aria-label="대화 메시지"></div><button class="sc-new" id="scNew" hidden>새 메시지 보기 ↓</button><div class="sc-compose"><div id="scReply"></div><div id="scDraftRefs"></div><div id="scSources" hidden></div><div class="sc-draft-files" id="scDraftFiles"></div><textarea id="scText" aria-label="메시지" placeholder="메시지 입력 · Enter 전송 / Shift+Enter 줄바꿈"></textarea><div id="scMentions" class="sc-mention-tags"></div><div class="sc-compose-footer"><label><button type="button" id="scAttach">사진·파일</button><input type="file" id="scFiles" hidden multiple accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"></label><button type="button" id="scSource">업무·예약 가져오기</button><select id="scMention" aria-label="직원 언급"><option value="">@ 직원 언급</option></select><span class="sc-muted">최대 10개 · 파일당 3MB</span><button class="sc-send" id="scSend">전송</button></div><div class="sc-error" id="scError" role="status"></div><div class="sc-muted" id="scPushInfo"></div></div></section></div>';
 document.getElementById('scSource').onclick=sourcePicker;renderRooms();document.getElementById('scText').value=s.draft.text;draftUI();
 var mention=document.getElementById('scMention');s.employees.filter(function(e){return e.id!==s.actor&&(s.room==='all'||s.room===dm(e.id));}).forEach(function(e){var o=document.createElement('option');o.value=e.id;o.textContent=e.name;mention.appendChild(o);});
 mention.onchange=function(){if(mention.value){if(s.draft.mentions.indexOf(mention.value)<0)s.draft.mentions.push(mention.value);var t=document.getElementById('scText');t.value+=(t.value?' ':'')+'@'+name(mention.value)+' ';s.draft.text=t.value;persist();draftUI();mention.value='';t.focus();}};
 document.getElementById('scText').oninput=function(e){s.draft.text=e.target.value;persist();};
 document.getElementById('scText').onkeydown=function(e){if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();send();}};
 document.getElementById('scSend').onclick=send;document.getElementById('scAttach').onclick=function(){document.getElementById('scFiles').click();};document.getElementById('scFiles').onchange=upload;
 document.getElementById('scSearchBtn').onclick=function(){s.q=document.getElementById('scSearch').value.trim();s.messages=[];load(true);};
 document.getElementById('scSearch').onkeydown=function(e){if(e.key==='Enter')document.getElementById('scSearchBtn').click();};
 document.getElementById('scSearchClear').onclick=function(){s.q='';s.target='';s.messages=[];document.getElementById('scSearch').value='';load(true);};
 document.getElementById('scNew').onclick=function(){var l=document.getElementById('scList');l.scrollTop=l.scrollHeight;markVisible();this.hidden=true;};
 document.getElementById('scPush').onclick=pushSetup;document.getElementById('scList').onscroll=function(){markVisible();};
}
function draftUI(){var refs=document.getElementById('scDraftRefs');if(refs){refs.innerHTML=(s.draft.refs||[]).map(function(r,i){return '<button data-remove-ref="'+i+'">'+esc(r.label)+' ×</button>';}).join('');refs.querySelectorAll('button').forEach(function(b){b.onclick=function(){s.draft.refs.splice(Number(b.dataset.removeRef),1);persist();draftUI();};});}var r=document.getElementById('scReply'),f=document.getElementById('scDraftFiles');if(!r)return;
 r.innerHTML=s.draft.reply?'<div class="sc-reply">답장: '+esc(s.draft.reply.body.slice(0,100)||'첨부 메시지')+' <button id="scCancelReply">취소</button></div>':'';
 if(s.draft.reply)document.getElementById('scCancelReply').onclick=function(){s.draft.reply=null;persist();draftUI();};
 f.innerHTML=s.draft.files.map(function(x,i){return '<button data-remove="'+i+'">'+esc(x.name)+' ×</button>';}).join('');f.querySelectorAll('button').forEach(function(b){b.onclick=function(){s.draft.files.splice(Number(b.dataset.remove),1);persist();draftUI();};});
 document.getElementById('scMentions').innerHTML=s.draft.mentions.map(function(id){return '<button data-unmention="'+esc(id)+'">@'+esc(name(id))+' ×</button>';}).join('');document.querySelectorAll('[data-unmention]').forEach(function(b){b.onclick=function(){s.draft.mentions=s.draft.mentions.filter(function(id){return id!==b.dataset.unmention;});persist();draftUI();};});}
function setBusy(b){s.busy=b;var compose=host()&&host().querySelector('.sc-compose');if(compose)compose.querySelectorAll('button,input,textarea,select').forEach(function(e){e.disabled=b;});}
async function upload(e){var files=Array.from(e.target.files||[]);if(s.draft.files.length+files.length>10){error('첨부는 최대 10개입니다.');return;}setBusy(true);try{for(var f of files){if(window._staffOptimizeUploadFile)f=await _staffOptimizeUploadFile(f);if(f.size>3*1024*1024)throw Error(f.name+': 3MB 이하 파일을 선택해주세요.');var form=new FormData();form.set('room',s.room);form.set('file',f);var r=await fetch('/api/staff/chat/files',{method:'POST',body:form,credentials:'same-origin'}),d=await r.json();if(!r.ok)throw Error(d.error);s.draft.files.push(d.file);persist();}draftUI();error('');}catch(err){error(err);draftUI();}finally{e.target.value='';setBusy(false);}}
async function send(){if(s.busy||!s.draft||(!s.draft.text.trim()&&!s.draft.files.length&&!(s.draft.refs||[]).length))return;setBusy(true);error('');try{
 var d=await api('',{id:s.draft.id,room:s.room,text:s.draft.text,files:s.draft.files.map(function(f){return f.id;}),reply:s.draft.reply&&s.draft.reply.id,mentions:s.draft.mentions,refs:(s.draft.refs||[]).map(function(r){return {kind:r.kind,id:r.id};})});
 s.draft=empty();persist();document.getElementById('scText').value='';draftUI();s.q='';s.target='';s.messages=[];await load(true);overview();
 if(d.push==='failed'||d.push==='unavailable')error('메시지는 저장됐습니다. 기기 알림은 전달되지 않을 수 있습니다.');
 }catch(e){error(e);}finally{setBusy(false);}}
async function load(reset,before){if(s.loading)return;s.loading=true;var v=s.version,r=s.room;try{
 var query='?room='+encodeURIComponent(r)+(s.q?'&q='+encodeURIComponent(s.q):'')+(before?'&before='+before:'')+(s.target?'&message='+s.target:'');var d=await api(query);if(v!==s.version||r!==s.room)return;
 var list=document.getElementById('scList');if(!list)return;var bottom=list.scrollHeight-list.scrollTop-list.clientHeight<90,oldHeight=list.scrollHeight,oldTop=list.scrollTop;
 var combined=reset?d.messages:s.messages.concat(d.messages),map=new Map();combined.forEach(function(m){map.set(m.id,m);});s.messages=Array.from(map.values()).sort(function(a,b){return a.seq-b.seq;});s.reads=d.reads;s.links=d.links;s.replies=d.replies;s.more=d.more;
 renderMessages();if(before)list.scrollTop=list.scrollHeight-oldHeight+oldTop;else if(reset||bottom)list.scrollTop=list.scrollHeight;else{list.scrollTop=oldTop;document.getElementById('scNew').hidden=false;}
 if(s.target){var target=document.getElementById('scMsg-'+s.target);if(target)target.scrollIntoView({block:'center'});}
 markVisible();
 }catch(e){error(e);}finally{s.loading=false;}}
var readBusy=false,lastRead={};async function markVisible(){if(!active()||s.q||s.target||readBusy)return;var l=document.getElementById('scList');if(!l||!s.messages.length)return;var box=l.getBoundingClientRect(),seq=0;l.querySelectorAll('[data-seq]').forEach(function(e){var r=e.getBoundingClientRect();if(r.top<box.bottom&&r.bottom>box.top)seq=Math.max(seq,Number(e.dataset.seq));});if(!seq||seq<=(lastRead[s.room]||0))return;readBusy=true;var room=s.room;try{await api('',{action:'read',room:room,seq:seq});lastRead[room]=seq;overview();}catch(e){error(e);}finally{readBusy=false;}}
function renderMessages(){var l=document.getElementById('scList');if(!l)return;
 l.innerHTML=(s.more?'<button id="scOlder">이전 메시지 더 보기</button>':'')+(s.messages.length?'':'<p class="sc-muted">'+(s.q?'검색 결과가 없습니다.':'아직 메시지가 없습니다.')+'</p>')+s.messages.map(function(m){
 var members=s.room==='all'?s.employees.map(function(e){return e.id;}):s.room.split(':').slice(1),unread=members.filter(function(id){return id!==m.sender&&!s.reads.some(function(r){return r.employee===id&&Number(r.seq)>=m.seq;});});
 var reply=s.replies.find(function(r){return r.id===m.reply_to;}),links=s.links.filter(function(r){return r.message_id===m.id;});
 return '<article class="sc-message '+(m.sender===s.actor?'mine ':'')+(s.target===m.id?'target':'')+'" id="scMsg-'+m.id+'" data-seq="'+m.seq+'"><div class="sc-meta"><strong>'+esc(name(m.sender))+'</strong><time>'+esc(new Date(m.created_at).toLocaleString('ko-KR'))+'</time><span title="'+esc(unread.map(name).join(', '))+'">'+(unread.length?'안 읽음 '+unread.length:'모두 읽음')+'</span></div>'+(reply?'<button class="sc-reply" data-reply-jump="'+reply.id+'">↳ '+esc(name(reply.sender))+': '+esc(reply.body.slice(0,140)||'첨부 메시지')+'</button>':'')+'<div class="sc-body">'+esc(m.body)+'</div>'+fileHtml(m.files)+refsHtml(m.refs)+(m.mentions.length?'<div class="sc-mention-tags">'+m.mentions.map(function(id){return '@'+esc(name(id));}).join(' ')+'</div>':'')+'<div class="sc-actions"><button data-reply="'+m.id+'">답장</button><button data-link="'+m.id+'">기존 업무에 연결</button><button data-new-task="'+m.id+'">새 업무로 등록</button>'+links.map(function(t){return '<a class="sc-task-link" href="'+taskUrl(t.task_id)+'" target="_blank" rel="noopener" title="업무를 새 탭에서 열기">↗ '+esc(t.title)+'</a>';}).join('')+'</div><div data-picker="'+m.id+'"></div></article>';}).join('');
 if(s.more)document.getElementById('scOlder').onclick=function(){load(false,s.messages[0].seq);};
 l.querySelectorAll('[data-reply]').forEach(function(b){b.onclick=function(){s.draft.reply=s.messages.find(function(m){return m.id===b.dataset.reply;});persist();draftUI();document.getElementById('scText').focus();};});
 l.querySelectorAll('[data-reply-jump]').forEach(function(b){b.onclick=function(){s.target=b.dataset.replyJump;s.messages=[];load(true);};});
 l.querySelectorAll('[data-link]').forEach(function(b){b.onclick=function(){linkPicker(b.dataset.link);};});
 l.querySelectorAll('[data-new-task]').forEach(function(b){b.onclick=function(){newTask(b.dataset.newTask);};});

}
function linkPicker(id){var box=host().querySelector('[data-picker="'+id+'"]');box.innerHTML='<div class="sc-link-picker"><p class="sc-muted">선택한 메시지와 첨부가 해당 업무를 볼 수 있는 직원에게 공유됩니다. 나머지 개인 대화는 공유되지 않습니다.</p><input aria-label="연결할 업무 검색" placeholder="업무 제목·담당자 검색"><div class="sc-link-results"></div><button data-cancel>닫기</button></div>';var inp=box.querySelector('input'),results=box.querySelector('.sc-link-results');
 function draw(){var q=inp.value.trim().toLowerCase();results.innerHTML='';tasks.filter(function(t){return taskVisible(t)&&!_isArchivedTask(t.id)&&(t.title+' '+[t.assignee].concat(t.assignees||[]).map(name).join(' ')).toLowerCase().includes(q);}).slice(0,20).forEach(function(t){var b=document.createElement('button');b.textContent=t.title+(isDoneTask(t)?' · 완료':'');b.onclick=async function(){b.disabled=true;try{await api('',{action:'link',message:id,task:t.id});box.textContent='업무에 연결했습니다.';load(false);}catch(e){box.appendChild(document.createTextNode(e.message));b.disabled=false;}};results.appendChild(b);});}
 inp.oninput=draw;box.querySelector('[data-cancel]').onclick=function(){box.textContent='';};draw();inp.focus();}
function newTask(id){var m=s.messages.find(function(m){return m.id===id;});if(!m)return;
 if(!confirm('선택한 메시지와 첨부를 새 업무의 관계자에게 공유합니다. 업무 제목·담당자를 확인한 뒤 저장해주세요.'))return;
 openTaskModal();pendingTask={id:id};var title=document.getElementById('tmTit');if(title)title.value=m.body.split('\n')[0].slice(0,100)||'채팅 후속 업무';
 var note=document.getElementById('tmNt');if(note){var p=document.createElement('p');p.textContent='채팅에서 요청한 후속 업무입니다. 저장하면 원문과 첨부가 아래에 연결됩니다.';note.appendChild(p);}if(typeof _staffTaskFormSummary==='function')_staffTaskFormSummary();
}
window._staffChatBeforeTaskSaved=async function(task){if(pendingTask){await api('',{action:'link',message:pendingTask.id,task:task.id});pendingTask=null;}};
window._staffChatCancelTask=function(){pendingTask=null;};
window._staffChatTaskContext=async function(root,t){try{var d=await api('?task='+encodeURIComponent(t.id));if(!root.isConnected||!d.messages.length)return;var section=document.createElement('section');section.className='sc-task-context';section.innerHTML='<h3>연결된 채팅</h3><p class="sc-muted">선택한 메시지·첨부입니다. 진행·결과는 이 업무의 댓글에 남겨주세요.</p>'+d.messages.map(function(m){var e=d.employees.find(function(e){return e.id===m.sender;});return '<article class="sc-message"><div class="sc-meta"><strong>'+esc(e?e.name:m.sender)+'</strong>'+esc(new Date(m.created_at).toLocaleString('ko-KR'))+'</div><div class="sc-body">'+esc(m.body)+'</div>'+fileHtml(m.files)+refsHtml(m.refs)+(m.canOpen?'<button data-origin-room="'+esc(m.room)+'" data-origin-message="'+m.id+'">원래 대화 보기</button>':'<p class="sc-muted">전체 대화는 대화 참가자만 볼 수 있습니다.</p>')+'</article>';}).join('');root.appendChild(section);section.querySelectorAll('[data-origin-room]').forEach(function(b){b.onclick=function(){window._staffChatOpen(b.dataset.originRoom,b.dataset.originMessage);};});}catch(e){if(root.isConnected){var p=document.createElement('p');p.className='sc-error';p.textContent='연결된 채팅을 불러오지 못했습니다. '+e.message;root.appendChild(p);}}};
async function pushSetup(){var el=document.getElementById('scPushInfo');try{
 if(!('serviceWorker' in navigator)||!('PushManager' in window))throw Error('이 브라우저는 웹 알림을 지원하지 않습니다. iPhone·iPad에서는 홈 화면에 추가한 앱으로 열어주세요.');
 var permission=await Notification.requestPermission();if(permission!=='granted')throw Error('브라우저 설정에서 알림을 허용해주세요.');
 var r=await fetch('/api/staff/chat/push'),d=await r.json();if(!r.ok||!d.available)throw Error(d.error||'알림 서버 설정을 확인해야 합니다.');
 var registration=await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;
 var sub=await registration.pushManager.getSubscription();if(sub&&confirm('이 기기의 직원 채팅 알림을 끄시겠습니까? (취소: 알림 켜기)')){await fetch('/api/staff/chat/push',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint})});el.textContent='이 기기의 직원 채팅 알림을 껐습니다.';return;}
 var raw=atob(d.publicKey.replace(/-/g,'+').replace(/_/g,'/')),key=new Uint8Array(raw.length);for(var i=0;i<raw.length;i++)key[i]=raw.charCodeAt(i);
 if(!sub)sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});var save=await fetch('/api/staff/chat/push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sub.toJSON())});if(!save.ok)throw Error((await save.json()).error);
 el.textContent='개인 메시지·직접 언급 알림을 켰습니다. 화면 밖에서도 알림을 받을 수 있으며, 기기 절전·집중 모드·브라우저 설정에 따라 제한될 수 있습니다.';
 }catch(e){el.textContent=e.message;}}
window._staffChatRefresh=overview;
window._staffChatOpen=function(room,message){persist();s.room=room||'all';s.target=message||'';s.q='';s.messages=[];s.version++;showPage('chat');};
var initial=true;
window._staffChatRender=async function(){await overview();if(!s.actor)return;if(initial){var p=new URLSearchParams(location.search);if(p.get('page')==='chat'){s.room=p.get('room')||s.room;s.target=p.get('message')||s.target;}initial=false;}if(!s.employees.some(function(e){return s.room==='all'||s.room===dm(e.id);}))s.room='all';readDraft();shell();load(true);};
setInterval(function(){if(active()&&!s.q&&!s.target&&!host()?.querySelector('.sc-link-picker'))load(false);},3000);
setInterval(overview,12000);document.addEventListener('visibilitychange',function(){if(!document.hidden){overview();if(active())load(false);}});
window.addEventListener('load',function(){setTimeout(overview,2500);});
})();
