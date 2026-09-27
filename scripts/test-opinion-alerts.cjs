const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('public/team_manager3.html','utf8').replace(/\r\n/g,'\n');
for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
function fn(name){const start=html.indexOf('function '+name+'('),end=html.indexOf('\nfunction ',start+1);return html.slice(start,end);}
const calls=[],ctx={CU:{id:'reviewer'},myNotifs:[],_opListCache:[{id:1,title:'첫 의견'},{id:2,title:'둘째 의견'}],_notifSeenIds:{},_notifFirstLoad:true,toast(){},renderNotifBadges(){},_renderOpListItems(){},sbPatch:async(t,q,b)=>calls.push({t,q,b})};
vm.createContext(ctx);
for(const n of ['_opUnreadRows','_opMarkRead','loadMyNotifs'])vm.runInContext(fn(n),ctx);
(async()=>{
 const first={id:'n1',type:'opinion',ref_id:'1',is_read:false},other={id:'n2',type:'opinion',ref_id:'2',is_read:false},legacy={id:'old',type:'opinion',ref_id:'',message:'May님이 의견을 요청했습니다: 첫 의견',is_read:false};
 ctx.myNotifs=[first,other,legacy];assert.equal(ctx._opUnreadRows({id:1,title:'첫 의견'}).length,2);
 await ctx._opMarkRead({id:1},ctx._opUnreadRows({id:1,title:'첫 의견'}));assert.deepEqual(Array.from(ctx.myNotifs,n=>n.id),['n2']);assert.ok(calls[0].q.includes('to_id=eq.reviewer&id=in.(n1,old)'));
 ctx.myNotifs=[first];ctx.sbPatch=async()=>{throw Error('offline');};await ctx._opMarkRead({id:1},[first]);assert.equal(ctx.myNotifs.length,1);
 ctx._opListCache.push({id:3,title:'첫 의견'});ctx.myNotifs=[legacy];assert.equal(ctx._opUnreadRows({id:1,title:'첫 의견'}).length,0);
 const crowded=Array.from({length:200},(_,i)=>({id:'t'+i,type:'task'}));ctx.sbGet=async(t,q)=>q.includes('type=eq.opinion')?[first,other]:crowded;await ctx.loadMyNotifs();assert.equal(ctx.myNotifs.length,202);
 ctx.sbGet=async()=>[first];await ctx.loadMyNotifs();assert.equal(ctx.myNotifs.length,1);
 const opinionBranch=html.split("if(p==='opinions'){")[1].split('\n')[0];assert.ok(!opinionBranch.includes('markNotifsRead'));assert.ok(opinionBranch.includes('renderNotifBadges'));
 assert.ok(html.includes("createNotifMultiple(_opIds,'opinion',String(op.id)"));
 console.log('PASS: script syntax, per-post read scope, legacy match, failed-write preservation, ambiguous legacy titles, crowded inbox, deduplication, list stays unread, new post reference');
})().catch(e=>{console.error(e);process.exitCode=1;});
