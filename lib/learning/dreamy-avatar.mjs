import * as THREE from 'three';
import { createMango } from './dreamy-models.mjs';

export function mountDreamy(canvas, options = {}) {
  const renderer = new THREE.WebGLRenderer({canvas, alpha:true, antialias:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, .1, 20), mango = createMango(); scene.add(mango.group);
  scene.add(new THREE.HemisphereLight('#fff5db', '#91a9a3', 2.1));
  const sun = new THREE.DirectionalLight('#fff1d2', 3.4); sun.position.set(-3, 7, 5); scene.add(sun);
  const rim = new THREE.DirectionalLight('#deffff', 2); rim.position.set(4, 5, -3); scene.add(rim);
  camera.position.set(.35, 1.4, 5.1); camera.lookAt(0, 1.2, 0);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)'); let tick=0, disposed=false, hover=false, running=true;
  function draw(t=0) {
    mango.animate(t, { mood:options.happy?'happy':'wave' }); mango.group.rotation.y=-.12+(hover?.2:0); renderer.render(scene,camera);
  }
  function loop(now) { if(disposed)return; if(running&&!document.hidden&&!reduced.matches&&options.motion!==false)draw(now/1000); tick=requestAnimationFrame(loop); }
  const observer = new ResizeObserver(() => {const width=canvas.clientWidth||100,height=canvas.clientHeight||130;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();draw(2);});observer.observe(canvas);
  const visible = new IntersectionObserver(entries=>{running=entries[0]?.isIntersecting===true;});visible.observe(canvas);
  const enter=()=>{hover=true;draw(2);},leave=()=>{hover=false;draw(2);};canvas.addEventListener('pointerenter',enter);canvas.addEventListener('pointerleave',leave);
  const lost=event=>{event.preventDefault();options.onError?.();};canvas.addEventListener('webglcontextlost',lost);
  draw(2);tick=requestAnimationFrame(loop);
  return () => {disposed=true;cancelAnimationFrame(tick);observer.disconnect();visible.disconnect();canvas.removeEventListener('pointerenter',enter);canvas.removeEventListener('pointerleave',leave);canvas.removeEventListener('webglcontextlost',lost);const geometries=new Set(),materials=new Set();scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)(Array.isArray(object.material)?object.material:[object.material]).forEach(m=>materials.add(m));});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();};
}
