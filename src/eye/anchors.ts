import geometryJson from './generated/geometry.json';
import type { Mode, SimulationDefinition } from '../contract/schema';
import { MODE_LAYERS } from '../app/state';

export type Vec3 = [number, number, number];

interface G { centroid: number[]; bounds: number[][]; surfaceAnchor?: number[]; side: string; layer: string }
/** One structure's leg of a generated route. */
export interface RouteLeg { id: string; points: number[][]; interior?: string }
export interface VisualBundle { eye: 'left' | 'right'; half: 'nasal' | 'temporal'; crosses: boolean; field: 'left' | 'right'; tract: 'left' | 'right'; points: number[][] }
export interface FundusVessel { kind: 'artery' | 'vein'; widthMm: number; points: number[][] }
export interface Optics {
  axis: number[]; corneaApex: number[]; lensCentre: number[]; pupilCentre: number[];
  axialLengthMm: number; anteriorChamberDepthMm: number; lensThicknessMm: number; lensDiameterMm: number;
  irisDiameterMm: number; pupilDiameterMm: number; corneaDiameterMm: number;
  rotationCentre: number[]; fovea: number[]; opticDisc: number[];
}

const raw = geometryJson.structures as unknown as Record<string, unknown>;
export const geometry = Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith('$'))) as Record<string, G>;
const R = raw.$routes as { tears: RouteLeg[]; visual: VisualBundle[]; pupilReflex: { afferent: number[][]; schematic: number[][]; efferent: number[][] } };
export const tearLegs = R.tears;
export const visualBundles = R.visual;
export const pupilReflex = R.pupilReflex;
export const optics = raw.$optics as Optics;
export const fundusVessels = raw.$fundus as FundusVessel[];

export const vec = (p: readonly number[]): Vec3 => [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0];

/** A point to hang a label on: on the structure's surface, or the middle of a group. */
export function anchorOf(def: SimulationDefinition, id: string): Vec3 | null {
  const g = geometry[id];
  if (g) return vec(g.surfaceAnchor ?? g.centroid);
  const s = def.structures.find((x) => x.id === id);
  if (s?.kind === 'group' && s.members) {
    const pts = s.members.map((m) => anchorOf(def, m)).filter((p): p is Vec3 => p !== null);
    if (!pts.length) return null;
    return [0, 1, 2].map((a) => pts.reduce((n, p) => n + p[a]!, 0) / pts.length) as Vec3;
  }
  return null;
}

/** Axis-aligned bounds of a set of structures (groups expand to their members). */
export function boundsOfIds(def: SimulationDefinition, ids: readonly string[]): [Vec3, Vec3] | null {
  const lo: Vec3 = [Infinity, Infinity, Infinity];
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  const visit = (id: string) => {
    const g = geometry[id];
    if (g) {
      for (let a = 0; a < 3; a++) {
        lo[a] = Math.min(lo[a]!, g.bounds[0]![a]!);
        hi[a] = Math.max(hi[a]!, g.bounds[1]![a]!);
      }
      return;
    }
    def.structures.find((x) => x.id === id)?.members?.forEach(visit);
  };
  ids.forEach(visit);
  return Number.isFinite(lo[0]) ? [lo, hi] : null;
}

/** The parts each mode frames by default. */
const HOME: Partial<Record<Mode, readonly string[]>> = {
  explore: ['sclera', 'cornea', 'tarsal-plate-upper', 'tarsal-plate-lower', 'lacrimal-gland', 'lacrimal-sac'],
  vision: ['sclera', 'cornea'],
  movement: ['sclera', 'cornea', 'lateral-rectus', 'medial-rectus', 'superior-rectus', 'inferior-rectus', 'superior-oblique', 'inferior-oblique', 'trochlea'],
  tears: ['sclera', 'cornea', 'lacrimal-gland', 'lacrimal-sac', 'nasolacrimal-duct'],
  pathway: ['sclera', 'left-eyeball', 'optic-chiasm', 'visual-cortex-right', 'visual-cortex-left'],
  retina: ['retina'],
};

/** Bounds of the default view for a mode. */
export function homeBounds(def: SimulationDefinition, mode: Mode = 'explore'): [Vec3, Vec3] {
  const ids = HOME[mode] ?? HOME.explore!;
  return boundsOfIds(def, ids) ?? [[-0.02, -0.02, -0.02], [0.02, 0.02, 0.02]];
}

/** Bounds of everything shown in a mode (used to place the cut). */
export function modeBounds(def: SimulationDefinition, mode: Mode): [Vec3, Vec3] {
  const layers = mode === 'explore' || mode === 'tour' ? null : MODE_LAYERS[mode];
  const ids = def.structures.filter((s) => s.kind === 'mesh' && (layers ? layers.includes(s.layer) : !['bone', 'left-eye', 'pathway'].includes(s.layer))).map((s) => s.id);
  return boundsOfIds(def, ids) ?? homeBounds(def, mode);
}

/** One continuous path of the tear route's legs, with the structure each point belongs to. */
export function tearPath(): { points: Vec3[]; part: string[] } {
  const points: Vec3[] = [], part: string[] = [];
  for (const leg of tearLegs) {
    for (const p of leg.points) {
      const v = vec(p);
      const last = points[points.length - 1];
      if (last && Math.hypot(v[0] - last[0], v[1] - last[1], v[2] - last[2]) < 1e-7) continue;
      points.push(v);
      part.push(leg.id);
    }
  }
  return { points, part };
}
