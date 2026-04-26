"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";

export interface MineduApp {
  id: string;
  created_at: string;
  name: string | null;
  phone: string | null;
  children: string | null;
  ages: string | null;
  period: string | null;
  lodging: string | null;
}

interface Props {
  initialRows: MineduApp[];
  fetchError: string | null;
}

function pad2(n: number) { return String(n).padStart(2, "0"); }
function fmtDateTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function fmtDateOnly(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function csvEscape(v: string | null | undefined): string {
  const s = (v ?? "").toString();
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCsv(rows: MineduApp[]): string {
  const headers = ["신청일", "이름", "연락처", "자녀명", "나이", "일정", "숙소"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([
      csvEscape(fmtDateTime(r.created_at)),
      csvEscape(r.name),
      csvEscape(r.phone),
      csvEscape(r.children),
      csvEscape(r.ages),
      csvEscape(r.period),
      csvEscape(r.lodging),
    ].join(","));
  }
  // UTF-8 BOM — 한글 엑셀에서 깨지지 않게
  return "﻿" + lines.join("\r\n");
}

export default function MineduListClient({ initialRows, fetchError }: Props) {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MineduApp | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (isAdminAuthed()) setAuthed(true);
    else if (typeof window !== "undefined") window.location.href = "/login";
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return initialRows;
    return initialRows.filter(r => {
      const hay = [r.name, r.phone, r.lodging, r.period, r.children, r.ages]
        .map(v => (v || "").toString().toLowerCase()).join(" ");
      return hay.includes(q);
    });
  }, [initialRows, search]);

  const todayCount = useMemo(() => {
    const td = todayStr();
    return initialRows.filter(r => fmtDateOnly(r.created_at) === td).length;
  }, [initialRows]);

  function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 800);
  }

  function handleCsv() {
    if (filtered.length === 0) {
      showToast("다운로드할 데이터가 없습니다");
      return;
    }
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const d = new Date();
    const stamp = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
    link.href = url;
    link.download = `민에듀_공구신청_${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`${filtered.length}건 다운로드 완료`);
  }

  async function copyPhone(phone: string) {
    try {
      await navigator.clipboard.writeText(phone);
      showToast("연락처를 복사했습니다");
    } catch {
      showToast("복사 실패 — 수동으로 선택해 복사해주세요");
    }
  }

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.mn-w{max-width:1280px;margin:0 auto;padding:28px 20px}
.mn-top{display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap}
.mn-back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px;color:#475569}
.mn-back:hover{background:#e2e8f0}
.mn-top h1{font-size:22px;font-weight:800;flex:1;min-width:200px;margin:0}
.mn-top .actions{display:flex;gap:8px;flex-wrap:wrap}
.mn-btn{padding:9px 14px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:all 120ms;border:1px solid transparent;white-space:nowrap}
.mn-btn.primary{background:#1a6fc4;color:#fff}
.mn-btn.primary:hover:not(:disabled){background:#155aa0}
.mn-btn.secondary{background:#fff;color:#1a6fc4;border-color:#bfdbfe}
.mn-btn.secondary:hover:not(:disabled){background:#eff6ff}
.mn-btn:disabled{opacity:0.6;cursor:not-allowed}

.mn-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
.mn-stat{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;box-shadow:0 1px 3px rgba(0,0,0,0.03)}
.mn-stat .lbl{font-size:11px;font-weight:800;letter-spacing:0.04em;color:#6b7c93;text-transform:uppercase;margin-bottom:6px}
.mn-stat .val{font-size:28px;font-weight:900;line-height:1;color:#1a1a2e}
.mn-stat.blue .val{color:#1a6fc4}
.mn-stat.amber .val{color:#d97706}
.mn-stat.green .val{color:#059669}
@media(max-width:700px){.mn-stats{grid-template-columns:1fr}}

.mn-search{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:8px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,0.03)}
.mn-search input{flex:1;border:none;outline:none;font-size:14px;font-family:inherit;color:#1a1a2e;background:transparent}
.mn-search input::placeholder{color:#94a3b8}

.mn-card{background:#fff;border-radius:14px;border:1px solid #e2e8f0;overflow-x:auto;box-shadow:0 2px 12px rgba(0,0,0,0.04)}
.mn-tbl{width:100%;border-collapse:collapse;font-size:13px;min-width:880px}
.mn-tbl th{background:#f8fafc;padding:12px 14px;text-align:left;font-size:11.5px;font-weight:800;color:#6b7c93;border-bottom:2px solid #e2e8f0;letter-spacing:0.03em;white-space:nowrap}
.mn-tbl td{padding:12px 14px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
.mn-tbl tr:last-child td{border-bottom:none}
.mn-tbl tbody tr{cursor:pointer;transition:background 100ms}
.mn-tbl tbody tr:hover{background:#f8fafc}
.mn-tbl .name{font-weight:700;color:#1a1a2e}
.mn-tbl .muted{color:#6b7c93}
.mn-tbl .nowrap{white-space:nowrap}

.mn-empty{text-align:center;padding:60px 20px;color:#94a3b8;font-size:14px;line-height:1.8}
.mn-err{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;padding:12px 16px;border-radius:10px;font-size:13px;margin-bottom:12px;font-weight:600}

.mn-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:200;padding:20px}
.mn-modal{background:#fff;border-radius:16px;width:100%;max-width:540px;max-height:88vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.18)}
.mn-modal-head{display:flex;align-items:center;justify-content:space-between;padding:16px 22px;border-bottom:1px solid #e2e8f0}
.mn-modal-head h3{font-size:16px;font-weight:800;margin:0}
.mn-close{background:none;border:none;font-size:22px;cursor:pointer;color:#6b7c93;padding:4px 8px;border-radius:6px;line-height:1}
.mn-close:hover{background:#f1f5f9;color:#1a1a2e}
.mn-modal-body{padding:18px 22px}
.mn-kv{display:grid;grid-template-columns:90px 1fr;gap:10px 16px;font-size:13.5px}
.mn-kv .k{font-size:11.5px;font-weight:800;color:#6b7c93;letter-spacing:0.04em;align-self:center}
.mn-kv .v{color:#1a1a2e;word-break:break-word;line-height:1.6}
.mn-kv .v.copy{cursor:pointer;color:#1a6fc4;font-weight:700;text-decoration:underline;text-underline-offset:3px}
.mn-kv .v.copy:hover{color:#155aa0}
@media(max-width:480px){.mn-kv{grid-template-columns:1fr;gap:4px 0}.mn-kv .k{margin-top:8px}}

.mn-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:11px 22px;border-radius:10px;font-size:13px;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,0.18);z-index:300;animation:mnToastIn 220ms ease-out}
@keyframes mnToastIn{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}
    `}</style>

    <div className="mn-w">
      <div className="mn-top">
        <button className="mn-back" onClick={() => router.push("/admin/hub")} aria-label="뒤로">←</button>
        <h1>📚 민에듀 공구 신청 관리</h1>
        <div className="actions">
          <button className="mn-btn secondary" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? "⟳ 새로고침..." : "⟳ 새로고침"}
          </button>
          <button className="mn-btn primary" onClick={handleCsv}>
            📥 엑셀 다운로드 (CSV)
          </button>
        </div>
      </div>

      {fetchError && <div className="mn-err">⚠️ 데이터 로드 실패: {fetchError}</div>}

      <div className="mn-stats">
        <div className="mn-stat blue">
          <div className="lbl">전체 신청</div>
          <div className="val">{initialRows.length}</div>
        </div>
        <div className="mn-stat amber">
          <div className="lbl">오늘 신청</div>
          <div className="val">{todayCount}</div>
        </div>
        <div className="mn-stat green">
          <div className="lbl">검색 결과</div>
          <div className="val">{search.trim() ? filtered.length : initialRows.length}</div>
        </div>
      </div>

      <div className="mn-search">
        <span aria-hidden="true" style={{ color: "#94a3b8", fontSize: 14 }}>🔍</span>
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="이름 / 연락처 / 숙소 / 일정 / 자녀명으로 검색"
          aria-label="검색"
        />
      </div>

      <div className="mn-card">
        {initialRows.length === 0 ? (
          <div className="mn-empty">📭 신청된 내역이 없습니다</div>
        ) : filtered.length === 0 ? (
          <div className="mn-empty">검색 조건에 맞는 결과가 없습니다</div>
        ) : (
          <table className="mn-tbl">
            <thead>
              <tr>
                <th>신청일</th>
                <th>이름</th>
                <th>연락처</th>
                <th>자녀명</th>
                <th>나이</th>
                <th>일정</th>
                <th>숙소</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} onClick={() => setSelected(r)}>
                  <td className="muted nowrap">{fmtDateTime(r.created_at)}</td>
                  <td className="name">{r.name || "-"}</td>
                  <td className="nowrap">{r.phone || "-"}</td>
                  <td>{r.children || "-"}</td>
                  <td className="muted">{r.ages || "-"}</td>
                  <td>{r.period || "-"}</td>
                  <td>{r.lodging || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>

    {selected && (
      <div className="mn-overlay" onClick={() => setSelected(null)}>
        <div className="mn-modal" onClick={e => e.stopPropagation()}>
          <div className="mn-modal-head">
            <h3>📋 {selected.name || "신청 상세"}</h3>
            <button className="mn-close" onClick={() => setSelected(null)} aria-label="닫기">✕</button>
          </div>
          <div className="mn-modal-body">
            <div className="mn-kv">
              <span className="k">신청일</span>
              <span className="v">{fmtDateTime(selected.created_at)}</span>
              <span className="k">이름</span>
              <span className="v">{selected.name || "-"}</span>
              <span className="k">연락처</span>
              {selected.phone ? (
                <span
                  className="v copy"
                  onClick={() => copyPhone(selected.phone!)}
                  title="클릭하여 복사"
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); copyPhone(selected.phone!); } }}
                >
                  {selected.phone}
                </span>
              ) : (
                <span className="v">-</span>
              )}
              <span className="k">자녀명</span>
              <span className="v">{selected.children || "-"}</span>
              <span className="k">나이</span>
              <span className="v">{selected.ages || "-"}</span>
              <span className="k">일정</span>
              <span className="v">{selected.period || "-"}</span>
              <span className="k">숙소</span>
              <span className="v">{selected.lodging || "-"}</span>
            </div>
          </div>
        </div>
      </div>
    )}

    {toast && <div className="mn-toast" role="status" aria-live="polite">{toast}</div>}
  </>);
}
