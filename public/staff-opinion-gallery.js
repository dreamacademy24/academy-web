/* Image-first opinion comparisons, with up to ten choices. */
(function(){
 'use strict';
 var css=document.createElement('style');
 css.textContent=`
 #opDetail .swm-attachments{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(180px,240px))!important;gap:12px}
 #opDetail .swm-photo{margin:0!important}#opDetail .swm-photo img{height:150px!important;object-fit:contain!important}
 .opg-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin:16px 0;font-size:15px;color:#334155;flex-wrap:wrap}
 .opg-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
 .opg-card{border:1px solid #dcdfea;border-radius:14px;background:#fff;overflow:hidden;display:flex;flex-direction:column;min-width:0}
 .opg-card.chosen{border:2px solid #6950c9;box-shadow:0 0 0 3px #f1edff}
 .opg-card h3{font-size:16px;margin:0;padding:14px 16px;line-height:1.5;background:#f6f5fb}
 .opg-preview{border:0;background:#f6f7fa;display:flex;align-items:center;justify-content:center;width:100%;height:360px;padding:12px;cursor:zoom-in}
 .opg-preview img{width:100%;height:100%;object-fit:contain;max-height:none!important}
 .opg-card footer{margin-top:auto;padding:14px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
 .opg-action{border:0;border-radius:8px;background:#6246c4;color:white;padding:10px 16px;font:700 14px inherit;cursor:pointer}
 .opg-action:disabled{background:#ece8f8;color:#6246c4;cursor:default}
 .opg-result{margin-left:auto;font-size:14px;color:#5341a6;font-weight:700}
 .opg-track{height:5px;background:#efedf7}.opg-track span{display:block;height:100%;background:#927cdd}
 #opVoteOpts .opv-row{display:grid!important;grid-template-columns:minmax(100px,1fr) minmax(140px,1.4fr) auto;gap:8px!important;background:#f7f6fb;padding:10px;border-radius:10px;margin-bottom:10px!important}
 #opVoteOpts input{min-width:0;padding:9px;border:1px solid #d8dce7;border-radius:7px;font:inherit;width:100%;box-sizing:border-box}
 .opg-draft-media{display:flex;align-items:center;gap:8px;min-width:0}.opg-draft-media img{width:58px;height:72px;object-fit:contain;background:white;border-radius:6px}
 @media(min-width:1500px){.opg-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
 @media(max-width:900px){.opg-grid{grid-template-columns:1fr}.opg-preview{height:380px}}
 @media(max-width:500px){#opVoteOpts .opv-row{grid-template-columns:1fr auto}.opg-draft-media{grid-column:1/-1;grid-row:2}}
 `;document.head.append(css);
 function el(tag,text,cls){var n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
 function safeUrl(value){try{var s=String(value||'').trim();if(/^data:image\/(png|jpeg|webp|gif|bmp);base64,/i.test(s))return s;var u=new URL(s,location.href);return s&&/^https?:$/.test(u.protocol)?u.href:'';}catch(e){return '';}}
 window.opVoteAddOpt=function(label,url){
  var c=document.getElementById('opVoteOpts');if(!c)return;
  if(c.children.length>=10){toast('최대 10개까지 등록할 수 있습니다.','#ef4444');return;}
  var row=el('div',null,'opv-row');row.dataset.url=url||'';
  var name=el('input');name.className='opv-label';name.placeholder='선택지 이름';name.setAttribute('aria-label','선택지 이름');name.value=label||'';
  var media=el('div',null,'opg-draft-media');
  if(url&&/^data:image\//.test(url)){
   var img=el('img');img.src=safeUrl(url);img.alt='첨부 시안';media.append(img);
   var remove=el('button','사진 제거');remove.type='button';remove.onclick=function(){row.dataset.url='';_rebuildVoteOptsFromDOM();};media.append(remove);
  }else{var link=el('input');link.className='opv-url';link.placeholder='이미지 또는 참고 URL (선택)';link.setAttribute('aria-label','선택지 URL');link.value=url||'';link.oninput=function(){row.dataset.url='';};media.append(link);
   var upload=el('label','📷');upload.title='선택지 이미지 첨부';var file=el('input');file.type='file';file.accept='image/*';file.style.display='none';file.onchange=function(){opVoteImgChange(file);};upload.append(file);media.append(upload);
  }
  var del=el('button','×');del.type='button';del.setAttribute('aria-label','선택지 삭제');del.onclick=function(){row.remove();count();};
  row.append(name,media,del);c.append(row);count();
 };
 function count(){var c=document.getElementById('opVoteOpts'),b=document.getElementById('opVoteAddBtn');if(!c||!b)return;b.textContent='+ 항목 추가 ('+c.children.length+'/10)';b.disabled=c.children.length>=10;var hint=c.previousElementSibling;if(hint)hint.textContent='📊 투표 선택지 · 최대 10개 · 사진을 넣으면 나란히 비교할 수 있습니다.';}
 window._voteRender=function(op){
  var slot=document.getElementById('opdVote_'+op.id);if(!slot)return;
  sbGet('staff_votes','opinion_id=eq.'+op.id+'&select=voter_id,option_idx').then(function(votes){
   if(!slot.isConnected)return;
   var opts=Array.isArray(op.vote_options)?op.vote_options:JSON.parse(op.vote_options||'[]');
   var counts=opts.map(function(){return 0;}),my=-1;
   votes.forEach(function(v){if(v.option_idx>=0&&v.option_idx<counts.length)counts[v.option_idx]++;if(CU&&v.voter_id===CU.id)my=v.option_idx;});
   var closed=!!op.completed_at||!!(op.vote_deadline&&Date.now()>new Date(op.vote_deadline+'T23:59:59+09:00').getTime());
   slot.replaceChildren();var head=el('div',null,'opg-head');head.append(el('strong','📊 시안 비교 · '+opts.length+'개'),el('span',(closed?'투표 마감':op.vote_deadline?'마감 '+op.vote_deadline:'진행 중')+' · 총 '+votes.length+'표'));slot.append(head);
   slot.append(el('p','이미지를 누르면 크게 볼 수 있습니다. 원하는 시안 아래의 투표하기를 누르세요.'));
   var grid=el('div',null,'opg-grid');slot.append(grid);
   opts.forEach(function(o,i){
    var card=el('article',null,'opg-card'+(my===i?' chosen':''));card.append(el('h3',(i+1)+'. '+(o.label||'선택지')+(my===i?' · 내 선택':'')));
    var src=safeUrl(o.url);if(src){var preview=el('button',null,'opg-preview');preview.type='button';preview.setAttribute('aria-label',(o.label||'시안')+' 확대');var image=el('img');image.src=src;image.alt=o.label||'시안';image.loading='lazy';image.onerror=function(){preview.replaceChildren(el('span','참고 링크 열기 ↗'));preview.onclick=function(){if(/^https?:/.test(src))window.open(src,'_blank','noopener');};};preview.append(image);preview.onclick=function(){if(typeof _staffOpenGallery==='function')_staffOpenGallery([{src:src,name:o.label||'시안'}],0);else openLightbox(src);};card.append(preview);}
    var footer=el('footer');if(!closed){var b=el('button',my===i?'✓ 투표한 시안':'투표하기','opg-action');b.type='button';b.disabled=my===i;b.onclick=function(){castVote(op.id,i);};footer.append(b);}
    var pct=votes.length?Math.round(counts[i]/votes.length*100):0;footer.append(el('span',counts[i]+'표 · '+pct+'%','opg-result'));card.append(footer);var track=el('div',null,'opg-track'),fill=el('span');fill.style.width=pct+'%';track.append(fill);card.append(track);grid.append(card);
   });
  }).catch(function(){if(slot.isConnected)slot.textContent='투표 결과를 불러오지 못했습니다. 다시 열어주세요.';});
 };
 count();
})();

