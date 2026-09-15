import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/desko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = process.cwd();
const output = path.join(root, 'public/learning/dreamy-friends.png');
const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script>
<script type="module">
import * as THREE from 'three';
import {createMango,createWhale} from '/lib/learning/dreamy-models.mjs';
const scene=new THREE.Scene();
scene.background=new THREE.Color('#f4f7ed');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(1200,1200);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.08;
document.body.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight('#fff6de','#abc8bf',2.15));
const key=new THREE.DirectionalLight('#fff0d6',3.0);key.position.set(-3,7,5);scene.add(key);
const fill=new THREE.DirectionalLight('#e1fbff',1.3);fill.position.set(4,4,-3);scene.add(fill);
const friends=new THREE.Group();scene.add(friends);
const mango=createMango();mango.animate(1.2,{mood:'wave'});mango.group.position.set(-.92,0,.12);mango.group.rotation.y=.12;friends.add(mango.group);
const whale=createWhale();whale.animate(1.2,{mood:'happy'});whale.group.position.set(1.14,.30,.26);whale.group.rotation.y=-.22;whale.group.scale.setScalar(.92);friends.add(whale.group);
function shadow(x,z,sx,sz){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');
  const g=c.createRadialGradient(128,128,6,128,128,125);g.addColorStop(0,'rgba(38,71,56,.23)');g.addColorStop(.35,'rgba(38,71,56,.12)');g.addColorStop(1,'rgba(38,71,56,0)');
  c.fillStyle=g;c.fillRect(0,0,256,256);
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(sx,sz),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false,toneMapped:false}));
  plane.rotation.x=-Math.PI/2;plane.position.set(x,.01,z);scene.add(plane);
}
shadow(-.92,.18,2.35,1.5);shadow(1.14,.1,2.55,1.7);
friends.updateMatrixWorld(true);
const box=new THREE.Box3().setFromObject(friends),center=box.getCenter(new THREE.Vector3());
const camera=new THREE.OrthographicCamera(-3,3,3,-3,.1,50);
camera.position.copy(center).add(new THREE.Vector3(0,1.20,9));camera.lookAt(center);camera.updateMatrixWorld(true);
const inverse=camera.matrixWorldInverse;const points=[];
for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new THREE.Vector3(x,y,z).applyMatrix4(inverse));
const xs=points.map(p=>p.x),ys=points.map(p=>p.y),size=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))*1.12;
camera.left=-size/2;camera.right=size/2;camera.top=size/2;camera.bottom=-size/2;camera.updateProjectionMatrix();
renderer.render(scene,camera);
window.png=renderer.domElement.toDataURL('image/png');window.ready=true;
</script>`;
const allowed = new Set(['lib/learning/dreamy-models.mjs','node_modules/three/build/three.module.js','node_modules/three/build/three.core.js']);
const server=http.createServer(async(req,res)=>{
  try{
    const relative=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).slice(1);
    if(!relative){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
    if(!allowed.has(relative)){res.writeHead(404).end();return;}
    res.setHeader('Content-Type','text/javascript');res.end(await fs.readFile(path.join(root,relative)));
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1200,height:1200}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.ready);
  if(errors.length)throw Error(errors.join('; '));
  const png=Buffer.from((await page.evaluate(()=>window.png)).split(',')[1],'base64');
  await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,png);
  console.log(JSON.stringify({output,width:1200,height:1200,bytes:png.length,pageErrors:errors}));
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
