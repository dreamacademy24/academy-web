"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { isAdminAuthed } from "@/lib/adminAuth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Student {
  id: string; booking_id: string; name_kr: string; name_en: string;
  age: string; level: string; class_type: string;
  academy_start: string; academy_end: string;
  pickup_location: string; address_detail: string; ssp: boolean;
  photo_allowed: boolean; special_request: string;
  bookings_new: { booker_name: string; check_in: string; booking_type: string } | null;
}

type Filter = "all" | "kinder" | "junior";

export default function StudentsPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [detail, setDetail] = useState<Student | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("students")
      .select("*, bookings_new(booker_name, check_in, booking_type)")
      .order("name_kr");
    if (data) setStudents(data as Student[]);
  }, []);

  useEffect(() => { if (isAdminAuthed()) setAuthed(true); else if (typeof window !== "undefined") window.location.href = "/admin"; }, []);
  useEffect(() => { if (authed) load(); }, [authed, load]);

  const filtered = students.filter(s => {
    if (filter === "kinder" && s.level !== "kinder") return false;
    if (filter === "junior" && s.level !== "junior") return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name_kr?.toLowerCase().includes(q) || s.name_en?.toLowerCase().includes(q)
      || (s.bookings_new as unknown as { booker_name: string } | null)?.booker_name?.toLowerCase().includes(q);
  });

  const cntAll = students.length;
  const cntKinder = students.filter(s => s.level === "kinder").length;
  const cntJunior = students.filter(s => s.level === "junior").length;

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.st-w{max-width:1000px;margin:0 auto;padding:32px 24px}
.st-top{display:flex;align-items:center;gap:12px;margin-bottom:24px}
.st-back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.st-back:hover{background:#e2e8f0}
.st-top h1{font-size:22px;font-weight:800;flex:1}
.stats{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.stat{padding:10px 18px;border-radius:10px;font-size:12px;border:1px solid #e2e8f0;background:#fff}
.stat .num{font-size:18px;font-weight:800;margin-top:2px}
.toolbar{display:flex;gap:8px;margin-bottom:16px;align-items:center;flex-wrap:wrap}
.toolbar input{padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;outline:none;flex:1;min-width:160px}.toolbar input:focus{border-color:#1a6fc4}
.btn-sm{padding:6px 14px;font-size:12px;font-weight:600;border:1px solid #e2e8f0;border-radius:7px;cursor:pointer;font-family:inherit;background:#f1f5f9;color:#475569}.btn-sm:hover{background:#e2e8f0}
.btn-on{background:#1a6fc4;color:#fff;border-color:#1a6fc4}
.cnt{font-size:13px;color:#6b7c93;margin-left:auto}
.sec{background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.05);overflow-x:auto}
.tbl{width:100%;border-collapse:collapse;font-size:13px;min-width:800px}
.tbl th{background:#f8fafc;padding:10px 10px;text-align:left;font-weight:700;font-size:12px;color:#6b7c93;border-bottom:2px solid #e2e8f0;white-space:nowrap}
.tbl td{padding:10px 10px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
.tbl tr{cursor:pointer}.tbl tr:hover{background:#f8fafc}
.badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700}
.b-kinder{background:#e0e7ff;color:#3730a3}.b-junior{background:#fef3c7;color:#92400e}.b-none{background:#f1f5f9;color:#94a3b8}
.empty{text-align:center;padding:40px;color:#94a3b8;font-size:14px}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:100;padding:24px}
.modal{background:#fff;border-radius:16px;padding:28px;width:100%;max-width:480px;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.15)}
.modal h3{font-size:18px;font-weight:800;margin-bottom:20px}
.d-row{display:flex;gap:8px;margin-bottom:10px;font-size:13px}.d-lbl{font-weight:700;color:#6b7c93;min-width:80px}.d-val{color:#1a1a2e}
.modal-close{margin-top:16px;width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px;background:#f1f5f9;font-weight:700;cursor:pointer;font-family:inherit;font-size:13px}.modal-close:hover{background:#e2e8f0}
@media(max-width:600px){.st-w{padding:20px 12px}.stats{flex-direction:column}.toolbar{flex-direction:column;align-items:stretch}}
    `}</style>
    <div className="st-w">
      <div className="st-top">
        <button className="st-back" onClick={() => router.push("/admin/hub")}>←</button>
        <h1>학생 관리</h1>
      </div>

      <div className="stats">
        <div className="stat"><div style={{ color: "#6b7c93" }}>전체</div><div className="num">{cntAll}</div></div>
        <div className="stat" style={{ background: "#e0e7ff", borderColor: "#c7d2fe" }}><div style={{ color: "#3730a3" }}>킨더</div><div className="num" style={{ color: "#3730a3" }}>{cntKinder}</div></div>
        <div className="stat" style={{ background: "#fef3c7", borderColor: "#fde68a" }}><div style={{ color: "#92400e" }}>주니어</div><div className="num" style={{ color: "#92400e" }}>{cntJunior}</div></div>
      </div>

      <div className="toolbar">
        {([["all","전체"],["kinder","킨더"],["junior","주니어"]] as const).map(([k,v]) => (
          <button key={k} className={`btn-sm${filter === k ? " btn-on" : ""}`} onClick={() => setFilter(k as Filter)}>{v}</button>
        ))}
        <input placeholder="학생이름, 예약자명 검색" value={search} onChange={e => setSearch(e.target.value)} />
        <span className="cnt">{filtered.length}명</span>
      </div>

      <div className="sec">
        {filtered.length === 0 ? (
          <div className="empty">학생 데이터가 없습니다</div>
        ) : (
          <table className="tbl">
            <thead><tr><th>한글이름</th><th>영어이름</th><th>나이</th><th>과정</th><th>예약자</th><th>체크인</th><th>아카데미 시작</th><th>아카데미 종료</th></tr></thead>
            <tbody>
              {filtered.map(s => {
                const bk = s.bookings_new as unknown as { booker_name: string; check_in: string } | null;
                return (
                  <tr key={s.id} onClick={() => setDetail(s)}>
                    <td style={{ fontWeight: 700 }}>{s.name_kr || "-"}</td>
                    <td>{s.name_en || "-"}</td>
                    <td>{s.age || "-"}</td>
                    <td><span className={`badge ${s.level === "kinder" ? "b-kinder" : s.level === "junior" ? "b-junior" : "b-none"}`}>{s.level === "kinder" ? "킨더" : s.level === "junior" ? "주니어" : "-"}</span></td>
                    <td>{bk?.booker_name || "-"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{bk?.check_in || "-"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{s.academy_start || "-"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{s.academy_end || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>

    {detail && (
      <div className="overlay" onClick={() => setDetail(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <h3>{detail.name_kr} {detail.name_en ? `(${detail.name_en})` : ""}</h3>
          <div className="d-row"><span className="d-lbl">나이</span><span className="d-val">{detail.age || "-"}</span></div>
          <div className="d-row"><span className="d-lbl">과정</span><span className="d-val">{detail.level === "kinder" ? "킨더" : detail.level === "junior" ? "주니어" : "-"}</span></div>
          <div className="d-row"><span className="d-lbl">수업유형</span><span className="d-val">{detail.class_type === "morning" ? "오전반" : detail.class_type === "fullday" ? "종일반" : "-"}</span></div>
          <div className="d-row"><span className="d-lbl">예약자</span><span className="d-val">{(detail.bookings_new as unknown as { booker_name: string } | null)?.booker_name || "-"}</span></div>
          <div className="d-row"><span className="d-lbl">체크인</span><span className="d-val">{(detail.bookings_new as unknown as { check_in: string } | null)?.check_in || "-"}</span></div>
          <div className="d-row"><span className="d-lbl">아카데미</span><span className="d-val">{detail.academy_start || "-"} ~ {detail.academy_end || "-"}</span></div>
          <div className="d-row"><span className="d-lbl">픽드랍</span><span className="d-val">{detail.pickup_location || "-"}</span></div>
          <div className="d-row"><span className="d-lbl">주소</span><span className="d-val">{detail.address_detail || "-"}</span></div>
          <div className="d-row"><span className="d-lbl">SSP</span><span className="d-val">{detail.ssp ? "O" : "X"}</span></div>
          <div className="d-row"><span className="d-lbl">사진허용</span><span className="d-val">{detail.photo_allowed ? "O" : "X"}</span></div>
          {detail.special_request && <div className="d-row"><span className="d-lbl">특이사항</span><span className="d-val">{detail.special_request}</span></div>}
          <button className="modal-close" onClick={() => setDetail(null)}>닫기</button>
        </div>
      </div>
    )}
  </>);
}
