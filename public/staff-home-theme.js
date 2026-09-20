/* Per-account home palette; avatar colors and task status colors remain independent. */
var staffHomeThemes=[
  {id:'purple',name:'A · 퍼플·네이비',accent:'#5944bf',soft:'#eee9fc',bg:'#f4f2fa',ink:'#202b47',image:'a-purple-navy'},
  {id:'teal',name:'B · 딥 틸·민트',accent:'#0f766e',soft:'#d9f2e9',bg:'#f0f8f5',ink:'#183d3b',image:'b-teal-mint'},
  {id:'blue',name:'C · 로열 블루·스카이',accent:'#245ac1',soft:'#e1edff',bg:'#f1f6fd',ink:'#183554',image:'c-blue-sky'},
  {id:'orange',name:'D · 웜 오렌지·차콜',accent:'#a94b12',soft:'#ffead8',bg:'#faf5ee',ink:'#34312e',image:'d-orange-charcoal'}
];
var staffHomeTheme='purple',staffHomeThemeReady=false;
function staffApplyHomeTheme(id){
  var theme=staffHomeThemes.find(function(t){return t.id===id;})||staffHomeThemes[0];
  staffHomeTheme=theme.id;
  var root=document.documentElement;root.dataset.staffHomeTheme=theme.id;
  ['accent','soft','bg','ink'].forEach(function(k){root.style.setProperty('--home-'+k,theme[k]);});
}
async function staffLoadHomeTheme(){
  var actor=CU;staffHomeThemeReady=false;staffApplyHomeTheme('purple');
  try{
    var response=await fetch('/api/staff/home-theme',{cache:'no-store'}),data=await response.json();
    if(CU!==actor)return;
    if(!response.ok)throw Error(data.error||'색상 설정을 불러오지 못했습니다.');
    staffApplyHomeTheme(data.theme);staffHomeThemeReady=true;
    staffRenderHomeThemePicker();
  }catch(e){var box=document.getElementById('staffHomeThemePicker');if(box)box.innerHTML='<p>색상 설정을 불러오지 못했습니다. <button type="button" onclick="staffLoadHomeTheme()">다시 불러오기</button></p>';}
}
function staffRenderHomeThemePicker(){
  var box=document.getElementById('staffHomeThemePicker');if(!box)return;
  if(!staffHomeThemeReady){box.innerHTML='<p>내 색상 설정을 불러오는 중입니다…</p>';staffLoadHomeTheme();return;}
  box.innerHTML='<h3>직원홈 색상</h3><p>투표에 나온 네 가지 색상 중 골라주세요. 본인 직원홈에만 적용되며, 다른 기기에서도 유지됩니다.</p><div class="staff-theme-options">'+staffHomeThemes.map(function(t){return '<label class="staff-theme-option" style="--option-accent:'+t.accent+';--option-soft:'+t.soft+'"><input type="radio" name="staffHomeTheme" value="'+t.id+'" '+(staffHomeTheme===t.id?'checked':'')+'><span class="staff-theme-swatch" style="background:'+t.bg+';color:'+t.ink+'"><b style="background:'+t.accent+'"></b><i style="background:'+t.soft+'"></i></span><strong>'+t.name+'</strong></label>';}).join('')+'</div><div class="staff-theme-actions"><button type="button" class="btn btn-primary btn-sm" onclick="staffSaveHomeTheme(this)">홈 색상 저장</button><span id="staffHomeThemeStatus" role="status"></span></div>';
}
async function staffSaveHomeTheme(button){
  var selected=document.querySelector('input[name=staffHomeTheme]:checked'),status=document.getElementById('staffHomeThemeStatus');
  if(!selected)return;button.disabled=true;status.textContent='저장 중…';var actor=CU;
  try{
    var response=await fetch('/api/staff/home-theme',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({theme:selected.value})}),data=await response.json();
    if(!response.ok)throw Error(data.error||'저장하지 못했습니다.');
    if(CU!==actor)return;
    staffApplyHomeTheme(data.theme);status.textContent='저장했습니다. 홈에 바로 적용됩니다.';
  }catch(e){status.textContent=e.message||'저장하지 못했습니다. 다시 시도해주세요.';}
  finally{button.disabled=false;}
}
