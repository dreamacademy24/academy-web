"use client";
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { publishedShuttleSlots, type PublishedShuttle } from './publishedShuttle';

export function usePublishedShuttle() {
  const [rows, setRows] = useState<PublishedShuttle[] | null>(null);
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'shuttle-public-readonly' } });
    try {
      const [schedule, closed] = await Promise.all([
        sb.from('schedule_items').select('id,date,title,description').eq('type', 'shuttle').eq('is_deployed', true).order('date').order('id').limit(10000),
        sb.from('holidays').select('date').eq('is_deployed', true),
      ]);
      if (schedule.error || closed.error) throw new Error('일정 조회 실패');
      setRows(schedule.data || []);
      setHolidays(new Set((closed.data || []).map(row => row.date)));
      setError('');
    } catch {
      setRows(null);
      setError('셔틀 일정을 불러오지 못했습니다. 새로고침 후 다시 확인해주세요.');
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  const getSlots = useCallback((date: string) => rows === null ? [] : publishedShuttleSlots(date, rows, holidays), [rows, holidays]);
  return { getSlots, reload, loading: rows === null && !error, error };
}
