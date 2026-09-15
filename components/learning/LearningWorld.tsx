'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { CharacterBounds, DreamyClassroom } from '@/lib/learning/dreamy-classroom.mjs';
import styles from './LearningWorld.module.css';
export type { CharacterBounds } from '@/lib/learning/dreamy-classroom.mjs';

export default function LearningWorld({ speaking = false, compact = false, motion = true, className = '', onCharacterBounds }: { speaking?: boolean; compact?: boolean; motion?: boolean; className?: string; onCharacterBounds?: (bounds: CharacterBounds) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const fallbackImage = useRef<HTMLImageElement>(null);
  const measureFallbackRef = useRef<(() => void) | null>(null);
  const boundsCallback = useRef(onCharacterBounds);
  const latestBounds = useRef<CharacterBounds | null>(null);
  const world = useRef<DreamyClassroom | null>(null);
  const latestSpeaking = useRef(speaking);
  const latestMotion = useRef(motion);
  const visible = useRef(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    boundsCallback.current = onCharacterBounds;
    if (latestBounds.current) onCharacterBounds?.(latestBounds.current);
  }, [onCharacterBounds]);

  useEffect(() => {
    latestSpeaking.current = speaking;
    world.current?.setSpeaking(speaking);
  }, [speaking]);

  useEffect(() => {
    latestMotion.current = motion;
    const reduced = !motion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    world.current?.setReducedMotion(reduced);
    if (container.current) container.current.dataset.motionPaused = String(reduced || !visible.current || document.hidden);
  }, [motion]);

  useEffect(() => {
    const element = container.current, surface = canvas.current;
    if (!element || !surface) return;
    let active = true, intersecting = true, hasLiveRenderer = false;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const publishBounds = (bounds: CharacterBounds) => {
      if (!active || bounds.width <= 0 || bounds.height <= 0) return;
      const previous = latestBounds.current;
      if (previous && (['left', 'top', 'width', 'height'] as const).every(key => Math.abs(previous[key] - bounds[key]) < .1)) return;
      latestBounds.current = bounds; boundsCallback.current?.(bounds);
    };
    const measureFallback = () => {
      if (hasLiveRenderer || !fallbackImage.current) return;
      const parent = element.getBoundingClientRect(), image = fallbackImage.current.getBoundingClientRect();
      publishBounds({ left: image.left - parent.left, top: image.top - parent.top, width: image.width, height: image.height });
    };
    measureFallbackRef.current = measureFallback;
    const resize = () => {
      const bounds = element.getBoundingClientRect();
      measureFallback();
      world.current?.resize(bounds.width, bounds.height, window.devicePixelRatio || 1);
    };
    const visibility = () => {
      visible.current = intersecting && !document.hidden;
      world.current?.setVisible(visible.current);
      element.dataset.motionPaused = String(!visible.current || !latestMotion.current || reducedMotion.matches);
    };
    const applyMotion = () => { world.current?.setReducedMotion(!latestMotion.current || reducedMotion.matches); visibility(); };
    measureFallback();
    const sizeObserver = new ResizeObserver(resize); sizeObserver.observe(element);
    const viewObserver = new IntersectionObserver(entries => { intersecting = entries[0]?.isIntersecting ?? true; visibility(); }); viewObserver.observe(element);
    document.addEventListener('visibilitychange', visibility);
    reducedMotion.addEventListener('change', applyMotion);
    void import('@/lib/learning/dreamy-classroom.mjs').then(({ mountDreamyClassroom }) => {
      if (!active) return;
      try {
        let failed = false;
        world.current = mountDreamyClassroom(surface, {
          compact,
          onCharacterBounds: bounds => { hasLiveRenderer = true; publishBounds(bounds); },
          onError: () => { failed = true; hasLiveRenderer = false; if (active) { setReady(false); measureFallback(); } },
        });
        resize(); applyMotion(); visibility(); world.current.setSpeaking(latestSpeaking.current); setReady(!failed);
      } catch { hasLiveRenderer = false; if (active) { setReady(false); measureFallback(); } }
    }).catch(() => { if (active) { setReady(false); measureFallback(); } });
    return () => {
      active = false; sizeObserver.disconnect(); viewObserver.disconnect();
      document.removeEventListener('visibilitychange', visibility); reducedMotion.removeEventListener('change', applyMotion);
      world.current?.dispose(); world.current = null; measureFallbackRef.current = null;
    };
  }, [compact]);

  return <div ref={container} className={`${styles.world} ${compact ? styles.compact : ''} ${className}`} aria-hidden="true" data-learning-world={ready ? 'ready' : 'fallback'} data-world-composition={compact ? 'character' : 'cinematic-scene'} data-motion={motion ? 'on' : 'off'}>
    {!compact && <>
      <Image className={styles.backdrop} src="/learning/tree-house/dream-world-v2.png" alt="" fill sizes="100vw" priority />
      <div className={styles.sunlight} />
      <div className={styles.mist} />
      <div className={styles.motes}>{[0, 1, 2, 3, 4, 5].map(index => <i key={index} />)}</div>
    </>}
    <div className={`${styles.fallback} ${ready ? styles.hidden : ''}`}>
      <Image ref={fallbackImage} className={styles.character} src="/learning/tree-house/dreamy-wave.webp" alt="" width={300} height={400} onLoad={() => measureFallbackRef.current?.()} />
    </div>
    <canvas ref={canvas} className={`${styles.canvas} ${ready ? '' : styles.hidden}`} />
  </div>;
}
