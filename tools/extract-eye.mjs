#!/usr/bin/env node
/**
 * Build public/models/eye.glb from the official HRA female right eye, the official HRA female brain
 * (visual pathway), the HRA united-female body (eye muscles, nerves, vessels, the left eye) and
 * BodyParts3D (bony orbit, tear system, eyelid plates, orbital nerves).
 *
 *   node tools/extract-eye.mjs <Female Atlas models dir> <Human Atlas models dir>
 *
 *   official GLBs        paths in structures.source.json (officialFiles), downloaded to source/
 *   <Female Atlas dir>   repo3-female-atlas/public/models: HRA united-female v1.5, +0.794760942 m in y
 *                        (reversed here). The official files match it after this translation.
 *   <Human Atlas dir>    repo4-human-atlas/public/models: BodyParts3D 4.0 (metres, Y-up,
 *                        +x = patient's left).
 *
 * Per mesh: weld, simplify with meshoptimizer within a relative error bound, merge into one node per
 * structure, recompute smooth normals. BodyParts3D parts are placed onto the HRA eyes by a similarity
 * transform fitted on landmark centroids (both eyeballs, all 12 eye muscles, the right optic nerve).
 * Also measures the optics of the eye (axis, cornea apex, lens, pupil, axial length), and generates
 * the tear route and the visual-pathway fibre routes.
 * Writes public/models/eye.glb, src/eye/generated/geometry.json and provenance.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { MeshoptSimplifier } from 'meshoptimizer';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [femaleDir, humanDir] = process.argv.slice(2);
if (!femaleDir || !humanDir) {
  console.error('Usage: node tools/extract-eye.mjs <female-atlas public/models dir> <human-atlas public/models dir>');
  process.exit(2);
}
await MeshoptSimplifier.ready;

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const spec = JSON.parse(fs.readFileSync(path.join(root, 'src/eye/source/structures.source.json'), 'utf8'));
const SHIFT = spec.unitedYShift;
const MAX_ERROR = 0.004;

// ── Sources ────────────────────────────────────────────────────────────────
const official = {};
for (const [key, rel] of Object.entries(spec.officialFiles)) {
  const bytes = fs.readFileSync(path.join(root, rel));
  const doc = await new NodeIO().readBinary(new Uint8Array(bytes));
  official[key] = { rel, bytes, nodes: new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n])) };
}
function readOfficial(file, name) {
  const node = official[file]?.nodes.get(name);
  const mesh = node?.getMesh();
  if (!mesh) throw new Error(`${file}: node "${name}" missing or has no mesh`);
  const w = node.getWorldMatrix();
  const positions = [], indices = [];
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION').getArray();
    const idx = prim.getIndices()?.getArray() ?? Uint32Array.from({ length: pos.length / 3 }, (_, i) => i);
    const base = positions.length / 3;
    for (let i = 0; i < pos.length; i += 3) {
      const [x, y, z] = [pos[i], pos[i + 1], pos[i + 2]];
      positions.push(w[0] * x + w[4] * y + w[8] * z + w[12], w[1] * x + w[5] * y + w[9] * z + w[13], w[2] * x + w[6] * y + w[10] * z + w[14]);
    }
    for (const i of idx) indices.push(i + base);
  }
  return { positions: Float32Array.from(positions), indices: Uint32Array.from(indices) };
}

function atlasReader(dir) {
  const bytes = fs.readFileSync(path.join(dir, 'atlas.json'));
  const atlas = JSON.parse(bytes.toString('utf8'));
  const cache = new Map(), hashes = {};
  const chunk = (i) => {
    if (!cache.has(i)) {
      const file = path.join(dir, atlas.chunks[i].url.split('/').pop());
      const buf = fs.readFileSync(file);
      cache.set(i, buf);
      hashes[path.basename(file)] = sha256(buf);
    }
    return cache.get(i);
  };
  const read = (part) => {
    const b = chunk(part.chunk);
    return {
      positions: new Float32Array(b.buffer.slice(b.byteOffset + part.positions, b.byteOffset + part.positions + part.vertexCount * 12)),
      indices: new Uint32Array(b.buffer.slice(b.byteOffset + part.indices, b.byteOffset + part.indices + part.indexCount * 4)),
    };
  };
  return { bytes, atlas, byId: new Map(atlas.parts.map((p) => [p.id, p])), read, hashes };
}
const female = atlasReader(femaleDir);
const human = atlasReader(humanDir);
function readUnited(id) {
  const part = female.byId.get(id);
  if (!part) throw new Error(`united body: part "${id}" missing`);
  const raw = female.read(part);
  for (let i = 1; i < raw.positions.length; i += 3) raw.positions[i] -= SHIFT;
  return raw;
}
function readBp3d(id) {
  const part = human.byId.get(id);
  if (!part) throw new Error(`BodyParts3D: part "${id}" missing`);
  return { ...human.read(part), part };
}
/** A source reference: "official:<file>:<node>" or a united-body part id. */
const readRef = (ref) => (ref.startsWith('official:') ? readOfficial(...ref.slice(9).split(/:(.*)/s).slice(0, 2)) : readUnited(ref));

// ── Mesh clean-up ───────────────────────────────────────────────────────────
function weld(positions, indices) {
  const map = new Map(), remap = new Uint32Array(positions.length / 3), out = [];
  for (let i = 0; i < positions.length / 3; i++) {
    const key = `${Math.round(positions[i * 3] * 1e6)},${Math.round(positions[i * 3 + 1] * 1e6)},${Math.round(positions[i * 3 + 2] * 1e6)}`;
    let k = map.get(key);
    if (k === undefined) { k = out.length / 3; map.set(key, k); out.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]); }
    remap[i] = k;
  }
  const idx = [];
  for (let t = 0; t < indices.length; t += 3) {
    const a = remap[indices[t]], b = remap[indices[t + 1]], c = remap[indices[t + 2]];
    if (a !== b && b !== c && a !== c) idx.push(a, b, c);
  }
  return { positions: Float32Array.from(out), indices: Uint32Array.from(idx) };
}
function smoothNormals(positions, indices) {
  const n = new Float32Array(positions.length);
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t] * 3, indices[t + 1] * 3, indices[t + 2] * 3];
    const e1 = [positions[b] - positions[a], positions[b + 1] - positions[a + 1], positions[b + 2] - positions[a + 2]];
    const e2 = [positions[c] - positions[a], positions[c + 1] - positions[a + 1], positions[c + 2] - positions[a + 2]];
    const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (const v of [a, b, c]) { n[v] += f[0]; n[v + 1] += f[1]; n[v + 2] += f[2]; }
  }
  for (let i = 0; i < n.length; i += 3) {
    const len = Math.hypot(n[i], n[i + 1], n[i + 2]);
    if (len > 0) { n[i] /= len; n[i + 1] /= len; n[i + 2] /= len; } else { n[i + 1] = 1; }
  }
  return n;
}
function simplify(positions, indices) {
  const ratio = indices.length / 3 > 20000 ? 0.15 : 0.25;
  // (the retina is kept whole: it is seen up close in the fundus view)
  const target = Math.min(indices.length, Math.max(96, Math.floor((indices.length * ratio) / 3) * 3));
  const [simplified, error] = MeshoptSimplifier.simplify(indices, positions, 3, target, MAX_ERROR);
  const used = new Map(), pos = [];
  const idx = new Uint32Array(simplified.length);
  for (let i = 0; i < simplified.length; i++) {
    const v = simplified[i];
    let k = used.get(v);
    if (k === undefined) { k = pos.length / 3; used.set(v, k); pos.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]); }
    idx[i] = k;
  }
  return { positions: Float32Array.from(pos), indices: idx, error };
}
function mergePieces(pieces) {
  const vCount = pieces.reduce((n, p) => n + p.positions.length / 3, 0);
  const positions = new Float32Array(vCount * 3), indices = new Uint32Array(pieces.reduce((n, p) => n + p.indices.length, 0));
  let vo = 0, io = 0;
  for (const p of pieces) {
    positions.set(p.positions, vo * 3);
    for (let k = 0; k < p.indices.length; k++) indices[io + k] = p.indices[k] + vo;
    vo += p.positions.length / 3; io += p.indices.length;
  }
  return { positions, indices };
}
/** Midpoint subdivision: every triangle becomes four (for the coarse BodyParts3D parts). */
function subdivide(positions, indices) {
  const pos = Array.from(positions), idx = [];
  const mids = new Map();
  const mid = (a, b) => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    let m = mids.get(key);
    if (m === undefined) {
      m = pos.length / 3;
      pos.push((pos[a * 3] + pos[b * 3]) / 2, (pos[a * 3 + 1] + pos[b * 3 + 1]) / 2, (pos[a * 3 + 2] + pos[b * 3 + 2]) / 2);
      mids.set(key, m);
    }
    return m;
  };
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
    const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
    idx.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
  }
  return { positions: Float32Array.from(pos), indices: Uint32Array.from(idx) };
}
/** Taubin smoothing (shrink-free): alternating Laplacian steps; `fixed` vertices do not move. */
function taubin(positions, indices, iterations, fixed = new Set()) {
  const n = positions.length / 3, nb = Array.from({ length: n }, () => new Set());
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
    nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b);
  }
  for (let it = 0; it < iterations * 2; it++) {
    const f = it % 2 === 0 ? 0.5 : -0.53;
    const next = Float32Array.from(positions);
    for (let v = 0; v < n; v++) {
      if (fixed.has(v) || !nb[v].size) continue;
      for (let a = 0; a < 3; a++) {
        let avg = 0;
        for (const u of nb[v]) avg += positions[u * 3 + a];
        avg /= nb[v].size;
        next[v * 3 + a] = positions[v * 3 + a] + f * (avg - positions[v * 3 + a]);
      }
    }
    positions.set(next);
  }
}
const bboxOf = (pos) => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], pos[i + a]); hi[a] = Math.max(hi[a], pos[i + a]); }
  return [lo, hi];
};
function centroid(pos) {
  const c = [0, 0, 0], n = pos.length / 3;
  for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) c[a] += pos[i + a] / n;
  return c;
}


// ── Place BodyParts3D onto the HRA eyes (similarity, Umeyama) ──────────────
/** Symmetric 4x4 eigenvector of the largest eigenvalue (power iteration with shift). */
function topEigen4(N) {
  let v = [1, 0.3, 0.2, 0.1];
  const shift = Math.abs(N.flat().reduce((a, b) => a + Math.abs(b), 0));
  for (let it = 0; it < 2000; it++) {
    const w = [0, 1, 2, 3].map((r) => N[r].reduce((s, x, c) => s + x * v[c], 0) + shift * v[r]);
    const len = Math.hypot(...w);
    v = w.map((x) => x / len);
  }
  return v;
}
/** Similarity fit (Horn's quaternion method, then the least-squares scale) on landmark centroids. */
function fitSimilarity(pairs) {
  const reg = pairs.map(([bp, refs]) => {
    const src = centroid(readBp3d(bp).positions);
    const dst = centroid(mergePieces(refs.map(readRef)).positions);
    if (Math.abs(src[0]) > 0.01 && Math.sign(src[0]) !== Math.sign(dst[0])) throw new Error(`registration: ${bp} lies on opposite sides`);
    return { bp, name: human.byId.get(bp).name, src, dst };
  });
  const mean = (key) => [0, 1, 2].map((a) => reg.reduce((s, r) => s + r[key][a], 0) / reg.length);
  const ms = mean('src'), md = mean('dst');
  const S = [0, 1, 2].map((i) => [0, 1, 2].map((j) => reg.reduce((s, r) => s + (r.src[i] - ms[i]) * (r.dst[j] - md[j]), 0)));
  const [[Sxx, Sxy, Sxz], [Syx, Syy, Syz], [Szx, Szy, Szz]] = S;
  const N = [
    [Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx],
    [Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz],
    [Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy],
    [Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz],
  ];
  const [qw, qx, qy, qz] = topEigen4(N);
  const quat = new THREE.Quaternion(qx, qy, qz, qw).normalize();
  const rotM = new THREE.Matrix4().makeRotationFromQuaternion(quat);
  const v = new THREE.Vector3();
  let num = 0, den = 0;
  for (const r of reg) {
    v.set(r.src[0] - ms[0], r.src[1] - ms[1], r.src[2] - ms[2]);
    den += v.lengthSq();
    v.applyMatrix4(rotM);
    num += v.x * (r.dst[0] - md[0]) + v.y * (r.dst[1] - md[1]) + v.z * (r.dst[2] - md[2]);
  }
  const scale = num / den;
  const place = (x, y, z) => {
    v.set(x - ms[0], y - ms[1], z - ms[2]).applyMatrix4(rotM).multiplyScalar(scale);
    return [v.x + md[0], v.y + md[1], v.z + md[2]];
  };
  const residuals = reg.map((r) => ({ landmark: `${r.bp} ${r.name}`, mm: r6(Math.hypot(...place(...r.src).map((q, a) => q - r.dst[a])) * 1000) }));
  const rms = Math.sqrt(residuals.reduce((q, r) => q + r.mm ** 2, 0) / residuals.length);
  const rotationDeg = r6((2 * Math.acos(Math.min(1, Math.abs(quat.w))) * 180) / Math.PI);
  return { place, scale: r6(scale), rotationDeg, rmsResidualMm: r6(rms), residuals };
}
// Two fits: the right orbit's soft parts on the right eye alone (closest local match); the skull
// bones, which span both orbits, on both eyes.
const fits = Object.fromEntries(Object.entries(spec.registration.fits).map(([name, f]) => [name, fitSimilarity(f.pairs)]));
for (const [name, f] of Object.entries(fits)) if (f.rmsResidualMm > spec.registration.fits[name].maxRmsMm) throw new Error(`Registration "${name}" too poor: RMS ${f.rmsResidualMm} mm
${JSON.stringify(f.residuals)}`);
const fitFor = (s) => fits[s.fit ?? spec.registration.defaultFit];

// ── Build structures ────────────────────────────────────────────────────────
let sourceTriangles = 0, maxError = 0;
const used = new Set();
function build(raws, keepAll = false) {
  return mergePieces(raws.map((raw) => {
    for (const v of raw.positions) if (!Number.isFinite(v)) throw new Error('non-finite position');
    for (const i of raw.indices) if (i >= raw.positions.length / 3) throw new Error('index out of range');
    sourceTriangles += raw.indices.length / 3;
    const w = weld(raw.positions, raw.indices);
    if (keepAll) return w;
    const s = simplify(w.positions, w.indices);
    maxError = Math.max(maxError, s.error);
    return s;
  }));
}
const sideOf = (raw) => (centroid(raw.positions)[0] < 0 ? 'right' : 'left');
const meshes = [];
const bp3dParts = {};
const byPositionPicks = {};
for (const s of spec.structures) {
  const raws = [];
  for (const [file, name] of s.official ?? []) {
    const raw = readOfficial(file, name);
    // HRA brain '_L'/'_R' suffixes are swapped: pick the parts that lie on this structure's side.
    if (s.byPosition && sideOf(raw) !== s.side) continue;
    const key = `official:${file}:${name}`;
    if (used.has(key)) throw new Error(`${key} used twice`);
    used.add(key);
    if (s.byPosition) (byPositionPicks[s.id] ??= []).push(name);
    raws.push(raw);
  }
  for (const id of s.united ?? []) {
    if (used.has(`united:${id}`)) throw new Error(`${id} used twice`);
    used.add(`united:${id}`);
    raws.push(readUnited(id));
  }
  if (s.bp3d) {
    const pieces = s.bp3d.map((id) => {
      const raw = readBp3d(id);
      bp3dParts[s.id] = [...(bp3dParts[s.id] ?? []), `${id} ${raw.part.name}`];
      sourceTriangles += raw.indices.length / 3;
      const pos = new Float32Array(raw.positions.length);
      const { place } = fitFor(s);
      for (let i = 0; i < pos.length; i += 3) pos.set(place(raw.positions[i], raw.positions[i + 1], raw.positions[i + 2]), i);
      const w = weld(pos, raw.indices);
      // Small coarse parts: subdivide once and smooth; bones are detailed enough as they are.
      if (s.layer !== 'bone' && w.positions.length / 3 < 600) {
        const sub = subdivide(w.positions, w.indices);
        taubin(sub.positions, sub.indices, 4);
        return sub;
      }
      return w;
    });
    meshes.push({ structure: s, ...mergePieces(pieces) });
    continue;
  }
  if (!raws.length) throw new Error(`${s.id}: no source parts`);
  meshes.push({ structure: s, ...build(raws, s.id === 'retina') });
}
const byId = new Map(meshes.map((m) => [m.structure.id, m]));

// Centre on the right eyeball (the sclera's bounding-box centre).
const [slo, shi] = bboxOf(byId.get('sclera').positions);
const centre = [0, 1, 2].map((a) => (slo[a] + shi[a]) / 2);
for (const m of meshes) {
  for (let i = 0; i < m.positions.length; i += 3) for (let a = 0; a < 3; a++) m.positions[i + a] -= centre[a];
  m.normals = smoothNormals(m.positions, m.indices);
}

// ── Interior paths ──────────────────────────────────────────────────────────
const ray = new THREE.Ray();
function bvhOf(m) {
  if (!m.bvh) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
    g.setIndex(new THREE.BufferAttribute(m.indices, 1));
    m.bvh = new MeshBVH(g);
  }
  return m.bvh;
}
const DIRS = [new THREE.Vector3(1, 0.0013, 0.0007).normalize(), new THREE.Vector3(0.0011, 1, 0.0017).normalize(), new THREE.Vector3(0.0009, 0.0015, 1).normalize()];
function insideMesh(bvh, p) {
  let odd = 0;
  for (const d of DIRS) {
    ray.origin.set(p[0], p[1], p[2]); ray.direction.copy(d);
    if (bvh.raycast(ray, THREE.DoubleSide).length % 2 === 1) odd++;
  }
  return odd >= 2;
}
/** Nearest vertex of mesh A to mesh B (and the gap between them). */
function contact(a, b) {
  const C = 0.004, grid = new Map();
  for (let i = 0; i < b.positions.length; i += 3) {
    const k = `${Math.floor(b.positions[i] / C)},${Math.floor(b.positions[i + 1] / C)},${Math.floor(b.positions[i + 2] / C)}`;
    (grid.get(k) ?? grid.set(k, []).get(k)).push(i);
  }
  let best = Infinity, at = 0;
  for (let i = 0; i < a.positions.length; i += 3) {
    const [x, y, z] = [a.positions[i], a.positions[i + 1], a.positions[i + 2]];
    const g = [Math.floor(x / C), Math.floor(y / C), Math.floor(z / C)];
    for (let r = 0; r <= 12 && best > (r - 1) * C; r++) {
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== r) continue;
        const cell = grid.get(`${g[0] + dx},${g[1] + dy},${g[2] + dz}`);
        if (!cell) continue;
        for (const j of cell) {
          const d = Math.hypot(b.positions[j] - x, b.positions[j + 1] - y, b.positions[j + 2] - z);
          if (d < best) { best = d; at = i; }
        }
      }
    }
  }
  return { point: [a.positions[at], a.positions[at + 1], a.positions[at + 2]], gap: best };
}
/**
 * Path inside a closed tube from near `from` to near `to`: Dijkstra over interior voxels, with a
 * cost that grows near the wall, so the path runs down the middle. Returns null if the interior
 * does not connect the two ends.
 */
const AXES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map((d) => new THREE.Vector3(d[0] + 0.0013, d[1] + 0.0011, d[2] + 0.0007).normalize());
/** Enclosed: rays in at least 4 of the 6 axis directions hit the mesh (holds inside open or double-walled tubes). */
function enclosed(bvh, p) {
  let hits = 0;
  for (const d of AXES) {
    ray.origin.set(p[0], p[1], p[2]); ray.direction.copy(d);
    if (bvh.raycastFirst(ray, THREE.DoubleSide)) hits++;
  }
  return hits >= 4;
}
function interiorPath(m, from, to, mode = 'parity') {
  const [lo, hi] = bboxOf(m.positions);
  const minDim = Math.min(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  const h = Math.min(0.002, Math.max(0.0004, minDim / 8));
  const n = [0, 1, 2].map((a) => Math.max(1, Math.ceil((hi[a] - lo[a]) / h)));
  const bvh = bvhOf(m);
  const total = n[0] * n[1] * n[2];
  const inside = new Uint8Array(total);
  const at = (i, j, k) => (k * n[1] + j) * n[0] + i;
  const centreOf = (v) => {
    const i = v % n[0], j = Math.floor(v / n[0]) % n[1], k = Math.floor(v / (n[0] * n[1]));
    return [lo[0] + (i + 0.5) * h, lo[1] + (j + 0.5) * h, lo[2] + (k + 0.5) * h];
  };
  const test = mode === 'parity' ? insideMesh : enclosed;
  for (let v = 0; v < total; v++) inside[v] = test(bvh, centreOf(v)) ? 1 : 0;
  // Distance (in voxels) from the wall, by breadth-first growth from the boundary.
  const depth = new Int16Array(total).fill(-1);
  const queue = [];
  const nb6 = (v) => {
    const i = v % n[0], j = Math.floor(v / n[0]) % n[1], k = Math.floor(v / (n[0] * n[1]));
    const out = [];
    if (i > 0) out.push(v - 1); if (i < n[0] - 1) out.push(v + 1);
    if (j > 0) out.push(v - n[0]); if (j < n[1] - 1) out.push(v + n[0]);
    if (k > 0) out.push(v - n[0] * n[1]); if (k < n[2] - 1) out.push(v + n[0] * n[1]);
    return out;
  };
  for (let v = 0; v < total; v++) {
    if (!inside[v]) continue;
    if (nb6(v).length < 6 || nb6(v).some((u) => !inside[u])) { depth[v] = 1; queue.push(v); }
  }
  for (let q = 0; q < queue.length; q++) for (const u of nb6(queue[q])) if (inside[u] && depth[u] < 0) { depth[u] = depth[queue[q]] + 1; queue.push(u); }
  const nearestInside = (p) => {
    let best = -1, bd = Infinity;
    for (let v = 0; v < total; v++) {
      if (!inside[v]) continue;
      const c = centreOf(v), d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2;
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  };
  const s = nearestInside(from), t = nearestInside(to);
  if (s < 0 || t < 0) return null;
  // Dijkstra with a binary heap; 26-neighbourhood.
  const dist = new Float64Array(total).fill(Infinity), prev = new Int32Array(total).fill(-1);
  const heap = [];
  const push = (v, d) => { heap.push([d, v]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  dist[s] = 0; push(s, 0);
  while (heap.length) {
    const [d, v] = pop();
    if (d > dist[v]) continue;
    if (v === t) break;
    const i = v % n[0], j = Math.floor(v / n[0]) % n[1], k = Math.floor(v / (n[0] * n[1]));
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy && !dz) continue;
      const a = i + dx, b = j + dy, c = k + dz;
      if (a < 0 || b < 0 || c < 0 || a >= n[0] || b >= n[1] || c >= n[2]) continue;
      const u = at(a, b, c);
      if (!inside[u]) continue;
      const step = Math.hypot(dx, dy, dz) * (1 + 6 / (depth[u] * depth[u]));
      if (d + step < dist[u]) { dist[u] = d + step; prev[u] = v; push(u, d + step); }
    }
  }
  if (!Number.isFinite(dist[t])) return null;
  const voxels = [];
  for (let v = t; v >= 0; v = prev[v]) voxels.push(v);
  voxels.reverse();
  // Thin out and smooth (Chaikin) the voxel staircase.
  let pts = voxels.filter((_, i) => i % 3 === 0 || i === voxels.length - 1).map(centreOf);
  for (let it = 0; it < 2; it++) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      out.push(a.map((v, q) => 0.75 * v + 0.25 * b[q]), a.map((v, q) => 0.25 * v + 0.75 * b[q]));
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  // Keep about one point per 4 mm.
  const kept = [pts[0]];
  for (const p of pts.slice(1)) if (Math.hypot(...p.map((v, q) => v - kept[kept.length - 1][q])) >= 0.004) kept.push(p);
  if (kept[kept.length - 1] !== pts[pts.length - 1]) kept.push(pts[pts.length - 1]);
  return { points: kept.map((p) => p.map(r6)), voxel: h, interior: mode, maxDepthMm: r6(Math.max(...voxels.map((v) => depth[v])) * h * 1000) };
}

/** Centroids of 10 slices along the mesh's main axis, ordered from `from` to `to`. */
function slicedCentreline(m, from, to) {
  const pos = m.positions, c = centroid(pos);
  const cov = new Array(9).fill(0), n = pos.length / 3;
  for (let i = 0; i < pos.length; i += 3) {
    const d = [pos[i] - c[0], pos[i + 1] - c[1], pos[i + 2] - c[2]];
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) cov[r * 3 + k] += (d[r] * d[k]) / n;
  }
  let axis = [1, 0.5, 0.25];
  for (let it = 0; it < 100; it++) {
    const w = [0, 1, 2].map((r) => cov[r * 3] * axis[0] + cov[r * 3 + 1] * axis[1] + cov[r * 3 + 2] * axis[2]);
    const len = Math.hypot(...w); axis = w.map((x) => x / len);
  }
  const t = (p) => (p[0] - c[0]) * axis[0] + (p[1] - c[1]) * axis[1] + (p[2] - c[2]) * axis[2];
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < pos.length; i += 3) { const v = t([pos[i], pos[i + 1], pos[i + 2]]); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const pts = [];
  for (let k = 0; k < 10; k++) {
    const a = lo + ((hi - lo) * k) / 10, b = lo + ((hi - lo) * (k + 1)) / 10;
    const acc = [0, 0, 0]; let cnt = 0;
    for (let i = 0; i < pos.length; i += 3) { const v = t([pos[i], pos[i + 1], pos[i + 2]]); if (v >= a && v <= b) { acc[0] += pos[i]; acc[1] += pos[i + 1]; acc[2] += pos[i + 2]; cnt++; } }
    if (cnt) pts.push(acc.map((x) => x / cnt));
  }
  if (t(from) > t(to)) pts.reverse();
  return [from, ...pts, to];
}

// ── Keep the placed BodyParts3D parts out of the HRA eyeball ───────────────
// The two bodies differ, so after the fit a few soft parts (an eyelid plate, a check ligament) dip
// into the eyeball. Vertices inside it are moved onto its surface (plus 0.3 mm), then the part is
// smoothed, a few times. Nerves are left alone: the ciliary nerves really pierce the sclera.
const optics0 = { centre: [0, 0, 0] }; // the right eyeball's centre (origin after centring)
function mergeForBvh(ids) { const m = mergePieces(ids.map((id) => byId.get(id))); return { positions: m.positions, indices: m.indices }; }
const eyeballBvh = bvhOf(mergeForBvh(['sclera', 'cornea', 'bulbar-conjunctiva']));
const insideEye = (m) => { let inside = 0, n = 0; for (let i = 0; i < m.positions.length; i += 9) { n++; if (insideMesh(eyeballBvh, [m.positions[i], m.positions[i + 1], m.positions[i + 2]])) inside++; } return r6((100 * inside) / n); };
const overlap = { before: {}, after: {} };
for (const m of meshes) {
  if (!m.structure.bp3d) continue;
  const before = insideEye(m);
  overlap.before[m.structure.id] = before;
  if (before === 0 || m.structure.layer === 'nerve') { overlap.after[m.structure.id] = before; continue; }
  const res = {}, v = new THREE.Vector3(), c = new THREE.Vector3(...optics0.centre);
  for (let pass = 0; pass < 6; pass++) {
    let moved = 0;
    for (let i = 0; i < m.positions.length; i += 3) {
      v.set(m.positions[i], m.positions[i + 1], m.positions[i + 2]);
      if (!insideMesh(eyeballBvh, [v.x, v.y, v.z])) continue;
      eyeballBvh.closestPointToPoint(v, res);
      const out = res.point.clone().sub(c).normalize();
      v.copy(res.point).addScaledVector(out, 0.0003);
      m.positions.set([v.x, v.y, v.z], i);
      moved++;
    }
    if (!moved) break;
    if (pass < 5) taubin(m.positions, m.indices, 1);
  }
  m.normals = smoothNormals(m.positions, m.indices);
  overlap.after[m.structure.id] = insideEye(m);
}

// ── Optics: the eye's axis and sizes, measured on the model ────────────────
const cen = (id) => new THREE.Vector3(...centroid(byId.get(id).positions));
const lensC = cen('lens'), corneaC = cen('cornea');
const axis = corneaC.clone().sub(lensC).normalize(); // optical axis, pointing out of the eye
const along = (id, sign) => {
  const p = byId.get(id).positions; let best = -Infinity, at = null;
  for (let i = 0; i < p.length; i += 3) { const v = new THREE.Vector3(p[i], p[i + 1], p[i + 2]); const t = sign * v.clone().sub(lensC).dot(axis); if (t > best) { best = t; at = v; } }
  return at;
};
const apex = along('cornea', 1);
// Retina along the axis: cast from the apex inwards and take the farthest retina hit.
const retinaBvh = bvhOf(byId.get('retina'));
ray.origin.copy(apex); ray.direction.copy(axis).negate();
const retinaHits = retinaBvh.raycast(ray, THREE.DoubleSide).sort((a, b) => b.distance - a.distance);
const axialLength = retinaHits[0]?.distance ?? null;
const lensFront = along('lens', 1), lensBack = along('lens', -1);
const radial = (id) => { const p = byId.get(id).positions; let mx = 0; for (let i = 0; i < p.length; i += 3) { const v = new THREE.Vector3(p[i], p[i + 1], p[i + 2]).sub(lensC); const r = v.sub(axis.clone().multiplyScalar(v.dot(axis))).length(); mx = Math.max(mx, r); } return mx; };
const irisInner = (() => { const p = byId.get('iris').positions; let mn = Infinity; for (let i = 0; i < p.length; i += 3) { const v = new THREE.Vector3(p[i], p[i + 1], p[i + 2]).sub(lensC); mn = Math.min(mn, v.sub(axis.clone().multiplyScalar(v.dot(axis))).length()); } return mn; })();
const pupilC = (() => { const raw = readOfficial('eye', 'VH_F_pupil_R'); const c = centroid(raw.positions); return new THREE.Vector3(c[0] - centre[0], c[1] - centre[1], c[2] - centre[2]); })();
const optics = {
  axis: axis.toArray().map(r6),
  corneaApex: apex.toArray().map(r6),
  lensCentre: lensC.toArray().map(r6),
  pupilCentre: pupilC.toArray().map(r6),
  axialLengthMm: axialLength && r6(axialLength * 1000),
  anteriorChamberDepthMm: r6(apex.distanceTo(lensFront) * 1000),
  lensThicknessMm: r6(lensFront.distanceTo(lensBack) * 1000),
  lensDiameterMm: r6(radial('lens') * 2000),
  irisDiameterMm: r6(radial('iris') * 2000),
  pupilDiameterMm: r6(irisInner * 2000),
  corneaDiameterMm: r6(radial('cornea') * 2000),
  // Centre of rotation: 13.5 mm behind the cornea apex in a 24 mm eye (scaled to this eye).
  rotationCentre: apex.clone().addScaledVector(axis, -0.0135 * ((axialLength ?? 0.024) / 0.024)).toArray().map(r6),
  fovea: cen('fovea').toArray().map(r6),
  opticDisc: cen('optic-disc').toArray().map(r6),
};
if (!axialLength || axialLength < 0.02 || axialLength > 0.028) throw new Error(`Axial length out of range: ${axialLength}`);

// ── Routes ──────────────────────────────────────────────────────────────────
const routes = {}, gaps = {}, fallbacks = [];
const V = (a) => new THREE.Vector3(...a);
/** Points along a surface between two points: slerp about the eye centre, projected onto the surface and lifted off it. */
function surfacePath(meshIds, from, to, lift = 0.0004, n = 14) {
  const bvh = bvhOf(mergeForBvh(meshIds));
  const o = V(optics.rotationCentre), a = V(from).sub(o), b = V(to).sub(o);
  const out = [], hit = {};
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const dir = a.clone().normalize().lerp(b.clone().normalize(), t).normalize();
    const r = a.length() * (1 - t) + b.length() * t;
    const p = o.clone().addScaledVector(dir, r);
    bvh.closestPointToPoint(p, hit);
    out.push(hit.point.clone().addScaledVector(dir, lift).toArray().map(r6));
  }
  return out;
}
function tubeLeg(id, from, to) {
  const m = byId.get(id);
  const p = interiorPath(m, from, to) ?? interiorPath(m, from, to, 'enclosed');
  if (p) return { id, ...p };
  fallbacks.push(id);
  return { id, points: slicedCentreline(m, from, to).map((q) => q.map(r6)), interior: 'centreline' };
}
{
  // Tears: from the lacrimal gland, across the front of the eye to the lacrimal lake, then the
  // canaliculi, the sac and the nasolacrimal duct.
  const gland = byId.get('lacrimal-gland'), lake = byId.get('lacrimal-lake');
  const onEye = contact(byId.get('bulbar-conjunctiva'), gland).point;
  const atLake = contact(byId.get('bulbar-conjunctiva'), lake).point;
  gaps['lacrimal-gland→conjunctiva'] = r6(contact(gland, byId.get('bulbar-conjunctiva')).gap * 1000);
  const legs = [{ id: 'lacrimal-gland', points: [centroid(gland.positions).map(r6), onEye.map(r6)], interior: 'ducts' }];
  // Across the cornea's lower part, as a blink sweeps the tears towards the inner corner.
  const mid = V(optics.corneaApex).addScaledVector(V([0, -1, 0]), 0.004).toArray();
  legs.push({ id: 'bulbar-conjunctiva', points: [...surfacePath(['bulbar-conjunctiva', 'cornea'], onEye, mid), ...surfacePath(['bulbar-conjunctiva', 'cornea'], mid, atLake).slice(1)], interior: 'surface' });
  const chain = ['lacrimal-lake', 'lacrimal-canaliculi', 'lacrimal-sac', 'nasolacrimal-duct'];
  for (let i = 0; i < chain.length; i++) {
    const m = byId.get(chain[i]);
    const prev = i ? byId.get(chain[i - 1]) : null, next = i < chain.length - 1 ? byId.get(chain[i + 1]) : null;
    const from = prev ? contact(m, prev).point : atLake;
    const to = next ? contact(m, next).point : (() => { const p = m.positions; let b = 1; for (let k = 1; k < p.length; k += 3) if (p[k] < p[b]) b = k; return [p[b - 1], p[b], p[b + 1]]; })();
    if (next) gaps[`${chain[i]}→${chain[i + 1]}`] = r6(contact(m, next).gap * 1000);
    legs.push(chain[i] === 'lacrimal-lake' ? { id: chain[i], points: [from, to].map((q) => q.map(r6)), interior: 'pool' } : tubeLeg(chain[i], from, to));
  }
  routes.tears = legs;
}
{
  // Visual fibres. For each eye, a nasal and a temporal bundle: retina → optic disc → optic nerve →
  // chiasm (nasal fibres cross) → optic tract → lateral geniculate nucleus → optic radiation →
  // visual cortex. The bundles are offset a little so they can be told apart.
  const disc = { right: V(optics.opticDisc), left: cen('left-retina') };
  const nerve = { right: byId.get('optic-nerve'), left: byId.get('left-optic-nerve') };
  const chiasmC = cen('optic-chiasm');
  const near = (m, p) => { let b = 0, bd = Infinity; const q = m.positions; for (let i = 0; i < q.length; i += 3) { const d = (q[i] - p.x) ** 2 + (q[i + 1] - p.y) ** 2 + (q[i + 2] - p.z) ** 2; if (d < bd) { bd = d; b = i; } } return V([q[b], q[b + 1], q[b + 2]]); };
  const discOf = (side) => side === 'right' ? disc.right : near(byId.get('left-retina'), V(centroid(nerve.left.positions)));
  const along = (m, from, to) => slicedCentreline(m, from.toArray(), to.toArray()).map((q) => V(q));
  const smoothPts = (pts) => pts.map((p) => p.toArray().map(r6));
  const fibre = (eye, half) => {
    const crosses = half === 'nasal';
    const tractSide = crosses ? (eye === 'right' ? 'left' : 'right') : eye;
    // The visual field this bundle carries: the nasal retina sees the temporal field and vice versa.
    const field = (eye === 'right') === (half === 'nasal') ? 'right' : 'left';
    const tract = byId.get(`optic-tract-${tractSide}`), lgn = byId.get(`lgn-${tractSide}`), rad = byId.get(`optic-radiation-${tractSide}`), cortex = byId.get(`visual-cortex-${tractSide}`);
    const d = discOf(eye);
    const nerveStart = near(nerve[eye], d), nerveEnd = near(nerve[eye], chiasmC);
    const tractStart = near(tract, chiasmC), lgnC = cen(`lgn-${tractSide}`);
    const radStart = near(rad, lgnC), cortexC = cen(`visual-cortex-${tractSide}`);
    const radEnd = near(rad, cortexC);
    const pts = [
      d,
      ...along(nerve[eye], nerveStart, nerveEnd),
      chiasmC.clone().lerp(tractStart, crosses ? 0.45 : 0.75).add(V([0, 0, crosses ? 0.0015 : -0.0015])),
      ...along(tract, tractStart, near(tract, lgnC)),
      lgnC,
      ...along(rad, radStart, radEnd),
      near(cortex, radEnd).lerp(cortexC, 0.3),
    ];
    // Offset the bundle sideways (nasal/temporal) by up to 0.6 mm, so the four bundles separate.
    const off = (eye === 'right' ? -1 : 1) * (half === 'temporal' ? 1 : -1) * 0.0006;
    return { eye, half, crosses, field, tract: tractSide, points: smoothPts(pts.map((p) => p.clone().add(V([off, 0, 0])))) };
  };
  routes.visual = ['right', 'left'].flatMap((eye) => ['nasal', 'temporal'].map((half) => fibre(eye, half)));
  // Pupillary light reflex: optic tract → pretectal area (both sides) → oculomotor nerve → ciliary
  // ganglion → short ciliary nerves → iris sphincter. The midbrain link to the oculomotor nerve is
  // not in the model, so that segment is schematic.
  const pre = cen('pretectal-area'), cg = cen('ciliary-ganglion');
  const oc = byId.get('oculomotor-inferior');
  const ocBack = near(oc, pre), ocFront = near(oc, cg);
  routes.pupilReflex = {
    afferent: smoothPts([discOf('right'), ...along(nerve.right, near(nerve.right, disc.right), near(nerve.right, chiasmC)), chiasmC, near(byId.get('optic-tract-right'), pre), pre]),
    schematic: smoothPts([pre, ocBack]),
    efferent: smoothPts([...along(oc, ocBack, ocFront), cg, near(byId.get('ciliary-nerves'), V(optics.corneaApex)), V(optics.pupilCentre).addScaledVector(V(optics.axis), -0.0005)]),
  };
}

// ── Fundus vessels (illustrative) ───────────────────────────────────────────
// The HRA eye has the central retinal artery and vein only inside the optic nerve, so the vessels
// a doctor sees spreading over the retina are drawn here: arteries and veins leave the real optic
// disc in four main branches; the temporal ones arch above and below the real fovea and stop short
// of it (the foveal avascular zone). The pattern is procedural (seeded, deterministic); its anchor
// points and the retina surface are real. Points are lifted 0.03 mm off the inner retinal surface.
let fundus = [];
{
  const retina = byId.get('retina');
  const rb = bvhOf(retina);
  const D = V(optics.opticDisc), F = V(optics.fovea), O = V(optics.rotationCentre);
  const u = F.clone().sub(D); const dDF = u.length(); u.normalize();
  const n = D.clone().sub(O).normalize(); // outward normal at the posterior pole
  const v = new THREE.Vector3().crossVectors(n, u).normalize();
  if (v.y < 0) v.negate(); // v points up
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const hit = {};
  // Project onto the retina's inner surface: cast from the eye's centre towards the point and
  // take the first hit (the retina is a thin shell; the closest point could be its outer face).
  const castRay = new THREE.Ray();
  const onRetina = (s, t) => {
    const p = D.clone().addScaledVector(u, s * dDF).addScaledVector(v, t * dDF);
    castRay.origin.copy(O); castRay.direction.copy(p).sub(O).normalize();
    const first = rb.raycastFirst(castRay, THREE.DoubleSide);
    let q;
    if (first) q = first.point.clone();
    else { rb.closestPointToPoint(p, hit); q = hit.point.clone(); }
    return q.addScaledVector(O.clone().sub(q).normalize(), 0.00004).toArray().map(r6);
  };
  const polyline = (fn, a, b, steps) => Array.from({ length: steps + 1 }, (_, k) => fn(a + ((b - a) * k) / steps));
  const vessels = [];
  const add = (kind, width, pts2) => vessels.push({ kind, widthMm: width, points: pts2.map(([s, t]) => onRetina(s, t)) });
  // Temporal arcades: around the fovea (at s = 1) on a radius of about 0.9 disc–fovea distances.
  for (const side of [1, -1]) {
    for (const [kind, w, dr] of [['artery', 0.1, 0], ['vein', 0.15, 0.07]]) {
      const R = 0.9 + dr;
      const arc = polyline((a) => [1 + R * Math.cos(a) * (1 + 0.25 * (a / Math.PI)), side * (0.15 + R * Math.sin(a) * 0.95)], Math.PI * 0.97, Math.PI * 0.12, 26);
      add(kind, w, [[0, side * 0.05], ...arc]);
      // Branches off the arcade, heading away from the fovea.
      for (let k = 6; k < arc.length - 3; k += 5 + Math.floor(rnd() * 3)) {
        const [s0, t0] = arc[k];
        const ang = Math.atan2(t0 - 0, s0 - 1) + (rnd() - 0.5) * 0.6;
        const len = 0.6 + rnd() * 0.7;
        add(kind, w * 0.6, polyline((q) => [s0 + Math.cos(ang) * q, t0 + Math.sin(ang) * q + side * 0.08 * q * q], 0, len, 8));
      }
    }
    // Nasal branches: up-and-in and down-and-in from the disc.
    for (const [kind, w, da] of [['artery', 0.09, 0], ['vein', 0.13, 0.12]]) {
      const ang = Math.PI - side * (0.75 + da);
      const len = 2.1 + rnd() * 0.4;
      add(kind, w, polyline((q) => [Math.cos(ang) * q - 0.05 * q * q, side * (Math.sin(Math.PI - ang) * q * 0.9)], 0, len, 16));
    }
  }
  fundus = vessels;
}

// ── Geometry facts ──────────────────────────────────────────────────────────
const geometry = {};
const sideErrors = [];
for (const m of meshes) {
  const s = m.structure;
  const [lo, hi] = bboxOf(m.positions);
  const c = centroid(m.positions);
  // Eye-scale tolerance: the right eye is centred on x = 0 after centring, so check against the
  // original body x (patient's right is negative x).
  const bodyX = c[0] + centre[0];
  if (s.sideCheck !== false) {
    if (s.side === 'right' && !(bodyX < 0.002)) sideErrors.push(`${s.id} claims right but body x = ${bodyX.toFixed(4)}`);
    if (s.side === 'left' && !(bodyX > -0.002)) sideErrors.push(`${s.id} claims left but body x = ${bodyX.toFixed(4)}`);
  }
  let nearest = 0, nearestD = Infinity;
  for (let i = 0; i < m.positions.length; i += 3) {
    const d = Math.hypot(m.positions[i] - c[0], m.positions[i + 1] - c[1], m.positions[i + 2] - c[2]);
    if (d < nearestD) { nearestD = d; nearest = i; }
  }
  geometry[s.id] = {
    layer: s.layer, side: s.side,
    bounds: [lo.map(r6), hi.map(r6)],
    centroid: c.map(r6),
    surfaceAnchor: [m.positions[nearest], m.positions[nearest + 1], m.positions[nearest + 2]].map(r6),
    vertexCount: m.positions.length / 3,
    triangleCount: m.indices.length / 3,
  };
}
if (sideErrors.length) throw new Error(`Side checks failed:\n${sideErrors.join('\n')}`);
geometry.$routes = routes;
geometry.$optics = optics;
geometry.$fundus = fundus;
const g = (id) => geometry[id];
const checks = {
  corneaInFrontOfLens: g('cornea').centroid[2] > g('lens').centroid[2],
  retinaBehindLens: g('retina').centroid[2] < g('lens').centroid[2],
  opticNerveBehindEye: g('optic-nerve').centroid[2] < g('sclera').centroid[2],
  lacrimalGlandUpAndOut: g('lacrimal-gland').centroid[1] > 0 && g('lacrimal-gland').centroid[0] < 0,
  lacrimalSacMedial: g('lacrimal-sac').centroid[0] > 0,
  nasolacrimalDuctDown: g('nasolacrimal-duct').centroid[1] < g('lacrimal-sac').centroid[1],
  chiasmBehindEyes: g('optic-chiasm').centroid[2] < g('optic-nerve').centroid[2],
  cortexMostPosterior: g('visual-cortex-right').centroid[2] < g('lgn-right').centroid[2],
  leftEyeOnLeft: g('left-eyeball').centroid[0] > 0.04,
  superiorRectusAbove: g('superior-rectus').centroid[1] > g('inferior-rectus').centroid[1],
  lateralRectusLateral: g('lateral-rectus').centroid[0] < g('medial-rectus').centroid[0],
};
const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
if (failed.length) throw new Error(`Orientation checks failed: ${failed.join(', ')}`);

// ── Write ───────────────────────────────────────────────────────────────────
const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene('eye');
for (const m of meshes) {
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(m.positions).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(m.normals).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(m.positions.length / 3 < 65536 ? Uint16Array.from(m.indices) : m.indices).setBuffer(buffer));
  const s = m.structure;
  scene.addChild(doc.createNode(s.id).setMesh(doc.createMesh(s.id).addPrimitive(prim)).setExtras({
    layer: s.layer,
    source: s.bp3d ? 'bodyparts3d' : s.united ? 'hra-united-female' : 'hra-organ',
    nodes: [...(byPositionPicks[s.id] ?? (s.official ?? []).map(([f, n]) => `${f}:${n}`)), ...(s.united ?? []), ...(s.bp3d ?? [])],
  }));
}
doc.getRoot().getAsset().generator = 'eye-anatomy-lab tools/extract-eye.mjs';
doc.getRoot().getAsset().copyright = 'HuBMAP HRA 3D reference organs (Browne, Schlehlein et al.), CC BY 4.0; BodyParts3D (DBCLS), CC BY 4.0';
const outGlb = path.join(root, 'public/models/eye.glb');
fs.mkdirSync(path.dirname(outGlb), { recursive: true });
const glb = await new NodeIO().writeBinary(doc);
fs.writeFileSync(outGlb, glb);

const commit = (dir) => { try { return execFileSync('git', ['-C', path.resolve(dir, '../..'), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return null; } };
const genDir = path.join(root, 'src/eye/generated');
fs.mkdirSync(genDir, { recursive: true });
fs.writeFileSync(path.join(genDir, 'geometry.json'), JSON.stringify({ units: 'metres', axes: { x: "patient's left", y: 'superior', z: 'anterior' }, structures: geometry }, null, 2) + '\n');
const triangles = meshes.reduce((n, m) => n + m.indices.length / 3, 0);
const ORGANS = {
  eye: { name: '3D Reference Organ for Eye, Female, Right, v1.3', doi: 'https://doi.org/10.48539/HBM632.KTDP.379', url: 'https://cdn.humanatlas.io/digital-objects/ref-organ/eye-female-right/v1.3/assets/3d-vh-f-eye-r.glb' },
  brain: { name: '3D Reference Organ for Brain, Female, v1.4 (Allen human brain atlas)', doi: 'https://doi.org/10.48539/HBM674.NTLM.353', url: 'https://cdn.humanatlas.io/digital-objects/ref-organ/brain-female/v1.4/assets/3d-allen-f-brain.glb' },
};
fs.writeFileSync(path.join(genDir, 'provenance.json'), JSON.stringify({
  output: { file: 'public/models/eye.glb', bytes: glb.byteLength, sha256: sha256(glb), triangles, sourceTriangles },
  sources: {
    organs: Object.fromEntries(Object.entries(official).map(([k, o]) => [k, { ...ORGANS[k], creators: 'Kristen Browne, Heidi Schlehlein', license: 'CC-BY-4.0', bytes: o.bytes.byteLength, sha256: sha256(o.bytes) }])),
    united: {
      name: '3D Reference Organ Set for Female v1.5 (HuBMAP HRA united female), as converted by Female Atlas',
      creators: 'Kristen Browne, Heidi Schlehlein', doi: 'https://doi.org/10.48539/HBM352.BTSQ.586', license: 'CC-BY-4.0',
      intermediate: 'github.com/Niyaz-05/female-atlas, commit ' + commit(femaleDir),
      atlasJsonSha256: sha256(female.bytes), chunkSha256: female.hashes,
      transformReversed: `y - ${SHIFT} m (the official organ files match these parts after this translation)`,
    },
    bodyparts3d: {
      name: 'BodyParts3D 4.0 (Database Center for Life Science), via the Human Atlas build', license: 'CC-BY-4.0',
      intermediate: 'github.com/Niyaz-05/human-atlas, commit ' + commit(humanDir),
      atlasJsonSha256: sha256(human.bytes), chunkSha256: human.hashes,
      parts: bp3dParts,
      registration: { method: 'similarity (rotation, uniform scale, shift) fitted on landmark centroids (Horn quaternion method)', fits: Object.fromEntries(Object.entries(fits).map(([k, f]) => [k, { usedFor: spec.structures.filter((x) => x.bp3d && (x.fit ?? spec.registration.defaultFit) === k).map((x) => x.id), scale: f.scale, rotationDeg: f.rotationDeg, rmsResidualMm: f.rmsResidualMm, residuals: f.residuals }])) },
      verticesInsideEyeballPct: overlap,
    },
  },
  changesHere: `Selected and merged the source meshes in src/eye/source/structures.source.json; welded coincident vertices; simplified each HRA mesh with meshoptimizer within a ${MAX_ERROR * 100} % relative error bound (largest error used: ${(maxError * 100).toFixed(3)} %); subdivided and smoothed the small BodyParts3D parts; recomputed smooth normals; placed the BodyParts3D parts onto the HRA eyes; translated so the right eyeball's centre is the origin.`,
  centreOffsetMetres: centre.map(r6),
  byPositionPicks,
  optics,
  orientationChecks: checks,
  routeGapsMm: gaps,
  routeCentrelineFallbacks: fallbacks,
  structures: spec.structures.map((s) => ({ id: s.id, official: s.official, united: s.united, bp3d: s.bp3d })),
}, null, 2) + '\n');

console.log(JSON.stringify({ structures: meshes.length, sourceTriangles, triangles, bytes: glb.byteLength, maxErrorPct: r6(maxError * 100), registration: Object.fromEntries(Object.entries(fits).map(([k, f]) => [k, { scale: f.scale, rotationDeg: f.rotationDeg, rmsMm: f.rmsResidualMm }])), overlap, optics, gaps, fallbacks, checks }, null, 2));
