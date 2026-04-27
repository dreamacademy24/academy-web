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
  assignee?: string | null;
  status?: string | null;
};

const STATUS_OPTIONS = [
  { value: 'new',         label: '신규',     bg: '#F1F5F9', fg: '#64748B', dot: '⚪' },
  { value: 'contacted',   label: '연락옴',   bg: '#FEF3C7', fg: '#92400E', dot: '🟡' },
  { value: 'in_progress', label: '상담중',   bg: '#DBEAFE', fg: '#1E40AF', dot: '🔵' },
  { value: 'paused',      label: '상담멈춤', bg: '#FFE4E6', fg: '#BE123C', dot: '🟠' },
  { value: 'recheck',     label: '재확인',   bg: '#EDE9FE', fg: '#6D28D9', dot: '🟣' },
  { value: 'confirmed',   label: '예약확정', bg: '#D1FAE5', fg: '#047857', dot: '🟢' },
] as const;

const STATUS_BY_VALUE: Record<string, (typeof STATUS_OPTIONS)[number]> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o])
);

export default function MineduListClient({
  applications,
  total,
  today,
  jamieCount,
  mayCount,
  unassignedCount,
  newCount,
  contactedCount,
  inProgressCount,
  confirmedCount,
}: {
  applications: Application[];
  total: number;
  today: number;
  jamieCount: number;
  mayCount: number;
  unassignedCount: number;
  newCount: number;
  contactedCount: number;
  inProgressCount: number;
  confirmedCount: number;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Application | null>(null);

  // 중복 연락처 감지 (전체 applications 기준)
  const phoneCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of applications) {
      const p = a.phone?.replace(/[-\s]/g, '');
      if (p) map[p] = (map[p] || 0) + 1;
    }
    return map;
  }, [applications]);
  const isDuplicatePhone = (phone: string | null | undefined) => {
    const p = phone?.replace(/[-\s]/g, '');
    return !!(p && phoneCounts[p] > 1);
  };

  // 신청 삭제 (인라인 X / 모달 공용)
  const handleDelete = async (app: Application, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const confirmed = window.confirm(
      `정말로 삭제하시겠습니까?\n\n` +
      `• 이름: ${app.name}\n` +
      `• 연락처: ${app.phone || '-'}\n` +
      `• 출국일: ${app.depart_date || '-'}\n\n` +
      `⚠️ 이 작업은 되돌릴 수 없습니다.`
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/minedu-apply/${app.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '삭제 실패');
      }
      setSelected(null);
      router.refresh();
    } catch (err) {
      alert('삭제에 실패했습니다: ' + (err instanceof Error ? err.message : '알 수 없는 오류'));
    }
  };

  // 검색 (이름/연락처/숙소/기간/연령/담당자 포함)
  const filtered = useMemo(() => {
    if (!search.trim()) return applications;
    const qRaw = search.trim();
    const q = qRaw.toLowerCase();

    // 한글 별칭 → 담당자 키 매칭
    const assigneeAlias: { match: (a: Application) => boolean } | null = (() => {
      if (qRaw === '제이미' || q === 'jamie') {
        return { match: (a) => a.assignee === 'jamie' };
      }
      if (qRaw === '메이' || q === 'may') {
        return { match: (a) => a.assignee === 'may' };
      }
      if (qRaw === '미배정') {
        return { match: (a) => !a.assignee };
      }
      return null;
    })();

    // 한글 별칭 → 상태 키 매칭
    const statusAlias: { match: (a: Application) => boolean } | null = (() => {
      const labelMap: Record<string, string> = {
        '신규': 'new',
        '연락옴': 'contacted',
        '상담중': 'in_progress',
        '상담멈춤': 'paused',
        '재확인': 'recheck',
        '예약확정': 'confirmed',
        '확정': 'confirmed',
      };
      const target = labelMap[qRaw];
      if (target === 'new') return { match: (a) => !a.status || a.status === 'new' };
      if (target) return { match: (a) => a.status === target };
      return null;
    })();

    return applications.filter((a) => {
      if (assigneeAlias && assigneeAlias.match(a)) return true;
      if (statusAlias && statusAlias.match(a)) return true;
      const haystack = [
        a.name, a.phone, a.lodging, a.duration_weeks,
        a.depart_date, a.period, a.ages, a.children, a.assignee, a.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [applications, search]);

  // 담당자 변경 (인라인 select / 모달 공용)
  const updateAssignee = async (
    appId: number,
    next: string,
    prev: string | null | undefined,
    selectEl?: HTMLSelectElement
  ) => {
    try {
      const res = await fetch(`/api/minedu-apply/${appId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee: next || null }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      console.error('[updateAssignee] failed:', err);
      alert('담당자 변경에 실패했습니다. 다시 시도해주세요.');
      if (selectEl) selectEl.value = prev || '';
    }
  };

  const assigneeLabel = (v: string | null | undefined) =>
    v === 'jamie' ? 'Jamie' : v === 'may' ? 'May' : '미배정';

  const statusLabel = (v: string | null | undefined) =>
    (v && STATUS_BY_VALUE[v]?.label) || STATUS_BY_VALUE.new.label;

  // 상태 변경 (인라인 select / 모달 공용)
  const updateStatus = async (
    appId: number,
    next: string,
    prev: string | null | undefined,
    selectEl?: HTMLSelectElement
  ) => {
    try {
      const res = await fetch(`/api/minedu-apply/${appId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next || 'new' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch (err) {
      console.error('[updateStatus] failed:', err);
      alert('상태 변경에 실패했습니다. 다시 시도해주세요.');
      if (selectEl) selectEl.value = prev || 'new';
    }
  };

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
      '신청시각', '담당자', '이름', '연락처', '자녀인원', '자녀연령',
      '출국일', '체류기간', '희망일정(구)', '희망숙소', '현재 상황',
    ];
    const rows = filtered.map((a) => [
      formatDateTimeFull(a.created_at),
      assigneeLabel(a.assignee),
      a.name || '',
      a.phone || '',
      a.children || '',
      a.ages || '',
      a.depart_date || '',
      a.duration_weeks || '',
      a.period || '',
      a.lodging || '',
      statusLabel(a.status),
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
        <Stat label="🔵 Jamie 담당" value={jamieCount} color="#1a6fc4" />
        <Stat label="🌸 May 담당" value={mayCount} color="#E8563F" />
        <Stat label="⚪ 미배정" value={unassignedCount} color="#94a3b8" />
        <Stat label="⚪ 신규" value={newCount} color="#64748B" />
        <Stat label="🟡 연락옴" value={contactedCount} color="#92400E" />
        <Stat label="🔵 상담중" value={inProgressCount} color="#1E40AF" />
        <Stat label="🟢 예약확정" value={confirmedCount} color="#047857" />
      </div>

      <div className="mn-search-wrap">
        <input
          type="text"
          placeholder="🔍 이름 / 연락처 / 숙소 / 출국일 / 체류기간 / 담당자 / 상태(연락옴·상담중·예약확정 등)로 검색..."
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
                  <th>담당자</th>
                  <th>이름</th>
                  <th>연락처</th>
                  <th>자녀</th>
                  <th>연령</th>
                  <th>출국일</th>
                  <th>체류기간</th>
                  <th>희망 숙소</th>
                  <th>현재 상황</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((app) => {
                  const dup = isDuplicatePhone(app.phone);
                  return (
                  <tr
                    key={app.id}
                    onClick={() => setSelected(app)}
                    className="mn-tr"
                    style={dup ? { background: '#FFFBEB' } : undefined}
                  >
                    <td>{formatDateTime(app.created_at)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <AssigneeSelect
                        value={app.assignee || ''}
                        onChange={(next, el) =>
                          updateAssignee(app.id, next, app.assignee, el)
                        }
                      />
                    </td>
                    <td className="mn-td-name">{app.name}</td>
                    <td>
                      {app.phone || '-'}
                      {dup && (
                        <span
                          style={{ marginLeft: 4, fontSize: 11, color: '#92400E' }}
                          title="중복 연락처"
                        >
                          ⚠️
                        </span>
                      )}
                    </td>
                    <td>{app.children || '-'}</td>
                    <td>{app.ages || '-'}</td>
                    <td className="mn-td-depart">
                      {app.depart_date || (app.period ? <span style={{color:'#999'}}>(구)</span> : '-')}
                    </td>
                    <td>{app.duration_weeks || (app.period ? <span style={{color:'#999', fontSize:12}}>{app.period}</span> : '-')}</td>
                    <td>{app.lodging || '-'}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <StatusSelect
                        value={app.status || 'new'}
                        onChange={(next, el) =>
                          updateStatus(app.id, next, app.status, el)
                        }
                      />
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleDelete(app, e)}
                        title="이 신청 삭제"
                        style={{
                          padding: '4px 8px',
                          border: '1px solid transparent',
                          background: 'transparent',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          borderRadius: 6,
                          fontSize: 14,
                          fontWeight: 700,
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#fee2e2';
                          e.currentTarget.style.color = '#dc2626';
                          e.currentTarget.style.borderColor = '#fecaca';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = '#94a3b8';
                          e.currentTarget.style.borderColor = 'transparent';
                        }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                  );
                })}
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
              <div style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>📌 담당자</div>
                <AssigneeSelect
                  value={selected.assignee || ''}
                  onChange={(next, el) => {
                    updateAssignee(selected.id, next, selected.assignee, el);
                    setSelected({ ...selected, assignee: next || null });
                  }}
                />
              </div>
              <div style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>📊 현재 상황</div>
                <StatusSelect
                  value={selected.status || 'new'}
                  onChange={(next, el) => {
                    updateStatus(selected.id, next, selected.status, el);
                    setSelected({ ...selected, status: next || 'new' });
                  }}
                />
              </div>
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
            <div className="mn-modal-actions" style={{ justifyContent: 'space-between' }}>
              <button
                onClick={() => handleDelete(selected)}
                style={{
                  padding: '8px 16px',
                  background: '#fff',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: 'pointer',
                }}
              >
                🗑️ 이 신청 삭제
              </button>
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

function AssigneeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string, el: HTMLSelectElement) => void;
}) {
  const style: React.CSSProperties =
    value === 'jamie'
      ? { background: '#DBEAFE', color: '#1a6fc4', fontWeight: 700 }
      : value === 'may'
      ? { background: '#FFE4E0', color: '#E8563F', fontWeight: 700 }
      : { background: '#F1F5F9', color: '#64748B', fontWeight: 500 };
  return (
    <select
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value, e.currentTarget)}
      style={{
        ...style,
        border: '1px solid #e2e8f0',
        borderRadius: 999,
        padding: '4px 10px',
        fontSize: 13,
        cursor: 'pointer',
        outline: 'none',
        appearance: 'none',
        WebkitAppearance: 'none',
        MozAppearance: 'none',
      }}
    >
      <option value="">미배정</option>
      <option value="jamie">Jamie</option>
      <option value="may">May</option>
    </select>
  );
}

function StatusSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string, el: HTMLSelectElement) => void;
}) {
  const opt = STATUS_BY_VALUE[value] || STATUS_BY_VALUE.new;
  return (
    <select
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value, e.currentTarget)}
      style={{
        background: opt.bg,
        color: opt.fg,
        fontWeight: 700,
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        padding: '6px 12px',
        fontSize: 13,
        cursor: 'pointer',
        outline: 'none',
        appearance: 'none',
        WebkitAppearance: 'none',
        MozAppearance: 'none',
      }}
    >
      {STATUS_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.dot} {o.label}
        </option>
      ))}
    </select>
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
