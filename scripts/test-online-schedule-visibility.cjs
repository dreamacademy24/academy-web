const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('assert');
const root=process.argv[2] || process.cwd();
const files=['app/api/online-class/sessions/route.ts','app/admin/online-class/page.tsx','app/tutor/online-class/page.tsx'];
for(const f of files){const r=ts.transpileModule(fs.readFileSync(root+'/'+f,'utf8'),{fileName:f,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});assert.equal((r.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,f);}
const source=fs.readFileSync(root+'/'+files[0],'utf8');
const rows=Array.from({length:1101},(_,i)=>({id:String(i),tutor_id:i===0?'sub':null,enrollment:{tutor_id:i===1?null:'main'},tutor:i===0?{id:'sub'}:null}));
let auth=true,fail=false;
const db={from(table){let from=0,to=499;const q={select(){return q},order(){return q},eq(){return q},gte(){return q},lte(){return q},in(){return q},range(a,b){from=a;to=b;return q},then(resolve){resolve({data:table==='online_tutors'?[{id:'main',name_display:'Teacher'}]:rows.slice(from,to+1),error:fail?{message:'failed'}:null})}};return q;}};
const routeExports={};
const context={exports:routeExports,process:{env:{}},URL,Map,Set,require(n){if(n==='@supabase/supabase-js')return {createClient:()=>db};if(n==='next/server')return {NextResponse:{json:(body,options)=>({body,status:options?.status||200})}};if(n==='@/lib/portalAuth')return {getStaffIdentity:async()=>auth?{}:null};throw Error(n)}};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
(async()=>{let r=await routeExports.GET({url:'https://test/api?start=2026-10-12&end=2026-10-18'});assert.equal(r.body.sessions.length,1101);assert.equal(r.body.sessions[0].tutor_id,'sub');assert.equal(r.body.sessions[1].tutor_id,null);assert.equal(r.body.sessions[2].tutor.id,'main');auth=false;assert.equal((await routeExports.GET({url:'https://test/'})).status,401);auth=true;fail=true;assert.equal((await routeExports.GET({url:'https://test/?date=2026-10-14'})).status,500);console.log('PASS: 1101 sessions paginated; substitute preserved; missing teacher resolved; unassigned preserved; auth and query errors; three files syntax');})();


for(const file of files.slice(1)) { const source=fs.readFileSync(root+'/'+file,'utf8'); assert(source.includes('length: 7'),file+' must render all seven days'); assert(source.includes('repeat(7,minmax'),file+' needs seven columns'); assert(source.includes('30000'),file+' must refresh changed schedules'); }
