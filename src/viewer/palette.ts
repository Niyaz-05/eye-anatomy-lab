import type { AnatomicalStructure } from '../contract/schema';
import type { ColourBy } from '../app/state';
import type { TissueLook } from './tissue';

/**
 * Real looks of the eye and orbit as in a fresh specimen: porcelain-white sclera with a wet coat,
 * a clear cornea and lens, the dark pigmented uvea, the orange-red fundus with its pale optic disc
 * and darker macula, red eye muscles, cream nerves, ivory bone.
 */
const REAL: Record<string, TissueLook> = {
  sclera: { color: '#efe8dc', roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.12, sheen: 0.25, sheenColor: '#ffffff', rim: 0.12, rimColor: '#f2c9b8', ao: 0.6, mottle: 0.12, mottleTint: '#d9c6b8' },
  limbus: { color: '#d9d2c8', roughness: 0.3, clearcoat: 0.9, sheen: 0.2, rim: 0.1, ao: 0.5, mottle: 0.1 },
  cornea: { color: '#d8e6ec', roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03, sheen: 0, rim: 0, ao: 0.1, mottle: 0 },
  conjunctiva: { color: '#f4e4e0', roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0, rim: 0, ao: 0.1, mottle: 0.05 },
  'palpebral-conjunctiva': { color: '#de8f86', roughness: 0.25, clearcoat: 0.9, clearcoatRoughness: 0.1, sheen: 0.3, sheenColor: '#ffd0c8', rim: 0.25, rimColor: '#ff8a7a', ao: 0.7, mottle: 0.2, mottleTint: '#b86860' },
  iris: { color: '#6b3d22', roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.2, sheen: 0.2, rim: 0.1, ao: 0.7, mottle: 0.3, mottleTint: '#3c2214' },
  ciliary: { color: '#3a2219', roughness: 0.55, clearcoat: 0.3, sheen: 0.25, sheenColor: '#7a5040', rim: 0.1, ao: 0.8, mottle: 0.25, mottleTint: '#1e120c' },
  choroid: { color: '#4f1c15', roughness: 0.45, clearcoat: 0.4, sheen: 0.25, sheenColor: '#a0504a', rim: 0.18, rimColor: '#b03a2a', ao: 0.7, mottle: 0.3, mottleTint: '#2c0e0a' },
  retina: { color: '#d4683c', roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.2, sheen: 0.2, sheenColor: '#ffb48a', rim: 0.2, rimColor: '#ff7a4a', ao: 0.4, mottle: 0.25, mottleTint: '#b44a2a' },
  'ora-serrata': { color: '#c98264', roughness: 0.4, clearcoat: 0.4, sheen: 0.2, rim: 0.1, ao: 0.5, mottle: 0.2 },
  macula: { color: '#a3442a', roughness: 0.35, clearcoat: 0.5, sheen: 0.15, rim: 0.1, ao: 0.3, mottle: 0.2, mottleTint: '#7a2c1c' },
  fovea: { color: '#7b2b1b', roughness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.08, sheen: 0.1, rim: 0.1, ao: 0.3, mottle: 0.1 },
  'optic-disc': { color: '#f1c79c', roughness: 0.4, clearcoat: 0.4, sheen: 0.3, sheenColor: '#fff0dc', rim: 0.15, rimColor: '#ffd0a0', ao: 0.5, mottle: 0.2, mottleTint: '#e09a7a' },
  lens: { color: '#f4e6b8', roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03, sheen: 0, rim: 0, ao: 0.1, mottle: 0 },
  zonule: { color: '#ece4d4', roughness: 0.5, clearcoat: 0.2, sheen: 0.4, sheenColor: '#ffffff', rim: 0.05, ao: 0.3, mottle: 0.1 },
  humour: { color: '#e6f2f6', roughness: 0.05, clearcoat: 0.6, sheen: 0, rim: 0, ao: 0, mottle: 0 },
  trabecular: { color: '#c8b6a2', roughness: 0.6, clearcoat: 0.2, sheen: 0.3, rim: 0.1, ao: 0.6, mottle: 0.3 },
  schlemm: { color: '#8a4848', roughness: 0.4, clearcoat: 0.5, sheen: 0.2, rim: 0.15, ao: 0.6, mottle: 0.15 },
  muscle: { color: '#a63a30', roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.25, sheen: 0.4, sheenColor: '#ffb0a0', rim: 0.25, rimColor: '#ff6a55', ao: 0.85, mottle: 0.35, mottleTint: '#702018' },
  tendon: { color: '#e8e0d0', roughness: 0.4, clearcoat: 0.6, sheen: 0.4, sheenColor: '#ffffff', rim: 0.1, ao: 0.6, mottle: 0.15 },
  nerve: { color: '#efdfb0', roughness: 0.45, clearcoat: 0.5, sheen: 0.4, sheenColor: '#fff8e0', rim: 0.15, rimColor: '#ffe4a0', ao: 0.7, mottle: 0.2, mottleTint: '#c8b078' },
  ganglion: { color: '#e4c68e', roughness: 0.5, clearcoat: 0.4, sheen: 0.3, rim: 0.15, ao: 0.7, mottle: 0.25 },
  artery: { color: '#b4262a', roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.15, sheen: 0.2, rim: 0.25, rimColor: '#ff5a50', ao: 0.7, mottle: 0.15, mottleTint: '#7a1418' },
  vein: { color: '#5a2c4c', roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.15, sheen: 0.2, rim: 0.2, rimColor: '#a0507a', ao: 0.7, mottle: 0.15, mottleTint: '#3a1830' },
  gland: { color: '#d9a28a', roughness: 0.55, clearcoat: 0.4, sheen: 0.4, sheenColor: '#ffe0d0', rim: 0.2, rimColor: '#ff9a7a', ao: 0.8, mottle: 0.45, mottleTint: '#b0705a' },
  'tear-fluid': { color: '#d4ecf2', roughness: 0.05, clearcoat: 1, sheen: 0, rim: 0, ao: 0, mottle: 0 },
  'tear-duct': { color: '#e2a99a', roughness: 0.35, clearcoat: 0.7, sheen: 0.3, rim: 0.2, rimColor: '#ff9a88', ao: 0.7, mottle: 0.2 },
  tarsal: { color: '#e8d2c0', roughness: 0.5, clearcoat: 0.4, sheen: 0.35, rim: 0.12, ao: 0.7, mottle: 0.2 },
  bone: { color: '#e6d9bc', roughness: 0.7, clearcoat: 0.1, sheen: 0.15, sheenColor: '#fff6e0', rim: 0.05, ao: 0.95, mottle: 0.35, mottleTint: '#bfae88' },
  'white-matter': { color: '#ece2cc', roughness: 0.5, clearcoat: 0.4, sheen: 0.4, sheenColor: '#fffaf0', rim: 0.12, ao: 0.7, mottle: 0.2, mottleTint: '#cbbd9e' },
  'grey-matter': { color: '#c5a197', roughness: 0.5, clearcoat: 0.45, sheen: 0.4, sheenColor: '#ffe6e0', rim: 0.2, rimColor: '#e88a7a', ao: 0.85, mottle: 0.3, mottleTint: '#9a766c' },
};

function kindOf(s: AnatomicalStructure): string {
  const id = s.id;
  if (id === 'sclera' || id === 'left-eyeball') return 'sclera';
  if (id === 'limbus') return 'limbus';
  if (id === 'cornea') return 'cornea';
  if (id === 'bulbar-conjunctiva') return 'conjunctiva';
  if (id.startsWith('palpebral-conjunctiva')) return 'palpebral-conjunctiva';
  if (id === 'iris' || id === 'left-iris') return 'iris';
  if (id.startsWith('ciliary-') && s.layer === 'uvea') return 'ciliary';
  if (id === 'choroid') return 'choroid';
  if (id === 'retina' || id === 'left-retina') return 'retina';
  if (['ora-serrata', 'macula', 'fovea', 'optic-disc'].includes(id)) return id;
  if (id === 'lens' || id === 'left-lens') return 'lens';
  if (id === 'zonule') return 'zonule';
  if (id === 'aqueous-humour' || id === 'vitreous') return 'humour';
  if (id === 'trabecular-meshwork') return 'trabecular';
  if (id === 'schlemm-canal') return 'schlemm';
  if (['trochlea', 'common-tendinous-ring', 'check-ligaments'].includes(id)) return 'tendon';
  if (s.layer === 'muscle' || id === 'left-eye-muscles') return 'muscle';
  if (id === 'ciliary-ganglion') return 'ganglion';
  if (s.layer === 'nerve' || id === 'left-optic-nerve') return 'nerve';
  if (id.includes('vein')) return 'vein';
  if (s.layer === 'vessel') return 'artery';
  if (id === 'lacrimal-gland') return 'gland';
  if (id === 'lacrimal-lake') return 'tear-fluid';
  if (s.layer === 'tear') return 'tear-duct';
  if (id.startsWith('tarsal')) return 'tarsal';
  if (s.layer === 'bone') return 'bone';
  if (['optic-chiasm', 'optic-tract-right', 'optic-tract-left', 'optic-radiation-right', 'optic-radiation-left'].includes(id)) return 'white-matter';
  if (s.layer === 'pathway') return 'grey-matter';
  return 'tendon';
}

export function realLook(s: AnatomicalStructure): TissueLook {
  return REAL[kindOf(s)] ?? REAL.tendon!;
}

/** How see-through each clear medium is in its real look (1 = opaque). */
export function realOpacity(s: AnatomicalStructure): number {
  switch (kindOf(s)) {
    case 'cornea': return 0.1;
    case 'conjunctiva': return 0.16;
    case 'lens': return 0.22;
    case 'humour': return s.id === 'vitreous' ? 0.05 : 0.04;
    case 'tear-fluid': return 0.45;
    case 'zonule': return 0.75;
    // The macula and fovea are darker areas of the retina, not raised layers: they tint it.
    case 'macula': return 0.45;
    case 'fovea': return 0.6;
    default: return 1;
  }
}

/** One hue per layer (Colour: Layers). */
export const LAYER_COLOUR: Record<string, string> = {
  fibrous: '#f2efe6', conjunctiva: '#9fd0e0', uvea: '#8a5a3c', retina: '#e8754a', lens: '#f2d06a', chambers: '#7fc4d8',
  muscle: '#c8463a', nerve: '#f0d060', vessel: '#d0304a', tear: '#5aa0e0', eyelid: '#e0a0b0', 'lid-lining': '#e08a90', bone: '#d8c8a0', 'left-eye': '#b8b0d8', pathway: '#9a78c8',
};
/** Groups use the colour of their layer; the three tunics get distinct colours for the layers tour. */
const GROUP_COLOUR: Record<string, string> = { 'fibrous-tunic': '#f2efe6', 'vascular-tunic': '#8a5a3c', 'neural-tunic': '#e8754a' };

/** The colour a structure shows in the current colour mode. */
export function baseColour(s: AnatomicalStructure, colourBy: ColourBy): string {
  if (s.kind === 'group') return GROUP_COLOUR[s.id] ?? LAYER_COLOUR[s.layer] ?? realLook(s).color;
  if (colourBy === 'layer') return LAYER_COLOUR[s.layer] ?? realLook(s).color;
  return realLook(s).color;
}

/** Iris stroma colours by melanin (Colour of the eyes is a display option). */
export const IRIS_COLOURS = {
  brown: { stroma: '#5a321c', collarette: '#7a4a28', ring: '#2a160c' },
  hazel: { stroma: '#6e5a2e', collarette: '#9a6a30', ring: '#3a2a12' },
  green: { stroma: '#5e7a4a', collarette: '#9a8a48', ring: '#2e3a22' },
  blue: { stroma: '#6a8aa8', collarette: '#9aa8b8', ring: '#2e3a4a' },
} as const;

/** Tears, light rays and the visual fields' two halves. */
export const TEAR = '#7cc8f0';
export const LIGHT_RAY = '#ffe680';
export const RAY_LOW = '#ff9a4a';
export const FIELD_LEFT = '#3a9ae8';
export const FIELD_RIGHT = '#f08a2a';
export const SIGNAL = '#ffe680';

export const HIGHLIGHT = '#ffc94d';
export const HOVER = '#ffe7a8';

/** Cut-surface colours: what a slice through each tissue shows. */
const CUT: Record<string, string> = {
  sclera: '#e6ddcf', limbus: '#d6cec2', cornea: '#dfe8ec', conjunctiva: '#efe0dc', 'palpebral-conjunctiva': '#d4867c',
  iris: '#4a2a18', ciliary: '#2e1a12', choroid: '#3e140f', retina: '#c86a50', 'ora-serrata': '#b87860', macula: '#9a4a32', fovea: '#7a3020', 'optic-disc': '#e8c09a',
  lens: '#efe0b0', zonule: '#e6dece', humour: '#dce8ec', trabecular: '#bba892', schlemm: '#7a3e3e',
  muscle: '#963228', tendon: '#ded6c4', nerve: '#e8d6a0', ganglion: '#dcbc82', artery: '#9a2024', vein: '#4a2440',
  gland: '#cc967e', 'tear-fluid': '#cfe4ea', 'tear-duct': '#d49a8c', tarsal: '#dcc4b0', bone: '#dccdaa', 'white-matter': '#e6dac2', 'grey-matter': '#b8948a',
};
export function cutColour(s: AnatomicalStructure): string {
  return CUT[kindOf(s)] ?? '#c9a090';
}
