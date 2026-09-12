export function staffDestination(role:string,next:unknown):string{
 const fallback=role==='korean_admin'?'/admin/hub':'/admineng/hub';
 if(typeof next!=='string'||!next.startsWith('/')||next.startsWith('//')||/[\\\u0000-\u001f]/.test(next))return fallback;
 try{
  const u=new URL(next,'https://staff.invalid');
  if(u.origin!=='https://staff.invalid')return fallback;
  const allowed=role==='korean_admin'?u.pathname.startsWith('/admin/')||u.pathname==='/staff/students'||u.pathname==='/staff/student-review':u.pathname.startsWith('/admineng/')||u.pathname==='/staff/students';
  if(!allowed)return fallback;
  if(u.pathname==='/admin/view'){
   const src=u.searchParams.get('src')||'/staff';
   if(!src.startsWith('/')||src.startsWith('//')||/[\\\u0000-\u001f]/.test(src))return fallback;
   if(new URL(src,'https://staff.invalid').pathname==='/admin/view')return fallback;
  }
  return u.pathname+u.search+u.hash;
 }catch{return fallback;}
}
