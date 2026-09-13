import lesson from './tree-house.json';

export const pictureRounds = [
  { word: 0, choices: [1, 0, 5] },
  { word: 1, choices: [7, 3, 1] },
] as const;
export const matchWords = [3, 5, 7] as const;
export const spellWords = [0, 1] as const;

export type MissionState = {
  version: 1;
  checkpoint: 0 | 1 | 2 | 3;
  round: number;
  solved: boolean;
  matched: number[];
  reviewWords: number[];
  supportedWords: number[];
  completedAt: string | null;
};

export type MissionAction =
  | { type: 'picture'; word: number }
  | { type: 'match'; word: number }
  | { type: 'mistake'; word: number }
  | { type: 'spell'; answer: string; assisted: boolean }
  | { type: 'next' }
  | { type: 'restart' };

export function initialMission(): MissionState {
  return {
    version: 1, checkpoint: 0, round: 0, solved: false,
    matched: [], reviewWords: [], supportedWords: [], completedAt: null,
  };
}

function uniqueWords(value: unknown, allowed: readonly number[]): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.slice(0, 64).filter(
    (word): word is number => typeof word === 'number' && allowed.includes(word),
  ))];
}

function addWord(words: number[], word: number): number[] {
  return words.includes(word) ? words : [...words, word];
}

/** Recover only reachable phase shapes; older or corrupt progress starts safely. */
export function restoreMission(value: unknown): MissionState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return initialMission();
  const saved = value as Record<string, unknown>;
  if (saved.version !== 1 || ![0, 1, 2, 3].includes(saved.checkpoint as number)
    || typeof saved.round !== 'number' || !Number.isInteger(saved.round)
    || typeof saved.solved !== 'boolean') return initialMission();

  const checkpoint = saved.checkpoint as MissionState['checkpoint'];
  const maxRounds = checkpoint === 0 ? pictureRounds.length : checkpoint === 2 ? spellWords.length : 1;
  if (saved.round < 0 || saved.round >= maxRounds) return initialMission();

  const matched = uniqueWords(saved.matched, matchWords);
  // The matching checkpoint must be complete before spelling or completion.
  if ((checkpoint === 0 && matched.length > 0) || (checkpoint >= 2 && matched.length !== matchWords.length)) {
    return initialMission();
  }

  let completedAt: string | null = null;
  if (checkpoint === 3) {
    if (!saved.solved || typeof saved.completedAt !== 'string' || saved.completedAt.length > 30) return initialMission();
    const completedTime = Date.parse(saved.completedAt);
    if (!Number.isFinite(completedTime) || new Date(completedTime).toISOString() !== saved.completedAt) return initialMission();
    completedAt = saved.completedAt;
  } else if (saved.completedAt != null) return initialMission();

  const reviewCandidates = checkpoint === 0
    ? pictureRounds.slice(0, saved.round + 1).map(round => round.word)
    : [...pictureRounds.map(round => round.word), ...matchWords];
  const supportCandidates = checkpoint === 3 ? spellWords
    : checkpoint === 2 ? spellWords.slice(0, saved.round + (saved.solved ? 1 : 0)) : [];

  return {
    version: 1, checkpoint, round: saved.round,
    solved: checkpoint === 1 ? matched.length === matchWords.length : saved.solved,
    matched,
    reviewWords: uniqueWords(saved.reviewWords, reviewCandidates),
    supportedWords: uniqueWords(saved.supportedWords, supportCandidates),
    completedAt,
  };
}

export function reduceMission(state: MissionState, action: MissionAction): MissionState {
  if (action.type === 'restart') return initialMission();
  if (state.checkpoint === 3) return state;

  if (action.type === 'next') {
    if (!state.solved) return state;
    if (state.checkpoint === 0) {
      return state.round < pictureRounds.length - 1
        ? { ...state, round: state.round + 1, solved: false }
        : { ...state, checkpoint: 1, round: 0, solved: false, matched: [] };
    }
    if (state.checkpoint === 1) {
      if (state.matched.length !== matchWords.length || !matchWords.every(word => state.matched.includes(word))) return state;
      return { ...state, checkpoint: 2, round: 0, solved: false };
    }
    return state.round < spellWords.length - 1
      ? { ...state, round: state.round + 1, solved: false }
      : { ...state, checkpoint: 3, round: 0, solved: true, completedAt: new Date().toISOString() };
  }

  if (state.solved) return state;
  if (action.type === 'picture' && state.checkpoint === 0) {
    const current = pictureRounds[state.round];
    if (!current || !(current.choices as readonly number[]).includes(action.word)) return state;
    return action.word === current.word
      ? { ...state, solved: true }
      : { ...state, reviewWords: addWord(state.reviewWords, current.word) };
  }

  if (action.type === 'match' && state.checkpoint === 1) {
    if (!(matchWords as readonly number[]).includes(action.word) || state.matched.includes(action.word)) return state;
    const matched = [...state.matched, action.word];
    return { ...state, matched, solved: matched.length === matchWords.length };
  }
  if (action.type === 'mistake' && state.checkpoint === 1) {
    if (!(matchWords as readonly number[]).includes(action.word) || state.matched.includes(action.word)) return state;
    return { ...state, reviewWords: addWord(state.reviewWords, action.word) };
  }

  if (action.type === 'spell' && state.checkpoint === 2) {
    const word = spellWords[state.round];
    if (word === undefined || typeof action.answer !== 'string') return state;
    if (action.answer.trim().toLowerCase() !== lesson.words[word].word) {
      return { ...state, reviewWords: addWord(state.reviewWords, word) };
    }
    return {
      ...state, solved: true,
      supportedWords: action.assisted ? addWord(state.supportedWords, word) : state.supportedWords,
    };
  }
  return state;
}
