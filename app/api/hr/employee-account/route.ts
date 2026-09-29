import { randomBytes } from 'crypto'
import { currentHr,hrDb,hrError } from '@/lib/hrServer'
export async function POST(req:Request){try{
 const s=await currentHr(req);if(!s?.full)return Response.json({error:'Central HR access required'},{status:403})
 const b=await req.json();if(typeof b.employee_id!=='string'||!/^[0-9a-f-]{36}$/i.test(b.employee_id))return Response.json({error:'Invalid employee'},{status:400})
 const {data:e,error}=await hrDb.from('hr_employees').select('id,status').eq('id',b.employee_id).maybeSingle();if(error)throw error;if(e?.status!=='Active')return Response.json({error:'Active employee required'},{status:400})
 const username='emp-'+e.id.slice(0,8),password=randomBytes(12).toString('base64url')
 const {error:err}=await hrDb.rpc('hr_create_employee_account',{p_username:username,p_password:password,p_employee:e.id})
 if(err)return Response.json({error:'An account may already exist. Check with HR before creating another. / 계정이 이미 있는지 확인해주세요.'},{status:409})
 return Response.json({username,password,url:'/admin/HR',message:'Share privately with this employee. Password change is required at first sign-in.'},{headers:{'Cache-Control':'no-store'}})
 }catch(e){return hrError(e)}}
