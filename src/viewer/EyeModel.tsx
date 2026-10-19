import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useLab } from '../app/LabContext';
import { effectiveColourBy, effectiveMode, effectiveSlice, effectiveVision, focusIds, highlightedIds, isVisible } from '../app/state';
import type { AnatomicalStructure } from '../contract/schema';
import { modeBounds, optics } from '../eye/anchors';
import { muscleActivity, type MuscleId } from '../eye/gaze';
import { visionState } from '../eye/vision';
import { baseColour, cutColour, HIGHLIGHT, HOVER, IRIS_COLOURS, realLook, realOpacity } from './palette';
import { closeHoles } from './closeHoles';
import { applyQuality, hasTissueData, makeTissueMaterial, quality, type TissueMaterial } from './tissue';
import { eyePose } from './pose';

export const MODEL_URL = `${import.meta.env.BASE_URL}models/eye.glb`;

const GREY = new THREE.Color('#a59a96');
const HIGHLIGHT_COLOUR = new THREE.Color(HIGHLIGHT);
const ACTIVE_COLOUR = new THREE.Color('#ff5a3a');

/** Pointer travel (px) above which a press is treated as a drag (rotate), not a pick. */
const CLICK_SLOP = 5;

/** The cut shared with the label layer, so hits on the removed side can be ignored. */
export const clip = { plane: new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), active: false };

/** Layers that turn with the eyeball as a rigid body. */
const GLOBE = new Set(['fibrous', 'conjunctiva', 'uvea', 'retina', 'lens', 'chambers']);
/** Parts attached to the eyeball at one end: they follow it near the globe and stay put further back. */
const TETHERED: Record<string, number> = {
  'lateral-rectus': 0.016, 'medial-rectus': 0.016, 'superior-rectus': 0.016, 'inferior-rectus': 0.016,
  'superior-oblique': 0.012, 'inferior-oblique': 0.012, 'optic-nerve': 0.01, 'central-retinal-artery': 0.01,
  'central-retinal-vein': 0.01, 'posterior-ciliary-arteries': 0.008, 'ciliary-nerves': 0.008, 'check-ligaments': 0.008,
};
const STRAIGHT = [0, 0] as const;
/** Parts whose shape changes with focusing and the pupil. */
const MORPHED = new Set(['lens', 'iris']);
/** Thin layers lying on the retina: drawn on top of it. */
const OVERLAY = new Set(['macula', 'fovea', 'optic-disc', 'ora-serrata']);

interface Cap { back: THREE.Mesh; front: THREE.Mesh; face: THREE.Mesh; material: THREE.MeshStandardMaterial; closed: THREE.BufferGeometry }
interface Part {
  id: string;
  mesh: THREE.Mesh;
  material: TissueMaterial;
  structure: AnatomicalStructure;
  box: THREE.Box3;
  cap: Cap;
  /** Original positions, for parts that are reshaped (iris, lens, tethered parts), and a scratch array. */
  base?: Float32Array;
  scratch?: Float32Array;
}

/** Cut-face grain: one tile of the noise texture spans this many metres. */
const GRAIN_TILE = 0.003;

let grain: THREE.DataTexture | null = null;
/** A soft, tileable value-noise texture (deterministic) that gives cut faces a tissue grain. */
function grainTexture(): THREE.DataTexture {
  if (grain) return grain;
  const n = 128;
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const octave = (cells: number) => {
    const lattice = Array.from({ length: cells * cells }, rand);
    const at = (x: number, y: number) => lattice[(y % cells) * cells + (x % cells)]!;
    const step = n / cells;
    return (x: number, y: number) => {
      const gx = Math.floor(x / step), gy = Math.floor(y / step);
      const fx = smooth((x % step) / step), fy = smooth((y % step) / step);
      const top = at(gx, gy) * (1 - fx) + at(gx + 1, gy) * fx;
      const bottom = at(gx, gy + 1) * (1 - fx) + at(gx + 1, gy + 1) * fx;
      return top * (1 - fy) + bottom * fy;
    };
  };
  const coarse = octave(8), medium = octave(16), fine = octave(32);
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = 0.84 + 0.08 * coarse(x, y) + 0.05 * medium(x, y) + 0.03 * fine(x, y);
    data.set([v * 255, v * 255, v * 255, 255], (y * n + x) * 4);
  }
  grain = new THREE.DataTexture(data, n, n);
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.magFilter = THREE.LinearFilter;
  grain.minFilter = THREE.LinearMipmapLinearFilter;
  grain.generateMipmaps = true;
  grain.colorSpace = THREE.SRGBColorSpace;
  grain.needsUpdate = true;
  return grain;
}

/**
 * Stencil capping (as in three.js' clipping-stencil example): back faces behind the cut add 1 and
 * front faces subtract 1, so the stencil is non-zero exactly where the cut passes through the
 * inside of a closed mesh. The face drawn there is the filled cut surface, in the tissue's colour.
 * The stencil passes use a closed copy of the part (`closeHoles`), since some source parts are open.
 */
function makeCap(geometry: THREE.BufferGeometry, plane: THREE.Plane, order: number, colour: string, size: number): Cap {
  const stencilMat = (side: THREE.Side, op: THREE.StencilOp) => new THREE.MeshBasicMaterial({
    side, colorWrite: false, depthWrite: false, depthTest: false,
    stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc,
    stencilFail: op, stencilZFail: op, stencilZPass: op,
    clippingPlanes: [plane],
  });
  const closed = closeHoles(geometry);
  const back = new THREE.Mesh(closed, stencilMat(THREE.BackSide, THREE.IncrementWrapStencilOp));
  const front = new THREE.Mesh(closed, stencilMat(THREE.FrontSide, THREE.DecrementWrapStencilOp));
  back.renderOrder = front.renderOrder = order;
  const map = grainTexture().clone();
  map.repeat.setScalar(Math.max(1, size / GRAIN_TILE));
  const material = new THREE.MeshStandardMaterial({
    color: colour, map, roughness: 0.5, metalness: 0, side: THREE.DoubleSide,
    stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, stencilZPass: THREE.ReplaceStencilOp,
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  face.renderOrder = order + 0.1;
  for (const m of [back, front, face]) {
    m.visible = false;
    m.raycast = () => {}; // never pickable
    m.matrixAutoUpdate = false;
  }
  return { back, front, face, material, closed };
}

/**
 * Positions of a mesh as a plain xyz array. The model's attributes are interleaved (position,
 * normal and baked shading share one buffer), so they are read and written through the attribute.
 */
type PosAttr = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
function readPositions(attr: PosAttr): Float32Array {
  const out = new Float32Array(attr.count * 3);
  for (let i = 0; i < attr.count; i++) { out[i * 3] = attr.getX(i); out[i * 3 + 1] = attr.getY(i); out[i * 3 + 2] = attr.getZ(i); }
  return out;
}
function writePositions(geometry: THREE.BufferGeometry, xyz: Float32Array) {
  const attr = geometry.getAttribute('position') as PosAttr;
  for (let i = 0; i < attr.count; i++) attr.setXYZ(i, xyz[i * 3]!, xyz[i * 3 + 1]!, xyz[i * 3 + 2]!);
  if ('data' in attr && attr.isInterleavedBufferAttribute) attr.data.needsUpdate = true;
  else (attr as THREE.BufferAttribute).needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}

/** The iris pattern: radial stroma fibres, the collarette, crypts and the dark pupillary ruff. */
interface IrisUniforms { uIrisCentre: { value: THREE.Vector3 }; uIrisAxis: { value: THREE.Vector3 }; uPupilR: { value: number }; uRootR: { value: number }; uStroma: { value: THREE.Color }; uCollarette: { value: THREE.Color }; uRing: { value: THREE.Color } }
function makeIrisMaterial(material: TissueMaterial, uniforms: IrisUniforms) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vIrisPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvIrisPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', [
        '#include <common>',
        'varying vec3 vIrisPos;',
        'uniform vec3 uIrisCentre; uniform vec3 uIrisAxis; uniform float uPupilR; uniform float uRootR;',
        'uniform vec3 uStroma; uniform vec3 uCollarette; uniform vec3 uRing;',
        'float irisHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
      ].join('\n'))
      .replace('#include <color_fragment>', [
        '#include <color_fragment>',
        '{',
        '  vec3 d = vIrisPos - uIrisCentre;',
        '  vec3 pr = d - uIrisAxis * dot(d, uIrisAxis);',
        '  float r = length(pr);',
        '  vec3 e1 = normalize(cross(uIrisAxis, vec3(0.0, 1.0, 0.0)));',
        '  vec3 e2 = cross(uIrisAxis, e1);',
        '  float ang = atan(dot(pr, e2), dot(pr, e1));',
        '  float t = clamp((r - uPupilR) / max(uRootR - uPupilR, 1e-5), 0.0, 1.0);',
        // Radial fibres, slightly wavy, in two families.
        '  float fib = 0.5 + 0.5 * sin(ang * 96.0 + 5.0 * sin(ang * 7.0 + t * 4.0));',
        '  float fib2 = 0.5 + 0.5 * sin(ang * 41.0 - t * 6.0 + 2.0 * sin(ang * 3.0));',
        '  float grain = irisHash(floor(vec2(ang * 60.0, t * 40.0)));',
        // Collarette: a paler wavy ring about a third of the way out.
        '  float wave = 0.03 * sin(ang * 14.0);',
        '  float coll = smoothstep(0.24 + wave, 0.32 + wave, t) * (1.0 - smoothstep(0.36 + wave, 0.5 + wave, t));',
        '  vec3 col = mix(uStroma, uCollarette, coll * 0.85);',
        '  col *= 0.7 + 0.25 * fib * fib2 + 0.12 * grain;',
        // Crypts: darker pits in the outer (ciliary) zone.',
        '  float crypt = smoothstep(0.82, 1.0, sin(ang * 23.0 + 1.3) * sin(t * 17.0 + ang * 3.0));',
        '  col *= 1.0 - 0.4 * crypt * step(0.4, t);',
        // Pupillary ruff: the dark pigment edge at the pupil; and a darker limbal rim.
        '  col = mix(uRing, col, smoothstep(0.0, 0.07, t));',
        '  col *= mix(1.0, 0.6, smoothstep(0.86, 1.0, t));',
        '  diffuseColor.rgb = col;',
        '}',
      ].join('\n'));
  };
  material.customProgramCacheKey = () => 'tissue-iris';
}

/**
 * The macula and fovea as a doctor sees them: not raised layers but a darker area of the retina
 * (yellow macular pigment over the cones) about 5.5 mm across, darkest at the fovea.
 */
function makeRetinaMaterial(material: TissueMaterial) {
  const uniforms = { uFovea: { value: new THREE.Vector3(...optics.fovea) } };
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRetPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRetPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRetPos;\nuniform vec3 uFovea;')
      .replace('#include <color_fragment>', [
        '#include <color_fragment>',
        '{',
        '  float d = distance(vRetPos, uFovea);',
        '  float macula = 1.0 - smoothstep(0.0006, 0.0028, d);',
        '  float fovea = 1.0 - smoothstep(0.0, 0.0007, d);',
        '  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.72, 0.6, 0.5), macula);',
        '  diffuseColor.rgb *= mix(1.0, 0.7, fovea);',
        '}',
      ].join('\n'));
  };
  material.customProgramCacheKey = () => 'tissue-retina';
}

export function EyeModel({ onReady }: { onReady?: () => void }) {
  const { def, state, dispatch } = useLab();
  const gltf = useGLTF(MODEL_URL);
  const invalidate = useThree((s) => s.invalidate);
  const mode = effectiveMode(def, state);
  const [lo, hi] = useMemo(() => modeBounds(def, mode), [def, mode]);
  const vision = effectiveVision(def, state);
  const vs = useMemo(() => visionState(vision.refraction, vision.focusM, vision.glasses, vision.light), [vision.refraction, vision.focusM, vision.glasses, vision.light]);

  const axis = useMemo(() => new THREE.Vector3(...optics.axis).normalize(), []);
  const irisUniforms = useMemo<IrisUniforms>(() => ({
    uIrisCentre: { value: new THREE.Vector3(...optics.pupilCentre) },
    uIrisAxis: { value: axis.clone() },
    uPupilR: { value: optics.pupilDiameterMm / 2000 },
    uRootR: { value: optics.irisDiameterMm / 2000 },
    uStroma: { value: new THREE.Color(IRIS_COLOURS.brown.stroma) },
    uCollarette: { value: new THREE.Color(IRIS_COLOURS.brown.collarette) },
    uRing: { value: new THREE.Color(IRIS_COLOURS.brown.ring) },
  }), [axis]);

  const parts = useMemo(() => {
    const out = new Map<string, Part>();
    gltf.scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const id = o.name || o.parent?.name || '';
      const s = def.structures.find((x) => x.id === id);
      if (!s) return;
      const material = makeTissueMaterial(realLook(s), hasTissueData(o));
      material.clippingPlanes = [clip.plane];
      if (id === 'iris') makeIrisMaterial(material, irisUniforms);
      if (id === 'retina') makeRetinaMaterial(material);
      if (OVERLAY.has(id)) { material.polygonOffset = true; material.polygonOffsetFactor = -2; material.polygonOffsetUnits = -2; }
      o.geometry.computeBoundingBox();
      const box = o.geometry.boundingBox!.clone();
      const capSize = box.getSize(new THREE.Vector3()).length() * 1.05;
      const reshaped = id === 'iris' || id === 'lens' || id === 'ciliary-muscle' || id === 'zonule' || id in TETHERED;
      const base = reshaped ? readPositions(o.geometry.getAttribute('position')) : undefined;
      out.set(id, { id, mesh: o, material, structure: s, box, cap: makeCap(o.geometry, clip.plane, 10, cutColour(s), capSize), base });
    });
    // Large structures first, so smaller ones inside them draw their caps last.
    const sorted = [...out.values()].sort((a, b) => b.box.getSize(new THREE.Vector3()).lengthSq() - a.box.getSize(new THREE.Vector3()).lengthSq());
    sorted.forEach((p, i) => {
      p.cap.back.renderOrder = p.cap.front.renderOrder = 10 + i * 2;
      p.cap.face.renderOrder = 10 + i * 2 + 1;
    });
    return out;
  }, [gltf, def, irisUniforms]);

  // The pupil looks black in a living eye: almost no light comes back out of it. A dark disc just
  // behind the iris shows that (hidden when the eye is cut open or viewed from inside).
  const pupilDisc = useMemo(() => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: '#050404', side: THREE.DoubleSide }));
    m.raycast = () => {};
    m.renderOrder = 1;
    return m;
  }, []);
  useLayoutEffect(() => {
    gltf.scene.add(pupilDisc);
    return () => { gltf.scene.remove(pupilDisc); pupilDisc.geometry.dispose(); (pupilDisc.material as THREE.Material).dispose(); };
  }, [gltf, pupilDisc]);

  // Attach materials in an effect, not in useMemo: StrictMode may run the memo twice, and the
  // meshes must carry the materials this component actually updates. Dispose them on unmount.
  useLayoutEffect(() => {
    for (const p of parts.values()) {
      p.mesh.material = p.material;
      p.mesh.userData.structureId = p.id;
      gltf.scene.add(p.cap.back, p.cap.front, p.cap.face);
    }
    onReady?.();
    return () => parts.forEach((p) => {
      p.material.dispose();
      p.cap.material.map?.dispose();
      p.cap.material.dispose();
      if (p.cap.closed !== p.mesh.geometry) p.cap.closed.dispose();
      (p.cap.back.material as THREE.Material).dispose();
      (p.cap.front.material as THREE.Material).dispose();
      p.cap.face.geometry.dispose();
      gltf.scene.remove(p.cap.back, p.cap.front, p.cap.face);
      if (p.base) writePositions(p.mesh.geometry, p.base);
    });
  }, [parts, onReady, gltf]);

  // Follow quality changes (a slow device drops the costly coat and sheen).
  useEffect(() => quality.subscribe((level) => {
    for (const p of parts.values()) { applyQuality(p.material, level); p.material.needsUpdate = true; }
    invalidate();
  }), [parts, invalidate]);

  // Iris colour.
  useEffect(() => {
    const c = IRIS_COLOURS[state.irisColour];
    irisUniforms.uStroma.value.set(c.stroma);
    irisUniforms.uCollarette.value.set(c.collarette);
    irisUniforms.uRing.value.set(c.ring);
    invalidate();
  }, [state.irisColour, irisUniforms, invalidate]);

  const focus = focusIds(def, state);
  const lit = highlightedIds(def, focus);
  const colourBy = effectiveColourBy(def, state);
  const slice = effectiveSlice(def, state);

  // The cut plane: keeps the side where n·p + c ≥ 0. The plane stays attached to every material
  // (parked far outside the model when there is no cut), so turning a cut on or off never
  // recompiles the tissue shaders.
  useEffect(() => {
    const a = slice.axis;
    clip.active = a !== 'off';
    if (clip.active) {
      const ax = a === 'sagittal' ? 0 : a === 'axial' ? 1 : 2;
      // Cuts are centred on the eyeball (the origin), across the extent of what is shown.
      const half = Math.max(Math.abs(lo[ax]!), Math.abs(hi[ax]!));
      const at = slice.at * half;
      const n = new THREE.Vector3();
      n.setComponent(ax, slice.flip ? 1 : -1);
      clip.plane.set(n, slice.flip ? -at : at);
    } else {
      clip.plane.set(new THREE.Vector3(-1, 0, 0), 100);
    }
    invalidate();
  }, [slice.axis, slice.at, slice.flip, lo, hi, invalidate]);

  // Pupil size and lens shape, eased towards their targets.
  const pupil = useRef(optics.pupilDiameterMm);
  const lensA = useRef(0);
  const gazeNow = useRef<[number, number]>([0, 0]);
  const applied = useRef({ pupil: -1, lens: -1, gaze: [NaN, NaN] as [number, number] });
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const tmpV = useMemo(() => new THREE.Vector3(), []);
  const reshapeIris = (pupilMm: number) => {
    const p = parts.get('iris');
    if (!p?.base) return;
    const b = p.base, arr = (p.scratch ??= new Float32Array(b.length));
    const c = irisUniforms.uIrisCentre.value, R = optics.irisDiameterMm / 2000, p0 = optics.pupilDiameterMm / 2000, pn = pupilMm / 2000;
    for (let i = 0; i < b.length; i += 3) {
      tmpV.set(b[i]! - c.x, b[i + 1]! - c.y, b[i + 2]! - c.z);
      const h = tmpV.dot(axis);
      const radial = tmpV.addScaledVector(axis, -h);
      const r = radial.length();
      if (r < 1e-7 || r > R) { arr[i] = b[i]!; arr[i + 1] = b[i + 1]!; arr[i + 2] = b[i + 2]!; continue; }
      const rn = R - ((R - r) * (R - pn)) / (R - p0);
      radial.multiplyScalar(rn / r);
      arr[i] = c.x + radial.x + axis.x * h; arr[i + 1] = c.y + radial.y + axis.y * h; arr[i + 2] = c.z + radial.z + axis.z * h;
    }
    writePositions(p.mesh.geometry, arr);
    irisUniforms.uPupilR.value = pn;
  };
  /** Accommodation: the lens's front moves forward up to 0.40 mm and its back 0.10 mm (Le Grand, scaled), and it narrows slightly. */
  const reshapeLens = (a: number) => {
    const s = optics.axialLengthMm / 24.19655;
    const lc = new THREE.Vector3(...optics.lensCentre);
    const morph = (id: string, front: number, back: number, radial: number) => {
      const p = parts.get(id);
      if (!p?.base) return;
      const b = p.base, arr = (p.scratch ??= new Float32Array(b.length));
      const halfFront = (optics.lensThicknessMm / 2000);
      for (let i = 0; i < b.length; i += 3) {
        tmpV.set(b[i]! - lc.x, b[i + 1]! - lc.y, b[i + 2]! - lc.z);
        const h = tmpV.dot(axis);
        const rad = tmpV.addScaledVector(axis, -h).multiplyScalar(radial);
        const hn = h >= 0 ? h * (1 + front / halfFront) : h * (1 + back / halfFront);
        arr[i] = lc.x + rad.x + axis.x * hn; arr[i + 1] = lc.y + rad.y + axis.y * hn; arr[i + 2] = lc.z + rad.z + axis.z * hn;
      }
      writePositions(p.mesh.geometry, arr);
    };
    morph('lens', 0.0004 * a * s, 0.0001 * a * s, 1 - 0.035 * a);
    // The ciliary muscle ring narrows towards the lens; the zonule follows.
    morph('ciliary-muscle', 0, 0, 1 - 0.025 * a);
    morph('zonule', 0, 0, 1 - 0.03 * a);
  };
  const centre = useMemo(() => new THREE.Vector3(...optics.rotationCentre), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const qw = useMemo(() => new THREE.Quaternion(), []);
  const globeRadius = 0.0122;
  const turnGlobe = (gaze: readonly [number, number]) => {
    eyePose.set(gaze, q);
    const m = new THREE.Matrix4().makeRotationFromQuaternion(q);
    const t = centre.clone().sub(centre.clone().applyMatrix4(m));
    for (const p of parts.values()) {
      if (GLOBE.has(p.structure.layer)) {
        p.mesh.quaternion.copy(q);
        p.mesh.position.copy(t);
      } else if (p.id in TETHERED && p.base) {
        const b = p.base, arr = (p.scratch ??= new Float32Array(b.length)), L = TETHERED[p.id]!;
        const id = new THREE.Quaternion();
        for (let i = 0; i < b.length; i += 3) {
          tmpV.set(b[i]! - centre.x, b[i + 1]! - centre.y, b[i + 2]! - centre.z);
          const d = tmpV.length();
          const w = 1 - THREE.MathUtils.smoothstep(d, globeRadius + 0.0005, globeRadius + L);
          if (w <= 0) { arr[i] = b[i]!; arr[i + 1] = b[i + 1]!; arr[i + 2] = b[i + 2]!; continue; }
          qw.slerpQuaternions(id, q, w);
          tmpV.applyQuaternion(qw);
          arr[i] = centre.x + tmpV.x; arr[i + 1] = centre.y + tmpV.y; arr[i + 2] = centre.z + tmpV.z;
        }
        writePositions(p.mesh.geometry, arr);
      }
    }
  };

  useFrame((_, dt) => {
    const k = reduce ? 1 : 1 - Math.exp(-dt * 6);
    const targetPupil = vs.pupilMm;
    pupil.current += (targetPupil - pupil.current) * (reduce ? 1 : 1 - Math.exp(-dt * (targetPupil < pupil.current ? 5 : 1.5))); // constriction is faster than dilation
    lensA.current += (vs.a - lensA.current) * k;
    // The eye turns only in the movement view; elsewhere it looks straight ahead.
    const g = mode === 'movement' ? vision.gaze : STRAIGHT;
    gazeNow.current = [gazeNow.current[0] + (g[0] - gazeNow.current[0]) * k, gazeNow.current[1] + (g[1] - gazeNow.current[1]) * k];
    let changed = false;
    if (Math.abs(pupil.current - applied.current.pupil) > 0.01) { reshapeIris(pupil.current); applied.current.pupil = pupil.current; changed = true; }
    if (Math.abs(lensA.current - applied.current.lens) > 0.002) { reshapeLens(lensA.current); applied.current.lens = lensA.current; changed = true; }
    const [gh, gv] = gazeNow.current;
    if (Math.abs(gh - applied.current.gaze[0]) > 0.05 || Math.abs(gv - applied.current.gaze[1]) > 0.05 || Number.isNaN(applied.current.gaze[0])) {
      turnGlobe([gh, gv]); applied.current.gaze = [gh, gv]; changed = true;
    }
    eyePose.pupilMm = pupil.current;
    // Pupil disc: at the pupil, just behind the iris, turned with the eye.
    const disc = tmpV.fromArray(optics.pupilCentre).addScaledVector(axis, -0.0006);
    eyePose.apply(disc);
    pupilDisc.position.copy(disc);
    pupilDisc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis).premultiply(eyePose.quaternion);
    pupilDisc.scale.setScalar(pupil.current / 2000 * 1.02);
    pupilDisc.visible = !clip.active && mode !== 'retina' && mode !== 'vision' && (parts.get('iris')?.mesh.visible ?? false);
    eyePose.lensA = lensA.current;
    const settling = Math.abs(targetPupil - pupil.current) > 0.01 || Math.abs(vs.a - lensA.current) > 0.002 || Math.abs(g[0] - gh) > 0.05 || Math.abs(g[1] - gv) > 0.05;
    if (changed || settling) invalidate();
  });

  // Muscle activity in Movement mode: the working muscles glow.
  const activity = mode === 'movement' ? muscleActivity(vision.gaze) : null;
  const gazing = mode === 'movement' && (vision.gaze[0] !== 0 || vision.gaze[1] !== 0);

  useEffect(() => {
    for (const p of parts.values()) {
      const s = p.structure;
      p.mesh.visible = isVisible(def, state, p.id);
      const isLit = lit.has(p.id);
      const isHover = state.hovered === p.id && !isLit;
      const dim = lit.size > 0 && !isLit;
      const painted = colourBy !== 'real';
      p.material.color.set(baseColour(s, colourBy));
      if (isLit && !painted) p.material.color.lerp(HIGHLIGHT_COLOUR, 0.35);
      else if (dim) p.material.color.lerp(GREY, 0.45);
      const act = activity && gazing ? activity[p.id as MuscleId] ?? 0 : 0;
      if (isLit) p.material.emissive.copy(painted ? p.material.color : HIGHLIGHT_COLOUR);
      else if (act > 0) p.material.emissive.copy(ACTIVE_COLOUR);
      else p.material.emissive.set(isHover ? HOVER : '#000000');
      p.material.emissiveIntensity = isLit ? (painted ? 0.22 : 0.3) : act > 0 ? 0.5 * act : isHover ? 0.3 : 0;

      // Clear media are see-through in their real look. In the pathway view the orbit's eye fades so
      // the nerves and brain show; in the tear view the bones are ghosted.
      let opacity = realOpacity(s);
      if (painted && opacity < 1) opacity = Math.max(opacity, 0.5);
      if (mode === 'pathway' && GLOBE.has(s.layer) && s.id !== 'retina') opacity = Math.min(opacity, 0.35);
      if (mode === 'tears' && s.layer === 'bone') opacity = 0.18;
      if (mode === 'retina' && (s.layer === 'fibrous' || s.id === 'choroid')) opacity = 1;
      if (dim && opacity < 1) opacity *= 0.6;
      const transparent = opacity < 1;
      // Changing `transparent` changes the shader program; only flag an update when it flips.
      if (p.material.transparent !== transparent) p.material.needsUpdate = true;
      p.material.transparent = transparent;
      p.material.opacity = opacity;
      p.material.depthWrite = !transparent;
      p.mesh.renderOrder = transparent ? 2 : OVERLAY.has(p.id) ? 1 : 0;

      p.cap.material.color.set(colourBy !== 'real' ? baseColour(s, colourBy) : cutColour(s));
      if (isLit) p.cap.material.color.lerp(HIGHLIGHT_COLOUR, 0.3);
      else if (dim) p.cap.material.color.lerp(GREY, 0.35);
    }
    invalidate();
  }, [parts, def, state, lit, colourBy, mode, activity, gazing, invalidate]);

  // Keep each cap on the plane and with its part (which may have turned with the eye), just large
  // enough to cover the part's footprint, and show it only where the plane crosses a solid part.
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const size = useMemo(() => new THREE.Vector3(), []);
  const worldBox = useMemo(() => new THREE.Box3(), []);
  useFrame(() => {
    for (const p of parts.values()) {
      const solid = p.mesh.visible && !p.material.transparent;
      // Reshaped parts would need their closed copies rebuilt; while reshaped they go uncapped
      // (tethered parts while the eye is turned; the iris and lens, whose shapes change most).
      const reshapedNow = (p.id in TETHERED && gazing) || MORPHED.has(p.id);
      p.mesh.updateMatrix();
      worldBox.copy(p.box).applyMatrix4(p.mesh.matrix);
      const show = clip.active && solid && !reshapedNow && clip.plane.intersectsBox(worldBox);
      p.cap.back.visible = p.cap.front.visible = p.cap.face.visible = show;
      if (show) {
        p.cap.back.matrix.copy(p.mesh.matrix);
        p.cap.front.matrix.copy(p.mesh.matrix);
        clip.plane.projectPoint(worldBox.getCenter(tmp), tmp);
        p.cap.face.position.copy(tmp);
        p.cap.face.lookAt(tmp.x - clip.plane.normal.x, tmp.y - clip.plane.normal.y, tmp.z - clip.plane.normal.z);
        p.cap.face.scale.setScalar(worldBox.getSize(size).length() * 1.05);
        p.cap.face.updateMatrix();
      }
    }
  });

  /** Ignore hits on the part of the model the cut has removed. */
  const removed = (e: ThreeEvent<PointerEvent | MouseEvent>) => clip.active && clip.plane.distanceToPoint(e.point) < 0;
  const pick = (e: ThreeEvent<MouseEvent>) => {
    const id = e.object.userData.structureId as string | undefined;
    if (!id || !e.object.visible || removed(e)) return; // let the event reach the next hit
    const m = (e.object as THREE.Mesh).material as THREE.Material;
    if (m.transparent && m.opacity < 0.3) return; // clear media are see-through to clicks
    e.stopPropagation();
    if (e.delta > CLICK_SLOP) return;
    dispatch({ type: 'select', id });
  };
  const over = (e: ThreeEvent<PointerEvent>) => {
    const id = e.object.userData.structureId as string | undefined;
    if (!id || !e.object.visible || removed(e)) return;
    const m = (e.object as THREE.Mesh).material as THREE.Material;
    if (m.transparent && m.opacity < 0.3) return;
    e.stopPropagation();
    dispatch({ type: 'hover', id });
    document.body.style.cursor = 'pointer';
  };
  const out = (e: ThreeEvent<PointerEvent>) => {
    if (e.object.userData.structureId === state.hovered) dispatch({ type: 'hover', id: null });
    document.body.style.cursor = '';
  };

  return <primitive object={gltf.scene} onClick={pick} onPointerOver={over} onPointerOut={out} />;
}
