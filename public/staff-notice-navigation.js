(function(){
 'use strict';
 function install(){
  if(typeof renderAnnouncementsPage!=='function')return;
  var original=renderAnnouncementsPage;
  var styles=document.createElement('style');
  styles.textContent='#ntViewOv .nt-reading-layout{max-width:820px!important;display:block}#ntViewOv .nt-reading-layout>.tm-card{min-width:0}#ntViewOv .nt-reading-list{position:static;margin-top:20px;border:1px solid var(--border);border-radius:14px;background:var(--surface);overflow:hidden}#ntViewOv .nt-reading-list h2{font-size:16px;margin:0;padding:16px;border-bottom:1px solid var(--border)}#ntViewOv .nt-reading-items{max-height:440px;overflow:auto;padding:8px}#ntViewOv .nt-reading-item{display:block;width:100%;text-align:left;background:transparent;color:var(--text);border:1px solid transparent;border-radius:9px;padding:12px;font:inherit;cursor:pointer;margin-bottom:4px}#ntViewOv .nt-reading-item:hover{background:var(--surface2)}#ntViewOv .nt-reading-item[aria-current="true"]{background:var(--surface2);border-color:var(--accent,#6650c5)}#ntViewOv .nt-reading-item strong{display:block;font-size:13px;line-height:1.6;overflow-wrap:anywhere}#ntViewOv .nt-reading-item small{display:block;margin-top:5px;color:var(--text3);font-size:11px}#ntViewOv .nt-next-notice{margin-top:16px;display:flex;gap:8px;flex-wrap:wrap} @media(max-width:1000px){#ntViewOv .nt-reading-layout{display:block}#ntViewOv .nt-reading-list{position:static;margin-top:20px}#ntViewOv .nt-reading-items{max-height:440px}}';
  document.head.appendChild(styles);
  function mount(){
   var overlay=document.getElementById('ntViewOv');if(!overlay||!_ntSelId)return;
   var card=overlay.querySelector('.tm-card');if(!card)return;
   var layout=card.parentElement;layout.classList.add('nt-reading-layout');
   var old=layout.querySelector('.nt-reading-list');if(old)old.remove();
   var oldNext=card.querySelector('.nt-next-notice');if(oldNext)oldNext.remove();
   var list=(notices||[]).slice(),selected=String(_ntSelId);
   var aside=document.createElement('aside');aside.className='nt-reading-list';aside.setAttribute('aria-label','다른 공지 목록');
   var title=document.createElement('h2');title.textContent='공지 목록 · '+list.length+'개';aside.appendChild(title);
   var items=document.createElement('div');items.className='nt-reading-items';aside.appendChild(items);
   function open(id){_ntOpen(id);var current=document.getElementById('ntViewOv');if(current)current.scrollTop=0;}
   list.forEach(function(n){
    var button=document.createElement('button');button.type='button';button.className='nt-reading-item';
    button.setAttribute('aria-current',String(String(n.id)===selected));
    var heading=document.createElement('strong');heading.textContent=n.title||_ntPlain(n).slice(0,80)||'(제목 없음)';button.appendChild(heading);
    var meta=document.createElement('small');var read=CU&&(noticeReads[n.id]||[]).indexOf(CU.id)>=0;
    meta.textContent=(n.date||'').slice(0,10)+' · '+(n.done?'완료':read?'읽음':'미확인');button.appendChild(meta);
    button.onclick=function(){open(String(n.id));};items.appendChild(button);
   });
   layout.appendChild(aside);
   var index=list.findIndex(function(n){return String(n.id)===selected;});
   var next=list.slice(index+1).concat(list.slice(0,index)).find(function(n){return !n.done;});
   if(next){var actions=document.createElement('div');actions.className='nt-next-notice';var button=document.createElement('button');button.className='tm-btn tm-btn-pri';button.type='button';button.textContent='다음 미완료 공지 보기 →';button.onclick=function(){open(String(next.id));};actions.appendChild(button);(card.querySelector('.tm-card-b')||card).appendChild(actions);}
   var active=items.querySelector('[aria-current="true"]');if(active)items.scrollTop=Math.max(0,active.offsetTop-items.offsetTop-70);
  }
  renderAnnouncementsPage=function(){var result=original.apply(this,arguments);mount();return result;};
  mount();
 }
 if(document.readyState==='complete')install();else window.addEventListener('load',install,{once:true});
})();

