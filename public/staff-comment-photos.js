/* Comment drafts keep uploaded photos through task refreshes; original device files are untouched. */
var _staffCommentDrafts={};
function _staffCommentDraft(taskId){var key=String(CU&&CU.id)+':'+String(taskId);return _staffCommentDrafts[key]||(_staffCommentDrafts[key]={id:crypto.randomUUID(),files:[],busy:false,text:''});}
function _staffCommentPhotoPicker(host,taskId,draft){
  if(!host)return;
  host.innerHTML='<div class="swt-photo-drafts"></div><label class="swt-photo-add">＋ 사진 첨부<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden></label><p class="swt-help">최대 30장 · 파일당 50MB · 큰 사진은 보기 좋은 크기로 줄여서 올립니다. 사진만 등록해도 됩니다.</p><label class="swt-help"><input type="checkbox" data-keep-original> 원본 그대로 업로드</label><div role="status" class="swt-photo-status"></div>';
  var list=host.querySelector('.swt-photo-drafts'),input=host.querySelector('input'),message=host.querySelector('[role="status"]');
  function render(){list.innerHTML=draft.files.map(function(f,i){return '<figure><img src="'+_staffSafe(_staffMediaUrl(f.url))+'" alt="'+_staffSafe(f.name)+'"><figcaption>'+_staffSafe(f.name)+'</figcaption><button type="button" data-remove-photo="'+i+'" aria-label="'+_staffSafe(f.name)+' 첨부 제거">제거 ×</button></figure>';}).join('');input.disabled=draft.busy;}
  list.addEventListener('click',function(e){var button=e.target.closest('[data-remove-photo]');if(!button||draft.busy)return;draft.files.splice(Number(button.dataset.removePhoto),1);render();});
  async function upload(files){if(draft.busy)return;if(files.length+draft.files.length>30){message.textContent='댓글에는 사진을 30장까지 첨부할 수 있습니다.';return;}draft.busy=true;render();var base=draft.files.slice(),results=[],failed=[],reasons=[],keep=host.querySelector('[data-keep-original]').checked,progress=files.map(function(){return 0;});
    try{await _staffUploadBatch(files,async function(original,i){try{
      if(!/^image\/(jpeg|png|webp|gif)$/.test(original.type))throw Error('JPG·PNG·WebP·GIF 사진을 선택해주세요.');
      if(original.size>50*1024*1024)throw Error('사진 한 장은 최대 50MB입니다.');
      var file=keep?original:await _staffOptimizeUploadFile(original);
      results[i]=await _staffDirectUpload(file,'comment',String(taskId),function(p){progress[i]=p;message.textContent=results.filter(Boolean).length+' / '+files.length+'장 완료 · '+Math.round(progress.reduce(function(a,b){return a+b;},0)/files.length)+'%';});draft.files=base.concat(results.filter(Boolean));render();
    }catch(e){failed[i]=original;reasons[i]=e.message;if(e.status===401)_staffCommentAuthPrompt(host,taskId);}});
    }finally{draft.busy=false;render();}
    failed=failed.filter(Boolean);message.textContent=draft.files.length+'장 첨부됨 · 보고 등록 또는 저장을 눌러 마무리해주세요.'+(failed.length?' 실패 '+failed.length+'장: '+reasons.filter(Boolean)[0]:'');
    if(failed.length){var retry=document.createElement('button');retry.type='button';retry.textContent='실패한 사진 다시 시도';retry.onclick=function(){upload(failed);};message.appendChild(retry);}
  }
  input.addEventListener('change',function(){var files=Array.from(input.files||[]);input.value='';upload(files);
  });render();
}
window.addEventListener('beforeunload',function(e){if(Object.values(_staffCommentDrafts).some(function(d){return d.busy||d.files.length||d.text;})){e.preventDefault();e.returnValue='';}});
