/* Project attachments are persisted when signed upload finalization succeeds. */
window.mountProjectFiles=function(project,panel){
 var box=document.createElement('section');box.style.cssText='background:var(--surface);padding:18px;border:1px solid var(--border);border-radius:12px;margin-bottom:16px';
 box.innerHTML='<h3>프로젝트 파일·사진</h3><p>파일당 최대 50MB · 여러 파일 선택 가능 · 업로드 완료 시 자동 저장됩니다.</p><input type="file" multiple aria-label="프로젝트 파일과 사진 첨부"><div role="status" style="margin:12px 0"></div><div class="project-file-list"></div>';
 panel.prepend(box);var input=box.querySelector('input'),status=box.querySelector('[role="status"]'),list=box.querySelector('.project-file-list');
 async function refresh(){var r=await fetch('/api/staff/project-files?project='+encodeURIComponent(project),{credentials:'same-origin',cache:'no-store'}),j=await r.json();if(!r.ok)throw Error(j.error||'파일 조회 실패');list.innerHTML=j.files.length?_staffAttachmentHtml(j.files):'<p>아직 첨부한 파일이 없습니다.</p>';}
 refresh().catch(function(e){status.textContent=e.message;});
 var failures=[];
 async function upload(files){input.disabled=true;failures=[];var done=0,progress=files.map(function(){return 0;});
 function show(){status.textContent=done+' / '+files.length+'개 저장 완료 · '+Math.round(progress.reduce(function(a,b){return a+b;},0)/files.length)+'%';}
 try{await _staffUploadBatch(files,async function(file,i){try{await _staffDirectUpload(file,'project',project,function(n){progress[i]=n;show();});done++;show();}catch(e){failures.push({file:file,error:e.message});}});await refresh();status.textContent=done+'개 저장 완료';
 if(failures.length){status.appendChild(document.createTextNode(' · '+failures.map(function(f){return f.file.name+': '+f.error;}).join(' / ')));var retry=document.createElement('button');retry.textContent='실패한 파일 다시 시도';retry.type='button';retry.onclick=function(){upload(failures.map(function(f){return f.file;}));};status.appendChild(retry);}
 }catch(e){status.textContent='파일은 저장되었을 수 있습니다. 목록 새로고침이 필요합니다: '+e.message;}finally{input.disabled=false;input.value='';}}
 input.onchange=function(){var files=Array.from(input.files||[]);if(files.length)upload(files);};
};
