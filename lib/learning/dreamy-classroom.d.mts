export type DreamyClassroom = {
  resize: (width: number, height: number, pixelRatio?: number) => void;
  setSpeaking: (speaking: boolean) => void;
  setVisible: (visible: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
  dispose: () => void;
};
export function mountDreamyClassroom(canvas: HTMLCanvasElement, options?: { compact?: boolean; onError?: (error: unknown) => void; onCharacterBounds?: (bounds: CharacterBounds) => void }): DreamyClassroom;
export type CharacterBounds = { left: number; top: number; width: number; height: number };
