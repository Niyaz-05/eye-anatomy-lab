import type { AnatomicalStructure, SimulationDefinition } from '../contract/schema';

/**
 * The eye lab as data. Function statements follow the cited OpenStax sections (A&P 2e §14.1–14.2,
 * §13.4, §15.2; Biology 2e §36.5); where a source gives only a location, the text says so.
 */

const EYE = ['openstax-senses', 'hra-eye'] as const;
const EYE_U = ['openstax-senses', 'hra-united'] as const;
const NERVE = ['openstax-cranial-nerves', 'bodyparts3d'] as const;
const ORBIT = ['openstax-senses', 'bodyparts3d'] as const;
const PATH = ['openstax-central', 'hra-brain'] as const;

type M = Omit<AnatomicalStructure, 'kind' | 'synonyms' | 'related'> & { synonyms?: string[]; related?: string[] };
const mesh = (s: M): AnatomicalStructure => ({ ...s, kind: 'mesh', synonyms: s.synonyms ?? [], related: s.related ?? [] });
const group = (s: Omit<M, 'organ'> & { members: string[] }): AnatomicalStructure => ({ ...s, kind: 'group', synonyms: s.synonyms ?? [], related: s.related ?? [] });

const RECTUS_ORIGIN = 'It arises from the common tendinous ring at the back of the orbit and inserts on the sclera in front of the eye’s equator.';

const structures: AnatomicalStructure[] = [
  // ── Groups ────────────────────────────────────────────────────────────────
  group({
    id: 'fibrous-tunic', label: 'Fibrous tunic', synonyms: ['outer layer of the eye', 'white of the eye'], layer: 'fibrous', side: 'right',
    members: ['cornea', 'limbus', 'sclera'],
    summary: 'The tough outer coat of the eyeball: the clear cornea at the front and the white sclera over the rest, joined at the limbus.',
    function: 'Gives the eye its shape and protects it. The cornea lets light in and does most of the focusing; the sclera is where the eye muscles attach.',
    related: ['vascular-tunic', 'neural-tunic'], sources: [...EYE],
  }),
  group({
    id: 'vascular-tunic', label: 'Vascular tunic (uvea)', synonyms: ['uvea', 'uveal tract', 'middle layer of the eye'], layer: 'uvea', side: 'right',
    members: ['iris', 'ciliary-body', 'ciliary-muscle', 'ciliary-processes', 'choroid'],
    summary: 'The middle, pigmented coat of the eye: the iris at the front, the ciliary body around the lens, and the choroid lining the back.',
    function: 'Supplies blood to the eye, absorbs stray light, controls the size of the pupil (iris) and the shape of the lens (ciliary body).',
    related: ['fibrous-tunic', 'neural-tunic'], sources: [...EYE],
  }),
  group({
    id: 'neural-tunic', label: 'Neural tunic (retina)', synonyms: ['inner layer of the eye', 'retina'], layer: 'retina', side: 'right',
    members: ['retina', 'ora-serrata', 'macula', 'fovea', 'optic-disc'],
    summary: 'The inner coat of the eye: the light-sensitive retina, from the ora serrata at the front to the optic disc at the back.',
    function: 'Turns light into nerve signals. Rods work in dim light; cones give colour and fine detail and are packed most densely in the fovea.',
    related: ['optic-nerve'], sources: [...EYE],
  }),
  group({
    id: 'eye-muscles', label: 'Extraocular muscles', synonyms: ['eye muscles', 'extrinsic eye muscles'], layer: 'muscle', side: 'right',
    members: ['lateral-rectus', 'medial-rectus', 'superior-rectus', 'inferior-rectus', 'superior-oblique', 'inferior-oblique'],
    summary: 'The six muscles that move the eyeball: four straight (rectus) muscles and two obliques.',
    function: 'They turn the eye up, down, in, out and around its axis, and keep the two eyes pointing at the same thing. The lateral rectus is supplied by the abducens nerve (VI), the superior oblique by the trochlear nerve (IV), and the others by the oculomotor nerve (III): “LR6 SO4”.',
    related: ['oculomotor-superior', 'oculomotor-inferior', 'trochlear-nerve'], sources: ['openstax-senses', 'openstax-cranial-nerves', 'hra-united'],
  }),
  group({
    id: 'tear-system', label: 'Lacrimal apparatus', synonyms: ['tear system', 'tears', 'tear duct'], layer: 'tear', side: 'right',
    members: ['lacrimal-gland', 'lacrimal-lake', 'lacrimal-canaliculi', 'lacrimal-sac', 'nasolacrimal-duct'],
    summary: 'The tear gland above the outer corner of the eye and the ducts that drain tears from the inner corner into the nose.',
    function: 'Tears keep the cornea moist, wash away dust and contain lysozyme, an enzyme that kills bacteria. Blinking spreads them across the eye towards the inner corner, where they drain into the nasal cavity.',
    related: ['bulbar-conjunctiva'], sources: [...ORBIT],
  }),
  group({
    id: 'bony-orbit', label: 'Bony orbit', synonyms: ['eye socket', 'orbit'], layer: 'bone', side: 'right',
    members: ['frontal-bone', 'sphenoid-bone', 'ethmoid-bone', 'maxilla', 'zygomatic-bone', 'lacrimal-bone', 'palatine-bone'],
    summary: 'The bony socket around the eye, built from seven bones: frontal, sphenoid, ethmoid, maxilla, zygomatic, lacrimal and palatine.',
    function: 'Protects the eye and gives origin to its muscles. Fat cushions the eye inside it (not shown).',
    related: ['eye-muscles'], sources: ['openstax-skull', 'bodyparts3d'],
  }),
  group({
    id: 'visual-pathway', label: 'Visual pathway', synonyms: ['optic pathway'], layer: 'pathway', side: 'midline',
    members: ['optic-nerve', 'left-optic-nerve', 'optic-chiasm', 'optic-tract-right', 'optic-tract-left', 'lgn-right', 'lgn-left', 'optic-radiation-right', 'optic-radiation-left', 'visual-cortex-right', 'visual-cortex-left'],
    summary: 'The route of visual signals: optic nerves, optic chiasm, optic tracts, lateral geniculate nuclei of the thalamus, optic radiations and the visual cortex of the occipital lobe.',
    function: 'At the optic chiasm the fibres from the nasal half of each retina cross over. So each side of the brain receives the opposite half of the visual world from both eyes.',
    related: ['retina'], sources: [...PATH],
  }),

  // ── Fibrous tunic and conjunctiva ─────────────────────────────────────────
  mesh({
    id: 'cornea', label: 'Cornea', synonyms: ['clear window of the eye'], layer: 'fibrous', side: 'right', organ: 'fibrous-tunic',
    summary: 'The clear, curved window at the front of the eye, about 0.5 mm thick, with no blood vessels.',
    function: 'Light enters the eye here. Its curved surface does about two thirds of the eye’s focusing (about 42 dioptres of the eye’s 60).',
    modelNote: 'In this HuBMAP eye the cornea is about 12.7 mm across.',
    related: ['lens', 'aqueous-humour', 'limbus'], sources: ['openstax-senses', 'hra-eye', 'legrand'],
  }),
  mesh({ id: 'limbus', label: 'Limbus (corneoscleral junction)', synonyms: ['corneoscleral junction', 'corneal limbus'], layer: 'fibrous', side: 'right', organ: 'fibrous-tunic', summary: 'The ring where the clear cornea meets the white sclera.', function: 'The drainage tissue of the eye (trabecular meshwork and Schlemm’s canal) lies just inside it.', related: ['cornea', 'sclera', 'schlemm-canal'], sources: [...EYE] }),
  mesh({ id: 'sclera', label: 'Sclera', synonyms: ['white of the eye'], layer: 'fibrous', side: 'right', organ: 'fibrous-tunic', summary: 'The tough white coat covering most of the eyeball.', function: 'Protects the eye and keeps its shape; the eye muscles insert on it, and the optic nerve leaves through it at the back.', related: ['cornea', 'choroid'], sources: [...EYE] }),
  mesh({ id: 'bulbar-conjunctiva', label: 'Bulbar conjunctiva', synonyms: ['conjunctiva'], layer: 'conjunctiva', side: 'right', summary: 'A thin, clear membrane over the white of the eye, continuous with the lining of the eyelids.', function: 'Its mucus and the tears keep the front of the eye moist; when its vessels widen the eye looks “red”.', related: ['palpebral-conjunctiva-upper', 'tear-system'], sources: [...EYE] }),
  mesh({ id: 'palpebral-conjunctiva-upper', label: 'Conjunctiva of the upper eyelid', synonyms: ['palpebral conjunctiva'], layer: 'lid-lining', side: 'right', summary: 'The clear membrane lining the inside of the upper eyelid.', function: 'Continues from the bulbar conjunctiva; together they form a moist sac over the front of the eye.', modelNote: 'The Visible Human’s eyes were closed, so in this model the lid lining covers the front of the eye. Its layer is off by default.', related: ['bulbar-conjunctiva', 'tarsal-plate-upper'], sources: [...EYE] }),
  mesh({ id: 'palpebral-conjunctiva-lower', label: 'Conjunctiva of the lower eyelid', synonyms: ['palpebral conjunctiva'], layer: 'lid-lining', side: 'right', summary: 'The clear membrane lining the inside of the lower eyelid.', function: 'Continues from the bulbar conjunctiva; together they form a moist sac over the front of the eye.', related: ['bulbar-conjunctiva', 'tarsal-plate-lower'], sources: [...EYE] }),
  mesh({ id: 'tarsal-plate-upper', label: 'Tarsal plate of the upper eyelid', synonyms: ['upper tarsus', 'eyelid'], layer: 'eyelid', side: 'right', summary: 'A plate of dense connective tissue that stiffens the upper eyelid.', function: 'Gives the eyelid its shape; its glands add oil to the tears so they do not evaporate. The levator palpebrae superioris lifts it.', related: ['levator-palpebrae'], sources: [...ORBIT] }),
  mesh({ id: 'tarsal-plate-lower', label: 'Tarsal plate of the lower eyelid', synonyms: ['lower tarsus', 'eyelid'], layer: 'eyelid', side: 'right', summary: 'The smaller plate of dense connective tissue in the lower eyelid.', function: 'Gives the lower eyelid its shape; its glands add oil to the tears.', sources: [...ORBIT] }),

  // ── Uvea ──────────────────────────────────────────────────────────────────
  mesh({
    id: 'iris', label: 'Iris', synonyms: ['coloured part of the eye', 'pupil'], layer: 'uvea', side: 'right', organ: 'vascular-tunic',
    summary: 'The coloured ring of muscle in front of the lens, with the pupil at its centre.',
    function: 'Controls how much light enters. In bright light the circular sphincter pupillae (parasympathetic, via the oculomotor nerve) narrows the pupil; in dim light the radial dilator pupillae (sympathetic) widens it. Its colour comes from melanin: much in brown eyes, little in blue.',
    modelNote: 'The pupil in this HuBMAP eye is 3.0 mm across; the Vision panel changes it with the light level.',
    related: ['lens', 'ciliary-body', 'ciliary-nerves'], sources: ['openstax-senses', 'openstax-autonomic', 'hra-eye'],
  }),
  mesh({ id: 'ciliary-body', label: 'Ciliary body', layer: 'uvea', side: 'right', organ: 'vascular-tunic', summary: 'The ring of tissue between the iris and the choroid, around the lens.', function: 'Holds the lens by the zonule fibres, contains the ciliary muscle that changes the lens’s shape, and makes the aqueous humour.', related: ['ciliary-muscle', 'ciliary-processes', 'zonule'], sources: [...EYE] }),
  mesh({ id: 'ciliary-muscle', label: 'Ciliary muscle', layer: 'uvea', side: 'right', organ: 'vascular-tunic', summary: 'Smooth muscle in the ciliary body.', function: 'Focusing on near objects (accommodation): it contracts, the ring narrows, the zonule fibres slacken and the elastic lens rounds up and becomes stronger. Relaxed, the zonules pull the lens flatter for distance.', related: ['lens', 'zonule'], sources: [...EYE] }),
  mesh({ id: 'ciliary-processes', label: 'Ciliary processes', layer: 'uvea', side: 'right', organ: 'vascular-tunic', summary: 'About 70 folds on the inner surface of the ciliary body.', function: 'Make the aqueous humour and anchor the zonule fibres.', related: ['aqueous-humour', 'zonule'], sources: [...EYE] }),
  mesh({ id: 'choroid', label: 'Choroid', layer: 'uvea', side: 'right', organ: 'vascular-tunic', summary: 'The dark, blood-rich layer between the sclera and the retina.', function: 'Nourishes the outer retina (the rods and cones), and its pigment absorbs light that passes the retina so it does not scatter.', related: ['retina', 'sclera'], sources: [...EYE] }),

  // ── Retina ────────────────────────────────────────────────────────────────
  mesh({
    id: 'retina', label: 'Retina', synonyms: ['photoreceptors', 'rods', 'cones'], layer: 'retina', side: 'right', organ: 'neural-tunic',
    summary: 'The thin light-sensitive layer lining the back of the eye.',
    function: 'Light passes through the ganglion and bipolar cells to reach the rods and cones at the back. About 120 million rods sense dim light; about 6 million cones sense colour (red, green and blue types) and detail. Signals go back through bipolar cells to the ganglion cells, whose axons form the optic nerve.',
    modelNote: 'The image the lens forms here is upside down and reversed; the brain interprets it.',
    related: ['macula', 'fovea', 'optic-disc', 'choroid'], sources: ['openstax-senses', 'openstax-bio-vision', 'hra-eye'],
  }),
  mesh({ id: 'ora-serrata', label: 'Ora serrata', layer: 'retina', side: 'right', organ: 'neural-tunic', summary: 'The serrated front edge of the light-sensitive retina, just behind the ciliary body.', function: 'Marks where the seeing part of the retina ends.', related: ['retina', 'ciliary-body'], sources: [...EYE] }),
  mesh({ id: 'macula', label: 'Macula lutea', synonyms: ['macula', 'yellow spot'], layer: 'retina', side: 'right', organ: 'neural-tunic', summary: 'A small yellowish area at the centre of the retina, on the eye’s visual axis.', function: 'Packed with cones; gives the sharp central vision used for reading and recognising faces.', related: ['fovea'], sources: [...EYE] }),
  mesh({ id: 'fovea', label: 'Fovea centralis', synonyms: ['fovea', 'pit'], layer: 'retina', side: 'right', organ: 'neural-tunic', summary: 'A pit at the centre of the macula, about 1.5 mm across.', function: 'The point of sharpest vision. Only cones are present (about 199,000 per mm² at the centre), and the inner retinal layers are pushed aside so light reaches them directly.', related: ['macula'], sources: ['openstax-senses', 'curcio-1990', 'hra-eye'] }),
  mesh({ id: 'optic-disc', label: 'Optic disc', synonyms: ['blind spot', 'optic nerve head'], layer: 'retina', side: 'right', organ: 'neural-tunic', summary: 'The pale circle, on the nose side of the fovea, where the optic nerve leaves the eye.', function: 'It has no rods or cones, so it makes a blind spot in each eye’s field; the brain fills it in. The central retinal artery and vein enter and leave here.', related: ['optic-nerve', 'central-retinal-artery'], sources: [...EYE] }),

  // ── Lens and chambers ─────────────────────────────────────────────────────
  mesh({ id: 'lens', label: 'Lens', synonyms: ['crystalline lens'], layer: 'lens', side: 'right', summary: 'A clear, flexible, biconvex lens behind the iris, held by the zonule.', function: 'Adjusts the focus: flatter for far objects, rounder (stronger) for near ones. With age it stiffens and cannot round up (presbyopia); clouding of it is a cataract.', modelNote: 'This HuBMAP lens is 8.0 mm across and 4.1 mm thick.', related: ['zonule', 'ciliary-muscle', 'cornea'], sources: ['openstax-senses', 'hra-eye', 'legrand'] }),
  mesh({ id: 'zonule', label: 'Zonule (suspensory ligament)', synonyms: ['suspensory ligament of the lens', 'zonular fibres'], layer: 'lens', side: 'right', summary: 'Fine fibres running from the ciliary body to the edge of the lens.', function: 'Hold the lens in place; their tension, set by the ciliary muscle, flattens the lens for distance vision.', related: ['lens', 'ciliary-muscle'], sources: [...EYE] }),
  mesh({ id: 'aqueous-humour', label: 'Aqueous humour', synonyms: ['aqueous humor', 'anterior chamber'], layer: 'chambers', side: 'right', summary: 'The clear watery fluid filling the space between the cornea and the lens.', function: 'Nourishes the cornea and lens, which have no blood vessels, and keeps the eye’s pressure. It is made by the ciliary processes and drains through the trabecular meshwork into Schlemm’s canal; if drainage is blocked, the pressure rises (glaucoma).', related: ['trabecular-meshwork', 'schlemm-canal', 'ciliary-processes'], sources: [...EYE] }),
  mesh({ id: 'trabecular-meshwork', label: 'Trabecular meshwork', layer: 'chambers', side: 'right', summary: 'A sponge-like ring of tissue in the angle between the iris and the cornea.', function: 'The filter through which aqueous humour leaves the eye.', related: ['schlemm-canal', 'aqueous-humour'], sources: [...EYE] }),
  mesh({ id: 'schlemm-canal', label: 'Schlemm’s canal', synonyms: ['scleral venous sinus', 'canal of Schlemm'], layer: 'chambers', side: 'right', summary: 'A ring-shaped channel in the limbus.', function: 'Carries the drained aqueous humour into the veins.', related: ['trabecular-meshwork', 'limbus'], sources: [...EYE] }),
  mesh({ id: 'vitreous', label: 'Vitreous humour', synonyms: ['vitreous body', 'vitreous humor'], layer: 'chambers', side: 'right', summary: 'The clear jelly filling the large chamber behind the lens.', function: 'Keeps the eyeball’s round shape and holds the retina against the choroid, while letting light pass.', related: ['retina', 'lens'], sources: [...EYE] }),

  // ── Muscles ───────────────────────────────────────────────────────────────
  mesh({ id: 'lateral-rectus', label: 'Lateral rectus', layer: 'muscle', side: 'right', organ: 'eye-muscles', summary: 'The straight muscle on the outer side of the eye.', function: `Turns the eye outwards (abduction). Nerve: abducens (VI). ${RECTUS_ORIGIN}`, modelNote: 'The abducens nerve is not in the model.', related: ['medial-rectus'], sources: [...EYE_U] }),
  mesh({ id: 'medial-rectus', label: 'Medial rectus', layer: 'muscle', side: 'right', organ: 'eye-muscles', summary: 'The straight muscle on the nose side of the eye.', function: `Turns the eye inwards (adduction). Nerve: oculomotor (III). ${RECTUS_ORIGIN}`, related: ['lateral-rectus', 'oculomotor-inferior'], sources: [...EYE_U] }),
  mesh({ id: 'superior-rectus', label: 'Superior rectus', layer: 'muscle', side: 'right', organ: 'eye-muscles', summary: 'The straight muscle above the eye.', function: `Turns the eye up (elevation), and also inwards and rotates its top towards the nose. Nerve: oculomotor (III). ${RECTUS_ORIGIN}`, related: ['inferior-oblique', 'oculomotor-superior'], sources: [...EYE_U] }),
  mesh({ id: 'inferior-rectus', label: 'Inferior rectus', layer: 'muscle', side: 'right', organ: 'eye-muscles', summary: 'The straight muscle below the eye.', function: `Turns the eye down (depression), and also inwards and rotates its top away from the nose. Nerve: oculomotor (III). ${RECTUS_ORIGIN}`, related: ['superior-oblique', 'oculomotor-inferior'], sources: [...EYE_U] }),
  mesh({ id: 'superior-oblique', label: 'Superior oblique', layer: 'muscle', side: 'right', organ: 'eye-muscles', summary: 'A long muscle whose tendon loops through the trochlea (a pulley) near the inner top of the orbit and runs back to the eye.', function: 'Rotates the top of the eye towards the nose (intorsion), and turns it down and out; most effective in looking down and in. Nerve: trochlear (IV).', related: ['trochlea', 'trochlear-nerve'], sources: [...EYE_U] }),
  mesh({ id: 'inferior-oblique', label: 'Inferior oblique', layer: 'muscle', side: 'right', organ: 'eye-muscles', summary: 'The only eye muscle that starts at the front of the orbit floor, running under the eye to its back outer side.', function: 'Rotates the top of the eye away from the nose (extorsion), and turns it up and out; most effective in looking up and in. Nerve: oculomotor (III).', related: ['superior-rectus', 'oculomotor-inferior'], sources: [...EYE_U] }),
  mesh({ id: 'levator-palpebrae', label: 'Levator palpebrae superioris', synonyms: ['eyelid muscle'], layer: 'muscle', side: 'right', summary: 'A thin muscle above the superior rectus whose wide tendon enters the upper eyelid.', function: 'Raises the upper eyelid. Nerve: oculomotor (III); a drooping lid (ptosis) can be a sign of oculomotor nerve damage.', related: ['tarsal-plate-upper', 'oculomotor-superior'], sources: [...ORBIT] }),
  mesh({ id: 'trochlea', label: 'Trochlea', synonyms: ['pulley of the superior oblique'], layer: 'muscle', side: 'right', summary: 'A loop of cartilage at the inner top of the orbit.', function: 'The pulley through which the superior oblique’s tendon turns towards the eye.', related: ['superior-oblique'], sources: [...ORBIT] }),
  mesh({ id: 'common-tendinous-ring', label: 'Common tendinous ring', synonyms: ['annulus of Zinn', 'annular tendon'], layer: 'muscle', side: 'right', summary: 'A ring of tendon around the optic canal at the back of the orbit.', function: 'The origin of the four rectus muscles; the optic nerve and several orbital nerves pass through it.', related: ['eye-muscles', 'optic-nerve'], sources: [...ORBIT] }),
  mesh({ id: 'check-ligaments', label: 'Check ligaments', layer: 'muscle', side: 'right', summary: 'Bands from the sheaths of the medial and lateral recti to the orbit walls.', function: 'Limit how far the eye can turn in and out.', related: ['medial-rectus', 'lateral-rectus'], sources: [...ORBIT] }),

  // ── Nerves ────────────────────────────────────────────────────────────────
  mesh({ id: 'optic-nerve', label: 'Optic nerve (right)', synonyms: ['cranial nerve II', 'CN II', 'second cranial nerve'], layer: 'nerve', side: 'right', summary: 'Cranial nerve II, about 1 million ganglion-cell axons, leaving the back of the eye for the optic chiasm.', function: 'Carries visual signals from the retina to the brain. It is purely sensory.', related: ['optic-disc', 'optic-chiasm'], sources: ['openstax-cranial-nerves', 'hra-united'] }),
  mesh({ id: 'oculomotor-superior', label: 'Oculomotor nerve, superior branch', synonyms: ['cranial nerve III', 'CN III'], layer: 'nerve', side: 'right', summary: 'The upper branch of cranial nerve III in the orbit.', function: 'Supplies the superior rectus and the levator palpebrae superioris.', related: ['superior-rectus', 'levator-palpebrae'], sources: [...NERVE] }),
  mesh({ id: 'oculomotor-inferior', label: 'Oculomotor nerve, inferior branch', synonyms: ['cranial nerve III', 'CN III'], layer: 'nerve', side: 'right', summary: 'The lower branch of cranial nerve III in the orbit.', function: 'Supplies the medial rectus, inferior rectus and inferior oblique, and carries the parasympathetic fibres to the ciliary ganglion that narrow the pupil and focus the lens.', related: ['ciliary-ganglion', 'medial-rectus', 'inferior-rectus', 'inferior-oblique'], sources: ['openstax-cranial-nerves', 'openstax-autonomic', 'bodyparts3d'] }),
  mesh({ id: 'trochlear-nerve', label: 'Trochlear nerve', synonyms: ['cranial nerve IV', 'CN IV'], layer: 'nerve', side: 'right', summary: 'Cranial nerve IV, the thinnest cranial nerve.', function: 'Supplies one muscle, the superior oblique.', related: ['superior-oblique'], sources: [...NERVE] }),
  mesh({ id: 'ophthalmic-nerve', label: 'Ophthalmic nerve', synonyms: ['V1', 'ophthalmic division of trigeminal'], layer: 'nerve', side: 'right', summary: 'The first division of the trigeminal nerve (V1), dividing into the frontal, lacrimal and nasociliary nerves.', function: 'Carries touch and pain from the eye, upper eyelid, forehead and nose. Touching the cornea triggers a blink through it (the corneal reflex).', related: ['frontal-nerve', 'lacrimal-nerve', 'nasociliary-nerve'], sources: [...NERVE] }),
  mesh({ id: 'nasociliary-nerve', label: 'Nasociliary nerve', layer: 'nerve', side: 'right', summary: 'A branch of the ophthalmic nerve crossing above the optic nerve to the inner side of the orbit.', function: 'Carries sensation from the eyeball, including the cornea (through the long ciliary nerves), and from parts of the nose.', related: ['ciliary-nerves', 'ophthalmic-nerve'], sources: [...NERVE] }),
  mesh({ id: 'frontal-nerve', label: 'Frontal nerve and its branches', synonyms: ['supra-orbital nerve', 'supratrochlear nerve'], layer: 'nerve', side: 'right', summary: 'The largest branch of the ophthalmic nerve, running forward above the levator and dividing into the supra-orbital and supratrochlear nerves.', function: 'Carries sensation from the upper eyelid, forehead and scalp.', related: ['ophthalmic-nerve'], sources: [...NERVE] }),
  mesh({ id: 'lacrimal-nerve', label: 'Lacrimal nerve', layer: 'nerve', side: 'right', summary: 'The smallest branch of the ophthalmic nerve, running along the outer wall of the orbit to the lacrimal gland.', function: 'Carries sensation from the gland and the outer upper eyelid; the fibres that make the gland secrete tears join it on the way.', related: ['lacrimal-gland'], sources: [...NERVE] }),
  mesh({ id: 'infratrochlear-nerve', label: 'Infratrochlear nerve', layer: 'nerve', side: 'right', summary: 'A branch of the nasociliary nerve passing below the trochlea.', function: 'Carries sensation from the inner corner of the eye and the lacrimal sac.', related: ['nasociliary-nerve'], sources: [...NERVE] }),
  mesh({ id: 'ethmoidal-nerves', label: 'Ethmoidal nerves', synonyms: ['anterior ethmoidal nerve', 'posterior ethmoidal nerve'], layer: 'nerve', side: 'right', summary: 'Anterior and posterior branches of the nasociliary nerve that leave the orbit through its inner wall.', function: 'Carry sensation from the sinuses and the nasal cavity.', related: ['nasociliary-nerve'], sources: [...NERVE] }),
  mesh({ id: 'ciliary-ganglion', label: 'Ciliary ganglion', layer: 'nerve', side: 'right', summary: 'A small parasympathetic ganglion beside the optic nerve, behind the eye.', function: 'Relays the oculomotor nerve’s parasympathetic signals, through the short ciliary nerves, to the iris sphincter (narrowing the pupil) and the ciliary muscle (focusing near).', related: ['oculomotor-inferior', 'ciliary-nerves'], sources: ['openstax-autonomic', 'bodyparts3d'] }),
  mesh({ id: 'ciliary-nerves', label: 'Ciliary nerves', synonyms: ['short ciliary nerves', 'long ciliary nerves'], layer: 'nerve', side: 'right', summary: 'Fine nerves that pierce the sclera around the optic nerve.', function: 'The short ciliary nerves carry the pupil-narrowing and focusing signals from the ciliary ganglion; the long ciliary nerves carry sensation from the cornea and sympathetic fibres to the dilator pupillae.', related: ['ciliary-ganglion', 'iris'], sources: ['openstax-autonomic', 'bodyparts3d'] }),

  // ── Vessels ───────────────────────────────────────────────────────────────
  mesh({ id: 'ophthalmic-artery', label: 'Ophthalmic artery', layer: 'vessel', side: 'right', summary: 'A branch of the internal carotid artery entering the orbit with the optic nerve.', function: 'Supplies the eye and orbit; its branches include the central retinal artery and the ciliary arteries.', related: ['central-retinal-artery', 'posterior-ciliary-arteries'], sources: [...EYE_U] }),
  mesh({ id: 'central-retinal-artery', label: 'Central retinal artery', layer: 'vessel', side: 'right', summary: 'A small artery running inside the optic nerve to the optic disc.', function: 'Supplies the inner layers of the retina; its branches are the vessels a doctor sees spreading from the optic disc.', related: ['optic-disc', 'central-retinal-vein'], sources: [...EYE_U] }),
  mesh({ id: 'central-retinal-vein', label: 'Central retinal vein', layer: 'vessel', side: 'right', summary: 'The vein that leaves the retina at the optic disc, beside the artery.', function: 'Drains blood from the retina.', related: ['central-retinal-artery'], sources: [...EYE_U] }),
  mesh({ id: 'posterior-ciliary-arteries', label: 'Posterior ciliary arteries', layer: 'vessel', side: 'right', summary: 'Branches of the ophthalmic artery that pierce the sclera around the optic nerve.', function: 'Supply the choroid, which nourishes the rods and cones, and the ciliary body and iris.', related: ['choroid', 'ophthalmic-artery'], sources: [...EYE_U] }),
  mesh({ id: 'ophthalmic-veins', label: 'Ophthalmic veins', synonyms: ['superior ophthalmic vein', 'inferior ophthalmic vein'], layer: 'vessel', side: 'right', summary: 'The superior and inferior ophthalmic veins of the orbit.', function: 'Drain the eye and orbit back towards the cavernous sinus.', sources: [...EYE_U] }),

  // ── Tear system ───────────────────────────────────────────────────────────
  mesh({ id: 'lacrimal-gland', label: 'Lacrimal gland', synonyms: ['tear gland'], layer: 'tear', side: 'right', organ: 'tear-system', summary: 'An almond-sized gland in a hollow of the frontal bone above the outer corner of the eye.', function: 'Makes tears, which flow through about a dozen small ducts onto the eye above its outer corner.', related: ['lacrimal-nerve'], sources: [...ORBIT] }),
  mesh({ id: 'lacrimal-lake', label: 'Lacrimal lake', synonyms: ['lacus lacrimalis', 'inner corner of the eye'], layer: 'tear', side: 'right', organ: 'tear-system', summary: 'The small pool of tears at the inner corner of the eye.', function: 'Tears collect here and drain into the two tiny openings (puncta) on the eyelid edges.', related: ['lacrimal-canaliculi'], sources: [...ORBIT] }),
  mesh({ id: 'lacrimal-canaliculi', label: 'Lacrimal canaliculi', synonyms: ['puncta', 'tear ducts'], layer: 'tear', side: 'right', organ: 'tear-system', summary: 'Two fine channels starting at the puncta of the upper and lower eyelids.', function: 'Carry tears from the inner corner to the lacrimal sac.', related: ['lacrimal-sac'], sources: [...ORBIT] }),
  mesh({ id: 'lacrimal-sac', label: 'Lacrimal sac', layer: 'tear', side: 'right', organ: 'tear-system', summary: 'A small sac in a groove of the lacrimal bone beside the nose.', function: 'Collects tears from the canaliculi and passes them into the nasolacrimal duct.', related: ['nasolacrimal-duct', 'lacrimal-bone'], sources: [...ORBIT] }),
  mesh({ id: 'nasolacrimal-duct', label: 'Nasolacrimal duct', layer: 'tear', side: 'right', organ: 'tear-system', summary: 'A duct about 2 cm long running down to the nasal cavity.', function: 'Drains tears into the nose under the inferior nasal concha; this is why your nose runs when you cry.', related: ['inferior-nasal-concha'], sources: [...ORBIT] }),

  // ── Bony orbit ────────────────────────────────────────────────────────────
  mesh({ id: 'frontal-bone', label: 'Frontal bone', layer: 'bone', side: 'midline', summary: 'The bone of the forehead; its orbital plates form the roof of each orbit.', function: 'Protects the front of the brain and roofs the orbits; the lacrimal gland sits in a hollow on its orbital surface.', sources: ['openstax-skull', 'bodyparts3d'] }),
  mesh({ id: 'sphenoid-bone', label: 'Sphenoid bone', layer: 'bone', side: 'midline', summary: 'A butterfly-shaped bone at the base of the skull forming the back of the orbit.', function: 'Contains the optic canal, through which the optic nerve and ophthalmic artery enter the orbit.', related: ['optic-nerve'], sources: ['openstax-skull', 'bodyparts3d'] }),
  mesh({ id: 'ethmoid-bone', label: 'Ethmoid bone', layer: 'bone', side: 'midline', summary: 'A light, air-filled bone between the orbits.', function: 'Its thin orbital plate forms most of the inner wall of the orbit.', sources: ['openstax-skull', 'bodyparts3d'] }),
  mesh({ id: 'maxilla', label: 'Maxilla (right)', synonyms: ['upper jaw'], layer: 'bone', side: 'right', summary: 'The upper jaw bone; its orbital surface forms most of the orbit floor.', function: 'Holds the upper teeth and floors the orbit; the nasolacrimal duct runs down beside it.', sources: ['openstax-skull', 'bodyparts3d'] }),
  mesh({ id: 'zygomatic-bone', label: 'Zygomatic bone (right)', synonyms: ['cheekbone'], layer: 'bone', side: 'right', summary: 'The cheekbone, forming the outer wall and rim of the orbit.', function: 'Protects the side of the eye.', sources: ['openstax-skull', 'bodyparts3d'] }),
  mesh({ id: 'lacrimal-bone', label: 'Lacrimal bone (right)', layer: 'bone', side: 'right', summary: 'The smallest facial bone, in the inner wall of the orbit.', function: 'Its groove holds the lacrimal sac.', related: ['lacrimal-sac'], sources: ['openstax-skull', 'bodyparts3d'] }),
  mesh({ id: 'palatine-bone', label: 'Palatine bone (right)', layer: 'bone', side: 'right', summary: 'An L-shaped bone at the back of the nasal cavity; a small tip reaches the orbit floor.', function: 'Forms part of the hard palate and the nasal cavity.', sources: ['openstax-skull', 'bodyparts3d'] }),
  mesh({ id: 'nasal-bone', label: 'Nasal bone (right)', layer: 'bone', side: 'right', summary: 'One of the two small bones forming the bridge of the nose.', function: 'Shapes the bridge of the nose.', sources: ['openstax-skull', 'bodyparts3d'] }),
  mesh({ id: 'inferior-nasal-concha', label: 'Inferior nasal concha (right)', layer: 'bone', side: 'right', summary: 'A curled bone on the side wall of the nasal cavity.', function: 'Warms and moistens the air; the nasolacrimal duct opens below it.', related: ['nasolacrimal-duct'], sources: ['openstax-skull', 'bodyparts3d'] }),

  // ── Left eye and visual pathway ───────────────────────────────────────────
  mesh({ id: 'left-eyeball', label: 'Left eyeball', layer: 'left-eye', side: 'left', summary: 'The left eye’s sclera and cornea.', function: 'Both eyes see most of the world together, from slightly different angles, which gives depth (stereo) vision.', modelNote: 'From the HuBMAP female body; simpler than the detailed right eye.', related: ['left-optic-nerve'], sources: [...EYE_U] }),
  mesh({ id: 'left-iris', label: 'Left iris', layer: 'left-eye', side: 'left', summary: 'The iris of the left eye.', function: 'Both pupils narrow when light falls on either eye (the consensual light reflex).', sources: [...EYE_U] }),
  mesh({ id: 'left-lens', label: 'Left lens', layer: 'left-eye', side: 'left', summary: 'The lens of the left eye.', function: 'Focuses light on the left retina.', sources: [...EYE_U] }),
  mesh({ id: 'left-retina', label: 'Left retina', layer: 'left-eye', side: 'left', summary: 'The retina of the left eye, with its macula, fovea and optic disc.', function: 'Its nasal half sends fibres that cross at the chiasm; its temporal half’s fibres stay on the left.', sources: [...EYE_U] }),
  mesh({ id: 'left-eye-muscles', label: 'Left eye muscles', layer: 'left-eye', side: 'left', summary: 'The six extraocular muscles of the left eye.', function: 'Move the left eye together with the right, so both point at the same thing.', sources: [...EYE_U] }),
  mesh({ id: 'left-optic-nerve', label: 'Optic nerve (left)', synonyms: ['cranial nerve II'], layer: 'pathway', side: 'left', organ: 'visual-pathway', summary: 'The left eye’s optic nerve.', function: 'Carries the left eye’s signals to the optic chiasm.', related: ['optic-chiasm'], sources: ['openstax-cranial-nerves', 'hra-united'] }),
  mesh({ id: 'optic-chiasm', label: 'Optic chiasm', synonyms: ['chiasma'], layer: 'pathway', side: 'midline', organ: 'visual-pathway', summary: 'The X-shaped crossing of the optic nerves just above the pituitary gland.', function: 'Fibres from the nasal half of each retina cross to the other side; fibres from the temporal halves do not. A pituitary tumour pressing here takes away both outer halves of vision (bitemporal hemianopia).', related: ['optic-nerve', 'optic-tract-right'], sources: [...PATH] }),
  mesh({ id: 'optic-tract-right', label: 'Right optic tract', layer: 'pathway', side: 'right', organ: 'visual-pathway', summary: 'The fibre bundle from the chiasm around the brainstem to the right lateral geniculate nucleus.', function: 'Carries the left half of the visual world from both eyes.', related: ['lgn-right', 'optic-chiasm'], sources: [...PATH] }),
  mesh({ id: 'optic-tract-left', label: 'Left optic tract', layer: 'pathway', side: 'left', organ: 'visual-pathway', summary: 'The fibre bundle from the chiasm to the left lateral geniculate nucleus.', function: 'Carries the right half of the visual world from both eyes.', related: ['lgn-left', 'optic-chiasm'], sources: [...PATH] }),
  mesh({ id: 'lgn-right', label: 'Right lateral geniculate nucleus', synonyms: ['LGN', 'lateral geniculate body'], layer: 'pathway', side: 'right', organ: 'visual-pathway', summary: 'A relay nucleus at the back of the thalamus.', function: 'The optic tract fibres end here; new neurons carry the signals on through the optic radiation to the visual cortex.', related: ['optic-tract-right', 'optic-radiation-right'], sources: [...PATH] }),
  mesh({ id: 'lgn-left', label: 'Left lateral geniculate nucleus', synonyms: ['LGN', 'lateral geniculate body'], layer: 'pathway', side: 'left', organ: 'visual-pathway', summary: 'The relay nucleus of the thalamus on the left.', function: 'Relays the left optic tract’s signals to the left visual cortex.', related: ['optic-tract-left', 'optic-radiation-left'], sources: [...PATH] }),
  mesh({ id: 'optic-radiation-right', label: 'Right optic radiation', layer: 'pathway', side: 'right', organ: 'visual-pathway', summary: 'A fan of fibres running back through the brain from the lateral geniculate nucleus to the occipital lobe.', function: 'Carries the left half of the visual field to the right visual cortex.', modelNote: 'The HuBMAP brain shows the radiation as a simple, coarse shape.', related: ['lgn-right', 'visual-cortex-right'], sources: [...PATH] }),
  mesh({ id: 'optic-radiation-left', label: 'Left optic radiation', layer: 'pathway', side: 'left', organ: 'visual-pathway', summary: 'The optic radiation of the left side.', function: 'Carries the right half of the visual field to the left visual cortex.', modelNote: 'The HuBMAP brain shows the radiation as a simple, coarse shape.', related: ['lgn-left', 'visual-cortex-left'], sources: [...PATH] }),
  mesh({ id: 'visual-cortex-right', label: 'Right visual cortex', synonyms: ['occipital lobe', 'primary visual cortex', 'V1', 'calcarine'], layer: 'pathway', side: 'right', organ: 'visual-pathway', summary: 'The cuneus, lingual gyrus and occipital pole of the right occipital lobe, around the calcarine sulcus.', function: 'The primary visual cortex, where seeing becomes conscious: it maps the left half of the visual field, with the fovea at the back (occipital pole).', related: ['optic-radiation-right'], sources: [...PATH] }),
  mesh({ id: 'visual-cortex-left', label: 'Left visual cortex', synonyms: ['occipital lobe', 'primary visual cortex', 'V1', 'calcarine'], layer: 'pathway', side: 'left', organ: 'visual-pathway', summary: 'The cuneus, lingual gyrus and occipital pole of the left occipital lobe.', function: 'Maps the right half of the visual field.', related: ['optic-radiation-left'], sources: [...PATH] }),
  mesh({ id: 'pretectal-area', label: 'Pretectal area', synonyms: ['pretectal nuclei'], layer: 'pathway', side: 'midline', summary: 'Nuclei in the midbrain just in front of the superior colliculi.', function: 'The centre of the pupillary light reflex: optic tract fibres reach it directly, and it signals both oculomotor (Edinger–Westphal) nuclei, so both pupils narrow when light falls on one eye.', related: ['superior-colliculi', 'oculomotor-inferior'], sources: ['openstax-autonomic', 'hra-brain'] }),
  mesh({ id: 'superior-colliculi', label: 'Superior colliculi', layer: 'pathway', side: 'midline', summary: 'Two bumps on the back of the midbrain.', function: 'Receive some optic tract fibres and turn the eyes and head towards something that catches the eye.', related: ['pretectal-area'], sources: ['openstax-central', 'hra-brain'] }),
];

const MID = [0, 0, 1] as const;

export const eyeDefinition: SimulationDefinition = {
  schemaVersion: 1,
  id: 'human-eye-anatomy',
  title: 'Human Eye',
  domain: 'biology',
  simulationType: '3d-anatomy',
  audience: 'Secondary school (Classes 10–12) and first-year undergraduate biology',
  summary:
    'Explore a realistic 3D right eye from the HuBMAP female reference organ, with its muscles, nerves, tear system and bony orbit, and the visual pathway to the brain. Trace light through the cornea and lens, focus near and far, correct short and long sight, watch the pupil react to light and the eye turn, follow tears, and see why each side of the brain sees the opposite half of the world.',
  learningObjectives: [
    { id: 'layers', text: 'Name the three layers of the eyeball and the parts of each.' },
    { id: 'focus', text: 'Explain how the cornea and lens focus light, and how the lens changes shape for near objects.' },
    { id: 'defects', text: 'Describe short sight, long sight and presbyopia, and how glasses correct them.' },
    { id: 'pupil', text: 'Describe the pupillary light reflex and the two muscles of the iris.' },
    { id: 'muscles', text: 'State the action and nerve of each of the six eye muscles.' },
    { id: 'retina', text: 'Compare rods and cones, and explain the fovea and the blind spot.' },
    { id: 'pathway', text: 'Trace the visual pathway and predict the field loss from damage at each point.' },
    { id: 'tears', text: 'Trace tears from the lacrimal gland to the nose.' },
  ],
  assets: [{ id: 'hra-eye-v1', role: 'anatomy-model' }],
  layers: [
    { id: 'fibrous', label: 'Cornea and sclera', description: 'The outer coat of the eye.', visibleByDefault: true },
    { id: 'conjunctiva', label: 'Conjunctiva', description: 'The clear membrane over the white of the eye.', visibleByDefault: true },
    { id: 'uvea', label: 'Iris, ciliary body and choroid', description: 'The middle, pigmented coat of the eye.', visibleByDefault: true },
    { id: 'retina', label: 'Retina', description: 'The light-sensitive inner coat, with the macula, fovea and optic disc.', visibleByDefault: true },
    { id: 'lens', label: 'Lens and zonule', description: 'The lens and the fibres that hold it.', visibleByDefault: true },
    { id: 'chambers', label: 'Humours and drainage', description: 'Aqueous and vitreous humour, trabecular meshwork and Schlemm’s canal.', visibleByDefault: true },
    { id: 'muscle', label: 'Eye muscles', description: 'The six extraocular muscles, the eyelid lifter and their tendons.', visibleByDefault: true },
    { id: 'nerve', label: 'Nerves', description: 'Optic nerve and the nerves of the orbit.', visibleByDefault: true },
    { id: 'vessel', label: 'Blood vessels', description: 'Ophthalmic, retinal and ciliary vessels.', visibleByDefault: true },
    { id: 'tear', label: 'Tear system', description: 'Lacrimal gland, canaliculi, sac and nasolacrimal duct.', visibleByDefault: true },
    { id: 'eyelid', label: 'Eyelid plates', description: 'The tarsal plates that stiffen the eyelids.', visibleByDefault: true },
    { id: 'lid-lining', label: 'Eyelid lining (eyes closed)', description: 'The conjunctiva lining the eyelids. The Visible Human’s eyes were closed, so it covers the front of the eye.', visibleByDefault: false },
    { id: 'bone', label: 'Bony orbit', description: 'The bones around the eye.', visibleByDefault: false },
    { id: 'left-eye', label: 'Left eye', description: 'The left eyeball, shown with the visual pathway.', visibleByDefault: false },
    { id: 'pathway', label: 'Visual pathway', description: 'Optic chiasm, tracts, thalamus relay and visual cortex.', visibleByDefault: false },
  ],
  structures,
  cameraPresets: [
    { id: 'anterior', label: 'Front', direction: [...MID] },
    { id: 'posterior', label: 'Back', direction: [0, 0, -1] },
    { id: 'left', label: 'Inner side', direction: [1, 0, 0] },
    { id: 'right', label: 'Outer side', direction: [-1, 0, 0] },
    { id: 'superior', label: 'Top', direction: [0, 1, 0.0001], up: [0, 0, -1] },
    { id: 'inferior', label: 'Bottom', direction: [0, -1, 0.0001], up: [0, 0, 1] },
    { id: 'oblique', label: '3/4', direction: [-0.6, 0.35, 0.72] },
  ],
  defaultCamera: 'oblique',
  tearRoute: {
    id: 'tear-route',
    label: 'The flow of tears',
    description: 'Tears are made all the time, not only when we cry. Blinking spreads them over the eye and sweeps them to the inner corner, where they drain into the nose.',
    steps: [
      { structure: 'lacrimal-gland', label: 'Lacrimal gland', note: 'Makes tears: water, salts, mucus and lysozyme, which kills bacteria.' },
      { offModel: 'blink', label: 'Blinking spreads the tears', note: 'About 15 to 20 times a minute the eyelids sweep the tear film across the cornea towards the inner corner.' },
      { structure: 'bulbar-conjunctiva', label: 'Across the front of the eye', note: 'The tear film keeps the cornea clear, smooth and moist.' },
      { structure: 'lacrimal-lake', label: 'Lacrimal lake', note: 'Tears collect at the inner corner and enter the puncta on the edges of the lids.' },
      { structure: 'lacrimal-canaliculi', label: 'Canaliculi', note: 'Two fine channels carry them to the lacrimal sac.' },
      { structure: 'lacrimal-sac', label: 'Lacrimal sac', note: 'Lies in a groove of the lacrimal bone.' },
      { structure: 'nasolacrimal-duct', label: 'Nasolacrimal duct', note: 'Runs down to open under the inferior nasal concha.' },
      { offModel: 'nasal-cavity', label: 'Into the nose', note: 'This is why the nose runs when you cry.' },
    ],
    facts: ['Tears contain lysozyme, an enzyme that breaks down bacterial walls.', 'When too many tears are made to drain, they spill over the lower lid.'],
    assumptions: ['The route through the ducts is computed through the BodyParts3D tear system, fitted to the HuBMAP eye; the flow is schematic and faster than in life.'],
    sources: ['openstax-senses', 'bodyparts3d'],
  },
  visualRoute: {
    id: 'visual-route',
    label: 'The visual pathway',
    description: 'How signals from the retina reach the visual cortex. Light from the left half of the world falls on the right half of each retina, and the right side of the brain sees it.',
    steps: [
      { offModel: 'photoreceptors', label: 'Rods and cones', note: 'Light is turned into nerve signals, passed through bipolar cells to ganglion cells.' },
      { structure: 'optic-disc', label: 'Optic disc', note: 'Ganglion-cell axons leave the eye here; no receptors, so this is the blind spot.' },
      { structure: 'optic-nerve', label: 'Optic nerve', note: 'About a million axons from one eye.' },
      { structure: 'optic-chiasm', label: 'Optic chiasm', note: 'Nasal-retina fibres cross; temporal-retina fibres stay on their own side.' },
      { structure: 'optic-tract-right', label: 'Optic tract', note: 'Each tract now carries the opposite half of the world from both eyes.' },
      { structure: 'lgn-right', label: 'Lateral geniculate nucleus', note: 'Relay in the thalamus.' },
      { structure: 'optic-radiation-right', label: 'Optic radiation', note: 'Fibres fan back through the brain.' },
      { structure: 'visual-cortex-right', label: 'Primary visual cortex', note: 'In the occipital lobe; the image becomes conscious and is interpreted.' },
    ],
    facts: [
      'The image on each retina is upside down and reversed; the brain turns it the right way.',
      'Damage at different points of the pathway causes different, predictable field losses.',
    ],
    assumptions: ['The fibre routes run through the HuBMAP nerves, chiasm, tracts and radiation; their paths inside them are approximate, and the optic radiation’s mesh is coarse.'],
    sources: ['openstax-central', 'hra-brain'],
  },
  pupilRoute: {
    id: 'pupil-route',
    label: 'The pupillary light reflex',
    description: 'Light shone into one eye narrows both pupils.',
    steps: [
      { structure: 'retina', label: 'Retina', note: 'Light-sensitive ganglion cells detect brightness.' },
      { structure: 'optic-nerve', label: 'Optic nerve and tract', note: 'Some fibres leave the tract before the thalamus.' },
      { structure: 'pretectal-area', label: 'Pretectal area', note: 'Signals both sides of the midbrain.' },
      { offModel: 'edinger-westphal', label: 'Edinger–Westphal nuclei', note: 'The parasympathetic part of each oculomotor nucleus (not in the model).' },
      { structure: 'oculomotor-inferior', label: 'Oculomotor nerve', note: 'Carries the parasympathetic fibres to the orbit.' },
      { structure: 'ciliary-ganglion', label: 'Ciliary ganglion', note: 'The fibres relay here.' },
      { structure: 'ciliary-nerves', label: 'Short ciliary nerves', note: 'Enter the eye around the optic nerve.' },
      { structure: 'iris', label: 'Sphincter pupillae', note: 'Contracts: the pupil narrows.' },
    ],
    facts: ['Both pupils narrow because each pretectal area signals both Edinger–Westphal nuclei: the consensual reflex.', 'In dim light the sympathetic system widens the pupil through the dilator muscle.'],
    assumptions: ['The link from the pretectal area to the oculomotor nerve runs through the midbrain, which is not in the model; it is drawn as a dashed line.'],
    sources: ['openstax-autonomic', 'hra-brain', 'bodyparts3d'],
  },
  muscleActions: [
    { structure: 'lateral-rectus', nerve: 'VI', primary: 'Abduction (turns out)', pull: [1, 0, 0] },
    { structure: 'medial-rectus', nerve: 'III', primary: 'Adduction (turns in)', pull: [-1, 0, 0] },
    { structure: 'superior-rectus', nerve: 'III', primary: 'Elevation (up)', secondary: 'Intorsion', tertiary: 'Adduction', pull: [-0.3, 1, 0.4] },
    { structure: 'inferior-rectus', nerve: 'III', primary: 'Depression (down)', secondary: 'Extorsion', tertiary: 'Adduction', pull: [-0.3, -1, -0.4] },
    { structure: 'superior-oblique', nerve: 'IV', primary: 'Intorsion', secondary: 'Depression', tertiary: 'Abduction', pull: [0.3, -0.6, 1] },
    { structure: 'inferior-oblique', nerve: 'III', primary: 'Extorsion', secondary: 'Elevation', tertiary: 'Abduction', pull: [0.3, 0.6, -1] },
  ],
  tour: [
    { id: 'overview', title: 'The eye in its orbit', camera: 'oblique', mode: 'explore', focus: ['fibrous-tunic', 'eye-muscles', 'optic-nerve'], body: 'The eyeball is about 24 mm long. It sits in the bony orbit, cushioned by fat, moved by six muscles, and connected to the brain by the optic nerve.' },
    { id: 'layers', title: 'Three layers', camera: 'left', mode: 'explore', colourBy: 'layer', slice: { axis: 'sagittal', at: 0 }, focus: ['fibrous-tunic', 'vascular-tunic', 'neural-tunic'], body: 'Cut in half, the eye shows its three coats: the tough fibrous tunic (cornea and sclera), the dark vascular tunic or uvea (iris, ciliary body, choroid) and the neural tunic (retina).' },
    { id: 'front', title: 'Cornea, iris and lens', camera: 'left', mode: 'explore', slice: { axis: 'sagittal', at: 0 }, focus: ['cornea', 'iris', 'lens', 'aqueous-humour'], body: 'Light passes the clear cornea, the aqueous humour and the pupil, the hole in the iris, then the lens. The cornea does most of the focusing; the lens fine-tunes it.' },
    { id: 'rays', title: 'Focusing light', mode: 'vision', focus: ['cornea', 'lens', 'retina'], body: 'Rays of light bend at the cornea and the lens and meet on the retina. The image there is upside down. The rays are traced with the real refractive indices of the Le Grand schematic eye.' },
    { id: 'near', title: 'Focusing near', mode: 'vision', focus_m: 0.25, focus: ['ciliary-muscle', 'lens', 'zonule'], body: 'For something 25 cm away the ciliary muscle contracts, the zonule fibres slacken and the elastic lens rounds up, adding about 4 dioptres of power. This is accommodation.' },
    { id: 'myopia', title: 'Short sight and glasses', mode: 'vision', refraction: 'myopia', glasses: true, focus: ['retina'], body: 'In short sight (myopia) the eye is too long, so far objects focus in front of the retina. A concave (minus) lens spreads the light a little so it focuses on the retina again.' },
    { id: 'pupil', title: 'The pupil reflex', mode: 'vision', light: 4, focus: ['iris', 'ciliary-ganglion', 'ciliary-nerves'], body: 'In bright light the sphincter pupillae narrows the pupil to about 2 mm, signalled by the oculomotor nerve through the ciliary ganglion. In the dark the dilator widens it to about 8 mm.' },
    { id: 'muscles', title: 'Six muscles move the eye', camera: 'superior', mode: 'movement', gaze: [25, -25], focus: ['eye-muscles', 'trochlea'], body: 'Looking down and in uses the superior oblique, whose tendon runs through the trochlea pulley. Remember the nerves: LR6 SO4, all the rest III.' },
    { id: 'retina-tour', title: 'The retina', mode: 'retina', focus: ['macula', 'fovea', 'optic-disc'], body: 'Looking into the eye, a doctor sees the pale optic disc, where the nerve and vessels leave, and the darker macula with the fovea, the point of sharpest vision, packed with cones. The disc has no receptors: the blind spot.' },
    { id: 'pathway', title: 'To the brain', camera: 'superior', mode: 'pathway', focus: ['optic-chiasm', 'optic-tract-right', 'lgn-right', 'visual-cortex-right'], body: 'At the optic chiasm the nasal fibres cross. So the right visual cortex sees the left half of the world, from both eyes.' },
    { id: 'chiasm-lesion', title: 'Damage at the chiasm', camera: 'superior', mode: 'pathway', lesion: 'chiasm', focus: ['optic-chiasm'], body: 'A tumour of the pituitary gland, just below the chiasm, presses on the crossing fibres. Both outer (temporal) half-fields are lost: bitemporal hemianopia.' },
    { id: 'tears', title: 'Tears', camera: 'anterior', mode: 'tears', focus: ['tear-system'], body: 'The lacrimal gland makes tears, blinking spreads them, and they drain from the inner corner through the canaliculi, sac and nasolacrimal duct into the nose.' },
  ],
  sources: [
    { id: 'openstax-senses', citation: 'Betts JG, Young KA, Wise JA, et al. Anatomy and Physiology 2e, section 14.1 "Sensory Perception". Houston: OpenStax; 2022.', url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/14-1-sensory-perception' },
    { id: 'openstax-central', citation: 'Betts JG, Young KA, Wise JA, et al. Anatomy and Physiology 2e, section 14.2 "Central Processing". Houston: OpenStax; 2022.', url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/14-2-central-processing' },
    { id: 'openstax-cranial-nerves', citation: 'Betts JG, Young KA, Wise JA, et al. Anatomy and Physiology 2e, section 13.4 "The Peripheral Nervous System". Houston: OpenStax; 2022.', url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/13-4-the-peripheral-nervous-system' },
    { id: 'openstax-autonomic', citation: 'Betts JG, Young KA, Wise JA, et al. Anatomy and Physiology 2e, section 15.2 "Autonomic Reflexes and Homeostasis". Houston: OpenStax; 2022.', url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/15-2-autonomic-reflexes-and-homeostasis' },
    { id: 'openstax-skull', citation: 'Betts JG, Young KA, Wise JA, et al. Anatomy and Physiology 2e, section 7.2 "The Skull". Houston: OpenStax; 2022.', url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/7-2-the-skull' },
    { id: 'openstax-bio-vision', citation: 'Clark MA, Douglas M, Choi J. Biology 2e, section 36.5 "Vision". Houston: OpenStax; 2018.', url: 'https://openstax.org/books/biology-2e/pages/36-5-vision' },
    { id: 'legrand', citation: 'Le Grand Y, El Hage SG. Physiological Optics. Berlin: Springer; 1980. Full theoretical eye, as tabulated in Greivenkamp JE, OPTI-502 Optical Design and Instrumentation I, "The Eye", University of Arizona, 2019.', url: 'https://wp.optics.arizona.edu/jgreivenkamp/wp-content/uploads/sites/11/2019/08/502-22-The-Eye.pdf' },
    { id: 'moon-spencer', citation: 'Moon P, Spencer DE. On the Stiles–Crawford effect. J Opt Soc Am 1944;34:319–329; formula as given by Watson AB, Yellott JI. A unified formula for light-adapted pupil size. J Vis 2012;12(10):12.', url: 'https://jov.arvojournals.org/article.aspx?articleid=2279420' },
    { id: 'hofstetter', citation: 'Hofstetter HW. Useful age-amplitude formula. Optom World 1950;38:42–45 (average amplitude of accommodation 18.5 − 0.30 × age).' },
    { id: 'curcio-1990', citation: 'Curcio CA, Sloan KR, Kalina RE, Hendrickson AE. Human photoreceptor topography. J Comp Neurol 1990;292(4):497–523.', url: 'https://pubmed.ncbi.nlm.nih.gov/2324310/' },
    { id: 'hra-eye', citation: 'Browne K, Schlehlein H, et al. 3D Reference Organ for Eye, Female, Right, v1.3. HuBMAP Human Reference Atlas. doi:10.48539/HBM632.KTDP.379', url: 'https://doi.org/10.48539/HBM632.KTDP.379', license: 'CC BY 4.0' },
    { id: 'hra-brain', citation: 'Browne K, Schlehlein H, et al. 3D Reference Organ for Brain, Female, v1.4 (from the Allen human brain atlas). HuBMAP Human Reference Atlas. doi:10.48539/HBM674.NTLM.353', url: 'https://doi.org/10.48539/HBM674.NTLM.353', license: 'CC BY 4.0' },
    { id: 'hra-united', citation: 'Browne K, Schlehlein H, et al. 3D Reference Organ Set for Female, v1.5. HuBMAP Human Reference Atlas. doi:10.48539/HBM352.BTSQ.586', url: 'https://doi.org/10.48539/HBM352.BTSQ.586', license: 'CC BY 4.0' },
    { id: 'bodyparts3d', citation: 'Mitsuhashi N, Fujieda K, Tamura T, Kawamoto S, Takagi T, Okubo K. BodyParts3D: 3D structure database for anatomical concepts. Nucleic Acids Res. 2009;37(Database issue):D782-5. doi:10.1093/nar/gkn613', url: 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html', license: 'CC BY 4.0' },
  ],
  disclaimers: [
    'For learning only. This is not a clinical or diagnostic tool, and the explanations have not been reviewed by a physician or optometrist.',
    'The eye and the visual pathway are the HuBMAP female reference organs, based on the Visible Human dataset; real eyes vary in size and shape.',
    'The orbit bones, tear system, eyelid plates and orbital nerves come from a different reference body (BodyParts3D), fitted onto this eye; their position is approximate (about 5 mm).',
    'The light rays use the Le Grand schematic eye scaled to this eye, not the mesh surfaces; the retinal vessel pattern in the fundus view and the retina diagrams are illustrations.',
  ],
};
