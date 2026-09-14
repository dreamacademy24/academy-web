/* Compact application inbox. The task's saved completion state is the unread source of truth. */
var _classApplicationData=null,_classApplicationLoading=false;
async function _loadClassApplications(){
 if(_classApplicationLoading||typeof CU==='undefined'||!CU)return;_classApplicationLoading=true;
 try{var r=await fetch('/api/staff/class-applications',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error('신규 신청을 불러오지 못했습니다.');_classApplicationData=await r.json();_renderClassApplications();}
 catch(e){document.querySelectorAll('[data-class-applications]').forEach(function(el){if(!_classApplicationData)el.innerHTML='<p>신규 신청을 불러오지 못했습니다. <button type="button" onclick="_loadClassApplications()">다시 확인</button></p>';});}
 finally{_classApplicationLoading=false;}
}
function _renderClassApplications(){
 if(!_classApplicationData)return;
 document.querySelectorAll('[data-class-applications]').forEach(function(el){
  var emp=el.dataset.employee,items=_classApplicationData.items.filter(function(t){return !emp||t.assignee===emp||(t.assignees||[]).indexOf(emp)>=0||!t.assignee;});
  var tutor=items.filter(function(t){return t.application_source.kind==='tutor';}).length,online=items.length-tutor;
  el.innerHTML='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><b>새 수업 신청</b><span style="color:#c62828;font-weight:700">튜터 '+tutor+' · 화상영어 '+online+'</span><button class="tm-btn" type="button" data-class-refresh style="margin-left:auto">새로고침</button></div>'+(items.length?items.map(function(t){var src=t.application_source,ids=t.assignees||[],names=ids.map(function(id){var p=typeof ALL!=="undefined"&&ALL.find(function(x){return x.id===id;});return p?p.name:id;}).join(', ');return '<div style="display:flex;align-items:center;gap:10px;border-top:1px solid #edf0f5;padding:10px 0;flex-wrap:wrap"><button type="button" class="swh-link" data-class-task="'+_staffSafe(t.id)+'">'+_staffSafe(t.title)+'</button><small style="color:#64748b">'+_staffSafe(names||'담당 미지정')+'</small><a href="'+_staffSafe(src.url)+'" target="_top" style="margin-left:auto">신청 보기 →</a></div>';}).join(''):'<p style="font-size:13px;color:#64748b;margin:8px 0 0">확인할 신규 신청이 없습니다.</p>');
  el.onclick=function(event){var b=event.target.closest('button');if(!b)return;if(b.hasAttribute('data-class-refresh')){_loadClassApplications();return;}var id=b.dataset.classTask;if(!id)return;var raw=_classApplicationData.items.find(function(t){return t.id===id;});if(!raw)return;if(!tasks.some(function(t){return t.id===id;}))tasks.push(rowToTask(raw));_homeGotoBoardTask(id);};
 });
}
function _classApplicationsMount(){_renderClassApplications();void _loadClassApplications();}
window.addEventListener('focus',_loadClassApplications);
document.addEventListener('visibilitychange',function(){if(!document.hidden)_loadClassApplications();});
setInterval(function(){if(!document.hidden)_loadClassApplications();},30000);
