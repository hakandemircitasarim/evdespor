import * as store from '../store.js';
import * as W from '../engine/workout.js';
import { getExercise } from '../data/exercises.js';
import { $, $$, esc, daysAgo, fmtDuration, sheet, confirmSheet } from './common.js';
import { navigate } from '../app.js';
import { totalSets, totalReps } from '../engine/progress.js';

const RECOVERY = [['ready', 'READY'], ['tired', 'A LITTLE TIRED'], ['not_recovered', 'NOT RECOVERED']];

export function renderToday(root, params, state) {
  const active = state.activeSession;
  const t = W.nextTemplate(state);
  const next = t ? W.templateAfter(state, t.id) : null;
  const prevOfT = t ? W.previousSessionOfTemplate(state, t.id) : null;
  const last = state.sessions[state.sessions.length - 1];
  const rec = state.recovery.date === W.today() ? state.recovery.state : null;
  const paused = t && W.isPaused(state, t);
  const restr = state.settings.restriction;

  root.innerHTML = `
    <div class="eyebrow">Today</div>
    ${active ? `
      <div class="card mt" style="border-color:rgba(201,168,106,.5)">
        <div class="label">RESUME ${esc(active.templateName)}?</div>
        <div class="sub">Exercise: <b style="color:var(--text)">${esc(getExercise(active.exercises[active.exIndex]?.exerciseId)?.name || '')}</b><br>Set: ${(active.exercises[active.exIndex]?.sets.length || 0) + 1} / ${active.exercises[active.exIndex]?.planned.length || 0}</div>
        <div class="btn-row mt"><button class="btn danger" data-discard>DISCARD</button><button class="btn primary" data-resume>RESUME</button></div>
      </div>` : ''}
    ${t ? `
    <div class="mt-l">
      <span class="tag ${t.type}">${t.type.toUpperCase()}</span>
      <h1 class="title mt-s">${esc(t.name)}</h1>
      <div class="sub mt-s">${esc(t.muscles)}</div>
    </div>
    ${t.type === 'rest' ? `<div class="card mt-l center"><div class="title sm">REST DAY</div><div class="sub mt-s">No resistance training scheduled.</div></div>` : ''}
    ${paused ? `<div class="card mt"><div class="label">PAUSED BY TRAINING RESTRICTION</div><div class="sub">${restr.type === 'all' ? 'All training' : restr.type === 'legs' ? 'Legs only' : 'Custom'} restriction is active. Remove it in Settings when you decide.</div></div>` : ''}
    ${restr.enabled && !paused ? `<div class="sub mt" style="font-size:12px">Training restriction active (${restr.type === 'legs' ? 'legs' : restr.type}). This workout is not affected.</div>` : ''}
    <div class="card mt-l">
      <div class="row between"><span class="label" style="margin:0">PREVIOUS</span><span class="num">${prevOfT ? daysAgo(prevOfT.startedAt) : 'Never'}</span></div>
      <div class="hr"></div>
      <div class="label">RECOVERY</div>
      <div class="seg sm">${RECOVERY.map(([id, l]) => `<button data-rec="${id}" class="${rec === id ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${rec === 'not_recovered' ? `<div class="sub mt-s">Recovery looks low. Evaluate today without forcing performance. Your call.</div>` : ''}
      ${rec === 'tired' ? `<div class="sub mt-s">A little tired. Keep RIR honest today.</div>` : ''}
    </div>
    ${t.type !== 'rest' && !paused && !active ? `<button class="btn primary mt-l" data-start="${t.id}">START WORKOUT</button>` : ''}
    <button class="btn ghost mt" data-choose>${t.type === 'rest' || paused ? 'CHOOSE A WORKOUT' : 'CHOOSE ANOTHER DAY'}</button>
    ` : `<div class="card mt-l">No workouts in the program.</div>`}
    <div class="mt-l">
      ${next ? `<div class="row between"><span class="eyebrow">Next</span><span class="sub">${esc(next.name)}</span></div>` : ''}
      ${last ? `<div class="row between mt-s"><span class="eyebrow">Last workout</span><span class="sub">${esc(last.templateName)} · ${daysAgo(last.startedAt)} · ${totalSets(last)} sets · ${totalReps(last)} reps · ${fmtDuration(last.durationSec || 0)}</span></div>` : ''}
    </div>`;

  root.onclick = async e => {
    const r = e.target.closest('[data-rec]');
    if (r) { store.update(s => { s.recovery = { date: W.today(), state: r.dataset.rec }; }); renderToday(root, params, store.get()); return; }
    const st = e.target.closest('[data-start]');
    if (st) { startWorkout(st.dataset.start); return; }
    if (e.target.closest('[data-resume]')) { navigate('workout'); return; }
    if (e.target.closest('[data-discard]')) {
      if (await confirmSheet('Discard active workout?', 'Logged sets of this session will be lost.', { okLabel: 'DISCARD', danger: true })) { W.discardSession(); renderToday(root, params, store.get()); }
      return;
    }
    if (e.target.closest('[data-choose]')) chooseWorkout(state);
  };
}

function startWorkout(templateId) {
  const state = store.get();
  const t = state.program.templates[templateId];
  if (!t) return;
  if (state.activeSession) { navigate('workout'); return; }
  W.startSession(state, t);
  navigate('workout');
}

function chooseWorkout(state) {
  const list = W.templateList(state).filter(t => t.type !== 'rest');
  const s = sheet(`<div class="title sm">Choose workout</div><div class="list mt">${list.map(t => `
    <button data-t="${t.id}" style="width:100%;text-align:left" ${state.activeSession ? 'disabled' : ''}>
      <span class="tag ${t.type}">${t.type.toUpperCase()}</span><div class="grow"><div class="name">${esc(t.name)}</div><div class="meta">${esc(t.muscles)}${W.isPaused(state, t) ? ' · paused by restriction' : ''}</div></div><span class="chev">›</span></button>`).join('')}</div>
    ${state.activeSession ? '<div class="sub mt">Finish or discard the active workout first.</div>' : ''}`);
  $$('[data-t]', s.panel).forEach(b => b.onclick = async () => {
    const t = state.program.templates[b.dataset.t];
    if (W.isPaused(state, t)) {
      const ok = await confirmSheet('Paused by training restriction', `${t.name} is paused by the restriction you set. Start anyway?`, { okLabel: 'START ANYWAY' });
      if (!ok) return;
    }
    s.panel.parentElement.remove();
    startWorkout(b.dataset.t);
  });
}
