"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const ADMIN_PASSWORD = "dream2026!";

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

interface Notice {
  id: number;
  category: string;
  title: string;
  date: string;
  content: string;
}

interface Profile {
  id: string;
  name: string;
  phone: string;
  created_at: string;
  email?: string;
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [tab, setTab] = useState<"notices" | "members">("notices");

  // notices
  const [notices, setNotices] = useState<Notice[]>([]);
  const [noticeLoading, setNoticeLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ category: "general", title: "", date: getToday(), content: "" });
  const [submitting, setSubmitting] = useState(false);

  // members
  const [members, setMembers] = useState<Profile[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);

  async function fetchNotices() {
    setNoticeLoading(true);
    const { data } = await supabase
      .from("notices")
      .select("*")
      .order("date", { ascending: false });
    if (data) setNotices(data);
    setNoticeLoading(false);
  }

  async function fetchMembers() {
    setMemberLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setMembers(data);
    setMemberLoading(false);
  }

  useEffect(() => {
    if (authed) {
      fetchNotices();
      fetchMembers();
    }
  }, [authed]);

  function handleLogin() {
    if (pw === ADMIN_PASSWORD) {
      setAuthed(true);
    } else {
      alert("비밀번호가 틀렸습니다.");
    }
  }

  function resetForm() {
    setForm({ category: "general", title: "", date: getToday(), content: "" });
    setEditingId(null);
  }

  function startEdit(n: Notice) {
    setEditingId(n.id);
    setForm({ category: n.category, title: n.title, date: n.date, content: n.content });
    setTab("notices");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.date.trim() || !form.content.trim()) {
      alert("모든 항목을 입력해주세요.");
      return;
    }
    setSubmitting(true);

    if (editingId) {
      const { error } = await supabase
        .from("notices")
        .update({ category: form.category, title: form.title.trim(), date: form.date.trim(), content: form.content.trim() })
        .eq("id", editingId);
      if (error) alert("수정 실패: " + error.message);
    } else {
      const { error } = await supabase
        .from("notices")
        .insert({ category: form.category, title: form.title.trim(), date: form.date.trim(), content: form.content.trim() });
      if (error) alert("등록 실패: " + error.message);
    }

    resetForm();
    await fetchNotices();
    setSubmitting(false);
  }

  async function handleDeleteNotice(id: number) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("notices").delete().eq("id", id);
    if (error) alert("삭제 실패: " + error.message);
    else await fetchNotices();
  }

  async function handleDeleteMember(id: string, name: string) {
    if (!confirm(`"${name}" 회원을 정말 삭제하시겠습니까?\n프로필 정보가 삭제됩니다.`)) return;
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) alert("삭제 실패: " + error.message);
    else await fetchMembers();
  }

  if (!authed) {
    return (
      <>
        <style>{`
          *{box-sizing:border-box;margin:0;padding:0;}
          body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e;}
          .login-wrap{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;}
          .login-box{background:#fff;border-radius:16px;padding:48px 40px;box-shadow:0 8px 40px rgba(0,0,0,0.1);max-width:400px;width:100%;text-align:center;}
          .login-box h1{font-size:24px;font-weight:800;margin-bottom:8px;}
          .login-box p{font-size:14px;color:#6b7c93;margin-bottom:28px;}
          .login-input{width:100%;padding:12px 16px;border:1px solid #e2e8f0;border-radius:8px;font-size:15px;outline:none;font-family:'Noto Sans KR',sans-serif;margin-bottom:16px;}
          .login-input:focus{border-color:#1a6fc4;}
          .login-btn{width:100%;padding:13px;background:#1a6fc4;color:#fff;font-size:15px;font-weight:700;border:none;border-radius:8px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;transition:background 160ms;}
          .login-btn:hover{background:#0d3d7a;}
          .back-link{display:inline-block;margin-top:20px;font-size:13px;color:#6b7c93;text-decoration:none;}
          .back-link:hover{color:#1a6fc4;}
        `}</style>
        <div className="login-wrap">
          <div className="login-box">
            <h1>Admin</h1>
            <p>관리자 비밀번호를 입력하세요.</p>
            <input
              className="login-input"
              type="password"
              placeholder="비밀번호"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            <button className="login-btn" onClick={handleLogin}>로그인</button>
            <a href="/" className="back-link">← 홈으로 돌아가기</a>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e;}
        a{text-decoration:none;color:inherit;}
        .admin-header{background:#1a6fc4;padding:18px 40px;display:flex;align-items:center;justify-content:space-between;}
        .admin-title{color:#fff;font-size:18px;font-weight:800;font-family:'Montserrat',sans-serif;}
        .admin-nav{display:flex;gap:12px;align-items:center;}
        .admin-nav a{color:rgba(255,255,255,0.7);font-size:13px;transition:color 140ms;}
        .admin-nav a:hover{color:#fff;}
        .logout-btn{background:rgba(255,255,255,0.15);color:#fff;border:none;padding:7px 16px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}
        .logout-btn:hover{background:rgba(255,255,255,0.25);}

        .admin-body{max-width:960px;margin:0 auto;padding:32px 24px 60px;}

        /* TABS */
        .tabs{display:flex;gap:4px;margin-bottom:28px;background:#fff;border-radius:10px;padding:4px;box-shadow:0 2px 8px rgba(0,0,0,0.06);}
        .tab-btn{flex:1;padding:12px;font-size:14px;font-weight:700;text-align:center;border:none;border-radius:8px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;background:transparent;color:#6b7c93;transition:all 160ms;}
        .tab-btn:hover{color:#1a1a2e;}
        .tab-btn.active{background:#1a6fc4;color:#fff;box-shadow:0 2px 8px rgba(26,111,196,0.3);}

        /* FORM */
        .form-card{background:#fff;border-radius:14px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,0.06);margin-bottom:32px;}
        .form-card h2{font-size:18px;font-weight:800;margin-bottom:20px;display:flex;align-items:center;gap:8px;}
        .form-row{display:flex;gap:12px;margin-bottom:14px;}
        .form-group{flex:1;}
        .form-label{display:block;font-size:12px;font-weight:600;color:#6b7c93;margin-bottom:5px;letter-spacing:0.03em;}
        .form-input{width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:'Noto Sans KR',sans-serif;outline:none;}
        .form-input:focus{border-color:#1a6fc4;}
        .form-select{width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:'Noto Sans KR',sans-serif;outline:none;background:#fff;}
        .form-textarea{width:100%;padding:12px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:'Noto Sans KR',sans-serif;outline:none;resize:vertical;min-height:140px;}
        .form-textarea:focus{border-color:#1a6fc4;}
        .form-btns{display:flex;gap:10px;margin-top:18px;}
        .btn-primary{padding:10px 24px;background:#1a6fc4;color:#fff;font-size:13px;font-weight:700;border-radius:6px;border:none;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}
        .btn-primary:hover{background:#0d3d7a;}
        .btn-primary:disabled{background:#94a3b8;cursor:not-allowed;}
        .btn-secondary{padding:10px 24px;background:#f1f5f9;color:#1a1a2e;font-size:13px;font-weight:600;border-radius:6px;border:1px solid #e2e8f0;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}
        .btn-secondary:hover{background:#e2e8f0;}

        /* TABLE */
        .list-card{background:#fff;border-radius:14px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,0.06);}
        .list-card h2{font-size:18px;font-weight:800;margin-bottom:20px;display:flex;align-items:center;gap:8px;}
        .ntable{width:100%;border-collapse:collapse;}
        .ntable th{font-size:11px;font-weight:700;color:#6b7c93;padding:10px 12px;text-align:left;border-bottom:2px solid #1a1a2e;letter-spacing:0.05em;text-transform:uppercase;}
        .ntable td{font-size:13px;padding:14px 12px;border-bottom:1px solid #e2e8f0;color:#6b7c93;vertical-align:middle;}
        .ntable tr:hover td{background:#f8fafc;}
        .ntable .n-title{font-weight:600;color:#1a1a2e;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .badge{font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;display:inline-block;}
        .badge.important{background:#fef2f2;color:#dc2626;border:1px solid #fecaca;}
        .badge.general{background:#eaf3fb;color:#1a6fc4;border:1px solid #bfdbfe;}
        .action-btns{display:flex;gap:6px;}
        .btn-edit{padding:5px 12px;background:#eaf3fb;color:#1a6fc4;font-size:11px;font-weight:700;border:1px solid #bfdbfe;border-radius:4px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}
        .btn-edit:hover{background:#dbeafe;}
        .btn-del{padding:5px 12px;background:#fef2f2;color:#dc2626;font-size:11px;font-weight:700;border:1px solid #fecaca;border-radius:4px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}
        .btn-del:hover{background:#fee2e2;}
        .empty-msg{text-align:center;padding:40px;color:#94a3b8;font-size:14px;}
        .loading-msg{text-align:center;padding:40px;color:#94a3b8;font-size:14px;}

        /* MEMBER */
        .m-name{font-weight:600;color:#1a1a2e;}
        .m-email{font-size:12px;color:#94a3b8;}
        .m-stat{display:flex;gap:24px;margin-bottom:24px;}
        .m-stat-card{flex:1;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:20px;text-align:center;}
        .m-stat-num{font-size:28px;font-weight:800;color:#1a6fc4;}
        .m-stat-label{font-size:12px;color:#6b7c93;margin-top:4px;}

        @media(max-width:768px){
          .admin-header{padding:14px 20px;}
          .admin-body{padding:20px 16px 40px;}
          .form-row{flex-direction:column;gap:14px;}
          .form-card,.list-card{padding:20px;}
          .ntable th.hide-m,.ntable td.hide-m{display:none;}
          .m-stat{flex-direction:column;gap:12px;}
        }
      `}</style>

      <div className="admin-header">
        <span className="admin-title">Dream Academy Admin</span>
        <div className="admin-nav">
          <a href="/">홈</a>
          <a href="/notice">공지사항</a>
          <button className="logout-btn" onClick={() => setAuthed(false)}>로그아웃</button>
        </div>
      </div>

      <div className="admin-body">
        {/* TABS */}
        <div className="tabs">
          <button className={`tab-btn${tab === "notices" ? " active" : ""}`} onClick={() => setTab("notices")}>
            📋 공지사항 관리
          </button>
          <button className={`tab-btn${tab === "members" ? " active" : ""}`} onClick={() => setTab("members")}>
            👥 회원 관리
          </button>
        </div>

        {/* NOTICES TAB */}
        {tab === "notices" && (
          <>
            <div className="form-card">
              <h2>{editingId ? "📝 공지사항 수정" : "📝 공지사항 작성"}</h2>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">카테고리</label>
                  <select className="form-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="general">일반</option>
                    <option value="important">중요</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">날짜</label>
                  <input className="form-input" placeholder="2026.03.21" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
              </div>
              <div style={{ marginBottom: "14px" }}>
                <label className="form-label">제목</label>
                <input className="form-input" placeholder="공지사항 제목을 입력하세요" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="form-label">내용</label>
                <textarea className="form-textarea" placeholder="공지사항 내용을 입력하세요" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
              </div>
              <div className="form-btns">
                <button className="btn-primary" disabled={submitting} onClick={handleSubmit}>
                  {submitting ? "저장 중..." : editingId ? "수정 완료" : "등록"}
                </button>
                {editingId && <button className="btn-secondary" onClick={resetForm}>취소</button>}
              </div>
            </div>

            <div className="list-card">
              <h2>📋 공지사항 목록 ({notices.length}건)</h2>
              {noticeLoading ? (
                <div className="loading-msg">불러오는 중...</div>
              ) : notices.length === 0 ? (
                <div className="empty-msg">등록된 공지사항이 없습니다.</div>
              ) : (
                <table className="ntable">
                  <thead>
                    <tr>
                      <th style={{ width: "8%" }}>구분</th>
                      <th style={{ width: "42%" }}>제목</th>
                      <th className="hide-m" style={{ width: "15%" }}>날짜</th>
                      <th style={{ width: "15%" }}>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notices.map((n) => (
                      <tr key={n.id}>
                        <td><span className={`badge ${n.category}`}>{n.category === "important" ? "중요" : "일반"}</span></td>
                        <td className="n-title">{n.title}</td>
                        <td className="hide-m">{n.date}</td>
                        <td>
                          <div className="action-btns">
                            <button className="btn-edit" onClick={() => startEdit(n)}>수정</button>
                            <button className="btn-del" onClick={() => handleDeleteNotice(n.id)}>삭제</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* MEMBERS TAB */}
        {tab === "members" && (
          <>
            <div className="m-stat">
              <div className="m-stat-card">
                <div className="m-stat-num">{members.length}</div>
                <div className="m-stat-label">전체 회원수</div>
              </div>
              <div className="m-stat-card">
                <div className="m-stat-num">
                  {members.filter((m) => {
                    const d = new Date(m.created_at);
                    const now = new Date();
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                  }).length}
                </div>
                <div className="m-stat-label">이번 달 가입</div>
              </div>
            </div>

            <div className="list-card">
              <h2>👥 회원 목록 ({members.length}명)</h2>
              {memberLoading ? (
                <div className="loading-msg">불러오는 중...</div>
              ) : members.length === 0 ? (
                <div className="empty-msg">가입된 회원이 없습니다.</div>
              ) : (
                <table className="ntable">
                  <thead>
                    <tr>
                      <th style={{ width: "20%" }}>이름</th>
                      <th className="hide-m" style={{ width: "25%" }}>이메일</th>
                      <th className="hide-m" style={{ width: "20%" }}>전화번호</th>
                      <th className="hide-m" style={{ width: "15%" }}>가입일</th>
                      <th style={{ width: "10%" }}>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id}>
                        <td className="m-name">{m.name}</td>
                        <td className="hide-m m-email">{m.id.slice(0, 8)}...</td>
                        <td className="hide-m">{m.phone}</td>
                        <td className="hide-m">{formatDate(m.created_at)}</td>
                        <td>
                          <button className="btn-del" onClick={() => handleDeleteMember(m.id, m.name)}>삭제</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
