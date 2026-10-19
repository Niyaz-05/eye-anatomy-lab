/**
 * Visual-field loss from damage along the visual pathway (OpenStax A&P 2e §14.1–14.2). Fields are as
 * the patient sees them: each eye's field has a left and a right half. Nasal retinal fibres (which
 * carry the temporal, outer half of each eye's field) cross at the optic chiasm; temporal fibres do
 * not. So each optic tract, radiation and visual cortex carries the opposite half of the world.
 */
import type { Lesion } from '../contract/schema';

/** For each eye, which halves of its field are still seen: [left half, right half]. */
export interface FieldState { leftEye: [boolean, boolean]; rightEye: [boolean, boolean] }

export function visualFields(lesion: Lesion): FieldState {
  switch (lesion) {
    case 'none': return { leftEye: [true, true], rightEye: [true, true] };
    // The whole right eye is blind: monocular blindness.
    case 'right-optic-nerve': return { leftEye: [true, true], rightEye: [false, false] };
    // The crossing fibres are cut: both outer halves are lost (bitemporal hemianopia).
    case 'chiasm': return { leftEye: [false, true], rightEye: [true, false] };
    // The right tract and radiation carry the left half of the world from both eyes (left homonymous hemianopia).
    case 'right-optic-tract':
    case 'right-radiation': return { leftEye: [false, true], rightEye: [false, true] };
  }
}

export const LESIONS: readonly { id: Lesion; label: string; result: string }[] = [
  { id: 'none', label: 'No damage', result: 'Full fields in both eyes.' },
  { id: 'right-optic-nerve', label: 'Right optic nerve', result: 'Blindness of the right eye (monocular blindness).' },
  { id: 'chiasm', label: 'Optic chiasm (middle)', result: 'Loss of the outer (temporal) half of each eye’s field: bitemporal hemianopia, as when a pituitary tumour presses on the chiasm.' },
  { id: 'right-optic-tract', label: 'Right optic tract', result: 'Loss of the left half of the world in both eyes: left homonymous hemianopia.' },
  { id: 'right-radiation', label: 'Right optic radiation', result: 'Also a left homonymous hemianopia (a partial lesion may take only one quarter of the field).' },
];

/** Whether a visual-pathway bundle (an eye's nasal or temporal fibres) is cut by a lesion. */
export function bundleCut(lesion: Lesion, eye: 'left' | 'right', half: 'nasal' | 'temporal'): boolean {
  const tract = half === 'nasal' ? (eye === 'right' ? 'left' : 'right') : eye;
  switch (lesion) {
    case 'none': return false;
    case 'right-optic-nerve': return eye === 'right';
    case 'chiasm': return half === 'nasal';
    case 'right-optic-tract':
    case 'right-radiation': return tract === 'right';
  }
}
