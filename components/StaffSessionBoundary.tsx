'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {clearStoredStaffIdentity,openStaffSignIn,storeVerifiedStaff} from '@/lib/staffSessionClient';
export default function StaffSessionBoundary({children,requiredRole}:{children:React.ReactNode;requiredRole?:string}){
 const [state,setState]=useState<'loading'|'ready'|'signin'|'error'|'forbidden'>('loading');
 const [connectionError,setConnectionError]=useState(false);
 const running=useRef(false);
 const check=useCallback(async()=>{
  if(running.current)return;running.current=true;
  try{
   const response=await fetch('/api/staff/session',{method:'POST',credentials:'same-origin',cache:'no-store'});
   if(response.status===401){clearStoredStaffIdentity();setState('signin');return;}
   if(response.status===403){setState('forbidden');return;}
   if(!response.ok){setConnectionError(true);setState(s=>s==='ready'?'ready':'error');return;}
   const {staff}=await response.json();
   storeVerifiedStaff(staff);
   setConnectionError(false);
   setState(requiredRole&&staff.role!==requiredRole?'forbidden':'ready');
  }catch{setConnectionError(true);setState(s=>s==='ready'?'ready':'error');}finally{running.current=false;}
 },[requiredRole]);
 useEffect(()=>{
  void check();
  const visible=()=>{if(document.visibilityState==='visible')void check();};
  const timer=setInterval(visible,4*60*1000);
  window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);
  return()=>{clearInterval(timer);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};
 },[check]);
 if(state==='ready')return <>{connectionError&&<p role="status" style={{padding:12,background:'#fff7df'}}>로그인 서버 연결을 다시 확인하고 있습니다. / Checking connection. <button onClick={()=>void check()}>다시 확인 / Retry</button></p>}{children}</>;
 return <section style={{maxWidth:620,margin:'60px auto',padding:28,lineHeight:1.8,fontFamily:'Arial, sans-serif',color:'#243b53'}}>
  <h2>{state==='loading'?'로그인 확인 중 · Checking sign-in':state==='signin'?'로그인 연결이 필요합니다 · Sign in':state==='forbidden'?'접근 권한 확인 · Access restricted':'서버 연결 확인 · Connection unavailable'}</h2>
  <p role={state==='error'?'alert':'status'}>{state==='signin'?'이 브라우저의 서버 로그인이 만료되었거나 연결되지 않았습니다. 로그인하면 지금 보던 화면으로 돌아옵니다. / Sign in to return to this page.':state==='error'?'일시적으로 로그인 서버에 연결하지 못했습니다. 아래 버튼으로 다시 확인해주세요. / Please retry; this is not a sign-out.':state==='forbidden'?'현재 계정에서 사용할 수 없는 화면입니다. / This page is not available for this account.':'잠시만 기다려주세요. / Please wait.'}</p>
  {state==='signin'&&<button onClick={openStaffSignIn}>로그인하고 돌아오기 / Sign in and return</button>}
  {state==='error'&&<button onClick={()=>void check()}>다시 확인 / Retry</button>}
  {state==='forbidden'&&<button onClick={openStaffSignIn}>내 홈으로 / My home</button>}
 </section>;
}
