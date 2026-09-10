/* One attachment viewer for tasks, approvals, notices and discussions. */
var _staffMediaBusy=false,_staffMediaDraft=0,_staffMediaFailures=[],_staffGalleryState=null;
function _staffMediaUrl(raw){
  var s=String(raw||'').trim();
  if(!s)return '';
  if(/^data:image\/(?:png|jpeg|gif|webp|bmp);base64,/i.test(s)||/^blob:/i.test(s))return s;
  if(/^data:(?:application\/(?:pdf|zip|x-zip-compressed|octet-stream|msword|vnd\.[\w.+-]+)|text\/plain);base64,/i.test(s))return s;
  try{var u=new URL(s,location.href);return /^https?:$/.test(u.protocol)?u.href:'';}catch(e){return '';}
}
function _staffAttachmentHtml(files){
  if(!Array.isArray(files)||!files.length)return '';
  return '<div class="swm-attachments">'+files.map(function(f){var src=_staffMediaUrl(f.url||f.data),kind=fileKind(f),name=_staffSafe(f.name||'첨부파일'),size=fmtFileSize(f.size);if(!src)return '<div class="swm-file">'+name+'<span>파일 링크를 확인할 수 없습니다.</span></div>';
    if(kind==='image')return '<figure class="swm-photo"><button type="button" data-staff-photo="'+_staffSafe(src)+'" data-name="'+name+'" aria-label="'+name+' 확대"><img src="'+_staffSafe(src)+'" alt="'+name+'" loading="lazy" decoding="async"></button><figcaption><span>'+name+'</span><small>'+_staffSafe(size)+'</small><a href="'+_staffSafe(src)+'" target="_blank" rel="noopener" download="'+name+'">다운로드</a></figcaption></figure>';
    if(kind==='video')return '<figure class="swm-file"><video controls preload="metadata" src="'+_staffSafe(src)+'"></video><figcaption>'+name+'</figcaption></figure>';
    if(/^audio\//.test(f.type||''))return '<figure class="swm-file"><audio controls preload="metadata" src="'+_staffSafe(src)+'"></audio><figcaption>'+name+'</figcaption></figure>';
    return '<a class="swm-file" href="'+_staffSafe(src)+'" target="_blank" rel="noopener" download="'+name+'"><strong>'+name+'</strong><span>'+_staffSafe(size)+(/\.zip$/i.test(f.name||'')?' · ZIP 내려받기':' · 파일 열기')+'</span></a>';
  }).join('')+'</div>';
}
function _staffOpenGallery(items,index){
  if(!items.length)return;var existing=document.getElementById('staffGallery');if(existing)existing.remove();
  var prior=document.activeElement,dialog=document.createElement('dialog');dialog.id='staffGallery';dialog.className='swm-lightbox';dialog.setAttribute('aria-label','사진 확대 보기');
  dialog.innerHTML='<header><div><strong id="swmTitle"></strong><span id="swmCount"></span></div><button type="button" data-action="zoom">원본 크기</button><a id="swmDownload" target="_blank" rel="noopener">다운로드</a><button type="button" data-action="close" aria-label="사진 보기 닫기">닫기 ×</button></header><div class="swm-stage"><img id="swmImage" alt=""></div><footer><button type="button" data-action="prev">← 이전 사진</button><span>방향키로 이동 · Esc 닫기</span><button type="button" data-action="next">다음 사진 →</button></footer>';
  document.body.appendChild(dialog);var current=index,zoom=false;
  function render(){var item=items[current];dialog.querySelector('#swmImage').src=item.src;dialog.querySelector('#swmImage').alt=item.name;dialog.querySelector('#swmTitle').textContent=item.name;dialog.querySelector('#swmCount').textContent=(current+1)+' / '+items.length;var link=dialog.querySelector('#swmDownload');link.href=item.src;link.download=item.name;dialog.querySelector('[data-action="prev"]').disabled=current===0;dialog.querySelector('[data-action="next"]').disabled=current===items.length-1;zoom=false;dialog.classList.remove('is-zoom');dialog.querySelector('[data-action="zoom"]').textContent='원본 크기';}
  function close(){dialog.close();}
  dialog.addEventListener('click',function(e){var action=e.target.dataset.action;if(action==='close')close();if(action==='prev'&&current>0){current--;render();}if(action==='next'&&current<items.length-1){current++;render();}if(action==='zoom'){zoom=!zoom;dialog.classList.toggle('is-zoom',zoom);e.target.textContent=zoom?'화면에 맞춤':'원본 크기';}});
  dialog.addEventListener('keydown',function(e){if(e.key==='ArrowLeft'&&current>0){e.preventDefault();current--;render();}if(e.key==='ArrowRight'&&current<items.length-1){e.preventDefault();current++;render();}});
  dialog.addEventListener('close',function(){dialog.remove();if(prior&&prior.isConnected)prior.focus();});render();dialog.showModal();
}
async function _staffOptimizeUploadFile(file){
  // Do not flatten animated files, SVG, HEIC, PDFs or small screenshots.
  if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size<1024*1024)return file;
  var bitmap;
  try{
    bitmap=await createImageBitmap(file);var scale=Math.min(1,2560/Math.max(bitmap.width,bitmap.height));
    var canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    var blob=await new Promise(function(resolve){canvas.toBlob(resolve,'image/webp',.9);});
    if(!blob||blob.type!=='image/webp'||blob.size>=file.size*.9)return file;
    var name=file.name.replace(/\.[^.]+$/,'')+'.webp';return new File([blob],name,{type:blob.type,lastModified:file.lastModified});
  }catch(e){return file;}finally{if(bitmap)bitmap.close();}
}
function _staffMediaFormHint(){
  var host=document.getElementById('tmFL');if(!host)return;
  if(!document.getElementById('staffMediaHint')){var hint=document.createElement('div');hint.id='staffMediaHint';hint.className='swm-hint';hint.innerHTML='<p>여러 사진을 선택하면 순서대로 업로드합니다. 큰 JPG·PNG·WebP는 보기 좋은 크기로 최적화하며, 원본 파일은 내 기기에 남아 있습니다.</p><label><input type="checkbox" id="staffMediaKeepOriginal"> 이번에는 원본 파일 그대로 업로드</label><div id="staffMediaStatus" role="status"></div>';host.before(hint);}
}
async function _staffTaskUpload(event,retry){
  if(_staffMediaBusy||_staffTaskSaving)return;
  _staffMediaFormHint();var files=retry?_staffMediaFailures.slice():Array.from(event.target.files||[]);
  files=files.filter(_validateFile);var room=Math.max(0,MAX_FILES-mFiles.length);if(files.length>room){toast('한 업무에는 '+MAX_FILES+'개까지 첨부할 수 있습니다.','#ef4444');files=files.slice(0,room);}if(!files.length)return;
  _staffMediaBusy=true;_staffMediaFailures=[];var draft=_staffMediaDraft,host=document.getElementById('staffMediaStatus'),keep=document.getElementById('staffMediaKeepOriginal').checked,success=0;
  try{for(var i=0;i<files.length;i++){
    if(draft!==_staffMediaDraft)break;
    if(host)host.textContent=(i+1)+' / '+files.length+' 업로드 중 · '+files[i].name;
    try{var file=keep?files[i]:await _staffOptimizeUploadFile(files[i]),saved=await _taskFilesUpload([file]);if(!saved.length)throw Error();if(draft===_staffMediaDraft){mFiles.push(saved[0]);success++;renderTMFL();}}
    catch(e){if(draft===_staffMediaDraft)_staffMediaFailures.push(files[i]);}
  }}finally{_staffMediaBusy=false;if(event&&event.target)event.target.value='';}
  if(draft!==_staffMediaDraft)return;
  if(host){host.textContent=success+'개 업로드 완료'+(_staffMediaFailures.length?' · '+_staffMediaFailures.length+'개 실패':'');if(_staffMediaFailures.length){var button=document.createElement('button');button.type='button';button.className='tm-btn';button.textContent='실패한 파일만 다시 시도';button.onclick=function(){_staffTaskUpload(null,true);};host.appendChild(button);}}
}
function _staffRenderTaskUpload(){
  var host=document.getElementById('tmFL');if(!host)return;
  host.innerHTML=mFiles.map(function(f,i){var src=_staffMediaUrl(f.url||f.data);return '<div class="swm-upload-row">'+(src&&fileKind(f)==='image'?'<img src="'+_staffSafe(src)+'" alt="'+_staffSafe(f.name)+'">':'<span>파일</span>')+'<div><strong>'+_staffSafe(f.name)+'</strong><small>'+_staffSafe(fmtFileSize(f.size))+'</small></div><button type="button" onclick="rmMF('+i+')" aria-label="'+_staffSafe(f.name)+' 첨부 제거">제거</button></div>';}).join('');
}
document.addEventListener('click',function(e){var button=e.target.closest('[data-staff-photo]');if(!button)return;e.preventDefault();e.stopPropagation();var group=button.closest('.swm-attachments'),buttons=Array.from(group.querySelectorAll('[data-staff-photo]'));_staffOpenGallery(buttons.map(function(b){return {src:b.dataset.staffPhoto,name:b.dataset.name};}),buttons.indexOf(button));},true);
