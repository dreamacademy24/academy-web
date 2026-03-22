"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const ADMIN_PW = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "";

interface Booking {
  id:string; reservation_no:string; status:string; booker_name:string; students:any;
  checkin_date:string; accom_type:string; created_at:string; assignee?:string;
}

const STATUS_COLORS:Record<string,{bg:string;color:string}>={
  "접수":{bg:"#fef3c7",color:"#92400e"},
  "인보이스발행":{bg:"#dbeafe",color:"#1e40af"},
  "영수증발행":{bg:"#dcfce7",color:"#166534"},
  "완료":{bg:"#f1f5f9",color:"#64748b"},
};

function parseStudentNames(students:any):string{
  try{
    const arr=typeof students==="string"?JSON.parse(students):students;
    if(!Array.isArray(arr))return "";
    return arr.map((s:any)=>s.korName).filter(Boolean).join(", ");
  }catch{return "";}
}

export default function AdminBookingsPage(){
  const router=useRouter();
  const [authed,setAuthed]=useState(false);
  const [pw,setPw]=useState("");
  const [bookings,setBookings]=useState<Booking[]>([]);
  const [filter,setFilter]=useState("전체");
  const [loading,setLoading]=useState(false);
  const ASSIGNEES=["May","Jamin","Yuna","Jena"];

  const load=useCallback(async()=>{
    setLoading(true);
    const {data}=await supabase.from("bookings").select("*").order("created_at",{ascending:false});
    if(data) setBookings(data as Booking[]);
    setLoading(false);
  },[]);

  useEffect(()=>{if(authed)load();},[authed,load]);

  function checkPw(){if(pw===ADMIN_PW)setAuthed(true);else alert("비밀번호가 올바르지 않습니다.");}

  const filtered=filter==="전체"?bookings:bookings.filter(b=>b.status===filter);
  const tabs=["전체","접수","인보이스발행","영수증발행","완료"];

  if(!authed) return(<>
    <style>{`*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;}
.pw-w{display:flex;align-items:center;justify-content:center;height:100vh;}
.pw-c{background:#fff;padding:32px;border-radius:14px;box-shadow:0 4px 20px rgba(0,0,0,0.08);text-align:center;width:340px;}
.pw-c h2{font-size:18px;font-weight:800;margin-bottom:16px;}
.pw-i{width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;margin-bottom:12px;outline:none;font-family:'Noto Sans KR',sans-serif;}.pw-i:focus{border-color:#1a6fc4;}
.pw-b{width:100%;padding:10px;background:#1a6fc4;color:#fff;font-size:14px;font-weight:700;border:none;border-radius:8px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}.pw-b:hover{background:#0d3d7a;}
    `}</style>
    <div className="pw-w"><div className="pw-c">
      <h2>관리자 로그인</h2>
      <input className="pw-i" type="password" placeholder="비밀번호" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")checkPw();}}/>
      <button className="pw-b" onClick={checkPw}>확인</button>
    </div></div>
  </>);

  return(<><style>{`
*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e;}
.aw{max-width:1100px;margin:0 auto;padding:32px 24px;}
.ah{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px;}.ah h1{font-size:24px;font-weight:800;}
.ah-btns{display:flex;gap:8px;}.ah-btn{padding:8px 16px;font-size:13px;font-weight:600;border-radius:8px;border:none;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}
.ah-new{background:#1a6fc4;color:#fff;text-decoration:none;display:inline-flex;align-items:center;padding:8px 16px;font-size:13px;font-weight:600;border-radius:8px;}.ah-new:hover{background:#0d3d7a;}
.ah-ref{background:#f1f5f9;color:#1a1a2e;border:1px solid #e2e8f0;}.ah-ref:hover{background:#e2e8f0;}
.tabs{display:flex;gap:4px;background:#fff;padding:4px;border-radius:10px;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,0.04);flex-wrap:wrap;}
.tab{padding:8px 16px;font-size:12px;font-weight:600;border:none;border-radius:7px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;background:transparent;color:#6b7c93;transition:all 150ms;}.tab:hover{color:#1a1a2e;}.tab.ac{background:#1a6fc4;color:#fff;}
.tbl{width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);}
.tbl th{font-size:11px;font-weight:700;color:#6b7c93;padding:12px 14px;text-align:left;background:#f8fafc;border-bottom:1px solid #e2e8f0;}
.tbl td{font-size:13px;padding:12px 14px;border-bottom:1px solid #f1f5f9;color:#1a1a2e;}
.tbl tr:hover td{background:#f8fafc;cursor:pointer;}
.badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;}
.empty{text-align:center;padding:40px;color:#94a3b8;font-size:14px;}
.asg-sel{border:1px solid #e2e8f0;border-radius:6px;padding:4px 8px;font-size:12px;background:#fff;font-family:'Noto Sans KR',sans-serif;cursor:pointer;outline:none;}.asg-sel:focus{border-color:#1a6fc4;}
@media(max-width:700px){.tbl{font-size:12px;}.tbl th,.tbl td{padding:8px 10px;}}
  `}</style>

  <div className="aw">
    <div className="ah">
      <h1>예약 관리</h1>
      <div className="ah-btns">
        <a className="ah-new" href="/booking">새 예약 접수</a>
        <button className="ah-btn ah-ref" onClick={load} disabled={loading}>{loading?"로딩...":"새로고침"}</button>
      </div>
    </div>

    <div className="tabs">
      {tabs.map(t=><button key={t} className={`tab${filter===t?" ac":""}`} onClick={()=>setFilter(t)}>{t} {t!=="전체"&&<>({bookings.filter(b=>b.status===t).length})</>}</button>)}
    </div>

    <table className="tbl"><thead><tr>
      <th>예약번호</th><th>상태</th><th>담당자</th><th>예약자명</th><th>학생이름</th><th>체크인</th><th>숙소</th><th>접수일</th><th></th>
    </tr></thead><tbody>
      {filtered.length===0?<tr><td colSpan={9} className="empty">예약이 없습니다.</td></tr>:
      filtered.map(b=>{
        const sc=STATUS_COLORS[b.status]||STATUS_COLORS["접수"];
        return(<tr key={b.id} onClick={()=>router.push("/invoice?id="+b.id)}>
          <td style={{fontWeight:600,color:"#1a6fc4"}}>{b.reservation_no}</td>
          <td><span className="badge" style={{background:sc.bg,color:sc.color}}>{b.status}</span></td>
          <td><select className="asg-sel" value={b.assignee||""} style={{color:b.assignee?"#1a6fc4":"#94a3b8"}} onClick={e=>e.stopPropagation()} onChange={async e=>{const v=e.target.value;await supabase.from("bookings").update({assignee:v}).eq("id",b.id);setBookings(prev=>prev.map(x=>x.id===b.id?{...x,assignee:v}:x));}}><option value="">미지정</option>{ASSIGNEES.map(a=><option key={a} value={a}>{a}</option>)}</select></td>
          <td>{b.booker_name}</td>
          <td>{parseStudentNames(b.students)}</td>
          <td>{b.checkin_date||"미정"}</td>
          <td>{b.accom_type||"미정"}</td>
          <td>{b.created_at?new Date(b.created_at).toLocaleDateString("ko-KR"):""}</td>
          <td><button style={{padding:"4px 10px",fontSize:"11px",fontWeight:700,background:"#16a34a",color:"#fff",border:"none",borderRadius:"6px",cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}} onClick={e=>{e.stopPropagation();window.open("/receipt?id="+b.id,"_blank");}}>영수증 보기</button></td>
        </tr>);
      })}
    </tbody></table>

  </div>
  </>);
}
