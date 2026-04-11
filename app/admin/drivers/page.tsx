"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";

interface Driver { id: string; name: string; phone: string; is_active: boolean; created_at: string }
interface Vehicle { id: string; name: string; capacity: number; is_active: boolean; created_at: string }

export default function DriversPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [dForm, setDF] = useState({ name: "", phone: "" });
  const [vForm, setVF] = useState({ name: "", capacity: 12 });
  const [editId, setEditId] = useState<string | null>(null);
  const [editVId, setEditVId] = useState<string | null>(null);
  const [editData, setED] = useState({ name: "", phone: "" });
  const [editVData, setEVD] = useState({ name: "", capacity: 12 });

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/drivers");
    if (res.ok) {
      const d = await res.json();
      setDrivers(d.drivers);
      setVehicles(d.vehicles);
    }
  }, []);

  useEffect(() => {
    if (isAdminAuthed()) { setAuthed(true); } else { window.location.href = "/admin"; }
  }, []);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  async function addDriver() {
    if (!dForm.name.trim()) return;
    await fetch("/api/admin/drivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "driver", ...dForm }),
    });
    setDF({ name: "", phone: "" });
    load();
  }

  async function addVehicle() {
    if (!vForm.name.trim()) return;
    await fetch("/api/admin/drivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "vehicle", ...vForm }),
    });
    setVF({ name: "", capacity: 12 });
    load();
  }

  async function toggleActive(type: string, id: string, current: boolean) {
    await fetch("/api/admin/drivers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id, is_active: !current }),
    });
    load();
  }

  async function saveEdit(type: string, id: string) {
    const body = type === "vehicle"
      ? { type, id, ...editVData }
      : { type, id, ...editData };
    await fetch("/api/admin/drivers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setEditId(null);
    setEditVId(null);
    load();
  }

  async function del(type: string, id: string, label: string) {
    if (!confirm(`${label} 삭제하시겠습니까?`)) return;
    await fetch(`/api/admin/drivers?type=${type}&id=${id}`, { method: "DELETE" });
    load();
  }

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.dv-w{max-width:800px;margin:0 auto;padding:40px 24px}
.dv-top{display:flex;align-items:center;gap:12px;margin-bottom:32px}
.dv-back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.dv-back:hover{background:#e2e8f0}
.dv-top h1{font-size:24px;font-weight:800}
.sec{background:#fff;border-radius:14px;padding:24px;margin-bottom:24px;box-shadow:0 2px 12px rgba(0,0,0,0.05)}
.sec h2{font-size:17px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px}
.add-row{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.add-row input{flex:1;min-width:120px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:inherit;outline:none}
.add-row input:focus{border-color:#1a6fc4}
.add-row input.cap{max-width:80px;flex:none}
.btn{padding:10px 18px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:background 150ms}
.btn-blue{background:#1a6fc4;color:#fff}.btn-blue:hover{background:#0d3d7a}
.btn-sm{padding:6px 12px;font-size:12px}
.btn-gray{background:#f1f5f9;color:#475569}.btn-gray:hover{background:#e2e8f0}
.btn-red{background:#fef2f2;color:#dc2626}.btn-red:hover{background:#fecaca}
.btn-green{background:#dcfce7;color:#166534}.btn-green:hover{background:#bbf7d0}
.card{border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:10px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;transition:border-color 150ms}
.card:hover{border-color:#cbd5e1}
.card.inactive{opacity:0.5}
.card-av{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.card-info{flex:1;min-width:0}
.card-info .nm{font-size:15px;font-weight:700}
.card-info .sub{font-size:12px;color:#6b7c93;margin-top:2px}
.card-actions{display:flex;gap:6px;flex-wrap:wrap}
.badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700}
.badge-on{background:#dcfce7;color:#166534}
.badge-off{background:#fef2f2;color:#dc2626}
.edit-row{display:flex;gap:6px;width:100%;margin-top:8px;flex-wrap:wrap}
.edit-row input{flex:1;min-width:100px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;outline:none}
.edit-row input:focus{border-color:#1a6fc4}
.empty{text-align:center;padding:24px;color:#94a3b8;font-size:14px}
@media(max-width:500px){.dv-w{padding:24px 16px}.add-row{flex-direction:column}.add-row input.cap{max-width:100%}}
    `}</style>
    <div className="dv-w">
      <div className="dv-top">
        <button className="dv-back" onClick={() => router.push("/admin/hub")}>←</button>
        <h1>기사 · 차량 관리</h1>
      </div>

      {/* 기사 섹션 */}
      <div className="sec">
        <h2>🚗 기사 목록</h2>
        <div className="add-row">
          <input placeholder="기사 이름" value={dForm.name} onChange={e => setDF({ ...dForm, name: e.target.value })} />
          <input placeholder="연락처" value={dForm.phone} onChange={e => setDF({ ...dForm, phone: e.target.value })} />
          <button className="btn btn-blue" onClick={addDriver}>추가</button>
        </div>
        {drivers.length === 0 && <div className="empty">등록된 기사가 없습니다</div>}
        {drivers.map(d => (
          <div key={d.id} className={`card${d.is_active ? "" : " inactive"}`}>
            <div className="card-av" style={{ background: d.is_active ? "#dbeafe" : "#f1f5f9" }}>🚗</div>
            <div className="card-info">
              {editId === d.id ? (
                <div className="edit-row">
                  <input value={editData.name} onChange={e => setED({ ...editData, name: e.target.value })} />
                  <input value={editData.phone} onChange={e => setED({ ...editData, phone: e.target.value })} />
                  <button className="btn btn-sm btn-blue" onClick={() => saveEdit("driver", d.id)}>저장</button>
                  <button className="btn btn-sm btn-gray" onClick={() => setEditId(null)}>취소</button>
                </div>
              ) : (
                <>
                  <div className="nm">{d.name}</div>
                  <div className="sub">{d.phone || "연락처 미등록"}</div>
                </>
              )}
            </div>
            {editId !== d.id && (
              <div className="card-actions">
                <span className={`badge ${d.is_active ? "badge-on" : "badge-off"}`}>
                  {d.is_active ? "활성" : "비활성"}
                </span>
                <button className="btn btn-sm btn-gray" onClick={() => toggleActive("driver", d.id, d.is_active)}>
                  {d.is_active ? "비활성화" : "활성화"}
                </button>
                <button className="btn btn-sm btn-gray" onClick={() => { setEditId(d.id); setED({ name: d.name, phone: d.phone || "" }); }}>수정</button>
                <button className="btn btn-sm btn-red" onClick={() => del("driver", d.id, d.name)}>삭제</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 차량 섹션 */}
      <div className="sec">
        <h2>🚐 차량 목록</h2>
        <div className="add-row">
          <input placeholder="차량명 (예: 스타리아 1호)" value={vForm.name} onChange={e => setVF({ ...vForm, name: e.target.value })} />
          <input className="cap" type="number" placeholder="정원" value={vForm.capacity} onChange={e => setVF({ ...vForm, capacity: parseInt(e.target.value) || 0 })} />
          <button className="btn btn-blue" onClick={addVehicle}>추가</button>
        </div>
        {vehicles.length === 0 && <div className="empty">등록된 차량이 없습니다</div>}
        {vehicles.map(v => (
          <div key={v.id} className={`card${v.is_active ? "" : " inactive"}`}>
            <div className="card-av" style={{ background: v.is_active ? "#fef3c7" : "#f1f5f9" }}>🚐</div>
            <div className="card-info">
              {editVId === v.id ? (
                <div className="edit-row">
                  <input value={editVData.name} onChange={e => setEVD({ ...editVData, name: e.target.value })} />
                  <input className="cap" type="number" value={editVData.capacity} onChange={e => setEVD({ ...editVData, capacity: parseInt(e.target.value) || 0 })} />
                  <button className="btn btn-sm btn-blue" onClick={() => saveEdit("vehicle", v.id)}>저장</button>
                  <button className="btn btn-sm btn-gray" onClick={() => setEditVId(null)}>취소</button>
                </div>
              ) : (
                <>
                  <div className="nm">{v.name || "차량명 미등록"}</div>
                  <div className="sub">{v.capacity}인승</div>
                </>
              )}
            </div>
            {editVId !== v.id && (
              <div className="card-actions">
                <span className={`badge ${v.is_active ? "badge-on" : "badge-off"}`}>
                  {v.is_active ? "활성" : "비활성"}
                </span>
                <button className="btn btn-sm btn-gray" onClick={() => toggleActive("vehicle", v.id, v.is_active)}>
                  {v.is_active ? "비활성화" : "활성화"}
                </button>
                <button className="btn btn-sm btn-gray" onClick={() => { setEditVId(v.id); setEVD({ name: v.name || "", capacity: v.capacity }); }}>수정</button>
                <button className="btn btn-sm btn-red" onClick={() => del("vehicle", v.id, v.name || "차량")}>삭제</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  </>);
}
