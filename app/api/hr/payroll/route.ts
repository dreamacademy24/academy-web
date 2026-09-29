import { currentHr,hrDb,hrError } from '@/lib/hrServer'
import { currentEmployee } from '@/lib/hrEmployeeSession'
import { payrollPeriod,validateDays,cleanAmounts,totals } from '@/lib/hrPayroll'
import { displayName } from '@/lib/hr'
export const dynamic='force-dynamic'
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}})
export async function GET(req:Request){try{
 const admin=await currentHr(req),self=admin?null:await currentEmployee(req)
 if(!admin&&!self)return reply({error:'Sign in required'},401)
 const u=new URL(req.url),month=u.searchParams.get('month')||'',day=Number(u.searchParams.get('day'))
 const period=payrollPeriod(month,day)
 let q=hrDb.from('hr_payroll_entries').select('*').eq('pay_date',period.pay_date)
 q=admin?q.in('company',admin.companies):q.eq('employee_id',self!.employee.id)
 const {data:entries,error}=await q;if(error)throw error
 let employees:any[]=[]
 if(admin){const {data,error}=await hrDb.from('hr_employees').select('id,company,employee_id,name_display,first_name,last_name,status,salary_type,basic_salary,allow_position,allow_transpo,allow_tutorial,allow_load').in('company',admin.companies).order('last_name');if(error)throw error;employees=data||[]}
 else employees=[self!.employee]
 // Unfinalized salary figures are not published to employees.
 const safe=(entries||[]).map(e=>self&&e.pay_status!=='finalized'?{...e,amounts:{},payroll_note:''}:e)
 return reply({period,entries:safe,employees,reviewer:!!admin?.full,self:!!self,must_change_pw:!!self?.must_change_pw})
 }catch(e){if(e instanceof Error&&e.message.startsWith('Invalid'))return reply({error:e.message},400);return hrError(e)}}
export async function POST(req:Request){try{
 const admin=await currentHr(req),self=admin?null:await currentEmployee(req)
 if(!admin&&!self)return reply({error:'Sign in required'},401)
 if(self?.must_change_pw)return reply({error:'Change your temporary password first.'},403)
 const b=await req.json(),period=payrollPeriod(b.month,Number(b.day)),id=admin?b.employee_id:self!.employee.id
 if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))return reply({error:'Invalid employee'},400)
 let eq=hrDb.from('hr_employees').select('*').eq('id',id);if(admin)eq=eq.in('company',admin.companies)
 const {data:emp,error:ee}=await eq.maybeSingle();if(ee)throw ee;if(!emp)return reply({error:'Employee unavailable'},404)
 const {data:old,error:oe}=await hrDb.from('hr_payroll_entries').select('*').eq('employee_id',id).eq('pay_date',period.pay_date).maybeSingle();if(oe)throw oe
 if(old&&admin&&!admin.companies.includes(old.company))return reply({error:'Company unavailable'},403)
 if(old&&old.version!==b.version)return reply({error:'This record changed. Reload before saving. / 다른 변경이 있습니다. 다시 불러와주세요.'},409)
 if(old?.pay_status==='finalized')return reply({error:'Finalized payroll is locked. / 확정된 급여는 잠겨 있습니다.'},409)
 const patch:any={actor:admin?.username||self!.username,version:(old?.version||0)+1,updated_at:new Date().toISOString()}
 const now=new Date().toISOString()
 if(['save_time','submit'].includes(b.action)){
  if(emp.status!=='Active')return reply({error:'Only active employees can submit.'},400)
  if(old&&['submitted','approved'].includes(old.time_status))return reply({error:'Ask Abby to return this timecard before editing.'},409)
  patch.days=validateDays(b.days,period.dates,b.action==='submit');patch.time_status=b.action==='submit'?'submitted':'draft';patch.submitted_at=b.action==='submit'?now:null
  patch.reviewed_at=null;patch.reviewed_by=null;patch.review_note=''
 }else if(['approve','return'].includes(b.action)){
  if(!admin?.full)return reply({error:'Abby / central HR review is required.'},403)
  if(!old||!['submitted','approved'].includes(old.time_status))return reply({error:'Submit the timecard before review.'},409)
  if(typeof b.note!=='string'||b.note.length>2000||(b.action==='return'&&!b.note.trim()))return reply({error:'Enter a review note.'},400)
  if(b.action==='approve')validateDays(old.days,period.dates,true)
  patch.time_status=b.action==='approve'?'approved':'returned';patch.reviewed_at=now;patch.reviewed_by=admin.username;patch.review_note=b.note.trim()
 }else if(['save_pay','finalize'].includes(b.action)){
  if(!admin)return reply({error:'HR access required'},403)
  patch.amounts=cleanAmounts(b.amounts);if(typeof b.note!=='string'||b.note.length>3000)return reply({error:'Invalid note'},400);patch.payroll_note=b.note.trim()
  if(b.action==='finalize'){
   if(!admin.full)return reply({error:'Central HR approval required'},403)
   if(old?.time_status!=='approved'||b.confirmed!==true||totals(patch.amounts).net<0)return reply({error:'Approve the timecard and confirm amounts before finalizing.'},400)
   patch.pay_status='finalized';patch.finalized_at=now;patch.finalized_by=admin.username
  }
 }else return reply({error:'Unknown action'},400)
 let result
 if(old)result=await hrDb.from('hr_payroll_entries').update(patch).eq('id',old.id).eq('version',old.version).select('id').maybeSingle()
 else result=await hrDb.from('hr_payroll_entries').insert({employee_id:id,company:emp.company,employee_name:displayName(emp),employee_number:emp.employee_id,pay_date:period.pay_date,period_start:period.start,period_end:period.end,...patch}).select('id').single()
 if(result.error?.code==='23505'||(!result.error&&!result.data))return reply({error:'Another save occurred. Reload and retry.'},409)
 if(result.error)throw result.error
 return reply({ok:true})
 }catch(e){if(e instanceof SyntaxError)return reply({error:'Invalid request'},400);if(e instanceof Error&&/Invalid|Check|Complete|Clear/.test(e.message))return reply({error:e.message},400);return hrError(e)}}
