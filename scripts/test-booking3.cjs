const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}) {
  const filename = path.join(root, file), module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const req = name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('@/')) return load(name.slice(2) + '.ts', mocks);
    if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), name)) + '.ts', mocks);
    return require(name);
  };
  vm.runInNewContext(code, { module, exports: module.exports, require: req, process, Buffer, console, Date, Request, Response, Headers, URL, Set }, { filename });
  return module.exports;
}
const rules = load('lib/booking3.ts');
const valid = () => ({ ...rules.booking3Initial(), guardian: '테스트 보호자', phone: '010-0000-0000', student: '테스트 학생', englishName: 'Test Student', birthYear: '2018', startDate: '2027-03-02', privacy: true, rules: true });
let passed = 0;
async function test(name, run) { await run(); passed++; console.log('PASS ' + name); }
(async () => {
  await test('All 12 plans compute paid and bonus sessions separately', () => {
    for (const weekly of [2,3,5]) for (const months of [1,2,3,6]) {
      const quote = rules.booking3Quote(weekly, months);
      assert.equal(quote.paidSessions, weekly * months * 4);
      assert.equal(quote.bonusSessions, weekly * (months === 6 ? 4 : months === 3 ? 2 : 0));
      assert.equal(quote.totalSessions, quote.paidSessions + quote.bonusSessions);
      assert.equal(quote.amount, rules.BOOKING3_PRICES[weekly] * months);
    }
  });
  await test('Invalid plans rejected', () => { for (const [w,m] of [[4,1],[3,0],[3,12],[2,-1]]) assert.throws(() => rules.booking3Quote(w,m)); });
  await test('Only current weekday hours accepted', () => {
    assert.equal(rules.validateBooking3(valid(), '2026-09-14').weekly,3);
    for (const days of [['월','수','토'],['월','월','수'],['월','수']]) assert.throws(() => rules.validateBooking3({ ...valid(), days }, '2026-09-14'));
    for (const time of ['12:00','22:00','19:15']) assert.throws(() => rules.validateBooking3({ ...valid(), dayTimes: { 월:time,수:time,금:time } }, '2026-09-14'));
  });
  await test('Date, contact and consent validation', () => {
    for (const diff of [{startDate:'2026-02-30'}, {startDate:'2026-01-01'}, {startDate:'nonsense'}, {phone:'123'}, {birthYear:'99'}, {privacy:false}, {rules:false}, {notes:'x'.repeat(1501)}]) assert.throws(() => rules.validateBooking3({ ...valid(), ...diff }, '2026-09-14'));
  });
  await test('Forged totals and extra fields ignored', () => { const value=rules.validateBooking3({...valid(), totalSessions:999,amount:1,customer_user_id:'foreign'},'2026-09-14');assert.equal(value.totalSessions,undefined);assert.equal(value.customer_user_id,undefined); });
  const requests=[];
  let rpcError=null;
  const mocks={ '@/lib/portalAuth': { portalUser:async()=>null, portalDb:()=>({rpc:async(name,args)=>{requests.push(args);return{data:'receipt-id',error:rpcError};}}) } };
  const api=load('app/api/booking3/route.ts',mocks);
  const request=(body,origin='https://www.dreamacademyph.com')=>new Request('https://www.dreamacademyph.com/api/booking3',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
  const body=()=>({requestKey:require('node:crypto').randomUUID(),form:valid()});
  process.env.SUPABASE_SERVICE_ROLE_KEY='unit-test-only-not-a-real-key';
  await test('Submission recomputes quote and returns no credentials',async()=>{const r=await api.POST(request({...body(),quote:{totalSessions:999}}));assert.equal(r.status,200);const data=await r.json();assert.equal(data.quote.totalSessions,12);assert.equal(data.password,undefined);assert.equal(requests.at(-1).p_quote.totalSessions,12);});
  await test('Claiming existing account needs real login before any write',async()=>{const before=requests.length;assert.equal((await api.POST(request({...body(),useExisting:true}))).status,401);assert.equal(requests.length,before);});
  await test('Cross-origin submission blocked',async()=>assert.equal((await api.POST(request(body(),'https://other.example'))).status,403));
  await test('Idempotency conflict and rate limit are explicit',async()=>{rpcError={message:'REQUEST_CONFLICT'};assert.equal((await api.POST(request(body()))).status,409);rpcError={message:'RATE_LIMIT'};assert.equal((await api.POST(request(body()))).status,429);rpcError=null;});
  await test('Database failure never reports success',async()=>{rpcError={message:'unavailable'};assert.equal((await api.POST(request(body()))).status,503);rpcError=null;});
  const server=load('lib/booking3Server.ts',{'./portalAuth':{}});
  await test('Temporary password authenticated encryption roundtrip and tamper protection',()=>{const value=server.encryptBooking3Password('random-test-password');assert.equal(server.decryptBooking3Password(value),'random-test-password');assert.ok(!value.includes('random-test-password'));const bad=Buffer.from(value,'base64');bad[bad.length-1]^=1;assert.throws(()=>server.decryptBooking3Password(bad.toString('base64')));});
  const admin=load('app/api/admin/booking3/route.ts',{'@/lib/portalAuth':{isPortalAdmin:async()=>false},'@/lib/booking3Server':{issueBooking3:()=>{throw Error('must not execute');}}});
  await test('Admin list and account issuance require staff authentication',async()=>{assert.equal((await admin.GET(request(body()))).status,401);assert.equal((await admin.POST(request(body()))).status,401);});
  console.log(`${passed} tests passed`);
})().catch(e=>{console.error(e);process.exitCode=1;});
