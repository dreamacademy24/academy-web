import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// A single, unauthenticated preview using the official public ZeroGPU demo.
// No paid credentials, subscriptions, reference uploads, or automatic retries.
const origin = 'https://qwen-qwen3-tts.hf.space';
const endpoint = 'generate_voice_design';
const outputDirectory = fileURLToPath(new URL('../artifacts/free-voice/', import.meta.url));
const text = '안녕! 나는 드림이야. 나랑 같이 영어 모험을 떠나 볼까? 잘 듣고, 함께 말해 봐!';
const instruction = 'A bright, youthful female animated character voice, cheerful, playful, smiling and warmly encouraging. Speak natural native Korean with clear articulation at a NORMAL conversational pace, not slow. Express genuine curiosity and excitement with varied melodic intonation. A sweet light voice with a natural rounded tone, not shrill or artificially squeaky. Short natural pauses. No music or sound effects.';
const request = { data: [text, 'Korean', instruction] };

await mkdir(outputDirectory, { recursive: true });
await writeFile(join(outputDirectory, 'qwen-greeting-request.json'), JSON.stringify({
  provider: 'Official Qwen Hugging Face Space, unauthenticated free quota',
  endpoint, model: 'Qwen3-TTS-12Hz-1.7B-VoiceDesign', text, language: 'Korean', instruction,
  requestedAt: new Date().toISOString(),
}, null, 2));

const response = await fetch(`${origin}/gradio_api/call/${endpoint}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(request), signal: AbortSignal.timeout(20000),
});
if (!response.ok) throw new Error(`Free demo submission failed: HTTP ${response.status}: ${(await response.text()).slice(0,700)}`);
const { event_id: eventId } = await response.json();
if (!/^[a-zA-Z0-9_-]+$/.test(eventId ?? '')) throw new Error('Free demo did not return a valid event ID.');
console.log(JSON.stringify({ status: 'queued', eventId, paidCredentialsUsed: false }));

const events = await fetch(`${origin}/gradio_api/call/${endpoint}/${eventId}`, {
  headers: { Accept: 'text/event-stream' }, signal: AbortSignal.timeout(180000),
});
if (!events.ok || !events.body) throw new Error(`Free demo events failed: HTTP ${events.status}`);
let buffer = '';
let result;
for await (const chunk of events.body) {
  buffer += Buffer.from(chunk).toString('utf8').replaceAll('\r\n', '\n');
  let end;
  while ((end = buffer.indexOf('\n\n')) !== -1) {
    const block = buffer.slice(0, end);
    buffer = buffer.slice(end + 2);
    const type = block.match(/^event: (.+)$/m)?.[1];
    const value = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (type === 'error') throw new Error(`Official free demo error: ${value.slice(0,1000)}`);
    if (type === 'complete') { result = JSON.parse(value); break; }
    if (type && type !== 'heartbeat') console.log(JSON.stringify({ status: type }));
  }
  if (result) break;
}
if (!Array.isArray(result) || !result[0]?.url) throw new Error(`Free demo returned no audio: ${JSON.stringify(result)}`);
const audioUrl = new URL(result[0].url);
if (audioUrl.origin !== origin) throw new Error('Unexpected audio origin; download was not attempted.');
const audio = await fetch(audioUrl, { signal: AbortSignal.timeout(30000), redirect: 'error' });
if (!audio.ok) throw new Error(`Generated audio retrieval failed: HTTP ${audio.status}`);
const bytes = Buffer.from(await audio.arrayBuffer());
if (bytes.length > 30_000_000 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Expected a WAV audio preview of less than 30 MB.');
const outputPath = join(outputDirectory, 'dreamy-qwen-greeting.wav');
await writeFile(outputPath, bytes);
await writeFile(join(outputDirectory, 'qwen-greeting-result.json'), JSON.stringify({ status: result[1], audioUrl: audioUrl.href, outputPath, bytes: bytes.length, paidCredentialsUsed: false }, null, 2));
console.log(JSON.stringify({ status: 'complete', outputPath, bytes: bytes.length, paidCredentialsUsed: false }));
