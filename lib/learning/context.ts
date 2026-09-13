import type { LearningScope } from './storage';

const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export type LearningSelection = {kind:'demo'} | {kind:'invalid'} | {kind:'learner';learnerId:string;visitId:string};
export function parseLearningSelection(learnerId: string | null, visitId: string | null): LearningSelection {
  if (learnerId === null && visitId === null) return {kind:'demo'};
  if (!uuid(learnerId) || !uuid(visitId)) return {kind:'invalid'};
  return {kind:'learner',learnerId:learnerId.toLowerCase(),visitId:visitId.toLowerCase()};
}
export function matchLearningContext(payload: unknown, selected: Extract<LearningSelection,{kind:'learner'}>): {scope:LearningScope;name:string} | null {
  if (!object(payload) || !Array.isArray(payload.children)) return null;
  const children = payload.children.filter(child => object(child) && child.learnerId === selected.learnerId);
  if (children.length !== 1 || !object(children[0]) || !Array.isArray(children[0].visits)) return null;
  const child = children[0];
  const visits = (child.visits as unknown[]).filter(visit => object(visit) && visit.visitId === selected.visitId);
  if (visits.length !== 1 || !object(visits[0])) return null;
  const assignment = visits[0].assignment;
  if (!object(assignment) || assignment.published !== true || assignment.unitId !== 'dsl-f2-w1-d1'
    || assignment.levelCode !== 'DSL-F2' || assignment.href !== '/learn/tree-house') return null;
  const name = typeof child.nameKr === 'string' && child.nameKr.trim() ? child.nameKr.trim()
    : typeof child.nameEn === 'string' && child.nameEn.trim() ? child.nameEn.trim() : '나의 학습';
  return {scope:Object.freeze({kind:'learner',learnerId:selected.learnerId,visitId:selected.visitId,unitId:'dsl-f2-w1-d1'}),name};
}
/** Only the latest still-mounted authorization request can reveal learner content. */
export function createLearningRequestFence() {
  let generation = 0;
  return {
    begin: () => ++generation,
    isCurrent: (ticket: number) => ticket === generation,
    cancel: () => { generation++; },
  };
}
