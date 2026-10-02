import {currentHr,hrDb,hrError} from '@/lib/hrServer'
export const dynamic='force-dynamic'
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}})
const validId=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
export async function GET(req:Request){try{
 const s=await currentHr(req);if(!s?.full)return reply({error:'Central HR access required'},403)
 const id=new URL(req.url).searchParams.get('employee');if(!validId(id))return reply({error:'Invalid employee'},400)
 const e=await hrDb.from('hr_employees').select('id').eq('id',id).in('company',s.companies).maybeSingle();if(e.error)throw e.error;if(!e.data)return reply({error:'Employee unavailable'},404)
 const a=await hrDb.from('staff_accounts').select('username,is_active,issued_at,issued_by').eq('hr_employee_id',id).maybeSingle();if(a.error)throw a.error
 return reply({account:a.data})
 }catch(e){return hrError(e)}}
export async function POST(req:Request){try{
 const s=await currentHr(req);if(!s?.full)return reply({error:'Central HR access required'},403)
 const b=await req.json(),username=typeof b.username==='string'?b.username.trim().toLowerCase():''
 if(!validId(b.employee_id)||!/^[a-z][a-z0-9._-]{2,29}$/.test(username)||username.startsWith('admin-'))return reply({error:'Use 3–30 letters/numbers for the login ID. / 아이디는 영문으로 시작하는 3~30자로 입력해주세요.'},400)
 const e=await hrDb.from('hr_employees').select('id,status').eq('id',b.employee_id).in('company',s.companies).maybeSingle();if(e.error)throw e.error;if(!e.data)return reply({error:'Employee unavailable'},404);if(e.data.status!=='Active')return reply({error:'Active employee required / 재직 직원만 발급할 수 있습니다.'},400)
 const result=await hrDb.rpc('hr_issue_local_staff_account',{p_employee:b.employee_id,p_username:username,p_actor:s.username})
 if(result.error){if(result.error.code==='23505')return reply({error:'An account or this login ID already exists. No password was changed. / 이미 발급했거나 사용 중인 아이디입니다. 기존 비밀번호는 변경하지 않았습니다.'},409);throw result.error}
 return reply({account:result.data,password:username.toUpperCase()+'2026!',url:'https://www.dreamacademyph.com/login'})
 }catch(e){return e instanceof SyntaxError?reply({error:'Invalid request'},400):hrError(e)}}

