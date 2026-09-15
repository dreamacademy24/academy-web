/* Mobile uses the existing page handlers and data; no duplicate tasks or chat store. */
(function(){
'use strict';
var mq=window.matchMedia('(max-width:760px)'),nav,menu=false;
function closeMenu(){menu=false;document.body.classList.remove('staff-menu-open');if(nav)nav.querySelector('[data-mobile=more]').setAttribute('aria-expanded','false');}
function sync(){
 if(!nav)return;var current=document.querySelector('.content>[id^=page-]:not(.hidden)');var page=current?current.id.slice(5):'';
 document.body.dataset.mobilePage=page;nav.hidden=document.getElementById('app').classList.contains('hidden');
 nav.querySelectorAll('[data-mobile]').forEach(function(b){var id=b.dataset.mobile;b.setAttribute('aria-current',(id===page||(id==='mywork'&&page==='emp'))?'page':'false');var source=id==='chat'?'scBadge':id==='home'?'badge-notif':id==='board'?'badge-board':id==='mywork'?'badge-mywork':'';var orig=document.getElementById(source),badge=b.querySelector('span');if(badge){var value=orig&&orig.style.display!=='none'?orig.textContent:'';badge.textContent=value==='0'?'':value;}});
}
function viewport(){
 if(!mq.matches){document.documentElement.style.removeProperty('--staff-viewport');document.body.classList.remove('staff-keyboard');try{window.top.document.documentElement.style.removeProperty('--staff-viewport');if(window.frameElement)window.frameElement.style.height='100dvh';}catch(e){}return;}
 var v=window.visualViewport,height=v?v.height:window.innerHeight,full=window.innerHeight;
 try{if(window.parent!==window){v=window.top.visualViewport;height=v?v.height:window.top.innerHeight;full=window.top.innerHeight;window.top.document.documentElement.style.setProperty('--staff-viewport',height+'px');if(window.frameElement)window.frameElement.style.height=height+'px';}}catch(e){}
 document.documentElement.style.setProperty('--staff-viewport',height+'px');var input=document.activeElement;document.body.classList.toggle('staff-keyboard',full-height>130&&!!input&&input.matches('input,textarea,[contenteditable=true]'));
}
function init(){
 var app=document.getElementById('app');if(!app)return;nav=document.createElement('nav');nav.className='staff-mobile-nav';nav.setAttribute('aria-label','직원업무 이동');
 nav.innerHTML=[['home','홈'],['mywork','내 업무'],['board','전체 업무'],['chat','채팅'],['more','더보기']].map(function(x){return '<button type="button" data-mobile="'+x[0]+'"'+(x[0]==='more'?' aria-expanded="false"':'')+'>'+x[1]+'<span></span></button>';}).join('');app.appendChild(nav);
 nav.onclick=function(e){var b=e.target.closest('[data-mobile]');if(!b)return;var p=b.dataset.mobile;if(p==='more'){menu=!menu;document.body.classList.toggle('staff-menu-open',menu);b.setAttribute('aria-expanded',String(menu));return;}closeMenu();window.showPage(p);sync();};
 document.querySelector('.th-center').addEventListener('click',function(e){if(e.target.closest('button'))closeMenu();});document.addEventListener('keydown',function(e){if(e.key==='Escape')closeMenu();});
 var observer=new MutationObserver(sync);document.querySelectorAll('.content>[id^=page-],.th-center .nav-badge,#app').forEach(function(el){observer.observe(el,{attributes:true,attributeFilter:['class','style'],childList:el.classList.contains('nav-badge'),characterData:true,subtree:el.classList.contains('nav-badge')});});
 window.addEventListener('resize',viewport);window.visualViewport&&window.visualViewport.addEventListener('resize',viewport);try{window.top.visualViewport&&window.top.visualViewport.addEventListener('resize',viewport);}catch(e){}
 document.addEventListener('focusin',viewport);document.addEventListener('focusout',function(){setTimeout(viewport,100);});mq.addEventListener('change',function(){closeMenu();viewport();});sync();viewport();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
