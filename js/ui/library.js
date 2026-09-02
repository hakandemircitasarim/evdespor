// Exercise library list + Exercise Detail sheet.
import { EXERCISES, getExercise, TEMPO_MAP } from '../data/exercises.js';
import { $, $$, esc, el, sheet, demoHTML } from './common.js';
import * as store from '../store.js';
import { lastPerformance, summarize, loadLabel } from '../engine/progress.js';

const GROUPS = [
  ['chest', 'CHEST'], ['shoulders', 'SHOULDERS'], ['triceps', 'TRICEPS'],
  ['back', 'BACK'], ['rear_delts', 'REAR DELTS'], ['biceps', 'BICEPS'],
  ['quads', 'QUADS'], ['hamstrings', 'HAMSTRINGS'], ['glutes', 'GLUTES'], ['calves', 'CALVES'], ['forearms', 'FOREARMS / GRIP'],
];

export function renderLibrary(root, params, state) {
  root.innerHTML = `
    <div class="row between mb">
      <div><div class="eyebrow">Program</div><h1 class="title">Exercise Library</h1></div>
      <button class="btn xs ghost" data-back>BACK</button>
    </div>
    ${GROUPS.map(([g, label]) => {
      const list = EXERCISES.filter(e => e.primary === g);
      if (!list.length) return '';
      return `<div class="eyebrow mt-l">${label}</div>
      <div class="card mt-s"><div class="list">${list.map(e => `
        <button data-ex="${e.id}" style="width:100%;text-align:left">
          ${demoHTML(e, true).replace('class="demo small"', 'class="demo small" style="width:56px"')}
          <div class="grow"><div class="name">${esc(e.name)}</div><div class="meta">${esc(e.muscles)}</div></div>
          <span class="chev">›</span>
        </button>`).join('')}</div></div>`;
    }).join('')}`;
  $('[data-back]', root).onclick = () => history.back();
  root.onclick = e => { const b = e.target.closest('[data-ex]'); if (b) openExerciseDetail(b.dataset.ex); };
}

export function openExerciseDetail(exerciseId, { onClose } = {}) {
  const ex = getExercise(exerciseId);
  if (!ex) return;
  const state = store.get();
  const last = lastPerformance(state, exerciseId);
  const lastHtml = last ? (() => { const s = summarize(last.sets); return `<div class="card"><div class="label">LAST TIME</div><div class="num">${esc(loadLabel(last.sets[0], state))} · ${s.reps.join(' / ')}</div><div class="sub">Avg RIR ${s.avgRir.toFixed(1)}</div></div>`; })() : '';
  const m = ex.media;
  const html = `
    <div class="row between"><div class="eyebrow">${esc(ex.muscles)}</div><button class="btn xs ghost" data-close>CLOSE</button></div>
    <h2 class="title sm mt-s">${esc(ex.name)}</h2>
    <div class="mt">${demoHTML(ex)}</div>
    ${m?.note ? `<div class="sub mt-s" style="font-size:12px">${esc(m.note)}</div>` : ''}
    <div class="stack mt">
      ${lastHtml}
      <div class="card"><div class="label">EQUIPMENT</div><div>${esc(ex.equipment.join(' · '))}</div></div>
      <div class="card"><div class="label">STARTING POSITION</div><div>${esc(ex.setup)}</div></div>
      <div class="card"><div class="label">EXECUTION</div><div>${esc(ex.execution)}</div></div>
      <div class="card"><div class="label">FORM CUES</div>${ex.cues.map(c => `<div>· ${esc(c)}</div>`).join('')}</div>
      <div class="card"><div class="label">COMMON MISTAKES</div>${ex.mistakes.map(c => `<div class="sub">· ${esc(c)}</div>`).join('')}</div>
      <div class="card"><div class="label">TEMPO</div><div>${esc(ex.tempo)}</div></div>
      <div class="card"><div class="label">ALTERNATIVES</div><div class="chips">${(ex.alternatives || []).map(a => getExercise(a) ? `<button class="chip" data-alt="${a}">${esc(getExercise(a).name)}</button>` : '').join('')}</div></div>
      ${m ? `<div class="sub" style="font-size:12px"><div class="label">SOURCE</div>Source: <a href="${esc(m.source)}" target="_blank" rel="noopener">${esc(m.sourceId)}</a><br>License: ${esc(m.license)}<br>Author/Provider: ${esc(m.author)}</div>` : `<div class="sub" style="font-size:12px"><div class="label">SOURCE</div>No licensed demo media found for this movement. Text cues only.</div>`}
    </div>`;
  const s = sheet(html, { onClose });
  $('[data-close]', s.panel).onclick = () => s.close();
  $$('[data-alt]', s.panel).forEach(b => b.onclick = () => { s.panel.parentElement.remove(); openExerciseDetail(b.dataset.alt, { onClose }); });
}
