(()=>{
const install=document.getElementById('installApp'),save=document.getElementById('saveOffline'),status=document.getElementById('offlineStatus'),progress=document.getElementById('offlineProgress');
let promptEvent=null,registration=null,busy=false;
function installed(){return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;}
function refresh(){install.textContent=installed()?'✓ App installed':'↓ Install app';}
refresh();
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptEvent=e;refresh();});
window.addEventListener('appinstalled',()=>{promptEvent=null;install.textContent='✓ App installed';});
install.onclick=async()=>{if(promptEvent){const e=promptEvent;promptEvent=null;try{await e.prompt();await e.userChoice;}catch{document.getElementById('installHelp').showModal();}}else document.getElementById('installHelp').showModal();};
async function worker(){if(!('serviceWorker'in navigator))throw Error('unsupported');registration=await navigator.serviceWorker.register('sw.js',{scope:'./',updateViaCache:'none'});if(registration.active)return registration.active;const pending=registration.installing||registration.waiting;if(!pending)throw Error('no worker');return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('timeout')),20000);pending.addEventListener('statechange',()=>{if(pending.state==='activated'){clearTimeout(timeout);resolve(pending);}if(pending.state==='redundant'){clearTimeout(timeout);reject(Error('failed'));}});});}
function command(w,type){return new Promise((resolve,reject)=>{const channel=new MessageChannel();const timer=setTimeout(()=>reject(Error('timeout')),120000);channel.port1.onmessage=e=>{const d=e.data;if(d.type==='progress'){progress.hidden=false;progress.value=d.percent;status.textContent='Saving for offline · '+d.percent+'%';return;}clearTimeout(timer);channel.port1.close();d.error?reject(Error(d.error)):resolve(d);};w.postMessage({type},[channel.port2]);});}
save.onclick=async()=>{if(busy)return;busy=true;save.disabled=true;status.textContent='Saving cards, voices and PDFs…';progress.hidden=false;progress.value=0;try{const w=await worker();await command(w,'DOWNLOAD_ALL');status.textContent='✓ Offline ready · 84 voices + PDFs';save.textContent='✓ Saved · check again';progress.value=100;}catch{status.textContent='Not fully saved. Connect to the internet and try again.';}finally{busy=false;save.disabled=false;}};
(async()=>{try{const w=await worker();const result=await command(w,'CHECK_OFFLINE');status.textContent=result.ready?'✓ Offline ready · 84 voices + PDFs':'Ready to install. Save all for offline listening.';}catch{status.textContent='Online mode. Use Save all for offline while connected.';}})();
})();
