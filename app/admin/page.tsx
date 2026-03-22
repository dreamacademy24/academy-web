"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const ADMIN_PW = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "";

interface Booking {
  id:string; reservation_no:string; status:string; booker_name:string; students:any;
  checkin_date:string; accom_type:string; created_at:string; assignee?:string;
  base_price?:number; final_price?:number; balance_date?:string; updated_at?:string;
}

const SC:Record<string,{bg:string;color:string}>={
  "접수":{bg:"#fef3c7",color:"#92400e"},
  "인보이스발행":{bg:"#dbeafe",color:"#1e40af"},
  "영수증발행":{bg:"#dcfce7",color:"#166534"},
  "완료":{bg:"#f1f5f9",color:"#64748b"},
};

function stuNames(students:any):string{
  try{const a=typeof students==="string"?JSON.parse(students):students;if(!Array.isArray(a))return "";return a.map((s:any)=>s.korName).filter(Boolean).join(", ");}catch{return "";}
}
function fmt(n?:number){return n?n.toLocaleString("ko-KR")+"원":"-";}
function fDate(d?:string){return d?new Date(d).toLocaleDateString("ko-KR"):"";}

export default function AdminHubPage(){
  const router=useRouter();
  const [authed,setAuthed]=useState(false);
  const [pw,setPw]=useState("");
  const [tab,setTab]=useState<"bookings"|"invoice"|"receipt"|"site">("bookings");
  const [bookings,setBookings]=useState<Booking[]>([]);
  const [loading,setLoading]=useState(false);
  const [filter,setFilter]=useState("전체");
  const ASSIGNEES=["May","Jamin","Yuna","Jena"];
  const statusFilters=["전체","접수","인보이스발행","영수증발행","완료"];

  const load=useCallback(async()=>{
    setLoading(true);
    const {data}=await supabase.from("bookings").select("*").order("created_at",{ascending:false});
    if(data)setBookings(data as Booking[]);
    setLoading(false);
  },[]);

  useEffect(()=>{if(authed)load();},[authed,load]);

  function checkPw(){if(pw===ADMIN_PW)setAuthed(true);else alert("비밀번호가 올바르지 않습니다.");}

  if(!authed) return(<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;}
.pw-w{display:flex;align-items:center;justify-content:center;height:100vh;}
.pw-c{background:#fff;padding:48px 40px;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.1);text-align:center;max-width:400px;width:100%;}
.pw-c h1{font-size:24px;font-weight:800;margin-bottom:8px;}
.pw-c p{font-size:14px;color:#6b7c93;margin-bottom:28px;}
.pw-i{width:100%;padding:12px 16px;border:1px solid #e2e8f0;border-radius:8px;font-size:15px;outline:none;font-family:'Noto Sans KR',sans-serif;margin-bottom:16px;}.pw-i:focus{border-color:#1a6fc4;}
.pw-b{width:100%;padding:13px;background:#1a6fc4;color:#fff;font-size:15px;font-weight:700;border:none;border-radius:8px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}.pw-b:hover{background:#0d3d7a;}
.bk-link{display:inline-block;margin-top:20px;font-size:13px;color:#6b7c93;text-decoration:none;}.bk-link:hover{color:#1a6fc4;}
    `}</style>
    <div className="pw-w"><div className="pw-c">
      <h1>Admin</h1>
      <p>관리자 비밀번호를 입력하세요.</p>
      <input className="pw-i" type="password" placeholder="비밀번호" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")checkPw();}}/>
      <button className="pw-b" onClick={checkPw}>로그인</button>
      <a href="/" className="bk-link">← 홈으로 돌아가기</a>
    </div></div>
  </>);

  const filtered=filter==="전체"?bookings:bookings.filter(b=>b.status===filter);
  const invList=bookings.filter(b=>["인보이스발행","영수증발행","완료"].includes(b.status));
  const rcpList=bookings.filter(b=>["영수증발행","완료"].includes(b.status));

  return(<><style>{`
*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e;}
.aw{max-width:1200px;margin:0 auto;padding:24px;}
.ah{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;}
.ah h1{font-size:22px;font-weight:800;}
.ah-right{display:flex;gap:8px;align-items:center;}
.ah-btn{padding:8px 16px;font-size:13px;font-weight:600;border-radius:8px;border:none;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}
.ah-new{background:#1a6fc4;color:#fff;text-decoration:none;display:inline-flex;align-items:center;padding:8px 16px;font-size:13px;font-weight:600;border-radius:8px;}.ah-new:hover{background:#0d3d7a;}
.ah-ref{background:#f1f5f9;color:#1a1a2e;border:1px solid #e2e8f0;}.ah-ref:hover{background:#e2e8f0;}
.ah-home{color:#6b7c93;font-size:13px;text-decoration:none;font-weight:600;}.ah-home:hover{color:#1a6fc4;}
.main-tabs{display:flex;gap:4px;background:#fff;padding:4px;border-radius:10px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.06);}
.main-tab{flex:1;padding:12px 8px;font-size:13px;font-weight:700;text-align:center;border:none;border-radius:8px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;background:transparent;color:#6b7c93;transition:all 150ms;white-space:nowrap;}.main-tab:hover{color:#1a1a2e;}.main-tab.ac{background:#1a6fc4;color:#fff;}
.sub-tabs{display:flex;gap:4px;margin-bottom:16px;flex-wrap:wrap;}
.sub-tab{padding:6px 14px;font-size:12px;font-weight:600;border:none;border-radius:7px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;background:#fff;color:#6b7c93;transition:all 150ms;}.sub-tab:hover{color:#1a1a2e;}.sub-tab.ac{background:#1a6fc4;color:#fff;}
.tbl{width:100%;background:#fff;border-radius:12px;overflow-x:auto;box-shadow:0 2px 12px rgba(0,0,0,0.06);display:block;}
.tbl table{width:100%;border-collapse:collapse;min-width:900px;}
.tbl th{font-size:11px;font-weight:700;color:#6b7c93;padding:12px 12px;text-align:left;background:#f8fafc;border-bottom:1px solid #e2e8f0;white-space:nowrap;}
.tbl td{font-size:13px;padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#1a1a2e;white-space:nowrap;}
.tbl tr:hover td{background:#f8fafc;cursor:pointer;}
.badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;}
.empty{text-align:center;padding:40px;color:#94a3b8;font-size:14px;}
.asg{border:1px solid #e2e8f0;border-radius:6px;padding:4px 8px;font-size:12px;background:#fff;font-family:'Noto Sans KR',sans-serif;cursor:pointer;outline:none;}.asg:focus{border-color:#1a6fc4;}
.act-btn{padding:4px 10px;font-size:11px;font-weight:700;border:none;border-radius:6px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;margin-right:4px;}
.act-inv{background:#1a6fc4;color:#fff;}.act-inv:hover{background:#0d3d7a;}
.act-rcp{background:#16a34a;color:#fff;}.act-rcp:hover{background:#15803d;}
.site-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;margin-top:8px;}
.site-card{background:#fff;border-radius:12px;padding:24px 20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);text-align:center;cursor:pointer;border:2px solid transparent;transition:all 160ms;text-decoration:none;color:#1a1a2e;display:block;}
.site-card:hover{border-color:#1a6fc4;transform:translateY(-2px);}
.site-card .ic{font-size:32px;margin-bottom:10px;}
.site-card h3{font-size:15px;font-weight:700;margin-bottom:4px;}
.site-card p{font-size:12px;color:#6b7c93;}
@media(max-width:700px){.main-tab{font-size:12px;padding:10px 4px;}.aw{padding:16px 12px;}}
  `}</style>

  <div className="aw">
    <div className="ah">
      <h1>드림아카데미 관리자</h1>
      <div className="ah-right">
        <a className="ah-new" href="/booking">+ 새 예약 접수</a>
        <button className="ah-btn ah-ref" onClick={load} disabled={loading}>{loading?"로딩...":"새로고침"}</button>
        <a href="/" className="ah-home">홈</a>
      </div>
    </div>

    <div className="main-tabs">
      <button className={`main-tab${tab==="bookings"?" ac":""}`} onClick={()=>setTab("bookings")}>📋 예약 접수 현황</button>
      <button className={`main-tab${tab==="invoice"?" ac":""}`} onClick={()=>setTab("invoice")}>📄 인보이스</button>
      <button className={`main-tab${tab==="receipt"?" ac":""}`} onClick={()=>setTab("receipt")}>🧾 영수증</button>
      <button className={`main-tab${tab==="site"?" ac":""}`} onClick={()=>setTab("site")}>⚙️ 사이트 관리</button>
    </div>

    {/* ── 탭1: 예약 접수 현황 ── */}
    {tab==="bookings"&&(<>
      <div className="sub-tabs">
        {statusFilters.map(t=><button key={t} className={`sub-tab${filter===t?" ac":""}`} onClick={()=>setFilter(t)}>{t} {t!=="전체"&&<>({bookings.filter(b=>b.status===t).length})</>}</button>)}
      </div>
      <div className="tbl"><table><thead><tr>
        <th>예약번호</th><th>상태</th><th>담당자</th><th>예약자명</th><th>학생이름</th><th>체크인</th><th>숙소</th><th>접수일</th><th>액션</th>
      </tr></thead><tbody>
        {filtered.length===0?<tr><td colSpan={9} className="empty">예약이 없습니다.</td></tr>:
        filtered.map(b=>{
          const sc=SC[b.status]||SC["접수"];
          return(<tr key={b.id} onClick={()=>router.push("/invoice?id="+b.id)}>
            <td style={{fontWeight:600,color:"#1a6fc4"}}>{b.reservation_no}</td>
            <td><span className="badge" style={{background:sc.bg,color:sc.color}}>{b.status}</span></td>
            <td><select className="asg" value={b.assignee||""} style={{color:b.assignee?"#1a6fc4":"#94a3b8"}} onClick={e=>e.stopPropagation()} onChange={async e=>{const v=e.target.value;await supabase.from("bookings").update({assignee:v}).eq("id",b.id);setBookings(prev=>prev.map(x=>x.id===b.id?{...x,assignee:v}:x));}}><option value="">미지정</option>{ASSIGNEES.map(a=><option key={a} value={a}>{a}</option>)}</select></td>
            <td>{b.booker_name}</td>
            <td>{stuNames(b.students)}</td>
            <td>{b.checkin_date||"미정"}</td>
            <td>{b.accom_type||"미정"}</td>
            <td>{fDate(b.created_at)}</td>
            <td onClick={e=>e.stopPropagation()}>
              <button className="act-btn act-inv" onClick={()=>router.push("/invoice?id="+b.id)}>인보이스</button>
              <button className="act-btn act-rcp" onClick={()=>window.open("/receipt?id="+b.id,"_blank")}>영수증</button>
            </td>
          </tr>);
        })}
      </tbody></table></div>
    </>)}

    {/* ── 탭2: 인보이스 ── */}
    {tab==="invoice"&&(
      <div className="tbl"><table><thead><tr>
        <th>예약번호</th><th>상태</th><th>담당자</th><th>예약자명</th><th>학생이름</th><th>체크인</th><th>패키지금액</th><th>잔금일자</th>
      </tr></thead><tbody>
        {invList.length===0?<tr><td colSpan={8} className="empty">인보이스 발행 내역이 없습니다.</td></tr>:
        invList.map(b=>{
          const sc=SC[b.status]||SC["접수"];
          return(<tr key={b.id} onClick={()=>router.push("/invoice?id="+b.id)}>
            <td style={{fontWeight:600,color:"#1a6fc4"}}>{b.reservation_no}</td>
            <td><span className="badge" style={{background:sc.bg,color:sc.color}}>{b.status}</span></td>
            <td>{b.assignee||"-"}</td>
            <td>{b.booker_name}</td>
            <td>{stuNames(b.students)}</td>
            <td>{b.checkin_date||"미정"}</td>
            <td>{fmt(b.base_price)}</td>
            <td>{b.balance_date||"-"}</td>
          </tr>);
        })}
      </tbody></table></div>
    )}

    {/* ── 탭3: 영수증 ── */}
    {tab==="receipt"&&(
      <div className="tbl"><table><thead><tr>
        <th>예약번호</th><th>예약자명</th><th>학생이름</th><th>체크인</th><th>최종금액</th><th>발행일</th>
      </tr></thead><tbody>
        {rcpList.length===0?<tr><td colSpan={6} className="empty">영수증 발행 내역이 없습니다.</td></tr>:
        rcpList.map(b=>(
          <tr key={b.id} onClick={()=>window.open("/receipt?id="+b.id,"_blank")}>
            <td style={{fontWeight:600,color:"#1a6fc4"}}>{b.reservation_no}</td>
            <td>{b.booker_name}</td>
            <td>{stuNames(b.students)}</td>
            <td>{b.checkin_date||"미정"}</td>
            <td style={{fontWeight:700}}>{fmt(b.final_price)}</td>
            <td>{fDate(b.updated_at)}</td>
          </tr>
        ))}
      </tbody></table></div>
    )}

    {/* ── 탭4: 사이트 관리 ── */}
    {tab==="site"&&(
      <div className="site-grid">
        <a className="site-card" href="/admin/dashboard">
          <div className="ic">📋</div><h3>공지사항 관리</h3><p>공지사항 등록/수정/삭제</p>
        </a>
        <a className="site-card" href="/admin/dashboard">
          <div className="ic">👥</div><h3>회원 관리</h3><p>가입 회원 조회/관리</p>
        </a>
        <a className="site-card" href="/admin/dashboard">
          <div className="ic">🚐</div><h3>셔틀/필드트립</h3><p>셔틀 및 필드트립 신청 관리</p>
        </a>
        <a className="site-card" href="/guide">
          <div className="ic">📖</div><h3>직원 가이드</h3><p>직원용 업무 가이드</p>
        </a>
        <a className="site-card" href="/invoice">
          <div className="ic">📄</div><h3>인보이스 생성</h3><p>직접 인보이스 작성</p>
        </a>
        <a className="site-card" href="/booking">
          <div className="ic">✏️</div><h3>새 예약 접수</h3><p>고객 예약 접수 폼</p>
        </a>
      </div>
    )}
  </div>
  </>);
}
