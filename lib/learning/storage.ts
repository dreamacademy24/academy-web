export type Point = { x: number; y: number };
export type Stroke = Point[];
export type Section = 'scene' | 'words' | 'story' | 'create' | 'finish';
export type Phase = 'meet' | 'listen' | 'match' | 'spell' | 'write' | 'speak';
export type Evidence = { match?: boolean; meet?: boolean; listen?: boolean; spell?: boolean; write?: boolean; speak?: boolean; listenAttempts?: number; spellAttempts?: number; spellingSupport?: boolean };
export type Draft = {
  version: 1; section: Section; index: number; phase: Phase; found: number[];
  evidence: Record<string, Evidence>; ink: Record<string, Stroke[]>;
  typed: Record<string, string>; storyAnswers: Record<string, number>;
  storyRead: boolean; sentence: string; created: boolean;
};
export const initialDraft = (): Draft => ({ version: 1, section: 'scene', index: 0, phase: 'meet', found: [], evidence: {}, ink: {}, typed: {}, storyAnswers: {}, storyRead: false, sentence: '', created: false });
const NAME = 'dream-learning-preview-v1';
const KEY = 'dsl-f2-w1-d1-approved-v2';
export type LearningScope = Readonly<{kind:'demo'} | {kind:'learner';learnerId:string;visitId:string;unitId:'dsl-f2-w1-d1'}>;
export const DEMO_SCOPE: LearningScope = Object.freeze({kind:'demo'});
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function learningScopeKey(scope: LearningScope) {
  if (scope.kind === 'demo') return '';
  if (!uuid(scope.learnerId) || !uuid(scope.visitId) || scope.unitId !== 'dsl-f2-w1-d1') throw new Error('학습할 아이와 방문을 다시 선택해주세요.');
  return `learner:${scope.learnerId.toLowerCase()}:visit:${scope.visitId.toLowerCase()}:unit:${scope.unitId}:`;
}
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('기기 저장을 사용할 수 없어요.'));
    const req = indexedDB.open(NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('drafts'); req.result.createObjectStore('audio'); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('다른 학습 창을 닫고 다시 열어주세요.'));
  });
}
async function read<T>(store: string, key: string): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly'); const req = tx.objectStore(store).get(key);
    tx.oncomplete = () => { db.close(); resolve(req.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}
async function write(store: string, key: string, value: unknown): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(value, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}
async function readDraft(key: string): Promise<Draft> {
  const value = await readAfterWrites<Draft>('drafts', key);
  if (!value || value.version !== 1) return initialDraft();
  return { ...initialDraft(), ...value, index: Math.max(0, Math.min(7, value.index || 0)),
    section: ['scene','words','story','create','finish'].includes(value.section) ? value.section : 'scene',
    phase: ['meet','listen','match','spell','write','speak'].includes(value.phase) ? value.phase : 'meet' };
}
export type Recording = { blob: Blob; text: string; seconds: number; savedAt: string; interrupted: boolean };
export const normalizeAnswer = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');
export type AdventureMemory = { scene: number; sentence: string; ink: Stroke[]; missionOpen?: boolean };
// Every operation captures its complete key now, including writes still in a queue.
// Demo keys stay byte-for-byte compatible; learner storage never falls back to them.
const writeQueues = new Map<string, Promise<void>>();
async function readAfterWrites<T>(store: string, key: string) {
  await writeQueues.get(`${store}:${key}`)?.catch(() => {});
  return read<T>(store, key);
}
function enqueue(store: string, key: string, value: unknown) {
  const snapshot = structuredClone(value), queueKey = `${store}:${key}`;
  const next = (writeQueues.get(queueKey) ?? Promise.resolve()).catch(() => {}).then(() => write(store, key, snapshot));
  writeQueues.set(queueKey, next);
  void next.finally(() => { if (writeQueues.get(queueKey) === next) writeQueues.delete(queueKey); }).catch(() => {});
  return next;
}
export function createLearningStorage(scope: LearningScope) {
  const prefix = learningScopeKey(scope);
  const draftKey = prefix + KEY;
  const adventureKey = prefix + 'treehouse-adventure-v1';
  const missionKey = prefix + 'treehouse-final-mission-v1';
  return Object.freeze({
    getDraft: () => readDraft(draftKey),
    putDraft: (draft: Draft) => enqueue('drafts', draftKey, draft),
    getRecording: (key: string) => readAfterWrites<Recording>('audio', `${draftKey}:${key}`),
    putRecording: (key: string, value: Recording) => enqueue('audio', `${draftKey}:${key}`, value),
    getAdventure: () => readAfterWrites<AdventureMemory>('drafts', adventureKey),
    putAdventure: (value: AdventureMemory) => enqueue('drafts', adventureKey, value),
    getFinalMission: () => readAfterWrites<unknown>('drafts', missionKey),
    putFinalMission: (value: import('./final-mission').MissionState) => enqueue('drafts', missionKey, value),
  });
}
export type LearningStorage = ReturnType<typeof createLearningStorage>;
// Existing anonymous callers retain their original progress. Real learners use the provider.
export const {getDraft,putDraft,getRecording,putRecording,getAdventure,putAdventure,getFinalMission,putFinalMission} = createLearningStorage(DEMO_SCOPE);
