const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const root = path.resolve(__dirname, '..');
function load(file, exports = '') {
  const source = fs.readFileSync(path.join(root, file), 'utf8') + exports;
  const code = ts.transpileModule(source, {compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const mod = {exports:{}};
  const localRequire = name => name === '@/lib/mealMenuDates' ? dates : name.startsWith('@/') || name === 'next/navigation' ? {} : require(name);
  new Function('require','module','exports',code)(localRequire,mod,mod.exports);
  return mod.exports;
}
const dates = load('lib/mealMenuDates.ts');
const rows = numbers => numbers.map(date=>({date,weekday:'오인식',lunch:['원본 메뉴'],breakfast:[],dinner_adult:[],dinner_child:[]}));
for (const [start, input, expected] of [
  ['2026-09-28',[28,29,30,1,2],['2026/9/28 월','2026/9/29 화','2026/9/30 수','2026/10/1 목','2026/10/2 금']],
  ['2026-12-28',[30,31,1],['2026/12/30 수','2026/12/31 목','2027/1/1 금']],
  ['2028-02-28',[28,29,1,2,3],['2028/2/28 월','2028/2/29 화','2028/3/1 수','2028/3/2 목','2028/3/3 금']],
  ['2026-09-28',[1,2],['2026/10/1 목','2026/10/2 금']],
  ['2026-10-05',[5,7,9],['2026/10/5 월','2026/10/7 수','2026/10/9 금']],
]) {
  const data = rows(input), before = JSON.stringify(data);
  const result = dates.resolveMealDates(data,start);
  assert.deepEqual(result.map(d=>`${d.year}/${d.month}/${d.date} ${d.weekday}`),expected);
  assert.equal(JSON.stringify(data),before,'Must not mutate stored menu rows');
  assert.ok(result.every(d=>d.lunch[0]==='원본 메뉴'));
}
for(const [start, direction, expected] of [[new Date(2026,0,31),1,'2026-2-1'],[new Date(2026,2,31),-1,'2026-2-1'],[new Date(2026,11,31),1,'2027-1-1']]) {
  const date=dates.shiftMealPeriod(start,true,direction);
  assert.equal(`${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`,expected);
}
const portal=load('app/portal/meal-menu/page.tsx','\nexport { DreamhouseCards };');
const admin=load('app/admin/meal-plan/MealMenuPublish.tsx','\nexport { MealCardPreview };');
for(const [Component, props] of [[portal.DreamhouseCards,{}],[admin.MealCardPreview,{year:2026,month:9,isAcademy:false}]]) {
  const html=renderToStaticMarkup(React.createElement(Component,{days:rows([28,29,30,1,2]),startDate:'2026-09-28',...props}));
  assert.ok(html.includes('9/30 (수)'));
  assert.ok(html.includes('10/1 (목)'));
  assert.ok(html.includes('10/2 (금)'));
  assert.ok(!html.includes('9/1 ('));
  assert.equal((html.match(/원본 메뉴/g)||[]).length,5);
}
console.log('PASS: month/year boundaries, leap day, missing rows, menu preservation, month navigation, guest/admin rendered headers');
