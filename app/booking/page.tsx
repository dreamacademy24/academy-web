"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Student { id:number; korName:string; engName:string; age:string; grade:string; photo:string }

const todayStr = new Date().toISOString().slice(0,10);
const todayCompact = todayStr.replace(/-/g,"");

export default function BookingPage(){
  const [booker,setBooker]=useState({name:"",english:""});
  const [students,setStudents]=useState<Student[]>([{id:1,korName:"",engName:"",age:"",grade:"주니어",photo:"O"}]);
  const [schedule,setSchedule]=useState({checkIn:"",checkOut:"",comboMode:false,weeks:"4",accomType:"드림하우스",weeks2:"2",accomType2:"제이파크"});

  useEffect(()=>{
    if(!schedule.checkIn||!schedule.weeks) return;
    const totalWeeks=schedule.comboMode?Number(schedule.weeks)+Number(schedule.weeks2):Number(schedule.weeks);
    const d=new Date(schedule.checkIn);d.setDate(d.getDate()+totalWeeks*7);
    setSchedule(s=>({...s,checkOut:d.toISOString().split('T')[0]}));
  },[schedule.checkIn,schedule.weeks,schedule.weeks2,schedule.comboMode]);
  const [service,setService]=useState({pickup:"미정",drop:"미정"});
  const [specialRequest,setSpecialRequest]=useState("");
  const [loading,setLoading]=useState(false);
  const [done,setDone]=useState(false);
  const [reservationNo,setReservationNo]=useState("");

  function addStudent(){if(students.length>=4)return;setStudents([...students,{id:Date.now(),korName:"",engName:"",age:"",grade:"주니어",photo:"O"}]);}
  function rmStudent(id:number){setStudents(students.filter(s=>s.id!==id));}
  function upStudent(id:number,f:string,v:string){setStudents(students.map(s=>s.id===id?{...s,[f]:v}:s));}

  async function submit(){
    if(!booker.name){alert("예약자명을 입력해주세요.");return;}
    if(!students.some(s=>s.korName)){alert("학생 이름을 1명 이상 입력해주세요.");return;}
    setLoading(true);
    const rno="DA-"+todayCompact+"-"+Math.floor(Math.random()*900+100);
    const {error}=await supabase.from("bookings").insert({
      reservation_no:rno,
      booker_name:booker.name,
      booker_english:booker.english,
      students:JSON.stringify(students),
      accom_type:schedule.comboMode?schedule.accomType+"+"+schedule.accomType2:schedule.accomType,
      accom_weeks:schedule.comboMode?Number(schedule.weeks)+Number(schedule.weeks2):Number(schedule.weeks),
      checkin_date:schedule.checkIn||null,
      checkout_date:schedule.checkOut||null,
      pickup:service.pickup,
      drop_off:service.drop,
      special_request:specialRequest,
      status:"접수",
    });
    setLoading(false);
    if(error){alert("접수 실패: "+error.message);return;}
    setReservationNo(rno);
    setDone(true);
  }

  if(done) return(<>
    <style>{`*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;}
.dw{max-width:500px;margin:0 auto;padding:60px 24px;text-align:center;}
.dc{font-size:64px;margin-bottom:16px;}.dh{font-size:24px;font-weight:800;color:#1a1a2e;margin-bottom:12px;}
.drn{font-size:20px;font-weight:700;color:#1a6fc4;background:#f0f7ff;padding:12px 24px;border-radius:10px;display:inline-block;margin-bottom:16px;}
.dp{font-size:14px;color:#6b7c93;line-height:1.8;margin-bottom:24px;}
.dk{display:inline-block;padding:12px 28px;background:#fee500;color:#3c1e1e;font-size:14px;font-weight:700;border-radius:8px;text-decoration:none;}
    `}</style>
    <div className="dw">
      <div className="dc">✅</div>
      <div className="dh">예약 접수 완료!</div>
      <div className="drn">{reservationNo}</div>
      <div className="dp">담당자가 확인 후 인보이스를 발송해드립니다.<br/>문의사항은 카카오톡으로 연락주세요.</div>
      <a className="dk" href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer">카카오톡 문의하기</a>
    </div>
  </>);

  return(<><style>{`
*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e;}
.bw{max-width:600px;margin:0 auto;padding:0 0 60px;}
.bh{background:#1a6fc4;padding:24px;text-align:center;color:#fff;}.bh h1{font-size:20px;font-weight:800;}.bh p{font-size:12px;opacity:0.8;margin-top:4px;}
.bc{padding:0 20px;}
.bs{background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);margin-top:20px;}.bs h2{font-size:15px;font-weight:800;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #1a1a2e;display:flex;align-items:center;gap:6px;}
.fr{display:flex;gap:10px;margin-bottom:10px;}.fg{flex:1;}.fl{display:block;font-size:11px;font-weight:600;color:#6b7c93;margin-bottom:4px;}.fl .req{color:#dc2626;}
.fi,.fsl,.fta{width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:'Noto Sans KR',sans-serif;outline:none;}.fi:focus,.fsl:focus,.fta:focus{border-color:#1a6fc4;}.fsl{background:#fff;}.fta{resize:vertical;min-height:70px;}
.sc{position:relative;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:10px;}
.sc-del{position:absolute;top:8px;right:8px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;cursor:pointer;font-size:13px;font-weight:700;border:none;}.sc-del:hover{background:#fee2e2;}
.sc-num{font-size:11px;font-weight:700;color:#1a6fc4;margin-bottom:10px;}
.fh{font-size:10px;color:#94a3b8;margin-top:3px;}
.ab{padding:8px 16px;font-size:12px;font-weight:700;background:#eaf3fb;color:#1a6fc4;border:1px solid #bfdbfe;border-radius:6px;cursor:pointer;border:none;}.ab:hover{background:#dbeafe;}
.tg{display:flex;gap:4px;background:#f1f5f9;border-radius:8px;padding:3px;margin-bottom:14px;}.tgb{flex:1;padding:9px;font-size:13px;font-weight:700;text-align:center;border:none;border-radius:6px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;background:transparent;color:#6b7c93;transition:all 150ms;}.tgb:hover{color:#1a1a2e;}.tgb.ac{background:#1a6fc4;color:#fff;box-shadow:0 2px 6px rgba(26,111,196,0.3);}
.warn-box{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:10px;font-size:13px;color:#374151;line-height:1.7;}.warn-title{color:#dc2626;font-weight:800;font-size:14px;margin-bottom:4px;}
.sb{width:100%;padding:14px;background:#1a6fc4;color:#fff;font-size:15px;font-weight:700;border:none;border-radius:10px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;margin-top:20px;}.sb:hover{background:#0d3d7a;}.sb:disabled{background:#94a3b8;cursor:not-allowed;}
@media(max-width:600px){.fr{flex-direction:column;gap:10px;}}
  `}</style>

  <div className="bw">
    <div className="bh"><h1>드림아카데미 예약 접수</h1><p>Dream Academy Reservation</p></div>
    <div className="bc">

    <div className="bs"><h2>예약자 정보</h2>
      <div className="fr"><div className="fg"><label className="fl">예약자 한글이름 <span className="req">*</span></label><input className="fi" placeholder="홍길동" value={booker.name} onChange={e=>setBooker({...booker,name:e.target.value})}/></div></div>
      <div className="fr"><div className="fg"><label className="fl">예약자 영문이름</label><input className="fi" placeholder="HONG GILDONG" value={booker.english} onChange={e=>setBooker({...booker,english:e.target.value})}/></div></div>
    </div>

    <div className="bs"><h2>학생 정보</h2>
      {students.map((s,idx)=>(
        <div className="sc" key={s.id}>
          {students.length>1&&<button className="sc-del" onClick={()=>rmStudent(s.id)}>X</button>}
          <div className="sc-num">학생 {idx+1}</div>
          <div className="fr"><div className="fg"><label className="fl">한글이름 <span className="req">*</span></label><input className="fi" placeholder="홍민준" value={s.korName} onChange={e=>upStudent(s.id,"korName",e.target.value)}/></div><div className="fg"><label className="fl">영문이름</label><input className="fi" placeholder="HONG MINJUN" value={s.engName} onChange={e=>upStudent(s.id,"engName",e.target.value.toUpperCase())}/></div></div>
          <div className="fr"><div className="fg"><label className="fl">나이</label><input className="fi" type="number" placeholder="7" value={s.age} onChange={e=>upStudent(s.id,"age",e.target.value)}/></div><div className="fg"><label className="fl">킨더/주니어</label><p style={{fontSize:11,color:'#6b7280',margin:'0 0 4px 0'}}>킨더: 유치원생 / 주니어: 초등학생 이상</p><select className="fsl" value={s.grade} onChange={e=>upStudent(s.id,"grade",e.target.value)}><option value="킨더">킨더</option><option value="주니어">주니어</option></select></div></div>
          <div className="fr"><div className="fg"><label className="fl">사진촬영 허용</label><select className="fsl" value={s.photo} onChange={e=>upStudent(s.id,"photo",e.target.value)}><option value="O">O</option><option value="X">X</option></select><div className="fh">📸 인스타그램 등 SNS 활용 / 미허용 시 별도 사진 제공 없음</div></div></div>
        </div>
      ))}
      {students.length<4&&<button className="ab" onClick={addStudent}>+ 학생 추가</button>}
    </div>

    <div className="bs"><h2>일정 / 숙소</h2>
      <div className="tg"><button className={`tgb${!schedule.comboMode?" ac":""}`} onClick={()=>setSchedule({...schedule,comboMode:false})}>숙소 1개</button><button className={`tgb${schedule.comboMode?" ac":""}`} onClick={()=>setSchedule({...schedule,comboMode:true})}>숙소 2개 조합</button></div>
      <div className="fr"><div className="fg"><label className="fl">희망 체크인 날짜</label><input className="fi" type="date" value={schedule.checkIn} onChange={e=>setSchedule({...schedule,checkIn:e.target.value})}/></div><div className="fg"><label className="fl">체크아웃 (자동계산)</label><input className="fi" type="date" value={schedule.checkOut} readOnly style={{background:'#f3f4f6'}}/></div></div>
      {!schedule.comboMode?(
        <div className="fr"><div className="fg"><label className="fl">희망 기간</label><select className="fsl" value={schedule.weeks} onChange={e=>setSchedule({...schedule,weeks:e.target.value})}>{Array.from({length:11},(_,i)=>i+2).map(v=><option key={v} value={v}>{v}주</option>)}</select></div><div className="fg"><label className="fl">숙소 선택</label><select className="fsl" value={schedule.accomType} onChange={e=>setSchedule({...schedule,accomType:e.target.value})}><option value="드림하우스">드림하우스</option><option value="제이파크">제이파크</option><option value="큐브나인">큐브나인</option></select></div></div>
      ):(<>
        <div style={{padding:"12px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:"10px",marginBottom:"10px"}}><div style={{fontSize:"11px",fontWeight:700,color:"#1a6fc4",marginBottom:"8px"}}>숙소 A</div>
          <div className="fr"><div className="fg"><label className="fl">숙소</label><select className="fsl" value={schedule.accomType} onChange={e=>setSchedule({...schedule,accomType:e.target.value})}><option value="드림하우스">드림하우스</option><option value="제이파크">제이파크</option><option value="큐브나인">큐브나인</option></select></div><div className="fg"><label className="fl">기간</label><select className="fsl" value={schedule.weeks} onChange={e=>setSchedule({...schedule,weeks:e.target.value})}>{Array.from({length:11},(_,i)=>i+2).map(v=><option key={v} value={v}>{v}주</option>)}</select></div></div>
        </div>
        <div style={{padding:"12px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:"10px",marginBottom:"10px"}}><div style={{fontSize:"11px",fontWeight:700,color:"#1a6fc4",marginBottom:"8px"}}>숙소 B</div>
          <div className="fr"><div className="fg"><label className="fl">숙소</label><select className="fsl" value={schedule.accomType2} onChange={e=>setSchedule({...schedule,accomType2:e.target.value})}><option value="드림하우스">드림하우스</option><option value="제이파크">제이파크</option><option value="큐브나인">큐브나인</option></select></div><div className="fg"><label className="fl">기간</label><select className="fsl" value={schedule.weeks2} onChange={e=>setSchedule({...schedule,weeks2:e.target.value})}>{Array.from({length:11},(_,i)=>i+2).map(v=><option key={v} value={v}>{v}주</option>)}</select></div></div>
        </div>
      </>)}
    </div>

    <div className="bs"><h2>공항 픽업·드롭 서비스</h2>
      <div className="fr"><div className="fg"><label className="fl">픽업 서비스</label><select className="fsl" value={service.pickup} onChange={e=>setService({...service,pickup:e.target.value})}><option value="미정">미정</option><option value="필요함">필요함</option><option value="불필요함">불필요함</option></select></div><div className="fg"><label className="fl">드롭 서비스</label><select className="fsl" value={service.drop} onChange={e=>setService({...service,drop:e.target.value})}><option value="미정">미정</option><option value="필요함">필요함</option><option value="불필요함">불필요함</option></select></div></div>
    </div>

    <div className="bs"><h2>기타</h2>
      <div className="warn-box"><div className="warn-title">⚠️ 주의 !</div>아이의 특이사항에 대해서는 꼭 기재해주세요.<br/>ADHD 약 복용 등 건강 관련 정보는 반드시 알려주셔야 하며,<br/>미 안내 시 발생하는 문제에 대해서는 보호자가 모두 책임지게 됩니다.</div>
      <div className="fg"><label className="fl">특이사항 / 요청사항</label><textarea className="fta" placeholder="예) ADHD 약 복용 중 (○○약, 하루 1회), 특정 음식 알레르기, 기타 요청사항 등" value={specialRequest} onChange={e=>setSpecialRequest(e.target.value)}/></div>
    </div>

    <button className="sb" onClick={submit} disabled={loading}>{loading?"접수 중...":"예약 접수하기"}</button>
    </div>
  </div>
  </>);
}
