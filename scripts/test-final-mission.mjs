import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const lesson = JSON.parse(readFileSync(new URL('../lib/learning/tree-house.json', import.meta.url), 'utf8'));
const code = ts.transpileModule(readFileSync(new URL('../lib/learning/final-mission.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const exports = {};
vm.runInNewContext(code, {
  exports,
  require(name) { assert.equal(name, './tree-house.json'); return lesson; },
});
const { initialMission, restoreMission, reduceMission, pictureRounds, matchWords, spellWords } = exports;
const plain = value => JSON.parse(JSON.stringify(value));
const next = state => reduceMission(state, { type: 'next' });
function matchingStart() {
  let state = initialMission();
  for (const { word } of pictureRounds) state = next(reduceMission(state, { type: 'picture', word }));
  return state;
}
function spellingStart() {
  let state = matchingStart();
  for (const word of matchWords) state = reduceMission(state, { type: 'match', word });
  return next(state);
}
function finish() {
  let state = spellingStart();
  for (const word of spellWords) state = next(reduceMission(state, {
    type: 'spell', answer: lesson.words[word].word, assisted: false,
  }));
  return state;
}

test('initial states have independent arrays and lesson words match the mission', () => {
  const first = initialMission(); first.reviewWords.push(0);
  assert.deepEqual(plain(initialMission().reviewWords), []);
  assert.deepEqual(plain(pictureRounds), [{ word: 0, choices: [1, 0, 5] }, { word: 1, choices: [7, 3, 1] }]);
  assert.deepEqual(plain(matchWords.map(word => lesson.words[word].word)), ['ladder', 'door', 'window']);
  assert.deepEqual(plain(spellWords.map(word => lesson.words[word].word)), ['tree', 'house']);
});

test('picture mistakes record the target once and never open the next gate', () => {
  const first = initialMission();
  assert.equal(next(first), first);
  let state = reduceMission(first, { type: 'picture', word: 1 });
  state = reduceMission(state, { type: 'picture', word: 5 });
  assert.deepEqual(plain(state.reviewWords), [0]);
  assert.equal(state.solved, false);
  assert.equal(next(state), state);
  assert.equal(reduceMission(state, { type: 'picture', word: 999 }), state);
  assert.deepEqual(plain(first.reviewWords), []);
  state = next(reduceMission(state, { type: 'picture', word: 0 }));
  assert.equal(state.checkpoint, 0); assert.equal(state.round, 1); assert.equal(state.solved, false);
  state = reduceMission(state, { type: 'picture', word: 7 });
  assert.deepEqual(plain(state.reviewWords), [0, 1]);
  state = next(reduceMission(state, { type: 'picture', word: 1 }));
  assert.equal(state.checkpoint, 1); assert.equal(state.round, 0); assert.equal(state.solved, false);
});

test('matching requires three distinct expected pairs and ignores unrelated actions', () => {
  let state = matchingStart();
  for (const action of [{ type: 'picture', word: 1 }, { type: 'spell', answer: 'tree', assisted: false }, { type: 'match', word: 0 }, { type: 'mistake', word: 999 }]) {
    assert.equal(reduceMission(state, action), state);
  }
  state = reduceMission(state, { type: 'mistake', word: 3 });
  state = reduceMission(state, { type: 'mistake', word: 3 });
  assert.deepEqual(plain(state.reviewWords), [3]);
  state = reduceMission(state, { type: 'match', word: 3 });
  assert.equal(reduceMission(state, { type: 'match', word: 3 }), state);
  assert.equal(reduceMission(state, { type: 'mistake', word: 3 }), state);
  state = reduceMission(state, { type: 'match', word: 5 });
  assert.equal(state.solved, false); assert.equal(next(state), state);
  state = reduceMission(state, { type: 'match', word: 7 });
  assert.equal(state.solved, true);
  state = next(state);
  assert.equal(state.checkpoint, 2); assert.equal(state.solved, false);
  assert.deepEqual(plain(state.matched), [3, 5, 7]);
});

test('spelling accepts case and surrounding whitespace while retaining retry and support evidence', () => {
  let state = spellingStart();
  for (const answer of ['TREE HOUSE', 't ree', '', 'trees']) {
    state = reduceMission(state, { type: 'spell', answer, assisted: false });
    assert.equal(state.solved, false); assert.equal(next(state), state);
  }
  assert.deepEqual(plain(state.reviewWords), [0]);
  state = reduceMission(state, { type: 'spell', answer: '  TrEe\n', assisted: true });
  assert.equal(state.solved, true);
  assert.deepEqual(plain(state.supportedWords), [0]);
  assert.equal(reduceMission(state, { type: 'spell', answer: 'wrong', assisted: false }), state);
  state = next(state);
  assert.equal(state.round, 1); assert.equal(state.solved, false); assert.equal(state.completedAt, null);
  state = reduceMission(state, { type: 'spell', answer: 'HOUSE', assisted: false });
  assert.equal(state.checkpoint, 2); assert.equal(state.completedAt, null);
  state = next(state);
  assert.equal(state.checkpoint, 3); assert.equal(state.solved, true);
  assert.ok(Number.isFinite(Date.parse(state.completedAt)));
  assert.deepEqual(plain(state.reviewWords), [0]);
  assert.deepEqual(plain(state.supportedWords), [0]);
});

test('completion is stable and restart resets mission data without mutating the previous result', () => {
  const completed = finish();
  for (const action of [{ type: 'next' }, { type: 'picture', word: 5 }, { type: 'spell', answer: 'x', assisted: true }]) {
    assert.equal(reduceMission(completed, action), completed);
  }
  const restarted = reduceMission(completed, { type: 'restart' });
  assert.deepEqual(plain(restarted), plain(initialMission()));
  assert.equal(completed.checkpoint, 3); assert.ok(completed.completedAt);
});

test('every legitimate intermediate state and completion round-trips after reload', () => {
  let state = initialMission();
  const actions = [
    { type: 'picture', word: 5 }, { type: 'picture', word: 0 }, { type: 'next' },
    { type: 'picture', word: 1 }, { type: 'next' }, { type: 'mistake', word: 7 },
    ...matchWords.map(word => ({ type: 'match', word })), { type: 'next' },
    { type: 'spell', answer: 'tree', assisted: true }, { type: 'next' },
    { type: 'spell', answer: 'wrong', assisted: false },
    { type: 'spell', answer: 'house', assisted: true }, { type: 'next' },
  ];
  for (const action of actions) {
    state = reduceMission(state, action);
    assert.deepEqual(plain(restoreMission(plain(state))), plain(state));
  }
});

test('unknown versions and malformed phase shapes reset without awarding completion', () => {
  const base = plain(initialMission());
  for (const value of [null, [], 'done', {}, { ...base, version: 0 }, { ...base, version: 2 },
    { ...base, checkpoint: '3' }, { ...base, checkpoint: 99 }, { ...base, round: NaN },
    { ...base, round: Infinity }, { ...base, round: -1 }, { ...base, round: 0.5 },
    { ...base, solved: 'true' }, { ...base, checkpoint: 1, round: 1 },
    { ...base, checkpoint: 2, matched: [3, 3, 5] },
    { ...base, checkpoint: 3, solved: true, completedAt: new Date().toISOString() },
    { ...base, checkpoint: 3, matched: [3, 5, 7], solved: true, completedAt: 'yesterday' },
    { ...base, checkpoint: 3, matched: [3, 5, 7], solved: false, completedAt: new Date().toISOString() },
    { ...base, matched: [3] }, { ...base, completedAt: new Date().toISOString() },
  ]) assert.deepEqual(plain(restoreMission(value)), base);
});

test('restore sanitizes bounded evidence and cannot turn duplicate pairs into a matching pass', () => {
  const state = restoreMission({
    ...plain(matchingStart()), solved: true,
    matched: [3, 3, 5, 999, '7'], reviewWords: [3, 3, -1, '5', 7, 0], supportedWords: [0, 1],
  });
  assert.deepEqual(plain(state.matched), [3, 5]);
  assert.equal(state.solved, false); assert.equal(next(state), state);
  assert.deepEqual(plain(state.reviewWords), [3, 7, 0]);
  assert.deepEqual(plain(state.supportedWords), []);
  assert.deepEqual(plain(restoreMission({ ...plain(initialMission()), reviewWords: [1, 0], supportedWords: [0] }).reviewWords), [0]);
});

test('restored data is copied so later caller mutations cannot change mission progress', () => {
  const saved = plain(finish()); saved.reviewWords = [0]; saved.supportedWords = [1];
  const restored = restoreMission(saved);
  saved.matched.length = 0; saved.reviewWords.push(1); saved.supportedWords.length = 0;
  assert.deepEqual(plain(restored.matched), [3, 5, 7]);
  assert.deepEqual(plain(restored.reviewWords), [0]);
  assert.deepEqual(plain(restored.supportedWords), [1]);
});
