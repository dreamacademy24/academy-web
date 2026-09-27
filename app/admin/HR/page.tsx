"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  HR_GENDER, HR_CIVIL_STATUS, HR_EMP_STATUS, HR_ACTIVE_STATUS, HR_SALARY_TYPE,
  HR_JOB_LEVEL, HR_DIVISIONS, HR_DEPARTMENTS, HR_SHIFTS, HR_TAX_STATUS, HR_COST_CENTER,
  HR_REQUIREMENTS, displayName, type HrEmployee,
} from "@/lib/hr";

type Sess = { token: string; user: { username: string; role: string; name?: string; employee_id?: string | null } };

const SS_KEY = "hrSession";
function loadSess(): Sess | null {
  try { const raw = localStorage.getItem(SS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

// ─────────── 로그인 게이트 ───────────
function Login({ onOk }: { onOk: (s: Sess) => void }) {
  const [u, setU] = useState(""); const [p, setP] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const r = await fetch("/api/hr/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u.trim(), password: p }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "로그인 실패");
      const s: Sess = { token: j.token, user: j.user };
      localStorage.setItem(SS_KEY, JSON.stringify(s));
      onOk(s);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", fontFamily: '"Malgun Gothic",sans-serif' }}>
      <form onSubmit={submit} style={{ background: "#fff", padding: "34px 30px", borderRadius: 16, width: 340, boxShadow: "0 20px 60px rgba(0,0,0,.35)" }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🔐 Dream HR</div>
        <div style={{ fontSize: 12.5, color: "#64748b", marginBottom: 20 }}>인사·급여 시스템 (별도 접속)</div>
        <input value={u} onChange={e => setU(e.target.value)} placeholder="아이디" autoFocus style={inp} />
        <input value={p} onChange={e => setP(e.target.value)} type="password" placeholder="비밀번호" style={{ ...inp, marginTop: 10 }} />
        {err && <div style={{ color: "#dc2626", fontSize: 12.5, marginTop: 10 }}>{err}</div>}
        <button disabled={busy} style={{ marginTop: 16, width: "100%", padding: "11px", borderRadius: 9, border: "none", background: "#2563eb", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>{busy ? "확인 중…" : "로그인"}</button>
      </form>
    </div>
  );
}
const inp: React.CSSProperties = { width: "100%", padding: "11px 12px", borderRadius: 9, border: "1px solid #cbd5e1", fontSize: 14, boxSizing: "border-box" };

// ─────────── 메인 ───────────
export default function HRPage() {
  const [sess, setSess] = useState<Sess | null | undefined>(undefined);
  const [list, setList] = useState<HrEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<HrEmployee | null>(null); // 열린 카드
  const [msg, setMsg] = useState("");

  useEffect(() => { setSess(loadSess()); }, []);
  const isAdmin = sess?.user?.role === "admin";

  const authFetch = useCallback(async (url: string, init?: RequestInit) => {
    const r = await fetch(url, { ...init, headers: { ...(init?.headers || {}), "Content-Type": "application/json", Authorization: `Bearer ${sess?.token}` }, cache: "no-store" });
    if (r.status === 401) { localStorage.removeItem(SS_KEY); setSess(null); throw new Error("세션이 만료됐어요. 다시 로그인하세요."); }
    return r;
  }, [sess]);

  const load = useCallback(async () => {
    if (!sess) return;
    setLoading(true);
    try { const r = await authFetch("/api/hr/employees"); const j = await r.json(); setList(j.employees || []); }
    catch (e) { setMsg((e as Error).message); } finally { setLoading(false); }
  }, [sess, authFetch]);
  useEffect(() => { if (sess) load(); }, [sess, load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter(e => [displayName(e), e.employee_id, e.position, e.department, e.contact_number].filter(Boolean).join(" ").toLowerCase().includes(s));
  }, [list, q]);

  if (sess === undefined) return <div style={{ padding: 40 }}>불러오는 중…</div>;
  if (sess === null) return <Login onOk={setSess} />;

  const logout = () => { localStorage.removeItem(SS_KEY); setSess(null); };

  return (
    <div style={{ background: "#f1f5f9", minHeight: "100vh", fontFamily: '"Malgun Gothic","Apple SD Gothic Neo",sans-serif' }}>
      {/* 헤더 */}
      <div style={{ background: "#0f172a", color: "#fff", display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", position: "sticky", top: 0, zIndex: 30 }}>
        <b style={{ fontSize: 16 }}>🔐 Dream HR</b>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>현지직원 인사·급여</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", fontSize: 13 }}>
          <span style={{ color: "#cbd5e1" }}>{sess.user.name || sess.user.username} {isAdmin ? "· 관리자" : "· 직원"}</span>
          <button onClick={logout} style={{ background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 12 }}>로그아웃</button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "18px auto", padding: "0 16px" }}>
        {/* 모듈 탭 (지금은 인사기록카드만, 급여·레터는 준비중) */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <span style={mTab(true)}>👤 인사기록카드</span>
          <span style={mTab(false)} title="곧 추가됩니다">💰 급여계산 <em style={{ fontStyle: "normal", fontSize: 10, color: "#94a3b8" }}>준비중</em></span>
          <span style={mTab(false)} title="곧 추가됩니다">📄 레터발급 <em style={{ fontStyle: "normal", fontSize: 10, color: "#94a3b8" }}>준비중</em></span>
        </div>

        {msg && <div style={{ background: "#fef2f2", color: "#b91c1c", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{msg}</div>}

        {/* 리스트 */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid #eef2f6", flexWrap: "wrap" }}>
            <b style={{ fontSize: 15 }}>직원 {filtered.length}명</b>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="이름·사원번호·직급 검색" style={{ ...inp, width: 240, padding: "7px 10px", fontSize: 13 }} />
            {isAdmin && <button onClick={() => setSel({ id: "", status: "Active", cost_center: "아카데미", nationality: "Filipino", salary_type: "Monthly" } as HrEmployee)} style={{ marginLeft: "auto", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>+ 신규 직원</button>}
          </div>
          {loading ? <div style={{ padding: 24, color: "#94a3b8" }}>불러오는 중…</div> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", color: "#475569", textAlign: "left" }}>
                    {["사원번호", "이름", "직급", "부서", "부문", "고용형태", "상태"].map(h => <th key={h} style={{ padding: "9px 12px", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => (
                    <tr key={e.id} onClick={() => setSel(e)} style={{ borderTop: "1px solid #f1f5f9", cursor: "pointer" }}>
                      <td style={{ padding: "9px 12px", color: "#64748b", whiteSpace: "nowrap" }}>{e.employee_id || "-"}</td>
                      <td style={{ padding: "9px 12px", fontWeight: 600 }}>{displayName(e)}</td>
                      <td style={{ padding: "9px 12px" }}>{e.position || "-"}</td>
                      <td style={{ padding: "9px 12px" }}>{e.department || "-"}</td>
                      <td style={{ padding: "9px 12px" }}><span style={{ fontSize: 11, background: e.cost_center === "드림하우스" ? "#ede9fe" : "#e0f2fe", color: e.cost_center === "드림하우스" ? "#6d28d9" : "#0369a1", padding: "2px 7px", borderRadius: 20 }}>{e.cost_center || "아카데미"}</span></td>
                      <td style={{ padding: "9px 12px" }}>{e.employment_status || "-"}</td>
                      <td style={{ padding: "9px 12px" }}><span style={{ fontSize: 11, color: (e.status || "Active") === "Active" ? "#16a34a" : "#94a3b8", fontWeight: 700 }}>{(e.status || "Active") === "Active" ? "● 재직" : "○ " + e.status}</span></td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={7} style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}>{list.length === 0 ? "아직 등록된 직원이 없어요. '+ 신규 직원'으로 추가하세요." : "검색 결과 없음"}</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {sel && <EmployeeCard emp={sel} isAdmin={isAdmin} authFetch={authFetch} onClose={() => setSel(null)} onSaved={() => { setSel(null); load(); }} />}
    </div>
  );
}
const mTab = (on: boolean): React.CSSProperties => ({ padding: "8px 14px", borderRadius: 9, fontSize: 13.5, fontWeight: 700, background: on ? "#1e293b" : "#e2e8f0", color: on ? "#fff" : "#64748b", cursor: on ? "default" : "not-allowed" });

// ─────────── 직원 카드 (Profile-style, 탭) ───────────
const CARD_TABS = ["인적사항", "근무", "급여", "4대보험", "서류"] as const;
function EmployeeCard({ emp, isAdmin, authFetch, onClose, onSaved }: {
  emp: HrEmployee; isAdmin: boolean; authFetch: (u: string, i?: RequestInit) => Promise<Response>; onClose: () => void; onSaved: () => void;
}) {
  const isNew = !emp.id;
  const [tab, setTab] = useState<typeof CARD_TABS[number]>("인적사항");
  const [f, setF] = useState<HrEmployee>({ ...emp });
  const [edit, setEdit] = useState(isNew);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof HrEmployee, v: unknown) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    setBusy(true); setErr("");
    try {
      const method = isNew ? "POST" : "PATCH";
      const body = isNew ? f : { ...f, id: emp.id };
      const r = await authFetch("/api/hr/employees", { method, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "저장 실패");
      onSaved();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const req = f.requirements || {};
  const reqDone = HR_REQUIREMENTS.filter(r => req[r.key]).length;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", zIndex: 60, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "min(760px,100%)", background: "#fff", height: "100%", overflowY: "auto", boxShadow: "-8px 0 30px rgba(0,0,0,.25)" }}>
        {/* 상단 */}
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #eef2f6", position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, overflow: "hidden" }}>
              {f.photo_url ? <img src={f.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{isNew ? "신규 직원 등록" : displayName(f)}</div>
              <div style={{ fontSize: 12.5, color: "#64748b" }}>{[f.employee_id, f.position, f.department].filter(Boolean).join(" · ") || "정보 입력"}</div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {isAdmin && !edit && !isNew && <button onClick={() => setEdit(true)} style={btnS("#e0e7ff", "#3730a3")}>✏️ 수정</button>}
              {(edit || isNew) && <button disabled={busy} onClick={save} style={btnS("#16a34a", "#fff")}>{busy ? "저장 중…" : "💾 저장"}</button>}
              <button onClick={onClose} style={btnS("#f1f5f9", "#475569")}>✕ 닫기</button>
            </div>
          </div>
          {err && <div style={{ color: "#dc2626", fontSize: 12.5, marginTop: 8 }}>{err}</div>}
          {/* 탭 */}
          <div style={{ display: "flex", gap: 4, marginTop: 14, flexWrap: "wrap" }}>
            {CARD_TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ border: "none", background: "transparent", cursor: "pointer", padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: tab === t ? 800 : 600, color: tab === t ? "#1d4ed8" : "#64748b", borderBottom: tab === t ? "2px solid #2563eb" : "2px solid transparent" }}>
                {t}{t === "서류" && ` (${reqDone}/${HR_REQUIREMENTS.length})`}
              </button>
            ))}
          </div>
        </div>

        {/* 본문 */}
        <div style={{ padding: "18px 22px 60px" }}>
          {tab === "인적사항" && <Grid>
            <F label="사원번호" v={f.employee_id} on={v => set("employee_id", v)} edit={edit} ph="비우면 자동생성" />
            <F label="바이오ID" v={f.biometrics_id} on={v => set("biometrics_id", v)} edit={edit} />
            <F label="부문(인건비)" v={f.cost_center} on={v => set("cost_center", v)} edit={edit} opts={HR_COST_CENTER} />
            <F label="재직상태" v={f.status} on={v => set("status", v)} edit={edit} opts={HR_ACTIVE_STATUS} />
            <F label="Last Name" v={f.last_name} on={v => set("last_name", v)} edit={edit} />
            <F label="First Name" v={f.first_name} on={v => set("first_name", v)} edit={edit} />
            <F label="Middle Name" v={f.middle_name} on={v => set("middle_name", v)} edit={edit} />
            <F label="Suffix" v={f.suffix} on={v => set("suffix", v)} edit={edit} />
            <F label="성별" v={f.gender} on={v => set("gender", v)} edit={edit} opts={HR_GENDER} />
            <F label="결혼여부" v={f.civil_status} on={v => set("civil_status", v)} edit={edit} opts={HR_CIVIL_STATUS} />
            <F label="생년월일" v={f.date_of_birth} on={v => set("date_of_birth", v)} edit={edit} type="date" />
            <F label="출생지" v={f.place_of_birth} on={v => set("place_of_birth", v)} edit={edit} />
            <F label="국적" v={f.nationality} on={v => set("nationality", v)} edit={edit} />
            <F label="종교" v={f.religion} on={v => set("religion", v)} edit={edit} />
            <F label="연락처" v={f.contact_number} on={v => set("contact_number", v)} edit={edit} />
            <F label="개인이메일" v={f.personal_email} on={v => set("personal_email", v)} edit={edit} />
            <F label="회사이메일" v={f.company_email} on={v => set("company_email", v)} edit={edit} />
            <F label="사진 URL" v={f.photo_url} on={v => set("photo_url", v)} edit={edit} full />
            <F label="현주소" v={f.current_address} on={v => set("current_address", v)} edit={edit} full />
            <F label="본적주소" v={f.permanent_address} on={v => set("permanent_address", v)} edit={edit} full />
            <F label="비상연락 이름" v={f.emergency_contact_name} on={v => set("emergency_contact_name", v)} edit={edit} />
            <F label="비상연락 번호" v={f.emergency_contact_number} on={v => set("emergency_contact_number", v)} edit={edit} />
            <F label="비상연락 관계" v={f.emergency_relationship} on={v => set("emergency_relationship", v)} edit={edit} />
            <F label="비상연락 주소" v={f.emergency_contact_address} on={v => set("emergency_contact_address", v)} edit={edit} full />
          </Grid>}

          {tab === "근무" && <Grid>
            <F label="직급(Position)" v={f.position} on={v => set("position", v)} edit={edit} />
            <F label="Division" v={f.division} on={v => set("division", v)} edit={edit} opts={HR_DIVISIONS} datalist />
            <F label="부서(Dept)" v={f.department} on={v => set("department", v)} edit={edit} opts={HR_DEPARTMENTS} datalist />
            <F label="직급레벨" v={f.job_level} on={v => set("job_level", v)} edit={edit} opts={HR_JOB_LEVEL} />
            <F label="고용형태" v={f.employment_status} on={v => set("employment_status", v)} edit={edit} opts={HR_EMP_STATUS} />
            <F label="입사일" v={f.date_hired} on={v => set("date_hired", v)} edit={edit} type="date" />
            <F label="3개월 평가" v={f.eval_3month} on={v => set("eval_3month", v)} edit={edit} type="date" />
            <F label="6개월 평가" v={f.eval_6month} on={v => set("eval_6month", v)} edit={edit} type="date" />
            <F label="정규직 전환일" v={f.regularization_date} on={v => set("regularization_date", v)} edit={edit} type="date" />
            <F label="퇴사일" v={f.separation_date} on={v => set("separation_date", v)} edit={edit} type="date" />
            <F label="근무지" v={f.work_location} on={v => set("work_location", v)} edit={edit} />
            <F label="시프트" v={f.shift_schedule} on={v => { const sh = HR_SHIFTS.find(s => s.value === v); set("shift_schedule", v); if (sh) { set("time_in", sh.time_in); set("time_out", sh.time_out); } }} edit={edit} opts={HR_SHIFTS.map(s => s.value)} />
            <F label="출근시간" v={f.time_in} on={v => set("time_in", v)} edit={edit} />
            <F label="퇴근시간" v={f.time_out} on={v => set("time_out", v)} edit={edit} />
            <F label="보고 대상(상사)" v={f.reporting_to} on={v => set("reporting_to", v)} edit={edit} full />
          </Grid>}

          {tab === "급여" && <Grid>
            <F label="급여형태" v={f.salary_type} on={v => set("salary_type", v)} edit={edit} opts={HR_SALARY_TYPE} />
            <F label={f.salary_type === "Daily" ? "기본급(일급)" : "기본급(월급)"} v={f.basic_salary} on={v => set("basic_salary", v)} edit={edit} type="number" money />
            <F label="세금상태(Tax)" v={f.tax_status} on={v => set("tax_status", v)} edit={edit} opts={HR_TAX_STATUS} datalist />
            <F label="직책수당" v={f.allow_position} on={v => set("allow_position", v)} edit={edit} type="number" money />
            <F label="픽드랍 교통수당" v={f.allow_transpo} on={v => set("allow_transpo", v)} edit={edit} type="number" money />
            <F label="튜터수당(1:1/1:2)" v={f.allow_tutorial} on={v => set("allow_tutorial", v)} edit={edit} type="number" money />
            <F label="로드수당" v={f.allow_load} on={v => set("allow_load", v)} edit={edit} type="number" money />
            <F label="은행명" v={f.bank_name} on={v => set("bank_name", v)} edit={edit} />
            <F label="계좌번호" v={f.bank_account} on={v => set("bank_account", v)} edit={edit} />
            <F label="계좌상태" v={f.bank_status} on={v => set("bank_status", v)} edit={edit} />
          </Grid>}

          {tab === "4대보험" && <Grid>
            <F label="SSS Number" v={f.sss_no} on={v => set("sss_no", v)} edit={edit} />
            <F label="PhilHealth Number" v={f.philhealth_no} on={v => set("philhealth_no", v)} edit={edit} />
            <F label="Pag-IBIG (HDMF)" v={f.pagibig_no} on={v => set("pagibig_no", v)} edit={edit} />
            <F label="TIN" v={f.tin} on={v => set("tin", v)} edit={edit} />
          </Grid>}

          {tab === "서류" && <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "#475569" }}>입사 서류 체크리스트 ({reqDone}/{HR_REQUIREMENTS.length})</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 6, marginBottom: 18 }}>
              {HR_REQUIREMENTS.map(r => (
                <label key={r.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: req[r.key] ? "#f0fdf4" : "#f8fafc", borderRadius: 8, fontSize: 12.5, cursor: edit ? "pointer" : "default", border: "1px solid #eef2f6" }}>
                  <input type="checkbox" disabled={!edit} checked={!!req[r.key]} onChange={e => set("requirements", { ...req, [r.key]: e.target.checked })} />
                  {r.label}
                </label>
              ))}
            </div>
            <Grid>
              <F label="지원번호" v={f.application_no} on={v => set("application_no", v)} edit={edit} />
              <F label="지원직급" v={f.position_applied} on={v => set("position_applied", v)} edit={edit} />
              <F label="지원일" v={f.date_of_application} on={v => set("date_of_application", v)} edit={edit} type="date" />
              <F label="지원상태" v={f.application_status} on={v => set("application_status", v)} edit={edit} />
              <F label="서류제출일" v={f.date_submitted} on={v => set("date_submitted", v)} edit={edit} type="date" />
              <F label="서류상태" v={f.requirement_status} on={v => set("requirement_status", v)} edit={edit} />
              <F label="온보딩일" v={f.onboarding_date} on={v => set("onboarding_date", v)} edit={edit} type="date" />
            </Grid>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>메모</div>
              {edit ? <textarea value={f.notes || ""} onChange={e => set("notes", e.target.value)} rows={3} style={{ ...inp, fontSize: 13, resize: "vertical" }} /> : <div style={{ fontSize: 13, whiteSpace: "pre-wrap", color: "#334155" }}>{f.notes || "-"}</div>}
            </div>
          </div>}
        </div>
      </div>
    </div>
  );
}
const btnS = (bg: string, c: string): React.CSSProperties => ({ background: bg, color: c, border: "none", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontSize: 12.5, fontWeight: 700 });
function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: "12px 16px" }}>{children}</div>;
}
function F({ label, v, on, edit, opts, type, ph, full, money, datalist }: {
  label: string; v: unknown; on: (v: string) => void; edit: boolean;
  opts?: string[]; type?: string; ph?: string; full?: boolean; money?: boolean; datalist?: boolean;
}) {
  const val = v == null ? "" : String(v);
  const dlId = datalist ? `dl_${label.replace(/\W/g, "")}` : undefined;
  return (
    <div style={full ? { gridColumn: "1 / -1" } : undefined}>
      <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 3 }}>{label}</div>
      {!edit ? (
        <div style={{ fontSize: 13.5, color: "#0f172a", minHeight: 20, wordBreak: "break-word" }}>{money && val ? "₱" + Number(val).toLocaleString() : (val || "-")}</div>
      ) : opts && !datalist ? (
        <select value={val} onChange={e => on(e.target.value)} style={{ ...inp, padding: "8px 10px", fontSize: 13 }}>
          <option value="">(선택)</option>
          {opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <>
          <input list={dlId} value={val} onChange={e => on(e.target.value)} placeholder={ph} type={type === "number" ? "number" : type === "date" ? "date" : "text"} style={{ ...inp, padding: "8px 10px", fontSize: 13 }} />
          {datalist && opts && <datalist id={dlId}>{opts.map(o => <option key={o} value={o} />)}</datalist>}
        </>
      )}
    </div>
  );
}
