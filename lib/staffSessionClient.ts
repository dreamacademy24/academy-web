import {setAdminAuthed} from './adminAuth';
type Staff={username:string;name:string;role:string};
export function clearStoredStaffIdentity(){
 for(const key of ['adminToken','adminInfo','teacherSession'])localStorage.removeItem(key);
}
export function storeVerifiedStaff(staff:Staff){
 clearStoredStaffIdentity();
 if(staff.role==='korean_admin')setAdminAuthed(staff.username,{role:staff.role,name:staff.name,staffId:staff.username});
 else localStorage.setItem('teacherSession',JSON.stringify(staff));
}
export function openStaffSignIn(){
 let target:Window=window;
 try{if(window.top&&window.top.location.origin===window.location.origin)target=window.top;}catch{}
 const next=target.location.pathname+target.location.search+target.location.hash;
 target.location.assign('/login?next='+encodeURIComponent(next));
}
