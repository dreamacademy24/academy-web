const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');
const path=require('path');
function load(file){const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const mod={exports:{}};new Function('exports','require','module',code)(mod.exports,id=>id.startsWith('.')?load(path.resolve(path.dirname(file),id+'.ts')):require(id),mod);return mod.exports;}
const {pickupMovements,airportFromBookings}=load('lib/vehicleSchedule.ts');
const source={id:'extra',request_type:'extra_pickup',request_date:'2026-11-20',request_time:'00:45',location:'부산',destination:'드림하우스',flight_info:'BX655'};
assert.equal(pickupMovements([source])[0].date,'2026-11-19');
assert.match(pickupMovements([source])[0].note,/2026-11-20 00:45/);
assert.equal(pickupMovements([{...source,request_time:'14:00'}])[0].date,'2026-11-20');
assert.equal(pickupMovements([{...source,flight_info:null}])[0].date,'2026-11-20');
assert.equal(pickupMovements([{...source,request_date:'2026-11-19',notes:'[야간 운영일 2026-11-19] 다음 날 2026-11-20 00:45 도착편'}])[0].date,'2026-11-19');
assert.equal(pickupMovements([{...source,request_time:'',flight_info:'KE601'}])[0].date,'2026-11-20');
const kim=airportFromBookings([{id:'kim',booker_name:'김두선',house_no:'B16L19',flight_in_date:'2026-11-21',flight_in_time:'22:20',flight_in:'대한항공 KE601 2026-11-21 22:20'}],[]).find(x=>x.id==='bk_in_kim');
assert.equal(kim.time,'22:20');assert.equal(kim.date,'2026-11-21');
console.log('PASS: overnight, arrival time, existing annotations, daytime and non-airport cases');
