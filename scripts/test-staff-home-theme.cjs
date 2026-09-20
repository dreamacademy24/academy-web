const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),ts=require('typescript');
const rows=new Map();let actor={id:'a',role:'korean_admin'},failed=false;
const db={from(){return {select(){return {eq(_,key){return {async maybeSingle(){return {data:rows.has(key)?{value:rows.get(key)}:null,error:failed?'offline':null};}};}};},async upsert(row){if(failed)return {error:'offline'};rows.set(row.key,row.value);return {};}};}};
const code=ts.transpileModule(fs.readFileSync('app/api/staff/home-theme/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const exportsObject={};vm.runInNewContext(code,{exports:exportsObject,require(name){if(name==='next/server')return {NextResponse:{json:(body,options)=>({body,...options})}};return {getStaffIdentity:async()=>actor,portalDb:()=>db};}});
const request=body=>({json:async()=>body});
(async()=>{
 assert.equal((await exportsObject.GET(request())).body.theme,'purple');
 for(const theme of ['purple','teal','blue','orange']){assert.equal((await exportsObject.PUT(request({theme}))).status,200);assert.equal((await exportsObject.GET(request())).body.theme,theme);}
 actor={id:'b',role:'korean_admin'};assert.equal((await exportsObject.GET(request())).body.theme,'purple');
 assert.equal((await exportsObject.PUT(request({theme:'teal',username:'a'}))).status,400);
 assert.equal((await exportsObject.PUT(request({theme:'bad'}))).status,400);
 failed=true;assert.equal((await exportsObject.PUT(request({theme:'teal'}))).status,503);failed=false;
 actor=null;assert.equal((await exportsObject.GET(request())).status,403);assert.equal((await exportsObject.PUT(request({theme:'teal'}))).status,403);
 console.log('PASS palette validation, authenticated account key isolation, failed writes and unauthenticated denial');
})();
