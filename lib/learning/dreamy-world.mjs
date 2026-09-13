import * as THREE from 'three';
import { createMango, createWhale } from './dreamy-models.mjs';

const smooth = (a, b, t) => THREE.MathUtils.smoothstep(t, a, b);
const mix = THREE.MathUtils.lerp;
const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: .48 });
function shape(parent, geometry, material, xyz, scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...xyz); mesh.scale.set(...scale); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function label(text, color = '#385b56') {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
  const c = canvas.getContext('2d'); c.fillStyle = '#fffaf0'; c.fillRect(0, 0, 512, 512);
  c.font = 'bold 350px Arial'; c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 277);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: texture, roughness: .65 });
}
function tree() {
  const group = new THREE.Group(), bark = mat('#b87c4e'), greens = ['#70a76a', '#94ba74', '#b1cb80'].map(mat);
  shape(group, new THREE.CylinderGeometry(.10, .15, 1.35, 24), bark, [0, .7, 0]);
  const orb = new THREE.SphereGeometry(1, 32, 24);
  [[-.30, 1.42, 0, .53], [.30, 1.52, -.07, .56], [0, 1.88, 0, .56]].forEach(([x, y, z, s], i) => shape(group, orb, greens[i], [x, y, z], [s, s, s]));
  return group;
}
function book() {
  const group = new THREE.Group(), left = new THREE.Group(), right = new THREE.Group(); group.add(left, right);
  const covers = mat('#589b98'), pages = mat('#fff7df');
  for (const [wing, sign] of [[left, -1], [right, 1]]) {
    shape(wing, new THREE.BoxGeometry(1.15, .09, 1.45), covers, [sign * .58, 0, 0]);
    shape(wing, new THREE.BoxGeometry(1.06, .085, 1.34), pages, [sign * .58, .083, 0]);
    for (let i = 0; i < 3; i++) shape(wing, new THREE.BoxGeometry(.72, .008, .018), mat('#cfcca9'), [sign * .58, .13, -.34 + i * .15]);
  }
  return { group, left, right };
}

/** One real 3D set; all motion is deterministic so the film can be re-rendered locally. */
export function createDreamyWorld(canvas, { width = 1280, height = 720, timeline = null } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setSize(width, height, false); renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#f7f3e8'); scene.fog = new THREE.Fog('#f7f3e8', 15, 32);
  const camera = new THREE.PerspectiveCamera(34, width / height, .1, 60);
  scene.add(new THREE.HemisphereLight('#fff5dc', '#91a9a3', 2.1));
  const key = new THREE.DirectionalLight('#fff1d2', 3.4); key.position.set(-3, 7, 5); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -7; key.shadow.camera.right = 7; key.shadow.camera.top = 7; key.shadow.camera.bottom = -7; key.shadow.normalBias = .025; key.shadow.bias = -.0002; key.shadow.radius = 4; scene.add(key);
  const rim = new THREE.DirectionalLight('#deffff', 2); rim.position.set(4, 5, -3); scene.add(rim);
  const ground = shape(scene, new THREE.PlaneGeometry(200, 200), mat('#f2eee2'), [0, -.08, 0]); ground.rotation.x = -Math.PI / 2;
  const island = shape(scene, new THREE.CylinderGeometry(4, 3.8, .20, 96), mat('#dfdcc9'), [0, -.13, -.3], [1.25, 1, .64]);
  const mango = createMango(), whale = createWhale(); scene.add(mango.group, whale.group); whale.group.scale.setScalar(.83);
  const story = book(); scene.add(story.group); story.group.position.set(0, .7, .6);
  const storyTree = tree(); scene.add(storyTree);
  const letters = ['t', 'r', 'e', 'e'].map((text, i) => {
    const tile = shape(scene, new THREE.BoxGeometry(.63, .68, .18, 1, 1, 1), [mat('#f3cc78'), mat('#f3cc78'), mat('#f3cc78'), mat('#f3cc78'), label(text), mat('#f3cc78')], [-1.1 + i * .73, .65, 1.15]);
    return tile;
  });
  const sound = new THREE.Group(); scene.add(sound);
  for (let i = 0; i < 3; i++) {
    const ring = shape(sound, new THREE.TorusGeometry(.25 + i * .18, .025, 8, 48, Math.PI), mat('#72aeaa'), [0, 0, -i * .01]); ring.rotation.z = -Math.PI / 2;
  }
  const sparks = Array.from({ length: 14 }, (_, i) => {
    const star = shape(scene, new THREE.OctahedronGeometry(.055), mat(i % 2 ? '#e7b84f' : '#8dbdc0'), [0, 0, 0]); star.castShadow = false; return star;
  });
  function frame(time) {
    const duration = timeline?.durationSeconds ?? 31.5;
    const starts = timeline?.cues?.map(cue => cue.start) ?? [0, 6, 12, 18, 25];
    const ends = timeline?.cues?.map(cue => cue.end) ?? [6, 12, 18, 25, 31.5];
    const t = Math.min(duration, Math.max(0, time));
    const beat = Math.min(4, starts.filter(start => start <= t).length - 1);
    // Preserve each visual demonstration when narration length changes.
    const local = (t - starts[beat]) / (ends[beat] - starts[beat]) * [6, 6, 6, 7, 6.5][beat];
    mango.group.position.set(beat === 0 ? .35 : -1.8, 0, .3); mango.group.rotation.y = beat === 0 ? -.12 + Math.sin(t * .3) * .07 : .13;
    mango.animate(t, { mood: beat === 0 || beat === 4 ? 'wave' : beat === 3 && local > 4 ? 'happy' : 'talk' });
    whale.group.visible = beat > 0; whale.group.position.set(beat === 1 ? mix(6, 2.15, smooth(0, 2.4, local)) : 2.15, .3 + Math.sin(t * 1.4) * .05, -.25); whale.group.rotation.y = -.30;
    whale.animate(t, { mood: beat === 4 ? 'wave' : beat === 3 && local > 4 ? 'happy' : 'idle', walk: beat === 1 ? .8 : .1 });
    story.group.visible = beat === 1; story.group.rotation.set(.23, -.10 + Math.sin(t * .4) * .03, 0); story.group.scale.setScalar(.92);
    story.left.rotation.z = mix(-1.3, -.12, smooth(.2, 2.8, local)); story.right.rotation.z = -story.left.rotation.z;
    story.group.position.y = .55 + Math.sin(local * 1.6) * .025;
    storyTree.visible = beat === 1 || beat === 2; const pop = beat === 1 ? smooth(2, 4.2, local) : 1;
    storyTree.scale.setScalar(beat === 1 ? pop * .58 : .86); storyTree.position.set(0, beat === 1 ? .64 : 0, beat === 1 ? .40 : .2); storyTree.rotation.y = t * .08;
    sound.visible = beat === 2; sound.position.set(-.95, 1.45, 1.05); sound.scale.setScalar(.7 + Math.sin(t * 5) * .06);
    letters.forEach((tile, i) => {
      tile.visible = beat === 3;
      const settle = smooth(i * .4, 2.6 + i * .2, local);
      tile.position.set(mix([-1.15, .8, -.3, 1.3][i], -1.08 + i * .73, settle), mix(1.7 + (i % 2) * .25, .72, settle) + (local > 4 ? Math.sin((local - 4) * 3 - i * .5) * .10 : 0), .9);
      tile.rotation.set(mix(.2, 0, settle), mix((i - 1.5) * .3, 0, settle), mix((i - 1.5) * .22, 0, settle));
    });
    sparks.forEach((spark, i) => {
      spark.visible = beat === 4 || (beat === 3 && local > 4.2);
      const phase = local + i * .57; spark.position.set(Math.sin(i * 2.4) * 3.6, .7 + ((phase * .45) % 2.5), Math.cos(i * 1.8) * 1.2 - .4); spark.rotation.set(phase, phase * .5, 0); spark.scale.setScalar(.6 + Math.sin(phase) ** 2 * .5);
    });
    if (beat === 0) { camera.position.set(2.8 - local * .06, 2.65, 8.8 - local * .09); camera.lookAt(.05, 1.08, .15); }
    else { camera.position.set(1.7 - local * .035, 3.8, 11.4 - local * .035); camera.lookAt(0, 1.07, 0); }
    island.visible = beat !== 0;
    renderer.render(scene, camera);
    return { beat, local };
  }
  function portrait(happy = false) {
    scene.background = null; renderer.setClearColor(0, 0); ground.visible = false; island.visible = false;
    whale.group.visible = story.group.visible = storyTree.visible = sound.visible = false; letters.forEach(x => x.visible = false); sparks.forEach(x => x.visible = false);
    mango.group.position.set(0, 0, 0); mango.group.rotation.y = -.12; mango.animate(2, { mood: happy ? 'happy' : 'wave' });
    camera.position.set(.45, 1.3, 5.9); camera.lookAt(0, 1.2, 0); renderer.render(scene, camera);
  }
  return { renderer, scene, camera, frame, portrait };
}
