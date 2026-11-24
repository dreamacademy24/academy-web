// Route presentation is separate from the stable application destination.
export function defaultHmartRoute(date: string) {
  const dow = new Date(date + 'T00:00:00Z').getUTCDay();
  if (date < '2026-11-30' || ![1, 3, 5].includes(dow)) return null;
  return { displayName: '뉴타운', time: '09:30am', return: '드림센터',
    route: dow === 3
      ? '09:30 드림하우스 출발 → 09:50 H마트 도착 → 11:00 H마트 출발 → 11:10 NUU카페 도착 → 드림센터 복귀'
      : '09:30 드림하우스 출발 → 09:50 뉴타운 버스정류장 도착 → 10:00 H마트 도착 → 11:00 H마트 출발 → 드림센터 복귀' };
}
export function routeDescription(date: string) {
  const route = defaultHmartRoute(date);
  return route ? `출발 ${route.time} · 복귀 ${route.return}\n노선명: ${route.displayName}\n노선: ${route.route}` : '10:00am';
}
export function readRouteDescription(description: string) {
  const lines = description.split('\n');
  return { timing: lines[0] || '', displayName: lines.find(s => s.startsWith('노선명:'))?.slice(4).trim(),
    route: lines.find(s => s.startsWith('노선:'))?.slice(3).trim() };
}
