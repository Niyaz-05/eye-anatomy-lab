import { useEffect, useRef } from 'react';
import { useLab } from '../app/LabContext';
import { FIELD_LEFT, FIELD_RIGHT, LAYER_COLOUR, LIGHT_RAY, TEAR } from '../viewer/palette';

/**
 * Source, scope and credits, kept off the main screen. The HuBMAP and BodyParts3D attribution
 * required by CC BY 4.0 lives here and is reachable from the ⓘ button and the "Source & credits" link.
 */
export function AboutSheet({ onClose }: { onClose: () => void }) {
  const { def } = useLab();
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    title.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="about-sheet glass" role="dialog" aria-modal="true" aria-labelledby="about-title" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ghost sheet-close" onClick={onClose} aria-label="Close">✕</button>
        <p className="eyebrow">Source &amp; scope</p>
        <h2 id="about-title" className="sheet-title" tabIndex={-1} ref={title}>About this lab</h2>
        <p>{def.summary}</p>

        <h3 className="group-title">You will learn to</h3>
        <ul className="objectives">
          {def.learningObjectives.map((o) => <li key={o.id}>{o.text}</li>)}
        </ul>

        <h3 className="group-title">Colours</h3>
        <p className="small muted">
          “Real” shows the eye as it looks in a specimen: porcelain-white sclera, a clear cornea and lens, the dark pigmented
          uvea, the orange-red retina with its pale optic disc, red muscles, cream nerves and ivory bone. “Layers” gives each
          layer its own colour.
        </p>
        <p className="legend-row">
          {def.layers.map((l) => (
            <span key={l.id}><span className="dot" style={{ background: LAYER_COLOUR[l.id] }} aria-hidden="true" /> {l.label}</span>
          ))}
        </p>
        <p className="legend-row">
          <span><span className="dot" style={{ background: LIGHT_RAY }} aria-hidden="true" /> Light rays</span>
          <span><span className="dot" style={{ background: TEAR }} aria-hidden="true" /> Tears</span>
          <span><span className="dot" style={{ background: FIELD_LEFT }} aria-hidden="true" /> Left visual field</span>
          <span><span className="dot" style={{ background: FIELD_RIGHT }} aria-hidden="true" /> Right visual field</span>
        </p>

        <h3 className="group-title">Simulations</h3>
        <ul className="small disclaimers">
          <li>Light rays: exact ray tracing (Snell’s law) through the Le Grand full theoretical eye, scaled to this eye’s measured axial length ({'≈'}23.7 mm); focusing between its relaxed and accommodated forms. Amplitude of accommodation by age from Hofstetter (18.5 − 0.30 × age).</li>
          <li>Pupil: Moon &amp; Spencer’s formula for pupil diameter from luminance, as given by Watson &amp; Yellott (2012).</li>
          {[def.tearRoute, def.visualRoute, def.pupilRoute].flatMap((r) => r.assumptions).map((a) => <li key={a}>{a}</li>)}
        </ul>

        <h3 className="group-title">Please note</h3>
        <ul className="small disclaimers">
          {def.disclaimers.map((d) => <li key={d}>{d}</li>)}
        </ul>

        <h3 className="group-title">Source</h3>
        <p className="small">
          Eye: HuBMAP Human Reference Atlas 3D Reference Organ for Eye, Female, Right (v1.3), from the Visible Human Female.
          Eye muscles, optic nerves, vessels and the left eye: the HRA female organ set (v1.5). Visual pathway: the HRA female
          brain (v1.4, from the Allen human brain atlas). All by Kristen Browne, Heidi Schlehlein et al. Bony orbit, tear
          system, eyelid plates and orbital nerves: BodyParts3D, © The Database Center for Life Science. All licensed under CC
          Attribution 4.0 International. Neither HuBMAP nor DBCLS has reviewed or endorsed this lab.
        </p>
        <div className="link-list small">
          <a href={`${import.meta.env.BASE_URL}ATTRIBUTION.md`} target="_blank" rel="noopener">Attribution and changes made ↗</a>
          <a href="https://doi.org/10.48539/HBM632.KTDP.379" target="_blank" rel="noopener noreferrer">HRA eye ↗</a>
          <a href="https://doi.org/10.48539/HBM674.NTLM.353" target="_blank" rel="noopener noreferrer">HRA brain ↗</a>
          <a href="https://doi.org/10.48539/HBM352.BTSQ.586" target="_blank" rel="noopener noreferrer">HRA female organ set ↗</a>
          <a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html" target="_blank" rel="noopener noreferrer">BodyParts3D ↗</a>
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0 licence ↗</a>
        </div>
      </section>
    </div>
  );
}
