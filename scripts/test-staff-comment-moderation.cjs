const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const source=fs.readFileSync('app/api/staff/comments/route.ts','utf8');
function setup(actor,commentAuthor='system'){
 const row={id:'c',task_id:'t',from_id:commentAuthor,text:'old',files:[],parent_id:'parent',mention_ids:['ceo']};let removed=false,writes=0;
 const db={from(table){const filters={};let patch=null,del=false;const q={select(){return q},eq(k,v){filters[k]=v;return q},update(v){patch=v;return q},delete(){del=true;return q},maybeSingle:async()=>({data:{id:'t',secret:false}}),then(resolve){assert.equal(table,'staff_task_comments');const matches=Object.entries(filters).every(([k,v])=>row[k]===v);if(matches){writes++;if(del)removed=true;else Object.assign(row,patch);}return Promise.resolve({data:matches?[{...row}]:[]}).then(resolve)}};return q}};
 const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:n=>n==='next/server'?{NextResponse:{json:(body,opt)=>({body,status:opt?.status||200})}}:n==='node:util'?require(n):{workspaceStaffIdentity:async()=>actor,portalDb:()=>db},Date});
 return {exports,row,get removed(){return removed},get writes(){return writes}};
}
const request=(extra={})=>({json:async()=>({id:'c',taskId:'t',originalText:'old',text:'edited',...extra})});
(async()=>{
 for(const method of ['PATCH','DELETE']){const s=setup('admin-ceo');assert.equal((await s.exports[method](request())).status,200);assert.equal(s.row.from_id,'system');assert.equal(s.row.parent_id,'parent');assert.deepEqual(s.row.mention_ids,['ceo']);assert.equal(s.removed,method==='DELETE');}
 const denied=setup('admin-song');assert.equal((await denied.exports.PATCH(request({author:'ceo'}))).status,409);assert.equal(denied.writes,0);
 const own=setup('admin-song','song');assert.equal((await own.exports.PATCH(request())).status,200);
 const conflict=setup('admin-ceo');assert.equal((await conflict.exports.DELETE(request({originalText:'stale'}))).status,409);assert.equal(conflict.writes,0);
 const unauth=setup(null);assert.equal((await unauth.exports.DELETE(request())).status,401);
 const code=fs.readFileSync('public/staff-workspace-task.js','utf8'),ctx={CU:{id:'ceo'}};vm.createContext(ctx);vm.runInContext(code.match(/function _staffOwnComment[^\n]+/)[0]+'\n'+code.match(/function _staffCanManageComment[^\n]+/)[0],ctx);
 assert(ctx._staffCanManageComment({id:'c',author:'system'}));ctx.CU={id:'song'};assert(!ctx._staffCanManageComment({id:'c',author:'system'}));assert(ctx._staffCanManageComment({id:'c',author:'song'}));
 console.log('PASS: CEO moderation, original author/thread/tags preservation, staff ownership, stale text and authentication');
})().catch(e=>{console.error(e);process.exitCode=1});
