/* Comment drafts keep uploaded photos through task refreshes; original device files are untouched. */
var _staffCommentDrafts={};
function _staffCommentDraft(taskId){var key=String(CU&&CU.id)+':'+String(taskId);return _staffCommentDrafts[key]||(_staffCommentDrafts[key]={id:crypto.randomUUID(),files:[],busy:false,text:''});}
function _staffCommentPhotoPicker(host,taskId,draft){
  if(!host)return;
  host.innerHTML='<div class="swt-photo-drafts"></div><label class="swt-photo-add">＋ 사진 첨부<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden></label><p class="swt-help">최대 10장 · 큰 사진은 보기 좋은 크기로 줄여서 올립니다. 사진만 등록해도 됩니다.</p><div role="status" class="swt-photo-status"></div>';
  var list=host.querySelector('.swt-photo-drafts'),input=host.querySelector('input'),message=host.querySelector('[role="status"]');
  function render(){list.innerHTML=draft.files.map(function(f,i){return '<figure><img src="'+_staffSafe(_staffMediaUrl(f.url))+'" alt="'+_staffSafe(f.name)+'"><figcaption>'+_staffSafe(f.name)+'</figcaption><button type="button" data-remove-photo="'+i+'" aria-label="'+_staffSafe(f.name)+' 첨부 제거">제거 ×</button></figure>';}).join('');input.disabled=draft.busy;}
  list.addEventListener('click',function(e){var button=e.target.closest('[data-remove-photo]');if(!button||draft.busy)return;draft.files.splice(Number(button.dataset.removePhoto),1);render();});
  input.addEventListener('change',async function(){if(draft.busy)return;var files=Array.from(input.files||[]);input.value='';if(files.length+draft.files.length>10){message.textContent='댓글에는 사진을 10장까지 첨부할 수 있습니다.';return;}draft.busy=true;render();
    try{for(var i=0;i<files.length;i++){
      message.textContent=(i+1)+' / '+files.length+' 사진 준비 중…';
      if(!/^image\/(jpeg|png|webp|gif)$/.test(files[i].type))throw Error('JPG·PNG·WebP·GIF 사진을 선택해주세요.');
      var file=await _staffOptimizeUploadFile(files[i]);if(file.size>3*1024*1024)throw Error(file.name+': 최적화 후에도 3MB를 넘습니다. 크기를 줄여 다시 첨부해주세요.');
      var form=new FormData();form.append('taskId',String(taskId));form.append('photo',file);
      var response=await fetch('/api/staff/comments/photos',{method:'POST',credentials:'same-origin',body:form}),data=await response.json();
      if(!response.ok){var err=new Error(data.error||'사진 업로드에 실패했습니다.');err.status=response.status;throw err;}
      if(!data.photo||!data.photo.url)throw Error('사진 저장 결과를 확인하지 못했습니다.');draft.files.push(data.photo);render();
    }message.textContent=draft.files.length+'장 첨부됨 · 보고 등록 또는 저장을 눌러 마무리해주세요.';
    }catch(e){message.textContent=e.message+' 이미 첨부한 사진은 유지됩니다.';if(e.status===401)_staffCommentAuthPrompt(host,taskId);}
    finally{draft.busy=false;render();}
  });render();
}
window.addEventListener('beforeunload',function(e){if(Object.values(_staffCommentDrafts).some(function(d){return d.busy||d.files.length||d.text;})){e.preventDefault();e.returnValue='';}});
