export const officialLevels = ['DSL-F2', 'DSL-T1', 'DR-F1', 'DR-F2', 'DR-S', 'DR-T'] as const;
export type LevelCode = typeof officialLevels[number];
export type LearningUnit = { id: string; levelCode: LevelCode; title: string; href: string; published: boolean };
export const learningUnits: readonly LearningUnit[] = [
  { id: 'dsl-f2-w1-d1', levelCode: 'DSL-F2', title: 'My Tree House', href: '/learn/tree-house', published: true },
];
export const isLevelCode = (value: unknown): value is LevelCode => typeof value === 'string' && (officialLevels as readonly string[]).includes(value);
export function getLearningUnit(levelCode: unknown, unitId: unknown): LearningUnit | null {
  return learningUnits.find(unit => unit.levelCode === levelCode && unit.id === unitId) ?? null;
}
export function validLearningAssignment(levelCode: unknown, unitId: unknown): levelCode is LevelCode {
  return isLevelCode(levelCode) && (unitId === null || getLearningUnit(levelCode, unitId) !== null);
}
export type LearningAssignment = {
  id: string; levelCode: LevelCode; unitId: string | null; unitTitle: string | null;
  href: string | null; published: boolean; effectiveAt: string; createdAt: string; version: number;
};
export type AssignmentRecord = {
  id: string; level_code: string; unit_id: string | null; effective_at: string; created_at: string; version: number;
};
export function describeAssignment(record: AssignmentRecord | null | undefined): LearningAssignment | null {
  if (!record || !isLevelCode(record.level_code)) return null;
  const unit = getLearningUnit(record.level_code, record.unit_id);
  const published = unit?.published === true;
  return {
    id: record.id, levelCode: record.level_code, unitId: record.unit_id,
    unitTitle: unit?.title ?? null, href: published ? unit.href : null, published,
    effectiveAt: record.effective_at, createdAt: record.created_at, version: record.version,
  };
}
