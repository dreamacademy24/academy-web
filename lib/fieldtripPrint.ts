import type { Block } from './fieldtripWorkspace';

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

/** A separate A4 document avoids printing the editor/dialog and its scroll containers. */
export function fieldtripPrintHtml(title: string, blocks: Block[]) {
 return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${escape(title)}</title><style>
*{box-sizing:border-box}body{margin:0;background:#edf1f6;color:#12304e;font-family:Arial,"Malgun Gothic",sans-serif}.tools{padding:16px;display:flex;gap:14px;flex-wrap:wrap;align-items:center;position:sticky;top:0;background:white;z-index:2;border-bottom:1px solid #ddd}.tools button,.tools select{font:inherit;padding:8px}.help{width:100%;font-size:13px;margin:0}#sheet{width:210mm;height:296mm;overflow:hidden;padding:10mm;margin:16px auto;background:white;--gap:10px}#content{width:190mm;transform-origin:top left}.brand{background:#18395d;color:white;padding:16px 20px;font-size:22px;font-weight:bold}.brand small{display:block;font-size:11px;margin-top:5px}h1{font-size:22px;margin:18px 0;overflow-wrap:anywhere}.blocks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--gap)}section{border:1px solid #d5dfec;border-radius:8px;padding:12px;min-width:0}h2{font-size:15px;margin:0 0 10px;padding-bottom:7px;border-bottom:2px solid #23466b;overflow-wrap:anywhere}p{font-size:13px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere;margin:0}#sheet:not(.keep-height) section{min-height:0!important}@page{size:A4 portrait;margin:0}@media print{html,body{width:210mm;margin:0;background:white}.tools{display:none!important}#sheet{margin:0;break-inside:avoid;print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body><div class="tools"><label>용지 여백 <select id="margin"><option value="6">6 mm</option><option value="10" selected>10 mm</option><option value="15">15 mm</option></select></label><label>상자 간격 <select id="gap"><option value="6">좁게</option><option value="10" selected>보통</option><option value="16">넓게</option></select></label><label><input id="keep" type="checkbox">편집한 상자 높이 유지</label><button id="print" disabled>인쇄 · PDF 저장</button><button id="image" disabled>이미지 저장</button><p class="help" id="status">한 페이지에 맞추는 중…</p><p class="help">PDF: 대상 ‘PDF로 저장’, 용지 A4, 배율 100%, 머리글·바닥글 끄기. 내용이 많으면 글자가 작아지므로 미리보기를 확인해주세요.</p></div><main id="sheet"><article id="content"><div class="brand">Dream Academy<small>필드트립 · 애프터스쿨</small></div><h1>${escape(title)}</h1><div class="blocks">${blocks.map(b=>`<section style="grid-column:span ${b.width===1?1:2};min-height:${Math.max(0,Math.min(2000,Number(b.height)||0))}px"><h2>${escape(b.title)}</h2><p>${escape(b.text)}</p></section>`).join('')}</div></article></main><script>
const sheet=document.getElementById('sheet'),content=document.getElementById('content');
function fit(){const margin=Number(document.getElementById('margin').value);sheet.style.padding=margin+'mm';sheet.style.setProperty('--gap',document.getElementById('gap').value+'px');sheet.classList.toggle('keep-height',document.getElementById('keep').checked);content.style.transform='none';content.style.width=(210-2*margin)+'mm';const style=getComputedStyle(sheet);const available=sheet.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)-2;const scale=Math.min(1,available/content.scrollHeight);content.style.transform='scale('+scale+')';document.getElementById('status').textContent='A4 한 페이지 · 내용 배율 '+Math.round(scale*100)+'%'+(scale<0.65?' · 글자가 작습니다. 내용을 줄이거나 여백·상자 높이를 줄여주세요.':'');document.getElementById('print').disabled=false;document.getElementById('image').disabled=false;}
document.querySelectorAll('select,input').forEach(el=>el.addEventListener('change',fit));document.getElementById('print').onclick=()=>{fit();window.print();};window.addEventListener('beforeprint',fit);document.fonts.ready.then(fit);
</script></body></html>`;
}

export function openFieldtripPrint(title: string, blocks: Block[]) {
 const overlay=document.createElement('div');
 overlay.setAttribute('role','dialog');overlay.setAttribute('aria-label','한 페이지 저장 미리보기');
 overlay.style.cssText='position:fixed;inset:0;z-index:10000;background:#edf1f6;padding-top:48px';
 const close=document.createElement('button');close.textContent='저장 미리보기 닫기';
 close.style.cssText='position:absolute;right:16px;top:8px;padding:6px 14px;background:white;border:1px solid #aaa;border-radius:6px';
 close.onclick=()=>overlay.remove();
 const frame=document.createElement('iframe');frame.title='A4 한 페이지 저장';
 frame.style.cssText='width:100%;height:100%;border:0';
 overlay.append(close,frame);document.body.append(overlay);
 const popup=frame.contentWindow;
 if(!popup){overlay.remove();throw Error('저장 미리보기를 열 수 없습니다. 다시 시도해주세요.');}
 popup.document.open();popup.document.write(fieldtripPrintHtml(title,blocks));popup.document.close();
 popup.document.getElementById('image')!.onclick=async()=>{
  const button=popup.document.getElementById('image') as HTMLButtonElement;
  button.disabled=true;button.textContent='이미지 만드는 중…';
  try{await popup.document.fonts.ready;const {default:html2canvas}=await import('html2canvas');const canvas=await html2canvas(popup.document.getElementById('sheet')!,{scale:2,backgroundColor:'#ffffff',windowWidth:1000});const a=popup.document.createElement('a');a.download=(title.replace(/[\\/:*?"<>|]/g,'_')||'필드트립 안내문')+'.png';a.href=canvas.toDataURL('image/png');a.click();}
  catch{popup.document.getElementById('status')!.textContent='이미지 저장에 실패했습니다. 인쇄 · PDF 저장을 이용하거나 다시 시도해주세요.';}
  finally{button.disabled=false;button.textContent='이미지 저장';}
 };
}


