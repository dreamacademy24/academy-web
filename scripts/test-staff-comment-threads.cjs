const fs=require('fs'),ts=require('C:/Users/desko/academy-web/node_modules/typescript'),vm=require('vm'),assert=require('node:assert/strict');
function mod(file,req=require){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:req,console,Date,Set,Map});return exports;}
const thread=mod('lib/staffCommentThreads.ts');
let task={id:'task',title:'Test',created_by:'may',assignees:['song'],secret:false},parent={id:'parent',task_id:'task',from_id:'viva'},notifs=new Map(),queries=[];
const accounts=['may','song','viva','jun'].map(id=>({username:'admin-'+id,name:id}));
const db={from(table){let filters={};const q={select(){return q},eq(k,v){filters[k]=v;return q},single(){return Promise.resolve({data:task})},maybeSingle(){return Promise.resolve({data:parent&&parent.task_id===filters.task_id?parent:null})},then(fn){return Promise.resolve({data:accounts}).then(fn)},async upsert(rows,opts){queries.push(opts);for(const row of rows){if(!notifs.has(row.id))notifs.set(row.id,row)}return {error:null}}};return q;}};
(async()=>{
 let ctx=await thread.commentThreadContext(db,'task',['viva','viva'],'parent');assert.equal(ctx.mentions.length,1);
 await thread.notifyTaskComment(db,'may',{id:'comment',task_id:'task',text:'hello'},ctx);assert.equal(notifs.size,2);assert.ok(notifs.get('tc:comment:viva').message.includes('태그'));
 notifs.get('tc:comment:viva').is_read=true;await thread.notifyTaskComment(db,'may',{id:'comment',task_id:'task',text:'hello'},ctx);assert.equal(notifs.size,2);assert.equal(notifs.get('tc:comment:viva').is_read,true);assert.equal(queries[0].ignoreDuplicates,true);
 task.secret=true;await assert.rejects(thread.commentThreadContext(db,'task',['viva'],null));await assert.rejects(thread.commentThreadContext(db,'task',['jun'],null));await assert.rejects(thread.commentThreadContext(db,'other',[],'parent'));
 ctx=await thread.commentThreadContext(db,'task',[],'parent');notifs.clear();await thread.notifyTaskComment(db,'may',{id:'secret',task_id:'task',text:'private'},ctx);assert.equal(notifs.size,1);assert.ok(notifs.has('tc:secret:song'));
 console.log('PASS: valid mentions, deduplicated recipients, reply-author alert, retry preserves read state, secret task recipients, inactive/unknown staff, cross-task parent');
 const ctxUI={console,Map,Set,_staffSafe:s=>String(s).replaceAll('<','&lt;'),getP:id=>({name:id}),_staffCommentHtml:(c,i)=>'<article data-index="'+i+'">'+c.text+'</article>'};vm.createContext(ctxUI);vm.runInContext(fs.readFileSync('public/staff-comment-threads.js','utf8'),ctxUI);
 const html=ctxUI._staffThreadHtml([{id:'a',text:'parent'},{id:'x',text:'unrelated'},{id:'b',parentId:'a',text:'reply'},{id:'c',parentId:'deleted',text:'orphan'}]);assert.ok(html.indexOf('reply')<html.indexOf('unrelated'));assert.ok(html.includes('원래 댓글이 삭제된 답글'));assert.ok(html.includes('data-index="2"'));
 console.log('PASS: threaded display, stable comment action indexes, deleted-parent reply retained');
})().catch(e=>{console.error(e);process.exitCode=1});
