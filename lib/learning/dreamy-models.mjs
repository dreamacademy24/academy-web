import * as THREE from 'three';

// Character space: +Y up, +Z toward the child. Meshes are self-contained.
const TAU = Math.PI * 2;
const sphere = new THREE.SphereGeometry(1, 40, 28);
const smallSphere = new THREE.SphereGeometry(1, 24, 16);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const color = (hex) => new THREE.Color(hex);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

function material(hex, roughness = .45, extra = {}) {
  return new THREE.MeshStandardMaterial({ color: hex, roughness, metalness: 0, ...extra });
}

function mesh(geometry, mat, parent, name) {
  const object = new THREE.Mesh(geometry, mat);
  object.name = name;
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function pebble(parent, mat, position, scale, name, geometry = smallSphere) {
  const object = mesh(geometry, mat, parent, name);
  object.position.set(...position);
  object.scale.set(...scale);
  return object;
}

function stroke(parent, points, radius, mat, name) {
  const path = new THREE.CatmullRomCurve3(points.map((point) => v3(...point)));
  return mesh(new THREE.TubeGeometry(path, 32, radius, 8, false), mat, parent, name);
}

// Rounded, closed cross sections give leaves and fins actual thickness.
function softBlade(points, widths, thicknesses, normalHint = v3(0, 1, 0), tint) {
  const path = new THREE.CatmullRomCurve3(points.map((point) => v3(...point)));
  const along = 24, around = 12;
  const positions = [], colors = [], indices = [];
  const mix = (values, t) => {
    const at = Math.min(values.length - 1.00001, t * (values.length - 1));
    const i = Math.floor(at);
    return THREE.MathUtils.lerp(values[i], values[Math.min(i + 1, values.length - 1)], at - i);
  };
  for (let row = 0; row <= along; row++) {
    const t = row / along;
    const center = path.getPoint(t);
    const tangent = path.getTangent(t).normalize();
    const widthAxis = new THREE.Vector3().crossVectors(tangent, normalHint).normalize();
    const normal = new THREE.Vector3().crossVectors(widthAxis, tangent).normalize();
    for (let side = 0; side <= around; side++) {
      const angle = side / around * TAU;
      const point = center.clone()
        .addScaledVector(widthAxis, Math.sin(angle) * mix(widths, t))
        .addScaledVector(normal, Math.cos(angle) * mix(thicknesses, t));
      positions.push(point.x, point.y, point.z);
      if (tint) {
        const c = tint(t, Math.cos(angle));
        colors.push(c.r, c.g, c.b);
      }
    }
  }
  for (let row = 0; row < along; row++) for (let side = 0; side < around; side++) {
    const a = row * (around + 1) + side, b = a + around + 1;
    indices.push(a, a + 1, b, b, a + 1, b + 1);
  }
  // The tiny end rings are capped rather than left open.
  for (let i = 1; i < around - 1; i++) {
    indices.push(0, i + 1, i);
    const end = along * (around + 1);
    indices.push(end, end + i, end + i + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (tint) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function eyes(parent, positions, size, dark, white) {
  return positions.map((point, i) => {
    const eye = new THREE.Group();
    eye.name = i ? 'eye-right' : 'eye-left';
    eye.position.set(...point);
    parent.add(eye);
    pebble(eye, dark, [0, 0, 0], [size, size * 1.24, size * .6], 'polished-eye');
    pebble(eye, white, [-size * .24, size * .35, size * .51], [size * .22, size * .22, size * .1], 'eye-catchlight');
    pebble(eye, white, [size * .27, -size * .25, size * .57], [size * .09, size * .09, size * .05], 'small-catchlight');
    return eye;
  });
}

function blinkAt(time, offset = 0) {
  const phase = ((time + offset) % 5.8 + 5.8) % 5.8;
  return phase < .2 ? .09 + .91 * Math.abs(phase / .1 - 1) : 1;
}

function groundRig(group, rig) {
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(rig);
  rig.position.y -= bounds.min.y;
  return rig.position.y;
}

export function createMango() {
  const group = new THREE.Group(); group.name = 'Dreamy-the-mango';
  const rig = new THREE.Group(); rig.name = 'mango-rig'; group.add(rig);
  const skin = material('#ffffff', .43, { vertexColors: true });
  const gold = material('#ffc440', .48);
  const feetMaterial = material('#f7ae38', .5);
  const dark = material('#343236', .18);
  const smileMaterial = material('#865329', .55);
  const white = material('#fffdf3', .2);
  const blush = material('#ed9075', .58);
  const stemMaterial = material('#977043', .58);
  const leafMaterial = material('#ffffff', .43, { vertexColors: true });
  const veinMaterial = material('#8cba4d', .5);
  const cream = color('#ffe779'), sunny = color('#ffc640'), orange = color('#f1a442');

  const bodyGeometry = new THREE.SphereGeometry(1, 64, 48);
  const position = bodyGeometry.attributes.position;
  const shades = [];
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const width = .70 * (1 - .1 * y + .065 * (1 - y * y));
    // A gentle bent tip and fuller left cheek create the mango silhouette.
    const bend = .09 * y + .115 * y * y - .045;
    position.setXYZ(i, x * width + bend, y * .91, z * (.5 + .045 * (1 - y * y)));
    const light = clamp((y + 1) * .5, 0, 1);
    const c = orange.clone().lerp(sunny, .3 + light * .7).lerp(cream, light * .47);
    const warmCheek = Math.max(0, x) * Math.max(0, -y + .15) * .24;
    c.lerp(orange, warmCheek);
    shades.push(c.r, c.g, c.b);
  }
  bodyGeometry.setAttribute('color', new THREE.Float32BufferAttribute(shades, 3));
  bodyGeometry.computeVertexNormals();
  const body = mesh(bodyGeometry, skin, rig, 'asymmetric-mango-body');
  body.position.y = 1.11;

  const face = new THREE.Group(); face.name = 'mango-face'; rig.add(face);
  const eyeParts = eyes(face, [[-.22, 1.29, .511], [.24, 1.29, .505]], .077, dark, white);
  const mouth = stroke(face, [[-.115, 1.075, .55], [-.06, 1.045, .56], [0, 1.035, .565], [.07, 1.05, .56], [.12, 1.086, .548]], .0125, smileMaterial, 'gentle-smile');
  // Local pivot lets speech animate the smile without shifting its anchor.
  mouth.geometry.translate(0, -1.06, -.553);
  mouth.position.set(0, 1.06, .553);
  pebble(face, blush, [-.37, 1.08, .488], [.087, .039, .012], 'left-cheek');
  pebble(face, blush, [.37, 1.08, .451], [.087, .039, .012], 'right-cheek');
  stroke(face, [[-.3, 1.46, .449], [-.24, 1.48, .459], [-.18, 1.468, .467]], .009, smileMaterial, 'left-brow');
  stroke(face, [[.18, 1.468, .464], [.24, 1.48, .457], [.3, 1.46, .446]], .009, smileMaterial, 'right-brow');

  const arms = [-1, 1].map((side) => {
    const pivot = new THREE.Group(); pivot.name = side < 0 ? 'left-shoulder' : 'right-shoulder';
    pivot.position.set(side * .61, 1.22, .035); rig.add(pivot);
    const armGeometry = softBlade([[0, 0, 0], [side * .07, -.18, .045], [side * .11, -.35, .12]], [.09, .12, .02], [.085, .105, .018], v3(0, 0, 1));
    mesh(armGeometry, gold, pivot, 'soft-arm');
    pebble(pivot, gold, [side * .1, -.345, .119], [.112, .115, .104], 'mitten-hand');
    return pivot;
  });
  const feet = [-1, 1].map((side) => {
    const pivot = new THREE.Group(); pivot.name = side < 0 ? 'left-foot' : 'right-foot';
    pivot.position.set(side * .235, .13, .095); rig.add(pivot);
    pebble(pivot, feetMaterial, [0, 0, .085], [.225, .13, .29], 'soft-foot');
    return pivot;
  });

  const foliage = new THREE.Group(); foliage.name = 'leaf-hair'; foliage.position.set(.145, 1.995, -.02); rig.add(foliage);
  stroke(foliage, [[0, -.015, 0], [.012, .06, 0], [.035, .11, .005]], .043, stemMaterial, 'short-stem');
  const leafTint = (t, facing) => color('#397749').lerp(color('#75ad4c'), .27 + t * .34 + Math.max(0, facing) * .18);
  const mainLeaf = mesh(softBlade([[.02, .07, 0], [.18, .22, .065], [.38, .30, .115], [.53, .25, .16]], [.014, .145, .115, .003], [.009, .035, .028, .002], v3(0, 0, 1), leafTint), leafMaterial, foliage, 'curled-main-leaf');
  stroke(foliage, [[.02, .07, .012], [.18, .22, .099], [.38, .30, .142], [.52, .25, .162]], .009, veinMaterial, 'leaf-center-vein');
  mesh(softBlade([[.025, .075, -.012], [-.10, .2, -.025], [-.245, .245, -.09]], [.01, .095, .002], [.008, .025, .002], v3(0, 0, 1), leafTint), leafMaterial, foliage, 'little-back-leaf');
  mainLeaf.receiveShadow = true;
  const baseY = groundRig(group, rig);

  function animate(timeSeconds, options = {}) {
    const t = Number.isFinite(timeSeconds) ? timeSeconds : 0;
    const mood = options.mood || 'idle';
    const walk = clamp(Number(options.walk) || 0, 0, 1);
    const wave = mood === 'wave', happy = mood === 'happy', talk = mood === 'talk';
    const breath = Math.sin(t * 2.1) * .008;
    rig.position.y = baseY + (happy ? Math.abs(Math.sin(t * 4.6)) * .13 : (1 + Math.sin(t * 2.1)) * .006) + Math.abs(Math.sin(t * 7)) * walk * .045;
    rig.rotation.z = Math.sin(t * (happy ? 3.5 : 1.5)) * (happy ? .045 : .018) * (1 - walk * .5);
    body.scale.set(1 - breath * .32, 1 + breath, 1 - breath * .25);
    face.position.y = breath * .75;
    mouth.scale.y = happy ? 1.22 : talk ? 1 + Math.sin(t * 13) ** 2 * .55 : 1;
    foliage.rotation.z = Math.sin(t * 2.1 + .4) * .065;
    foliage.rotation.x = Math.sin(t * 1.7) * .04;
    const blink = blinkAt(t, 1.7);
    eyeParts.forEach((eye) => { eye.scale.y = blink * (happy ? .88 : 1); });
    arms.forEach((arm, i) => {
      const side = i ? 1 : -1;
      arm.rotation.z = side * (.17 + (happy ? .88 + Math.sin(t * 4) * .13 : .02 * Math.sin(t * 2)));
      arm.rotation.x = -.08 + Math.sin(t * 7 + i * Math.PI) * walk * .45;
      if (wave && i === 1) { arm.rotation.z = 2.03 + Math.sin(t * 7.4) * .22; arm.rotation.x = -.13; }
      feet[i].rotation.x = Math.sin(t * 7 + i * Math.PI) * walk * .28;
      feet[i].position.y = .13 + Math.max(0, Math.sin(t * 7 + i * Math.PI)) * walk * .09;
    });
  }
  return { group, animate };
}

function whalePoint(x, y, z) {
  return v3(x * (.83 + z * .09), .65 + y * (.49 - z * .025), z * 1.07 - .045);
}

function starGeometry() {
  const outline = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 2 + i * Math.PI / 5;
    const radius = i % 2 ? .021 : .046;
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    if (i) outline.lineTo(x, y); else outline.moveTo(x, y);
  }
  outline.closePath();
  return new THREE.ExtrudeGeometry(outline, { depth: .005, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .003, bevelThickness: .002, curveSegments: 8 });
}

export function createWhale() {
  const group = new THREE.Group(); group.name = 'Dreamy-whale-shark-friend';
  const rig = new THREE.Group(); rig.name = 'whale-rig'; group.add(rig);
  const shell = material('#ffffff', .4, { vertexColors: true });
  const finMaterial = material('#468c96', .47);
  const finTip = material('#73b2b6', .45);
  const dark = material('#283e48', .19);
  const white = material('#fffdf3', .23);
  const spotsMaterial = material('#d5eee5', .52);
  const smileMaterial = material('#35616b', .56);
  const blush = material('#b7d7c9', .56);
  const sea = color('#397c8a'), aqua = color('#69a8af'), belly = color('#f5efdc');
  const geometry = new THREE.SphereGeometry(1, 64, 40);
  const position = geometry.attributes.position, shades = [];
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const point = whalePoint(x, y, z);
    position.setXYZ(i, point.x, point.y, point.z);
    const c = sea.clone().lerp(aqua, clamp((z + 1) * .24 + (1 - y) * .15, 0, 1));
    c.lerp(belly, THREE.MathUtils.smoothstep(-y, .25, .57));
    shades.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(shades, 3));
  geometry.computeVertexNormals();
  mesh(geometry, shell, rig, 'wide-soft-whale-body');

  const face = new THREE.Group(); face.name = 'whale-face'; rig.add(face);
  const eyeParts = eyes(face, [[-.43, .754, .858], [.43, .754, .858]], .063, dark, white);
  const mouth = stroke(face, [[-.28, .61, .956], [-.16, .578, .999], [0, .567, 1.023], [.16, .578, .999], [.28, .61, .956]], .012, smileMaterial, 'whale-smile');
  mouth.geometry.translate(0, -.59, -1);
  mouth.position.set(0, .59, 1);
  pebble(face, blush, [-.53, .63, .825], [.073, .027, .014], 'whale-left-cheek');
  pebble(face, blush, [.53, .63, .825], [.073, .027, .014], 'whale-right-cheek');

  // Paired pectoral fins sweep backward; the tip is a soft paddle, not a spike.
  const fins = [-1, 1].map((side) => {
    const pivot = new THREE.Group(); pivot.name = side < 0 ? 'left-pectoral' : 'right-pectoral';
    pivot.position.set(side * .64, .48, .02); rig.add(pivot);
    mesh(softBlade([[0, 0, 0], [side * .30, -.04, -.09], [side * .53, -.12, -.28], [side * .62, -.135, -.40]], [.12, .215, .145, .009], [.067, .08, .045, .008]), finMaterial, pivot, 'pectoral-fin');
    return pivot;
  });
  mesh(softBlade([[0, 1.045, -.30], [0, 1.26, -.43], [0, 1.42, -.59]], [.18, .14, .01], [.065, .064, .01], v3(1, 0, 0)), finMaterial, rig, 'rounded-dorsal-fin');

  const tail = new THREE.Group(); tail.name = 'tail-pivot'; tail.position.set(0, .65, -.99); rig.add(tail);
  pebble(tail, finMaterial, [0, -.025, -.16], [.18, .165, .35], 'tail-peduncle', sphere);
  mesh(softBlade([[0, 0, -.32], [0, .25, -.49], [0, .53, -.68], [0, .60, -.76]], [.115, .17, .09, .008], [.085, .06, .033, .006], v3(1, 0, 0)), finMaterial, tail, 'upper-tail-fluke');
  mesh(softBlade([[0, -.035, -.33], [0, -.22, -.49], [0, -.34, -.69]], [.105, .135, .008], [.072, .052, .006], v3(1, 0, 0)), finTip, tail, 'lower-tail-fluke');

  const markings = new THREE.Group(); markings.name = 'whale-star-markings'; rig.add(markings);
  const dotGeometry = new THREE.SphereGeometry(1, 12, 8);
  const star = starGeometry();
  const placeMark = (nx, nz, size, isStar = false) => {
    const ny = Math.sqrt(Math.max(0, 1 - nx * nx - nz * nz));
    const point = whalePoint(nx, ny, nz);
    const normal = v3(nx / (.83 + nz * .09), ny / (.49 - nz * .025), nz / 1.07).normalize();
    const dot = mesh(isStar ? star : dotGeometry, spotsMaterial, markings, isStar ? 'soft-star' : 'whale-spot');
    dot.position.copy(point.addScaledVector(normal, .008));
    dot.quaternion.setFromUnitVectors(v3(0, 0, 1), normal);
    if (isStar) dot.scale.setScalar(size); else dot.scale.set(size, size * .85, .008);
    dot.castShadow = false;
  };
  for (let row = 0; row < 5; row++) {
    const z = -.68 + row * .28;
    for (let col = -2; col <= 2; col++) {
      const x = col * .255 + (row % 2 ? .055 : -.025);
      if (x * x + z * z < .9) placeMark(x, z, .019 + ((row + col + 6) % 3) * .004);
    }
  }
  placeMark(-.25, .66, .92, true);
  placeMark(.21, .69, .76, true);
  placeMark(.05, -.08, .9, true);
  const baseY = groundRig(group, rig);

  function animate(timeSeconds, options = {}) {
    const t = Number.isFinite(timeSeconds) ? timeSeconds : 0;
    const mood = options.mood || 'idle';
    const walk = clamp(Number(options.walk) || 0, 0, 1);
    const happy = mood === 'happy', wave = mood === 'wave', talk = mood === 'talk';
    const speed = 1.8 + walk * 3;
    rig.position.y = baseY + (1 + Math.sin(t * speed)) * (happy ? .055 : .024);
    rig.rotation.z = Math.sin(t * speed * .7) * (happy ? .08 : .025);
    rig.rotation.x = Math.sin(t * speed * .8) * .025;
    rig.scale.set(1 + Math.sin(t * 1.8) * .003, 1 + Math.sin(t * 1.8) * .009, 1);
    tail.rotation.y = Math.sin(t * (3.3 + walk * 3)) * (.19 + walk * .14);
    tail.rotation.z = Math.sin(t * 2.1) * .04;
    fins.forEach((fin, i) => {
      const side = i ? 1 : -1;
      fin.rotation.z = side * (Math.sin(t * speed + .3) * .13 + (happy ? .15 : 0));
      fin.rotation.x = Math.sin(t * speed + i * .5) * .07;
      if (wave && i === 1) fin.rotation.z = .5 + Math.sin(t * 6.5) * .2;
    });
    const blink = blinkAt(t, 3.1);
    eyeParts.forEach((eye) => { eye.scale.y = blink * (happy ? .9 : 1); });
    mouth.scale.y = talk ? 1 + Math.sin(t * 12) ** 2 * .65 : happy ? 1.2 : 1;
  }
  return { group, animate };
}
