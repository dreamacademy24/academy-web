"use client";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";

type Badge = "P1" | "P2" | "P3" | "P4" | "P5" | "bug";
interface BoardItem {
  id: string;
  title: string;
  badge?: Badge;
  done: boolean;
  memo: string;
  memoOpen?: boolean;
}
interface BoardChapter {
  id: string;
  title: string;
  sub: string;
  items: BoardItem[];
}
interface Board {
  version: number;
  active: string;
  chapters: BoardChapter[];
}

const SEED: Board = {
  version: 2,
  active: "c1",
  chapters: [
    {
      id: "c1", title: "온라인 결제", sub: "포트원(PortOne) V2 · 한국 사업자 + 원화",
      items: [
        { id: "c1-1", title: "포트원 콘솔 가입 + 테스트 환경 확인 (console.portone.io)", done: false, memo: "" },
        { id: "c1-2", title: "전자결제(PG) 신청 → 구매안전서비스 이용확인증 발급 (Dream Company 사업자등록증 + 국내 정산계좌 필요)", done: false, memo: "" },
        { id: "c1-3", title: "통신판매업 신고 (확인증으로 정부24 또는 관할 구청)", done: false, memo: "" },
        { id: "c1-4", title: "신고번호를 사이트·PG에 기재 → 카드사 심사 (영업일 7~10일)", done: false, memo: "" },
        { id: "c1-5", title: "결제수단 설계: 카드 할부 / 가상계좌 / 카카오페이 / 네이버페이", done: false, memo: "" },
        { id: "c1-6", title: "SDK 연동: 결제버튼 → Next.js API route 서버검증 → Supabase 저장 (@portone/browser-sdk)", done: false, memo: "" },
        { id: "c1-7", title: "키 관리: API Secret을 Vercel 환경변수로 (프론트 노출 금지)", done: false, memo: "" },
        { id: "c1-8", title: "에스크로 의무·해외서비스 세무 처리 세무사 확인", done: false, memo: "" },
        { id: "c1-9", title: "PayPal Live 모드 전환: 회사 서류 제출 → Live Client ID → Vercel 환경변수", done: false, memo: "" },
      ],
    },
    {
      id: "c2", title: "예약·견적", sub: "/booking · 견적서 · 인보이스",
      items: [
        { id: "c2-1", title: "견적서 포함/불포함 박스 — 숙소별(드림하우스·제이파크·큐브나인) 패키지 포함·불포함 자동 표시", badge: "P1", done: false, memo: "" },
        { id: "c2-2", title: "/booking 동의 체크박스 — \"예약 접수하기\" 위 체크박스, 미체크 시 버튼 비활성화", badge: "P2", done: false, memo: "" },
        { id: "c2-3", title: "교재비/재료비 자동추가 — 주니어 교재비·킨더 재료비, 페소(₱) 표기", badge: "P3", done: false, memo: "" },
        { id: "c2-4", title: "견적 체크아웃 자동 표시 — 체크인 + 주수×7일 계산, read-only", badge: "P5", done: false, memo: "" },
        { id: "c2-5", title: "통학형 booking2 개선 — 통학형 선택 시 숙소 섹션 숨김 + 픽드랍 주소 입력", done: false, memo: "" },
        { id: "c2-6", title: "영수증 체크인/체크아웃 시간 표기 — 라벨→값으로 합쳐 표시 (체크인 15:00 / 체크아웃 12noon·22:30)", done: false, memo: "" },
        { id: "c2-7", title: "어드민 신규 예약 모달 6종 통일 — 제이파크 단독·큐브나인 단독 추가", badge: "P4", done: false, memo: "" },
      ],
    },
    {
      id: "c3", title: "투어셔틀", sub: "전체 재설계 — 3개 화면 통합",
      items: [
        { id: "c3-1", title: "3개 화면 통합 재설계 (portal/shuttle · my-applications · admin/tour-shuttle)", done: false, memo: "" },
        { id: "c3-2", title: "신청 저장 버그 — 투어별 1행 저장 (현재 한 행에 합쳐 저장됨)", badge: "bug", done: false, memo: "" },
        { id: "c3-3", title: "인원수 per-tour inline 입력 (체크 시 카드에 인원 필드)", done: false, memo: "" },
        { id: "c3-4", title: "어드민 그룹뷰 + 필수 컬럼 (투어 날짜/시간/인원, 예약자·픽업·탑승자·인원·요청·상태)", done: false, memo: "" },
        { id: "c3-5", title: "end-to-end 검증 (신청 → 게스트 확인 → 어드민 표시)", done: false, memo: "" },
      ],
    },
    {
      id: "c4", title: "튜터", sub: "대부분 완료 — 잔여 기능·버그",
      items: [
        { id: "c4-1", title: "튜터 수업 수정 기능 — 하루/전체 시간 변경, 결강 처리", done: false, memo: "" },
        { id: "c4-2", title: "영어레벨 \"enrolled\" → 실제 레벨명으로 표시", done: false, memo: "" },
        { id: "c4-3", title: "tutor_lessons.time_overrides 컬럼 누락 확인 (INSERT 무음 실패)", badge: "bug", done: false, memo: "" },
        { id: "c4-4", title: "한국어 dayMap 세션생성 0건 문제 수정 (confirmed 전환 시)", badge: "bug", done: false, memo: "" },
        { id: "c4-5", title: "튜터 신청폼 ⑥ 변경날짜 구조화 (reschedule 로직 구현 후)", done: false, memo: "" },
      ],
    },
    {
      id: "c5", title: "손님 알림", sub: "포털 알림 · 카카오톡 · 푸시",
      items: [
        { id: "c5-1", title: "튜터 확정 시 포털 인보이스 알림 — confirmed 시 대시보드 배너/카드 → /portal/tutor 인보이스 뷰", done: false, memo: "" },
        { id: "c5-2", title: "튜터 날짜별 메모 번역 — /api/translate(haiku) + 메모 표시 + 번역 버튼 + \"📝 새 메모\" 배지", done: false, memo: "" },
        { id: "c5-3", title: "카카오톡 채널 위젯 — 채널 홈 ID + JS API 키 + layout.tsx 추가", done: false, memo: "" },
        { id: "c5-4", title: "브라우저 푸시 알림 — PWA 전환 선행 → web-push + VAPID + push_subscriptions 테이블", done: false, memo: "" },
      ],
    },
    {
      id: "c6", title: "OCR", sub: "항공권 사진 자동입력",
      items: [
        { id: "c6-1", title: "platform.claude.ai에서 API 크레딧 충전", done: false, memo: "" },
        { id: "c6-2", title: "Vercel 환경변수 ANTHROPIC_API_KEY 등록", done: false, memo: "" },
        { id: "c6-3", title: "활성화 후 항공권 OCR 자동입력 end-to-end 검증", done: false, memo: "" },
      ],
    },
  ],
};

function genId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function badgeStyle(b?: Badge): { label: string; bg: string; color: string } | null {
  if (!b) return null;
  if (b === "bug") return { label: "버그", bg: "#a8463a", color: "#fff" };
  return { label: b, bg: "#b3791b", color: "#fff" };
}

export default function AdminBoardMayPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [board, setBoard] = useState<Board>(SEED);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [addInput, setAddInput] = useState<Record<string, string>>({});
  const [addBadge, setAddBadge] = useState<Record<string, "" | Badge>>({});

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 인증 가드 (tour-shuttle 패턴)
  useEffect(() => {
    if (!isAdminAuthed()) { router.replace("/login"); return; }
    setAuthed(true);
  }, [router]);

  // 초기 로드
  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/admin/board");
        const j = await r.json().catch(() => null);
        if (cancelled) return;
        if (j && j.data && Array.isArray(j.data.chapters)) {
          setBoard(j.data as Board);
        } else {
          setBoard(SEED);
          // 즉시 PUT 저장 (initial seed)
          fetch("/api/admin/board", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(SEED),
          }).catch(() => {});
        }
      } catch (e) {
        console.error("board load failed:", e);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [authed]);

  // 디바운스 저장
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch("/api/admin/board", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(board),
        });
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1200);
      } catch (e) {
        console.error("board save failed:", e);
      } finally {
        setSaving(false);
      }
    }, 350);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [board, loaded]);

  const stats = useMemo(() => {
    let total = 0, done = 0;
    for (const c of board.chapters) for (const it of c.items) { total++; if (it.done) done++; }
    return { total, done, pct: total > 0 ? Math.round(done / total * 100) : 0 };
  }, [board]);

  const activeChapter = useMemo(
    () => board.chapters.find(c => c.id === board.active) || board.chapters[0] || null,
    [board]
  );

  const setActive = useCallback((id: string) => {
    setBoard(b => ({ ...b, active: id }));
  }, []);

  const toggleDone = useCallback((cid: string, iid: string) => {
    setBoard(b => ({
      ...b,
      chapters: b.chapters.map(c => c.id !== cid ? c : {
        ...c,
        items: c.items.map(i => i.id !== iid ? i : { ...i, done: !i.done }),
      }),
    }));
  }, []);

  const toggleMemoOpen = useCallback((cid: string, iid: string) => {
    setBoard(b => ({
      ...b,
      chapters: b.chapters.map(c => c.id !== cid ? c : {
        ...c,
        items: c.items.map(i => i.id !== iid ? i : { ...i, memoOpen: !i.memoOpen }),
      }),
    }));
  }, []);

  const setMemo = useCallback((cid: string, iid: string, memo: string) => {
    setBoard(b => ({
      ...b,
      chapters: b.chapters.map(c => c.id !== cid ? c : {
        ...c,
        items: c.items.map(i => i.id !== iid ? i : { ...i, memo }),
      }),
    }));
  }, []);

  const deleteItem = useCallback((cid: string, iid: string, title: string) => {
    if (!confirm(`항목 "${title}"을(를) 삭제할까요?`)) return;
    setBoard(b => ({
      ...b,
      chapters: b.chapters.map(c => c.id !== cid ? c : {
        ...c,
        items: c.items.filter(i => i.id !== iid),
      }),
    }));
  }, []);

  const addItem = useCallback((cid: string) => {
    const title = (addInput[cid] || "").trim();
    if (!title) return;
    const badge = (addBadge[cid] || "") as "" | Badge;
    setBoard(b => ({
      ...b,
      chapters: b.chapters.map(c => c.id !== cid ? c : {
        ...c,
        items: [...c.items, {
          id: genId(cid),
          title,
          ...(badge ? { badge: badge as Badge } : {}),
          done: false,
          memo: "",
        }],
      }),
    }));
    setAddInput(prev => ({ ...prev, [cid]: "" }));
    setAddBadge(prev => ({ ...prev, [cid]: "" }));
  }, [addInput, addBadge]);

  const addChapter = useCallback(() => {
    const title = prompt("새 챕터 이름을 입력하세요:");
    if (!title || !title.trim()) return;
    const sub = prompt("부제(설명)를 입력하세요 (생략 가능):") || "";
    const id = genId("c");
    setBoard(b => ({
      ...b,
      active: id,
      chapters: [...b.chapters, { id, title: title.trim(), sub: sub.trim(), items: [] }],
    }));
  }, []);

  const resetBoard = useCallback(() => {
    if (!confirm("보드를 기본값으로 초기화할까요? 현재 내용이 모두 사라집니다.")) return;
    setBoard(SEED);
  }, []);

  if (!authed) return null;

  const r = 20;
  const C = 2 * Math.PI * r;
  const fillLen = C * stats.pct / 100;

  return (
    <div className="board-page">
      <div className="topbar">
        <button className="back" onClick={() => router.push("/admin/hub")}>← 어드민 홈</button>
        <div className="spacer" />
        <div className="save-flag">
          {saving ? "저장 중…" : savedFlash ? "✓ 저장됨" : ""}
        </div>
      </div>

      <div className="header-card">
        <div className="gauge">
          <svg width="56" height="56" viewBox="0 0 48 48" aria-label={`진행률 ${stats.pct}%`}>
            <circle cx="24" cy="24" r={r} fill="none" stroke="#ddd4c0" strokeWidth="6" />
            <circle
              cx="24" cy="24" r={r} fill="none"
              stroke="#1a5f5a" strokeWidth="6"
              strokeDasharray={`${fillLen} ${C}`}
              strokeLinecap="round"
              transform="rotate(-90 24 24)"
            />
            <text x="24" y="28" textAnchor="middle" fontSize="11" fontWeight={800} fill="#25231d">
              {stats.pct}%
            </text>
          </svg>
        </div>
        <div className="head-text">
          <div className="head-title">업무 보드 — May</div>
          <div className="head-sub">
            {board.chapters.length}개 챕터 · 전체 {stats.total}건 중 <b>{stats.done}건</b> 완료
          </div>
        </div>
      </div>

      <div className="tabs-row">
        {board.chapters.map(c => {
          const t = c.items.length;
          const d = c.items.filter(i => i.done).length;
          const allDone = t > 0 && d === t;
          const isActive = c.id === board.active;
          return (
            <button
              key={c.id}
              className={isActive ? "tab ac" : "tab"}
              onClick={() => setActive(c.id)}
              title={c.sub}
            >
              <span className="tab-title">{c.title}</span>
              <span className="tab-cnt">{d}/{t}</span>
              {allDone && <span className="tab-tick">✓</span>}
            </button>
          );
        })}
      </div>

      {activeChapter && (
        <div className="chapter-card">
          <div className="chapter-head">
            <div className="ch-title">{activeChapter.title}</div>
            <div className="ch-sub">{activeChapter.sub}</div>
          </div>

          <ul className="items">
            {activeChapter.items.length === 0 && (
              <li className="empty">아직 항목이 없습니다. 아래에서 추가하세요.</li>
            )}
            {activeChapter.items.map((it, idx) => {
              const bs = badgeStyle(it.badge);
              return (
                <li key={it.id} className={it.done ? "item done" : "item"}>
                  <div className="item-row">
                    <input
                      type="checkbox"
                      className="chk"
                      checked={it.done}
                      onChange={() => toggleDone(activeChapter.id, it.id)}
                      aria-label="완료 토글"
                    />
                    <span className="num">{idx + 1}.</span>
                    <span className="title">{it.title}</span>
                    {bs && (
                      <span className="badge" style={{ background: bs.bg, color: bs.color }}>
                        {bs.label}
                      </span>
                    )}
                    <button
                      type="button"
                      className="btn-mini"
                      onClick={() => toggleMemoOpen(activeChapter.id, it.id)}
                      title="메모"
                    >
                      {it.memoOpen ? "메모 닫기" : it.memo ? "📝 메모" : "메모"}
                    </button>
                    <button
                      type="button"
                      className="btn-mini danger"
                      onClick={() => deleteItem(activeChapter.id, it.id, it.title)}
                      title="삭제"
                    >
                      삭제
                    </button>
                  </div>
                  {it.memoOpen && (
                    <textarea
                      className="memo"
                      placeholder="메모를 입력하세요 (자동 저장)"
                      value={it.memo}
                      onChange={e => setMemo(activeChapter.id, it.id, e.target.value)}
                    />
                  )}
                </li>
              );
            })}
          </ul>

          <div className="add-row">
            <input
              type="text"
              className="add-input"
              placeholder="이 챕터에 업무 추가…"
              value={addInput[activeChapter.id] || ""}
              onChange={e => setAddInput(prev => ({ ...prev, [activeChapter.id]: e.target.value }))}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addItem(activeChapter.id); } }}
            />
            <select
              className="add-badge"
              value={addBadge[activeChapter.id] || ""}
              onChange={e => setAddBadge(prev => ({ ...prev, [activeChapter.id]: e.target.value as "" | Badge }))}
            >
              <option value="">배지 없음</option>
              <option value="P1">P1</option>
              <option value="P2">P2</option>
              <option value="P3">P3</option>
              <option value="P4">P4</option>
              <option value="P5">P5</option>
              <option value="bug">버그</option>
            </select>
            <button className="btn-add" onClick={() => addItem(activeChapter.id)}>＋ 추가</button>
          </div>
        </div>
      )}

      <div className="bottom-row">
        <button className="btn-bottom" onClick={addChapter}>＋ 챕터 추가</button>
        <button className="btn-bottom reset" onClick={resetBoard}>기본값으로 초기화</button>
      </div>

      <style jsx>{`
        .board-page {
          min-height: 100vh;
          background: #f3eee2;
          color: #25231d;
          padding: 20px 16px 60px;
          font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .topbar {
          display: flex;
          align-items: center;
          gap: 10px;
          max-width: 980px;
          margin: 0 auto 12px;
        }
        .back {
          padding: 7px 14px;
          background: #fffdf7;
          border: 1px solid #ddd4c0;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 700;
          color: #25231d;
          cursor: pointer;
          font-family: inherit;
        }
        .back:hover { background: #f3eee2; }
        .spacer { flex: 1; }
        .save-flag {
          font-size: 12px;
          font-weight: 700;
          color: #4a7a4f;
          min-width: 60px;
          text-align: right;
        }
        .header-card {
          display: flex;
          align-items: center;
          gap: 14px;
          max-width: 980px;
          margin: 0 auto 14px;
          background: #fffdf7;
          border: 1px solid #ddd4c0;
          border-radius: 12px;
          padding: 14px 18px;
        }
        .gauge { flex-shrink: 0; }
        .head-text { display: flex; flex-direction: column; gap: 4px; }
        .head-title {
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -0.01em;
          color: #25231d;
        }
        .head-sub {
          font-size: 12.5px;
          color: #6b6557;
          font-weight: 600;
        }
        .head-sub b { color: #4a7a4f; font-weight: 800; }
        .tabs-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          max-width: 980px;
          margin: 0 auto 14px;
        }
        .tab {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: #fffdf7;
          border: 1px solid #ddd4c0;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          color: #25231d;
          cursor: pointer;
          font-family: inherit;
          transition: all 120ms;
        }
        .tab:hover:not(.ac) { background: #f3eee2; }
        .tab.ac {
          background: #1a5f5a;
          color: #fffdf7;
          border-color: #1a5f5a;
        }
        .tab .tab-cnt {
          font-size: 11px;
          font-weight: 700;
          color: #6b6557;
          background: #f3eee2;
          padding: 2px 7px;
          border-radius: 999px;
        }
        .tab.ac .tab-cnt { background: rgba(255,253,247,0.18); color: #fffdf7; }
        .tab-tick { color: #4a7a4f; font-weight: 800; }
        .tab.ac .tab-tick { color: #c7e8c7; }

        .chapter-card {
          max-width: 980px;
          margin: 0 auto 16px;
          background: #fffdf7;
          border: 1px solid #ddd4c0;
          border-radius: 14px;
          padding: 18px 20px;
        }
        .chapter-head {
          padding-bottom: 12px;
          border-bottom: 1px solid #ddd4c0;
          margin-bottom: 14px;
        }
        .ch-title { font-size: 18px; font-weight: 800; color: #25231d; }
        .ch-sub { font-size: 12.5px; color: #6b6557; font-weight: 600; margin-top: 3px; }

        .items { list-style: none; margin: 0; padding: 0; }
        .empty {
          text-align: center;
          padding: 28px;
          color: #b3aa97;
          font-size: 13px;
          font-style: italic;
        }
        .item {
          padding: 10px 0;
          border-bottom: 1px solid #ece5d3;
        }
        .item:last-child { border-bottom: none; }
        .item-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .chk {
          width: 18px; height: 18px;
          accent-color: #4a7a4f;
          cursor: pointer;
          flex-shrink: 0;
        }
        .num {
          font-size: 12.5px;
          font-weight: 800;
          color: #1a5f5a;
          min-width: 22px;
        }
        .title {
          flex: 1;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.5;
          color: #25231d;
          word-break: keep-all;
        }
        .item.done .title {
          text-decoration: line-through;
          color: #b3aa97;
        }
        .item.done .num { color: #b3aa97; }
        .badge {
          display: inline-block;
          padding: 2px 9px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.04em;
        }
        .btn-mini {
          padding: 5px 11px;
          background: #fffdf7;
          border: 1px solid #ddd4c0;
          border-radius: 7px;
          font-size: 11.5px;
          font-weight: 700;
          color: #25231d;
          cursor: pointer;
          font-family: inherit;
        }
        .btn-mini:hover { background: #f3eee2; }
        .btn-mini.danger { color: #a8463a; border-color: #e9c7c0; }
        .btn-mini.danger:hover { background: #fdecea; }

        .memo {
          width: 100%;
          margin-top: 8px;
          padding: 9px 12px;
          background: #faf6ea;
          border: 1px solid #ddd4c0;
          border-radius: 8px;
          font-size: 13px;
          font-family: inherit;
          color: #25231d;
          outline: none;
          resize: vertical;
          min-height: 60px;
          line-height: 1.5;
        }
        .memo:focus { border-color: #1a5f5a; }

        .add-row {
          display: flex;
          gap: 8px;
          margin-top: 16px;
          padding-top: 14px;
          border-top: 1px dashed #ddd4c0;
          flex-wrap: wrap;
        }
        .add-input {
          flex: 1;
          min-width: 220px;
          padding: 9px 12px;
          background: #fffdf7;
          border: 1px solid #ddd4c0;
          border-radius: 8px;
          font-size: 13px;
          font-family: inherit;
          color: #25231d;
          outline: none;
        }
        .add-input:focus { border-color: #1a5f5a; }
        .add-badge {
          padding: 9px 10px;
          background: #fffdf7;
          border: 1px solid #ddd4c0;
          border-radius: 8px;
          font-size: 13px;
          font-family: inherit;
          color: #25231d;
          outline: none;
          min-width: 110px;
        }
        .btn-add {
          padding: 9px 16px;
          background: #1a5f5a;
          color: #fffdf7;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
        }
        .btn-add:hover { background: #144b48; }

        .bottom-row {
          display: flex;
          gap: 10px;
          max-width: 980px;
          margin: 0 auto;
          justify-content: center;
          flex-wrap: wrap;
        }
        .btn-bottom {
          padding: 10px 20px;
          background: #fffdf7;
          border: 1px solid #ddd4c0;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          color: #25231d;
          cursor: pointer;
          font-family: inherit;
        }
        .btn-bottom:hover { background: #f3eee2; }
        .btn-bottom.reset { color: #a8463a; border-color: #e9c7c0; }
        .btn-bottom.reset:hover { background: #fdecea; }

        @media (max-width: 640px) {
          .header-card { padding: 12px 14px; }
          .chapter-card { padding: 14px 14px; }
          .head-title { font-size: 15px; }
          .ch-title { font-size: 16px; }
          .title { font-size: 13.5px; }
        }
      `}</style>
    </div>
  );
}
