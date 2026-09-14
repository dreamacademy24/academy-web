export const ENGLISH_LEVELS = [
  { value: 'zero', label: '제로베이스(기초)', description: '영어를 처음 접함' },
  { value: 'beginner', label: '비기너', description: '알파벳, 파닉스, 단어를 알고 있음' },
  { value: 'intermediate', label: '미디엄', description: '문장을 이용한 원활한 영어 소통이 가능함' },
  { value: 'advanced', label: '어드밴스', description: '원서 리딩·독해·토론 등 심화 수업이 가능함' },
] as const;

export function englishLevelLabel(value: string) {
  return ENGLISH_LEVELS.find(level => level.value === value)?.label || value || '미입력';
}
