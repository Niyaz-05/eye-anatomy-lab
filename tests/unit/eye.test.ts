import { describe, expect, it } from 'vitest';
import { eyeDefinition as def } from '../../src/eye/definition';
import { validateDefinition } from '../../src/contract/validate';
import { APPROVED_ASSETS } from '../../src/contract/assets';
import geometry from '../../src/eye/generated/geometry.json';
import provenance from '../../src/eye/generated/provenance.json';
import { effectiveMode, effectiveSlice, effectiveVision, initialState, isVisible, keptHalf, makeReducer } from '../../src/app/state';
import { searchStructures } from '../../src/app/search';

const reduce = makeReducer(def);
const G = geometry.structures as unknown as Record<string, { centroid: number[] }>;
const bodyX = (id: string) => G[id]!.centroid[0]! + provenance.centreOffsetMetres[0]!;

describe('eye definition', () => {
  it('passes the validation gate with no warnings', () => {
    const r = validateDefinition(def);
    expect(r.issues).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('has exactly one mesh structure per model node', () => {
    const meshes = def.structures.filter((s) => s.kind === 'mesh').map((s) => s.id).sort();
    expect(meshes).toEqual([...APPROVED_ASSETS['hra-eye-v1']!.nodes].sort());
  });

  it('places every left or right structure on its side of the body (+x is the patient’s left)', () => {
    for (const s of def.structures.filter((x) => x.kind === 'mesh')) {
      if (s.side === 'right') expect(bodyX(s.id), s.id).toBeLessThan(0.002);
      if (s.side === 'left') expect(bodyX(s.id), s.id).toBeGreaterThan(-0.002);
    }
  });

  it('lists the six eye muscles once each, with the LR6 SO4 nerves', () => {
    const nerve = Object.fromEntries(def.muscleActions.map((m) => [m.structure, m.nerve]));
    expect(nerve).toEqual({ 'lateral-rectus': 'VI', 'medial-rectus': 'III', 'superior-rectus': 'III', 'inferior-rectus': 'III', 'superior-oblique': 'IV', 'inferior-oblique': 'III' });
  });

  it('cites every structure, and only https sources', () => {
    for (const s of def.sources) if (s.url) expect(s.url.startsWith('https://')).toBe(true);
    for (const s of def.structures) expect(s.sources.length).toBeGreaterThan(0);
  });

  it('rejects an unapproved asset and an unknown muscle', () => {
    const bad = { ...def, assets: [{ id: 'not-approved', role: 'anatomy-model' }] };
    expect(validateDefinition(bad).ok).toBe(false);
    const bad2 = { ...def, muscleActions: def.muscleActions.map((m, i) => (i === 0 ? { ...m, structure: 'not-a-muscle' } : m)) };
    expect(validateDefinition(bad2).ok).toBe(false);
  });

  it('has routes through the model: tears into the nose, four visual bundles, the pupil reflex', () => {
    const r = (geometry.structures as unknown as { $routes: Record<string, unknown> }).$routes as {
      tears: { id: string; points: number[][] }[];
      visual: { eye: string; half: string; tract: string; field: string; points: number[][] }[];
      pupilReflex: { afferent: number[][]; schematic: number[][]; efferent: number[][] };
    };
    expect(r.tears.map((l) => l.id)).toEqual(['lacrimal-gland', 'bulbar-conjunctiva', 'lacrimal-lake', 'lacrimal-canaliculi', 'lacrimal-sac', 'nasolacrimal-duct']);
    const last = r.tears.at(-1)!.points.at(-1)!;
    expect(last[1]!).toBeLessThan(r.tears[0]!.points[0]![1]!); // ends far below where it starts
    expect(r.visual).toHaveLength(4);
    // Nasal fibres cross; each tract carries the opposite visual field.
    for (const b of r.visual) {
      expect(b.tract).toBe(b.half === 'nasal' ? (b.eye === 'right' ? 'left' : 'right') : b.eye);
      expect(b.field).toBe(b.tract === 'right' ? 'left' : 'right');
    }
    expect(r.pupilReflex.efferent.length).toBeGreaterThan(3);
  });

  it('measures a realistic eye', () => {
    const o = provenance.optics;
    expect(o.axialLengthMm).toBeGreaterThan(22);
    expect(o.axialLengthMm).toBeLessThan(26);
    expect(o.lensThicknessMm).toBeGreaterThan(3.5);
    expect(o.lensThicknessMm).toBeLessThan(4.6);
    // The optic disc lies on the nose side of the fovea (+x for the right eye).
    expect(o.opticDisc[0]!).toBeGreaterThan(o.fovea[0]!);
  });
});

describe('lab state', () => {
  it('starts in Anatomy mode with the eye, muscles and nerves shown and the bones hidden', () => {
    const s = initialState(def);
    expect(s.mode).toBe('explore');
    expect(isVisible(def, s, 'cornea')).toBe(true);
    expect(isVisible(def, s, 'lateral-rectus')).toBe(true);
    expect(isVisible(def, s, 'frontal-bone')).toBe(false);
    expect(isVisible(def, s, 'optic-chiasm')).toBe(false);
  });

  it('each mode shows its own layers; Vision cuts the eye and faces the cut', () => {
    let s = reduce(initialState(def), { type: 'set-mode', mode: 'vision' });
    expect(effectiveSlice(def, s).axis).toBe('sagittal');
    expect(s.camera.preset).toBe('left');
    expect(isVisible(def, s, 'lens')).toBe(true);
    expect(isVisible(def, s, 'lateral-rectus')).toBe(false);
    s = reduce(s, { type: 'set-mode', mode: 'pathway' });
    expect(s.slice.axis).toBe('off');
    expect(isVisible(def, s, 'optic-chiasm')).toBe(true);
    expect(isVisible(def, s, 'optic-nerve')).toBe(true);
    expect(isVisible(def, s, 'lacrimal-gland')).toBe(false);
  });

  it('clamps the gaze and light, and clears glasses when the eye changes', () => {
    let s = reduce(initialState(def), { type: 'set-gaze', value: [80, -80] });
    expect(s.gaze).toEqual([35, -35]);
    s = reduce(s, { type: 'set-light', value: 9 });
    expect(s.light).toBe(5);
    s = reduce(reduce(s, { type: 'set-glasses', value: true }), { type: 'set-refraction', value: 'myopia' });
    expect(s.glasses).toBe(false);
  });

  it('tour steps set their own mode, focus distance, refraction and lesion', () => {
    let s = reduce(initialState(def), { type: 'set-mode', mode: 'tour' });
    const at = (id: string) => def.tour.findIndex((t) => t.id === id);
    s = reduce(s, { type: 'tour-go', index: at('near') });
    expect(effectiveMode(def, s)).toBe('vision');
    expect(effectiveVision(def, s).focusM).toBe(0.25);
    expect(effectiveSlice(def, s).axis).toBe('sagittal');
    s = reduce(s, { type: 'tour-go', index: at('myopia') });
    expect(effectiveVision(def, s)).toMatchObject({ refraction: 'myopia', glasses: true });
    s = reduce(s, { type: 'tour-go', index: at('chiasm-lesion') });
    expect(effectiveVision(def, s).lesion).toBe('chiasm');
  });

  it('says which half the cut keeps', () => {
    expect(keptHalf({ axis: 'sagittal', at: 0, flip: false })).toMatch(/outer/);
    expect(keptHalf({ axis: 'coronal', at: 0, flip: true })).toBe('the front half');
  });
});

describe('search', () => {
  it('finds structures by name and synonym', () => {
    expect(searchStructures(def.structures, 'white of the eye')[0]!.structure.id).toMatch(/sclera|fibrous-tunic/);
    expect(searchStructures(def.structures, 'blind spot')[0]!.structure.id).toBe('optic-disc');
    expect(searchStructures(def.structures, 'uvea')[0]!.structure.id).toBe('vascular-tunic');
    expect(searchStructures(def.structures, 'cranial nerve IV')[0]!.structure.id).toBe('trochlear-nerve');
    expect(searchStructures(def.structures, 'annulus of zinn')[0]!.structure.id).toBe('common-tendinous-ring');
  });
});
