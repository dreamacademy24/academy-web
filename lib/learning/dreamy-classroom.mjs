import * as THREE from 'three';
import { createMango, createWhale } from './dreamy-models.mjs';

function contactShadow() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 62);
  gradient.addColorStop(0, 'rgba(31, 48, 20, .30)'); gradient.addColorStop(.4, 'rgba(31, 48, 20, .16)'); gradient.addColorStop(1, 'rgba(31, 48, 20, 0)');
  context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
  const map = new THREE.CanvasTexture(canvas);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.35), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false }));
  shadow.rotation.x = -Math.PI / 2; return shadow;
}
function floatingLight() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d'), gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 255, 233, .76)'); gradient.addColorStop(.4, 'rgba(237, 255, 218, .58)'); gradient.addColorStop(.68, 'rgba(206, 250, 225, .25)'); gradient.addColorStop(1, 'rgba(222, 255, 239, 0)');
  context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
  const group = new THREE.Group(), map = new THREE.CanvasTexture(canvas);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.45), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false }));
  glow.rotation.x = -Math.PI / 2; group.add(glow);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.62, .016, 8, 48), new THREE.MeshBasicMaterial({ color: '#efffe0', transparent: true, opacity: .62, depthWrite: false, toneMapped: false }));
  ring.rotation.x = -Math.PI / 2; ring.scale.y = .75; ring.position.y = .005; group.add(ring);
  return group;
}

/** A live, decorative classroom. This shares the app's approved character models. */
export function mountDreamyClassroom(canvas, { compact = false, onError = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = false;
  renderer.setClearColor(0, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(compact ? 30 : 32, 1, .1, 60);
  scene.add(new THREE.HemisphereLight('#fff8df', '#a1c3bc', 2.35));
  const key = new THREE.DirectionalLight('#fff0cc', 3.1); key.position.set(-3, 7, 5); scene.add(key);
  const fill = new THREE.DirectionalLight('#ddfbff', 1.3); fill.position.set(4, 4, -4); scene.add(fill);
  const mango = createMango(); scene.add(mango.group);
  const whale = compact ? null : createWhale(); if (whale) scene.add(whale.group);
  // The original cinematic set is composed behind this transparent live layer.
  // Soft contact shadows ground the moving models without covering the clearing.
  const mangoShadow = compact ? null : contactShadow(), whaleShadow = compact ? null : contactShadow();
  if (mangoShadow) scene.add(mangoShadow, whaleShadow);
  const magicLight = compact ? null : floatingLight(); if (magicLight) scene.add(magicLight);
  let disposed = false, visible = true, reduced = false, speaking = false, speakingBlend = 0, frameId = 0, last = 0, time = 0, stageY = 0;
  const mouth = mango.group.getObjectByName('gentle-smile');
  const arm = mango.group.getObjectByName('right-shoulder');
  function render(delta = 0) {
    if (disposed) return;
    time += reduced ? 0 : Math.min(delta, .05);
    speakingBlend += ((speaking ? 1 : 0) - speakingBlend) * (1 - Math.exp(-Math.max(delta, .025) * 9));
    mango.animate(reduced ? 1.2 : time, { mood: 'idle' });
    if (mouth) mouth.scale.y = 1 + Math.sin(time * 12) ** 2 * .5 * speakingBlend;
    if (arm) { arm.rotation.z += speakingBlend * (.32 + Math.sin(time * 3.6) * .08); arm.rotation.x -= speakingBlend * .18; }
    if (whale) { whale.animate(reduced ? 1.2 : time, { mood: 'idle' }); whale.group.position.y = stageY + .04 + (reduced ? 0 : Math.sin(time * 1.2) * .035); }
    if (magicLight) magicLight.scale.setScalar(reduced ? 1 : 1 + Math.sin(time * 1.2) * .025);
    try { renderer.render(scene, camera); } catch (error) { fail(error); }
  }
  function tick(now) {
    frameId = 0;
    if (disposed || !visible || reduced) return;
    const delta = last ? (now - last) / 1000 : 0;
    // Thirty stable updates per second are enough for this gentle decorative set.
    if (delta >= 1 / 30 || !last) { render(delta); last = now; }
    if (!disposed) frameId = requestAnimationFrame(tick);
  }
  function restart() {
    if (frameId) cancelAnimationFrame(frameId); frameId = 0; last = 0;
    if (!disposed && visible) { render(); if (!reduced) frameId = requestAnimationFrame(tick); }
  }
  function fail(error) { if (disposed) return; dispose(); onError(error); }
  const contextLost = event => { event.preventDefault(); fail(new Error('WebGL context lost')); };
  canvas.addEventListener('webglcontextlost', contextLost);
  function resize(width, height, pixelRatio = 1) {
    if (disposed || width < 1 || height < 1) return;
    const aspect = width / height, portrait = aspect < .95;
    renderer.setPixelRatio(Math.min(pixelRatio, compact ? 1.5 : 1.25)); renderer.setSize(width, height, false);
    camera.aspect = aspect;
    if (compact) {
      camera.position.set(.15, 1.3, Math.max(5.3, 3.7 / aspect)); camera.lookAt(0, 1.2, 0);
      mango.group.position.set(0, 0, 0); mango.group.rotation.y = -.12;
    } else {
      camera.position.set(0, 3.45, 10.6); camera.lookAt(0, portrait ? -.12 : .8, 0);
      const halfWidth = Math.tan(THREE.MathUtils.degToRad(16)) * 10.6 * aspect;
      const anchor = portrait ? 0 : -halfWidth * .28;
      stageY = portrait ? 0 : -.52;
      mango.group.position.set(anchor, stageY, .6); mango.group.rotation.y = -.12;
      whale.group.visible = !portrait; whale.group.position.set(anchor + 1.65, stageY + .04, -.02); whale.group.rotation.y = -.34; whale.group.scale.setScalar(.78);
      mangoShadow.position.set(anchor, stageY - .025, .6); mangoShadow.visible = !portrait;
      whaleShadow.position.set(anchor + 1.65, stageY - .03, -.02); whaleShadow.visible = !portrait;
      magicLight.position.set(anchor, -.08, .6); magicLight.visible = portrait;
    }
    camera.updateProjectionMatrix(); render();
  }
  function dispose() {
    if (disposed) return; disposed = true; if (frameId) cancelAnimationFrame(frameId);
    canvas.removeEventListener('webglcontextlost', contextLost);
    const geometries = new Set(), materials = new Set(), textures = new Set();
    scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      for (const surface of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) {
        materials.add(surface); for (const value of Object.values(surface)) if (value?.isTexture) textures.add(value);
      }
    });
    textures.forEach(texture => texture.dispose()); materials.forEach(surface => surface.dispose()); geometries.forEach(geometry => geometry.dispose());
    renderer.dispose(); renderer.forceContextLoss();
  }
  return {
    resize,
    setSpeaking(value) { speaking = Boolean(value); if (reduced) render(); },
    setVisible(value) { visible = Boolean(value); restart(); },
    setReducedMotion(value) { reduced = Boolean(value); restart(); },
    dispose,
  };
}
