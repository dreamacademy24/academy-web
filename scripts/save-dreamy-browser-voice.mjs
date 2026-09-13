// Save an already-generated official demo WAV. This never generates speech.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [id, address] = process.argv.slice(2);
if (!/^intro-0[3-5]$/.test(id || '')) throw new Error('Expected intro-03, intro-04, or intro-05.');
const url = new URL(address);
if (url.origin !== 'https://qwen-qwen3-tts.hf.space' || !/^\/gradio_api\/file=\/tmp\/gradio\/[a-f0-9]+\/audio\.wav$/.test(url.pathname) || url.search) {
  throw new Error('Expected an observed official Qwen generated WAV URL.');
}
const output = path.join(root, 'artifacts/free-voice/intro', `${id}.wav`);
try { await fs.access(output); throw new Error('Output already exists; refusing to overwrite.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const timeline = JSON.parse(await fs.readFile(path.join(root, 'scripts/dreamy-intro-timeline.json'), 'utf8'));
const cue = timeline.cues.find(c => c.id === id);
const referenceHash = createHash('sha256').update(await fs.readFile(path.join(root, 'artifacts/free-voice/dreamy-qwen-greeting.wav'))).digest('hex');
const response = await fetch(url, { signal: AbortSignal.timeout(30000), redirect: 'error' });
if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
const data = Buffer.from(await response.arrayBuffer());
if (data.length < 1000 || data.length > 2_000_000 || data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Invalid WAV download.');
const requestPath = output.replace(/\.wav$/, '.request.json');
let previousRequest;
try { previousRequest = JSON.parse(await fs.readFile(requestPath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await fs.writeFile(output, data, { flag: 'wx' });
const source = {text: cue.text, language: id === 'intro-03' ? 'Auto' : 'Korean', referenceHash, model: 'Qwen3-TTS-12Hz-1.7B-Base'};
const receipt = {source, method: 'official-demo-browser', authenticatedFreeAccount: true, useXVectorOnly: false, paidCredentialsUsed: false, savedAt: new Date().toISOString(), audioUrl: url.href, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex')};
await fs.writeFile(requestPath, JSON.stringify({...receipt, ...(previousRequest ? {previousRequest} : {})}, null, 2) + '\n');
await fs.writeFile(output.replace(/\.wav$/, '.result.json'), JSON.stringify(receipt, null, 2) + '\n', {flag:'wx'});
console.log(JSON.stringify({id, bytes:data.length, sha256:receipt.sha256, saved:output}));
