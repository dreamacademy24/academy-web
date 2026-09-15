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
console.log('10 published shuttle regression checks passed');
