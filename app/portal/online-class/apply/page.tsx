'use client';
import {useEffect,useRef,useState} from 'react';
import {portalFetch} from '@/lib/portalFetch';
import OnlinePackagePlanEditor,{type PackageMeta} from '@/components/OnlinePackagePlanEditor';
import {validatePackagePlan,buildPackageSchedule,type PackagePlan} from '@/lib/onlinePackagePlan';
import Booking3Guide from '@/components/Booking3Guide';

export default function ApplyOnlineClass(){
  const [meta,setMeta]=useState<PackageMeta|null>(null),[plan,setPlan]=useState<PackagePlan|null>(null);
  const [student,setStudent]=useState(''),[level,setLevel]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState(false),[guide,setGuide]=useState(false),[agreed,setAgreed]=useState(false);
  const key=useRef(''),generation=useRef(0);
  useEffect(()=>{key.current=crypto.randomUUID();},[]);
  useEffect(()=>{const run=++generation.current;setLoading(true);setError('');setPlan(null);setAgreed(false);
    const query=new URLSearchParams({student});const uid=new URLSearchParams(window.location.search).get('preview_uid');if(uid)query.set('uid',uid);
    portalFetch('/api/online-class/package-plan?'+query).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||'신청 정보를 불러오지 못했습니다.');if(run!==generation.current)return;setMeta(data);if(!student&&data.children.length===1)setStudent(data.children[0].name);else if(student)setPlan(data.plan);}).catch(e=>{if(run===generation.current)setError(e.message);}).finally(()=>{if(run===generation.current)setLoading(false);});
    return()=>{generation.current++;};
  },[student]);
  async function submit(){if(!meta||!plan||busy)return;setError('');setBusy(true);try{
    if(meta.admin)throw Error('관리자 미리보기입니다. 실제 신청은 손님 앱에서 진행해주세요.');
    if(!agreed)throw Error('총 회차와 연수 전·후 일정을 확인해주세요.');
    const checked=validatePackagePlan(plan,meta.bookings,false);buildPackageSchedule(checked,meta.bookings,meta.sessions,new Set(meta.holidays));
    const r=await portalFetch('/api/online-class/package-plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestKey:key.current,student_name:student,level,package_plan:checked,snapshot:meta.snapshot,bookingSnapshot:meta.bookingSnapshot})});const data=await r.json();if(!r.ok)throw Error(data.error||'신청하지 못했습니다. 입력 내용은 유지됩니다.');setReceipt(true);setGuide(true);window.scrollTo(0,0);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const button={padding:'14px 22px',border:0,borderRadius:12,background:'#5145b8',color:'#fff',fontSize:16,fontWeight:700,cursor:'pointer'} as const;
  return <main style={{maxWidth:1100,margin:'0 auto',padding:'28px 18px 70px',color:'#24334b'}}>
    <a href="/portal/online-class">← 내 화상영어 수업</a><h1 style={{fontSize:28,marginTop:28}}>연수 패키지 화상영어 신청</h1>
    {receipt?<section style={{background:'#fff',border:'1px solid #dedfee',borderRadius:20,padding:28}}><h2>신청이 완료되었습니다</h2><p>{student} · 총 {plan?.total}회</p><p>연수 전 {plan?.pre.count}회 / 연수 후 {plan?.post.count}회로 접수했습니다. 선생님 배정 후 수업을 진행합니다.</p><button style={button} onClick={()=>setGuide(true)}>화상영어 수업 안내 보기</button><p><a href="/portal/online-class">내 수업과 출석부 확인 →</a></p></section>:<>
    <p style={{lineHeight:1.8}}>연수 1주마다 화상영어 3회가 제공됩니다. 여러 연수가 있으면 함께 선택하고, 연수 전·후에 나누어 사용할 회차와 일정을 정해주세요.</p>
    {loading?<p role="status">연수 예약과 신청 내역을 확인하고 있습니다…</p>:meta&&<>
      {meta.admin&&<p>관리자 미리보기 · 실제 신청은 손님 계정에서 가능합니다.</p>}
      <label style={{display:'block',margin:'24px 0'}}>수강 학생<select aria-label="수강 학생" value={student} disabled={busy} onChange={e=>setStudent(e.target.value)} style={{display:'block',fontSize:18,padding:14,width:'100%',marginTop:8,border:'1px solid #cbd5e1',borderRadius:10}}><option value="">학생을 선택해주세요</option>{meta.children.map(c=><option key={c.name} value={c.name}>{c.name} {c.english}</option>)}</select></label>
      {student&&meta.existing.some(e=>e.student_name===student)&&<p>기존 신청 내역이 있습니다. 이미 제공받은 연수의 회차는 중복 신청할 수 없습니다. 기존 회차의 배분 변경은 담당자에게 요청해주세요. <a href="/portal/online-class">기존 수업 확인</a></p>}
      {plan&&<><OnlinePackagePlanEditor meta={{...meta,admin:false}} value={plan} onChange={p=>{setPlan(p);setAgreed(false);}} disabled={busy}/><label style={{display:'block',margin:'24px 0'}}>현재 영어 수준 또는 참고사항<input value={level} maxLength={100} disabled={busy} onChange={e=>setLevel(e.target.value)} placeholder="예: 간단한 문장으로 대화 가능 / 처음 시작" style={{display:'block',width:'100%',padding:14,fontSize:16,marginTop:8,border:'1px solid #cbd5e1',borderRadius:10}}/></label><label style={{display:'block',lineHeight:1.8,marginBottom:20}}><input type="checkbox" checked={agreed} disabled={busy} onChange={e=>setAgreed(e.target.checked)}/> 총 {plan.total}회와 연수 전 {plan.pre.count}회 · 연수 후 {plan.post.count}회 일정을 확인했습니다.</label><button style={{...button,width:'100%',opacity:busy||meta.admin?.5:1}} disabled={busy||meta.admin} onClick={submit}>{busy?'신청 중…':'이 일정으로 신청하기'}</button></>}
      {!meta.children.length&&<p>연결된 학생의 연수 예약이 없습니다. 담당자에게 예약과 앱 계정 연결을 요청해주세요.</p>}
    </>}{error&&<p role="alert" style={{color:'#b42318',background:'#fff1f0',padding:18,borderRadius:12,lineHeight:1.8}}>{error}</p>}
    </>}
    <Booking3Guide open={guide} onClose={()=>setGuide(false)}/>
  </main>;
}
