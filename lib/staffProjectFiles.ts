import {getStaffIdentity,portalDb} from '@/lib/portalAuth';
export async function projectFileAccess(req:Request,project:string){
 const staff=await getStaffIdentity(req);
 if(!staff)throw Object.assign(Error('직원 로그인이 필요합니다.'),{status:401});
 if(!['korean_admin','korean_staff'].includes(staff.role))throw Object.assign(Error('권한이 없습니다.'),{status:403});
 const db=portalDb(),author=staff.username.replace(/^admin-/,'');
 if(!project||project.length>160)throw Object.assign(Error('프로젝트를 확인해주세요.'),{status:400});
 const result=await db.from('staff_projects').select('id').eq('id',project).maybeSingle();
 if(result.error)throw result.error;
 if(!result.data)throw Object.assign(Error('프로젝트가 없습니다.'),{status:404});
 return {db,author};
}
