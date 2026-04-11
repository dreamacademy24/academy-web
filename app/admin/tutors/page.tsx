"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/adminAuth";

interface Tutor { id: string; name: string; phone: string; specialty: string; hourly_rate: number; is_active: boolean }
type ModalMode = null | { data?: Tutor };

export default function TutorsPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [modal, setModal] = useState<ModalMode>(null);
  const [form, setForm] = useState({ name: "", phone: "", specialty: "", hourly_rate: 0 });

  const load = useCallback(async () => {
    const { data } = await supabase.from("tutors").select("*").order("name");
    if (data) setTutors(data as Tutor[]);
  }, []);

  useEffect(() => { if (isAdminAuthed()) setAuthed(true); else window.location.href = "/admin"; }, []);
  useEffect(() => { if (authed) load(); }, [authed, load]);

  function openModal(t?: Tutor) {
    setForm({ name: t?.name || "", phone: t?.phone || "", specialty: t?.specialty || "", hourly_rate: t?.hourly_rate ?? 0 });
    setModal(t ? { data: t } : {});
  }

  async function save() {
    if (!form.name.trim()) { alert("이름을 입력하세요."); return; }
    if (modal?.data) {
      await supabase.from("tutors").update({ name: form.name.trim(), phone: form.phone.trim(), specialty: form.specialty.trim(), hourly_rate: form.hourly_rate }).eq("id", modal.data.id);
    } else {
      await supabase.from("tutors").insert({ name: form.name.trim(), phone: form.phone.trim(), specialty: form.specialty.trim(), hourly_rate: form.hourly_rate });
    }
    setModal(null); load();
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from("tutors").update({ is_active: !current }).eq("id", id);
    load();
  }

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.tu-w{max-width:800px;margin:0 auto;padding:40px 24px}
.tu-top{display:flex;align-items:center;gap:12px;margin-bottom:28px}
.tu-back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.tu-back:hover{background:#e2e8f0}
.tu-top h1{font-size:24px;font-weight:800;flex:1}
.btn{padding:10px 18px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:background 150ms}
.btn-blue{background:#1a6fc4;color:#fff}.btn-blue:hover{background:#0d3d7a}
.btn-sm{padding:6px 12px;font-size:12px}
.btn-gray{background:#f1f5f9;color:#475569}.btn-gray:hover{background:#e2e8f0}
.sec{background:#fff;border-radius:14px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.05)}
.tbl{width:100%;border-collapse:collapse;font-size:13px}
.tbl th{background:#f8fafc;padding:10px 12px;text-align:left;font-weight:700;font-size:12px;color:#6b7c93;border-bottom:2px solid #e2e8f0}
.tbl td{padding:10px 12px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
.tbl tr:hover{background:#f8fafc}
.badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700}
.badge-on{background:#dcfce7;color:#166534}.badge-off{background:#fef2f2;color:#dc2626}
.acts{display:flex;gap:6px}
.empty{text-align:center;padding:32px;color:#94a3b8;font-size:14px}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:100;padding:24px}
.modal{background:#fff;border-radius:16px;padding:28px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,0.15)}
.modal h3{font-size:18px;font-weight:800;margin-bottom:20px}
.modal label{display:block;font-size:13px;font-weight:600;color:#475569;margin-bottom:4px}
.modal input{width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:inherit;outline:none;margin-bottom:14px}
.modal input:focus{border-color:#1a6fc4}
.modal-foot{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}
@media(max-width:500px){.tu-w{padding:24px 16px}.tbl{font-size:12px}}
    `}</style>
    <div className="tu-w">
      <div className="tu-top">
        <button className="tu-back" onClick={() => router.push("/admin/hub")}>←</button>
        <h1>튜터 관리</h1>
        <button className="btn btn-blue" onClick={() => openModal()}>+ 튜터 추가</button>
      </div>

      <div className="sec">
        {tutors.length === 0 ? <div className="empty">등록된 튜터가 없습니다</div> : (
          <table className="tbl">
            <thead><tr><th>이름</th><th>연락처</th><th>전공/특기</th><th>시급</th><th>상태</th><th>액션</th></tr></thead>
            <tbody>
              {tutors.map(t => (
                <tr key={t.id} style={t.is_active ? {} : { opacity: 0.5 }}>
                  <td style={{ fontWeight: 700 }}>{t.name}</td>
                  <td>{t.phone || "-"}</td>
                  <td>{t.specialty || "-"}</td>
                  <td>{t.hourly_rate ? t.hourly_rate.toLocaleString() + "원" : "-"}</td>
                  <td><span className={`badge ${t.is_active ? "badge-on" : "badge-off"}`}>{t.is_active ? "활성" : "비활성"}</span></td>
                  <td>
                    <div className="acts">
                      <button className="btn btn-sm btn-gray" onClick={() => openModal(t)}>수정</button>
                      <button className="btn btn-sm btn-gray" onClick={() => toggleActive(t.id, t.is_active)}>{t.is_active ? "비활성화" : "활성화"}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>

    {modal && (
      <div className="overlay" onClick={() => setModal(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <h3>{modal.data ? "튜터 수정" : "튜터 추가"}</h3>
          <label>이름 *</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Amelyn" autoFocus />
          <label>연락처</label>
          <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="09XX-XXX-XXXX" />
          <label>전공/특기</label>
          <input value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} placeholder="English, Math" />
          <label>시간당 단가 (원)</label>
          <input type="number" value={form.hourly_rate || ""} onChange={e => setForm({ ...form, hourly_rate: parseInt(e.target.value) || 0 })} placeholder="0" />
          <div className="modal-foot">
            <button className="btn btn-gray" onClick={() => setModal(null)}>취소</button>
            <button className="btn btn-blue" onClick={save}>저장</button>
          </div>
        </div>
      </div>
    )}
  </>);
}
