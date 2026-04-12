"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";

interface Driver { id: string; name: string; phone: string; is_active: boolean }
interface Vehicle { id: string; name: string; capacity: number; is_active: boolean }
type ModalMode = null | { kind: "driver"; data?: Driver } | { kind: "vehicle"; data?: Vehicle };

export default function DriversPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [modal, setModal] = useState<ModalMode>(null);
  const [form, setForm] = useState<Record<string, string | number>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/drivers");
    if (res.ok) { const d = await res.json(); setDrivers(d.drivers); setVehicles(d.vehicles); }
  }, []);

  useEffect(() => { if (isAdminAuthed()) setAuthed(true); else window.location.href = "/login"; }, []);
  useEffect(() => { if (authed) load(); }, [authed, load]);

  function openModal(kind: "driver" | "vehicle", data?: Driver | Vehicle) {
    if (kind === "driver") {
      const d = data as Driver | undefined;
      setForm({ name: d?.name || "", phone: d?.phone || "" });
    } else {
      const v = data as Vehicle | undefined;
      setForm({ name: v?.name || "", capacity: v?.capacity ?? 12 });
    }
    setModal({ kind, data: data as never });
  }

  async function saveModal() {
    if (!modal) return;
    const isEdit = !!modal.data;
    if (isEdit) {
      await fetch("/api/admin/drivers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: modal.kind === "vehicle" ? "vehicle" : "driver", id: (modal.data as { id: string }).id, ...form }),
      });
    } else {
      await fetch("/api/admin/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: modal.kind === "vehicle" ? "vehicle" : "driver", ...form }),
      });
    }
    setModal(null);
    load();
  }

  async function toggleActive(type: string, id: string, current: boolean) {
    await fetch("/api/admin/drivers", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id, is_active: !current }),
    });
    load();
  }

  async function del(type: string, id: string, label: string) {
    if (!confirm(`${label} 삭제하시겠습니까?`)) return;
    await fetch(`/api/admin/drivers?type=${type}&id=${id}`, { method: "DELETE" });
    load();
  }

  const [copiedId, setCopiedId] = useState<string | null>(null);
  async function copyDriverLink(driverId: string) {
    const res = await fetch("/api/driver-token", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driver_id: driverId }),
    });
    if (!res.ok) { alert("토큰 생성 실패"); return; }
    const { token } = await res.json();
    const url = `${window.location.origin}/driver/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(driverId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.dv-w{max-width:800px;margin:0 auto;padding:40px 24px}
.dv-top{display:flex;align-items:center;gap:12px;margin-bottom:32px}
.dv-back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.dv-back:hover{background:#e2e8f0}
.dv-top h1{font-size:24px;font-weight:800;flex:1}
.sec{background:#fff;border-radius:14px;padding:24px;margin-bottom:24px;box-shadow:0 2px 12px rgba(0,0,0,0.05)}
.sec-head{display:flex;align-items:center;gap:8px;margin-bottom:16px}
.sec-head h2{font-size:17px;font-weight:700;flex:1}
.btn{padding:10px 18px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:background 150ms}
.btn-blue{background:#1a6fc4;color:#fff}.btn-blue:hover{background:#0d3d7a}
.btn-sm{padding:6px 12px;font-size:12px}
.btn-gray{background:#f1f5f9;color:#475569}.btn-gray:hover{background:#e2e8f0}
.btn-red{background:#fef2f2;color:#dc2626}.btn-red:hover{background:#fecaca}
.card{border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:10px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;transition:border-color 150ms}
.card:hover{border-color:#cbd5e1}
.card.inactive{opacity:0.5}
.card-av{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.card-info{flex:1;min-width:0}
.card-info .nm{font-size:15px;font-weight:700}
.card-info .sub{font-size:12px;color:#6b7c93;margin-top:2px}
.card-actions{display:flex;gap:6px;flex-wrap:wrap}
.badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700}
.badge-on{background:#dcfce7;color:#166534}.badge-off{background:#fef2f2;color:#dc2626}
.empty{text-align:center;padding:24px;color:#94a3b8;font-size:14px}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:100;padding:24px}
.modal{background:#fff;border-radius:16px;padding:28px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,0.15)}
.modal h3{font-size:18px;font-weight:800;margin-bottom:20px}
.modal label{display:block;font-size:13px;font-weight:600;color:#475569;margin-bottom:4px}
.modal input{width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:inherit;outline:none;margin-bottom:14px}
.modal input:focus{border-color:#1a6fc4}
.modal-foot{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}
@media(max-width:500px){.dv-w{padding:24px 16px}}
    `}</style>
    <div className="dv-w">
      <div className="dv-top">
        <button className="dv-back" onClick={() => router.push("/admin/hub")}>←</button>
        <h1>기사 · 차량 관리</h1>
      </div>

      <div className="sec">
        <div className="sec-head">
          <h2>🚗 기사 목록</h2>
          <button className="btn btn-sm btn-blue" onClick={() => openModal("driver")}>+ 기사 추가</button>
        </div>
        {drivers.length === 0 && <div className="empty">등록된 기사가 없습니다</div>}
        {drivers.map(d => (
          <div key={d.id} className={`card${d.is_active ? "" : " inactive"}`}>
            <div className="card-av" style={{ background: d.is_active ? "#dbeafe" : "#f1f5f9" }}>🚗</div>
            <div className="card-info">
              <div className="nm">{d.name}</div>
              <div className="sub">{d.phone || "연락처 미등록"}</div>
            </div>
            <div className="card-actions">
              <span className={`badge ${d.is_active ? "badge-on" : "badge-off"}`}>{d.is_active ? "활성" : "비활성"}</span>
              <button className="btn btn-sm btn-gray" onClick={() => toggleActive("driver", d.id, d.is_active)}>{d.is_active ? "비활성화" : "활성화"}</button>
              <button className="btn btn-sm btn-gray" onClick={() => openModal("driver", d)}>수정</button>
              <button className="btn btn-sm" style={{background:copiedId===d.id?"#dcfce7":"#eff6ff",color:copiedId===d.id?"#166534":"#1a6fc4",border:"1px solid "+(copiedId===d.id?"#bbf7d0":"#bfdbfe")}} onClick={()=>copyDriverLink(d.id)}>{copiedId===d.id?"복사됨!":"📱 링크"}</button>
              <button className="btn btn-sm btn-red" onClick={() => del("driver", d.id, d.name)}>삭제</button>
            </div>
          </div>
        ))}
      </div>

      <div className="sec">
        <div className="sec-head">
          <h2>🚐 차량 목록</h2>
          <button className="btn btn-sm btn-blue" onClick={() => openModal("vehicle")}>+ 차량 추가</button>
        </div>
        {vehicles.length === 0 && <div className="empty">등록된 차량이 없습니다</div>}
        {vehicles.map(v => (
          <div key={v.id} className={`card${v.is_active ? "" : " inactive"}`}>
            <div className="card-av" style={{ background: v.is_active ? "#fef3c7" : "#f1f5f9" }}>🚐</div>
            <div className="card-info">
              <div className="nm">{v.name || "차량명 미등록"}</div>
              <div className="sub">{v.capacity}인승</div>
            </div>
            <div className="card-actions">
              <span className={`badge ${v.is_active ? "badge-on" : "badge-off"}`}>{v.is_active ? "활성" : "비활성"}</span>
              <button className="btn btn-sm btn-gray" onClick={() => toggleActive("vehicle", v.id, v.is_active)}>{v.is_active ? "비활성화" : "활성화"}</button>
              <button className="btn btn-sm btn-gray" onClick={() => openModal("vehicle", v)}>수정</button>
              <button className="btn btn-sm btn-red" onClick={() => del("vehicle", v.id, v.name || "차량")}>삭제</button>
            </div>
          </div>
        ))}
      </div>
    </div>

    {modal && (
      <div className="overlay" onClick={() => setModal(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <h3>{modal.data ? "수정" : "추가"} — {modal.kind === "driver" ? "기사" : "차량"}</h3>
          {modal.kind === "driver" ? (<>
            <label>이름</label>
            <input value={form.name as string} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="기사 이름" autoFocus />
            <label>연락처</label>
            <input value={form.phone as string} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="010-0000-0000" />
          </>) : (<>
            <label>차량명</label>
            <input value={form.name as string} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="스타리아 1호" autoFocus />
            <label>정원</label>
            <input type="number" value={form.capacity as number} onChange={e => setForm({ ...form, capacity: parseInt(e.target.value) || 0 })} />
          </>)}
          <div className="modal-foot">
            <button className="btn btn-gray" onClick={() => setModal(null)}>취소</button>
            <button className="btn btn-blue" onClick={saveModal}>저장</button>
          </div>
        </div>
      </div>
    )}
  </>);
}
