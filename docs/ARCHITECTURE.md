# Architecture

The eye lab shares the heart, lungs, brain and digestive labs' design: a validated, data-only **`SimulationDefinition`** rendered by a generic viewer. The code is a deliberate copy of the digestive lab, not a shared package, so each lab deploys independently.

## Differences from the digestive lab

| Area | Eye |
|---|---|
| Contract | Modes `explore` / `vision` / `movement` / `retina` / `pathway` / `tears` / `tour`. Routes for tears, the visual pathway and the pupil reflex; the six eye muscles' actions and nerves. Tour steps can set a mode, light level, gaze, object distance, refraction, glasses, lesion, cut and colour |
| Validation | Routes' structures and sources must exist; the six muscle actions name six distinct mesh structures, on top of the shared checks |
| Science (`src/eye/`) | `optics.ts`: exact meridional ray tracing (Snell's law) through the Le Grand full theoretical eye, relaxed and accommodated, scaled to this eye; paraxial power; accommodation as ocular vergence limited by Hofstetter's amplitude; spectacle power by search. `pupil.ts`: Moon & Spencer. `gaze.ts`: muscle activity for a gaze. `fields.ts`: field loss per lesion. `vision.ts`: the optical state for the current settings. All pure and unit-tested |
| Mode views | Each mode shows its own layers (`MODE_LAYERS`), adds or hides a few structures, and starts from its own camera. Vision opens the eye along its axis with a sagittal cut |
| Eye model (`EyeModel.tsx`) | Clear media are see-through. The iris has a procedural stroma shader (fibres, collarette, crypts, pupillary ruff) and is reshaped radially for the pupil; a dark disc behind it shows the black pupil. The lens is reshaped for accommodation (front forward up to 0.40 mm, back 0.10 mm, as in Le Grand's two states), with the ciliary muscle and zonule. The eyeball turns rigidly about its centre of rotation; the muscles, optic nerve and vessels that attach to it follow near the globe and stay fixed further back (per-vertex weights). The retina is tinted darker at the macula and fovea. Positions are read and written through the attribute API, because the glTF attributes are interleaved |
| Light rays (`RayFan.tsx`) | Two fans (top and middle of the object) from the trace, drawn in the eye's plane just in front of the cut face; retina hits marked; the spectacle lens drawn 12 mm in front of the cornea |
| Particles (`FlowParticles.tsx`) | Tears along the generated route; visual signals along four bundles (blue = left visual field, orange = right), stopping at a lesion; the pupil reflex route, with a dashed schematic link through the midbrain |
| Fundus (`FundusVessels.tsx`) | Tubes along vessel polylines generated offline on the retina's inner surface |
| Cut | The stencil-capped cut with `closeHoles`; caps follow parts that turn with the eye; reshaped parts go uncapped while reshaped |

The real-tissue look (`tissue.ts`, `Lighting.tsx`, `tools/bake-shading.mjs`) is the same in every lab.

## Asset pipeline

```
HRA eye, female, right v1.3 (24 eyeball parts) ───────────────┐
HRA brain, female v1.4 (chiasm, tracts, LGN, radiation, V1) ──┤
HRA united female v1.5 (y − 0.7948 m): muscles, nerves,       ├─ tools/extract-eye.mjs
  vessels, left eye                                           │
BodyParts3D (Human Atlas) ─ similarity fit ─ mould ───────────┘
        │  82 nodes, ~184k triangles; optics measured; tear, visual and reflex routes; fundus vessels
        └─ tools/bake-shading.mjs ─▶ public/models/eye.glb (3.8 MB) · geometry.json · provenance.json
```

**Frames.** The official eye and brain files and the united body share one frame once the converter's y translation is reversed, so they need no fitting.

**Fitting BodyParts3D.** Two similarity transforms (rotation, uniform scale, shift) fitted on landmark centroids with Horn's quaternion method:
- **orbit:** the right orbit's soft parts, fitted on the right sclera, cornea, lens, vitreous and six muscles (4.8 mm RMS);
- **skull:** the bones, which span both orbits, fitted on both eyes and their muscles (4.7 mm RMS).

The optic nerve is not a landmark, because the two bodies' nerves take different courses. Afterwards, soft parts that dip into the eyeball are pushed out of it (only the upper tarsal plate needed it); nerves are left, since the ciliary nerves really pierce the sclera.

**Optics measured on the model.** The axis runs from the lens centre to the cornea's centre. The axial length is the distance from the cornea apex to the retina along that axis (23.7 mm). The model also records the anterior chamber depth (3.0 mm), lens thickness (4.06 mm), iris and pupil diameters, the centre of rotation (13.5 mm behind the apex, scaled), and the fovea and optic disc.

**Routes.**
- **Tears:** from the gland to the bulbar conjunctiva, across the eye's surface (projected and lifted 0.4 mm), then through the lake, canaliculi, sac and nasolacrimal duct (interior paths, or slice centroids where too thin).
- **Visual bundles:** retina → optic disc → nerve centreline → chiasm (nasal fibres cross) → tract → LGN → radiation → cortex, each bundle offset 0.6 mm.
- **Pupil reflex:** optic nerve → tract → pretectal area; then a schematic link (the midbrain is not modelled); then the oculomotor nerve → ciliary ganglion → short ciliary nerves → iris.
