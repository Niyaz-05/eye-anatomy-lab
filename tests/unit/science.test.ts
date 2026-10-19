import { describe, expect, it } from 'vitest';
import { accommodate, accommodationAmplitude, blurMm, correctingLens, equivalentPower, eyeModel, focusZ, rayFan } from '../../src/eye/optics';
import { irisMuscle, pupilDiameterMm } from '../../src/eye/pupil';
import { mainMuscle, muscleActivity } from '../../src/eye/gaze';
import { bundleCut, visualFields } from '../../src/eye/fields';

describe('optics (Le Grand full theoretical eye)', () => {
  it('has the published equivalent power, relaxed 59.94 D, and about 7 D more accommodated', () => {
    expect(equivalentPower(eyeModel(0))).toBeCloseTo(59.94, 1);
    const acc = equivalentPower(eyeModel(1));
    expect(acc - equivalentPower(eyeModel(0))).toBeGreaterThan(6.5);
    expect(acc - equivalentPower(eyeModel(0))).toBeLessThan(8);
  });

  it('focuses parallel light on the retina when relaxed (emmetropia)', () => {
    const eye = eyeModel(0);
    const fan = rayFan(eye, Infinity, 0, 1, 5);
    expect(Math.abs(focusZ(fan)! - eye.retinaZ)).toBeLessThan(0.15);
    expect(blurMm(fan)).toBeLessThan(0.02);
  });

  it('forms an inverted image: light from above lands below the axis', () => {
    const fan = rayFan(eyeModel(0), Infinity, 5, 2, 3);
    for (const r of fan) expect(r.retina![0]).toBeLessThan(0);
  });

  it('a longer eye focuses in front of the retina (myopia), a shorter one behind (hyperopia)', () => {
    const long = eyeModel(0, 1.5), short = eyeModel(0, -1.5);
    expect(focusZ(rayFan(long, Infinity, 0, 1, 3))!).toBeLessThan(long.retinaZ - 1);
    expect(focusZ(rayFan(short, Infinity, 0, 1, 3))!).toBeGreaterThan(short.retinaZ + 1);
  });

  it('glasses of the computed power refocus a myopic and a hyperopic eye on the retina', () => {
    for (const extra of [1.5, -1.5]) {
      const P = correctingLens(extra, 1);
      expect(Math.sign(P)).toBe(extra > 0 ? -1 : 1);
      const eye = eyeModel(0, extra);
      const fan = rayFan(eye, Infinity, 0, 1, 3, { z: -12, power: P });
      expect(Math.abs(focusZ(fan)! - eye.retinaZ)).toBeLessThan(0.1);
    }
  });

  it('accommodates to focus a near object, and a presbyopic eye cannot', () => {
    const young = accommodate(0.25, 0, 1, accommodationAmplitude(20));
    expect(young.focused).toBe(true);
    expect(young.dioptres).toBeCloseTo(4, 1); // 25 cm needs 4 D
    const old = accommodate(0.25, 0, 1, accommodationAmplitude(60));
    expect(old.focused).toBe(false);
    expect(accommodationAmplitude(20)).toBeCloseTo(12.5, 5);
  });
});

describe('pupil (Moon & Spencer)', () => {
  it('is about 7.9 mm in darkness, 4.9 mm at 1 cd/m², and under 2.3 mm in sunlight', () => {
    expect(pupilDiameterMm(-3)).toBeGreaterThan(7.3);
    expect(pupilDiameterMm(0)).toBeCloseTo(4.9, 5);
    expect(pupilDiameterMm(2)).toBeCloseTo(4.9 - 3 * Math.tanh(0.8), 5);
    expect(pupilDiameterMm(4)).toBeLessThan(2.3);
    expect(irisMuscle(5, 3)).toBe('sphincter');
    expect(irisMuscle(3, 6)).toBe('dilator');
  });
});

describe('eye movements (right eye)', () => {
  it('uses the right muscles in each diagnostic gaze', () => {
    expect(mainMuscle([-30, 0])).toBe('lateral-rectus'); // looking right: abduction
    expect(mainMuscle([30, 0])).toBe('medial-rectus'); // looking left: adduction
    expect(mainMuscle([-25, 25])).toBe('superior-rectus'); // up and out
    expect(mainMuscle([25, 25])).toBe('inferior-oblique'); // up and in
    expect(mainMuscle([-25, -25])).toBe('inferior-rectus'); // down and out
    expect(mainMuscle([25, -25])).toBe('superior-oblique'); // down and in
    expect(mainMuscle([0, 0])).toBeNull();
    const down = muscleActivity([0, -25]);
    expect(down['inferior-rectus']).toBeGreaterThan(0);
    expect(down['superior-oblique']).toBeGreaterThan(0);
  });
});

describe('visual fields', () => {
  it('gives the classic field defects', () => {
    expect(visualFields('right-optic-nerve').rightEye).toEqual([false, false]);
    expect(visualFields('right-optic-nerve').leftEye).toEqual([true, true]);
    // Bitemporal: each eye loses its outer half.
    expect(visualFields('chiasm')).toEqual({ leftEye: [false, true], rightEye: [true, false] });
    // Left homonymous hemianopia.
    expect(visualFields('right-optic-tract')).toEqual({ leftEye: [false, true], rightEye: [false, true] });
    expect(bundleCut('chiasm', 'right', 'nasal')).toBe(true);
    expect(bundleCut('chiasm', 'right', 'temporal')).toBe(false);
    expect(bundleCut('right-optic-tract', 'left', 'nasal')).toBe(true);
    expect(bundleCut('right-optic-tract', 'left', 'temporal')).toBe(false);
  });
});

describe('vision state (HuBMAP-sized Le Grand eye)', () => {
  it('a normal eye sees far and near; short sight blurs far until glasses are worn', async () => {
    const { visionState } = await import('../../src/eye/vision');
    expect(visionState('normal', null, false, 2).focused).toBe(true);
    expect(visionState('normal', 0.25, false, 2)).toMatchObject({ focused: true });
    const my = visionState('myopia', null, false, 2);
    expect(my.focused).toBe(false);
    expect(my.prescriptionD).toBeLessThan(-3);
    expect(visionState('myopia', null, true, 2).focused).toBe(true);
    // A young long-sighted eye focuses far objects by accommodating.
    const hy = visionState('hyperopia', null, false, 2);
    expect(hy.focused).toBe(true);
    expect(hy.accommodationD).toBeGreaterThan(3);
    // Presbyopia: reading distance is blurred without reading glasses and sharp with them.
    expect(visionState('presbyopia', 0.4, false, 2).focused).toBe(false);
    const pr = visionState('presbyopia', 0.4, true, 2);
    expect(pr.readingAddD).toBe(2.25);
    expect(pr.focused).toBe(true);
  });
});
