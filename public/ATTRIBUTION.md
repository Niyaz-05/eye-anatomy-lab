# Attribution and asset provenance

## 3D eye model — `models/eye.glb`

### Sources

1. **HuBMAP Human Reference Atlas (HRA) 3D reference organs, female**, by **Kristen Browne and Heidi Schlehlein** (and HRA contributors), from the Visible Human Female (National Library of Medicine). Licensed **CC BY 4.0** (https://creativecommons.org/licenses/by/4.0/).

   | Organ | Version and DOI | File | Bytes | sha256 |
   |---|---|---|---|---|
   | Eye, female, right | v1.3, https://doi.org/10.48539/HBM632.KTDP.379 | `3d-vh-f-eye-r.glb` | 20,697,640 | `d7929a4abbda66813af99761c9c328826248188294f69c2e22b29704f9beabfa` |
   | Brain, female (from the Allen human brain atlas) | v1.4, https://doi.org/10.48539/HBM674.NTLM.353 | `3d-allen-f-brain.glb` | 11,983,380 | `f20d87a347f8d5c6467439cba7db18f19307d29b2c3e0c2b6ddb7e9d49e1c1fc` |

   - Both files were downloaded from `https://cdn.humanatlas.io/digital-objects/ref-organ/…/assets/`.
   - The eye provides the cornea, limbus, sclera, conjunctiva (bulbar and palpebral), iris, ciliary body, ciliary muscle and processes, choroid, retina, ora serrata, macula, fovea, optic disc, lens, zonule, aqueous and vitreous humour, trabecular meshwork and Schlemm's canal.
   - The brain provides the optic chiasm, optic tracts, dorsal lateral geniculate nuclei, optic radiations, visual cortex (cuneus, lingual gyrus and occipital pole), pretectal area and superior colliculi. Its `_L`/`_R` node suffixes lie on the opposite sides from the patient's, so sides were assigned by position.
2. **3D Reference Organ Set for Female v1.5 (HRA united female)**, DOI https://doi.org/10.48539/HBM352.BTSQ.586, CC BY 4.0.
   - Taken as converted by *Female Atlas* (github.com/Niyaz-05/female-atlas, commit `4c2dfcca02739b59827601915128ee64abdff2ea`). The converter's +0.794760942 m vertical translation is reversed here; the official eye and brain files match these parts after that translation.
   - It provides the six extraocular muscles of the right eye, both optic nerves, the ophthalmic artery and veins, the central retinal artery and vein, the posterior ciliary arteries, and the left eye (sclera and cornea, iris, lens, retina with macula, fovea and optic disc, and its muscles).
3. **BodyParts3D 4.0**, © The **Database Center for Life Science** (DBCLS), CC BY 4.0. https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
   - The bony orbit (frontal, sphenoid and ethmoid bones; right maxilla, zygomatic, lacrimal, palatine and nasal bones; right inferior nasal concha), the tear system (lacrimal gland, lake, canaliculi, sac, nasolacrimal duct), the tarsal plates, the levator palpebrae superioris and its tendon, the trochlea, the common tendinous ring, the check ligaments, and the orbital nerves (oculomotor branches, trochlear, ophthalmic, nasociliary, frontal with supra-orbital and supratrochlear, lacrimal, infratrochlear, ethmoidal, ciliary ganglion, long and short ciliary nerves), which the HRA eye does not include.
   - Taken as converted by *Human Atlas* (github.com/Niyaz-05/human-atlas, commit `76f069640f2c3dd40a58d1556896ac25008f592e`).

Neither HuBMAP nor DBCLS has reviewed or endorsed this lab.

### Changes made (as CC BY 4.0 requires)

`tools/extract-eye.mjs`:
- Selected and merged the source meshes listed in `src/eye/source/structures.source.json`; welded coincident vertices.
- Simplified each HRA mesh with meshoptimizer within a 0.4 % relative error bound (the retina is kept whole); recomputed smooth normals.
- Placed the BodyParts3D parts on the HRA eyes with similarity transforms (rotation, uniform scale, shift) fitted on landmark centroids: the right orbit's soft parts on the right eyeball and its six muscles (scale 1.169, rotation 17.5°, residual 4.8 mm RMS); the bones on both eyes and their muscles (scale 1.143, rotation 14.7°, residual 4.7 mm RMS). The upper tarsal plate, which dipped into the eyeball after the fit, was moved out of it.
- Measured the eye's optics on the model (axis, cornea apex, lens, pupil, axial length 23.7 mm), computed the tear route and the visual-pathway fibre routes through the parts, and generated an illustrative retinal vessel pattern on the retina's inner surface.
- Translated so that the right eyeball's centre is the origin.

`tools/bake-shading.mjs` then adds a per-vertex `_TISSUE` attribute: ambient occlusion and a noise value, for the real-tissue look.

The output is `models/eye.glb` (3,799,480 bytes, 184,208 triangles, sha256 `c4195855cb92b34b52974236b662f612c10a9a183f59889d87aab1a7be64d92e`). Every input hash is in `src/eye/generated/provenance.json`.

### Scientific sources for the simulations

- Le Grand full theoretical eye (relaxed and accommodated): Le Grand Y, El Hage SG. *Physiological Optics*. Springer, 1980; values as tabulated in Greivenkamp JE, OPTI-502 "The Eye", University of Arizona.
- Pupil size: Moon P, Spencer DE (1944), as given by Watson AB, Yellott JI. A unified formula for light-adapted pupil size. *J Vis* 2012;12(10):12.
- Amplitude of accommodation: Hofstetter HW (1950), average 18.5 − 0.30 × age.
- Rod and cone densities: Curcio CA et al. Human photoreceptor topography. *J Comp Neurol* 1990;292:497–523.
- Anatomy and physiology text: OpenStax *Anatomy and Physiology 2e* (§7.2, §13.4, §14.1, §14.2, §15.2) and *Biology 2e* (§36.5), CC BY 4.0.
