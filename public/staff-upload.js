/* Large files go directly to Storage; only authenticated metadata crosses the app API. */
(function(){
 window._staffUploadBatch=async function(files,worker){var next=0;await Promise.all(Array.from({length:Math.min(3,files.length)},async function(){while(next<files.length){var i=next++;await worker(files[i],i);}}));};
 async function api(body){var r=await fetch('/api/staff/uploads',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();if(!r.ok)throw Object.assign(Error(d.error||'업로드 요청에 실패했습니다.'),{status:r.status});return d;}
 function transfer(url,file,mime,progress){return new Promise(function(resolve,reject){var x=new XMLHttpRequest();x.open('PUT',url);x.timeout=300000;x.setRequestHeader('Content-Type',mime);x.setRequestHeader('x-upsert','false');x.upload.onprogress=function(e){if(progress&&e.lengthComputable)progress(Math.round(e.loaded/e.total*95));};x.onload=function(){if(x.status>=200&&x.status<300)resolve();else reject(Error('파일 전송 실패 ('+x.status+'). 다시 시도해주세요.'));};x.onerror=function(){reject(Error('연결이 끊겼습니다. 실패한 파일을 다시 시도해주세요.'));};x.ontimeout=function(){reject(Error('업로드 시간이 초과되었습니다. 연결 상태를 확인해주세요.'));};x.send(file);});}
 window._staffDirectUpload=async function(file,scope,context,progress){
  if(!file.size||file.size>50*1024*1024)throw Error(file.name+': 파일당 최대 50MB까지 첨부할 수 있습니다.');
  var head=Array.from(new Uint8Array(await file.slice(0,12).arrayBuffer())).map(function(n){return n.toString(16).padStart(2,'0');}).join('');
  var p=await api({action:'prepare',scope:scope,context:context||'',name:file.name,size:file.size,head:head});
  await transfer(p.url,file,p.mime,progress);if(progress)progress(97);
  // Retrying finalization is safe: one upload ticket always identifies the same object.
  var done;try{done=await api({action:'complete',ticket:p.ticket});}catch(e){if(e.status&&e.status<500)throw e;done=await api({action:'complete',ticket:p.ticket});}
  if(progress)progress(100);return done.file;
 };
})();
