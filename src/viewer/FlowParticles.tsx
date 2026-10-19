import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Lesion } from '../contract/schema';
import { geometry as G, pupilReflex, tearPath, vec, visualBundles, type Vec3 } from '../eye/anchors';
import { bundleCut } from '../eye/fields';
import { FIELD_LEFT, FIELD_RIGHT, SIGNAL, TEAR } from './palette';

function curveOf(points: readonly (readonly number[])[]) {
  return new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...vec(p))), false, 'centripetal');
}

interface Track { curve: THREE.CatmullRomCurve3; length: number; count: number; offset: number; colour: string; /** Fraction of the track the particles reach (1 = all of it). */ end: number }

/** Particles streaming along tracks at a steady speed; a track can end early (a lesion). */
function Stream({ tracks, speed, radius, playing, reducedMotion, depthTest = false }: { tracks: Track[]; speed: number; radius: number; playing: boolean; reducedMotion: boolean; depthTest?: boolean }) {
  const total = tracks.reduce((n, t) => n + t.count, 0);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const travelled = useRef(0);
  const invalidate = useThree((s) => s.invalidate);
  const geometry = useMemo(() => new THREE.SphereGeometry(radius, 8, 6), [radius]);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false, depthTest, transparent: true, opacity: 0.95 }), [depthTest]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const p = useMemo(() => new THREE.Vector3(), []);

  function place(distance: number) {
    const m = mesh.current;
    if (!m) return;
    for (const t of tracks) {
      const shift = distance / t.length;
      for (let i = 0; i < t.count; i++) {
        const u = (((i / t.count + shift) % 1) + 1) % 1;
        // Beyond a lesion the signal stops: those particles are hidden.
        if (u > t.end) { tmp.scale.setScalar(0); } else { t.curve.getPointAt(u, p); tmp.position.copy(p); tmp.scale.setScalar(1); }
        tmp.updateMatrix();
        m.setMatrixAt(t.offset + i, tmp.matrix);
      }
    }
    m.instanceMatrix.needsUpdate = true;
  }

  useEffect(() => {
    const m = mesh.current;
    if (m) {
      const c = new THREE.Color();
      for (const t of tracks) for (let i = 0; i < t.count; i++) m.setColorAt(t.offset + i, c.set(t.colour));
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    place(travelled.current);
    invalidate();
  }, [tracks]);

  useFrame((_, dt) => {
    if (!playing || reducedMotion) return;
    travelled.current += speed * Math.min(dt, 0.25);
    place(travelled.current);
  });

  return <instancedMesh key={total} ref={mesh} args={[geometry, material, total]} frustumCulled={false} renderOrder={6} />;
}

const build = (defs: { points: readonly (readonly number[])[]; colour: string; density: number; end?: number }[]): Track[] => {
  let offset = 0;
  return defs.map((d) => {
    const curve = curveOf(d.points);
    const length = curve.getLength();
    const count = Math.max(8, Math.round(length * d.density));
    const t = { curve, length, count, offset, colour: d.colour, end: d.end ?? 1 };
    offset += count;
    return t;
  });
};

/** Tears flowing from the lacrimal gland across the eye to the nose (schematic speed). */
export function TearParticles({ playing, reducedMotion }: { playing: boolean; reducedMotion: boolean }) {
  const tracks = useMemo(() => build([{ points: tearPath().points, colour: TEAR, density: 2500 }]), []);
  return <Stream tracks={tracks} speed={0.004} radius={0.00025} playing={playing} reducedMotion={reducedMotion} />;
}

/** Where along a bundle a lesion cuts it: the point nearest the damaged structure's centre. */
function cutAt(points: readonly (readonly number[])[], lesion: Lesion): number {
  const target = lesion === 'right-optic-nerve' ? 'optic-nerve' : lesion === 'chiasm' ? 'optic-chiasm' : lesion === 'right-optic-tract' ? 'optic-tract-right' : 'optic-radiation-right';
  const c = G[target]?.centroid as Vec3 | undefined;
  if (!c) return 1;
  let best = 0, bd = Infinity;
  points.forEach((p, i) => { const d = Math.hypot(p[0]! - c[0], p[1]! - c[1], p[2]! - c[2]); if (d < bd) { bd = d; best = i; } });
  return best / (points.length - 1);
}

/**
 * Visual signals along the four fibre bundles: blue for the left half of the visual field, orange
 * for the right. Nasal fibres cross at the chiasm, so each tract carries one colour. A lesion stops
 * the bundles it cuts there.
 */
export function VisualSignals({ lesion, playing, reducedMotion }: { lesion: Lesion; playing: boolean; reducedMotion: boolean }) {
  const tracks = useMemo(() => build(visualBundles.map((b) => ({
    points: b.points,
    colour: b.field === 'left' ? FIELD_LEFT : FIELD_RIGHT,
    density: 900,
    end: bundleCut(lesion, b.eye, b.half) ? cutAt(b.points, lesion) : 1,
  }))), [lesion]);
  return <Stream key={lesion} tracks={tracks} speed={0.03} radius={0.0006} playing={playing} reducedMotion={reducedMotion} />;
}

/** The pupillary light reflex: retina → optic tract → pretectal area · · · oculomotor nerve → ciliary ganglion → iris. */
export function PupilReflexSignals({ playing, reducedMotion }: { playing: boolean; reducedMotion: boolean }) {
  const tracks = useMemo(() => build([
    { points: pupilReflex.afferent, colour: SIGNAL, density: 700 },
    { points: pupilReflex.schematic, colour: '#c8b0ff', density: 250 },
    { points: pupilReflex.efferent, colour: '#8ef0b0', density: 900 },
  ]), []);
  return <Stream tracks={tracks} speed={0.02} radius={0.0005} playing={playing} reducedMotion={reducedMotion} />;
}

/** A dashed line for the schematic midbrain link of the pupil reflex, and a red mark at a lesion. */
export function PathwayMarks({ lesion, reflex }: { lesion: Lesion; reflex: boolean }) {
  const dashed = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints(pupilReflex.schematic.map((p) => new THREE.Vector3(...vec(p))));
    const l = new THREE.Line(g, new THREE.LineDashedMaterial({ color: '#c8b0ff', dashSize: 0.002, gapSize: 0.0015, depthTest: false, transparent: true }));
    l.computeLineDistances();
    l.renderOrder = 7;
    return l;
  }, []);
  const mark = useMemo(() => {
    if (lesion === 'none') return null;
    const id = lesion === 'right-optic-nerve' ? 'optic-nerve' : lesion === 'chiasm' ? 'optic-chiasm' : lesion === 'right-optic-tract' ? 'optic-tract-right' : 'optic-radiation-right';
    const c = G[id]?.centroid;
    return c ? new THREE.Vector3(...vec(c)) : null;
  }, [lesion]);
  useEffect(() => () => { dashed.geometry.dispose(); (dashed.material as THREE.Material).dispose(); }, [dashed]);
  return (
    <>
      {reflex && <primitive object={dashed} />}
      {mark && (
        <mesh position={mark} renderOrder={8}>
          <torusGeometry args={[0.0032, 0.0006, 8, 32]} />
          <meshBasicMaterial color="#ff3030" depthTest={false} transparent toneMapped={false} />
        </mesh>
      )}
    </>
  );
}
