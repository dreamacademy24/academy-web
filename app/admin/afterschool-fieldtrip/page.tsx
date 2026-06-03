"use client";
// TODO: fieldtrip_applications 테이블 연결 - 투어셔틀과 동일한 그룹핑 방식으로 신청목록 구현 예정
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";
import AfterFieldDeploy from "./AfterFieldDeploy";

export default function AfterschoolFieldtripAdminPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [mainTab, setMainTab] = useState<"list" | "deploy">("list");

  useEffect(() => {
    if (!isAdminAuthed()) { router.replace("/login"); return; }
    setAuthed(true);
  }, [router]);

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box}
body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.af-w{max-width:1400px;margin:0 auto;padding:24px}
.af-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.af-back{background:none;border:1px solid #cbd5e1;color:#475569;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px;font-family:inherit;font-weight:600}.af-back:hover{background:#fff;color:#1a6fc4}
.af-title{font-size:20px;font-weight:800;color:#1a1a2e}
    `}</style>
    <div className="af-w">
      <div className="af-head">
        <button className="af-back" onClick={() => router.push("/admin/hub")}>← 어드민 홈</button>
        <div>
          <span className="af-title">🎒 애프터스쿨/필드트립 관리</span>
        </div>
        <div style={{ width: 100 }} />
      </div>

      <div style={{display:"flex",gap:6,background:"#fff",padding:4,borderRadius:12,marginBottom:16,boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
        <button
          onClick={() => setMainTab("list")}
          style={{flex:1,padding:"10px 14px",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:mainTab==="list"?"#1a6fc4":"transparent",color:mainTab==="list"?"#fff":"#6b7c93"}}
        >📋 신청목록</button>
        <button
          onClick={() => setMainTab("deploy")}
          style={{flex:1,padding:"10px 14px",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:mainTab==="deploy"?"#1a6fc4":"transparent",color:mainTab==="deploy"?"#fff":"#6b7c93"}}
        >📅 배포</button>
      </div>

      {mainTab === "deploy" ? (
        <AfterFieldDeploy />
      ) : (
        <div style={{background:"#fff",borderRadius:14,padding:"40px 24px",boxShadow:"0 2px 12px rgba(0,0,0,0.05)"}}>
          <div style={{maxWidth:560,margin:"0 auto",padding:"24px 26px",background:"#eff6ff",border:"1px solid #bfdbfe",borderLeft:"4px solid #1a6fc4",borderRadius:12,fontSize:13.5,color:"#1e40af",lineHeight:1.7,textAlign:"center"}}>
            <div style={{fontSize:30,marginBottom:10}}>🎒</div>
            <div style={{fontWeight:800,fontSize:15,marginBottom:8,color:"#1a1a2e"}}>신청목록 준비 중</div>
            <div>손님 애프터스쿨/필드트립 신청폼(fieldtrip_applications) 연결 예정.</div>
            <div>셔틀 작업 완료 후 별도 진행.</div>
          </div>
        </div>
      )}
    </div>
  </>);
}
