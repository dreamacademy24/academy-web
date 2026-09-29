import {currentHr,hrDb,hrError} from '@/lib/hrServer'
import {defaultRules,DEFAULT_POLICY,validateRules,validatePolicy,cleanValues} from '@/lib/hrPayRules'
export const dynamic='force-dynamic'
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}})
export async function GET(req:Request){try{
 const s=await currentHr(req);if(!s)return reply({error:'HR sign-in required'},401)
 const u=new URL(req.url),id=u.searchParams.get('employee');let company=u.searchParams.get('company'),employee=null
 if(id){const r=await hrDb.from('hr_employees').select('id,company,payroll_values,payroll_version,basic_salary,salary_type').eq('id',id).in('company',s.companies).maybeSingle();if(r.error)throw r.error;if(!r.data)return reply({error:'Employee not available'},404);employee=r.data;company=employee.company}
 if(!company||!s.companies.includes(company))return reply({error:'Company unavailable'},403)
 const {data,error}=await hrDb.from('hr_payroll_settings').select('*').eq('company',company).maybeSingle();if(error)throw error
 return reply({settings:data||{company,rules:defaultRules(),policy:DEFAULT_POLICY,version:0},employee,can_manage:s.full})
 }catch(e){return hrError(e)}}
export async function POST(req:Request){try{
 const s=await currentHr(req);if(!s?.full)return reply({error:'Abby, Bella or May can manage payroll settings.'},403)
 const b=await req.json()
 if(b.employee_id){const r=await hrDb.from('hr_employees').select('id,company,payroll_version').eq('id',b.employee_id).in('company',s.companies).maybeSingle();if(r.error)throw r.error;if(!r.data)return reply({error:'Employee unavailable'},404)
  const {data:settings,error}=await hrDb.from('hr_payroll_settings').select('rules').eq('company',r.data.company).maybeSingle();if(error)throw error
  const values=cleanValues(b.values,settings?.rules||defaultRules());if(r.data.payroll_version!==b.version)return reply({error:'Settings changed. Reload before saving.'},409)
  const saved=await hrDb.from('hr_employees').update({payroll_values:values,payroll_version:b.version+1,payroll_updated_by:s.username}).eq('id',b.employee_id).eq('payroll_version',b.version).select('id').maybeSingle();if(saved.error)throw saved.error;if(!saved.data)return reply({error:'Settings changed. Reload.'},409)
 }else{
  if(!s.companies.includes(b.company))return reply({error:'Company unavailable'},403)
  const rules=validateRules(b.rules),policy=validatePolicy(b.policy)
  const {data:old,error}=await hrDb.from('hr_payroll_settings').select('version,rules').eq('company',b.company).maybeSingle();if(error)throw error
  if((old?.version||0)!==b.version)return reply({error:'Settings changed. Reload before saving.'},409)
  // Disable old items instead of removing stable IDs used by employee overrides and saved payroll.
  if(old?.rules.some((r:any)=>!rules.some(n=>n.id===r.id)))return reply({error:'Disable existing items instead of deleting them.'},400)
  const payload={company:b.company,rules,policy,version:b.version+1,updated_by:s.username,updated_at:new Date().toISOString()}
  const saved=old?await hrDb.from('hr_payroll_settings').update(payload).eq('company',b.company).eq('version',b.version).select('company').maybeSingle():await hrDb.from('hr_payroll_settings').insert(payload).select('company').single()
  if(saved.error?.code==='23505'||(!saved.error&&!saved.data))return reply({error:'Settings changed. Reload.'},409);if(saved.error)throw saved.error
 }return reply({ok:true})
 }catch(e){if(e instanceof Error&&/Invalid|Check|Basic|Too many/.test(e.message))return reply({error:e.message},400);return hrError(e)}}

