const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('assert/strict');const cache={};function load(name){if(cache[name])return cache[name];const exports={};cache[name]=exports;vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>load(n.replace('./','')),Date,Set});return exports;}
const {getShSlots,SHUTTLE_PRESERVED_DATES,shuttleDescription}=load('shuttleTours');const {publishedShuttleSlots}=load('publishedShuttle');
for(const d of ['2026-12-02','2026-12-09'])assert(getShSlots(d)[0].route.includes('09:50 뉴타운'));
assert.equal(getShSlots('2026-12-08')[0].time,'10:30am');
assert(getShSlots('2026-12-19').some(s=>s.name.includes('안조')));
assert(getShSlots('2026-12-13').some(s=>s.name==='세부 쇼핑 & 펀 투어'));
assert(getShSlots('2027-02-13').some(s=>s.name==='세부 사파리'));
assert.equal(getShSlots('2027-01-16'),'holiday');
assert.equal(getShSlots('2026-12-26',new Set(['2026-12-26'])),'holiday');
assert(SHUTTLE_PRESERVED_DATES.has('2027-01-24'));
const rows=[{id:'x',date:'2026-12-12',title:'세부 쇼핑 & 펀 투어',description:'노선명: 세부 쇼핑 & 펀 투어\n노선: 14:00 드림센터 → 펀파크'}];
assert.equal(publishedShuttleSlots('2026-12-12',rows,new Set())[0].time,'2:00pm');
assert.equal(publishedShuttleSlots('2026-12-13',rows,new Set()).length,0);
const slots=getShSlots('2027-02-14');const published=slots.map((s,i)=>({id:String(i),date:'2027-02-14',title:s.name,description:shuttleDescription(s)}));assert.equal(publishedShuttleSlots('2027-02-14',published,new Set())[1].time,'2:00pm');
console.log('PASS final shuttle patterns, both Wednesday routes, holidays, preserved dates, published timing fallback');
