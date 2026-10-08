export type ResortStayView = "active" | "completed" | "all";
export function resortToday() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
export function matchesStayView(end: string | null | undefined, view: ResortStayView, today: string) {
  const date = (end || "").slice(0, 10);
  const completed = /^\d{4}-\d{2}-\d{2}$/.test(date) && date < today;
  return view === "all" || (view === "completed" ? completed : !completed);
}
export function compareCheckin(a: string | null | undefined, b: string | null | undefined) {
  return ((a || "").slice(0, 10) || "9999-12-31").localeCompare((b || "").slice(0, 10) || "9999-12-31");
}
