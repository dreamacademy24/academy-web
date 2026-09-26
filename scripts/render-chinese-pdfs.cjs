const {chromium}=require('C:/Users/desko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('node:path');const fs=require('node:fs');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage();const target='C:/Users/desko/Claude/Artifacts/ChatGPT 저장';fs.mkdirSync(target,{recursive:true});
for(const [src,name] of [['cards','cards-duplex'],['workbook','starter-workbook'],['guide','printing-guide']]){
 await page.goto('file:///'+path.resolve('tmp/chinese-review/'+src+'.html').replaceAll('\\','/'));await page.evaluate(()=>document.fonts.ready);
 await page.pdf({path:path.join(target,'Little-Mandarin-'+name+'.pdf'),printBackground:true,preferCSSPageSize:true});
 fs.copyFileSync(path.join(target,'Little-Mandarin-'+name+'.pdf'),'public/mandarin/'+name+'.pdf');console.log(name+' rendered');
}
await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
