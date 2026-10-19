/**
 * Geometrical optics of the eye: exact (Snell's law) meridional ray tracing through the Le Grand
 * full theoretical eye, relaxed and accommodated (Le Grand & El Hage, Physiological Optics, 1980;
 * values as tabulated by J. E. Greivenkamp, OPTI-502 notes, University of Arizona). Lengths are in
 * millimetres along the optical axis, z = 0 at the corneal vertex and +z into the eye; y is the
 * height above the axis. Pure functions, so the numbers are unit-tested.
 */

export interface Surface {
  /** Vertex position on the axis, mm. */
  z: number;
  /** Radius of curvature, mm (+ = centre behind the vertex). */
  r: number;
  /** Refractive index after the surface. */
  n: number;
}
export interface EyeModel {
  surfaces: Surface[];
  /** Retina: vertex on the axis and radius of curvature (concave towards the front). */
  retinaZ: number;
  retinaR: number;
}

/** Le Grand full theoretical eye, relaxed (equivalent power 59.94 D). */
export const LE_GRAND_RELAXED = {
  cornea: { r1: 7.8, r2: 6.5, t: 0.55, n: 1.3771 },
  aqueous: { t: 3.05, n: 1.3374 },
  lens: { r1: 10.2, r2: -6.0, t: 4.0, n: 1.42 },
  vitreous: { t: 16.59655, n: 1.336 },
  retinaR: -13.4,
} as const;
/** Le Grand eye accommodated (lens surfaces steeper, thicker, slightly higher index). */
export const LE_GRAND_ACCOMMODATED = {
  cornea: { r1: 7.8, r2: 6.5, t: 0.55, n: 1.3771 },
  aqueous: { t: 2.65, n: 1.3374 },
  lens: { r1: 6.0, r2: -5.5, t: 4.5, n: 1.427 },
  vitreous: { t: 16.49655, n: 1.336 },
  retinaR: -13.4,
} as const;
export const AXIAL_LENGTH_MM = 0.55 + 3.05 + 4.0 + 16.59655;

/**
 * The eye with accommodation `a` (0 = relaxed, 1 = Le Grand accommodated; values in between are
 * interpolated, a little beyond 1 extrapolated), `extraLength` mm added to the vitreous (myopia > 0,
 * hyperopia < 0), and all lengths multiplied by `scale` (to fit a measured eye).
 */
export function eyeModel(a = 0, extraLength = 0, scale = 1): EyeModel {
  const R = LE_GRAND_RELAXED, A = LE_GRAND_ACCOMMODATED;
  const mix = (x: number, y: number) => x + (y - x) * a;
  const t1 = R.cornea.t, t2 = mix(R.aqueous.t, A.aqueous.t), t3 = mix(R.lens.t, A.lens.t);
  const t4 = AXIAL_LENGTH_MM - t1 - t2 - t3 + extraLength;
  const z = [0, t1, t1 + t2, t1 + t2 + t3];
  return {
    surfaces: [
      { z: z[0]! * scale, r: R.cornea.r1 * scale, n: R.cornea.n },
      { z: z[1]! * scale, r: R.cornea.r2 * scale, n: R.aqueous.n },
      { z: z[2]! * scale, r: mix(R.lens.r1, A.lens.r1) * scale, n: mix(R.lens.n, A.lens.n) },
      { z: z[3]! * scale, r: mix(R.lens.r2, A.lens.r2) * scale, n: R.vitreous.n },
    ],
    retinaZ: (z[3]! + t4) * scale,
    retinaR: R.retinaR * scale,
  };
}

/** Paraxial equivalent power of the eye, dioptres (refraction–translation matrices, lengths in mm). */
export function equivalentPower(eye: EyeModel): number {
  // Ray vector [y, n·u]; refraction: n'u' = nu − y·P; translation: y' = y + t·(nu)/n.
  let A = 1, B = 0, C = 0, D = 1; // system matrix [[A, B], [C, D]] acting on [y, nu]
  let nPrev = 1;
  eye.surfaces.forEach((s, i) => {
    if (i > 0) {
      const t = (s.z - eye.surfaces[i - 1]!.z) / nPrev;
      [A, B] = [A + t * C, B + t * D];
    }
    const P = (s.n - nPrev) / s.r; // mm⁻¹
    [C, D] = [C - P * A, D - P * B];
    nPrev = s.n;
  });
  return -C * 1000;
}

export interface Ray { y: number; z: number; dy: number; dz: number }
export interface TracedRay {
  /** Points the ray passes through, [y, z] mm, from the start to the retina. */
  points: [number, number][];
  /** Where it meets the retina, or null if it misses the eye. */
  retina: [number, number] | null;
  /** Where it crosses the axis inside the eye (z), if it does. */
  axisCrossZ: number | null;
}

/** Intersection of a ray with a sphere of radius r whose vertex is at (0, zv); the cap nearest the vertex. */
function hitSurface(ray: Ray, zv: number, r: number): number | null {
  const cz = zv + r; // centre on the axis
  const oy = ray.y, oz = ray.z - cz;
  const b = oy * ray.dy + oz * ray.dz;
  const c = oy * oy + oz * oz - r * r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  // Of the two hits, take the one on the cap through the vertex (z on the vertex side of the centre).
  for (const t of [-b - sq, -b + sq].sort((p, q) => p - q)) {
    if (t <= 1e-9) continue;
    const z = ray.z + t * ray.dz;
    if (Math.sign(z - cz) === -Math.sign(r)) return t;
  }
  return null;
}
/** Snell's law in vector form; returns the refracted unit direction, or null on total internal reflection. */
function refract(dy: number, dz: number, ny: number, nz: number, n1: number, n2: number): [number, number] | null {
  // Orient the normal against the incoming ray.
  let cosi = -(dy * ny + dz * nz);
  if (cosi < 0) { ny = -ny; nz = -nz; cosi = -cosi; }
  const eta = n1 / n2;
  const k = 1 - eta * eta * (1 - cosi * cosi);
  if (k < 0) return null;
  const f = eta * cosi - Math.sqrt(k);
  return [eta * dy + f * ny, eta * dz + f * nz];
}

/**
 * Trace a ray through optional thin spectacle lens (power D at `spectacle.z` mm, negative = in
 * front of the cornea), then the eye's four surfaces, to the retina.
 */
export function trace(eye: EyeModel, start: Ray, spectacle?: { z: number; power: number }): TracedRay {
  let ray = { ...start };
  const len = Math.hypot(ray.dy, ray.dz);
  ray.dy /= len; ray.dz /= len;
  const points: [number, number][] = [[ray.y, ray.z]];
  if (spectacle) {
    const t = (spectacle.z - ray.z) / ray.dz;
    if (t > 0) {
      ray = { ...ray, y: ray.y + t * ray.dy, z: spectacle.z };
      points.push([ray.y, ray.z]);
      // Ideal thin lens: the slope changes by −y·P (P in mm⁻¹).
      const slope = ray.dy / ray.dz - ray.y * (spectacle.power / 1000);
      const l = Math.hypot(slope, 1);
      ray.dy = slope / l; ray.dz = 1 / l;
    }
  }
  let n1 = 1;
  for (const s of eye.surfaces) {
    const t = hitSurface(ray, s.z, s.r);
    if (t === null) return { points, retina: null, axisCrossZ: null };
    const y = ray.y + t * ray.dy, z = ray.z + t * ray.dz;
    points.push([y, z]);
    const cz = s.z + s.r;
    const nl = Math.hypot(y, z - cz);
    const d = refract(ray.dy, ray.dz, y / nl, (z - cz) / nl, n1, s.n);
    if (!d) return { points, retina: null, axisCrossZ: null };
    ray = { y, z, dy: d[0], dz: d[1] };
    n1 = s.n;
  }
  const axisCrossZ = ray.dy !== 0 && Math.sign(ray.y) !== Math.sign(ray.dy) ? ray.z - (ray.y * ray.dz) / ray.dy : null;
  const t = hitSurface(ray, eye.retinaZ, eye.retinaR);
  if (t === null) return { points, retina: null, axisCrossZ };
  const hit: [number, number] = [ray.y + t * ray.dy, ray.z + t * ray.dz];
  points.push(hit);
  return { points, retina: hit, axisCrossZ };
}

/**
 * A fan of rays from a point object at `distanceM` metres in front of the cornea and `height` mm
 * above the axis (for Infinity: parallel light arriving from `height` degrees above the axis),
 * filling a pupil of `pupilMm` diameter. The pupil is taken at the iris plane, 3.6 mm behind the
 * corneal vertex (scaled with the eye).
 */
export function rayFan(eye: EyeModel, distanceM: number, height: number, pupilMm: number, count = 7, spectacle?: { z: number; power: number }): TracedRay[] {
  const startZ = spectacle ? spectacle.z - 8 : -25;
  const pupilZ = 3.6 * (eye.retinaZ / AXIAL_LENGTH_MM);
  const out: TracedRay[] = [];
  for (let k = 0; k < count; k++) {
    const h = count === 1 ? 0 : -pupilMm / 2 + (pupilMm * k) / (count - 1);
    if (!Number.isFinite(distanceM)) {
      // Parallel light from a direction `height` degrees above the axis, travelling down towards it.
      const slope = -Math.tan((height * Math.PI) / 180);
      out.push(trace(eye, { y: h * 0.999 - slope * (pupilZ - startZ), z: startZ, dy: slope, dz: 1 }, spectacle));
    } else {
      const oz = -distanceM * 1000, oy = height;
      const slope = (h - oy) / (pupilZ - oz);
      out.push(trace(eye, { y: oy + slope * (startZ - oz), z: startZ, dy: slope, dz: 1 }, spectacle));
    }
  }
  return out;
}

/** Spread of the fan on the retina (blur-circle diameter), mm. */
export function blurMm(rays: TracedRay[]): number {
  const ys = rays.map((r) => r.retina?.[0]).filter((y): y is number => y !== undefined);
  return ys.length ? Math.max(...ys) - Math.min(...ys) : Infinity;
}

/** Where the fan comes to a focus (mean axis crossing of the marginal rays), mm from the cornea. */
export function focusZ(rays: TracedRay[]): number | null {
  const z = [rays[0]?.axisCrossZ, rays[rays.length - 1]?.axisCrossZ].filter((v): v is number => v !== null && v !== undefined);
  return z.length ? z.reduce((s, v) => s + v, 0) / z.length : null;
}

/** Average amplitude of accommodation at an age (Hofstetter 1950): 18.5 − 0.30 × age, dioptres. */
export const accommodationAmplitude = (age: number) => Math.max(0, 18.5 - 0.3 * age);

/** How far behind (+) or in front of (−) the retina the eye focuses an object, mm. */
export function focusMiss(a: number, extraLength: number, scale: number, distanceM: number, spectacle?: { z: number; power: number }): number {
  const eye = eyeModel(a, extraLength, scale);
  const f = focusZ(rayFan(eye, distanceM, 0, 1.0, 3, spectacle));
  return f === null ? Infinity : f - eye.retinaZ;
}
/** The lens state (0 … 1.4) that focuses an object on the retina, or null if even 1.4 is not enough. */
function lensFor(distanceM: number, extraLength: number, scale: number, spectacle?: { z: number; power: number }): number | null {
  if (focusMiss(0, extraLength, scale, distanceM, spectacle) <= 0) return 0;
  if (focusMiss(1.4, extraLength, scale, distanceM, spectacle) > 0) return null;
  let lo = 0, hi = 1.4;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (focusMiss(mid, extraLength, scale, distanceM, spectacle) > 0) lo = mid; else hi = mid; }
  return hi;
}

/**
 * Accommodation for an object at `distanceM` (through optional glasses). Accommodation is measured
 * as the clinical amplitude is: the dioptres of object vergence the lens state adds for a normal
 * eye of the same size (so a state that focuses 25 cm is 4 D). The lens can go no further than the
 * state that gives `amplitudeD` (Hofstetter's average for the age).
 */
export function accommodate(distanceM: number, extraLength: number, scale: number, amplitudeD: number, spectacle?: { z: number; power: number }): { a: number; dioptres: number; focused: boolean } {
  const aMax = amplitudeD > 0 ? lensFor(1 / amplitudeD, 0, scale) ?? 1.4 : 0;
  const ocular = (a: number) => {
    // The vergence an emmetropic eye of this size focuses with lens state a.
    if (a <= 0) return 0;
    let lo = 0, hi = 25;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (focusMiss(a, 0, scale, 1 / Math.max(mid, 1e-6)) > 0) hi = mid; else lo = mid; }
    return (lo + hi) / 2;
  };
  const relaxedMiss = focusMiss(0, extraLength, scale, distanceM, spectacle);
  // Focused in front of the retina even relaxed: the lens cannot relax further (uncorrected myopia).
  if (relaxedMiss <= 0) return { a: 0, dioptres: 0, focused: Math.abs(relaxedMiss) < 0.05 };
  const need = lensFor(distanceM, extraLength, scale, spectacle);
  if (need === null || need > aMax + 1e-9) return { a: aMax, dioptres: ocular(aMax), focused: false };
  return { a: need, dioptres: ocular(need), focused: true };
}

/**
 * Spectacle power that brings far objects to focus on the retina of the relaxed eye, worn
 * `vertexMm` in front of the cornea (found by search on the traced focus).
 */
export function correctingLens(extraLength: number, scale: number, vertexMm = 12): number {
  const eye = eyeModel(0, extraLength, scale);
  const miss = (P: number) => (focusZ(rayFan(eye, Infinity, 0, 1.0, 3, { z: -vertexMm, power: P })) ?? Infinity) - eye.retinaZ;
  let lo = -20, hi = 20; // more minus power moves the focus back
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (miss(mid) < 0) hi = mid; else lo = mid; }
  return Math.round(((lo + hi) / 2) * 4) / 4; // spectacles come in quarter-dioptre steps
}
