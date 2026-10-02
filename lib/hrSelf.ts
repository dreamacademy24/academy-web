import {getStaffIdentity} from '@/lib/portalAuth'
import {hrDb} from '@/lib/hrServer'
export async function currentStaffEmployee(req:Request){
 const staff=await getStaffIdentity(req);if(!staff||staff.role!=='local_teacher')return null
 const {data:a,error}=await hrDb.from('staff_accounts').select('username,hr_employee_id,must_change_pw').eq('id',staff.id).eq('is_active',true).maybeSingle();if(error)throw error
 if(!a?.hr_employee_id)return null
 const {data:e,error:ee}=await hrDb.from('hr_employees').select('id,company,name_display,first_name,last_name,employee_id,status').eq('id',a.hr_employee_id).eq('status','Active').maybeSingle();if(ee)throw ee
 return e?{username:a.username,role:'employee',employee_id:e.id,must_change_pw:!!a.must_change_pw,employee:e}:null
}

