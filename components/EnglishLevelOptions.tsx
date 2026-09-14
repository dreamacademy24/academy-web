import { ENGLISH_LEVELS } from '@/lib/englishLevels';

export default function EnglishLevelOptions({ value = '' }: { value?: string }) {
  const legacy = value && !ENGLISH_LEVELS.some(level => level.value === value);
  return <>
    <option value="">영어 수준을 선택해주세요</option>
    {legacy && <option value={value}>{value} (기존 입력)</option>}
    {ENGLISH_LEVELS.map(level => <option key={level.value} value={level.value}>{level.label} — {level.description}</option>)}
  </>;
}
