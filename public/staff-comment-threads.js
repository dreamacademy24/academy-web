/* Replies and explicit employee mentions share the existing task comment stream. */
function _staffThreadHtml(comments){
  var byId=new Map(comments.map(function(c,i){return [String(c.id),{c:c,i:i}];})),children=new Map(),seen=new Set();
  comments.forEach(function(c,i){var key=c.parentId&&byId.has(String(c.parentId))?String(c.parentId):'';if(!children.has(key))children.set(key,[]);children.get(key).push({c:c,i:i});});
  function render(entry,depth){if(seen.has(String(entry.c.id)))return '';seen.add(String(entry.c.id));return '<div class="swt-thread-item '+(depth?'is-reply':'')+'">'+(entry.c.parentId?'<small class="swt-reply-context">↳ '+(byId.has(String(entry.c.parentId))?'답글':'원래 댓글이 삭제된 답글')+'</small>':'')+_staffCommentHtml(entry.c,entry.i)+(children.get(String(entry.c.id))||[]).map(function(x){return render(x,depth+1);}).join('')+'</div>';}
  return (children.get('')||[]).map(function(x){return render(x,0);}).join('')+comments.map(function(c,i){return seen.has(String(c.id))?'':render({c:c,i:i},0);}).join('');
}
function _staffCommentTags(c){return (c.mentionIds||[]).map(function(id){var p=getP(id);return '<span class="swt-mention">@'+_staffSafe(p?p.name:id)+'</span>';}).join(' ');}
function _staffThreadComposer(root,t,draft,input){
  draft.mentionIds=draft.mentionIds||[];
  var box=document.createElement('div');box.className='swt-thread-composer';input.before(box);
  box.innerHTML='<div class="swt-reply-target"></div><div class="swt-mention-chips"></div><button type="button" data-tag-open>@ 직원 태그</button><div class="swt-tag-picker" hidden><label>태그할 직원 검색<input type="search" placeholder="직원 이름 검색"></label><div class="swt-tag-options"></div><button type="button" data-tag-close>닫기</button></div>';
  var picker=box.querySelector('.swt-tag-picker'),search=picker.querySelector('input'),options=box.querySelector('.swt-tag-options');
  function candidates(){return ALL.filter(function(p){return p.id!=='jun'&&(!t.secret||p.id===t.createdBy||p.id===t.assignee||(t.assignees||[]).includes(p.id));});}
  function render(){
    var target=(taskComments[t.id]||[]).find(function(c){return String(c.id)===String(draft.parentId);});
    box.querySelector('.swt-reply-target').innerHTML=draft.parentId?'<b>'+_staffSafe(target?(getP(target.author)||{}).name||target.author:'원래 댓글')+'님에게 답글 작성 중</b><button type="button" data-reply-cancel>답글 취소</button>':'';
    box.querySelector('.swt-mention-chips').innerHTML=draft.mentionIds.map(function(id){return '<button type="button" data-tag-remove="'+_staffSafe(id)+'">@'+_staffSafe((getP(id)||{}).name||id)+' ×</button>';}).join('');
    options.innerHTML=candidates().filter(function(p){return (p.name+' '+p.id).toLowerCase().includes(search.value.toLowerCase());}).map(function(p){return '<button type="button" data-tag-id="'+_staffSafe(p.id)+'">'+_staffSafe(p.name)+(draft.mentionIds.includes(p.id)?' · 선택됨':'')+'</button>';}).join('')||'<p>해당 직원이 없습니다.</p>';
  }
  box.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-tag-open')){picker.hidden=false;search.value='';render();search.focus();}
    if(b.hasAttribute('data-tag-close'))picker.hidden=true;
    if(b.hasAttribute('data-reply-cancel')){draft.parentId=null;render();}
    if(b.hasAttribute('data-tag-remove')){draft.mentionIds=draft.mentionIds.filter(function(id){return id!==b.dataset.tagRemove;});render();}
    if(b.dataset.tagId){var id=b.dataset.tagId;if(!draft.mentionIds.includes(id))draft.mentionIds.push(id);var p=getP(id);input.value=input.value.replace(/@[^\s@]*$/,'')+'@'+(p?p.name:id)+' ';draft.text=input.value;picker.hidden=true;render();input.focus();}
  });
  search.addEventListener('input',render);
  input.addEventListener('input',function(){var match=input.value.slice(0,input.selectionStart).match(/(?:^|\s)@([^\s@]*)$/);if(match){picker.hidden=false;search.value=match[1];render();}});
  root.addEventListener('click',function(e){var b=e.target.closest('[data-reply-comment]');if(!b||draft.busy)return;draft.parentId=b.dataset.replyComment;render();input.scrollIntoView({block:'center',behavior:'smooth'});input.focus();});
  render();
}
function _staffFocusTaskComment(root){
  var id=window._staffPendingComment;if(!id)return;
  var el=Array.from(root.querySelectorAll('[data-comment-id]')).find(function(e){return e.dataset.commentId===id;});
  if(el){window._staffPendingComment=null;el.classList.add('swt-comment-highlight');requestAnimationFrame(function(){el.scrollIntoView({block:'center',behavior:'smooth'});});}
}
// A comment alert does not reopen the task or put a completed task back in the to-do list.
if(typeof _staffActiveTaskNotification==='function'){
  var _staffPreviousNotificationFilter=_staffActiveTaskNotification;
  _staffActiveTaskNotification=function(n){
    if(n.type==='task_comment'&&String(n.id).startsWith('tc:')){var t=tasks.find(function(t){return String(t.id)===String(n.ref_id);});return !!t&&taskVisible(t);}
    return _staffPreviousNotificationFilter(n);
  };
}
