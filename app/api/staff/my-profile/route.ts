import {currentStaffEmployee} from '@/lib/hrSelf'
import {hrDb,hrError} from '@/lib/hrServer'
import {SELF_EDITABLE,SELF_READONLY} from '@/lib/hrSelfFields'
export const dynamic='force-dynamic'
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}})
export async function GET(req:Request){try{
 const self=await currentStaffEmployee(req);if(!self)return reply({error:'Your staff login is not linked to an active HR profile. Ask Abby or Bella to link it in HR → Employee → Staff login.'},403)
 const e=await hrDb.from('hr_employees').select([...SELF_EDITABLE,...SELF_READONLY].join(',')).eq('id',self.employee.id).single();if(e.error)throw e.error
 const settings=await hrDb.from('hr_payroll_settings').select('rules').eq('company',self.employee.company).maybeSingle();if(settings.error)throw settings.error;return reply({employee:e.data,pay_items:settings.data?.rules||[],must_change_pw:self.must_change_pw})
 }catch(e){return hrError(e)}}
export async function PATCH(req:Request){try{
 const self=await currentStaffEmployee(req);if(!self)return reply({error:'Employee access required'},403)
 if(self.must_change_pw)return reply({error:'Change your temporary password from the staff hub first.'},403)
 const body=await req.json();if(!body||typeof body!=='object'||!body.values||typeof body.values!=='object'||Array.isArray(body.values)||typeof body.updated_at!=='string')return reply({error:'Invalid profile'},400)
 const patch:Record<string,unknown>={};for(const [key,value]of Object.entries(body.values)){
  if(!SELF_EDITABLE.includes(key as typeof SELF_EDITABLE[number]))return reply({error:'This field can only be changed by HR.'},403)
  if(typeof value!=='string'||value.length>500)return reply({error:'Invalid profile value'},400)
  if(['first_name','last_name'].includes(key)&&!value.trim())return reply({error:'First and last name are required.'},400)
  if(key==='date_of_birth'&&value&&!/^\d{4}-\d{2}-\d{2}$/.test(value))return reply({error:'Invalid date of birth'},400)
  if(key==='personal_email'&&value&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))return reply({error:'Check your email address'},400)
  patch[key]=value.trim()||null
 }
 patch.updated_at=new Date().toISOString()
 const r=await hrDb.from('hr_employees').update(patch).eq('id',self.employee.id).eq('status','Active').eq('updated_at',body.updated_at).select('id').maybeSingle();if(r.error)throw r.error;if(!r.data)return reply({error:'Your profile changed. Reload before saving again.'},409)
 return reply({ok:true})
 }catch(e){return e instanceof SyntaxError?reply({error:'Invalid request'},400):hrError(e)}}


