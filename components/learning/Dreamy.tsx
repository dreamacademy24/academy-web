'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import styles from './Dreamy.module.css';

export default function Dreamy({ happy = false, live = false, motion = true }: { happy?: boolean; live?: boolean; motion?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!live) return;
    let active = true, dispose: (() => void) | undefined;
    void import('@/lib/learning/dreamy-avatar.mjs').then(({mountDreamy}) => {
      if (!active || !canvas.current) return;
      try { dispose = mountDreamy(canvas.current, {happy, motion, onError: () => {if(active)setReady(false);}}); setReady(true); }
      catch { setReady(false); }
    }).catch(() => {if(active)setReady(false);});
    return () => {active=false;dispose?.();};
  }, [live, happy, motion]);
  return <span className={styles.character} role="img" aria-label="손을 흔드는 망고 드림이">
    <Image className={ready&&live?styles.hidden:styles.poster} src={`/learning/tree-house/dreamy-${happy?'happy':'wave'}.webp`} alt="" width={300} height={400}/>
    {live&&<canvas className={ready?styles.canvas:styles.hidden} ref={canvas} aria-hidden="true"/>}
  </span>;
}
