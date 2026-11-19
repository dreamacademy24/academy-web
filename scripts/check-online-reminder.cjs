const fs=require('fs'),ts=require('typescript'),path=require('path'),Module=require('module'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {pendingOnlineApplications:pending}=require('../lib/onlineApplicationReminder.ts');
const b={id:'b',checkin_date:'2026-12-07',checkout_date:'2026-12-28',students:[{korName:'가'},{korName:'나'}]};
assert.equal(pending([b],[],[],'2026-10-06').length,0);
assert.equal(pending([b],[],[],'2026-10-07').length,2);
assert.equal(pending([{...b,status:'취소'}],[],[],'2026-11-19').length,0);
assert.equal(pending([{...b,portal_features:{online_class:false}}],[],[],'2026-11-19').length,0);
const e={id:'e',student_name:'가',enrollment_type:'free_package',status:'active',package_booking_id:'b'};
assert.deepEqual(pending([b],[e],[],'2026-11-19').map(x=>x.student),['나']);
assert.equal(pending([b],[{...e,package_booking_id:'old'}],[],'2026-11-19').length,2);
assert.equal(pending([b],[{...e,status:'cancelled'}],[],'2026-11-19').length,2);
assert.equal(pending([b],[{...e,portal_open:false}],[],'2026-11-19').length,1);
for(const f of ['app/portal/dashboard/page.tsx','components/OnlineApplicationReminder.tsx','app/api/portal/online-class/reminder/route.ts']) {
 const r=ts.transpileModule(fs.readFileSync(path.join(root,f),'utf8'),{fileName:f,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}});
 assert.equal(r.diagnostics.filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,f);
}
console.log('PASS: opening boundary, cancellation, override, siblings, previous stay, cancelled application, pending assignment, syntax');
if(process.argv.includes('--live')) (async()=>{
 const {createClient}=require('@supabase/supabase-js');const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
 const bs=await db.from('bookings').select('*').gte('checkin_date','2026-11-19').lte('checkin_date','2027-01-19');if(bs.error)throw bs.error;
 const es=await db.from('online_enrollments').select('id,customer_user_id,student_name,status,enrollment_type,package_booking_id,package_plan').range(0,999);if(es.error)throw es.error;
 const ss=await db.from('online_package_sources').select('booking_id,student_key,enrollment_id').range(0,999);if(ss.error)throw ss.error;
 const rows=bs.data.map(b=>({name:b.booker_name,date:b.checkin_date,account:!!b.portal_user_id,status:b.status,type:b.accom_type,students:b.students,features:b.portal_features,pending:pending([b],es.data.filter(e=>(b.portal_user_id && e.customer_user_id===b.portal_user_id)||e.package_booking_id===b.id),ss.data,'2026-11-19')}));
 console.log(JSON.stringify({eligibleBookings:rows.filter(x=>x.pending.length).length,pendingStudents:rows.reduce((n,x)=>n+x.pending.length,0),target:rows.filter(x=>x.name==='최혜선')},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});


