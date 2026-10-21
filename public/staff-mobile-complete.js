/* Augments existing mobile shell without duplicating business logic or data. */
(function(){
 'use strict';
 var pending=false,mq=matchMedia('(max-width:760px)');
 function enhance(){
  pending=false;
  if(!mq.matches)return;
  document.querySelectorAll('.week-wrap').forEach(function(w){
   var heads=w.querySelectorAll('.week-day-head');
   w.querySelectorAll('.week-cell').forEach(function(c,i){if(heads[i]){var s=heads[i].innerText.trim().replace(/\s+/g,' ').replace(/^([일월화수목금토])(\d)/,'$1요일 $2');if(c.dataset.smDay!==s)c.dataset.smDay=s;}});
  });
  document.querySelectorAll('.bt-tbl,.pw-workspace table').forEach(function(t){var h=t.querySelectorAll('th');t.querySelectorAll('tbody tr').forEach(function(r){Array.from(r.cells).forEach(function(c,i){if(h[i]&&c.dataset.smLabel!==h[i].textContent.trim())c.dataset.smLabel=h[i].textContent.trim();});});});
  document.querySelectorAll('.content [style],.overlay [style]').forEach(function(e){
   if(e.closest('.hidden,[contenteditable=true],.apv-rich,.sc,.cal-grid,.week-body-grid,.week-header-grid'))return;
   if(e.style.display==='grid'&&e.style.gridTemplateColumns&&!e.classList.contains('sm-inline-grid'))e.classList.add('sm-inline-grid');
   if(/^\d+px$/.test(e.style.minWidth)&&parseFloat(e.style.minWidth)>270&&!e.classList.contains('sm-inline-wide'))e.classList.add('sm-inline-wide');
   if(e.style.display==='flex'&&e.style.flexDirection!=='column'&&!e.classList.contains('sm-inline-row'))e.classList.add('sm-inline-row');
  });
  document.querySelectorAll('.content table:not(.bt-tbl),.overlay table').forEach(function(t){
   if(t.closest('.hidden,.sm-table-scroll,[contenteditable=true]'))return;
   var w=document.createElement('div');w.className='sm-table-scroll';w.tabIndex=0;w.setAttribute('role','region');w.setAttribute('aria-label','표: 좌우 스크롤');t.parentNode.insertBefore(w,t);w.appendChild(t);
  });
 }
 function schedule(){if(!pending){pending=true;requestAnimationFrame(enhance);}}
 function init(){
  var app=document.getElementById('app');if(!app)return;
  var center=document.querySelector('.th-center');
  if(center){var close=document.createElement('button');close.type='button';close.className='sm-menu-close';close.textContent='메뉴 닫기';close.onclick=function(){var more=document.querySelector('[data-mobile=more]');if(more&&document.body.classList.contains('staff-menu-open'))more.click();};center.appendChild(close);}
  var notice=document.createElement('div');notice.className='sm-network';notice.setAttribute('role','status');app.appendChild(notice);
  function network(){notice.textContent=navigator.onLine?'':'인터넷 연결이 끊겼습니다. 연결 후 저장 결과를 확인해 주세요.';}
  addEventListener('online',network);addEventListener('offline',network);network();
  document.addEventListener('click',function(e){if(document.body.classList.contains('staff-menu-open')&&!e.target.closest('.th-center,[data-mobile=more]')){var more=document.querySelector('[data-mobile=more]');if(more)more.click();}});
  new MutationObserver(schedule).observe(app,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  mq.addEventListener('change',schedule);schedule();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
