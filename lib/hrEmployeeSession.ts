import { hrSessionFromReq } from './hrAuth'
import { hrDb } from './hrServer'
export async function currentEmployee(req:Request){
 const token=hrSessionFromReq(req);if(!token||token.role!=='employee')return null
 const {data:a,error}=await hrDb.from('hr_accounts').select('username,role,employee_id,is_active,must_change_pw').eq('username',token.username).maybeSingle()
 if(error)throw error
 if(!a?.is_active||a.role!=='employee'||!a.employee_id||!/^[0-9a-f-]{36}$/i.test(a.employee_id))return null
 const {data:e,error:ee}=await hrDb.from('hr_employees').select('id,company,name_display,first_name,last_name,employee_id,status').eq('id',a.employee_id).maybeSingle()
 if(ee)throw ee
 return e?.status==='Active'?{...a,employee:e}:null
}
