"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/adminAuth";
import EstimateCalc from "./EstimateCalc";

interface Booking {
  id:string; reservation_no:string; status:string; booker_name:string; students:any;
  checkin_date:string; checkout_date?:string; accom_type:string; created_at:string; assignee?:string;
  base_price?:number; final_price?:number; balance_date?:string; updated_at?:string;
  flight_in?:string; flight_out?:string; house_no?:string; pickup?:string; drop_off?:string;
  pickup_place?:string; special_request?:string; agency?:string; accom_room?:string;
  billing_items?:any; locals?:any; confirmed?:boolean;
}

const SC:Record<string,{bg:string;color:string}>={
  "접수":{bg:"#fef3c7",color:"#92400e"},
  "인보이스발행":{bg:"#dbeafe",color:"#1e40af"},
  "영수증발행":{bg:"#dcfce7",color:"#166534"},
  "결제완료":{bg:"#d1fae5",color:"#065f46"},
  "완료":{bg:"#f1f5f9",color:"#64748b"},
};

function stuNames(s:any):string{
  try{const a=typeof s==="string"?JSON.parse(s):s;if(!Array.isArray(a))return "";return a.map((x:any)=>x.korName).filter(Boolean).join(", ");}catch{return "";}
}
function stuWeeks(s:any):string{
  try{const a=typeof s==="string"?JSON.parse(s):s;if(!Array.isArray(a))return "";return a.map((x:any)=>x.weeks?x.weeks+"주":"").filter(Boolean).join(", ");}catch{return "";}
}
function stuCount(s:any):number{
  try{const a=typeof s==="string"?JSON.parse(s):s;if(!Array.isArray(a))return 0;return a.length;}catch{return 0;}
}
function fmt(n?:number){return n?n.toLocaleString("ko-KR")+"원":"-";}
function fDate(d?:string){return d?new Date(d).toLocaleDateString("ko-KR"):"";}
function shortNo(no:string){return no?no.replace("DA-","").slice(-7):"-";}
function addWeeks(dateStr:string,weeks:number):string{
  const d=new Date(dateStr);d.setDate(d.getDate()+weeks*7);return d.toISOString().slice(0,10);
}
function acaStart(b:any):string{
  if(!b.checkin_date)return"-";
  const d=new Date(b.checkin_date);d.setDate(d.getDate()+1);
  if(d.getDay()===0)d.setDate(d.getDate()+1);
  return d.toISOString().slice(0,10);
}
function acaEnd(b:any):string{
  const start=acaStart(b);if(start==="-")return"-";
  try{const a=typeof b.students==="string"?JSON.parse(b.students):b.students;if(!Array.isArray(a)||!a[0]?.weeks)return"-";return addWeeks(start,Number(a[0].weeks));}catch{return"-";}
}

export default function AdminBookingsPage(){
  const router=useRouter();
  const [authed,setAuthed]=useState(false);
  const [pw,setPw]=useState("");
  const [bookings,setBookings]=useState<Booking[]>([]);
  const [filter,setFilter]=useState("전체");
  const [confirmFilter,setConfirmFilter]=useState("전체");
  const [loading,setLoading]=useState(false);
  const [mainTab,setMainTab]=useState<"list"|"invoice"|"receipt"|"confirm"|"estimate">("list");
  const [confirmSearch,setConfirmSearch]=useState("");
  const [confirmSort,setConfirmSort]=useState<{key:string;asc:boolean}>({key:"checkin_date",asc:true});
  const ASSIGNEES=["May","Jamin","Yuna","Jena"];
  const statusFilters=["전체","접수","인보이스발행","영수증발행","완료"];
  const confirmStatuses=["전체","영수증발행","결제완료","완료"];

  useEffect(()=>{if(isAdminAuthed())setAuthed(true);},[]);

  const load=useCallback(async()=>{
    setLoading(true);
    const {data,error}=await supabase.from("bookings").select("*").order("checkin_date",{ascending:true});
    if(error){console.error(error);alert("데이터 로드 실패");}
    if(data)setBookings(data as Booking[]);
    setLoading(false);
  },[]);

  useEffect(()=>{if(authed)load();},[authed,load]);

  function checkPw(){router.push("/admin");}

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

  const filtered=filter==="전체"?bookings:bookings.filter(b=>b.status===filter);
  const invList=bookings.filter(b=>["인보이스발행","영수증발행","완료"].includes(b.status));
  const rcpList=bookings.filter(b=>["영수증발행","완료"].includes(b.status));
  const confirmList=bookings.filter(b=>["영수증발행","결제완료","완료"].includes(b.status));
  const confirmFiltered=confirmFilter==="전체"?confirmList:confirmList.filter(b=>b.status===confirmFilter);

  function getDday(dateStr?:string){
    if(!dateStr)return null;
    const today=new Date();today.setHours(0,0,0,0);
    const target=new Date(dateStr);target.setHours(0,0,0,0);
    const diff=Math.round((target.getTime()-today.getTime())/(1000*60*60*24));
    if(diff===0)return{label:"D-Day",color:"#dc2626"};
    if(diff>0)return{label:"D-"+diff,color:diff<=7?"#dc2626":diff<=30?"#ea580c":"#16a34a"};
    return{label:"D+"+Math.abs(diff),color:"#94a3b8"};
  }

  function getBalanceDday(dateStr?:string){
    if(!dateStr)return null;
    const today=new Date();today.setHours(0,0,0,0);
    const target=new Date(dateStr);target.setHours(0,0,0,0);
    const diff=Math.round((target.getTime()-today.getTime())/(1000*60*60*24));
    if(diff<0)return{label:"잔금초과",color:"#dc2626"};
    if(diff===0)return{label:"잔금오늘",color:"#dc2626"};
    if(diff<=14)return{label:"잔금D-"+diff,color:"#ea580c"};
    return null;
  }

  return(<><style>{`
*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e;}
.aw{max-width:1400px;margin:0 auto;padding:24px;}
.ah{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;}.ah h1{font-size:22px;font-weight:800;}
.ah-right{display:flex;gap:8px;align-items:center;}
.ah-btn{padding:8px 16px;font-size:13px;font-weight:600;border-radius:8px;border:none;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}
.ah-new{background:#1a6fc4;color:#fff;text-decoration:none;display:inline-flex;align-items:center;padding:8px 16px;font-size:13px;font-weight:600;border-radius:8px;}.ah-new:hover{background:#0d3d7a;}
.ah-ref{background:#f1f5f9;color:#1a1a2e;border:1px solid #e2e8f0;}.ah-ref:hover{background:#e2e8f0;}
.ah-home{color:#6b7c93;font-size:13px;text-decoration:none;font-weight:600;}.ah-home:hover{color:#1a6fc4;}
.main-tabs{display:flex;gap:4px;background:#fff;padding:4px;border-radius:10px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06);}
.main-tab{flex:1;padding:12px 8px;font-size:13px;font-weight:700;text-align:center;border:none;border-radius:8px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;background:transparent;color:#6b7c93;transition:all 150ms;white-space:nowrap;}.main-tab:hover{color:#1a1a2e;}.main-tab.ac{background:#1a6fc4;color:#fff;}
.sub-tabs{display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap;}
.sub-tab{padding:6px 14px;font-size:12px;font-weight:600;border:none;border-radius:7px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;background:#fff;color:#6b7c93;transition:all 150ms;}.sub-tab:hover{color:#1a1a2e;}.sub-tab.ac{background:#1a6fc4;color:#fff;}
.tbl-w{width:100%;background:#fff;border-radius:12px;overflow-x:auto;box-shadow:0 2px 12px rgba(0,0,0,0.06);}
.tbl{width:100%;border-collapse:collapse;min-width:850px;}
.tbl th{font-size:11px;font-weight:700;color:#6b7c93;padding:12px 12px;text-align:left;background:#f8fafc;border-bottom:1px solid #e2e8f0;white-space:nowrap;}
.tbl td{font-size:13px;padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#1a1a2e;white-space:nowrap;}
.tbl tbody tr:hover td{background:#f8fafc;cursor:pointer;}
.tbl td.wrap{white-space:normal;min-width:120px;max-width:200px;word-break:break-word;font-size:12px;}
.badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;}
.empty{text-align:center;padding:40px;color:#94a3b8;font-size:14px;}
.asg{border:1px solid #e2e8f0;border-radius:6px;padding:4px 8px;font-size:12px;background:#fff;font-family:'Noto Sans KR',sans-serif;cursor:pointer;outline:none;}.asg:focus{border-color:#1a6fc4;}
.act{padding:4px 10px;font-size:11px;font-weight:700;border:none;border-radius:6px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;margin-right:4px;}
.act-b{background:#1a6fc4;color:#fff;}.act-b:hover{background:#0d3d7a;}
.act-g{background:#16a34a;color:#fff;}.act-g:hover{background:#15803d;}
.act-r{background:#fef2f2;color:#dc2626;border:1px solid #fecaca;}.act-r:hover{background:#fee2e2;}
.dday{display:inline-block;font-size:11px;font-weight:700;padding:2px 7px;border-radius:10px;background:#f0fdf4;}
.ss-w{width:100%;background:#fff;border-radius:12px;overflow-x:auto;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid #e2e8f0;}
.ss{width:100%;border-collapse:collapse;min-width:1600px;}
.ss th{font-size:10px;font-weight:700;color:#6b7c93;padding:8px 6px;text-align:left;background:#f1f5f9;border:1px solid #e2e8f0;white-space:nowrap;cursor:pointer;user-select:none;position:relative;}.ss th:hover{background:#e2e8f0;}
.ss th .arr{margin-left:2px;font-size:9px;color:#94a3b8;}
.ss th .arr.ac{color:#1a6fc4;}
.ss td{font-size:11px;padding:6px 6px;border:1px solid #f1f5f9;color:#1a1a2e;white-space:nowrap;}
.ss tbody tr:hover td{background:#eff6ff;}
.ss tbody tr.confirmed-row td{background:#f0fdf4;}
.ss td.wrap{white-space:normal;min-width:100px;max-width:180px;word-break:break-word;}
.ss .chk{width:16px;height:16px;cursor:pointer;accent-color:#16a34a;}
.cf-search{display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap;}
.cf-search input{padding:7px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;width:260px;outline:none;font-family:'Noto Sans KR',sans-serif;}.cf-search input:focus{border-color:#1a6fc4;}
.cf-search .cnt{font-size:12px;color:#6b7c93;}
@media(max-width:700px){.main-tabs{display:grid;grid-template-columns:1fr 1fr;}.main-tab{font-size:11px;padding:10px 4px;}.aw{padding:16px 12px;}.ah{flex-direction:column;align-items:stretch;}.ah h1{text-align:center;font-size:18px;}.ah-right{justify-content:center;flex-wrap:wrap;}.tbl-w{display:none;}.mob-cards{display:flex !important;}.ah-btn,.ah-new,.sub-tab{min-height:44px;display:inline-flex;align-items:center;justify-content:center;}.pw-b{min-height:44px;}}
  `}</style>

  <div className="aw">
    <div className="ah">
      <h1>예약 관리</h1>
      <div className="ah-right">
        <a href="/admin" className="ah-home">← 관리자 홈</a>
        <a className="ah-new" href="/booking">+ 새 예약 접수</a>
        <button className="ah-btn ah-ref" onClick={load} disabled={loading}>{loading?"로딩...":"새로고침"}</button>
      </div>
    </div>

    <div className="main-tabs">
      <button className={`main-tab${mainTab==="estimate"?" ac":""}`} onClick={()=>setMainTab("estimate")}>📊 견적</button>
      <button className={`main-tab${mainTab==="list"?" ac":""}`} onClick={()=>setMainTab("list")}>📋 부킹 리스트</button>
      <button className={`main-tab${mainTab==="invoice"?" ac":""}`} onClick={()=>setMainTab("invoice")}>📄 인보이스</button>
      <button className={`main-tab${mainTab==="receipt"?" ac":""}`} onClick={()=>setMainTab("receipt")}>🧾 영수증</button>
      <button className={`main-tab${mainTab==="confirm"?" ac":""}`} onClick={()=>setMainTab("confirm")}>✅ 확정 예약{confirmList.length>0&&<span style={{background:"#16a34a",color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:11,marginLeft:4}}>{confirmList.length}</span>}</button>
    </div>

    {/* ── 탭1: 부킹 리스트 ── */}
    {mainTab==="list"&&(<>
      <div className="sub-tabs">
        {statusFilters.map(t=><button key={t} className={`sub-tab${filter===t?" ac":""}`} onClick={()=>setFilter(t)}>{t} {t!=="전체"&&<>({bookings.filter(b=>b.status===t).length})</>}</button>)}
      </div>
      <div className="tbl-w"><table className="tbl"><thead><tr>
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
              <button className="act act-b" onClick={()=>router.push("/invoice?id="+b.id)}>인보이스</button>
              <button className="act act-g" onClick={()=>window.open("/receipt?id="+b.id,"_blank")}>영수증</button>
              <button className="act" style={{background:"#eff6ff",color:"#1a6fc4",border:"1px solid #bfdbfe"}} onClick={()=>{navigator.clipboard.writeText("https://www.dreamacademyph.com/payment?id="+b.id);alert("결제 링크가 복사되었습니다!");}}>💳 결제링크</button>
              <button className="act act-r" onClick={async()=>{if(confirm("정말 삭제하시겠습니까?\n"+b.booker_name+" / "+b.reservation_no)){const{error}=await supabase.from("bookings").delete().eq("id",b.id);if(error){alert("삭제 실패: "+error.message);return;}load();}}}>삭제</button>
            </td>
          </tr>);
        })}
      </tbody></table></div>
      <div className="mob-cards" style={{display:"none",flexDirection:"column",gap:12}}>
        {filtered.length===0?<div className="empty">예약이 없습니다.</div>:
        filtered.map(b=>{
          const sc=SC[b.status]||SC["접수"];
          return(<div key={b.id} onClick={()=>router.push("/invoice?id="+b.id)} style={{background:"#fff",borderRadius:12,padding:16,boxShadow:"0 2px 8px rgba(0,0,0,0.06)",cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontWeight:700,color:"#1a6fc4",fontSize:14}}>{b.reservation_no}</span>
              <span className="badge" style={{background:sc.bg,color:sc.color}}>{b.status}</span>
            </div>
            <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>{b.booker_name}</div>
            <div style={{fontSize:13,color:"#6b7c93",marginBottom:4}}>{stuNames(b.students)}</div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#94a3b8"}}>
              <span>체크인: {b.checkin_date||"미정"}</span><span>{b.assignee||"미지정"}</span>
            </div>
            <div style={{display:"flex",gap:6,marginTop:10}} onClick={e=>e.stopPropagation()}>
              <button className="act act-b" style={{flex:1,minHeight:40}} onClick={()=>router.push("/invoice?id="+b.id)}>인보이스</button>
              <button className="act act-g" style={{flex:1,minHeight:40}} onClick={()=>window.open("/receipt?id="+b.id,"_blank")}>영수증</button>
              <button className="act act-r" style={{flex:1,minHeight:40}} onClick={async()=>{if(confirm("정말 삭제하시겠습니까?\n"+b.booker_name)){const{error}=await supabase.from("bookings").delete().eq("id",b.id);if(error){alert("삭제 실패: "+error.message);return;}load();}}}>삭제</button>
            </div>
          </div>);
        })}
      </div>
    </>)}

    {/* ── 탭2: 인보이스 ── */}
    {mainTab==="invoice"&&(<>
      <div className="tbl-w"><table className="tbl"><thead><tr>
        <th>예약번호</th><th>상태</th><th>담당자</th><th>예약자명</th><th>학생이름</th><th>체크인</th><th>패키지금액</th><th>잔금일자</th><th></th>
      </tr></thead><tbody>
        {invList.length===0?<tr><td colSpan={9} className="empty">인보이스 발행 내역이 없습니다.</td></tr>:
        invList.map(b=>{
          const sc=SC[b.status]||SC["접수"];
          return(<tr key={b.id} onClick={()=>router.push("/invoice?id="+b.id)}>
            <td style={{fontWeight:600,color:"#1a6fc4"}}>{b.reservation_no}</td>
            <td><span className="badge" style={{background:sc.bg,color:sc.color}}>{b.status}</span></td>
            <td>{b.assignee||"-"}</td><td>{b.booker_name}</td><td>{stuNames(b.students)}</td>
            <td>{b.checkin_date||"미정"}</td>
            <td style={{fontWeight:600}}>{fmt(b.base_price)}</td>
            <td>{b.balance_date||"-"}</td>
            <td onClick={e=>e.stopPropagation()}><button className="act act-r" onClick={async()=>{if(confirm("정말 삭제하시겠습니까?\n"+b.booker_name+" / "+b.reservation_no)){const{error}=await supabase.from("bookings").delete().eq("id",b.id);if(error){alert("삭제 실패: "+error.message);return;}load();}}}>삭제</button></td>
          </tr>);
        })}
      </tbody></table></div>
      <div className="mob-cards" style={{display:"none",flexDirection:"column",gap:12}}>
        {invList.length===0?<div className="empty">인보이스 발행 내역이 없습니다.</div>:
        invList.map(b=>{
          const sc=SC[b.status]||SC["접수"];
          return(<div key={b.id} onClick={()=>router.push("/invoice?id="+b.id)} style={{background:"#fff",borderRadius:12,padding:16,boxShadow:"0 2px 8px rgba(0,0,0,0.06)",cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontWeight:700,color:"#1a6fc4",fontSize:14}}>{b.reservation_no}</span>
              <span className="badge" style={{background:sc.bg,color:sc.color}}>{b.status}</span>
            </div>
            <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>{b.booker_name} / {stuNames(b.students)}</div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#6b7c93"}}>
              <span>체크인: {b.checkin_date||"미정"}</span>
              <span style={{fontWeight:700,color:"#1a1a2e"}}>{fmt(b.base_price)}</span>
            </div>
          </div>);
        })}
      </div>
    </>)}

    {/* ── 탭3: 영수증 ── */}
    {mainTab==="receipt"&&(<>
      <div className="tbl-w"><table className="tbl"><thead><tr>
        <th>예약번호</th><th>예약자명</th><th>학생이름</th><th>체크인</th><th>최종금액</th>
      </tr></thead><tbody>
        {rcpList.length===0?<tr><td colSpan={5} className="empty">영수증 발행 내역이 없습니다.</td></tr>:
        rcpList.map(b=>(
          <tr key={b.id} onClick={()=>window.open("/receipt?id="+b.id,"_blank")}>
            <td style={{fontWeight:600,color:"#1a6fc4"}}>{b.reservation_no}</td>
            <td>{b.booker_name}</td><td>{stuNames(b.students)}</td>
            <td>{b.checkin_date||"미정"}</td>
            <td style={{fontWeight:700}}>{fmt(b.final_price)}</td>
          </tr>
        ))}
      </tbody></table></div>
      <div className="mob-cards" style={{display:"none",flexDirection:"column",gap:12}}>
        {rcpList.length===0?<div className="empty">영수증 발행 내역이 없습니다.</div>:
        rcpList.map(b=>(
          <div key={b.id} onClick={()=>window.open("/receipt?id="+b.id,"_blank")} style={{background:"#fff",borderRadius:12,padding:16,boxShadow:"0 2px 8px rgba(0,0,0,0.06)",cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontWeight:700,color:"#1a6fc4",fontSize:14}}>{b.reservation_no}</span>
              <span style={{fontWeight:700}}>{fmt(b.final_price)}</span>
            </div>
            <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>{b.booker_name}</div>
            <div style={{fontSize:13,color:"#6b7c93"}}>{stuNames(b.students)} · 체크인: {b.checkin_date||"미정"}</div>
          </div>
        ))}
      </div>
    </>)}

    {/* ── 탭4: 확정 예약 (스프레드시트) ── */}
    {mainTab==="confirm"&&(()=>{
      const q=confirmSearch.toLowerCase();
      const searched=confirmFiltered.filter(b=>{
        if(!q)return true;
        return [b.reservation_no,b.booker_name,stuNames(b.students),b.assignee,b.agency,b.pickup_place,b.drop_off,b.special_request,b.accom_type,b.house_no].some(v=>v&&v.toLowerCase().includes(q));
      });
      const cols:{key:string;label:string;get:(b:Booking)=>string|number}[]=[
        {key:"reservation_no",label:"예약번호",get:b=>shortNo(b.reservation_no)},
        {key:"assignee",label:"담당자",get:b=>b.assignee||"-"},
        {key:"booker_name",label:"예약자/학생",get:b=>b.booker_name},
        {key:"checkin_date",label:"체크인",get:b=>b.checkin_date||"-"},
        {key:"checkout_date",label:"체크아웃",get:b=>b.checkout_date||"-"},
        {key:"dday",label:"D-day",get:b=>{const d=getDday(b.checkin_date);return d?parseInt(d.label.replace(/[^-\d]/g,""))||0:9999;}},
        {key:"accom",label:"숙소/룸",get:b=>(b.accom_type||"")+(b.house_no?` ${b.house_no}`:"")+(b.accom_room?` ${b.accom_room}`:"")},
        {key:"aca_start",label:"아카데미시작",get:b=>acaStart(b)},
        {key:"aca_end",label:"아카데미종료",get:b=>acaEnd(b)},
        {key:"flight_in",label:"항공IN",get:b=>b.flight_in||"-"},
        {key:"flight_out",label:"항공OUT",get:b=>b.flight_out||"-"},
        {key:"pickup_place",label:"픽업장소",get:b=>b.pickup_place||"-"},
        {key:"drop_off",label:"드랍장소",get:b=>b.drop_off||"-"},
        {key:"agency",label:"유학원",get:b=>b.agency||"-"},
        {key:"balance_date",label:"잔금일",get:b=>b.balance_date||"-"},
        {key:"price",label:"금액",get:b=>b.final_price||b.base_price||0},
        {key:"special_request",label:"특이사항",get:b=>b.special_request||"-"},
      ];
      const sorted=[...searched].sort((a,b)=>{
        const {key,asc}=confirmSort;
        let va:any,vb:any;
        const col=cols.find(c=>c.key===key);
        if(col){va=col.get(a);vb=col.get(b);}
        else if(key==="confirmed"){va=a.confirmed?1:0;vb=b.confirmed?1:0;}
        else{va="";vb="";}
        if(typeof va==="number"&&typeof vb==="number")return asc?va-vb:vb-va;
        return asc?String(va).localeCompare(String(vb)):String(vb).localeCompare(String(va));
      });
      const toggleSort=(key:string)=>setConfirmSort(prev=>prev.key===key?{key,asc:!prev.asc}:{key,asc:true});
      const arrow=(key:string)=>confirmSort.key===key?(confirmSort.asc?"▲":"▼"):"⇅";
      const arrowCls=(key:string)=>confirmSort.key===key?"arr ac":"arr";
      return(<>
        <div className="sub-tabs">
          {confirmStatuses.map(t=><button key={t} className={`sub-tab${confirmFilter===t?" ac":""}`} onClick={()=>setConfirmFilter(t)}>{t} {t!=="전체"&&<>({confirmList.filter(b=>b.status===t).length})</>}</button>)}
        </div>
        <div className="cf-search">
          <input placeholder="🔍 예약자, 학생, 유학원, 예약번호 검색..." value={confirmSearch} onChange={e=>setConfirmSearch(e.target.value)}/>
          <span className="cnt">{sorted.length}건</span>
        </div>
        <div className="ss-w"><table className="ss"><thead><tr>
          {cols.map(c=><th key={c.key} onClick={()=>toggleSort(c.key)}>{c.label}<span className={arrowCls(c.key)}>{arrow(c.key)}</span></th>)}
          <th onClick={()=>toggleSort("confirmed")}>최종확인<span className={arrowCls("confirmed")}>{arrow("confirmed")}</span></th>
        </tr></thead><tbody>
          {sorted.length===0?<tr><td colSpan={cols.length+1} className="empty">확정 예약이 없습니다.</td></tr>:
          sorted.map(b=>{
            const dday=getDday(b.checkin_date);
            const bdday=getBalanceDday(b.balance_date);
            return(<tr key={b.id} className={b.confirmed?"confirmed-row":""} onClick={()=>router.push("/invoice?id="+b.id)} style={{cursor:"pointer"}}>
              <td style={{fontWeight:700,color:"#1a6fc4"}}>{shortNo(b.reservation_no)}</td>
              <td>{b.assignee||"-"}</td>
              <td>
                <div style={{fontWeight:600}}>{b.booker_name}</div>
                <div style={{color:"#6b7c93",fontSize:10}}>{stuNames(b.students)}</div>
              </td>
              <td style={{fontWeight:600}}>{b.checkin_date||"-"}</td>
              <td>{b.checkout_date||"-"}</td>
              <td>{dday&&<span className="dday" style={{color:dday.color,background:dday.color+"15"}}>{dday.label}</span>}{bdday&&<div style={{fontSize:9,color:bdday.color,fontWeight:700,marginTop:1}}>{bdday.label}</div>}</td>
              <td>{(b.accom_type||"")+(b.house_no?` ${b.house_no}`:"")+(b.accom_room?` ${b.accom_room}`:"")||"-"}</td>
              <td>{acaStart(b)}</td>
              <td>{acaEnd(b)}</td>
              <td>{b.flight_in||"-"}</td>
              <td>{b.flight_out||"-"}</td>
              <td>{b.pickup_place||"-"}</td>
              <td>{b.drop_off||"-"}</td>
              <td>{b.agency||"-"}</td>
              <td>{b.balance_date||"-"}</td>
              <td style={{fontWeight:700}}>{fmt(b.final_price||b.base_price)}</td>
              <td className="wrap">{b.special_request||"-"}</td>
              <td onClick={e=>e.stopPropagation()} style={{textAlign:"center"}}>
                <input type="checkbox" className="chk" checked={!!b.confirmed} onChange={async e=>{
                  const v=e.target.checked;
                  await supabase.from("bookings").update({confirmed:v}).eq("id",b.id);
                  setBookings(prev=>prev.map(x=>x.id===b.id?{...x,confirmed:v}:x));
                }}/>
              </td>
            </tr>);
          })}
        </tbody></table></div>
      </>);
    })()}

    {/* ── 탭5: 견적계산기 ── */}
    {mainTab==="estimate"&&<EstimateCalc/>}
  </div>
  </>);
}
