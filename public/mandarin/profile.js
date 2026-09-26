(()=>{
const picker=document.getElementById('profilePicker');
function choose(id){if(!['jia','jiwoo'].includes(id))return;activeProfile=id;const name=id==='jia'?'Jia':'Jiwoo';stars=new Set();try{const list=JSON.parse(localStorage.getItem('little-mandarin-stars-v1-'+id)||'[]');if(Array.isArray(list))stars=new Set(list.filter(x=>WORDS.some(w=>w.id===x)));}catch{}
starOnly=false;chinese=false;query='';group='all';flipped.clear();document.getElementById('search').value='';document.getElementById('group').value='all';closeQuiz();render();document.getElementById('modeAvatar').src='avatar-'+id+'.png';document.getElementById('modeAvatar').alt=name+' 3D game character';document.getElementById('modeCaption').textContent=name+' mode';document.querySelector('.hero h1').textContent='Let’s learn, '+name+'!';document.getElementById('status').textContent='Hi '+name+'! Tap a picture to hear its Chinese word.';document.body.classList.remove('picking');picker.hidden=true;window.scrollTo(0,0);document.getElementById('switchProfile').focus();}
picker.addEventListener('click',e=>{const button=e.target.closest('[data-profile]');if(button)choose(button.dataset.profile);});
document.getElementById('switchProfile').onclick=()=>{stopAudio();picker.hidden=false;document.body.classList.add('picking');window.scrollTo(0,0);picker.querySelector('[data-profile="'+(activeProfile||'jia')+'"]').focus();};
})();
