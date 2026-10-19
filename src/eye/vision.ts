/**
 * The optical state of the eye for the current settings: how hard it accommodates, whether the
 * object is in focus, the glasses it needs and the pupil size. Pure, so it is unit-tested and shared
 * by the 3D view and the panels.
 */
import type { Refraction } from '../contract/schema';
import { accommodate, accommodationAmplitude, correctingLens, equivalentPower, eyeModel, focusMiss, AXIAL_LENGTH_MM } from './optics';
import { pupilDiameterMm } from './pupil';
import { optics } from './anchors';

/** How each eye differs from the normal (emmetropic) Le Grand eye. */
export const REFRACTIONS: Record<Refraction, { label: string; extraMm: number; age: number; note: string }> = {
  normal: { label: 'Normal', extraMm: 0, age: 20, note: 'Far objects focus on the retina with the lens relaxed (emmetropia).' },
  myopia: { label: 'Short sight', extraMm: 1.5, age: 20, note: 'The eye is 1.5 mm too long, so far objects focus in front of the retina (myopia). Near objects can still be seen clearly.' },
  hyperopia: { label: 'Long sight', extraMm: -1.5, age: 20, note: 'The eye is 1.5 mm too short, so far objects would focus behind the retina (hyperopia). A young eye can make up for it by accommodating, which tires it; near objects need more than it has.' },
  presbyopia: { label: 'Presbyopia (age 60)', extraMm: 0, age: 60, note: 'Distance is normal, but by 60 the lens has stiffened: about 0.5 D of accommodation is left (Hofstetter), so nothing nearer than about 2 m is sharp.' },
};

/** Scale of the Le Grand eye that matches the HuBMAP eye's measured axial length. */
export const MODEL_SCALE = optics.axialLengthMm / AXIAL_LENGTH_MM;
/** Spectacles sit 12 mm in front of the cornea. */
export const VERTEX_MM = 12;

export interface VisionState {
  extraMm: number;
  amplitudeD: number;
  /** Accommodation used: 0 relaxed … 1 the Le Grand accommodated eye (a little more when extrapolated). */
  a: number;
  accommodationD: number;
  focused: boolean;
  /** Spectacle lens worn (dioptres), or null. */
  glassesD: number | null;
  /** Spectacle power this eye would need for distance. */
  prescriptionD: number;
  /** For presbyopia: reading glasses that bring 40 cm into focus. */
  readingAddD: number;
  powerD: number;
  pupilMm: number;
  nearPointM: number;
  /** Where the image falls: mm behind (+) or in front of (−) the retina. */
  missMm: number;
}

export function visionState(refraction: Refraction, focusM: number | null, glasses: boolean, light: number): VisionState {
  const r = REFRACTIONS[refraction];
  const amplitude = accommodationAmplitude(r.age);
  const prescription = correctingLens(r.extraMm, MODEL_SCALE, VERTEX_MM);
  // Reading glasses for presbyopia: the power that, with what accommodation is left, focuses 40 cm,
  // measured at the spectacle plane and rounded up to the next quarter dioptre.
  const readingAdd = refraction === 'presbyopia' ? Math.max(0, Math.ceil((1 / (0.4 - VERTEX_MM / 1000) - amplitude) * 4) / 4) : 0;
  const glassesD = glasses ? (refraction === 'presbyopia' ? readingAdd : prescription) : null;
  const distance = focusM ?? Infinity;
  const spectacle = glassesD ? { z: -VERTEX_MM, power: glassesD } : undefined;
  const acc = accommodate(distance, r.extraMm, MODEL_SCALE, amplitude, spectacle);
  return {
    extraMm: r.extraMm,
    amplitudeD: amplitude,
    a: acc.a,
    accommodationD: acc.dioptres,
    focused: acc.focused,
    glassesD,
    prescriptionD: prescription,
    readingAddD: readingAdd,
    powerD: equivalentPower(eyeModel(acc.a, r.extraMm, MODEL_SCALE)),
    pupilMm: pupilDiameterMm(light),
    nearPointM: amplitude > 0 ? 1 / amplitude : Infinity,
    missMm: focusMiss(acc.a, r.extraMm, MODEL_SCALE, distance, spectacle),
  };
}
