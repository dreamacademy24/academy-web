export function blocksToTimeOverrides(blocks: any): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(blocks)) return out;
  for (const b of blocks) {
    if (!b || !b.time || !Array.isArray(b.days)) continue;
    for (const d of b.days) { if (d) out[String(d).trim()] = b.time; }
  }
  return out;
}
