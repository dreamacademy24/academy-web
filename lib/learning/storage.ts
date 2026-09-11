export type Point = { x: number; y: number };
export type Stroke = Point[];
export type Section = 'scene' | 'words' | 'story' | 'create' | 'finish';
export type Phase = 'meet' | 'listen' | 'spell' | 'write' | 'speak';
export type Evidence = { meet?: boolean; listen?: boolean; spell?: boolean; write?: boolean; speak?: boolean; listenAttempts?: number; spellAttempts?: number; spellingSupport?: boolean };
export type Draft = {
  version: 1; section: Section; index: number; phase: Phase; found: number[];
  evidence: Record<string, Evidence>; ink: Record<string, Stroke[]>;
  typed: Record<string, string>; storyAnswers: Record<string, number>;
  storyRead: boolean; sentence: string; created: boolean;
};
export const initialDraft = (): Draft => ({ version: 1, section: 'scene', index: 0, phase: 'meet', found: [], evidence: {}, ink: {}, typed: {}, storyAnswers: {}, storyRead: false, sentence: '', created: false });
const NAME = 'dream-learning-preview-v1';
const KEY = 'dsl-f2-w1-d1-approved-v2';
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
export async function getDraft(): Promise<Draft> {
  const value = await read<Draft>('drafts', KEY);
  if (!value || value.version !== 1) return initialDraft();
  return { ...initialDraft(), ...value, index: Math.max(0, Math.min(7, value.index || 0)),
    section: ['scene','words','story','create','finish'].includes(value.section) ? value.section : 'scene',
    phase: ['meet','listen','spell','write','speak'].includes(value.phase) ? value.phase : 'meet' };
}
let queue = Promise.resolve();
export function putDraft(draft: Draft) {
  const snapshot = structuredClone(draft);
  queue = queue.catch(() => {}).then(() => write('drafts', KEY, snapshot));
  return queue;
}
export type Recording = { blob: Blob; text: string; seconds: number; savedAt: string; interrupted: boolean };
export const getRecording = (key: string) => read<Recording>('audio', `${KEY}:${key}`);
export const putRecording = (key: string, value: Recording) => write('audio', `${KEY}:${key}`, value);
export const normalizeAnswer = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');
