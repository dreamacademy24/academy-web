import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Uses only the official unauthenticated free demo. Stops on quota/errors;
// never switches accounts, retries a generation, or uses paid credentials.
const origin = 'https://qwen-qwen3-tts.hf.space';
const endpoint = 'generate_voice_clone';
const root = fileURLToPath(new URL('../', import.meta.url));
const dir = join(root, 'artifacts/free-voice/intro');
const reference = JSON.parse(await readFile(join(root, 'artifacts/free-voice/qwen-greeting-result.json'), 'utf8'));
const referenceRequest = JSON.parse(await readFile(join(root, 'artifacts/free-voice/qwen-greeting-request.json'), 'utf8'));
const timeline = JSON.parse(await readFile(join(root, 'scripts/dreamy-intro-timeline.json'), 'utf8'));
const referenceBytes = await readFile(join(root, 'artifacts/free-voice/dreamy-qwen-greeting.wav'));
const referenceHash = createHash('sha256').update(referenceBytes).digest('hex');
const refUrl = new URL(reference.audioUrl);
if (refUrl.origin !== origin) throw Error('The approved reference must be hosted by the official Qwen demo.');
await mkdir(dir, { recursive: true });
const exists = async p => { try { await access(p); return true; } catch { return false; } };

if (process.argv.includes('--inspect')) {
  for (const suffix of ['/config', '/gradio_api/openapi.json']) {
    const response = await fetch(origin + suffix, { signal: AbortSignal.timeout(20000) });
    const text = await response.text();
    let data;
    try { const value = JSON.parse(text); data = suffix === '/config'
      ? value.dependencies?.map(x => ({ id: x.id, api_name: x.api_name, queue: x.queue }))
      : { predictBody: value.components?.schemas?.PredictBody, simpleBody: value.components?.schemas?.SimplePredictBody }; }
    catch { data = text.slice(0, 350); }
    console.log(JSON.stringify({ suffix, status: response.status, data }));
  }
  process.exit(0);
}

async function finish(eventId) {
  const response = await fetch(`${origin}/gradio_api/call/${endpoint}/${eventId}`, {
    headers: { Accept: 'text/event-stream' }, signal: AbortSignal.timeout(180000),
  });
  if (!response.ok || !response.body) throw Error(`Free demo events HTTP ${response.status}`);
  const decoder = new TextDecoder();
  let pending = '';
  for await (const chunk of response.body) {
    pending += decoder.decode(chunk, { stream: true });
    pending = pending.replaceAll('\r\n', '\n');
    let end;
    while ((end = pending.indexOf('\n\n')) >= 0) {
      const block = pending.slice(0, end); pending = pending.slice(end + 2);
      const type = block.match(/^event: (.+)$/m)?.[1];
      const value = block.split('\n').filter(x => x.startsWith('data:')).map(x => x.slice(5).trimStart()).join('\n');
      if (type === 'error') throw Error(`Free demo rejected the request: ${value.slice(0, 1000)}`);
      if (type === 'complete') return JSON.parse(value);
    }
  }
  throw Error('Free demo ended without a completed result.');
}

const referenceCheck = await fetch(refUrl, { method: 'HEAD', signal: AbortSignal.timeout(20000), redirect: 'error' });
if (!referenceCheck.ok) throw Error(`Approved reference is unavailable: HTTP ${referenceCheck.status}. No generation was submitted.`);
for (const cue of timeline.cues) {
  if (!/^intro-0[1-5]$/.test(cue.id)) throw Error('Unexpected intro cue.');
  const requestPath = join(dir, `${cue.id}.request.json`);
  const resultPath = join(dir, `${cue.id}.result.json`);
  const outputPath = join(dir, `${cue.id}.wav`);
  const source = { text: cue.text, language: cue.speech.some(x => x.lang === 'en') ? 'Auto' : 'Korean', referenceHash, model: 'Qwen3-TTS-12Hz-1.7B-Base' };
  let saved;
  if (await exists(requestPath)) {
    saved = JSON.parse(await readFile(requestPath, 'utf8'));
    if (JSON.stringify(saved.source) !== JSON.stringify(source)) throw Error(`Cue changed: ${cue.id}. Existing preview was preserved.`);
    if (await exists(outputPath) && await exists(resultPath)) { console.log(JSON.stringify({ cue: cue.id, status: 'already complete' })); continue; }
  }
  if (!saved?.eventId) {
    const response = await fetch(`${origin}/gradio_api/call/${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [
        { path: refUrl.href, url: refUrl.href, orig_name: 'dreamy-qwen-greeting.wav', meta: { _type: 'gradio.FileData' } },
        referenceRequest.text, source.text, source.language, false, '1.7B',
      ] }), signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw Error(`Free demo submission HTTP ${response.status}: ${(await response.text()).slice(0, 700)}`);
    const { event_id: eventId } = await response.json();
    if (!/^[a-zA-Z0-9_-]+$/.test(eventId ?? '')) throw Error('Missing generation event ID.');
    saved = { source, eventId, requestedAt: new Date().toISOString(), paidCredentialsUsed: false };
    await writeFile(requestPath, JSON.stringify(saved, null, 2));
  }
  console.log(JSON.stringify({ cue: cue.id, status: 'queued', eventId: saved.eventId }));
  const result = await finish(saved.eventId);
  await writeFile(resultPath, JSON.stringify({ source, result, completedAt: new Date().toISOString(), paidCredentialsUsed: false }, null, 2));
  if (!result?.[0]?.url) throw Error(`No audio for ${cue.id}: ${JSON.stringify(result)}`);
  const audioUrl = new URL(result[0].url);
  if (audioUrl.origin !== origin) throw Error('Unexpected generated audio origin.');
  const audio = await fetch(audioUrl, { signal: AbortSignal.timeout(30000), redirect: 'error' });
  if (!audio.ok) throw Error(`Generated audio HTTP ${audio.status}`);
  const bytes = Buffer.from(await audio.arrayBuffer());
  if (bytes.length > 30_000_000 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') throw Error('Expected a WAV smaller than 30MB.');
  await writeFile(outputPath, bytes);
  console.log(JSON.stringify({ cue: cue.id, status: 'complete', bytes: bytes.length }));
}
console.log('All five intro cues prepared with the approved synthetic voice reference.');
