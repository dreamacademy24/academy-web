/* Personal reading order. Existing task_views_* records remain the source of truth. */
function _staffTaskTime(value){
  if(typeof value==='number')return Number.isFinite(value)?value:0;
  if(!value)return 0;
  if(/^\d{12,}$/.test(String(value)))return Number(value);
  var parsed=Date.parse(value);if(Number.isFinite(parsed))return parsed;
  var m=String(value).match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(오전|오후)\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  return m?new Date(+m[1],+m[2]-1,+m[3],+m[5]%12+(m[4]==='오후'?12:0),+m[6],+(m[7]||0)).getTime():0;
}
function _staffTaskAttention(task){
  var actor=typeof CU!=='undefined'&&CU?CU.id:null;
  if(!actor||!task)return {needed:false,comments:0,at:0};
  var views=typeof _taskViews!=='undefined'?_taskViews[actor]||{}:{};
  var seen=_staffTaskTime(views[String(task.id)]),created=_staffTaskTime(task.createdAt||task.created_at);
  var incoming=(typeof taskComments!=='undefined'?taskComments[task.id]||[]:[]).filter(function(c){return (c.author||c.from_id)!==actor&&_staffTaskTime(c.ts||c.date)>seen;});
  var unread=!seen&&!isDoneTask(task)&&(task.createdBy||task.created_by)!==actor;
  return {needed:unread||incoming.length>0,unread:unread,comments:incoming.length,at:Math.max(unread?created:0,...incoming.map(function(c){return _staffTaskTime(c.ts||c.date);}))};
}
function _staffTaskCompare(a,b){
  var ad=isDoneTask(a),bd=isDoneTask(b);if(ad!==bd)return ad?1:-1;
  var x=_staffTaskAttention(a),y=_staffTaskAttention(b);
  if(x.needed!==y.needed)return x.needed?-1:1;
  if(x.needed&&x.at!==y.at)return y.at-x.at;
  var ah=a.priority==='high',bh=b.priority==='high';if(ah!==bh)return ah?-1:1;
  return String(a.due||'9999').localeCompare(String(b.due||'9999'))||_staffTaskTime(b.createdAt||b.created_at)-_staffTaskTime(a.createdAt||a.created_at)||String(a.id).localeCompare(String(b.id));
}
function _staffTaskAttentionBadge(task){
  var state=_staffTaskAttention(task);if(!state.needed)return '';
  function badge(label,title,color,bg){return '<span title="'+title+'" style="display:inline-block;background:'+bg+';color:'+color+';font-size:11px;font-weight:800;padding:3px 6px;border-radius:4px;margin-left:5px;vertical-align:middle;white-space:nowrap">'+label+'</span>';}
  return (state.unread?badge('NEW','내가 아직 열지 않은 업무','#4338ca','#eef2ff'):'')+(state.comments?badge('NEW 댓글 '+state.comments,'내가 마지막으로 확인한 이후 다른 직원이 작성한 댓글','#b91c1c','#fee2e2'):'');
}
function _staffTaskUnreadCounts(){
  var result={board:0,mywork:0};
  if(typeof CU==='undefined'||!CU)return result;
  (tasks||[]).forEach(function(t){
    if(!taskVisible(t)||isDoneTask(t)||_isArchivedTask(t.id)||!_staffTaskAttention(t).needed)return;
    var mine=t.assignee===CU.id||(t.assignees||[]).indexOf(CU.id)>=0||t.createdBy===CU.id;
    if(mine)result.mywork++;
    if(isManagerCU()||mine||t.shared||isUnassignedTask(t))result.board++;
  });
  return result;
}
