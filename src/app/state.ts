/**
 * UI and simulation state as a pure reducer, so every learner action is unit-testable without
 * rendering. The 3D scene only reads this state; it never owns selection or visibility itself.
 */
import type { Lesion, Mode, Refraction, SimulationDefinition, SliceAxis } from '../contract/schema';
import type { Gaze } from '../eye/gaze';
import { GAZE_LIMIT } from '../eye/gaze';

export type { Mode } from '../contract/schema';
export type ColourBy = 'real' | 'layer';
export type IrisColour = 'brown' | 'hazel' | 'green' | 'blue';

export interface Slice {
  axis: SliceAxis;
  /** Position across the model, -1 … 1. */
  at: number;
  /** Keep the other side of the cut. */
  flip: boolean;
}

export interface LabState {
  mode: Mode;
  selected: string | null;
  hovered: string | null;
  visibleLayers: ReadonlySet<string>;
  isolate: boolean;
  labels: boolean;
  colourBy: ColourBy;
  slice: Slice;
  /** Animations (tears, signals) running. */
  playing: boolean;
  /** Scene luminance, log10 cd/m²; sets the pupil. */
  light: number;
  /** Right eye's gaze in degrees: [horizontal (+ = towards the patient's left), vertical (+ = up)]. */
  gaze: Gaze;
  /** Object distance for focusing, metres; null = far away. */
  focusM: number | null;
  refraction: Refraction;
  glasses: boolean;
  lesion: Lesion;
  irisColour: IrisColour;
  /** In the pathway view: also show the pupillary light reflex route. */
  reflex: boolean;
  tourIndex: number;
  /** A camera move the scene should perform; the nonce makes repeat requests distinct. */
  camera: { preset: string; focus: readonly string[]; nonce: number };
}

export type LabAction =
  | { type: 'select'; id: string | null }
  | { type: 'hover'; id: string | null }
  | { type: 'toggle-layer'; layer: string }
  | { type: 'set-isolate'; value: boolean }
  | { type: 'set-labels'; value: boolean }
  | { type: 'set-colour-by'; value: ColourBy }
  | { type: 'set-slice'; axis?: SliceAxis; at?: number; flip?: boolean }
  | { type: 'set-mode'; mode: Mode }
  | { type: 'set-playing'; value: boolean }
  | { type: 'set-light'; value: number }
  | { type: 'set-gaze'; value: Gaze }
  | { type: 'set-focus'; value: number | null }
  | { type: 'set-refraction'; value: Refraction }
  | { type: 'set-glasses'; value: boolean }
  | { type: 'set-lesion'; value: Lesion }
  | { type: 'set-iris'; value: IrisColour }
  | { type: 'set-reflex'; value: boolean }
  | { type: 'tour-go'; index: number }
  | { type: 'camera'; preset: string; focus?: readonly string[] }
  | { type: 'reset' };

const NO_SLICE: Slice = { axis: 'off', at: 0, flip: false };
/** The cut that shows the light path: a sagittal cut through the eye's centre, seen from the inner side. */
const VISION_SLICE: Slice = { axis: 'sagittal', at: 0, flip: false };

/** Which layers each mode shows (the learner's layer toggles apply in Anatomy mode). */
export const MODE_LAYERS: Record<Exclude<Mode, 'explore' | 'tour'>, readonly string[]> = {
  vision: ['fibrous', 'uvea', 'retina', 'lens', 'chambers'],
  movement: ['fibrous', 'conjunctiva', 'uvea', 'retina', 'lens', 'chambers', 'muscle'],
  tears: ['fibrous', 'conjunctiva', 'uvea', 'retina', 'lens', 'chambers', 'tear', 'eyelid', 'bone'],
  pathway: ['fibrous', 'uvea', 'retina', 'lens', 'left-eye', 'pathway'],
  retina: ['retina', 'uvea', 'fibrous', 'vessel'],
};
/** Single structures a mode adds to its layers. */
const MODE_EXTRA: Partial<Record<Mode, readonly string[]>> = {
  pathway: ['optic-nerve'],
  movement: ['optic-nerve', 'trochlear-nerve', 'oculomotor-superior', 'oculomotor-inferior'],
};
/** Structures a mode hides although their layer is shown (the levator would cover the superior rectus). */
const MODE_HIDE: Partial<Record<Mode, readonly string[]>> = {
  movement: ['levator-palpebrae', 'check-ligaments'],
  // The tear view keeps only the bones the tear duct runs through (the large skull bones are costly to draw see-through).
  tears: ['frontal-bone', 'sphenoid-bone', 'ethmoid-bone', 'zygomatic-bone', 'palatine-bone'],
  // The fundus view looks through a widely dilated pupil, as in an eye examination.
  retina: ['iris', 'ciliary-body', 'ciliary-muscle', 'ciliary-processes', 'cornea', 'limbus', 'macula', 'fovea'],
};
/** The camera each mode starts with. */
export const MODE_CAMERA: Partial<Record<Mode, string>> = {
  explore: 'oblique', vision: 'left', movement: 'superior', tears: 'anterior', pathway: 'superior', retina: 'anterior',
};

export function initialState(def: SimulationDefinition): LabState {
  return {
    mode: 'explore',
    selected: null,
    hovered: null,
    visibleLayers: new Set(def.layers.filter((l) => l.visibleByDefault).map((l) => l.id)),
    isolate: false,
    labels: false,
    colourBy: 'real',
    slice: NO_SLICE,
    playing: true,
    light: 2,
    gaze: [0, 0],
    focusM: null,
    refraction: 'normal',
    glasses: false,
    lesion: 'none',
    irisColour: 'brown',
    reflex: false,
    tourIndex: 0,
    camera: { preset: def.defaultCamera, focus: [], nonce: 0 },
  };
}

/** Ids that a selection or tour step highlights: a group stands for its members. */
export function highlightedIds(def: SimulationDefinition, ids: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const id of ids) {
    const s = def.structures.find((x) => x.id === id);
    if (!s) continue;
    if (s.kind === 'group') s.members?.forEach((m) => out.add(m));
    else out.add(id);
  }
  return out;
}

const step = (def: SimulationDefinition, state: LabState) => (state.mode === 'tour' ? def.tour[state.tourIndex] : undefined);

/** The mode in effect: in a tour, the step's (Anatomy if it names none). */
export function effectiveMode(def: SimulationDefinition, state: LabState): Exclude<Mode, 'tour'> {
  if (state.mode === 'tour') return step(def, state)?.mode ?? 'explore';
  return state.mode;
}

/** The structures currently in focus: the selection, or the step's focus in a tour. */
export function focusIds(def: SimulationDefinition, state: LabState): string[] {
  if (state.mode === 'tour') return [...(step(def, state)?.focus ?? [])];
  return state.selected ? [state.selected] : [];
}

/** The light level, gaze, focus, refraction, glasses and lesion in effect: a tour step can set its own. */
export function effectiveVision(def: SimulationDefinition, state: LabState) {
  const s = step(def, state);
  if (!s) return { light: state.light, gaze: state.gaze, focusM: state.focusM, refraction: state.refraction, glasses: state.glasses, lesion: state.lesion };
  return {
    light: s.light ?? 2,
    gaze: (s.gaze ?? [0, 0]) as Gaze,
    focusM: s.focus_m ?? null,
    refraction: s.refraction ?? 'normal',
    glasses: s.glasses ?? false,
    lesion: s.lesion ?? 'none',
  };
}

/** The colour mode in effect: a tour step can set its own. */
export function effectiveColourBy(def: SimulationDefinition, state: LabState): ColourBy {
  if (state.mode === 'tour') return step(def, state)?.colourBy ?? 'real';
  return state.colourBy;
}

/** The cut in effect: a tour step's; the light-path cut in Vision mode; otherwise the learner's. */
export function effectiveSlice(def: SimulationDefinition, state: LabState): Slice {
  if (state.mode === 'tour') {
    const s = step(def, state);
    if (s?.slice) return { axis: s.slice.axis, at: s.slice.at, flip: false };
    return s?.mode === 'vision' ? VISION_SLICE : NO_SLICE;
  }
  return state.slice;
}

/**
 * Whether a mesh structure is drawn. In Anatomy mode the learner's layers decide; the other modes
 * show their own layers. A highlighted structure is always shown; with isolate on, only those.
 */
export function isVisible(def: SimulationDefinition, state: LabState, id: string): boolean {
  const s = def.structures.find((x) => x.id === id);
  if (!s) return false;
  const lit = highlightedIds(def, focusIds(def, state));
  if (lit.has(id)) return true;
  if (state.isolate && lit.size > 0) return false;
  const mode = effectiveMode(def, state);
  if (mode === 'explore') return state.visibleLayers.has(s.layer);
  if ((MODE_HIDE[mode] ?? []).includes(id)) return false;
  return MODE_LAYERS[mode].includes(s.layer) || (MODE_EXTRA[mode] ?? []).includes(id);
}

/**
 * The camera preset that looks at the cut face. The cut keeps the side below the plane on its axis
 * (x: the eye's outer half, z: the back, y: the lower part), or the side above it when flipped, so
 * the camera looks from the removed side.
 */
export function facingPreset(slice: Slice): string | null {
  switch (slice.axis) {
    case 'sagittal': return slice.flip ? 'right' : 'left';
    case 'coronal': return slice.flip ? 'posterior' : 'anterior';
    case 'axial': return slice.flip ? 'inferior' : 'superior';
    default: return null;
  }
}

/** What the cut leaves in view, for the panel's hint (the right eye: −x is its outer side). */
export function keptHalf(slice: Slice): string | null {
  switch (slice.axis) {
    case 'sagittal': return slice.flip ? 'the inner (nose-side) half' : 'the outer (temple-side) half';
    case 'coronal': return slice.flip ? 'the front half' : 'the back half';
    case 'axial': return slice.flip ? 'the upper half' : 'the lower half';
    default: return null;
  }
}

export function makeReducer(def: SimulationDefinition) {
  const known = new Set(def.structures.map((s) => s.id));
  const layers = new Set(def.layers.map((l) => l.id));
  const presets = new Set(def.cameraPresets.map((c) => c.id));
  const cam = (state: LabState, preset: string | undefined, focus: readonly string[] = []) =>
    preset && presets.has(preset) ? { preset, focus, nonce: state.camera.nonce + 1 } : state.camera;
  const clampGaze = ([h, v]: Gaze): Gaze => [Math.max(-GAZE_LIMIT, Math.min(GAZE_LIMIT, h)), Math.max(-GAZE_LIMIT, Math.min(GAZE_LIMIT, v))];

  return function reduce(state: LabState, action: LabAction): LabState {
    switch (action.type) {
      case 'select': {
        if (action.id !== null && !known.has(action.id)) return state;
        const selected = action.id === state.selected ? null : action.id;
        return { ...state, selected, isolate: selected ? state.isolate : false };
      }
      case 'hover':
        return action.id === state.hovered || (action.id !== null && !known.has(action.id)) ? state : { ...state, hovered: action.id };
      case 'toggle-layer': {
        if (!layers.has(action.layer)) return state;
        const next = new Set(state.visibleLayers);
        if (next.has(action.layer)) next.delete(action.layer);
        else next.add(action.layer);
        return { ...state, visibleLayers: next };
      }
      case 'set-isolate':
        return { ...state, isolate: action.value };
      case 'set-labels':
        return { ...state, labels: action.value };
      case 'set-colour-by':
        return action.value === state.colourBy ? state : { ...state, colourBy: action.value };
      case 'set-slice': {
        const at = action.at === undefined || !Number.isFinite(action.at) ? state.slice.at : Math.max(-1, Math.min(1, action.at));
        const axis = action.axis ?? state.slice.axis;
        // Choosing a new axis starts the cut in the middle.
        const fresh = action.axis !== undefined && action.axis !== state.slice.axis && action.at === undefined;
        const slice = { axis, at: fresh ? 0 : at, flip: action.flip ?? state.slice.flip };
        // A new axis or a flip turns the camera to face the cut, from the side the cut removed.
        const turned = axis !== 'off' && (axis !== state.slice.axis || slice.flip !== state.slice.flip);
        if (!turned) return { ...state, slice };
        return { ...state, slice, camera: cam(state, facingPreset(slice) ?? undefined) };
      }
      case 'set-mode': {
        if (action.mode === state.mode) return state;
        if (action.mode === 'tour') {
          const first = def.tour[0];
          return {
            ...state, mode: 'tour', tourIndex: 0, selected: null, isolate: false, playing: true,
            camera: cam(state, first?.camera ?? MODE_CAMERA[first?.mode ?? 'explore'], first?.focus ?? []),
          };
        }
        // Vision mode opens the eye along its axis to show the light path.
        const slice = action.mode === 'vision' ? VISION_SLICE : state.mode === 'vision' ? NO_SLICE : state.slice;
        return { ...state, mode: action.mode, playing: true, slice, camera: cam(state, MODE_CAMERA[action.mode]) };
      }
      case 'set-playing':
        return { ...state, playing: action.value };
      case 'set-light':
        return Number.isFinite(action.value) ? { ...state, light: Math.max(-3, Math.min(5, action.value)) } : state;
      case 'set-gaze':
        return { ...state, gaze: clampGaze(action.value) };
      case 'set-focus':
        return { ...state, focusM: action.value === null || !Number.isFinite(action.value) ? null : Math.max(0.1, action.value) };
      case 'set-refraction':
        // A presbyopic eye is normal for distance; glasses come off when the eye changes.
        return { ...state, refraction: action.value, glasses: false };
      case 'set-glasses':
        return { ...state, glasses: action.value };
      case 'set-lesion':
        return { ...state, lesion: action.value };
      case 'set-iris':
        return { ...state, irisColour: action.value };
      case 'set-reflex':
        return { ...state, reflex: action.value };
      case 'tour-go': {
        const index = Math.max(0, Math.min(def.tour.length - 1, action.index));
        const s = def.tour[index];
        if (!s) return state;
        return { ...state, mode: 'tour', tourIndex: index, camera: cam(state, s.camera ?? MODE_CAMERA[s.mode ?? 'explore'], s.focus) };
      }
      case 'camera':
        if (!presets.has(action.preset)) return state;
        return { ...state, camera: { preset: action.preset, focus: action.focus ?? [], nonce: state.camera.nonce + 1 } };
      case 'reset': {
        const fresh = initialState(def);
        return { ...fresh, camera: { ...fresh.camera, nonce: state.camera.nonce + 1 } };
      }
    }
  };
}
