/**
 * Pupil size from the light level: Moon & Spencer (1944), D = 4.9 − 3·tanh(0.4·log10 L), with the
 * luminance L in cd/m² (as converted by Watson & Yellott 2012, J Vis 12(10):12). About 7.9 mm in
 * darkness and 1.9 mm in bright light. Both pupils follow the light reaching either eye (the
 * consensual reflex), so one formula serves both.
 */
export const pupilDiameterMm = (log10Luminance: number) => 4.9 - 3 * Math.tanh(0.4 * log10Luminance);

/** Typical scene luminances for the light slider, as log10 cd/m². */
export const LIGHT_LEVELS: readonly { label: string; log10: number }[] = [
  { label: 'Starlight', log10: -3 },
  { label: 'Moonlight', log10: -2 },
  { label: 'Dim room', log10: 0 },
  { label: 'Office', log10: 2 },
  { label: 'Overcast day', log10: 3 },
  { label: 'Bright sunlight', log10: 4.5 },
];

/** Which iris muscle works as the pupil goes from `fromMm` to `toMm`. */
export function irisMuscle(fromMm: number, toMm: number): 'sphincter' | 'dilator' | null {
  if (Math.abs(toMm - fromMm) < 0.05) return null;
  return toMm < fromMm ? 'sphincter' : 'dilator';
}
