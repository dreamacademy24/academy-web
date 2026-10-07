(function(){
  var data=null,busy=false,error='';
  function safe(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function render(){
    document.querySelectorAll('[data-online-last-day]').forEach(function(el){
      el.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><h3 style="margin:0;font-size:17px">📞 화상영어 회차 완료 · 종료 안내'+(data?' · '+data.students.length+'명':'')+'</h3><span style="font-size:12px;color:#667085">'+safe(data?data.date:'')+'</span></div><p style="margin:8px 0 14px;color:#667085;font-size:13px">실제 회차를 모두 소진한 학생입니다. 보호자께 수업 종료 안내 연락을 드려주세요. (잔여 1~2회 제외)</p>'+(error?'<p role="alert">'+safe(error)+' <button type="button" data-last-day-retry>다시 불러오기</button></p>':!data?'<p>수업 일정 확인 중…</p>':!data.students.length?'<p style="color:#667085;margin:0">회차를 모두 소진한 학생은 없습니다.</p>':data.students.map(function(s){return '<article style="padding:13px 15px;margin-top:8px;background:#fff8ed;border:1px solid #f2d6a6;border-radius:12px"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><strong>'+safe(s.name)+(s.english_name?' <span style="font-weight:400;font-size:13px">'+safe(s.english_name)+'</span>':'')+'</strong><span style="font-size:12px;color:#9a5700;font-weight:700">수업 종료 안내 연락</span></div><div style="font-size:13px;margin-top:7px">'+safe(s.used)+' / '+safe(s.total)+'회 사용 · 잔여 0회'+' · 선생님 '+safe(s.tutor)+'</div></article>';}).join(''));
      el.onclick=function(e){if(e.target.closest('[data-last-day-retry]'))load();};
    });
  }
  async function load(){
    if(busy||!document.querySelector('[data-online-last-day]'))return;
    busy=true;
    try{var response=await fetch('/api/staff/online-last-day',{credentials:'same-origin',cache:'no-store'});var result=await response.json();if(!response.ok)throw Error(result.error||'불러오기에 실패했습니다.');data=result;error='';}catch(e){data=null;error=e.message||'일정을 불러오지 못했습니다.';}finally{busy=false;render();}
  }
  window._onlineLastDayMount=function(){render();load();};
  window.addEventListener('focus',load);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)load();});
  setInterval(function(){if(!document.hidden)load();},60000);
})();
