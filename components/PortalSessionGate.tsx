"use client";
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { portalFetch } from '@/lib/portalFetch';

// Mount portal pages only after the active account's booking list has been refreshed.
export default function PortalSessionGate({children}:{children:React.ReactNode}) {
  const path=usePathname(),router=useRouter();
  const [ready,setReady]=useState(''),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{
    let live=true;
    if(path==='/portal'){setReady(path);return;}
    setError('');
    (async()=>{
      let old:any=null;
      try{old=JSON.parse(localStorage.getItem('portalSession')||'null');}catch{}
      if(old?.admin_view||new URLSearchParams(location.search).has('admin_view')){
        const response=await fetch('/api/staff/session',{method:'POST',cache:'no-store'});
        if(response.ok){if(live)setReady(path);return;}
      }
      const {data,error:authError}=await supabase.auth.getSession();
      if(authError)throw new Error('로그인을 확인하지 못했습니다. 다시 시도해주세요.');
      if(!data.session){localStorage.removeItem('portalSession');if(live)router.replace('/portal');return;}
      const response=await portalFetch('/api/portal/find-booking',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error('예약 정보를 불러오지 못했습니다. 다시 시도해주세요.');
      const result=await response.json();
      if(!live)return;
      const bookings=Array.isArray(result.bookings)?result.bookings:[];
      const selected=bookings.find((b:any)=>b.id===old?.booking_id)||bookings[0];
      if(!selected){
        localStorage.removeItem('portalSession');
        // 화상영어만 이용하는 회원은 숙소 예약 없이도 본인 수업과 비밀번호 화면을 이용한다.
        if(path==='/portal/dashboard'||path==='/portal/change-password'||path.startsWith('/portal/online-class')){setReady(path);return;}
        setError('로그인은 되었지만 연결된 예약이 없습니다. 아카데미에 기존 아이디와 예약 연결을 요청해주세요.');return;
      }
      localStorage.setItem('portalSession',JSON.stringify({
        booking_id:selected.id,booking_number:selected.reservation_no,guest_name:selected.booker_name,
        check_in_date:selected.checkin_date,status:selected.status,bookings,
        auth_type:'supabase',auth_user_id:data.session.user.id,expires:Date.now()+86400000,
      }));
      setReady(path);
    })().catch(()=>{if(live)setError('예약 정보를 확인하지 못했습니다. 다시 시도해주세요.');});
    return()=>{live=false;};
  },[path,retry,router]);
  if(path==='/portal'||ready===path&&!error)return <>{children}</>;
  return <main style={{maxWidth:520,margin:'48px auto',padding:24,background:'white',borderRadius:16,lineHeight:1.7}}>
    <h2>{error?'예약 연결 확인':'예약 정보를 확인하고 있습니다'}</h2>
    {error&&<><p>{error}</p><button onClick={()=>setRetry(x=>x+1)}>다시 확인</button> <button onClick={async()=>{await supabase.auth.signOut();localStorage.removeItem('portalSession');location.assign('/portal');}}>다른 아이디로 로그인</button></>}
  </main>;
}

