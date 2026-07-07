/* 모리칸 — 조합 생성 로직 v2 (저녁 어른/아동 분리 + 동적 회피 창) */

export type Item = {
  id: string;
  name: string;
  role: string; // base|soup|main|side|salad|fruit|dairy|breakfast_main|staple
  protein: string | null;
  meals: string[];
  is_staple: boolean;
  active: boolean;
  spicy?: boolean | null;
  mild_pair?: string | null; // 매운 메뉴의 순한 짝꿍 (아동용)
};
export type FixedSet = { set_no: number; lunch: string[]; snack: string | null };
export type Serving = { serve_date: string; meal: string; item_name: string };
export type DayPlan = { 아침: string[]; 점심: string[]; 저녁어른: string[]; 저녁아동: string[]; fixedSet: number | null; [k: string]: any };
export type WeekPlan = Record<string, DayPlan>;

export const MEALS = ["아침", "점심", "저녁어른", "저녁아동"] as const;
export const DUP_WINDOW = 21; // 손님 데이터 없을 때 기본 회피 일수

const pD = (s: string) => { const [a, b, c] = s.slice(0, 10).split("-").map(Number); return new Date(a, b - 1, c); };
const fD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const addD = (s: string, n: number) => { const d = pD(s); d.setDate(d.getDate() + n); return fD(d); };
export const diffDays = (a: string, b: string) => Math.round((pD(b).getTime() - pD(a).getTime()) / 86400000);
export const mondayOf = (s: string) => { const d = pD(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return fD(d); };
export const DOW = ["일", "월", "화", "수", "목", "금", "토"];
export const dowOf = (s: string) => DOW[pD(s).getDay()];

/* 이름 정규화 — 공백 차이는 같은 메뉴로 취급 */
export const nk = (s: string) => s.replace(/\s+/g, "");

export const emptyDay = (): DayPlan => ({ 아침: [], 점심: [], 저녁어른: [], 저녁아동: [], fixedSet: null });

/* 구버전 플랜(저녁 단일 열) 호환 */
export function migrateDay(day: any): DayPlan | null {
  if (!day) return null;
  if (day.저녁어른 || day.저녁아동) return { ...emptyDay(), ...day };
  const dinner = day.저녁 || [];
  return { 아침: day.아침 || [], 점심: day.점심 || [], 저녁어른: [...dinner], 저녁아동: [...dinner], fixedSet: day.fixedSet ?? null };
}

/* 마지막 제공일 맵: 정규화이름 → 가장 최근 날짜 */
export function lastServedMap(servings: Serving[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const s of servings) {
    const k = nk(s.item_name);
    if (!m.has(k) || m.get(k)! < s.serve_date) m.set(k, s.serve_date);
  }
  return m;
}

/* 주 전체 기준 아이템 → 등장 목록 (같은 날 어른/아동 양쪽 등장은 1번으로 침) */
export function planOccurrences(plan: WeekPlan): Map<string, { date: string; meal: string }[]> {
  const m = new Map<string, { date: string; meal: string }[]>();
  for (const [date, day] of Object.entries(plan)) {
    const seenToday = new Set<string>();
    for (const meal of MEALS) {
      for (const it of (day as any)[meal] || []) {
        const k = nk(it);
        if (seenToday.has(k)) continue;
        seenToday.add(k);
        if (!m.has(k)) m.set(k, []);
        m.get(k)!.push({ date, meal });
      }
    }
  }
  return m;
}

/* 매운 메뉴의 아동용 짝꿍 */
export function mildOf(items: Item[], name: string): string {
  const it = items.find(i => nk(i.name) === nk(name));
  if (it?.mild_pair) return it.mild_pair;
  if (nk(name) === "김치") return "백김치";
  return name;
}

type Ctx = {
  items: Item[];
  last: Map<string, string>;
  used: Set<string>;
  usedProteinByDate: Map<string, Set<string>>;
  dupWindow: number;
};

function pickOne(ctx: Ctx, date: string, pool: Item[], opts?: { avoidProtein?: Set<string> }): Item | null {
  const cands = pool.filter(i => {
    if (ctx.used.has(nk(i.name))) return false;
    if (opts?.avoidProtein && i.protein && opts.avoidProtein.has(i.protein)) return false;
    return true;
  });
  if (!cands.length) return null;
  const scored = cands.map(i => {
    const d = ctx.last.get(nk(i.name));
    const ago = d ? diffDays(d, date) : 9999;
    return { i, ago };
  }).sort((a, b) => b.ago - a.ago);
  const fresh = scored.filter(s => s.ago > ctx.dupWindow);
  const base = fresh.length ? fresh : scored;
  const top = base.slice(0, Math.max(3, Math.floor(base.length * 0.3)));
  return top[Math.floor(Math.random() * top.length)].i;
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

/* 저녁: 어른(원본) + 아동(순한 짝꿍 치환) */
export function genDinner(ctx: Ctx, date: string, lunchProteins: Set<string>): { adult: string[]; child: string[] } {
  const adult: string[] = [];
  const dinnerMeal = (i: Item) => i.meals.includes("저녁") || i.meals.includes("저녁어른") || i.meals.includes("저녁아동");
  const active = ctx.items.filter(i => i.active && !i.is_staple);
  const soups = active.filter(i => i.role === "soup" && dinnerMeal(i));
  const mains = active.filter(i => i.role === "main" && dinnerMeal(i));
  const sides = active.filter(i => (i.role === "side" || i.role === "salad") && dinnerMeal(i));

  const avoid = new Set<string>(lunchProteins);
  const prev = ctx.usedProteinByDate.get(addD(date, -1));
  if (prev) prev.forEach(p => avoid.add(p));

  const soup = pickOne(ctx, date, soups);
  if (soup) { take(ctx, date, soup, adult); adult[adult.length - 1] = /^밥|볶음밥|덮밥|비빔밥/.test(soup.name) ? soup.name : `밥/${soup.name}`; }
  else adult.push("밥");
  let main = pickOne(ctx, date, mains, { avoidProtein: avoid });
  if (!main) main = pickOne(ctx, date, mains);
  take(ctx, date, main, adult);
  take(ctx, date, pickOne(ctx, date, sides), adult);
  take(ctx, date, pickOne(ctx, date, sides), adult);
  adult.push("김치");

  const child = adult.map(n => {
    const raw = n.startsWith("밥/") ? n.slice(2) : n;
    const mild = mildOf(ctx.items, raw);
    ctx.used.add(nk(mild));
    return n.startsWith("밥/") && mild === raw ? n : n.startsWith("밥/") ? `밥/${mild}` : mild;
  });
  const ki = child.findIndex(c => nk(c) === "김치");
  if (ki >= 0) child[ki] = "백김치";
  return { adult, child };
}

/* 픽스 세트 자동 배치 (세트 사용기록 + 아이템 이력 중 최근값 기준 LRU) */
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
  dupWindow: number = DUP_WINDOW,
): WeekPlan {
  const last = lastServedMap(servings.filter(s => s.serve_date < weekStart));
  const ctx: Ctx = { items, last, used: new Set(), usedProteinByDate: new Map(), dupWindow };
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
    const breakfast = genBreakfast(ctx, date);
    const dinner = genDinner(ctx, date, lunchProteins);
    plan[date] = { 아침: breakfast, 점심: lunch, 저녁어른: dinner.adult, 저녁아동: dinner.child, fixedSet: setNo };
  }
  return plan;
}
