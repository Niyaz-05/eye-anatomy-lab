# Human Eye — Interactive 3D Learning Lab

**Live:** https://eye-anatomy-lab.vercel.app

A realistic, interactive 3D human eye for secondary-school and first-year biology:

- **Real look.** A porcelain-white sclera with a wet sheen, a clear cornea and lens, a fibrous iris (brown, hazel, green or blue) with a black pupil, the dark uvea, the orange-red retina with its pale optic disc, red eye muscles, cream nerves and ivory bone. "Colour" switches to **Layers** to give each layer its own colour.
- **Anatomy explorer.** The three tunics of the eyeball, the lens and its zonule, the humours and the drainage angle, the six eye muscles with the levator, trochlea and common tendinous ring, the optic nerve and the orbital nerves, the retinal and ciliary vessels, the tear system, the eyelid plates and the bony orbit.
- **How we see (Vision).** Light rays are traced with Snell's law through the Le Grand schematic eye, sized to this eye, and meet on the retina in an upside-down image. Look far or near and the lens rounds up (accommodation). Try short sight, long sight and presbyopia, and put on the glasses each needs. A light slider sets the pupil (Moon & Spencer formula).
- **Eye movements.** The eye turns to the nine diagnostic positions of gaze with its muscles attached; the working muscles light up, with their nerves (LR6 SO4).
- **Retina.** A fundus view from inside the eye (optic disc, macula and fovea from the model; illustrative vessels), the retina's layers, rod and cone densities (Curcio et al. 1990) and a blind-spot test.
- **Visual pathway.** Both eyes, the optic nerves, chiasm, tracts, lateral geniculate nuclei, radiations and visual cortex. Signals from the left and right halves of the world show why each side of the brain sees the opposite half; damage at four points shows the classic field losses. The pupillary light reflex route can be shown too.
- **Tears.** Tears flow from the lacrimal gland across the eye to the inner corner and down the nasolacrimal duct.
- **Cut and guided tour.** Slice the eye side-to-side, front-to-back or top-to-bottom (the camera turns to face the cut), and take a 12-step tour.

**Educational only.** This is not a clinical tool, and the text has not been reviewed by a physician or optometrist. The eye and visual pathway are HuBMAP Human Reference Atlas female reference organs; the bony orbit, tear system, eyelid plates and orbital nerves are BodyParts3D (DBCLS), fitted onto them. All are CC BY 4.0; see [public/ATTRIBUTION.md](public/ATTRIBUTION.md).

## Run

Requires Node.js ≥ 22.12.

```sh
npm install
npm run dev            # http://localhost:5188
npm run build          # type-check + production build → dist/
npm run preview        # http://localhost:5189
```

Add `?quality=high` or `?quality=low` to the URL to force a rendering quality. By default the lab drops the costly wet coat and sheen on software renderers and when frames stay slow.

## Check

```sh
npm run typecheck
npm test                         # unit tests (Vitest)
npm run validate:assets          # model hash, nodes, geometry sanity, baked shading, attribution
npx playwright install chromium  # once
npm run build && npm run e2e     # browser tests (Playwright)
```

See [docs/TESTING.md](docs/TESTING.md) for results and what is not verified.

## Rebuild the model

`public/models/eye.glb` is generated:

1. Download the official HRA female right eye (20.7 MB) and female brain (12.0 MB) into `source/` (paths in `src/eye/source/structures.source.json`). The URLs and sha256 hashes are in `public/ATTRIBUTION.md`.
2. Have checkouts of the Female Atlas (`github.com/Niyaz-05/female-atlas`) and the Human Atlas (`github.com/Niyaz-05/human-atlas`). They supply the HRA united female body (eye muscles, nerves, vessels, left eye) and BodyParts3D (orbit, tear system, eyelid plates, orbital nerves).
3. Run:

```sh
node tools/extract-eye.mjs "<female-atlas>/public/models" "<human-atlas>/public/models"
node tools/bake-shading.mjs
node tools/validate-assets.mjs
```

Both steps are deterministic, and every input and the output are hashed in `src/eye/generated/provenance.json`, with the measured optics of the eye and the BodyParts3D fit.

## Deploy

The site is a Vercel project (Vite preset, output `dist/`) connected to [github.com/Niyaz-05/eye-anatomy-lab](https://github.com/Niyaz-05/eye-anatomy-lab). Every push to `main` deploys to https://eye-anatomy-lab.vercel.app; pushes to other branches get preview URLs.

## Layout

| Path | What |
|---|---|
| `src/contract/` | Simulation schema (zod), approved-asset registry, validation gate |
| `src/eye/` | Definition (structures, layers, routes, muscle actions, tour, sources), optics (ray tracing), pupil, gaze, visual fields, vision state, anchors, generated geometry and provenance |
| `src/app/` | Pure state reducer (modes, colour, cut, light, gaze, focus, refraction, glasses, lesion), search, React context |
| `src/viewer/` | three.js / react-three-fiber scene: tissue material and lighting, eye model (iris pattern, pupil and lens reshaping, eye turning with its muscles, cut caps), light rays, tear and nerve-signal particles, fundus vessels, camera rig, labels |
| `src/ui/` | Panels: structures (colour, cut, layers), details, Vision, Movement, Retina, Pathway, Tears, tour, About |
| `tools/` | Extraction, shading bake and asset validation |
| `tests/unit`, `tests/e2e` | Vitest and Playwright suites |
