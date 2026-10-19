import { useEffect, useId, useRef, useState } from 'react';
import { useLab } from '../app/LabContext';
import { effectiveVision, type IrisColour } from '../app/state';
import type { Refraction, Route } from '../contract/schema';
import { REFRACTIONS, visionState } from '../eye/vision';
import { irisMuscle, LIGHT_LEVELS } from '../eye/pupil';
import { DIAGNOSTIC_GAZES, mainMuscle, muscleActivity, type MuscleId } from '../eye/gaze';
import { LESIONS, visualFields } from '../eye/fields';
import { FIELD_LEFT, FIELD_RIGHT, IRIS_COLOURS, LIGHT_RAY, SIGNAL, TEAR } from '../viewer/palette';

function Steps({ route, colour }: { route: Route; colour: string }) {
  const { state, dispatch } = useLab();
  return (
    <ol className="flow-steps">
      {route.steps.map((st, i) => (
        <li key={i}>
          <span className="dot" aria-hidden="true" style={{ background: colour }} />
          {st.structure ? (
            <button type="button" className="link" aria-pressed={state.selected === st.structure} onClick={() => dispatch({ type: 'select', id: st.structure! })}>{st.label}</button>
          ) : (
            <span className="offmodel">{st.label} <span className="tag">not on model</span></span>
          )}
          {st.note && <span className="muted small block">{st.note}</span>}
        </li>
      ))}
    </ol>
  );
}

function PlayButton() {
  const { state, dispatch } = useLab();
  return (
    <button type="button" className="secondary" onClick={() => dispatch({ type: 'set-playing', value: !state.playing })} aria-pressed={!state.playing}>
      {state.playing ? 'Pause' : 'Play'}
    </button>
  );
}

function Radios<T extends string | number | null>({ label, options, value, onChange }: { label: string; options: readonly { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg-toggle wrap" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.id)} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

const DISTANCES: { id: number | null; label: string }[] = [
  { id: null, label: 'Far away' }, { id: 1, label: '1 m' }, { id: 0.4, label: '40 cm' }, { id: 0.25, label: '25 cm' }, { id: 0.15, label: '15 cm' },
];
const signed = (d: number) => `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d).toFixed(2)} D`;

/** Vision: focusing, refractive errors and glasses, and the pupil reflex. */
export function VisionPanel() {
  const { def, state, dispatch } = useLab();
  const id = useId();
  const v = effectiveVision(def, state);
  const vs = visionState(v.refraction, v.focusM, v.glasses, v.light);
  const r = REFRACTIONS[v.refraction];
  const prev = useRef(vs.pupilMm);
  const [working, setWorking] = useState<'sphincter' | 'dilator' | null>(null);
  useEffect(() => {
    setWorking(irisMuscle(prev.current, vs.pupilMm));
    prev.current = vs.pupilMm;
    const t = setTimeout(() => setWorking(null), 2500);
    return () => clearTimeout(t);
  }, [vs.pupilMm]);
  const glassesLabel = v.refraction === 'presbyopia' ? `Reading glasses (${signed(vs.readingAddD)})` : v.refraction === 'normal' ? 'Glasses (none needed)' : `Glasses (${signed(vs.prescriptionD)})`;
  const sharp = vs.focused;
  const where = Math.abs(vs.missMm) < 0.05 ? 'on the retina' : vs.missMm < 0 ? `${Math.abs(vs.missMm).toFixed(2)} mm in front of the retina` : `${vs.missMm.toFixed(2)} mm behind the retina`;
  const lightLabel = [...LIGHT_LEVELS].reverse().find((l) => v.light >= l.log10 - 0.5)?.label ?? 'Darkness';
  return (
    <section className="sheet vision-panel" aria-labelledby={`${id}-title`}>
      <div className="detail-head"><h2 id={`${id}-title`} className="panel-title">How we see</h2></div>
      <p className="small">Yellow rays come from the top of the object, orange from its middle. The cornea and lens bend them to meet on the retina, where the image is <strong>upside down</strong>.</p>

      <h3 className="group-title">Looking at</h3>
      <Radios label="Object distance" options={DISTANCES} value={v.focusM} onChange={(d) => dispatch({ type: 'set-focus', value: d })} />

      <h3 className="group-title">The eye</h3>
      <Radios label="Eye" options={(Object.keys(REFRACTIONS) as Refraction[]).map((k) => ({ id: k, label: REFRACTIONS[k].label }))} value={v.refraction} onChange={(x) => dispatch({ type: 'set-refraction', value: x })} />
      <p className="muted small">{r.note}</p>
      <label className="check">
        <input type="checkbox" checked={v.glasses} disabled={v.refraction === 'normal'} onChange={(e) => dispatch({ type: 'set-glasses', value: e.target.checked })} />
        {glassesLabel}
      </label>

      <dl className="readout" aria-live="polite">
        <div><dt>Image</dt><dd className={sharp ? 'ok' : 'warn'} data-focused={sharp ? 'true' : 'false'}>{sharp ? 'Sharp' : 'Blurred'}: focused {where}</dd></div>
        <div><dt>Focusing (accommodation)</dt><dd>{vs.accommodationD.toFixed(1)} D of {vs.amplitudeD.toFixed(1)} D available</dd></div>
        <div><dt>Power of the eye</dt><dd data-power={vs.powerD.toFixed(2)}>{vs.powerD.toFixed(1)} D</dd></div>
        <div><dt>Nearest sharp point</dt><dd>{Number.isFinite(vs.nearPointM) ? `${Math.round(vs.nearPointM * 100)} cm` : '—'}</dd></div>
      </dl>
      <p className="muted small">For near objects the ciliary muscle contracts, the zonule slackens and the lens rounds up (watch it thicken). Powers are from ray tracing the Le Grand schematic eye, sized to this eye.</p>

      <h3 className="group-title">Light and the pupil</h3>
      <label className="field">
        <span className="sr-only">Light level</span>
        <input type="range" min={-3} max={5} step={0.1} value={v.light} aria-label="Light level" aria-valuetext={`${lightLabel}, 10 to the power ${v.light.toFixed(1)} candela per square metre`} onChange={(e) => dispatch({ type: 'set-light', value: Number(e.target.value) })} />
      </label>
      <p className="small"><strong>{lightLabel}</strong> · pupil <strong data-pupil={vs.pupilMm.toFixed(2)}>{vs.pupilMm.toFixed(1)} mm</strong>
        {working && <span className="tag">{working === 'sphincter' ? 'sphincter pupillae contracting (parasympathetic, CN III)' : 'dilator pupillae contracting (sympathetic)'}</span>}</p>
      <p className="muted small">Pupil size from Moon &amp; Spencer’s formula. Light in either eye narrows both pupils (the consensual reflex): see the Pathway view for the reflex route.</p>

      <h3 className="group-title">Eye colour</h3>
      <Radios label="Iris colour" options={(Object.keys(IRIS_COLOURS) as IrisColour[]).map((k) => ({ id: k, label: k[0]!.toUpperCase() + k.slice(1) }))} value={state.irisColour} onChange={(c) => dispatch({ type: 'set-iris', value: c })} />
      <p className="muted small">Iris colour comes from melanin in the stroma: much in brown eyes, little in blue, where the colour comes from scattered light.</p>
      <p className="legend-row small"><span><span className="dot" style={{ background: LIGHT_RAY }} aria-hidden="true" /> Light rays</span></p>
    </section>
  );
}

const MUSCLE_ORDER: MuscleId[] = ['lateral-rectus', 'medial-rectus', 'superior-rectus', 'inferior-rectus', 'superior-oblique', 'inferior-oblique'];

/** Eye movements: the nine positions of gaze and what each muscle does. */
export function MovementPanel() {
  const { def, state, dispatch } = useLab();
  const id = useId();
  const v = effectiveVision(def, state);
  const act = muscleActivity(v.gaze);
  const main = mainMuscle(v.gaze);
  const label = (m: string) => def.structures.find((s) => s.id === m)?.label ?? m;
  return (
    <section className="sheet movement-panel" aria-labelledby={`${id}-title`}>
      <div className="detail-head"><h2 id={`${id}-title`} className="panel-title">Eye movements</h2></div>
      <p className="small">The right eye, as the person looks. Pick a direction: the muscles that pull light up.</p>
      <div className="gaze-grid" role="group" aria-label="Direction of gaze">
        {DIAGNOSTIC_GAZES.map((g) => (
          <button key={g.id} type="button" aria-pressed={v.gaze[0] === g.gaze[0] && v.gaze[1] === g.gaze[1]} onClick={() => dispatch({ type: 'set-gaze', value: g.gaze })} title={g.label}>
            {g.label}
          </button>
        ))}
      </div>
      <p className="small" aria-live="polite">{main ? <>Working hardest: <strong data-main={main}>{label(main)}</strong> (nerve {def.muscleActions.find((m) => m.structure === main)?.nerve}).</> : 'Looking straight ahead: the muscles are balanced.'}</p>
      <table className="muscle-table small">
        <thead><tr><th scope="col">Muscle</th><th scope="col">Nerve</th><th scope="col">Main action</th><th scope="col">Pull</th></tr></thead>
        <tbody>
          {MUSCLE_ORDER.map((m) => {
            const a = def.muscleActions.find((x) => x.structure === m)!;
            return (
              <tr key={m} className={main === m ? 'is-current' : undefined}>
                <th scope="row"><button type="button" className="link" onClick={() => dispatch({ type: 'select', id: m })}>{label(m)}</button></th>
                <td>{a.nerve}</td>
                <td>{a.primary}{a.secondary ? `; also ${a.secondary.toLowerCase()}${a.tertiary ? `, ${a.tertiary.toLowerCase()}` : ''}` : ''}</td>
                <td><span className="bar" style={{ width: `${Math.round(act[m] * 100)}%` }} aria-label={`${Math.round(act[m] * 100)} percent`} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted small">Doctors test each muscle where it acts alone: up and out (superior rectus), down and out (inferior rectus), up and in (inferior oblique), down and in (superior oblique). “LR6 SO4”: the lateral rectus is supplied by nerve VI, the superior oblique by IV, the rest by III.</p>
    </section>
  );
}

/** Tears: the route, as particles flow along it. */
export function TearsPanel() {
  const { def } = useLab();
  const id = useId();
  return (
    <section className="sheet tears-panel" aria-labelledby={`${id}-title`}>
      <div className="detail-head"><h2 id={`${id}-title`} className="panel-title">Tears</h2><PlayButton /></div>
      <p className="small">{def.tearRoute.description}</p>
      <Steps route={def.tearRoute} colour={TEAR} />
      <ul className="facts small">{def.tearRoute.facts.map((f) => <li key={f}>{f}</li>)}</ul>
    </section>
  );
}

/** The two visual fields of each eye, as the person sees them; lost halves are dark. */
function FieldDiagram({ lesion }: { lesion: Parameters<typeof visualFields>[0] }) {
  const f = visualFields(lesion);
  const eye = (cx: number, [left, right]: [boolean, boolean], name: string) => (
    <g>
      <path d={`M ${cx} 10 A 30 30 0 0 0 ${cx} 70 Z`} fill={left ? FIELD_LEFT : '#1b1d22'} opacity={left ? 0.85 : 1} />
      <path d={`M ${cx} 10 A 30 30 0 0 1 ${cx} 70 Z`} fill={right ? FIELD_RIGHT : '#1b1d22'} opacity={right ? 0.85 : 1} />
      <circle cx={cx} cy={40} r={30} fill="none" stroke="currentColor" strokeOpacity={0.4} />
      <text x={cx} y={88} textAnchor="middle" fontSize="11" fill="currentColor">{name}</text>
    </g>
  );
  const describe = `Left eye: ${f.leftEye[0] ? 'sees' : 'lost'} left half, ${f.leftEye[1] ? 'sees' : 'lost'} right half. Right eye: ${f.rightEye[0] ? 'sees' : 'lost'} left half, ${f.rightEye[1] ? 'sees' : 'lost'} right half.`;
  return (
    <svg className="field-diagram" viewBox="0 0 200 96" role="img" aria-label={describe} data-fields={JSON.stringify(f)}>
      {eye(55, f.leftEye, 'Left eye')}
      {eye(145, f.rightEye, 'Right eye')}
    </svg>
  );
}

/** The visual pathway, the field loss from damage, and the pupil reflex route. */
export function PathwayPanel() {
  const { def, state, dispatch } = useLab();
  const id = useId();
  const v = effectiveVision(def, state);
  const lesion = LESIONS.find((l) => l.id === v.lesion)!;
  return (
    <section className="sheet pathway-panel" aria-labelledby={`${id}-title`}>
      <div className="detail-head"><h2 id={`${id}-title`} className="panel-title">Visual pathway</h2><PlayButton /></div>
      <p className="small">Blue signals carry the <span style={{ color: FIELD_LEFT }}>left half</span> of the world, orange the <span style={{ color: FIELD_RIGHT }}>right half</span>. Nasal fibres cross at the chiasm, so each side of the brain sees the opposite half.</p>
      <Steps route={def.visualRoute} colour={SIGNAL} />

      <h3 className="group-title">What if it is damaged?</h3>
      <Radios label="Damage" options={LESIONS.map((l) => ({ id: l.id, label: l.label }))} value={v.lesion} onChange={(x) => dispatch({ type: 'set-lesion', value: x })} />
      <FieldDiagram lesion={v.lesion} />
      <p className="small" aria-live="polite" data-lesion={v.lesion}>{lesion.result}</p>

      <label className="check">
        <input type="checkbox" checked={state.reflex} onChange={(e) => dispatch({ type: 'set-reflex', value: e.target.checked })} /> Show the pupil reflex route
      </label>
      {state.reflex && <Steps route={def.pupilRoute} colour="#8ef0b0" />}
    </section>
  );
}

/** Rods and cones across the retina (shape after Curcio et al. 1990; rods drawn relative). */
function DensityChart() {
  const W = 260, H = 120, x = (deg: number) => 20 + ((deg + 60) / 120) * (W - 30), y = (rel: number) => H - 18 - rel * (H - 30);
  const cones = (d: number) => 0.06 + 0.94 * Math.exp(-Math.abs(d) / 1.2) + 0.04 * Math.exp(-Math.abs(d) / 12);
  const disc = (d: number) => d > 12 && d < 18; // nasal retina (right eye), about 15° from the fovea
  const rods = (d: number) => (Math.abs(d) < 0.6 ? 0 : 0.75 * (1 - Math.exp(-Math.abs(d) / 5)) * Math.exp(-Math.max(0, Math.abs(d) - 18) / 40));
  const path = (fn: (d: number) => number) => Array.from({ length: 241 }, (_, i) => -60 + i * 0.5).map((d, i) => `${i ? 'L' : 'M'} ${x(d).toFixed(1)} ${y(disc(d) ? 0 : fn(d)).toFixed(1)}`).join(' ');
  return (
    <svg className="density-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Rods and cones across the retina: cones peak sharply at the fovea (about 199,000 per square millimetre); rods are absent at the fovea, most dense around 15 to 20 degrees out, and both are absent at the optic disc.">
      <rect x={x(12)} y={8} width={x(18) - x(12)} height={H - 26} fill="currentColor" opacity={0.08} />
      <text x={(x(12) + x(18)) / 2} y={16} fontSize="8" textAnchor="middle" fill="currentColor">blind spot</text>
      <path d={path(cones)} fill="none" stroke="#e8a030" strokeWidth={1.6} />
      <path d={path(rods)} fill="none" stroke="#6a9ae8" strokeWidth={1.6} />
      <line x1={20} x2={W - 10} y1={H - 18} y2={H - 18} stroke="currentColor" strokeOpacity={0.4} />
      {[-60, -30, 0, 30, 60].map((d) => <text key={d} x={x(d)} y={H - 6} fontSize="8" textAnchor="middle" fill="currentColor">{d === 0 ? 'fovea' : `${Math.abs(d)}°`}</text>)}
      <text x={x(-58)} y={H - 24} fontSize="7" fill="currentColor" opacity={0.7}>temporal</text>
      <text x={x(40)} y={H - 24} fontSize="7" fill="currentColor" opacity={0.7}>nasal</text>
      <text x={x(3)} y={18} fontSize="8" fill="#e8a030">cones</text>
      <text x={x(-40)} y={y(0.62)} fontSize="8" fill="#6a9ae8">rods</text>
    </svg>
  );
}

/** The layers of the retina: light passes the inner layers to reach the rods and cones. */
function RetinaLayers() {
  const rows = [
    ['Nerve fibre layer', 'Ganglion-cell axons running to the optic disc', '#f2e6c8'],
    ['Ganglion cells', 'Their axons form the optic nerve; some sense brightness for the pupil reflex', '#e8c8a0'],
    ['Bipolar cells (with horizontal and amacrine cells)', 'Pass and shape the signals', '#d8b0a0'],
    ['Rods and cones', 'About 120 million rods for dim light; about 6 million cones for colour and detail', '#c09080'],
    ['Pigment epithelium', 'Absorbs stray light and recycles the visual pigment', '#5a2a1a'],
  ] as const;
  return (
    <ol className="retina-layers small" aria-label="Layers of the retina, from the inside (vitreous side) outwards">
      <li className="arrow">↓ light enters from the vitreous</li>
      {rows.map(([name, note, c]) => (
        <li key={name}><span className="swatch" style={{ background: c }} aria-hidden="true" /><strong>{name}</strong><span className="muted block">{note}</span></li>
      ))}
      <li className="arrow">↑ signals travel back towards the vitreous, then along the nerve fibre layer to the optic disc</li>
    </ol>
  );
}

/** The retina: fundus view, its layers, receptor densities and a blind-spot test. */
export function RetinaPanel() {
  const { dispatch } = useLab();
  const id = useId();
  return (
    <section className="sheet retina-panel" aria-labelledby={`${id}-title`}>
      <div className="detail-head"><h2 id={`${id}-title`} className="panel-title">The retina</h2></div>
      <p className="small">You are looking at the back of the eye from inside, as a doctor does with an ophthalmoscope: the pale <button type="button" className="link" onClick={() => dispatch({ type: 'select', id: 'optic-disc' })}>optic disc</button> where the nerve and vessels leave, and the darker <button type="button" className="link" onClick={() => dispatch({ type: 'select', id: 'macula' })}>macula</button> with the <button type="button" className="link" onClick={() => dispatch({ type: 'select', id: 'fovea' })}>fovea</button> at its centre. The vessel pattern is an illustration; the disc, macula and fovea are the HuBMAP model’s.</p>
      <h3 className="group-title">Layers</h3>
      <RetinaLayers />
      <h3 className="group-title">Rods and cones</h3>
      <DensityChart />
      <p className="muted small">Cones peak at about 199,000 per mm² in the fovea and fall tenfold within 1 mm; the centre of the fovea has no rods. Rods are densest in a ring about as far out as the optic disc. (Curcio et al. 1990; rod curve drawn to relative scale.)</p>
      <h3 className="group-title">Find your blind spot</h3>
      <svg className="blind-spot" viewBox="0 0 240 50" role="img" aria-label="A cross on the left and a dot about 8 centimetres to its right">
        <text x="30" y="32" fontSize="24" textAnchor="middle" fill="currentColor">+</text>
        <circle cx="200" cy="25" r="8" fill="currentColor" />
      </svg>
      <p className="small">Cover your left eye and look at the cross with your right eye. Move slowly towards the screen: at about 30–40 cm the dot vanishes, because its image falls on your optic disc, where there are no rods or cones.</p>
    </section>
  );
}
