import type { VehMovement } from '@/lib/vehicleSchedule';

/** Preserve the original board's driver / AM / PM structure and each stop's passengers. */
export default function CommuteBoard({ movements }: { movements: VehMovement[] }) {
  if (!movements.length) return null;
  const absent = [...new Set(movements.flatMap(m => m.commuteDetails?.absent || []))];
  const drivers = new Map<number, { name: string; am: VehMovement[]; pm: VehMovement[] }>();
  for (const movement of movements) {
    const detail = movement.commuteDetails;
    if (!detail) continue;
    let driver = drivers.get(detail.driverIndex);
    if (!driver) {
      driver = { name: movement.driver_name || '기사 미입력', am: [], pm: [] };
      drivers.set(detail.driverIndex, driver);
    }
    driver[detail.period].push(movement);
  }
  return <section className="commute-board" aria-label="학생 통학차량 기사별 시간표">
    <div className="commute-title"><h3>학생 통학차량</h3><a href="/admin/view?src=%2Fashuttle" target="_blank" rel="noreferrer">원본 통학표 보기·수정 ↗</a></div>
    {absent.length > 0 && <p className="commute-absent"><b>결석·미탑승 메모</b> {absent.join(' · ')}</p>}
    {[...drivers.entries()].sort(([a], [b]) => a - b).map(([index, driver]) =>
      <section className="commute-driver" key={index} aria-label={`${driver.name} 통학표`}>
        {(['am', 'pm'] as const).map(period => <div className="commute-half" key={period}>
          <h4>{driver.name}</h4>
          <div className="commute-period">{period === 'am' ? '오전 · 픽업 / AM · Pick up' : '오후 · 드랍 / PM · Drop off'}</div>
          {driver[period].length ? driver[period].map(m => <div className="commute-group" key={m.id}>
            <div className="commute-group-heading"><strong>{m.time || '시간 미정'}</strong>{m.commuteDetails?.teacher && <span>{m.commuteDetails.teacher}</span>}</div>
            <ul>{m.commuteDetails?.cards.map((card, i) => <li key={i}><b>{card.addr}</b> <strong>({card.count || '0'})</strong> <span>{card.names}</span></li>)}</ul>
          </div>) : <p className="commute-none">표시할 일정 없음</p>}
        </div>)}
      </section>
    )}
  </section>;
}

