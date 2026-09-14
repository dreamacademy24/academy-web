'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { DreamyClassroom } from '@/lib/learning/dreamy-classroom.mjs';
import styles from './LearningWorld.module.css';

export default function LearningWorld({ speaking = false, compact = false, motion = true, className = '' }: { speaking?: boolean; compact?: boolean; motion?: boolean; className?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const world = useRef<DreamyClassroom | null>(null);
  const latestSpeaking = useRef(speaking);
  const latestMotion = useRef(motion);
  const visible = useRef(true);
  const [ready, setReady] = useState(false);

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
    let active = true, intersecting = true;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const resize = () => {
      const bounds = element.getBoundingClientRect();
      world.current?.resize(bounds.width, bounds.height, window.devicePixelRatio || 1);
    };
    const visibility = () => {
      visible.current = intersecting && !document.hidden;
      world.current?.setVisible(visible.current);
      element.dataset.motionPaused = String(!visible.current || !latestMotion.current || reducedMotion.matches);
    };
    const applyMotion = () => { world.current?.setReducedMotion(!latestMotion.current || reducedMotion.matches); visibility(); };
    const sizeObserver = new ResizeObserver(resize); sizeObserver.observe(element);
    const viewObserver = new IntersectionObserver(entries => { intersecting = entries[0]?.isIntersecting ?? true; visibility(); }); viewObserver.observe(element);
    document.addEventListener('visibilitychange', visibility);
    reducedMotion.addEventListener('change', applyMotion);
    void import('@/lib/learning/dreamy-classroom.mjs').then(({ mountDreamyClassroom }) => {
      if (!active) return;
      try {
        let failed = false;
        world.current = mountDreamyClassroom(surface, { compact, onError: () => { failed = true; if (active) setReady(false); } });
        resize(); applyMotion(); visibility(); world.current.setSpeaking(latestSpeaking.current); setReady(!failed);
      } catch { if (active) setReady(false); }
    }).catch(() => { if (active) setReady(false); });
    return () => {
      active = false; sizeObserver.disconnect(); viewObserver.disconnect();
      document.removeEventListener('visibilitychange', visibility); reducedMotion.removeEventListener('change', applyMotion);
      world.current?.dispose(); world.current = null;
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
      <Image className={styles.character} src="/learning/tree-house/dreamy-wave.webp" alt="" width={300} height={400} />
    </div>
    <canvas ref={canvas} className={`${styles.canvas} ${ready ? '' : styles.hidden}`} />
  </div>;
}
