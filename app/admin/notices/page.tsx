"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/adminAuth";

interface Notice {
  id: string; category: string; title: string; content: string;
  popup: boolean; audience: string; target_ids: string[]; created_at: string;
}
interface Bk { id: string; booker_name: string | null; reservation_no: string | null; checkin_date: string | null; }

const BLANK = { id: "", category: "general", title: "", content: "", popup: false, audience: "all", target_ids: [] as string[] };

export default function AdminNoticesPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [list, setList] = useState<Notice[]>([]);
  const [bookings, setBookings] = useState<Bk[]>([]);
  const [form, setForm] = useState({ ...BLANK });
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { if (!isAdminAuthed()) { router.replace("/login"); return; } setAuthed(true); }, [router]);

  const load = useCallback(async () => {
    const [n, b] = await Promise.all([
      supabase.from("portal_notices").select("*").order("created_at", { ascending: false }),
      supabase.from("bookings").select("id, booker_name, reservation_no, checkin_date").order("checkin_date", { ascending: false }),
    ]);
    setList((n.data || []) as Notice[]);
    setBookings((b.data || []) as Bk[]);
  }, []);
  useEffect(() => { if (authed) load(); }, [authed, load]);

  function edit(n: Notice) {
    setForm({ id: n.id, category: n.category || "general", title: n.title || "", content: n.content || "", popup: !!n.popup, audience: n.audience || "all", target_ids: Array.isArray(n.target_ids) ? n.target_ids : [] });
    setMsg(""); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function reset() { setForm({ ...BLANK }); setMsg(""); }
  function toggleTarget(id: string) {
    setForm((f) => ({ ...f, target_ids: f.target_ids.includes(id) ? f.target_ids.filter((x) => x !== id) : [...f.target_ids, id] }));
  }

  async function save() {
    if (!form.title.trim() || !form.content.trim()) { setMsg("제목과 내용을 입력하세요."); return; }
    if (form.audience === "selected" && form.target_ids.length === 0) { setMsg("특정 대상을 1명 이상 선택하세요."); return; }
    setSaving(true); setMsg("");
    const payload = {
      category: form.category, title: form.title.trim(), content: form.content.trim(),
      popup: form.popup, audience: form.audience,
      target_ids: form.audience === "selected" ? form.target_ids : [],
    };
    const res = form.id
      ? await supabase.from("portal_notices").update(payload).eq("id", form.id)
      : await supabase.from("portal_notices").insert(payload);
    setSaving(false);
    if (res.error) { setMsg("저장 실패: " + res.error.message); return; }
    // 신규 발행 시에만 폰 푸시 전송 (수정은 재알림 안 함) — best-effort
    if (!form.id) {
      fetch("/api/portal/push/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: payload.title, body: payload.content, audience: payload.audience, target_ids: payload.target_ids, url: "/portal/notices" }),
      }).catch(() => {});
    }
    reset(); await load();
  }
  async function del(id: string) {
    if (!confirm("이 공지를 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("portal_notices").delete().eq("id", id);
    if (error) { alert("삭제 실패: " + error.message); return; }
    if (form.id === id) reset();
    await load();
  }

  if (!authed) return null;
  const filtered = bookings.filter((b) => { const q = search.trim().toLowerCase(); if (!q) return true; return (b.booker_name || "").toLowerCase().includes(q) || (b.reservation_no || "").toLowerCase().includes(q); });

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.nw{max-width:880px;margin:0 auto;padding:26px 18px 60px}
.top{display:flex;align-items:center;gap:12px;margin-bottom:18px}
.back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.back:hover{background:#e2e8f0}
.top h1{font-size:20px;font-weight:800;flex:1}
.card{background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,0.05);padding:20px;margin-bottom:16px}
.card h2{font-size:15px;font-weight:800;margin-bottom:14px}
label.fl{display:block;font-size:12px;font-weight:700;color:#6b7c93;margin-bottom:5px}
.in{width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:inherit;outline:none}.in:focus{border-color:#1a6fc4}
textarea.in{min-height:120px;resize:vertical}
.row{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.seg{display:flex;gap:6px}
.seg button{padding:7px 14px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;color:#475569}
.seg button.on{background:#1a6fc4;color:#fff;border-color:#1a6fc4}
.tgt{border:1px solid #e2e8f0;border-radius:8px;max-height:220px;overflow-y:auto;margin-top:6px}
.tgt label{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;cursor:pointer}
.tgt label:hover{background:#f8fafc}
.btn{padding:9px 18px;border-radius:8px;border:none;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
.btn-p{background:#1a6fc4;color:#fff}.btn-g{background:#f1f5f9;color:#475569;border:1px solid #e2e8f0}
.ni{display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid #f1f5f9}
.badge{font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:6px;white-space:nowrap}
.b-imp{background:#fceaeb;color:#a32d2d}.b-gen{background:#eff6ff;color:#1a6fc4}.b-all{background:#dcfce7;color:#166534}.b-sel{background:#fef3c7;color:#92400e}.b-pop{background:#f3e8ff;color:#7c3aed}
.empty{color:#cbd5e1;font-size:13px;text-align:center;padding:24px}
.msg{font-size:12px;color:#dc2626;margin-top:8px;font-weight:600}
`}</style>
    <div className="nw">
      <div className="top">
        <button className="back" onClick={() => router.push("/admin/hub")}>←</button>
        <h1>📢 공지 배포</h1>
      </div>

      <div className="card">
        <h2>{form.id ? "공지 수정" : "새 공지 작성"}</h2>
        <div className="row">
          <div><label className="fl">분류</label>
            <div className="seg">
              <button className={form.category === "general" ? "on" : ""} onClick={() => setForm({ ...form, category: "general" })}>일반</button>
              <button className={form.category === "important" ? "on" : ""} onClick={() => setForm({ ...form, category: "important" })}>중요</button>
            </div>
          </div>
          <div><label className="fl">입장 팝업</label>
            <div className="seg">
              <button className={form.popup ? "on" : ""} onClick={() => setForm({ ...form, popup: true })}>팝업 ON</button>
              <button className={!form.popup ? "on" : ""} onClick={() => setForm({ ...form, popup: false })}>OFF</button>
            </div>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}><label className="fl">제목</label><input className="in" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="공지 제목" /></div>
        <div style={{ marginBottom: 12 }}><label className="fl">내용</label><textarea className="in" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="공지 내용을 입력하세요" /></div>

        <div><label className="fl">대상</label>
          <div className="seg">
            <button className={form.audience === "all" ? "on" : ""} onClick={() => setForm({ ...form, audience: "all" })}>전체 손님</button>
            <button className={form.audience === "selected" ? "on" : ""} onClick={() => setForm({ ...form, audience: "selected" })}>특정 손님</button>
          </div>
        </div>
        {form.audience === "selected" && (
          <div style={{ marginTop: 10 }}>
            <input className="in" placeholder="예약자명 · 예약번호 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div style={{ fontSize: 12, color: "#6b7c93", margin: "6px 0", fontWeight: 600 }}>선택됨 {form.target_ids.length}명</div>
            <div className="tgt">
              {filtered.length === 0 ? <div className="empty">예약이 없습니다</div> : filtered.slice(0, 100).map((b) => (
                <label key={b.id}>
                  <input type="checkbox" checked={form.target_ids.includes(b.id)} onChange={() => toggleTarget(b.id)} />
                  <span style={{ fontWeight: 700 }}>{b.booker_name || "-"}</span>
                  <span style={{ color: "#94a3b8" }}>{b.reservation_no || ""}</span>
                  <span style={{ color: "#cbd5e1", marginLeft: "auto", fontSize: 11 }}>{(b.checkin_date || "").slice(0, 10)}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {msg && <div className="msg">{msg}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button className="btn btn-p" disabled={saving} onClick={save}>{saving ? "저장 중..." : form.id ? "수정 완료" : "공지 등록"}</button>
          {form.id && <button className="btn btn-g" onClick={reset}>취소</button>}
        </div>
      </div>

      <div className="card">
        <h2>발행된 공지 ({list.length})</h2>
        {list.length === 0 ? <div className="empty">아직 공지가 없습니다.</div> : list.map((n) => (
          <div className="ni" key={n.id}>
            <span className={`badge ${n.category === "important" ? "b-imp" : "b-gen"}`}>{n.category === "important" ? "중요" : "일반"}</span>
            {n.popup && <span className="badge b-pop">팝업</span>}
            <span className={`badge ${n.audience === "selected" ? "b-sel" : "b-all"}`}>{n.audience === "selected" ? `특정 ${(n.target_ids || []).length}명` : "전체"}</span>
            <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</span>
            <span style={{ fontSize: 11, color: "#cbd5e1" }}>{(n.created_at || "").slice(0, 10)}</span>
            <button className="btn btn-g" style={{ padding: "5px 12px", fontSize: 11 }} onClick={() => edit(n)}>수정</button>
            <button className="btn" style={{ padding: "5px 12px", fontSize: 11, background: "#fef2f2", color: "#dc2626" }} onClick={() => del(n.id)}>삭제</button>
          </div>
        ))}
      </div>
    </div>
  </>);
}
