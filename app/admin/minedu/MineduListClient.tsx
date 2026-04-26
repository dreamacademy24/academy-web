'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Application = {
  id: number;
  created_at: string;
  name: string;
  phone: string | null;
  children: string | null;
  ages: string | null;
  depart_date: string | null;
  duration_weeks: string | null;
  period: string | null;
  lodging: string | null;
};

export default function MineduListClient({
  applications,
  total,
  today,
}: {
  applications: Application[];
  total: number;
  today: number;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Application | null>(null);

  // 검색 (이름/연락처/숙소/기간/연령 모두 포함)
  const filtered = useMemo(() => {
    if (!search.trim()) return applications;
    const q = search.toLowerCase();
    return applications.filter((a) => {
      const haystack = [
        a.name, a.phone, a.lodging, a.duration_weeks,
        a.depart_date, a.period, a.ages, a.children,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [applications, search]);

  // 일정 표시 헬퍼 (신/구 데이터 모두 호환)
  const formatSchedule = (a: Application) => {
    if (a.depart_date && a.duration_weeks) {
      return `${a.depart_date} · ${a.duration_weeks}`;
    }
    if (a.depart_date) return a.depart_date;
    if (a.duration_weeks) return a.duration_weeks;
    return a.period || '-';
  };

  // CSV 다운로드
  const downloadExcel = () => {
    const headers = [
      '신청시각', '이름', '연락처', '자녀인원', '자녀연령',
      '출국일', '체류기간', '희망일정(구)', '희망숙소',
    ];
    const rows = filtered.map((a) => [
      formatDateTimeFull(a.created_at),
      a.name || '',
      a.phone || '',
      a.children || '',
      a.ages || '',
      a.depart_date || '',
      a.duration_weeks || '',
      a.period || '',
      a.lodging || '',
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      )
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `민에듀_공구신청_${formatDate(new Date().toISOString())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mn-container">
      <div className="mn-header">
        <div>
          <h1 className="mn-title">📋 민에듀 공구 신청 관리</h1>
          <p className="mn-subtitle">민에듀 × 세부드림아카데미 공동구매 신청 내역</p>
        </div>
        <div className="mn-actions">
          <button onClick={() => router.refresh()} className="mn-btn-secondary">
            🔄 새로고침
          </button>
          <button onClick={downloadExcel} className="mn-btn-primary">
            📥 엑셀 다운로드
          </button>
        </div>
      </div>

      <div className="mn-stats">
        <Stat label="전체 신청" value={total} color="#1a6fc4" />
        <Stat label="오늘 신청" value={today} color="#E8563F" />
        <Stat label="검색 결과" value={filtered.length} color="#1F7A4D" />
      </div>

      <div className="mn-search-wrap">
        <input
          type="text"
          placeholder="🔍 이름 / 연락처 / 숙소 / 출국일 / 체류기간으로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mn-search"
        />
      </div>

      <div className="mn-table-wrap">
        {filtered.length === 0 ? (
          <div className="mn-empty">
            {applications.length === 0 ? '아직 신청 내역이 없습니다.' : '검색 결과가 없습니다.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="mn-table">
              <thead>
                <tr>
                  <th>신청 시각</th>
                  <th>이름</th>
                  <th>연락처</th>
                  <th>자녀</th>
                  <th>연령</th>
                  <th>출국일</th>
                  <th>체류기간</th>
                  <th>희망 숙소</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((app) => (
                  <tr
                    key={app.id}
                    onClick={() => setSelected(app)}
                    className="mn-tr"
                  >
                    <td>{formatDateTime(app.created_at)}</td>
                    <td className="mn-td-name">{app.name}</td>
                    <td>{app.phone || '-'}</td>
                    <td>{app.children || '-'}</td>
                    <td>{app.ages || '-'}</td>
                    <td className="mn-td-depart">
                      {app.depart_date || (app.period ? <span style={{color:'#999'}}>(구)</span> : '-')}
                    </td>
                    <td>{app.duration_weeks || (app.period ? <span style={{color:'#999', fontSize:12}}>{app.period}</span> : '-')}</td>
                    <td>{app.lodging || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="mn-modal-overlay" onClick={() => setSelected(null)}>
          <div className="mn-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="mn-modal-title">신청 상세 #{selected.id}</h2>
            <div>
              <Detail label="신청 시각" value={formatDateTimeFull(selected.created_at)} />
              <Detail label="이름" value={selected.name} bold />
              <Detail label="연락처" value={selected.phone || '-'} copyable />
              <Detail label="자녀 인원" value={selected.children || '-'} />
              <Detail label="자녀 연령" value={selected.ages || '-'} />
              <Detail label="출국 희망일" value={selected.depart_date || '-'} bold />
              <Detail label="체류 기간" value={selected.duration_weeks || '-'} bold />
              {selected.period && (
                <Detail label="희망 일정(구버전)" value={selected.period} />
              )}
              <Detail label="희망 숙소" value={selected.lodging || '-'} />
            </div>
            <div className="mn-modal-actions">
              <button onClick={() => setSelected(null)} className="mn-btn-primary">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .mn-container { padding: 32px; max-width: 1280px; margin: 0 auto; background: #f1f5f9; min-height: 100vh; }
        .mn-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; flex-wrap: wrap; gap: 16px; }
        .mn-title { font-size: 24px; font-weight: 800; margin: 0; color: #1e293b; }
        .mn-subtitle { font-size: 14px; color: #64748b; margin: 4px 0 0; }
        .mn-actions { display: flex; gap: 10px; }
        .mn-btn-primary { background: #1a6fc4; color: #fff; border: 0; padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .mn-btn-secondary { background: #fff; color: #475569; border: 1px solid #cbd5e1; padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .mn-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 24px; }
        .mn-search-wrap { margin-bottom: 16px; }
        .mn-search { width: 100%; padding: 12px 16px; font-size: 14px; border: 1px solid #cbd5e1; border-radius: 10px; outline: none; box-sizing: border-box; background: #fff; }
        .mn-table-wrap { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .mn-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .mn-table th { padding: 14px 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; text-align: left; font-weight: 700; color: #475569; font-size: 13px; white-space: nowrap; }
        .mn-tr { cursor: pointer; border-bottom: 1px solid #f1f5f9; }
        .mn-tr:hover { background: #f8fafc; }
        .mn-table td { padding: 14px 12px; color: #334155; vertical-align: middle; }
        .mn-td-name { font-weight: 700; color: #1e293b; }
        .mn-td-depart { font-weight: 600; color: #1a6fc4; }
        .mn-empty { padding: 60px; text-align: center; color: #94a3b8; }
        .mn-modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.6); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .mn-modal { background: #fff; border-radius: 16px; padding: 32px; max-width: 480px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
        .mn-modal-title { font-size: 20px; font-weight: 800; margin: 0 0 20px; color: #1e293b; }
        .mn-modal-actions { display: flex; justify-content: flex-end; margin-top: 20px; }
        @media (max-width: 700px) {
          .mn-container { padding: 16px; }
          .mn-stats { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: 12,
      padding: '20px 24px',
      borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function Detail({ label, value, bold, copyable }: { label: string; value: string; bold?: boolean; copyable?: boolean }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    if (!copyable || value === '-') return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{label}</div>
      <div
        onClick={onCopy}
        style={{
          fontSize: 15,
          color: '#1e293b',
          fontWeight: bold ? 700 : 400,
          cursor: copyable && value !== '-' ? 'pointer' : 'default',
        }}
        title={copyable && value !== '-' ? '클릭하여 복사' : ''}
      >
        {value}
        {copied && <span style={{ marginLeft: 8, color: '#1F7A4D', fontSize: 12 }}>✓ 복사됨</span>}
      </div>
    </div>
  );
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function formatDateTimeFull(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
