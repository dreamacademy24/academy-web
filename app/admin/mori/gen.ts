/* 모리칸 — 조합 생성 로직 */

export type Item = {
  id: string;
  name: string;
  role: string; // base|soup|main|side|salad|fruit|dairy|breakfast_main|staple
  protein: string | null;
  meals: string[];
  is_staple: boolean;
  active: boolean;
};
export type FixedSet = { set_no: number; lunch: string[]; snack: string | null };
export type Serving = { serve_date: string; meal: string; item_name: string };
export type DayPlan = { 아침: string[]; 점심: string[]; 간식: string[]; 저녁: string[]; fixedSet: number | null };
export type WeekPlan = Record<string, DayPlan>;

export const MEALS = ["아침", "점심", "간식", "저녁"] as const;
export const DUP_WINDOW = 21; // 최근 N일 내 제공 시 경고/회피

const pD = (s: string) => { const [a, b, c] = s.slice(0, 10).split("-").map(Number); return new Date(a, b - 1, c); };
const fD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const addD = (s: string, n: number) => { const d = pD(s); d.setDate(d.getDate() + n); return fD(d); };
export const diffDays = (a: string, b: string) => Math.round((pD(b).getTime() - pD(a).getTime()) / 86400000);
export const mondayOf = (s: string) => { const d = pD(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return fD(d); };
export const DOW = ["일", "월", "화", "수", "목", "금", "토"];
export const dowOf = (s: string) => DOW[pD(s).getDay()];

/* 이름 정규화 — 공백 차이는 같은 메뉴로 취급 */
export const nk = (s: string) => s.replace(/\s+/g, "");

/* 마지막 제공일 맵: 정규화이름 → 가장 최근 날짜 */
export function lastServedMap(servings: Serving[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const s of servings) {
    const k = nk(s.item_name);
    if (!m.has(k) || m.get(k)! < s.serve_date) m.set(k, s.serve_date);
  }
  return m;
}

/* 특정 날짜 기준으로 아이템이 최근 며칠 전에 나왔는지 (없으면 null) */
export function daysAgo(last: Map<string, string>, name: string, onDate: string): number | null {
  const d = last.get(nk(name));
  if (!d || d >= onDate) {
    // onDate 이후 기록은 무시하고 그 이전 것을 찾을 수 없으므로 null 처리하지 않고 그대로 사용
    if (!d) return null;
  }
  return diffDays(d!, onDate);
}

/* 주 전체(작성 중 플랜 포함) 기준 중복 조회용: 플랜 내 아이템 → 날짜 목록 */
export function planOccurrences(plan: WeekPlan): Map<string, { date: string; meal: string }[]> {
  const m = new Map<string, { date: string; meal: string }[]>();
  for (const [date, day] of Object.entries(plan)) {
    for (const meal of MEALS) {
      for (const it of day[meal] || []) {
        const k = nk(it);
        if (!m.has(k)) m.set(k, []);
        m.get(k)!.push({ date, meal });
      }
    }
  }
  return m;
}

/* ───────── 끼니 템플릿 ─────────
   아침: 주식(죽/빵류) 1 + 반찬 1 + 과일 1 + 유제품 0~1 + (물김치류는 죽일 때)
   저녁: 밥/국 1 + 메인 1 + 반찬 2 + 백김치                                  */

type Ctx = {
  items: Item[];
  last: Map<string, string>; // 과거 이력 기준 마지막 제공일
  used: Set<string>;         // 이번 주 플랜에서 이미 쓴 아이템 (정규화)
  usedProteinByDate: Map<string, Set<string>>; // 날짜별 사용 단백질
};

function pickOne(ctx: Ctx, date: string, pool: Item[], opts?: { avoidProtein?: Set<string> }): Item | null {
  const cands = pool.filter(i => {
    if (ctx.used.has(nk(i.name))) return false;
    if (opts?.avoidProtein && i.protein && opts.avoidProtein.has(i.protein)) return false;
    return true;
  });
  if (!cands.length) return null;
  // 오래 안 나온 것 우선 + 약간의 랜덤 (상위 후보 중 무작위)
  const scored = cands.map(i => {
    const d = ctx.last.get(nk(i.name));
    const ago = d ? diffDays(d, date) : 9999;
    return { i, ago };
  }).sort((a, b) => b.ago - a.ago);
  const fresh = scored.filter(s => s.ago > DUP_WINDOW);
  const top = (fresh.length ? fresh : scored).slice(0, Math.max(3, Math.floor((fresh.length ? fresh : scored).length * 0.3)));
  const pick = top[Math.floor(Math.random() * top.length)].i;
  return pick;
}

function take(ctx: Ctx, date: string, pick: Item | null, out: string[]) {
  if (!pick) return;
  out.push(pick.name);
  ctx.used.add(nk(pick.name));
  if (pick.protein) {
    if (!ctx.usedProteinByDate.has(date)) ctx.usedProteinByDate.set(date, new Set());
    ctx.usedProteinByDate.get(date)!.add(pick.protein);
  }
}

export function genBreakfast(ctx: Ctx, date: string): string[] {
  const out: string[] = [];
  const forMeal = (role: string) => ctx.items.filter(i => i.active && !i.is_staple && i.role === role && i.meals.includes("아침"));
  take(ctx, date, pickOne(ctx, date, forMeal("breakfast_main")), out);
  const sidePool = ctx.items.filter(i => i.active && !i.is_staple && (i.role === "side" || i.role === "salad") && i.meals.includes("아침"));
  take(ctx, date, pickOne(ctx, date, sidePool), out);
  take(ctx, date, pickOne(ctx, date, forMeal("fruit")), out);
  if (Math.random() < 0.5) take(ctx, date, pickOne(ctx, date, forMeal("dairy")), out);
  const main = out[0] || "";
  if (/죽|누룽지|숭늉|밥/.test(main)) out.push("물김치");
  return out;
}

export function genDinner(ctx: Ctx, date: string, lunchProteins: Set<string>): string[] {
  const out: string[] = [];
  const active = ctx.items.filter(i => i.active && !i.is_staple);
  const soups = active.filter(i => i.role === "soup" && i.meals.includes("저녁"));
  const mains = active.filter(i => i.role === "main" && i.meals.includes("저녁"));
  const sides = active.filter(i => (i.role === "side" || i.role === "salad") && i.meals.includes("저녁"));

  // 전날 저녁 단백질도 피함
  const avoid = new Set<string>(lunchProteins);
  const prev = ctx.usedProteinByDate.get(addD(date, -1));
  if (prev) prev.forEach(p => avoid.add(p));

  const soup = pickOne(ctx, date, soups);
  if (soup) { take(ctx, date, soup, out); out[out.length - 1] = /^밥|볶음밥|덮밥|비빔밥/.test(soup.name) ? soup.name : `밥/${soup.name}`; }
  else out.push("밥");
  let main = pickOne(ctx, date, mains, { avoidProtein: avoid });
  if (!main) main = pickOne(ctx, date, mains); // 다 걸리면 회피 해제
  take(ctx, date, main, out);
  take(ctx, date, pickOne(ctx, date, sides), out);
  take(ctx, date, pickOne(ctx, date, sides), out);
  out.push("백김치");
  return out;
}

/* 픽스 세트 자동 배치: 최근에 안 쓴 세트 5개.
   세트 사용 기록 + 세트 안 개별 메뉴의 마지막 제공일 중 더 최근 값을 기준으로,
   가장 오래 안 나온 세트부터 고른다 (표기 차이로 세트 매칭이 빠져도 아이템 이력이 잡아줌) */
export function pickFixedSets(sets: FixedSet[], setLastUsed: Map<number, string>, itemLast?: Map<string, string>): number[] {
  const effLast = (s: FixedSet) => {
    let d = setLastUsed.get(s.set_no) || "0000-00-00";
    if (itemLast) {
      for (const it of s.lunch) {
        const l = itemLast.get(nk(it));
        if (l && l > d) d = l;
      }
    }
    return d;
  };
  const sorted = [...sets].sort((a, b) => {
    const la = effLast(a), lb = effLast(b);
    if (la !== lb) return la < lb ? -1 : 1;
    return a.set_no - b.set_no;
  });
  return sorted.slice(0, 5).map(s => s.set_no);
}

export function genWeek(
  weekStart: string,
  items: Item[],
  servings: Serving[],
  sets: FixedSet[],
  setLastUsed: Map<number, string>,
): WeekPlan {
  const last = lastServedMap(servings.filter(s => s.serve_date < weekStart));
  const ctx: Ctx = { items, last, used: new Set(), usedProteinByDate: new Map() };
  const setNos = pickFixedSets(sets, setLastUsed, last);
  const plan: WeekPlan = {};
  for (let d = 0; d < 5; d++) {
    const date = addD(weekStart, d);
    const setNo = setNos[d] ?? null;
    const fs = sets.find(s => s.set_no === setNo);
    const lunch = fs ? [...fs.lunch, "김치"] : [];
    const lunchProteins = new Set<string>();
    for (const it of lunch) {
      ctx.used.add(nk(it));
      const found = items.find(i => nk(i.name) === nk(it));
      if (found?.protein) lunchProteins.add(found.protein);
    }
    if (fs?.snack) ctx.used.add(nk(fs.snack));
    plan[date] = {
      아침: genBreakfast(ctx, date),
      점심: lunch,
      간식: fs?.snack ? [fs.snack] : [],
      저녁: genDinner(ctx, date, lunchProteins),
      fixedSet: setNo,
    };
  }
  return plan;
}
