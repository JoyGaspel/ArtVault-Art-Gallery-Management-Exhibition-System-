import { useId, useState } from 'react';

const STANDARD = ['Digital Art', 'Illustration', 'Textile Art', 'Crafts', 'Photography', 'Sculpture', 'Painting', 'Traditional Art', 'Mixed Media', 'Calligraphy'];

export default function ArtworkCategoryPicker({ value, onChange }) {
  const id = useId();
  const custom = value.filter((item) => !STANDARD.includes(item));
  const [draft, setDraft] = useState(custom[0] || '');
  const [others, setOthers] = useState(custom.length > 0);
  const standardValues = others ? value.filter((item) => item !== draft) : value;
  function toggle(item) {
    if (standardValues.includes(item)) onChange([...standardValues.filter((entry) => entry !== item), ...(others ? [draft] : [])]);
    else if (value.length < 5) onChange([...standardValues, item, ...(others ? [draft] : [])]);
  }
  return <>
    <div className="chip-select">
      {STANDARD.map((item) => <button key={item} type="button" aria-pressed={standardValues.includes(item)} className={`chip-toggle${standardValues.includes(item) ? ' on' : ''}`} disabled={value.length >= 5 && !standardValues.includes(item)} onClick={() => toggle(item)}>{item}</button>)}
      <button type="button" aria-pressed={others} className={`chip-toggle${others ? ' on' : ''}`} disabled={value.length >= 5 && !others} onClick={() => {
        setOthers(!others);
        if (others) onChange(standardValues);
        else { setDraft(''); onChange([...value, '']); }
      }}>Others</button>
    </div>
    {others && <div className="field">
      <label htmlFor={id}>Specify your art specialization <span className="required-mark">*</span></label>
      <input id={id} value={draft} maxLength={40} required placeholder="e.g. Pixel Art" onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        onChange([...standardValues, next]);
      }} />
      {!draft.trim() && <div className="hint" role="alert">Specify a specialization when Others is selected.</div>}
      <div className="hint">Your label will appear on the artwork under the gallery's Others filter. Maximum 40 characters.</div>
    </div>}
  </>;
}
