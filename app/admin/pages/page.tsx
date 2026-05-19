"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";

const BASE_URL = "https://www.dreamacademyph.com";

const PAGES: { url: string; label: string; desc: string }[] = [
  { url: "/", label: "메인 홈", desc: "드림아카데미 메인 랜딩 페이지" },
  { url: "/summer", label: "여름 캠프", desc: "여름 프로그램 소개 페이지" },
  { url: "/booking", label: "올인원 예약", desc: "패키지 예약 접수 폼" },
  { url: "/booking2", label: "비패키지 예약", desc: "자유 일정 예약 접수 폼" },
  { url: "/accommodation", label: "숙소 안내", desc: "숙소 종류 및 요금 안내" },
  { url: "/dreamhouse-rooms", label: "드림하우스 룸", desc: "드림하우스 룸 상세 안내" },
  { url: "/playdream", label: "PlayDream", desc: "PlayDream 브랜드 페이지" },
  { url: "/pdallday", label: "PlayDream 올데이", desc: "PlayDream 올데이 프로그램" },
  { url: "/junior", label: "주니어 프로그램", desc: "주니어 영어 수업 안내" },
  { url: "/kinder", label: "킨더 프로그램", desc: "킨더 영어 수업 안내" },
  { url: "/package", label: "패키지 안내", desc: "전체 패키지 요금 안내" },
  { url: "/after-school-fieldtrip", label: "방과후/필드트립", desc: "방과후 수업 및 필드트립 안내" },
  { url: "/community", label: "커뮤니티", desc: "커뮤니티 게시판" },
  { url: "/notice", label: "공지사항", desc: "공지사항 페이지" },
  { url: "/guide", label: "가이드", desc: "이용 가이드 안내" },
  { url: "/tutor-apply", label: "튜터 지원", desc: "튜터 채용 지원 폼" },
  { url: "/install", label: "앱 설치", desc: "PWA 설치 안내 페이지" },
  { url: "/qr", label: "QR 페이지", desc: "QR 코드 랜딩" },
  { url: "/minedu", label: "민에듀", desc: "민에듀 전용 랜딩 (/mf-2025 리다이렉트)" },
];

export default function AdminPagesPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (isAdminAuthed()) setAuthed(true);
    else if (typeof window !== "undefined") window.location.href = "/login";
  }, []);

  function copy(url: string) {
    const full = BASE_URL + url;
    navigator.clipboard.writeText(full).then(() => {
      setCopied(url);
      setTimeout(() => setCopied((c) => (c === url ? null : c)), 1400);
    });
  }

  function open(url: string) {
    window.open(BASE_URL + url, "_blank", "noopener,noreferrer");
  }

  const filtered = PAGES.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.label.toLowerCase().includes(q) ||
      p.url.toLowerCase().includes(q) ||
      p.desc.toLowerCase().includes(q)
    );
  });

  if (!authed) return null;

  return (
    <>
      <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.pg-w{max-width:1100px;margin:0 auto;padding:32px 24px}
.pg-top{display:flex;align-items:center;gap:12px;margin-bottom:8px}
.pg-back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.pg-back:hover{background:#e2e8f0}
.pg-top h1{font-size:22px;font-weight:800;flex:1}
.pg-sub{font-size:13px;color:#6b7c93;margin-bottom:20px;padding-left:42px}
.pg-toolbar{display:flex;gap:8px;margin-bottom:14px;align-items:center;flex-wrap:wrap}
.pg-search{flex:1;min-width:200px;padding:9px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;outline:none;background:#fff}.pg-search:focus{border-color:#1a6fc4}
.pg-cnt{font-size:12px;color:#6b7c93;font-weight:600}
.pg-list{border-top:1px solid #e2e8f0}
.pg-row{display:grid;grid-template-columns:150px 1fr 220px 40px 60px;gap:14px;align-items:center;padding:11px 6px;border-bottom:1px solid #e2e8f0;transition:background 120ms}
.pg-row.pg-head{background:#f8fafc;font-size:11px;font-weight:700;color:#6b7c93;text-transform:uppercase;letter-spacing:.05em;padding:8px 6px}
.pg-row:not(.pg-head):hover{background:#f8fafc}
.pg-label{font-size:13px;font-weight:700;color:#1a1a2e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pg-desc{font-size:12px;color:#6b7c93;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pg-url{font-family:'SF Mono','Consolas','Menlo',monospace;font-size:12px;color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pg-copy{background:none;border:1px solid #e2e8f0;cursor:pointer;font-size:13px;padding:5px;border-radius:6px;color:#6b7c93;font-family:inherit;transition:all 120ms;width:34px;height:30px;display:inline-flex;align-items:center;justify-content:center}.pg-copy:hover{background:#e2e8f0;color:#1a6fc4;border-color:#cbd5e1}
.pg-copy.is-copied{color:#16a34a;font-size:10px;font-weight:700;border-color:#86efac;background:#f0fdf4}
.pg-open{padding:6px 10px;background:#1a6fc4;color:#fff;border:none;border-radius:6px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;justify-content:center;gap:3px;height:30px;transition:all 120ms}.pg-open:hover{background:#0d3d7a}
.pg-empty{text-align:center;padding:40px;color:#94a3b8;font-size:14px}
@media(max-width:760px){
  .pg-w{padding:20px 14px}.pg-sub{padding-left:0}
  .pg-row{grid-template-columns:1fr auto auto;grid-template-areas:'label copy open' 'desc desc desc' 'url url url';gap:6px 10px;padding:14px 4px}
  .pg-row.pg-head{display:none}
  .pg-label{grid-area:label}.pg-desc{grid-area:desc;white-space:normal}.pg-url{grid-area:url}.pg-copy{grid-area:copy;justify-self:end}.pg-open{grid-area:open;justify-self:end}
}
      `}</style>
      <div className="pg-w">
        <div className="pg-top">
          <button className="pg-back" onClick={() => router.push("/admin/hub")}>←</button>
          <h1>페이지 관리</h1>
        </div>
        <div className="pg-sub">공개 URL 목록 및 링크 모음 ({BASE_URL})</div>

        <div className="pg-toolbar">
          <input
            className="pg-search"
            placeholder="이름·URL·설명 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="pg-cnt">{filtered.length} / {PAGES.length}개</span>
        </div>

        <div className="pg-list">
          <div className="pg-row pg-head">
            <div>라벨</div>
            <div>설명</div>
            <div>URL</div>
            <div>복사</div>
            <div>열기</div>
          </div>
          {filtered.length === 0 ? (
            <div className="pg-empty">검색 결과가 없습니다</div>
          ) : (
            filtered.map((p) => (
              <div key={p.url} className="pg-row">
                <div className="pg-label" title={p.label}>{p.label}</div>
                <div className="pg-desc" title={p.desc}>{p.desc}</div>
                <div className="pg-url" title={BASE_URL + p.url}>{p.url}</div>
                <button
                  className={`pg-copy${copied === p.url ? " is-copied" : ""}`}
                  onClick={() => copy(p.url)}
                  title="URL 복사"
                >
                  {copied === p.url ? "✓" : "📋"}
                </button>
                <button className="pg-open" onClick={() => open(p.url)} title="새 탭에서 열기">
                  열기 ↗
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
