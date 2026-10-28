# Testing

Results recorded on 2026-10-19 on Windows 11, Node 22.14.0. Browser tests ran in headless Chromium (Playwright 1.64, software WebGL via SwiftShader, which uses the automatic low-quality mode). The GPU check ran in installed Google Chrome 155 on an AMD Radeon integrated GPU (ANGLE, Direct3D 11).

## Commands

| Check | Command | What it covers |
|---|---|---|
| Types | `npm run typecheck` | TypeScript strict, `noUncheckedIndexedAccess` |
| Unit | `npm test` | Definition and validation gate (no warnings; unapproved asset and unknown muscle rejected); one mesh structure per model node; every left/right structure on its side; the six muscles with LR6 SO4; https-only sources; routes (tears end in the nose, four visual bundles, nasal fibres cross, each tract carries the opposite field, pupil reflex); measured optics in range; reducer (modes and their layers, Vision's cut and camera, clamping, glasses cleared on refraction change, tour overrides, kept-half hint); search (white of the eye, blind spot, uvea, CN IV, annulus of Zinn); `closeHoles` on synthetic and all model meshes. Science: Le Grand power 59.94 D relaxed, about 7.7 D more accommodated; emmetropia, myopia and hyperopia focus positions; inverted image; correcting lenses refocus within 0.1 mm; 4 D to focus 25 cm; presbyopia; Moon–Spencer values; diagnostic gazes; field defects; vision state with and without glasses |
| Assets | `npm run validate:assets` | GLB sha256 = provenance, node set = geometry record, finite positions, unit normals, indices in range, triangle counts, baked `_TISSUE` on every mesh, attribution names HuBMAP, the authors, the eye, brain and organ-set DOIs, BodyParts3D, DBCLS, CC BY 4.0 and the source and output hashes |
| Determinism | re-run `tools/extract-eye.mjs` then `tools/bake-shading.mjs` | Byte-identical `eye.glb` |
| Build | `npm run build` | Type check + production bundle |
| E2E | `npm run build && npm run e2e` | 21 scenarios below; screenshots in `docs/screenshots/` |

## E2E scenarios (`tests/e2e/lab.spec.ts`)

1. Loads with no console errors; real colours; no details sheet on the main screen.
2. Clicking the model selects the structure under the pointer.
3. Search: "blind spot" + Enter selects the optic disc; "CN IV" finds the trochlear nerve; no-match message; Escape restores the list.
4. A group (extraocular muscles) lists its 6 parts; a part links back to it.
5. Colour by Layers changes the rendered colours.
6. Layers: the bony orbit can be shown; the eye muscles hidden.
7. Isolate, Zoom to and Reset.
8. Camera presets change the view.
9. Labels mode: at least 3 labels, none overlapping.
10. Cut: Side faces the inner-side camera with the "outer (temple-side) half" hint; Front + Flip faces the back camera with the "front half" hint; Off; no console errors.
11. Vision: sharp far; 25 cm uses 4.0 D of 12.5 D; short sight blurs (focus in front of the retina); glasses make it sharp; bright light narrows the pupil; no console errors (marked slow).
12. Movement: down and left → superior oblique; right → lateral rectus.
13. Retina: the fundus view, the layers list, the density chart (199,000 cones/mm²) and the blind-spot test; no console errors.
14. Pathway: a chiasm lesion gives bitemporal hemianopia (field diagram checked), a right tract lesion left homonymous hemianopia; the pupil reflex route shows; no console errors.
15. Tears: the route lists the nasolacrimal duct; Pause/Play.
16. Guided tour: 12 steps, Next/Back, jump to the last step, Finish (marked slow).
17. Phone 390×844: no horizontal overflow; Structures opens from the dock; picking closes it and shows the details.
18. About (ⓘ): HuBMAP, BodyParts3D, Le Grand and CC BY 4.0 credits; Escape closes.
19. `?nowebgl`: fallback message; the list and details still work.
20. Missing model (HTTP 404): error alert; Try again refetches and loads.
21. Reduced motion: the pathway and tears views without errors.

## Results

| Check | Result |
|---|---|
| `npm run typecheck` | **Pass** |
| `npm test` | **Pass**: 28/28 in 3 files |
| `npm run validate:assets` | **Pass**: 82 nodes, 184,208 triangles, sha256 `c4195855cb92…` |
| Determinism | **Pass**: re-extraction gives the same unbaked model (`b2d7c093bee1…`) and re-baking the recorded final sha256 (`c4195855cb92…`) |
| `npm run build` | **Pass**. Vite warns about chunk size |
| `npm run e2e` | **Pass**: 21/21. The network dropped twice, so the suite ran in parts: tests 1–11, then 12–16, then 17–21. After the last code change (the eye turns only in Movement mode), tests 2, 10–16 and 21 were run again and passed |
| Live site (2026-10-19) | **Pass**: https://eye-anatomy-lab.vercel.app returns the page; `models/eye.glb` is served with the recorded sha256 `c4195855cb92…`; every mode opens in Chrome 155 with no console errors |
| GPU check (Chrome 155, AMD Radeon, D3D11) | Every mode renders with no console errors. Ready in 12.6 s. Frame rates while rendering: Anatomy, cut, Vision, Retina and tour 60–64 fps; Movement 57; Pathway (animated) 43–53; Tears (animated) 26–33 fps (35 at low quality) |

## Defects found and fixed during QA

- **The lens, ciliary muscle and zonule exploded to ~10³⁸ m when focusing near.** The glTF attributes are interleaved, so writing into `attribute.array` hit the wrong slots. Vertices are now read and written through the attribute API (`getX`/`setXYZ`).
- **The eye looked closed and pink.** The Visible Human's eyes were closed, so the HRA eyelid lining covers the cornea. It is now its own layer, "Eyelid lining (eyes closed)", off by default.
- **The front of the eye looked milky, with a white pupil.** Light reflected from the clear media and the lit inside of the eye. The clear media are now clearer, and a dark disc behind the iris shows the black pupil of a living eye.
- **The fundus view was too close, and the macula looked like a glass bowl.** The view now comes from just behind the cornea through a dilated pupil, and the macula and fovea shade the retina instead of being drawn as raised meshes. The upper vessel arcade was hidden inside the retina's thickness; vessels are now placed by casting from the eye's centre onto the inner surface.
- **The retina view was blank after Movement mode.** The eye was still turned. Gaze now applies only in Movement mode.
- **Tears mode ran at 7–24 fps.** The large see-through skull bones were costly to redraw every frame. Only the bones around the tear duct are shown now (26–33 fps).
- **The iris kept a few open edges after `closeHoles`.** Holes are now closed per rim edge (union-find) rather than by walking loops, and folded edges are not counted as holes. Two edges in the coarse left iris are an open chain that cannot be patched.
- **A presbyopic eye could not read with +2.00 D glasses.** Accommodation is now measured as ocular vergence (as Hofstetter's amplitude is), and reading glasses allow for the 12 mm vertex distance (+2.25 D).

## Phone and tablet layouts

Added 2026-10-28, the same layer as the heart lab: `src/app/layout.ts` (the layout from the screen size: `desktop`, `sheet` for phones and portrait tablets, `landscape` for phones on their side), `src/ui/Sheet.tsx` (the details as a bottom sheet with a handle: tap to step peek / half / full, drag to follow the finger, drag down or flick to close) and a "Phones and tablets" block in `src/styles.css` (safe-area insets, finger-sized controls, a mode row that scrolls sideways). Picking a structure frames it above the sheet and hides the title and mode buttons until the details close; a tap on empty space closes them too.

`tests/e2e/responsive.spec.ts` (the same file in every lab) runs at 390×844, 844×390, 768×1024, 820×1180, 1024×768 and 1366×820 (touch emulation below 1024 px): no horizontal scroll; title, modes, dock and sheet on screen and not overlapping; room left for the model; finger-sized controls; the sheet folds, opens and expands by tap, keyboard and drag; the picked structure's label stays above the sheet; closing by ✕, by a tap on empty space and by dragging down (real touch events); a mode's own panel keeps the mode buttons and cannot be dismissed; every mode fits and scrolls to its end. Screenshots are in `docs/screenshots/responsive/`.

**Result (2026-10-28):** the whole GPU suite (this lab's own scenarios and the layout checks), installed Chrome, AMD Radeon integrated GPU: **52 passed in 7.6 min**.

**Not verified:** physical phones and tablets (only Chrome's device emulation at the six sizes), notches and safe areas on a real device, multi-finger gestures, the on-screen keyboard over the search box, and Safari and Firefox.

## Not verified

- **Physical devices other than one AMD integrated GPU.** No phone, tablet or discrete GPU was tested. Firefox and Safari were not run.
- **Automated accessibility audit.** axe-core is not installed; keyboard paths and ARIA labels were checked by hand and by E2E only.
- **Anatomical and optometric review.** The text follows OpenStax A&P 2e §7.2, 13.4, 14.1, 14.2 and 15.2 and Biology 2e §36.5. No ophthalmologist or optometrist has reviewed it.
- **The optics are a schematic eye.** The rays are traced through the Le Grand eye scaled to this eye's axial length, not through the mesh surfaces. Accommodation interpolates between Le Grand's two states (extrapolated up to 1.4× for very near objects). The lens's change of shape in 3D is approximate.
- **The fit of BodyParts3D is approximate.** It is about 5 mm (4.8 mm RMS for the orbit, 4.7 mm for the bones); the parts come from a male body.
- **Illustrations.** The fundus vessel pattern is procedural, the retina layers and density chart are diagrams (the rod curve is relative), and the optic radiation mesh is coarse.
- **Muscle activity is a teaching model.** It is based on the textbook actions, not measured forces, and torsion is not shown.
