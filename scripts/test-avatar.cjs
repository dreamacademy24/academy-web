const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const catalog=require('../public/staff-avatar-catalog.json');
let staff={id:'own-id',username:'admin-may',role:'korean_admin'},writes=[],fail=false;
function load(file){const out=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const mod={exports:{}};vm.runInNewContext(out,{exports:mod.exports,module:mod,require(name){if(name==='@/public/staff-avatar-catalog.json')return catalog;if(name==='@/lib/staffAvatar')return schema;if(name==='next/server')return {NextResponse:{json:(body,options={})=>({body,status:options.status||200})}};if(name==='@/lib/portalAuth')return {getStaffIdentity:async()=>staff,portalDb:()=>({from(table){let data=table==='staff_accounts'?{initial:'M',color:'#5944bf',signature:'preserve'}:null;return {upsert(value){writes.push({table,value});return Promise.resolve({error:fail?Error('db'):null});},update(value){writes.push({table,value});this.value=value;return this;},eq(key,value){if(this.value)writes[writes.length-1].filter={key,value};return this;},select(){return this;},single(){return Promise.resolve({data,error:fail?Error('db'):null});}};}})};throw Error(name);},console});return mod.exports;}
const schema=load('lib/staffAvatar.ts'),avatar=load('app/api/staff/avatar/route.ts'),profile=load('app/api/staff/profile/route.ts');
const config={mode:'character',initial:'M',emoji:'😊'};for(const [k,v] of Object.entries(catalog))config[k]=Object.keys(v.items)[0];
const req=x=>({json:async()=>x});
(async()=>{
 const legacy={...config};for(const [k,v] of Object.entries(catalog))if(v.default)delete legacy[k];assert(schema.validAvatar(legacy)); assert(schema.validAvatar(config));assert.equal(Object.values(catalog).filter(x=>x.season).reduce((n,x)=>n+Object.keys(x.items).filter(k=>k!=='none').length,0),44);
 for(const [k,entry] of Object.entries(catalog))for(const option of Object.keys(entry.items))assert(schema.validAvatar({...config,[k]:option}),k+option);
 for(const bad of [null,[],{...config,initial:'<script>'},{...config,seasonHat:'remote-svg'},{...config,owner:'other'},{...config,thumbnail:'data:image/svg+xml,<svg/>'},{...config,skin:'not-an-option'}])assert.equal(schema.validAvatar(bad),false);
 const props=Object.entries(catalog).filter(([k,v])=>v.prop);const five={...config};props.slice(0,5).forEach(([k,v])=>five[k]=Object.keys(v.items).find(x=>x!=='none'));assert.equal(schema.avatarPropCount(five),5);assert.equal((await avatar.PUT(req(five))).status,200);const six={...five};six[props[5][0]]=Object.keys(props[5][1].items).find(x=>x!=='none');assert.equal((await avatar.PUT(req(six))).status,400);
 assert.equal((await avatar.PUT(req(config))).status,200);assert.equal(writes[0].value.key,'staff_avatar:own-id');
 staff=null;assert.equal((await avatar.PUT(req(config))).status,403);assert.equal((await profile.PATCH(req({signature:'x'}))).status,403);
 staff={id:'own-id',role:'guest'};assert.equal((await avatar.PUT(req(config))).status,403);
 staff={id:'own-id',role:'korean_admin'};assert.equal((await profile.PATCH(req({signature:'updated'}))).status,200);assert.deepEqual(writes.at(-1).filter,{key:'id',value:'own-id'});assert.equal(writes.at(-1).value.color,undefined);
 for(const b of [null,42,'bad',[],{id:'other'},{color:'red'},{signature:4},{initial:'<x>'}])assert.equal((await profile.PATCH(req(b))).status,400);
 fail=true;assert.equal((await avatar.PUT(req(config))).status,503);assert.equal((await profile.PATCH(req({signature:'keep'}))).status,503);
 console.log('PASS: 44 seasonal items, every catalog choice, malformed inputs, identity scope, partial profile preservation, auth failures and database failures');
})().catch(e=>{console.error(e);process.exitCode=1;});

