/* Personal dressing room. Only allowlisted pieces are rendered; no uploaded SVG/HTML. */
(function(){
  'use strict';
  var people={},draft=null,profile=null,version=0,section='avatar',saved=false,busy=false;
  var defaults={mode:'character',initial:'M',emoji:'😊',faceShape:'round',eyeSize:'large',expression:'smile',skin:'peach',hair:'bob',hairColor:'brown',clothing:'knit',outfitColor:'purple',background:'lavender',backgroundProp:'none',accessory:'none',seasonHat:'none',seasonFace:'none',seasonOutfit:'none',seasonHand:'none',seasonBackground:'none'};
  var choices={},catalog={},category='basic',group='face',model=null,previewPromise=Promise.resolve(),previewId=0,modulePromise=null;
  var emojis=['😀','😊','😎','🐱','🐶','🐻','🐰','🦊','🐼','🦁','🐯','🐨','🦄','🌸','🌻','⭐','🍀','🌈','🎃','👻','🦇','🧙','🧛','🧟','🐈‍⬛','🍬','🍭','🕸️','🕷️','🌙','💜','💎','🎀','🍓','🍒','🍑','🥑','🐧','🐥','🐬','🦋','🐢','🦉','🤖','👽','🔥','⚡','☀️'];
  function safe(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function normalized(a){var n=Object.assign({},defaults);Object.keys(catalog).forEach(function(k){if(catalog[k].default)n[k]=catalog[k].default;});Object.keys(choices).forEach(function(k){if(a&&choices[k][a[k]])n[k]=a[k];});if(a&&['initial','emoji','character'].includes(a.mode))n.mode=a.mode;if(a&&/^[A-Z0-9가-힣]{1,2}$/.test(a.initial))n.initial=a.initial;if(a&&emojis.includes(a.emoji))n.emoji=a.emoji;if(a&&typeof a.thumbnail==='string')n.thumbnail=a.thumbnail;return n;}
  function img(a,size){var thumbnail=typeof a.thumbnail==='string'&&/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(a.thumbnail)?a.thumbnail:'';
    if(thumbnail&&a.mode==='character')return '<img alt="'+safe(a.initial)+' 3D 아바타" width="'+size+'" height="'+size+'" style="border-radius:24%;vertical-align:middle" src="'+thumbnail+'">';
    return '<span role="img" aria-label="'+safe(a.initial)+' 아이콘" style="display:inline-flex;align-items:center;justify-content:center;width:'+size+'px;height:'+size+'px;border-radius:25%;background:#eee7fc;color:#543783;font-size:'+Math.max(13,size*.45)+'px;font-weight:800">'+safe(a.mode==='emoji'?a.emoji:a.initial)+'</span>';
  }
  window.staffAvatarMarkup=function(id,size){return people[id]?img(people[id],size||28):'';};
  async function request(url,options){var r=await fetch(url,Object.assign({credentials:'same-origin',cache:'no-store'},options)),d=await r.json();if(!r.ok)throw Error(d.error||'저장하지 못했습니다.');return d;}
  function dirty(){saved=false;var b=document.getElementById('avatarSave');if(b)b.textContent='저장하기';}
  function notice(){var dialog=document.createElement('dialog');dialog.className='avatar-saved-dialog';dialog.innerHTML='<div style="font-size:36px">✓</div><h2>저장되었습니다</h2><p>다시 열어도 지금 선택한 설정이 유지됩니다.</p><button type="button" class="btn btn-primary">확인</button>';document.body.append(dialog);dialog.querySelector('button').onclick=function(){dialog.close();};dialog.addEventListener('close',function(){dialog.remove();var b=document.getElementById('avatarSave');if(b)b.focus();});dialog.showModal();}
  function preview(){
    var p=document.getElementById('avatarPreview'),stamp=++previewId;if(model){model.dispose();model=null;}if(!p)return;
    p.innerHTML='<div id="avatarCanvas"></div><strong>'+safe((getP(CU.id)||{}).name||CU.id)+'</strong><span>좌우로 드래그해서 돌려보세요</span><div class="avatar-turn"><button type="button" data-turn="left" aria-label="왼쪽으로 회전">↶</button><button type="button" data-turn="front">정면</button><button type="button" data-turn="right" aria-label="오른쪽으로 회전">↷</button></div><span>업무에 표시되는 모습</span><div id="avatarMini">'+img(draft,36)+'</div><small id="avatar3dStatus" role="status"></small>';
    var canvas=p.querySelector('#avatarCanvas');
    if(draft.mode!=='character'){canvas.innerHTML=img(draft,180);previewPromise=Promise.resolve();return;}
    canvas.textContent='3D 캐릭터를 불러오는 중…';
    if(!modulePromise)modulePromise=import('/staff-avatar-3d.js?v=20260924-3').catch(function(e){modulePromise=null;throw e;});
    previewPromise=modulePromise.then(function(m){if(stamp!==previewId||!canvas.isConnected)return;canvas.textContent='';model=m.mount(canvas,Object.assign({},draft));draft.thumbnail=model.thumbnail();p.querySelector('#avatarMini').innerHTML=img(draft,36);p.querySelectorAll('[data-turn]').forEach(function(button){button.onclick=function(){if(!model)return;if(button.dataset.turn==='front')model.front();else model.rotate(button.dataset.turn==='left'?-.45:.45);};});}).catch(function(){if(stamp===previewId&&canvas.isConnected){canvas.innerHTML=img({mode:'initial',initial:draft.initial},180);p.querySelector('#avatar3dStatus').textContent='이 기기에서 3D를 열지 못했습니다. 이모티콘·이니셜은 사용할 수 있습니다.';throw Error('3D 미리보기를 불러온 뒤 저장해주세요.');}});
    previewPromise.catch(function(){});
  }
  var groups={face:['얼굴','faceShape','eyeSize','expression','skin','eyeColor','eyeSpacing','eyebrows','nose','faceDetail'],hair:['헤어','hair','hairColor','bangs'],outfit:['의상 · 신발','clothing','outfitColor','shoes','shoeColor'],props:['액세서리','accessory','earrings','neckwear','handProp'],room:['배경 · 친구','background','backgroundProp','pet']};
  function options(k,title){return '<fieldset><legend>'+title+'</legend><div class="avatar-options">'+Object.keys(choices[k]).map(function(v){return '<button type="button" data-piece="'+k+'" data-value="'+v+'" aria-pressed="'+(draft[k]===v)+'">'+choices[k][v]+'</button>';}).join('')+'</div></fieldset>';}
  function selectedProps(){return Object.keys(catalog).filter(function(k){return catalog[k].prop&&draft[k]&&draft[k]!=='none';});}
  function propTray(){var keys=selectedProps();return '<div class="avatar-prop-tray"><strong>착용 소품 '+keys.length+'/5개</strong><p>기본 꾸미기는 개수에 포함되지 않습니다. 소품은 종류별 하나씩, 모두 합쳐 5개까지 조합합니다.</p><div class="avatar-options">'+keys.map(function(k){return '<button type="button" data-remove-prop="'+k+'" aria-label="'+safe(choices[k][draft[k]])+' 빼기">'+safe(choices[k][draft[k]])+' ×</button>';}).join('')+'</div><span id="avatarPropLimit" role="status">'+(keys.length>5?'소품을 5개 이하로 줄인 뒤 저장해주세요.':'')+'</span></div>';}
  function render(){
    var host=document.getElementById('sp5');if(!host||!draft||!profile)return;
    host.innerHTML='<div class="avatar-nav" role="group" aria-label="프로필 설정 구분">'+[['avatar','🧸 캐릭터 꾸미기'],['theme','🎨 화면 색상'],['signature','✉️ 이메일 서명']].map(function(t){return '<button type="button" data-section="'+t[0]+'" aria-pressed="'+(section===t[0])+'">'+t[1]+'</button>';}).join('')+'</div><div id="avatarContent"></div><p id="avatarStatus" role="status"></p><div class="avatar-footer"><button type="button" id="avatarSave" class="btn btn-primary">'+(saved?'닫기':'저장하기')+'</button></div>';
    var content=host.querySelector('#avatarContent');
    if(section==='avatar')content.innerHTML='<h3>나만의 아바타 꾸미기</h3><p>할로윈 소품으로 작은 재미를 더해보세요. 이니셜이 함께 표시됩니다.</p><div class="avatar-room"><aside id="avatarPreview"></aside><div class="avatar-controls"><label>내 이니셜 <input id="avatarInitial" maxlength="2" value="'+safe(draft.initial)+'" aria-label="내 이니셜"></label><fieldset><legend>표시 방식</legend><div class="avatar-options">'+[['character','캐릭터 꾸미기'],['emoji','이모티콘'],['initial','이니셜']].map(function(t){return '<button type="button" data-mode="'+t[0]+'" aria-pressed="'+(draft.mode===t[0])+'">'+t[1]+'</button>';}).join('')+'</div></fieldset>'+(draft.mode==='character'?propTray()+'<div class="avatar-category"><button type="button" data-category="basic" aria-pressed="'+(category==='basic')+'">기본 꾸미기</button><button type="button" data-category="season" aria-pressed="'+(category==='season')+'">🎃 시즌 소품 · 할로윈 (44)</button></div><p>'+(category==='season'?'모자·얼굴·의상·손·배경 장식을 함께 골라보세요. 저장한 모습은 시즌이 바뀌어도 유지됩니다.':'얼굴부터 옷, 배경까지 나만의 캐릭터를 만들어보세요.')+'</p>'+(category==='basic'?'<div class="avatar-category">'+Object.keys(groups).map(function(k){return '<button type="button" data-group="'+k+'" aria-pressed="'+(group===k)+'">'+groups[k][0]+'</button>';}).join('')+'</div>':'')+Object.keys(catalog).filter(function(k){return category==='season'?!!catalog[k].season:groups[group].includes(k);}).map(function(k){return options(k,catalog[k].title);}).join(''):draft.mode==='emoji'?'<div class="avatar-emoji">'+emojis.map(function(e,i){return '<button type="button" data-emoji="'+i+'" aria-label="'+e+' 선택" aria-pressed="'+(draft.emoji===e)+'">'+e+'</button>';}).join('')+'</div>':'')+'</div></div>';
    if(section==='theme')content.innerHTML='<h3>내 화면 색상</h3><p>내 직원홈에 적용되는 색상입니다.</p><div class="avatar-options">'+staffHomeThemes.map(function(t){return '<button type="button" data-theme="'+t.id+'" aria-pressed="'+(profile.theme===t.id)+'" style="border-top:8px solid '+t.accent+'">'+safe(t.name)+'</button>';}).join('')+'</div><label style="display:block;margin-top:20px">업무 카드 색상 <input id="avatarColor" type="color" value="'+safe(profile.color||'#6366f1')+'"></label>';
    if(section==='signature')content.innerHTML='<h3>이메일 서명</h3><p>리조트 인보이스 등 이메일을 보낼 때 본문 끝에 들어갑니다.</p><textarea id="avatarSignature" rows="8" aria-label="이메일 서명">'+safe(profile.signature||'')+'</textarea>';
    setupTabs();
    preview();
    host.querySelectorAll('[data-group]').forEach(function(b){b.onclick=function(){group=b.dataset.group;render();};});
    host.querySelectorAll('[data-category]').forEach(function(b){b.onclick=function(){category=b.dataset.category;render();};});
    host.querySelectorAll('[data-section]').forEach(function(b){b.onclick=function(){section=b.dataset.section;render();};});
    host.querySelectorAll('[data-piece]').forEach(function(b){b.onclick=function(){var k=b.dataset.piece,v=b.dataset.value;if(catalog[k].prop&&v!=='none'&&draft[k]==='none'&&selectedProps().length>=5){document.getElementById('avatarPropLimit').textContent='소품은 최대 5개입니다. 선택한 소품의 ×를 눌러 하나를 빼주세요.';return;}draft[k]=v;delete draft.thumbnail;dirty();render();};});
    host.querySelectorAll('[data-remove-prop]').forEach(function(b){b.onclick=function(){draft[b.dataset.removeProp]='none';delete draft.thumbnail;dirty();render();};});
    host.querySelectorAll('[data-mode]').forEach(function(b){b.onclick=function(){draft.mode=b.dataset.mode;delete draft.thumbnail;dirty();render();};});
    host.querySelectorAll('[data-emoji]').forEach(function(b){b.onclick=function(){draft.emoji=emojis[Number(b.dataset.emoji)];dirty();render();};});
    host.querySelectorAll('[data-theme]').forEach(function(b){b.onclick=function(){profile.theme=b.dataset.theme;dirty();render();};});
    var input=host.querySelector('#avatarInitial');if(input)input.oninput=function(){draft.initial=input.value.toUpperCase();delete draft.thumbnail;dirty();preview();};
    var color=host.querySelector('#avatarColor');if(color)color.oninput=function(){profile.color=color.value;dirty();};
    var sig=host.querySelector('#avatarSignature');if(sig)sig.oninput=function(){profile.signature=sig.value;dirty();};
    host.querySelector('#avatarSave').onclick=save;
  }
  async function save(){
    if(saved){closeM('settingsModal');return;}if(busy)return;
    var host=document.getElementById('sp5'),stamp=version,actor=CU.id,status=host.querySelector('#avatarStatus');
    if(!/^[A-Z0-9가-힣]{1,2}$/.test(draft.initial)){status.textContent='이니셜은 영문 대문자·숫자·한글 1~2글자로 입력해주세요.';return;}
    if(selectedProps().length>5){status.textContent='소품은 최대 5개까지 저장할 수 있습니다.';return;}
    busy=true;host.inert=true;status.textContent='저장 중…';
    try{
      await previewPromise;if(draft.mode==='character'&&!model&&!draft.thumbnail)throw Error('3D 미리보기를 확인한 뒤 저장해주세요.');if(model)draft.thumbnail=model.thumbnail();
      await request('/api/staff/avatar',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)});
      await request('/api/staff/profile',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({initial:draft.mode==='emoji'?draft.emoji:draft.initial,color:profile.color,signature:profile.signature})});
      if(profile.theme!==staffHomeTheme)await request('/api/staff/home-theme',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({theme:profile.theme})});
      if(stamp!==version||CU.id!==actor)return;
      people[actor]=normalized(draft);var me=getP(actor);if(me){me.color=profile.color;me.initial=draft.mode==='emoji'?draft.emoji:draft.initial;}CU.initial=draft.mode==='emoji'?draft.emoji:draft.initial;CU.color=profile.color;staffApplyHomeTheme(profile.theme);saved=true;
      if(typeof refreshAll==='function')refreshAll();render();decorate();notice();
    }catch(e){if(stamp===version)status.textContent=e.message+' 아직 저장이 완료되지 않았습니다. 다시 저장해주세요.';}
    finally{busy=false;host.inert=false;}
  }
  async function open(){
    var host=document.getElementById('sp5');if(!host||!CU)return;var stamp=++version,actor=CU.id;saved=false;busy=false;draft=null;profile=null;
    host.innerHTML='<p role="status">내 아바타와 설정을 불러오는 중입니다…</p>';
    try{var results=await Promise.all([request('/api/staff/avatar'),request('/api/staff/profile'),request('/api/staff/home-theme'),request('/staff-avatar-catalog.json')]);catalog=results[3];choices={};Object.keys(catalog).forEach(function(k){choices[k]=catalog[k].items;});if(stamp!==version||!CU||CU.id!==actor)return;
      people=results[0].avatars||{};var p=results[1].profile;draft=normalized(results[0].avatar||{initial:/^[A-Z0-9가-힣]{1,2}$/.test(p.initial)?p.initial:(actor==='song'?'S':actor==='vivace'?'V':'M'),mode:emojis.includes(p.initial)?'emoji':'initial',emoji:p.initial});draft.mode='character';delete draft.thumbnail;profile={color:p.color||'#6366f1',signature:p.signature||'',theme:results[2].theme};render();
    }catch(e){if(stamp===version){host.innerHTML='<p role="alert">'+safe(e.message)+'</p><button type="button" class="btn">다시 불러오기</button>';host.querySelector('button').onclick=open;}}
  }
  function decorate(){
    if(typeof CU==='undefined'||!CU)return;
    ['sbAv','ehAv'].forEach(function(id){var el=document.getElementById(id),person=id==='ehAv'&&typeof curEmpId!=='undefined'&&curEmpId?curEmpId:CU.id;if(el&&people[person]){var html=img(people[person],id==='sbAv'?32:44);if(el.innerHTML!==html)el.innerHTML=html;}});
    document.querySelectorAll('.pt-av[title]').forEach(function(el){var name=el.getAttribute('title'),p=typeof ALL!=='undefined'&&ALL.find(function(p){return p.name===name;});if(p&&people[p.id]){var html=img(people[p.id],28);if(el.innerHTML!==html)el.innerHTML=html;}});
  }
  var css=document.createElement('link');css.rel='stylesheet';css.href='/staff-avatar.css?v=20260924';document.head.append(css);
  function setupTabs(){
 var tabs=document.getElementById('settingsTabs');if(!tabs)return;
 tabs.innerHTML=[['avatar','🧸 캐릭터 꾸미기'],['theme','🎨 화면 색상'],['signature','✉️ 이메일 서명'],['password','🔑 비밀번호']].map(function(t){return '<button type="button" class="settings-tab '+(section===t[0]?'active':'')+'" data-top-section="'+t[0]+'">'+t[1]+'</button>';}).join('');
 tabs.querySelectorAll('[data-top-section]').forEach(function(b){b.onclick=function(){section=b.dataset.topSection;for(var i=0;i<6;i++){var p=document.getElementById('sp'+i);if(p)p.classList.toggle('active',i===(section==='password'?4:5));}if(section==='password'){renderSettingsTab4();setupTabs();}else render();};});
}
function install(){renderSettingsTab5=open;saveMyProfile=save;
 openSettings=function(){section='avatar';category='basic';for(var i=0;i<6;i++){var p=document.getElementById('sp'+i);if(p)p.classList.toggle('active',i===5);}setupTabs();openM('settingsModal');open();};
    var old=_staffCompletionStatus;_staffCompletionStatus=function(t){var html=old(t),root=document.createElement('div');root.innerHTML=html;root.querySelectorAll('[title]').forEach(function(el){var ids=_staffCompletionPeople(t),id=ids.find(function(id){return (getP(id)||{}).name===el.title;});if(id&&people[id]&&el.firstElementChild)el.firstElementChild.outerHTML=img(people[id],28);});return root.innerHTML;};
    ['refreshAll','ptRenderTree','ptRenderDetail','renderEmpPage'].forEach(function(name){var original=window[name];if(typeof original==='function')window[name]=function(){var r=original.apply(this,arguments);decorate();return r;};});
    request('/api/staff/avatar').then(function(d){people=d.avatars||{};decorate();}).catch(function(){});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();

