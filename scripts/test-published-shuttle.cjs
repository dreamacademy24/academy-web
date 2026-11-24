const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const cache = {};
function load(file) {
  file = path.resolve(file);
  if (cache[file]) return cache[file].exports;
  const mod = { exports: {} }; cache[file] = mod;
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'module', 'exports', code)(name => name.startsWith('.') ? load(path.resolve(path.dirname(file), name + '.ts')) : require(name), mod, mod.exports);
  return mod.exports;
}
const { publishedShuttleSlots: slots } = load('lib/publishedShuttle.ts');
const rows = [
  { id: '1', date: '2026-09-26', title: '안조 월드 (Anjo World)', description: '출발 1:00pm · 복귀 20:00' },
  { id: '2', date: '2026-09-27', title: '펀파크 (Fun Park)', description: '02:00pm' },
];
assert.deepEqual(slots('2026-09-26', rows, new Set()).map(s => s.name), ['안조 월드 (Anjo World)']);
assert.equal(slots('2026-09-26', rows, new Set())[0].time, '1:00pm');
assert.equal(slots('2026-09-26', rows, new Set())[0].return, '20:00');
assert.equal(slots('2026-09-27', rows, new Set())[0].return, '20:00');
assert.deepEqual(slots('2026-09-25', rows, new Set()), [], 'removed dates in a published month stay removed');
assert.equal(slots('2026-09-26', rows, new Set(['2026-09-26'])), 'holiday');
assert.equal(slots('2026-11-30', [], new Set()), 'holiday');
assert.notEqual(slots('2026-11-27', [], new Set()), 'holiday');
assert.ok(slots('2026-10-01', rows, new Set()).length, 'unpublished legacy months retain their existing schedule');
assert.equal(slots('2026-09-26', [{...rows[0], title: '추가 장소', description: '출발 15:00 · 복귀 17:00'}], new Set())[0].return, '17:00');
const { getShSlots, SHUTTLE_SPECIAL_MSG } = load('lib/shuttleTours.ts');
for (const date of ['2027-01-16', '2027-01-17']) {
  assert.equal(getShSlots(date), 'holiday');
  assert.equal(slots(date, [], new Set()), 'holiday');
  assert.equal(slots(date, [{...rows[0], date}], new Set()), 'holiday', 'closure overrides published slots');
  assert.match(SHUTTLE_SPECIAL_MSG[date], /축제로 인한 도로 통제/);
}
assert.notEqual(getShSlots('2027-01-15'), 'holiday');
assert.notEqual(getShSlots('2027-01-18'), 'holiday');
console.log('20 published shuttle regression checks passed');
const {routeDescription}=load('lib/shuttleRoute.ts');
for(const date of ['2026-12-02','2026-12-04','2026-12-07']){
 const s=slots(date,[{id:'route',date,title:'H-Mart 쇼핑',description:routeDescription(date)}],new Set())[0];
 assert.equal(s.name,'H-Mart 쇼핑','application key stays stable');
 assert.equal(s.displayName,'뉴타운');assert.equal(s.time,'09:30am');assert.equal(s.return,'드림센터');
 assert.match(s.route,date==='2026-12-02'?/11:10 NUU카페/:/09:50 뉴타운 버스정류장/);
}
assert.equal(getShSlots('2026-11-27')[0].time,'10:00am');
assert.equal(getShSlots('2027-04-02')[0].displayName,'뉴타운');
assert.equal(slots('2026-12-02',[{id:'edit',date:'2026-12-02',title:'H-Mart 쇼핑',description:'출발 09:45 · 복귀 드림센터\n노선명: 수정 노선\n노선: 09:45 출발 → 정차'}],new Set())[0].time,'09:45');
console.log('Route display, exact times, historical dates, future templates and stable request key checks passed');
