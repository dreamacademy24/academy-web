import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/desko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sharp = require('sharp');
const root = process.cwd(), out = path.join(root, 'public/learning/tree-house'), artifacts = path.join(root, 'artifacts/learning');
await fs.mkdir(artifacts, { recursive: true });
const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#f7f3e8}canvas{display:block;width:1280px;height:720px}#gl{display:none}</style><canvas id="gl"></canvas><canvas id="film" width="1280" height="720"></canvas><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script><script type="module">
import {createDreamyWorld} from '/lib/learning/dreamy-world.mjs';
const timeline=await (await fetch('/scripts/dreamy-intro-timeline.json')).json();
const world = createDreamyWorld(document.querySelector('#gl'),{timeline});
const film=document.querySelector('#film'), c=film.getContext('2d');
const titles=['안녕! 나는 드림이야.','이야기 속으로, 함께!','듣고, 나도 말해봐요.','써보고, 게임으로 확인!','이제 나의 모험을 시작해요.'];
const subtitles=['HELLO, DREAMY','01 · STORY','02 · LISTEN & SPEAK','03 · WRITE & PLAY','YOUR OWN ADVENTURE'];
window.draw=(time,capture=true)=>{const {beat,local}=world.frame(time);c.drawImage(world.renderer.domElement,0,0);c.save();c.globalAlpha=Math.min(1,local*3+.1);c.fillStyle='#6b8581';c.font='600 14px Arial';c.fillText('D R E A M   L E A R N I N G',64,51);c.fillStyle='#375951';c.font='bold 36px "Malgun Gothic",sans-serif';c.fillText(titles[beat],64,116);c.fillStyle='#7b918a';c.font='600 14px Arial';c.fillText(subtitles[beat],66,147);c.restore();if(beat>0&&beat<4){const labels=['이야기','듣고 말하기','쓰고 게임하기'];for(let i=0;i<3;i++){c.fillStyle=i===beat-1?'#466e63':'#b4bdb0';c.beginPath();c.arc(1050+i*65,48,4,0,Math.PI*2);c.fill();}}return capture?film.toDataURL('image/png'):null;};
window.portrait=(happy)=>{world.portrait(happy);return world.renderer.domElement.toDataURL('image/png');};
window.record=async()=>{
  const ac=new AudioContext();await ac.resume();const dest=ac.createMediaStreamDestination();
  const buffers=await Promise.all(timeline.cues.map(async cue=>ac.decodeAudioData(await (await fetch(cue.audioSrc)).arrayBuffer())));
  for(const cue of timeline.cues)window.draw(cue.start+.1,false);window.draw(0,false);await new Promise(resolve=>requestAnimationFrame(resolve));
  const stream=film.captureStream(30);dest.stream.getAudioTracks().forEach(track=>stream.addTrack(track));
  const choices=['video/mp4;codecs=avc1.42001f,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus'];const mime=choices.find(x=>MediaRecorder.isTypeSupported(x));if(!mime)throw Error('No video encoder available');
  const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:5500000,audioBitsPerSecond:128000});const chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  const finished=new Promise((resolve,reject)=>{recorder.onerror=reject;recorder.onstop=resolve;});recorder.start(1000);const start=ac.currentTime+.02;
  buffers.forEach((buffer,i)=>{const src=ac.createBufferSource();src.buffer=buffer;src.connect(dest);src.start(start+timeline.cues[i].audioStart);});
  // Quiet, original bell tones mark steps; narration stays in the foreground.
  timeline.cues.map(cue=>cue.start).forEach((at,i)=>{const osc=ac.createOscillator(),gain=ac.createGain();osc.type='sine';osc.frequency.value=[523.25,659.25,587.33,783.99,1046.5][i];gain.gain.setValueAtTime(0,start+at);gain.gain.linearRampToValueAtTime(.025,start+at+.025);gain.gain.exponentialRampToValueAtTime(.001,start+at+.8);osc.connect(gain).connect(dest);osc.start(start+at);osc.stop(start+at+.85);});
  await new Promise(resolve=>{function loop(){const t=Math.max(0,ac.currentTime-start);window.draw(t,false);if(t<timeline.durationSeconds)requestAnimationFrame(loop);else resolve();}loop();});recorder.stop();await finished;stream.getTracks().forEach(x=>x.stop());await ac.close();
  const blob=new Blob(chunks,{type:mime});const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return {base64:btoa(binary),mime,duration:timeline.durationSeconds};
};window.draw(2);window.ready=true;
</script>`;
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1'), relative = decodeURIComponent(url.pathname).slice(1);
    if (!relative) { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); return; }
    const base = relative.startsWith('learning/') ? path.join(root, 'public') : root;
    const file = path.resolve(base, relative);
    if (!file.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
    const ext = path.extname(file); res.setHeader('Content-Type', ({'.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.wav':'audio/wav'})[ext] || 'application/octet-stream'); res.end(await fs.readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required','--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage({viewport:{width:1280,height:720}}); page.on('pageerror', e => console.error(e.message));
  await page.goto('http://127.0.0.1:' + server.address().port); await page.waitForFunction(() => window.ready);
  for (const time of [2,9,15,22,28]) { const data=await page.evaluate(t=>window.draw(t),time);await fs.writeFile(path.join(artifacts,'intro-frame-'+time+'.png'),Buffer.from(data.split(',')[1],'base64')); }
  const poster = await page.evaluate(()=>window.draw(2)); await sharp(Buffer.from(poster.split(',')[1],'base64')).webp({quality:90}).toFile(path.join(out,'dreamy-intro-poster.webp'));
  for(const happy of [false,true]){const image=await page.evaluate(value=>window.portrait(value),happy);await sharp(Buffer.from(image.split(',')[1],'base64')).trim().resize({height:400}).webp({quality:93}).toFile(path.join(out,happy?'dreamy-happy.webp':'dreamy-wave.webp'));}
  if(process.argv.includes('--frames-only')) { console.log('Frames and portraits rendered.'); }
  else { await page.reload();await page.waitForFunction(()=>window.ready);const video=await page.evaluate(()=>window.record());const ext=video.mime.startsWith('video/mp4')?'mp4':'webm';await fs.writeFile(path.join(out,'dreamy-intro.'+ext),Buffer.from(video.base64,'base64'));console.log(JSON.stringify({file:'dreamy-intro.'+ext,mime:video.mime,duration:video.duration,bytes:Buffer.from(video.base64,'base64').length})); }
} finally { await browser.close();await new Promise(resolve=>server.close(resolve)); }
