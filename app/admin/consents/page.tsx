"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed, getAdminInfo } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

interface Row {
  id: string; public_token?: string; consent_type?: string; type_label?: string; readonly?: boolean;
  applicant_name?: string | null; phone?: string | null; email?: string | null; child?: string | null;
  room?: string | null; month?: string | null; insta?: string | null; blog?: string | null;
  agreed_items?: unknown; signature?: string | null; signer_name?: string | null;
  status?: string; submitted_at?: string | null; created_at?: string; reservation_no?: string | null; agreed_text?: string | null;
}
interface Bk { id: string; booker_name: string | null; reservation_no: string | null; }

const fmt = (iso?: string | null) => { if (!iso) return "–"; const d = new Date(iso); return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${("0" + d.getHours()).slice(-2)}:${("0" + d.getMinutes()).slice(-2)}`; };

export default function ConsentsAdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"experience" | "booking">("experience");
  const [rows, setRows] = useState<Row[]>([]);
  const [bookings, setBookings] = useState<Bk[]>([]);
  const [q, setQ] = useState("");
  const [toast, setToast] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<Row | null>(null);
  const [cf, setCf] = useState({ applicant_name: "", phone: "", child: "", room: "", month: "", booking_id: "" });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (t: "experience" | "booking") => {
    const r = await fetch(`/api/admin/consents?type=${t}`);
    const j = await r.json();
    setRows(j.rows || []);
  }, []);

  useEffect(() => {
    if (!isAdminAuthed()) { window.location.href = "/login"; return; }
    setReady(true);
    load("experience");
    supabase.from("bookings").select("id, booker_name, reservation_no").order("created_at", { ascending: false }).limit(500).then(({ data }) => setBookings((data || []) as Bk[]));
  }, [load]);

  function flash(m: string) { setToast(m); setTimeout(() => setToast(""), 3000); }
  function switchTab(t: "experience" | "booking") { setTab(t); setQ(""); load(t); }

  async function create() {
    const nm = cf.applicant_name.trim();
    if (!nm) { flash("신청자(보호자) 성함을 입력해 주세요."); return; }
    setCreating(true);
    const r = await fetch("/api/admin/consents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consent_type: "experience", applicant_name: nm, phone: cf.phone, child: cf.child, room: cf.room, month: cf.month, booking_id: cf.booking_id || null }) });
    setCreating(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { flash("생성 실패: " + (j.error || "")); return; }
    const url = `${window.location.origin}/consent/${j.public_token}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    flash("동의서 생성 + 링크 복사됨 → 엄마에게 전송: " + url);
    setCf({ applicant_name: "", phone: "", child: "", room: "", month: "", booking_id: "" });
    setCreateOpen(false);
    load("experience");
  }

  function copyLink(token?: string) { if (!token) return; const url = `${window.location.origin}/consent/${token}`; navigator.clipboard?.writeText(url).then(() => flash("링크 복사됨: " + url)).catch(() => flash(url)); }
  async function del(id: string) { if (!window.confirm("이 동의서를 삭제할까요?")) return; await fetch(`/api/admin/consents?id=${id}`, { method: "DELETE" }); load(tab); }

  function csv() {
    const head = ["제출일시", "신청자", "연락처", "이메일", "자녀", "숙소", "기수", "인스타", "블로그", "서명자", "동의항목수", "상태"];
    const lines = filtered.map(r => [fmt(r.submitted_at), r.applicant_name, r.phone, r.email, r.child, r.room, r.month, r.insta, r.blog, r.signer_name, Array.isArray(r.agreed_items) ? r.agreed_items.length : 0, r.status === "submitted" ? "제출됨" : "미제출"].map(v => `"${(v ?? "").toString().replace(/"/g, '""')}"`).join(","));
    const blob = new Blob(["﻿" + [head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `동의서_${tab}_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  }

  const ql = q.trim().toLowerCase();
  const filtered = rows.filter(r => !ql || `${r.applicant_name || ""}${r.phone || ""}${r.insta || ""}${r.child || ""}`.toLowerCase().includes(ql));
  const submittedCnt = rows.filter(r => r.status === "submitted").length;
  const todayCnt = rows.filter(r => r.submitted_at && new Date(r.submitted_at).toDateString() === new Date().toDateString()).length;

  if (!ready) return null;

  return (<>
    <style>{`
.cadmin{--ink:#1E1B16;--sub:#6B6453;--line:#E7E2D6;--yel:#FFCB36;--blue:#2E75B6;--teal:#138A63;--red:#E8472C;--bg:#F4F1E9;--card:#fff;background:var(--bg);color:var(--ink);font-family:'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif;min-height:100vh}
.cadmin .app{display:flex;min-height:100vh}
.cadmin aside{width:240px;background:#23201A;color:#EDE7D8;padding:22px 0;flex:0 0 auto}
.cadmin aside .logo{font-size:15px;font-weight:700;padding:0 22px 18px;border-bottom:1px solid #3A3630}.cadmin aside .logo span{color:#FFCB36}
.cadmin aside h4{font-size:12px;color:#8E8676;letter-spacing:.05em;margin:20px 22px 8px}
.cadmin .navitem{display:flex;justify-content:space-between;align-items:center;padding:11px 22px;font-size:14.5px;cursor:pointer;border-left:3px solid transparent}
.cadmin .navitem:hover{background:#2D2A23}.cadmin .navitem.active{background:#2D2A23;border-left-color:var(--yel);color:#fff;font-weight:600}
.cadmin .navitem .cnt{background:#3A3630;color:#CFC7B5;font-size:12px;padding:1px 9px;border-radius:11px}.cadmin .navitem.add{color:#8E8676}
.cadmin main{flex:1;padding:24px 28px;min-width:0}
.cadmin .top{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px}
.cadmin h1{font-size:21px;margin:0}.cadmin h1 small{font-size:13px;color:var(--sub);font-weight:400;margin-left:8px}
.cadmin .tools{display:flex;gap:8px;flex-wrap:wrap}
.cadmin input[type=search],.cadmin .fin{padding:9px 12px;border:1px solid #D6D0C2;border-radius:9px;font-size:14px;font-family:inherit;background:#fff;box-sizing:border-box}
.cadmin .btn{background:#fff;border:1px solid #D6D0C2;border-radius:9px;padding:9px 14px;font-size:14px;cursor:pointer;font-family:inherit}
.cadmin .btn.pri{background:var(--blue);color:#fff;border:none}.cadmin .btn.csv{background:var(--teal);color:#fff;border:none}
.cadmin .stats{display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap}
.cadmin .stat{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 16px;min-width:120px}
.cadmin .stat .lab{font-size:12px;color:var(--sub)}.cadmin .stat .val{font-size:22px;font-weight:700;margin-top:2px}
.cadmin .crt{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:14px;display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end}
.cadmin .crt .fld{display:flex;flex-direction:column;gap:3px}.cadmin .crt .fld span{font-size:11px;color:var(--sub)}
.cadmin table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.cadmin th,.cadmin td{text-align:left;padding:11px 12px;font-size:13.5px;border-bottom:1px solid var(--line)}
.cadmin th{background:#FAF8F1;font-size:12px;color:var(--sub);font-weight:600}
.cadmin tbody tr{cursor:pointer}.cadmin tbody tr:hover{background:#FCFAF3}
.cadmin .pill{display:inline-block;font-size:11.5px;font-weight:700;padding:3px 10px;border-radius:11px}
.cadmin .pill.ok{background:#E4F4EE;color:#0C5840}.cadmin .pill.wait{background:#FBEFD3;color:#7A5A00}
.cadmin .empty{text-align:center;color:var(--sub);padding:40px 20px;font-size:14px}
.cadmin .mask{position:fixed;inset:0;background:rgba(20,16,10,.45);z-index:9;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow:auto}
.cadmin .modal{background:#fff;border-radius:16px;max-width:560px;width:100%;padding:24px 26px}
.cadmin .modal h2{margin:0 0 4px;font-size:18px}.cadmin .modal .t{font-size:13px;color:var(--sub);margin:0 0 16px}
.cadmin .kv{display:flex;font-size:13.5px;padding:6px 0;border-bottom:1px solid var(--line)}.cadmin .kv .k{width:110px;color:var(--sub);flex:0 0 auto}.cadmin .kv .v{flex:1;word-break:break-all}
.cadmin .agreebox{background:#F4FBF8;border:1px solid #BFE6D6;border-radius:10px;padding:12px 14px;margin-top:12px}.cadmin .agreebox div{font-size:13px;margin:4px 0;color:#0C5840}
.cadmin .sigwrap img{width:100%;max-height:170px;object-fit:contain;border:1px solid var(--line);border-radius:10px;background:#fff;margin-top:6px}
.cadmin .mclose{float:right;background:none;border:none;font-size:22px;color:var(--sub);cursor:pointer;line-height:1}
@media(max-width:720px){.cadmin aside{display:none}.cadmin main{padding:16px}}
    `}</style>
    <div className="cadmin"><div className="app">
      <aside>
        <div className="logo" onClick={() => router.push("/admin/hub")} style={{ cursor: "pointer" }}>DREAM <span>ADMIN</span> · 동의서함</div>
        <h4>동의서 종류</h4>
        <div className={`navitem${tab === "experience" ? " active" : ""}`} onClick={() => switchTab("experience")}>체험단 동의서 <span className="cnt">{tab === "experience" ? rows.length : ""}</span></div>
        <div className={`navitem${tab === "booking" ? " active" : ""}`} onClick={() => switchTab("booking")}>부킹 동의 <span className="cnt">{tab === "booking" ? rows.length : ""}</span></div>
        <h4>향후 추가 예정</h4>
        <div className="navitem add">개인정보 수집 동의 <span className="cnt">–</span></div>
        <div className="navitem add">초상권 사용 동의 <span className="cnt">–</span></div>
        <div className="navitem add">+ 새 동의서 양식</div>
      </aside>

      <main>
        <div className="top">
          <h1>{tab === "experience" ? "체험단 동의서" : "부킹 동의"} <small>{tab === "experience" ? "1:1 발송 · 제출 현황" : "부킹 폼 동의 (읽기전용)"}</small></h1>
          <div className="tools">
            <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="이름·연락처·인스타 검색" />
            {tab === "experience" && <button className="btn pri" onClick={() => setCreateOpen(o => !o)}>+ 새 동의서 발송</button>}
            <button className="btn csv" onClick={csv}>CSV</button>
          </div>
        </div>

        {tab === "experience" && createOpen && (
          <div className="crt">
            <div className="fld"><span>신청자(부모) *</span><input className="fin" value={cf.applicant_name} onChange={e => setCf({ ...cf, applicant_name: e.target.value })} placeholder="성함" /></div>
            <div className="fld"><span>연락처</span><input className="fin" value={cf.phone} onChange={e => setCf({ ...cf, phone: e.target.value })} placeholder="010-" /></div>
            <div className="fld"><span>자녀</span><input className="fin" value={cf.child} onChange={e => setCf({ ...cf, child: e.target.value })} placeholder="이름/나이" /></div>
            <div className="fld"><span>숙소</span><input className="fin" value={cf.room} onChange={e => setCf({ ...cf, room: e.target.value })} placeholder="드림하우스" /></div>
            <div className="fld"><span>기수</span><input className="fin" value={cf.month} onChange={e => setCf({ ...cf, month: e.target.value })} placeholder="10월" /></div>
            <div className="fld"><span>예약 연결(선택)</span><select className="fin" value={cf.booking_id} onChange={e => { const b = bookings.find(x => x.id === e.target.value); setCf({ ...cf, booking_id: e.target.value, applicant_name: cf.applicant_name || (b?.booker_name || "") }); }}><option value="">없음</option>{bookings.map(b => <option key={b.id} value={b.id}>{b.booker_name} · {b.reservation_no}</option>)}</select></div>
            <button className="btn pri" onClick={create} disabled={creating} style={{ height: 38 }}>{creating ? "생성 중…" : "발송 생성 + 링크복사"}</button>
          </div>
        )}

        {toast && <div style={{ background: "#1e293b", color: "#fff", borderRadius: 9, padding: "9px 14px", fontSize: 12.5, marginBottom: 12, wordBreak: "break-all" }}>{toast}</div>}

        <div className="stats">
          <div className="stat"><div className="lab">총 건수</div><div className="val">{rows.length}</div></div>
          <div className="stat"><div className="lab">제출됨</div><div className="val">{submittedCnt}</div></div>
          <div className="stat"><div className="lab">오늘 제출</div><div className="val">{todayCnt}</div></div>
        </div>

        <table>
          <thead><tr><th>{tab === "booking" ? "동의일" : "발송/동의일"}</th><th>신청자</th><th>자녀</th><th>연락처</th><th>{tab === "booking" ? "예약번호" : "숙소/기수"}</th><th>인스타</th><th>상태</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={8} className="empty">{tab === "experience" ? "아직 동의서가 없습니다. + 새 동의서 발송으로 링크를 만들어 보내세요." : "부킹 동의 내역이 없습니다."}</td></tr> :
              filtered.map(r => (
                <tr key={r.id} onClick={() => setDetail(r)}>
                  <td>{fmt(r.submitted_at || r.created_at)}</td>
                  <td><b>{r.applicant_name || "–"}</b></td>
                  <td>{r.child || "–"}</td>
                  <td>{r.phone || "–"}</td>
                  <td>{tab === "booking" ? (r.reservation_no || "–") : `${r.room || "–"} / ${r.month || "–"}`}</td>
                  <td style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.insta || "–"}</td>
                  <td>{r.status === "submitted" ? <span className="pill ok">제출됨</span> : <span className="pill wait">미제출</span>}</td>
                  <td onClick={e => e.stopPropagation()} style={{ whiteSpace: "nowrap" }}>
                    {!r.readonly && r.public_token && <button className="btn" style={{ padding: "5px 9px", fontSize: 11.5 }} onClick={() => copyLink(r.public_token)}>🔗 링크</button>}
                    {!r.readonly && <button className="btn" style={{ padding: "5px 9px", fontSize: 11.5, marginLeft: 4, color: "#dc2626", borderColor: "#fecaca" }} onClick={() => del(r.id)}>삭제</button>}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </main>

      {detail && (
        <div className="mask" onClick={e => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div className="modal">
            <button className="mclose" onClick={() => setDetail(null)}>×</button>
            <h2>{detail.child || ""} {detail.applicant_name ? `· ${detail.applicant_name}` : ""}</h2>
            <p className="t">{detail.type_label || "체험단 참가 계약 및 동의서"}</p>
            <div className="kv"><div className="k">제출 일시</div><div className="v">{detail.submitted_at ? fmt(detail.submitted_at) : "미제출"}</div></div>
            <div className="kv"><div className="k">신청자(부모)</div><div className="v">{detail.applicant_name || "–"}</div></div>
            <div className="kv"><div className="k">연락처</div><div className="v">{detail.phone || "–"}</div></div>
            {!detail.readonly && <div className="kv"><div className="k">이메일</div><div className="v">{detail.email || "–"}</div></div>}
            <div className="kv"><div className="k">자녀</div><div className="v">{detail.child || "–"}</div></div>
            {detail.readonly ? <div className="kv"><div className="k">예약번호</div><div className="v">{detail.reservation_no || "–"}</div></div> : <div className="kv"><div className="k">숙소 / 기수</div><div className="v">{detail.room || "–"} / {detail.month || "–"}</div></div>}
            {!detail.readonly && <div className="kv"><div className="k">인스타그램</div><div className="v">{detail.insta || "–"}</div></div>}
            {!detail.readonly && <div className="kv"><div className="k">블로그/카페</div><div className="v">{detail.blog || "–"}</div></div>}
            {Array.isArray(detail.agreed_items) && detail.agreed_items.length > 0 && (
              <div className="agreebox"><b style={{ fontSize: 13, color: "#0C5840" }}>동의한 항목</b>{(detail.agreed_items as string[]).map((x, i) => <div key={i}>✓ {x}</div>)}</div>
            )}
            {detail.agreed_text && <div className="agreebox"><b style={{ fontSize: 13, color: "#0C5840" }}>동의 문구</b><div>{detail.agreed_text}</div></div>}
            {detail.signature && <div className="sigwrap"><b style={{ fontSize: 13, color: "#6B6453" }}>법정대리인 서명 ({detail.signer_name || ""})</b><br /><img src={detail.signature} alt="서명" /></div>}
          </div>
        </div>
      )}
    </div></div>
  </>);
}
