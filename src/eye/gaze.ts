/**
 * Eye movements of the right eye. Gaze is [horizontal, vertical] in degrees: horizontal + = towards
 * the patient's left (adduction for the right eye), vertical + = up. Which muscles pull, and how
 * hard (0 … 1), follows the textbook actions (OpenStax A&P 2e §14.1) and the clinical "H test": the
 * vertical recti act as pure elevators and depressors in abduction, the obliques in adduction.
 */
export type Gaze = readonly [number, number];
export const GAZE_LIMIT = 35;

/** The nine diagnostic positions of gaze, as the patient looks (right eye). */
export const DIAGNOSTIC_GAZES: readonly { id: string; label: string; gaze: Gaze }[] = [
  { id: 'up-right', label: 'Up and right', gaze: [-25, 25] },
  { id: 'up', label: 'Up', gaze: [0, 25] },
  { id: 'up-left', label: 'Up and left', gaze: [25, 25] },
  { id: 'right', label: 'Right', gaze: [-30, 0] },
  { id: 'centre', label: 'Straight ahead', gaze: [0, 0] },
  { id: 'left', label: 'Left', gaze: [30, 0] },
  { id: 'down-right', label: 'Down and right', gaze: [-25, -25] },
  { id: 'down', label: 'Down', gaze: [0, -25] },
  { id: 'down-left', label: 'Down and left', gaze: [25, -25] },
];

export type MuscleId = 'lateral-rectus' | 'medial-rectus' | 'superior-rectus' | 'inferior-rectus' | 'superior-oblique' | 'inferior-oblique';

/** How hard each muscle of the right eye pulls to hold a gaze (0 … 1). */
export function muscleActivity([h, v]: Gaze): Record<MuscleId, number> {
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  // Abduction for the right eye is towards the patient's right (negative h).
  const abd = clamp(-h / GAZE_LIMIT), add = clamp(h / GAZE_LIMIT);
  const up = clamp(v / GAZE_LIMIT), down = clamp(-v / GAZE_LIMIT);
  // Share of the vertical work done by the rectus (more in abduction) rather than the oblique (more in adduction).
  const rectusShare = 0.5 + 0.5 * (abd - add);
  return {
    'lateral-rectus': abd,
    'medial-rectus': add,
    'superior-rectus': clamp(up * rectusShare * 1.6),
    'inferior-oblique': clamp(up * (1 - rectusShare) * 1.6),
    'inferior-rectus': clamp(down * rectusShare * 1.6),
    'superior-oblique': clamp(down * (1 - rectusShare) * 1.6),
  };
}

/** The muscle working hardest in a gaze, or null looking straight ahead. */
export function mainMuscle(gaze: Gaze): MuscleId | null {
  const a = muscleActivity(gaze);
  const [id, value] = (Object.entries(a) as [MuscleId, number][]).sort((x, y) => y[1] - x[1])[0]!;
  return value > 0.15 ? id : null;
}
