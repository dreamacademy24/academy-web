"use client";
/* 드림 키즈 — 게이미피케이션 영어 학습 앱 프로토타입 (목업 데이터, 전 화면 클릭 가능)
   코스 > 유닛 > 레슨 · 월드맵 · 데일리 미션/스트릭 · 레슨 플레이어(영상→말하기→퀴즈→결과) · 학부모 모드 · 사용시간 제한 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COURSES, ALL_LESSONS, STICKERS, MASCOT_LINES, type Course, type CourseId, type Lesson } from "./data";

/* ───────── 상태 저장 (localStorage) ───────── */
type Pron = { date: string; score: number };
type State = {
  name: string; stars: Record<string, number>; stickers: string[];
  streak: number; lastDay: string; dayKey: string; minutesToday: number;
  history: Record<string, number>; pron: Pron[]; limitMin: number; pin: string; voice: boolean; course: CourseId;
};
const KEY = "dk_state_v1";
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const dayOffset = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

function seed(): State {
  // 데모용 진행 상황: 파닉스 전부 + 초록마을 1유닛 완료
  const stars: Record<string, number> = {};
  ALL_LESSONS.slice(0, 12).forEach((l, i) => { stars[l.id] = i < 9 ? 3 : i < 11 ? 2 : 1; });
  const history: Record<string, number> = {};
  [14, 12, 9, 8, 11, 0, 7].forEach((m, i) => { history[dayOffset(i - 6)] = m; });
  const pron: Pron[] = [72, 78, 81, 79, 86, 88, 91].map((s, i) => ({ date: dayOffset(i - 6), score: s }));
  return { name: "", stars, stickers: ["🦄", "🚀", "🌈", "🍭"], streak: 4, lastDay: dayOffset(-1), dayKey: today(), minutesToday: 7, history, pron, limitMin: 20, pin: "1234", voice: true, course: "ground" };
}
function load(): State {
  if (typeof window === "undefined") return seed();
  try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && s.stars) return { ...seed(), ...s }; } catch {}
  return seed();
}

/* ───────── 음성 (Web Speech) ───────── */
function speak(text: string, lang = "ko-KR", rate = 1) {
  try {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = lang; u.rate = rate; u.pitch = lang.startsWith("ko") ? 1.15 : 1.05;
    window.speechSynthesis.speak(u);
  } catch {}
}

/* ───────── 마스코트 ───────── */
function Dreamy({ happy, size = 96, say, voice, className = "" }: { happy?: boolean; size?: number; say?: string; voice?: boolean; className?: string }) {
  useEffect(() => { if (say && voice) speak(say); }, [say, voice]);
  return (
    <div className={`flex items-end gap-3 ${className}`}>
      <img src={`/learning/tree-house/dreamy-${happy ? "happy" : "wave"}.webp`} alt="드림이" width={size} height={Math.round(size * 1.33)}
        className={happy ? "k-wiggle" : "k-bob"} style={{ width: size, height: "auto", flexShrink: 0 }} draggable={false} />
      {say && (
        <div className="k-pop relative rounded-2xl bg-white px-4 py-3 text-[15px] font-bold leading-snug text-[#1E2A3A] shadow-[0_6px_18px_rgba(30,42,58,.10)]" style={{ maxWidth: 260 }}>
          <span className="absolute -left-2 bottom-4 h-4 w-4 rotate-45 bg-white" />
          {say}
        </div>
      )}
    </div>
  );
}

function Stars({ n, size = 18 }: { n: number; size?: number }) {
  return <span style={{ fontSize: size, letterSpacing: -2 }}>{[0, 1, 2].map(i => <span key={i} style={{ opacity: i < n ? 1 : 0.22 }}>⭐</span>)}</span>;
}

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 40 }, (_, i) => ({ l: Math.random() * 100, d: Math.random() * 1.2, c: ["#F0B429", "#2E6BD6", "#3CB371", "#9B5DE5", "#FF6B6B"][i % 5] })), []);
  return <>{pieces.map((p, i) => <span key={i} className="k-confetti" style={{ left: `${p.l}%`, background: p.c, animationDelay: `${p.d}s` }} />)}</>;
}

/* ───────── 메인 ───────── */
type Screen = { name: "start" } | { name: "home" } | { name: "unit"; unitId: string } | { name: "play"; lessonId: string } | { name: "parent" } | { name: "locked" };

export default function KidsApp() {
  const [st, setSt] = useState<State>(seed);
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<Screen>({ name: "start" });
  useEffect(() => { const s = load(); setSt(s); setScreen(s.name ? { name: "home" } : { name: "start" }); setReady(true); }, []);
  useEffect(() => { if (ready) try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} }, [st, ready]);

  // 날짜 바뀌면 오늘 사용시간 리셋 + 스트릭 판정
  useEffect(() => {
    if (!ready) return;
    const t = today();
    if (st.dayKey !== t) {
      const keep = st.lastDay === dayOffset(-1) || st.lastDay === t;
      setSt(s => ({ ...s, dayKey: t, minutesToday: 0, streak: keep ? s.streak : 0 }));
    }
  }, [ready, st.dayKey, st.lastDay]);

  // 사용시간 누적 (1분마다) + 제한 도달 시 잠금
  useEffect(() => {
    if (!ready || screen.name === "parent" || screen.name === "locked" || screen.name === "start") return;
    const id = setInterval(() => setSt(s => ({ ...s, minutesToday: s.minutesToday + 1, history: { ...s.history, [today()]: (s.history[today()] || 0) + 1 } })), 60000);
    return () => clearInterval(id);
  }, [ready, screen.name]);
  useEffect(() => { if (ready && screen.name !== "parent" && screen.name !== "locked" && st.minutesToday >= st.limitMin) setScreen({ name: "locked" }); }, [ready, st.minutesToday, st.limitMin, screen.name]);

  const unlocked = useCallback((lessonId: string) => {
    const idx = ALL_LESSONS.findIndex(l => l.id === lessonId);
    if (idx <= 0) return true;
    return (st.stars[ALL_LESSONS[idx - 1].id] || 0) > 0;
  }, [st.stars]);

  const finishLesson = (lessonId: string, stars: number, pronScore: number | null, minutes: number) => {
    setSt(s => {
      const t = today();
      const prevStars = s.stars[lessonId] || 0;
      const streak = s.lastDay === t ? s.streak : (s.lastDay === dayOffset(-1) ? s.streak + 1 : 1);
      const newSticker = prevStars === 0 ? STICKERS.find(x => !s.stickers.includes(x)) : undefined;
      return {
        ...s, stars: { ...s.stars, [lessonId]: Math.max(prevStars, stars) }, streak, lastDay: t,
        stickers: newSticker ? [...s.stickers, newSticker] : s.stickers,
        minutesToday: s.minutesToday + minutes, history: { ...s.history, [t]: (s.history[t] || 0) + minutes },
        pron: pronScore != null ? [...s.pron, { date: t, score: pronScore }] : s.pron,
      };
    });
  };

  if (!ready) return <div className="kids-app min-h-screen bg-[#F7F4EA]" />;

  const shell = (child: React.ReactNode) => (
    <div className="kids-app min-h-screen bg-[#F7F4EA] text-[#1E2A3A]">
      <div className="mx-auto min-h-screen w-full max-w-[1100px]">{child}</div>
    </div>
  );

  if (screen.name === "start") return shell(<StartScreen st={st} onDone={(name) => { setSt(s => ({ ...s, name })); setScreen({ name: "home" }); }} />);
  if (screen.name === "locked") return shell(<LockedScreen st={st} onParent={() => setScreen({ name: "parent" })} />);
  if (screen.name === "parent") return shell(<ParentScreen st={st} setSt={setSt} onBack={() => setScreen(st.minutesToday >= st.limitMin ? { name: "locked" } : { name: "home" })} />);
  if (screen.name === "play") {
    const lesson = ALL_LESSONS.find(l => l.id === screen.lessonId)!;
    const course = COURSES.find(c => c.id === lesson.courseId)!;
    return shell(<Player lesson={lesson} course={course} voice={st.voice} name={st.name}
      onExit={() => setScreen({ name: "home" })}
      onFinish={(stars, pron, min) => { finishLesson(lesson.id, stars, pron, min); }} />);
  }
  return shell(<Home st={st} setSt={setSt} unlocked={unlocked} onPlay={(id) => setScreen({ name: "play", lessonId: id })} onParent={() => setScreen({ name: "parent" })} />);
}

/* ───────── 시작 화면 ───────── */
function StartScreen({ st, onDone }: { st: State; onDone: (n: string) => void }) {
  const [name, setName] = useState(st.name || "");
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-10 text-center">
      <div className="text-[42px] font-black tracking-tight"><span className="text-[#2E6BD6]">D</span>ream <span className="text-[#F0B429]">A</span>cademy</div>
      <div className="mt-1 rounded-xl bg-[#FFE24A] px-4 py-1 text-[15px] font-black">드림 키즈 · 영어 모험</div>
      <Dreamy size={150} say="안녕! 나는 드림이야. 이름이 뭐야?" voice={st.voice} className="mt-8" />
      <input value={name} onChange={e => setName(e.target.value)} placeholder="이름을 써 줘"
        className="mt-8 w-full max-w-xs rounded-2xl border-2 border-[#E8E4D8] bg-white px-5 py-4 text-center text-2xl font-black outline-none focus:border-[#F0B429]" />
      <button onClick={() => onDone(name.trim() || "친구")} className="k-btn mt-4 w-full max-w-xs rounded-2xl bg-[#F0B429] py-5 text-2xl font-black text-[#1E2A3A] shadow-[0_8px_0_#C98F0A]">시작하기 🚀</button>
      <div className="mt-6 text-xs text-[#94A3B8]">프로토타입 · 목업 데이터 · 모든 화면 클릭 가능</div>
    </div>
  );
}

/* ───────── 홈: 데일리 미션 + 월드맵 ───────── */
function Home({ st, setSt, unlocked, onPlay, onParent }: { st: State; setSt: React.Dispatch<React.SetStateAction<State>>; unlocked: (id: string) => boolean; onPlay: (id: string) => void; onParent: () => void }) {
  const course = COURSES.find(c => c.id === st.course)!;
  const nextIdx = ALL_LESSONS.findIndex(l => !(st.stars[l.id] > 0));
  const missions = ALL_LESSONS.slice(Math.max(0, nextIdx), Math.max(0, nextIdx) + 2);
  const doneCount = Object.values(st.stars).filter(v => v > 0).length;
  const hour = new Date().getHours();
  const greet = hour < 11 ? MASCOT_LINES.morning[0] : hour >= 19 ? MASCOT_LINES.evening[0] : MASCOT_LINES.welcome[doneCount % MASCOT_LINES.welcome.length];
  const [say, setSay] = useState<string>(`${st.name}! ${greet}`);
  const [tab, setTab] = useState<"map" | "stickers">("map");

  return (
    <div className="pb-24 md:pb-8">
      {/* 상단바 */}
      <div className="flex items-center justify-between px-4 pt-4 md:px-8">
        <div className="text-[22px] font-black"><span className="text-[#2E6BD6]">D</span>ream <span className="text-[#F0B429]">A</span>cademy <span className="ml-1 rounded-lg bg-[#FFE24A] px-2 py-0.5 text-xs">KIDS</span></div>
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-white px-3 py-1.5 text-sm font-black shadow-sm">🔥 {st.streak}일 연속</div>
          <div className="rounded-full bg-white px-3 py-1.5 text-sm font-black shadow-sm">⭐ {Object.values(st.stars).reduce((a, b) => a + b, 0)}</div>
          <button onClick={onParent} title="학부모" className="k-btn rounded-full bg-white px-3 py-1.5 text-sm font-black shadow-sm">👨‍👩‍👧</button>
        </div>
      </div>

      <div className="md:grid md:grid-cols-[380px_1fr] md:gap-6 md:px-8">
        {/* 왼쪽(태블릿) / 상단(폰): 데일리 미션 */}
        <div className="px-4 md:px-0">
          <div className="k-card mt-4 p-4">
            <Dreamy size={84} say={say} voice={st.voice} />
            <div className="mt-3 flex items-center justify-between">
              <div className="text-lg font-black">🎯 오늘의 미션</div>
              <div className="text-xs font-bold text-[#94A3B8]">오늘 {st.minutesToday}분 / {st.limitMin}분</div>
            </div>
            <div className="mt-2 space-y-2">
              {missions.map((m, i) => {
                const c = COURSES.find(x => x.id === m.courseId)!;
                return (
                  <button key={m.id} onClick={() => onPlay(m.id)} className={`k-btn flex w-full items-center gap-3 rounded-2xl p-3 text-left ${i === 0 ? "k-pulse bg-[#FFE24A]" : "bg-[#F7F4EA]"}`}>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl" style={{ background: c.soft }}>{c.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-black">{m.title} <span className="text-sm font-bold text-[#4B5563]">{m.ko}</span></div>
                      <div className="text-xs font-bold text-[#4B5563]">{c.ko} · {m.words.length}단어 · 약 5분</div>
                    </div>
                    <div className="text-2xl">{i === 0 ? "▶️" : "🔒"}</div>
                  </button>
                );
              })}
              {!missions.length && <div className="rounded-2xl bg-[#E3F6EA] p-4 text-center font-black">🎉 모든 레슨을 다 깼어! 최고!</div>}
            </div>
            {/* 주간 스트릭 도트 */}
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#F7F4EA] px-3 py-2">
              {[6, 5, 4, 3, 2, 1, 0].map(n => {
                const d = dayOffset(-n); const did = (st.history[d] || 0) > 0;
                return <div key={n} className="flex flex-col items-center gap-1"><div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${did ? "bg-[#F0B429]" : "bg-white"}`}>{did ? "🔥" : ""}</div><div className="text-[10px] font-bold text-[#94A3B8]">{["일", "월", "화", "수", "목", "금", "토"][new Date(d + "T00:00:00").getDay()]}</div></div>;
              })}
            </div>
          </div>

          {/* 코스 선택 */}
          <div className="k-scroll mt-4 flex gap-2 overflow-x-auto md:grid md:grid-cols-2">
            {COURSES.map(c => {
              const total = c.units.reduce((a, u) => a + u.lessons.length, 0);
              const done = c.units.reduce((a, u) => a + u.lessons.filter(l => st.stars[l.id] > 0).length, 0);
              const active = c.id === st.course;
              return (
                <button key={c.id} onClick={() => { setSt(s => ({ ...s, course: c.id })); setTab("map"); setSay(`${c.ko}로 가자! ${c.icon}`); }}
                  className={`k-btn shrink-0 rounded-2xl border-2 px-3 py-2 text-left ${active ? "border-[#1E2A3A] bg-white" : "border-transparent bg-white/70"}`} style={{ minWidth: 150 }}>
                  <div className="text-2xl">{c.icon}</div>
                  <div className="text-sm font-black">{c.name} <span className="text-[#4B5563]">{c.ko}</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#F0EDE2]"><div className="h-full rounded-full" style={{ width: `${(done / total) * 100}%`, background: c.color }} /></div>
                  <div className="mt-0.5 text-[11px] font-bold text-[#94A3B8]">{done}/{total} 클리어</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 오른쪽(태블릿) / 하단(폰): 월드맵 */}
        <div className="px-4 md:px-0">
          <div className="mt-4 flex items-center gap-2">
            <button onClick={() => setTab("map")} className={`k-btn rounded-full px-4 py-2 text-sm font-black ${tab === "map" ? "bg-[#1E2A3A] text-white" : "bg-white"}`}>🗺️ 월드맵</button>
            <button onClick={() => setTab("stickers")} className={`k-btn rounded-full px-4 py-2 text-sm font-black ${tab === "stickers" ? "bg-[#1E2A3A] text-white" : "bg-white"}`}>🎁 스티커 {st.stickers.length}</button>
          </div>
          {tab === "map"
            ? <WorldMap course={course} st={st} unlocked={unlocked} onPlay={onPlay} onLocked={() => { setSay(MASCOT_LINES.locked[0]); }} />
            : <StickerBook stickers={st.stickers} />}
        </div>
      </div>
    </div>
  );
}

function WorldMap({ course, st, unlocked, onPlay, onLocked }: { course: Course; st: State; unlocked: (id: string) => boolean; onPlay: (id: string) => void; onLocked: () => void }) {
  const nodes = course.units.flatMap(u => u.lessons.map(l => ({ l, u })));
  const rowH = 96;
  const H = nodes.length * rowH + 40;
  const xs = [22, 50, 78, 50]; // 지그재그 %
  const pts = nodes.map((_, i) => ({ x: xs[i % xs.length], y: H - 40 - i * rowH }));
  const path = pts.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
  return (
    <div className="k-card relative mt-3 overflow-hidden" style={{ background: `linear-gradient(180deg, ${course.soft} 0%, #ffffff 100%)` }}>
      <div className="flex items-center justify-between px-4 pt-4"><div className="text-lg font-black">{course.icon} {course.name} · {course.ko}</div><div className="text-xs font-bold text-[#94A3B8]">아래에서 위로 올라가요 ⬆️</div></div>
      <div className="relative" style={{ height: H }}>
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 100 ${H}`} preserveAspectRatio="none">
          <path d={path} fill="none" stroke="#fff" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
          <path d={path} fill="none" stroke={course.color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 10" opacity=".55" />
        </svg>
        {nodes.map(({ l, u }, i) => {
          const p = pts[i]; const s = st.stars[l.id] || 0; const open = unlocked(l.id); const isNext = open && s === 0;
          const first = u.lessons[0].id === l.id;
          return (
            <React.Fragment key={l.id}>
              {first && <div className="absolute -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-[11px] font-black text-[#4B5563] shadow-sm" style={{ left: `${p.x}%`, top: p.y - 58 }}>📍 {u.title} · {u.ko}</div>}
              <button onClick={() => open ? onPlay(l.id) : onLocked()} className={`k-btn absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center ${isNext ? "k-pulse" : ""}`} style={{ left: `${p.x}%`, top: p.y }}>
                <div className="flex h-16 w-16 items-center justify-center rounded-full text-2xl shadow-[0_5px_0_rgba(0,0,0,.12)]"
                  style={{ background: !open ? "#D9D9D9" : s > 0 ? course.color : "#FFE24A", color: "#fff", filter: !open ? "grayscale(1)" : "none" }}>
                  {!open ? "🔒" : s > 0 ? "✓" : "▶"}
                </div>
                <div className="mt-1 rounded-lg bg-white/90 px-2 py-0.5 text-[12px] font-black leading-tight" style={{ color: open ? "#1E2A3A" : "#94A3B8" }}>{l.title}</div>
                <Stars n={s} size={13} />
              </button>
            </React.Fragment>
          );
        })}
        <div className="absolute left-1/2 -translate-x-1/2 text-3xl" style={{ top: 8 }}>🏁</div>
      </div>
    </div>
  );
}

function StickerBook({ stickers }: { stickers: string[] }) {
  return (
    <div className="k-card mt-3 p-4">
      <div className="text-lg font-black">🎁 내 스티커북</div>
      <div className="mt-1 text-xs font-bold text-[#94A3B8]">레슨을 처음 깰 때마다 하나씩!</div>
      <div className="mt-3 grid grid-cols-4 gap-3 md:grid-cols-6">
        {STICKERS.map(s => <div key={s} className={`flex aspect-square items-center justify-center rounded-2xl text-4xl ${stickers.includes(s) ? "k-pop bg-[#FFF4D6]" : "bg-[#F0EDE2] opacity-30 grayscale"}`}>{stickers.includes(s) ? s : "❔"}</div>)}
      </div>
    </div>
  );
}

/* ───────── 레슨 플레이어 ───────── */
type Step = "video" | "speak" | "quiz" | "result";
function Player({ lesson, course, voice, name, onExit, onFinish }: { lesson: Lesson; course: Course; voice: boolean; name: string; onExit: () => void; onFinish: (stars: number, pron: number | null, minutes: number) => void }) {
  const [step, setStep] = useState<Step>("video");
  const [pronScores, setPronScores] = useState<number[]>([]);
  const [quizCorrect, setQuizCorrect] = useState(0);
  const startedAt = useRef(Date.now());
  const stepIdx = ["video", "speak", "quiz", "result"].indexOf(step);
  const finished = useRef(false);

  const toResult = (correct: number) => {
    setQuizCorrect(correct);
    if (!finished.current) {
      finished.current = true;
      const stars = correct >= 3 ? 3 : correct === 2 ? 2 : 1;
      const pron = pronScores.length ? Math.round(pronScores.reduce((a, b) => a + b, 0) / pronScores.length) : null;
      onFinish(stars, pron, Math.max(1, Math.round((Date.now() - startedAt.current) / 60000)));
    }
    setStep("result");
  };

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-3 px-4 pt-4 md:px-8">
        <button onClick={onExit} className="k-btn rounded-full bg-white px-4 py-2 text-sm font-black shadow-sm">✕ 나가기</button>
        <div className="flex flex-1 items-center gap-1">
          {["🎬 보기", "🎤 말하기", "❓ 퀴즈", "🏆 결과"].map((t, i) => (
            <div key={t} className="flex-1"><div className={`h-2.5 rounded-full ${i <= stepIdx ? "" : "bg-white"}`} style={{ background: i <= stepIdx ? course.color : undefined }} /><div className={`mt-1 text-center text-[10px] font-black ${i === stepIdx ? "" : "text-[#94A3B8]"}`}>{t}</div></div>
          ))}
        </div>
      </div>
      <div className="mx-auto w-full max-w-[760px] flex-1 px-4 pb-8 md:px-8">
        {step === "video" && <VideoStep lesson={lesson} course={course} voice={voice} onNext={() => setStep("speak")} />}
        {step === "speak" && <SpeakStep lesson={lesson} course={course} voice={voice} onDone={(scores) => { setPronScores(scores); setStep("quiz"); }} />}
        {step === "quiz" && <QuizStep lesson={lesson} course={course} voice={voice} onDone={toResult} />}
        {step === "result" && <ResultStep name={name} course={course} correct={quizCorrect} pron={pronScores} voice={voice} onHome={onExit} onRetry={() => { finished.current = false; setPronScores([]); setQuizCorrect(0); startedAt.current = Date.now(); setStep("video"); }} />}
      </div>
    </div>
  );
}

function VideoStep({ lesson, course, voice, onNext }: { lesson: Lesson; course: Course; voice: boolean; onNext: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const dur = 12;
  useEffect(() => { if (!playing) return; const id = setInterval(() => setT(x => Math.min(dur, x + 1)), 1000); return () => clearInterval(id); }, [playing]);
  useEffect(() => { if (playing && t === 0 && voice) speak(lesson.video.caption, "en-US", 0.9); }, [playing, t, voice, lesson.video.caption]);
  const done = t >= dur;
  const scene = lesson.words[Math.min(lesson.words.length - 1, Math.floor(t / (dur / lesson.words.length)))];
  return (
    <div className="mt-4">
      <Dreamy size={72} say={MASCOT_LINES.video[0]} voice={voice} />
      <div className="k-card mt-4 overflow-hidden">
        <div className="relative flex aspect-video items-center justify-center" style={{ background: `linear-gradient(135deg, ${course.soft}, #fff)` }}>
          {/* 원어민 영상 자리 (프로토타입: 애니메이션 장면 + 자막) */}
          {playing ? (
            <div className="k-pop text-center"><div className="text-[96px] leading-none md:text-[128px]">{scene.emoji}</div><div className="mt-2 text-3xl font-black">{scene.en}</div><div className="text-base font-bold text-[#4B5563]">{scene.ko}</div></div>
          ) : (
            <button onClick={() => { setPlaying(true); setT(0); }} className="k-btn flex h-24 w-24 items-center justify-center rounded-full bg-white text-5xl shadow-lg">▶️</button>
          )}
          <div className="absolute bottom-3 left-3 rounded-lg bg-black/60 px-3 py-1 text-sm font-bold text-white">{lesson.video.caption}</div>
          <div className="absolute right-3 top-3 rounded-lg bg-white/80 px-2 py-1 text-xs font-black">{lesson.video.title}</div>
        </div>
        <div className="h-2 bg-[#F0EDE2]"><div className="h-full transition-all" style={{ width: `${(t / dur) * 100}%`, background: course.color }} /></div>
      </div>
      <button disabled={!done && !(playing && t >= 4)} onClick={onNext} className="k-btn mt-4 w-full rounded-2xl py-5 text-2xl font-black text-[#1E2A3A] disabled:opacity-40" style={{ background: "#F0B429", boxShadow: "0 8px 0 #C98F0A" }}>{done ? "다음 · 따라 말하기 🎤" : playing ? "보는 중… (건너뛰기 가능)" : "영상을 먼저 봐요"}</button>
    </div>
  );
}

function SpeakStep({ lesson, course, voice, onDone }: { lesson: Lesson; course: Course; voice: boolean; onDone: (scores: number[]) => void }) {
  const [i, setI] = useState(0);
  const [rec, setRec] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [msg, setMsg] = useState(MASCOT_LINES.speak[0]);
  const w = lesson.words[i];
  useEffect(() => { setScore(null); if (voice) setTimeout(() => speak(w.en, "en-US", 0.85), 500); }, [i, voice, w.en]);

  async function record() {
    if (rec) return;
    setRec(true); setScore(null);
    let level = 0;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext(); const src = ctx.createMediaStreamSource(stream); const an = ctx.createAnalyser(); an.fftSize = 512; src.connect(an);
      const buf = new Uint8Array(an.frequencyBinCount); let sum = 0, n = 0;
      await new Promise<void>(res => { const id = setInterval(() => { an.getByteTimeDomainData(buf); let s = 0; for (const v of buf) s += Math.abs(v - 128); sum += s / buf.length; n++; }, 100); setTimeout(() => { clearInterval(id); res(); }, 2200); });
      level = n ? sum / n : 0; stream.getTracks().forEach(t => t.stop()); ctx.close();
    } catch { await new Promise(r => setTimeout(r, 2200)); level = 6; }
    // 프로토타입 발음 점수: 목소리 크기 기반 + 랜덤 (실서비스는 음성인식 API 연동 자리)
    const sc = level < 1.5 ? 45 + Math.round(Math.random() * 10) : Math.min(99, 72 + Math.round(Math.min(level, 12) * 1.6) + Math.round(Math.random() * 8));
    setRec(false); setScore(sc);
    setMsg(sc < 60 ? "조금만 더 크게 말해볼까? 🎤" : sc >= 90 ? "우와, 원어민 같아! 🌟" : "좋아! 아주 잘 들렸어 👍");
    if (voice) speak(sc < 60 ? "조금만 더 크게 말해볼까?" : sc >= 90 ? "우와, 원어민 같아!" : "좋아, 아주 잘 들렸어!");
  }
  const next = () => { const ns = [...scores, score ?? 0]; setScores(ns); if (i + 1 < lesson.words.length) setI(i + 1); else onDone(ns); };
  return (
    <div className="mt-4">
      <Dreamy size={72} say={msg} voice={false} />
      <div className="k-card mt-4 p-5 text-center">
        <div className="text-xs font-black text-[#94A3B8]">단어 {i + 1} / {lesson.words.length}</div>
        <div className="k-pop mt-2 text-[110px] leading-none md:text-[140px]" key={w.en}>{w.emoji}</div>
        <div className="mt-2 text-4xl font-black" style={{ color: course.color }}>{w.en}</div>
        <div className="text-lg font-bold text-[#4B5563]">{w.ko}</div>
        <div className="mt-5 flex items-center justify-center gap-4">
          <button onClick={() => speak(w.en, "en-US", 0.85)} className="k-btn flex h-20 w-20 flex-col items-center justify-center rounded-full bg-[#BFDDF2] text-3xl shadow-[0_5px_0_#8fbfe0]">🔊<span className="text-[11px] font-black">듣기</span></button>
          <button onClick={record} className={`k-btn flex h-24 w-24 flex-col items-center justify-center rounded-full text-4xl shadow-[0_6px_0_#C98F0A] ${rec ? "k-mic bg-[#FF6B6B]" : "bg-[#F0B429]"}`}>🎤<span className="text-[11px] font-black">{rec ? "듣는 중" : "말하기"}</span></button>
        </div>
        {score !== null && (
          <div className="k-pop mx-auto mt-5 max-w-xs rounded-2xl bg-[#F7F4EA] p-3">
            <div className="text-xs font-black text-[#94A3B8]">발음 점수</div>
            <div className="text-4xl font-black" style={{ color: score >= 80 ? "#3CB371" : score >= 60 ? "#F0B429" : "#D64545" }}>{score}</div>
            <div className="mt-1 h-3 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: score >= 80 ? "#3CB371" : score >= 60 ? "#F0B429" : "#D64545" }} /></div>
          </div>
        )}
      </div>
      <div className="mt-4 flex gap-3">
        <button onClick={next} disabled={score === null} className="k-btn flex-1 rounded-2xl py-5 text-2xl font-black text-[#1E2A3A] disabled:opacity-40" style={{ background: "#F0B429", boxShadow: "0 8px 0 #C98F0A" }}>{i + 1 < lesson.words.length ? "다음 단어 →" : "퀴즈 풀기 ❓"}</button>
        {score === null && <button onClick={() => { setScore(0); }} className="k-btn rounded-2xl bg-white px-4 text-sm font-black text-[#94A3B8]">건너뛰기</button>}
      </div>
    </div>
  );
}

function shuffle<T>(a: T[]): T[] { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

function QuizStep({ lesson, course, voice, onDone }: { lesson: Lesson; course: Course; voice: boolean; onDone: (correct: number) => void }) {
  const [q, setQ] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [msg, setMsg] = useState(MASCOT_LINES.quiz[0]);
  const [happy, setHappy] = useState(false);
  const [flash, setFlash] = useState<"ok" | "no" | null>(null);
  const qs = useMemo(() => {
    const ws = lesson.words;
    const q1 = { type: "pick-word" as const, target: ws[0], options: shuffle(ws) };
    const q2 = { type: "pick-emoji" as const, target: ws[1], options: shuffle(ws) };
    const q3 = { type: "match" as const, pairs: shuffle(ws).slice(0, 3) };
    return [q1, q2, q3];
  }, [lesson]);
  const cur = qs[q];
  const [picked, setPicked] = useState<string | null>(null);
  const [matchSel, setMatchSel] = useState<string | null>(null);
  const [matched, setMatched] = useState<Record<string, string>>({});
  const [wrongKey, setWrongKey] = useState<string | null>(null);
  const matchEmojis = useMemo(() => (cur.type === "match" ? shuffle(cur.pairs) : []), [cur]);

  useEffect(() => { setPicked(null); setMatchSel(null); setMatched({}); if (cur.type === "pick-emoji" && voice) setTimeout(() => speak(cur.target.en, "en-US", 0.85), 400); }, [q, cur, voice]);

  const answer = (ok: boolean, then: () => void) => {
    setFlash(ok ? "ok" : "no"); setHappy(ok);
    setMsg(ok ? MASCOT_LINES.correct[q % 3] : MASCOT_LINES.wrong[q % 2]);
    if (voice) speak(ok ? "딩동댕! 정답!" : "아깝다, 다시 해볼까?");
    setTimeout(() => { setFlash(null); then(); }, ok ? 900 : 700);
  };
  const advance = (ok: boolean) => { const c = correct + (ok ? 1 : 0); setCorrect(c); if (q + 1 < qs.length) setQ(q + 1); else onDone(c); };

  const optionBtn = (label: React.ReactNode, key: string, ok: boolean) => (
    <button key={key} onClick={() => { if (picked) return; setPicked(key); answer(ok, () => advance(ok)); }}
      className={`k-btn k-card flex aspect-square flex-col items-center justify-center text-center ${picked === key ? (ok ? "ring-4 ring-[#3CB371]" : "k-shake ring-4 ring-[#D64545]") : ""}`}>{label}</button>
  );

  return (
    <div className="mt-4">
      <Dreamy size={72} happy={happy} say={msg} voice={false} />
      <div className="mt-3 text-xs font-black text-[#94A3B8]">문제 {q + 1} / {qs.length}</div>
      {cur.type === "pick-word" && (
        <div className="k-pop">
          <div className="k-card mt-2 flex flex-col items-center p-4"><div className="text-sm font-black text-[#4B5563]">이 그림은 영어로 뭘까?</div><div className="text-[96px] leading-none">{cur.target.emoji}</div></div>
          <div className="mt-3 grid grid-cols-2 gap-3">{cur.options.map(o => optionBtn(<span className="text-2xl font-black" style={{ color: course.color }}>{o.en}</span>, o.en, o.en === cur.target.en))}</div>
        </div>
      )}
      {cur.type === "pick-emoji" && (
        <div className="k-pop">
          <div className="k-card mt-2 flex items-center justify-center gap-3 p-4"><div className="text-sm font-black text-[#4B5563]">잘 듣고 맞는 그림을 골라요</div><button onClick={() => speak(cur.target.en, "en-US", 0.85)} className="k-btn flex h-16 w-16 items-center justify-center rounded-full bg-[#BFDDF2] text-3xl">🔊</button></div>
          <div className="mt-3 grid grid-cols-2 gap-3">{cur.options.map(o => optionBtn(<span className="text-[64px] leading-none">{o.emoji}</span>, o.en, o.en === cur.target.en))}</div>
        </div>
      )}
      {cur.type === "match" && (
        <div className="k-pop">
          <div className="k-card mt-2 p-3 text-center text-sm font-black text-[#4B5563]">단어를 누르고 → 맞는 그림을 눌러 짝을 맞춰요 (드래그 대신 탭)</div>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div className="space-y-3">{cur.pairs.map(p => { const done = matched[p.en]; return <button key={p.en} disabled={!!done} onClick={() => setMatchSel(p.en)} className={`k-btn k-card w-full py-4 text-xl font-black ${done ? "opacity-40" : matchSel === p.en ? "ring-4 ring-[#F0B429]" : ""} ${wrongKey === p.en ? "k-shake" : ""}`} style={{ color: course.color }}>{p.en}</button>; })}</div>
            <div className="space-y-3">{matchEmojis.map(p => { const done = Object.values(matched).includes(p.en); return <button key={p.en} disabled={!!done || !matchSel} onClick={() => {
              const ok = matchSel === p.en;
              if (ok) { const m = { ...matched, [p.en]: p.en }; setMatched(m); setMatchSel(null); setHappy(true); setMsg(MASCOT_LINES.correct[1]); if (voice) speak("맞았어!"); if (Object.keys(m).length === cur.pairs.length) setTimeout(() => advance(true), 700); }
              else { setWrongKey(matchSel); setTimeout(() => setWrongKey(null), 400); setHappy(false); setMsg(MASCOT_LINES.wrong[1]); setMatchSel(null); }
            }} className={`k-btn k-card w-full py-3 text-[44px] leading-none ${done ? "opacity-40" : !matchSel ? "opacity-70" : ""}`}>{p.emoji}</button>; })}</div>
          </div>
        </div>
      )}
      {flash && <div className={`pointer-events-none fixed inset-0 z-50 flex items-center justify-center text-[120px] ${flash === "ok" ? "" : ""}`}><div className="k-pop">{flash === "ok" ? "⭕" : "❌"}</div></div>}
    </div>
  );
}

function ResultStep({ name, course, correct, pron, voice, onHome, onRetry }: { name: string; course: Course; correct: number; pron: number[]; voice: boolean; onHome: () => void; onRetry: () => void }) {
  const stars = correct >= 3 ? 3 : correct === 2 ? 2 : 1;
  const line = stars === 3 ? MASCOT_LINES.result3[0] : stars === 2 ? MASCOT_LINES.result2[0] : MASCOT_LINES.result1[0];
  const avg = pron.length ? Math.round(pron.reduce((a, b) => a + b, 0) / pron.length) : null;
  const sticker = STICKERS[(correct * 7 + pron.length) % STICKERS.length];
  return (
    <div className="mt-4 text-center">
      {stars >= 2 && <Confetti />}
      <Dreamy size={120} happy say={`${name}! ${line}`} voice={voice} className="justify-center" />
      <div className="k-card mt-4 p-6">
        <div className="k-pop text-6xl"><Stars n={stars} size={56} /></div>
        <div className="mt-2 text-2xl font-black">{course.icon} 레슨 클리어!</div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#F7F4EA] p-3"><div className="text-xs font-black text-[#94A3B8]">퀴즈</div><div className="text-2xl font-black">{correct} / 3</div></div>
          <div className="rounded-2xl bg-[#F7F4EA] p-3"><div className="text-xs font-black text-[#94A3B8]">발음 평균</div><div className="text-2xl font-black">{avg ?? "–"}</div></div>
        </div>
        <div className="k-pop mt-4 rounded-2xl bg-[#FFF4D6] p-4"><div className="text-xs font-black text-[#C77B00]">🎁 새 스티커!</div><div className="text-6xl">{sticker}</div></div>
      </div>
      <div className="mt-4 flex gap-3">
        <button onClick={onRetry} className="k-btn flex-1 rounded-2xl bg-white py-4 text-lg font-black shadow-sm">🔁 한 번 더</button>
        <button onClick={onHome} className="k-btn flex-[2] rounded-2xl py-4 text-xl font-black text-[#1E2A3A]" style={{ background: "#F0B429", boxShadow: "0 8px 0 #C98F0A" }}>🗺️ 지도로 돌아가기</button>
      </div>
    </div>
  );
}

/* ───────── 사용시간 잠금 ───────── */
function LockedScreen({ st, onParent }: { st: State; onParent: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Dreamy size={140} say={MASCOT_LINES.limit[0]} voice={st.voice} />
      <div className="k-card mt-6 w-full max-w-sm p-6">
        <div className="text-5xl">🌙</div>
        <div className="mt-2 text-xl font-black">오늘 {st.minutesToday}분 공부했어요</div>
        <div className="text-sm font-bold text-[#4B5563]">하루 제한 {st.limitMin}분 · 내일 다시 열려요</div>
      </div>
      <button onClick={onParent} className="k-btn mt-6 rounded-full bg-white px-5 py-3 text-sm font-black text-[#4B5563] shadow-sm">👨‍👩‍👧 학부모 확인 (시간 조정)</button>
    </div>
  );
}

/* ───────── 학부모 모드 ───────── */
function ParentScreen({ st, setSt, onBack }: { st: State; setSt: React.Dispatch<React.SetStateAction<State>>; onBack: () => void }) {
  const [pin, setPin] = useState("");
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState(false);
  const press = (d: string) => { if (ok) return; const p = (pin + d).slice(0, 4); setPin(p); if (p.length === 4) { if (p === st.pin) setOk(true); else { setErr(true); setTimeout(() => { setErr(false); setPin(""); }, 500); } } };
  if (!ok) return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <button onClick={onBack} className="k-btn absolute left-4 top-4 rounded-full bg-white px-4 py-2 text-sm font-black shadow-sm">← 돌아가기</button>
      <div className="text-2xl font-black">👨‍👩‍👧 학부모 모드</div>
      <div className="mt-1 text-sm font-bold text-[#94A3B8]">비밀번호 4자리 (데모: 1234)</div>
      <div className={`mt-5 flex gap-3 ${err ? "k-shake" : ""}`}>{[0, 1, 2, 3].map(i => <div key={i} className={`h-5 w-5 rounded-full ${i < pin.length ? (err ? "bg-[#D64545]" : "bg-[#1E2A3A]") : "bg-[#E8E4D8]"}`} />)}</div>
      <div className="mt-6 grid w-64 grid-cols-3 gap-3">{["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((d, i) => <button key={i} onClick={() => d === "⌫" ? setPin(p => p.slice(0, -1)) : d && press(d)} className={`k-btn h-16 rounded-2xl text-2xl font-black ${d ? "bg-white shadow-sm" : ""}`}>{d}</button>)}</div>
    </div>
  );

  const days = [6, 5, 4, 3, 2, 1, 0].map(n => dayOffset(-n));
  const mins = days.map(d => st.history[d] || 0);
  const maxM = Math.max(10, ...mins);
  const doneCount = Object.values(st.stars).filter(v => v > 0).length;
  const weekDone = ALL_LESSONS.length ? Math.min(doneCount, 5) : 0;
  const pron = st.pron.slice(-10);
  const pronAvg = pron.length ? Math.round(pron.reduce((a, b) => a + b.score, 0) / pron.length) : 0;
  const W = 300, H = 90;
  const pts = pron.map((p, i) => `${(i / Math.max(1, pron.length - 1)) * W},${H - ((p.score - 40) / 60) * H}`).join(" ");
  const setLimit = (v: number) => setSt(s => ({ ...s, limitMin: v }));

  return (
    <div className="px-4 pb-10 md:px-8">
      <div className="flex items-center justify-between pt-4">
        <button onClick={onBack} className="k-btn rounded-full bg-white px-4 py-2 text-sm font-black shadow-sm">← 아이 화면으로</button>
        <div className="text-lg font-black">👨‍👩‍👧 학부모 리포트</div>
        <div className="w-24" />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="k-card p-4">
          <div className="text-sm font-black">📅 이번 주 학습 시간</div>
          <div className="mt-1 text-xs font-bold text-[#94A3B8]">총 {mins.reduce((a, b) => a + b, 0)}분 · 하루 평균 {Math.round(mins.reduce((a, b) => a + b, 0) / 7)}분</div>
          <div className="mt-3 flex h-36 items-end gap-2">
            {mins.map((m, i) => <div key={i} className="flex flex-1 flex-col items-center gap-1"><div className="text-[11px] font-black">{m || ""}</div><div className="w-full rounded-t-lg" style={{ height: `${(m / maxM) * 100}%`, minHeight: m ? 6 : 2, background: i === 6 ? "#F0B429" : "#BFDDF2" }} /><div className="text-[10px] font-bold text-[#94A3B8]">{["일", "월", "화", "수", "목", "금", "토"][new Date(days[i] + "T00:00:00").getDay()]}</div></div>)}
          </div>
        </div>
        <div className="k-card p-4">
          <div className="text-sm font-black">🎤 발음 점수 추이</div>
          <div className="mt-1 text-xs font-bold text-[#94A3B8]">최근 {pron.length}회 평균 {pronAvg}점</div>
          <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-36 w-full">
            {[60, 80].map(g => <line key={g} x1="0" x2={W} y1={H - ((g - 40) / 60) * H} y2={H - ((g - 40) / 60) * H} stroke="#E8E4D8" strokeDasharray="4 4" />)}
            <polyline points={pts} fill="none" stroke="#2E6BD6" strokeWidth="3" strokeLinejoin="round" />
            {pron.map((p, i) => <circle key={i} cx={(i / Math.max(1, pron.length - 1)) * W} cy={H - ((p.score - 40) / 60) * H} r="4" fill="#2E6BD6" />)}
          </svg>
        </div>
        <div className="k-card p-4">
          <div className="text-sm font-black">✅ 완료한 레슨</div>
          <div className="mt-2 flex items-end gap-2"><div className="text-4xl font-black">{doneCount}</div><div className="pb-1 text-sm font-bold text-[#94A3B8]">/ {ALL_LESSONS.length} 레슨 · 이번 주 {weekDone}개</div></div>
          <div className="mt-3 space-y-2">{COURSES.map(c => { const tot = c.units.reduce((a, u) => a + u.lessons.length, 0); const d = c.units.reduce((a, u) => a + u.lessons.filter(l => st.stars[l.id] > 0).length, 0); return <div key={c.id}><div className="flex justify-between text-xs font-black"><span>{c.icon} {c.name} {c.ko}</span><span>{d}/{tot}</span></div><div className="mt-1 h-2 rounded-full bg-[#F0EDE2]"><div className="h-full rounded-full" style={{ width: `${(d / tot) * 100}%`, background: c.color }} /></div></div>; })}</div>
        </div>
        <div className="k-card p-4">
          <div className="text-sm font-black">⏱ 하루 사용시간 제한</div>
          <div className="mt-1 text-xs font-bold text-[#94A3B8]">오늘 {st.minutesToday}분 사용 · 제한 도달 시 아이 화면이 잠겨요</div>
          <div className="mt-3 text-3xl font-black">{st.limitMin}분</div>
          <input type="range" min={5} max={60} step={5} value={st.limitMin} onChange={e => setLimit(+e.target.value)} className="mt-2 w-full accent-[#F0B429]" />
          <div className="mt-2 flex gap-2">{[10, 20, 30, 45].map(v => <button key={v} onClick={() => setLimit(v)} className={`k-btn rounded-full px-3 py-1 text-xs font-black ${st.limitMin === v ? "bg-[#1E2A3A] text-white" : "bg-[#F7F4EA]"}`}>{v}분</button>)}</div>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#F7F4EA] p-3"><div className="text-sm font-black">🔊 안내 음성</div><button onClick={() => setSt(s => ({ ...s, voice: !s.voice }))} className={`k-btn h-8 w-14 rounded-full p-1 ${st.voice ? "bg-[#3CB371]" : "bg-[#CBD5E1]"}`}><div className={`h-6 w-6 rounded-full bg-white transition-all ${st.voice ? "translate-x-6" : ""}`} /></button></div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => setSt(s => ({ ...s, minutesToday: 0 }))} className="k-btn flex-1 rounded-xl bg-[#E3F6EA] py-2 text-xs font-black">오늘 시간 초기화 (잠금 해제)</button>
            <button onClick={() => { if (confirm("학습 기록을 전부 지울까요?")) { const s = seed(); setSt({ ...s, name: st.name, stars: {}, stickers: [], streak: 0, history: {}, pron: [] }); } }} className="k-btn flex-1 rounded-xl bg-[#FDF0F0] py-2 text-xs font-black text-[#C0392B]">진행 초기화</button>
          </div>
        </div>
      </div>
      <div className="mt-4 text-center text-xs text-[#94A3B8]">프로토타입 — 데이터는 이 기기 브라우저에만 저장돼요. 실서비스에서는 엄마 앱 계정과 연결됩니다.</div>
    </div>
  );
}
