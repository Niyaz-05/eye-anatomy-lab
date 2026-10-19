import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { optics } from '../eye/anchors';
import { eyeModel, rayFan, type TracedRay } from '../eye/optics';
import { MODEL_SCALE, VERTEX_MM, type VisionState } from '../eye/vision';
import { LIGHT_RAY, RAY_LOW } from './palette';
import { eyePose } from './pose';
import { clip } from './EyeModel';

/** Field angle of the object's top for distant objects (degrees), and its height for near ones (mm). */
const FAR_ANGLE = 4;
const NEAR_HEIGHT = 12;
const RAYS = 7;

/**
 * Light rays traced through the eye (exact Snell's law through the Le Grand eye, scaled to this
 * eye) and drawn in its sagittal plane: yellow from the top of the object, orange from its base on
 * the axis. Where they meet the retina is marked; a spread means a blurred image. With glasses on,
 * the spectacle lens is drawn 12 mm in front of the cornea.
 */
export function RayFan({ vision, distanceM }: { vision: VisionState; distanceM: number | null }) {
  const invalidate = useThree((s) => s.invalidate);
  const lines = useRef<THREE.LineSegments>(null);
  const hits = useRef<THREE.InstancedMesh>(null);
  const applied = useRef({ a: -1, pupil: -1, key: '' });

  const axis = useMemo(() => new THREE.Vector3(...optics.axis).normalize(), []);
  const apex = useMemo(() => new THREE.Vector3(...optics.corneaApex), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0).addScaledVector(axis, -axis.y).normalize(), [axis]);
  const lineGeo = useMemo(() => new THREE.BufferGeometry(), []);
  const lineMat = useMemo(() => new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, toneMapped: false }), []);
  const hitGeo = useMemo(() => new THREE.SphereGeometry(0.00012, 8, 6), []);
  const hitMat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  useEffect(() => () => { lineGeo.dispose(); lineMat.dispose(); hitGeo.dispose(); hitMat.dispose(); }, [lineGeo, lineMat, hitGeo, hitMat]);

  /** A point of the 2D trace (y up from the axis, z into the eye from the cornea, mm) in model space. */
  const toWorld = (y: number, z: number, out: THREE.Vector3) => {
    out.copy(apex).addScaledVector(up, y / 1000).addScaledVector(axis, -z / 1000);
    eyePose.apply(out);
    // Draw the rays just in front of the cut face, so the cut does not hide them.
    if (clip.active && Math.abs(clip.plane.normal.x) > 0.9) out.x = -clip.plane.constant / clip.plane.normal.x - 0.00025 * clip.plane.normal.x;
    return out;
  };

  const rebuild = () => {
    const eye = eyeModel(eyePose.lensA, vision.extraMm, MODEL_SCALE);
    const spectacle = vision.glassesD ? { z: -VERTEX_MM, power: vision.glassesD } : undefined;
    const far = distanceM === null;
    const d = far ? Infinity : distanceM;
    const top = rayFan(eye, d, far ? FAR_ANGLE : NEAR_HEIGHT, eyePose.pupilMm, RAYS, spectacle);
    const base = rayFan(eye, d, 0, eyePose.pupilMm, RAYS, spectacle);
    const pos: number[] = [], col: number[] = [];
    const c1 = new THREE.Color(LIGHT_RAY), c2 = new THREE.Color(RAY_LOW);
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    const add = (rays: TracedRay[], c: THREE.Color) => {
      for (const r of rays) for (let i = 0; i < r.points.length - 1; i++) {
        toWorld(r.points[i]![0], r.points[i]![1], a); toWorld(r.points[i + 1]![0], r.points[i + 1]![1], b);
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
        col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }
    };
    add(top, c1); add(base, c2);
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    lineGeo.computeBoundingSphere();
    const m = hits.current;
    if (m) {
      const tmp = new THREE.Object3D();
      let k = 0;
      for (const [rays, c] of [[top, c1], [base, c2]] as const) for (const r of rays) {
        if (!r.retina) { tmp.scale.setScalar(0); } else { toWorld(r.retina[0], r.retina[1], tmp.position); tmp.scale.setScalar(1); }
        tmp.updateMatrix();
        m.setMatrixAt(k, tmp.matrix); m.setColorAt(k, c); k++;
      }
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  };

  useFrame(() => {
    const key = `${vision.extraMm}|${vision.glassesD}|${distanceM}|${clip.plane.constant}|${eyePose.gaze.join(',')}`;
    if (Math.abs(eyePose.lensA - applied.current.a) < 0.002 && Math.abs(eyePose.pupilMm - applied.current.pupil) < 0.01 && key === applied.current.key) return;
    applied.current = { a: eyePose.lensA, pupil: eyePose.pupilMm, key };
    rebuild();
    invalidate();
  });

  const spectacle = useMemo(() => {
    if (!vision.glassesD) return null;
    // A spectacle lens 10 mm tall: thicker at the edge for a minus (concave) lens, at the centre for plus.
    const minus = vision.glassesD < 0, H = 5, edge = minus ? 1.1 : 0.4, centre = minus ? 0.4 : 1.1;
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i++) { const r = (H * i) / 12; const t = centre + (edge - centre) * (r / H) ** 2; pts.push(new THREE.Vector2(r / 1000, t / 2000)); }
    for (let i = 12; i >= 0; i--) { const r = (H * i) / 12; const t = centre + (edge - centre) * (r / H) ** 2; pts.push(new THREE.Vector2(r / 1000, -t / 2000)); }
    const g = new THREE.LatheGeometry(pts, 48);
    g.rotateX(Math.PI / 2); // lathe axis (y) → z
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
    const position = apex.clone().addScaledVector(axis, VERTEX_MM / 1000);
    return { g, q, position };
  }, [vision.glassesD, axis, apex]);
  useEffect(() => () => spectacle?.g.dispose(), [spectacle]);

  return (
    <>
      <lineSegments ref={lines} geometry={lineGeo} material={lineMat} renderOrder={9} frustumCulled={false} />
      <instancedMesh ref={hits} args={[hitGeo, hitMat, RAYS * 2]} renderOrder={10} frustumCulled={false} />
      {spectacle && (
        <mesh geometry={spectacle.g} position={spectacle.position} quaternion={spectacle.q} renderOrder={3}>
          <meshPhysicalMaterial color="#cfe8f4" roughness={0.05} metalness={0} transparent opacity={0.35} clearcoat={1} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
    </>
  );
}
