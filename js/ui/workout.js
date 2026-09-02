// Active workout screen: one exercise in focus, big number inputs, rest timer.
import * as store from '../store.js';
import * as W from '../engine/workout.js';
import { getExercise, TEMPO_MODIFIERS, TEMPO_MAP, BAND_LEVELS } from '../data/exercises.js';
import { lastPerformance, summarize, loadLabel, isRepPR, buildSuggestion } from '../engine/progress.js';
import { $, $$, esc, el, fmtClock, fmtDuration, sheet, confirmSheet, promptNumber, demoHTML, toast, vibrate, beep, unlockAudio } from './common.js';
import { openExerciseDetail } from './library.js';
import { navigate } from '../app.js';

let draft = null;        // { key, weight, reps, rir, tempo, bandId, bandLevel }
let timerHandle = null;
let elapsedHandle = null;

export function renderWorkout(root, params, state) {
  clearInterval(elapsedHandle);
  const ss = state.activeSession;
  if (!ss) { navigate('today'); return; }

  // Rest timer takes over the screen while running
  if (ss.rest && ss.rest.endsAt > Date.now()) { renderTimer(root, state); return; }

  const es = W.currentExercise(ss);
  const template = state.program.templates[ss.templateId] || { type: ss.templateType, name: ss.templateName };

  if (!es || W.isExerciseDone(es)) {
    if (!W.advanceExercise() ) {
      // nothing left: offer finisher (pull days) or finish
      const s2 = store.get();
      if (s2.activeSession.finishers?.length && !s2.activeSession.finisherOffered) { renderFinisherChoice(root, s2); return; }
      renderAllDone(root, s2); return;
    }
    renderWorkout(root, params, store.get()); return;
  }

  const ex = getExercise(es.exerciseId);
  const planned = W.nextPlannedSet(es);
  const totalPlanned = es.planned.length;
  const setIdx = es.sets.length;
  const last = lastPerformance(state, es.exerciseId);
  const lastSum = last ? summarize(last.sets) : null;
  const exState = state.exerciseState[es.exerciseId] || {};
  const suggestion = state.suggestions[es.exerciseId];
  const showSuggestion = suggestion && suggestion.status === 'pending' && setIdx === 0;
  const unit = es.plan.unit || 'reps';

  // Draft (per exercise-session + set index). Survives detail sheet / re-render.
  const key = `${es.id}:${setIdx}`;
  if (!draft || draft.key !== key) {
    const prevSet = last ? last.sets.find(s => s.setNumber === (planned?.setNumber || 1) && (s.side || null) === (planned?.side || null)) || last.sets[0] : null;
    const prevOwn = es.sets[es.sets.length - 1];
    const weights = [...state.settings.dumbbellWeights].sort((a, b) => a - b);
    // No history yet: start compounds near the top of the rack, isolation lower. Clamped to available weights.
    const guess = w => weights.length ? weights.reduce((a, b) => Math.abs(b - w) < Math.abs(a - w) ? b : a) : w;
    const firstGuess = ex.loadType === 'dumbbell' ? guess(ex.mechanic === 'compound' ? 14 : 8) : 0;
    let weight = prevOwn ? prevOwn.weight : (exState.plannedWeight ?? prevSet?.weight ?? exState.lastWeight ?? firstGuess);
    if (ex.loadType === 'bodyweight' && weight == null) weight = 0;
    draft = {
      key,
      weight: ex.loadType === 'dumbbell' || ex.loadType === 'bodyweight' ? weight : null,
      reps: prevOwn ? prevOwn.reps : (prevSet?.reps ?? es.plan.minReps),
      rir: prevOwn ? prevOwn.rir : (prevSet?.rir ?? es.plan.rirMax),
      tempo: prevOwn ? prevOwn.tempoModifier : (exState.plannedTempo || es.plan.tempo || 'normal'),
      bandId: prevOwn ? prevOwn.bandId : (prevSet?.bandId ?? exState.lastBandId ?? state.settings.bands[0]?.id ?? null),
      bandLevel: prevOwn ? prevOwn.bandResistance : (prevSet?.bandResistance ?? exState.lastBandResistance ?? null),
    };
    if (ex.loadType === 'band' && draft.bandId) { const b = state.settings.bands.find(x => x.id === draft.bandId); draft.bandLevel = b ? b.level : draft.bandLevel; }
    if (ex.loadType === 'band' && !draft.bandId && !draft.bandLevel) draft.bandLevel = 'Medium';
  }

  const rirTarget = es.plan.rirMin === es.plan.rirMax ? `${es.plan.rirMin}` : `${es.plan.rirMin}-${es.plan.rirMax}`;
  const isLastSet = planned && planned.setNumber === es.plan.sets && (planned.side === null || planned.side === 'R');
  const failureHint = es.plan.lastSetToFailure && isLastSet ? '<div class="sub mt-s">Last set: optional 0–1 RIR.</div>' : '';

  root.innerHTML = `
    <div class="row between">
      <div><span class="tag ${template.type}">${esc(ss.templateName)}</span> <span class="sub num" id="elapsed">${fmtDuration(Math.round((Date.now() - ss.startedAt) / 1000))}</span></div>
      <button class="btn xs ghost" data-list>${ss.exIndex + 1} / ${ss.exercises.length} · LIST</button>
    </div>

    <h1 class="title sm mt">${esc(ex.name)}</h1>
    ${es.originalExerciseId ? `<div class="sub" style="font-size:12px">Replaces ${esc(getExercise(es.originalExerciseId)?.name || '')}${es.substitutedReason === 'no_anchor' ? ' (no safe anchor)' : ''}</div>` : ''}
    <div class="row mt-s" style="align-items:flex-start">
      ${demoHTML(ex, true)}
      <div class="grow">
        <div class="num" style="font-size:18px;font-weight:700">${es.plan.sets} × ${unit === 'sec' ? `${es.plan.minReps}-${es.plan.maxReps} s` : `${es.plan.minReps}-${es.plan.maxReps}`}${ex.unilateral ? ' <span class="sub">/ side</span>' : ''}</div>
        <div class="sub">Target RIR: <b style="color:var(--text)">${rirTarget}</b></div>
        ${es.plan.notes ? `<div class="sub mt-s" style="font-size:12px">${esc(es.plan.notes)}</div>` : ''}
        ${lastSum ? `<div class="mt-s"><span class="label" style="margin:0;display:inline">PREVIOUS</span> <span class="sub num">${esc(loadLabel(last.sets[0], state))}</span><div class="num" style="font-size:15px">${lastSum.reps.join(' / ')} <span class="sub">@ RIR ${lastSum.avgRir.toFixed(1)}${lastSum.tempo !== 'normal' ? ' · ' + TEMPO_MAP[lastSum.tempo]?.short : ''}</span></div></div>` : `<div class="sub mt-s">No previous data</div>`}
      </div>
    </div>

    ${showSuggestion ? `<div class="card mt" style="border-color:rgba(201,168,106,.45)"><div class="label">SUGGESTION</div><div>${esc(suggestion.text)}</div>
      <div class="btn-row mt-s"><button class="btn sm ghost" data-sug="ignore">IGNORE</button>${suggestion.action ? `<button class="btn sm" data-sug="apply">APPLY</button>` : ''}</div></div>` : ''}

    <div class="row between mt-l">
      <div class="eyebrow" style="color:var(--text)">SET ${planned.setNumber} / ${es.plan.sets}${planned.side ? ` · ${planned.side === 'L' ? 'LEFT' : 'RIGHT'}` : ''}</div>
      <button class="chip" data-tempo style="min-height:34px;font-size:12px">${esc(TEMPO_MAP[draft.tempo]?.short || 'NORMAL')}</button>
    </div>
    ${failureHint}

    <div id="load" class="mt"></div>

    <div class="mt">
      <div class="label">${unit === 'sec' ? 'SECONDS' : 'REPS'}</div>
      <div class="stepper"><button data-reps="-1">−</button><div class="val num tap" data-reps-tap>${draft.reps}</div><button data-reps="1">+</button></div>
    </div>

    <div class="mt">
      <div class="label">RIR</div>
      <div class="seg">${[0, 1, 2, 3, 4].map(r => `<button data-rir="${r}" class="${draft.rir === r ? 'on' : ''}">${r === 4 ? '4+' : r}</button>`).join('')}</div>
    </div>

    <button class="btn primary mt-l" data-complete>SET COMPLETE</button>

    <div class="btn-row mt">
      <button class="btn sm ghost" data-undo ${es.sets.length ? '' : 'disabled'}>UNDO LAST SET</button>
      <button class="btn sm ghost" data-alt>ALTERNATIVE</button>
      <button class="btn sm ghost" data-skip>SKIP</button>
    </div>

    ${es.sets.length ? `<div class="card mt"><div class="label">LOGGED</div>${es.sets.map(s => `<div class="row between num" style="padding:4px 0"><span class="sub">Set ${s.setNumber}${s.side ? ' ' + s.side : ''}</span><span>${esc(loadLabel(s, state))} · ${s.reps}${s.unit === 'sec' ? ' s' : ''} @ RIR ${s.rir === 4 ? '4+' : s.rir}${s.tempoModifier !== 'normal' ? ' · ' + (TEMPO_MAP[s.tempoModifier]?.short || '') : ''}</span></div>`).join('')}</div>` : ''}

    <div class="hr mt-l"></div>
    <button class="btn danger" data-finish>FINISH WORKOUT</button>
  `;

  renderLoad($('#load', root), ex, state);

  elapsedHandle = setInterval(() => { const e = $('#elapsed', root); if (e) e.textContent = fmtDuration(Math.round((Date.now() - ss.startedAt) / 1000)); }, 15000);

  root.onclick = async e => {
    const t = e.target;
    const b = sel => t.closest(sel);
    if (b('[data-demo]')) { openExerciseDetail(ex.id); return; }
    if (b('[data-reps]')) { draft.reps = Math.max(0, draft.reps + (+b('[data-reps]').dataset.reps)); $('[data-reps-tap]', root).textContent = draft.reps; return; }
    if (b('[data-reps-tap]')) { const v = await promptNumber(unit === 'sec' ? 'Seconds' : 'Reps', draft.reps); if (v != null) { draft.reps = Math.round(v); $('[data-reps-tap]', root).textContent = draft.reps; } return; }
    if (b('[data-rir]')) { draft.rir = +b('[data-rir]').dataset.rir; $$('[data-rir]', root).forEach(x => x.classList.toggle('on', +x.dataset.rir === draft.rir)); return; }
    if (b('[data-w]')) { draft.weight = W.stepWeight(state, draft.weight, +b('[data-w]').dataset.w); renderLoad($('#load', root), ex, state); return; }
    if (b('[data-w-tap]')) { const v = await promptNumber('Weight (kg)', draft.weight, { step: 0.5 }); if (v != null) { draft.weight = v; renderLoad($('#load', root), ex, state); } return; }
    if (b('[data-bw]')) { draft.weight = Math.max(0, (draft.weight || 0) + (+b('[data-bw]').dataset.bw)); renderLoad($('#load', root), ex, state); return; }
    if (b('[data-band]')) { const id = b('[data-band]').dataset.band; const band = state.settings.bands.find(x => x.id === id); draft.bandId = id; draft.bandLevel = band?.level || null; renderLoad($('#load', root), ex, state); return; }
    if (b('[data-level]')) { draft.bandId = null; draft.bandLevel = b('[data-level]').dataset.level; renderLoad($('#load', root), ex, state); return; }
    if (b('[data-tempo]')) { pickTempo(root, params); return; }
    if (b('[data-complete]')) { onComplete(root, params, ex, es, template); return; }
    if (b('[data-undo]')) { W.undoLastSet(); draft = null; toast('Last set removed'); renderWorkout(root, params, store.get()); return; }
    if (b('[data-skip]')) { if (await confirmSheet('Skip exercise?', `${ex.name} will be skipped for this session.`, { okLabel: 'SKIP' })) { W.skipExercise(); draft = null; renderWorkout(root, params, store.get()); } return; }
    if (b('[data-alt]')) { pickAlternative(root, params, ex, es); return; }
    if (b('[data-list]')) { exerciseList(root, params, store.get()); return; }
    if (b('[data-sug]')) { handleSuggestion(b('[data-sug]').dataset.sug, suggestion, es); draft = null; renderWorkout(root, params, store.get()); return; }
    if (b('[data-finish]')) { finishFlow(); return; }
  };
}

function renderLoad(host, ex, state) {
  if (ex.loadType === 'dumbbell') {
    host.innerHTML = `<div class="label">WEIGHT</div><div class="stepper"><button data-w="-1">−</button><div class="val num tap" data-w-tap>${draft.weight ?? 0}<small>KG${ex.unilateral || ex.id === 'goblet_squat' || ex.id === 'db_overhead_triceps_extension' || ex.id === 'db_pullover' || ex.id === 'hip_thrust' ? '' : ' EACH'}</small></div><button data-w="1">+</button></div>`;
  } else if (ex.loadType === 'bodyweight') {
    host.innerHTML = `<div class="label">ADDED WEIGHT</div><div class="stepper"><button data-bw="-2">−</button><div class="val num">${draft.weight || 0}<small>${draft.weight ? 'KG + BODYWEIGHT' : 'BODYWEIGHT'}</small></div><button data-bw="2">+</button></div>`;
  } else if (ex.loadType === 'band') {
    const bands = state.settings.bands;
    host.innerHTML = `<div class="label">BAND</div>
      <div class="chips">${bands.map(b => `<button class="chip ${draft.bandId === b.id ? 'on' : ''}" data-band="${b.id}">${esc(b.name)} <span class="sub" style="font-size:11px">${esc(b.level)}</span></button>`).join('')}</div>
      <div class="chips mt-s">${BAND_LEVELS.map(l => `<button class="chip ${!draft.bandId && draft.bandLevel === l ? 'on' : ''}" data-level="${l}" style="min-height:34px;font-size:12px">${l}</button>`).join('')}</div>`;
  } else {
    host.innerHTML = '';
  }
}

function pickTempo(root, params) {
  const s = sheet(`<div class="title sm">Tempo modifier</div><div class="sub">Changes how this set is compared later. Does not change the program.</div>
    <div class="list mt">${TEMPO_MODIFIERS.map(t => `<button data-t="${t.id}" style="width:100%;text-align:left"><div class="grow name">${esc(t.label)}</div>${draft.tempo === t.id ? '<span class="tag">CURRENT</span>' : ''}</button>`).join('')}</div>`);
  $$('[data-t]', s.panel).forEach(b => b.onclick = () => { draft.tempo = b.dataset.t; s.close(); renderWorkout(root, params, store.get()); });
}

function pickAlternative(root, params, ex, es) {
  const alts = (ex.alternatives || []).map(getExercise).filter(Boolean);
  const s = sheet(`<div class="title sm">Alternative for ${esc(ex.name)}</div><div class="sub">Same target. Each exercise keeps its own history.${es.sets.length ? ' Logged sets of the current exercise stay in this session.' : ''}</div>
    <div class="list mt">${alts.map(a => `<button data-a="${a.id}" style="width:100%;text-align:left">${demoHTML(a, true).replace('class="demo small"', 'class="demo small" style="width:56px"')}<div class="grow"><div class="name">${esc(a.name)}</div><div class="meta">${esc(a.muscles)}${a.needsAnchor ? ' · needs safe anchor' : ''}</div></div><span class="chev">›</span></button>`).join('')}</div>`);
  $$('[data-a]', s.panel).forEach(b => b.onclick = () => {
    s.close();
    if (es.sets.length) {
      // keep logged sets: append the alternative as a new exercise instead of replacing
      store.update(st => {
        const ss = st.activeSession;
        const cur = ss.exercises[ss.exIndex];
        cur.skipped = true;
        const entry = { ...cur.plan, id: cur.entryId, exerciseId: b.dataset.a, sets: Math.max(1, cur.plan.sets - Math.ceil(cur.sets.length / (cur.planned.length / cur.plan.sets))) };
        const fresh = W.buildExerciseSession(st, entry, { exerciseId: b.dataset.a, reason: 'manual' });
        fresh.originalExerciseId = cur.exerciseId; fresh.substitutedReason = 'manual';
        ss.exercises.splice(ss.exIndex + 1, 0, fresh);
        ss.exIndex += 1;
      });
    } else W.swapExercise(b.dataset.a);
    draft = null;
    renderWorkout(root, params, store.get());
  });
}

function exerciseList(root, params, state) {
  const ss = state.activeSession;
  const s = sheet(`<div class="title sm">${esc(ss.templateName)}</div><div class="list mt">${ss.exercises.map((e, i) => {
    const x = getExercise(e.exerciseId);
    const done = W.isExerciseDone(e);
    return `<button data-i="${i}" style="width:100%;text-align:left"><span class="n">${i + 1}</span><div class="grow"><div class="name" style="${done ? 'color:var(--text-3)' : ''}">${esc(x?.name || e.exerciseId)}${e.optional ? ' <span class="sub">(optional)</span>' : ''}</div><div class="meta">${e.skipped ? 'Skipped' : `${e.sets.length} / ${e.planned.length} sets`}</div></div>${i === ss.exIndex ? '<span class="tag">NOW</span>' : ''}</button>`;
  }).join('')}</div>
  ${ss.finishers?.length && !ss.finisherOffered ? `<button class="btn ghost mt" data-fin>OPTIONAL FINISHER</button>` : ''}`);
  $$('[data-i]', s.panel).forEach(b => b.onclick = () => { s.close(); W.goToExercise(+b.dataset.i); draft = null; renderWorkout(root, params, store.get()); });
  const f = $('[data-fin]', s.panel); if (f) f.onclick = () => { s.close(); renderFinisherChoice(root, store.get()); };
}

function handleSuggestion(action, suggestion, es) {
  store.update(s => {
    const sug = s.suggestions[es.exerciseId];
    if (!sug) return;
    if (action === 'apply' && sug.action) {
      const st = s.exerciseState[es.exerciseId] = s.exerciseState[es.exerciseId] || {};
      if (sug.action.type === 'weight') st.plannedWeight = sug.action.weight;
      if (sug.action.type === 'tempo') {
        st.plannedTempo = sug.action.tempo;
        // also write into the program entry so PROGRAM shows the new tempo
        for (const t of Object.values(s.program.templates)) for (const en of t.exercises) if (en.id === es.entryId) en.tempo = sug.action.tempo;
        s.activeSession.exercises[s.activeSession.exIndex].plan.tempo = sug.action.tempo;
      }
    }
    sug.status = action === 'apply' ? 'applied' : 'dismissed';
  });
  toast(action === 'apply' ? 'Applied' : 'Ignored');
}

function onComplete(root, params, ex, es, template) {
  unlockAudio();
  const state = store.get();
  const record = {
    weight: ex.loadType === 'dumbbell' ? draft.weight : ex.loadType === 'bodyweight' ? (draft.weight || null) : null,
    reps: draft.reps, rir: draft.rir, tempoModifier: draft.tempo,
    bandId: ex.loadType === 'band' ? draft.bandId : null,
    bandResistance: ex.loadType === 'band' ? draft.bandLevel : null,
  };
  const pr = isRepPR(state, es.exerciseId, { ...record, exerciseId: es.exerciseId });
  const planned = W.nextPlannedSet(es);
  W.completeSet(record);
  if (pr) toast(`REP PR · ${loadLabel(record, state)} × ${record.reps}`);
  vibrate(20);
  draft = null;

  const s2 = store.get();
  const es2 = W.currentExercise(s2.activeSession);
  const exerciseDone = W.isExerciseDone(es2);
  if (exerciseDone) {
    const sug = buildSuggestion(s2, es2, template);
    if (sug) store.update(s => { const prev = s.suggestions[sug.exerciseId]; if (!prev || prev.key !== sug.key || prev.status === 'pending') s.suggestions[sug.exerciseId] = { ...sug, status: 'pending', createdAt: Date.now() }; });
  }
  const lastOverall = exerciseDone && W.allMainDone(s2.activeSession) && (!s2.activeSession.finishers?.length || s2.activeSession.finisherOffered) && s2.activeSession.exercises.every(W.isExerciseDone);
  if (!lastOverall) {
    let secs = W.restSeconds(s2, template, ex, es2.plan);
    if (planned?.side === 'L') secs = Math.max(20, Math.round(secs / 2));
    W.setRest({ endsAt: Date.now() + secs * 1000, total: secs, startedAt: Date.now() });
  }
  renderWorkout(root, params, store.get());
}

// ---------- REST TIMER ----------
function renderTimer(root, state) {
  clearInterval(timerHandle);
  const ss = state.activeSession;
  const es = W.currentExercise(ss);
  const exDone = W.isExerciseDone(es);
  let nextEs = es, nextIdx = ss.exIndex;
  if (exDone) { const i = ss.exercises.findIndex((e, k) => k > ss.exIndex && !W.isExerciseDone(e)); if (i >= 0) { nextEs = ss.exercises[i]; nextIdx = i; } }
  const nextPlanned = W.nextPlannedSet(nextEs);
  const nx = getExercise(nextEs.exerciseId);
  root.innerHTML = `
    <div class="overlay">
      <div class="eyebrow center">REST</div>
      <div class="grow" style="display:flex;flex-direction:column;justify-content:center">
        <div class="timer-big" id="clock">${fmtClock((ss.rest.endsAt - Date.now()) / 1000)}</div>
        <div class="timer-bar mt-l"><i id="bar" style="width:100%"></i></div>
        <div class="center mt-l">
          <div class="label">NEXT</div>
          <div style="font-size:20px;font-weight:600">${esc(nx?.name || '')}</div>
          <div class="sub num">${nextPlanned ? `SET ${nextPlanned.setNumber} / ${nextEs.plan.sets}${nextPlanned.side ? ' · ' + (nextPlanned.side === 'L' ? 'LEFT' : 'RIGHT') : ''}` : ''}${nextIdx !== ss.exIndex ? ' · next exercise' : ''}</div>
        </div>
      </div>
      <div class="btn-row"><button class="btn" data-adj="-15">−15 SEC</button><button class="btn" data-adj="15">+15 SEC</button></div>
      <button class="btn primary mt" data-skip-timer>SKIP</button>
    </div>`;
  const tick = () => {
    const s = store.get().activeSession;
    if (!s || !s.rest) { clearInterval(timerHandle); render(); return; }
    const remain = (s.rest.endsAt - Date.now()) / 1000;
    $('#clock', root).textContent = fmtClock(remain);
    $('#bar', root).style.width = `${Math.max(0, Math.min(100, remain / s.rest.total * 100))}%`;
    if (remain <= 0) {
      clearInterval(timerHandle);
      if (store.get().settings.vibration) vibrate([120, 60, 120]);
      if (store.get().settings.sound) beep();
      W.setRest(null);
      setTimeout(render, 400);
    }
  };
  const render = () => renderWorkout(root, [], store.get());
  timerHandle = setInterval(tick, 250);
  root.onclick = e => {
    const a = e.target.closest('[data-adj]');
    if (a) { store.update(s => { const r = s.activeSession.rest; r.endsAt = Math.max(Date.now() + 1000, r.endsAt + (+a.dataset.adj) * 1000); r.total = Math.max(1, r.total + (+a.dataset.adj)); }); tick(); return; }
    if (e.target.closest('[data-skip-timer]')) { clearInterval(timerHandle); W.setRest(null); render(); }
  };
}

// ---------- FINISHER / DONE ----------
function renderFinisherChoice(root, state) {
  root.innerHTML = `
    <div class="eyebrow">${esc(state.activeSession.templateName)}</div>
    <h1 class="title sm mt">OPTIONAL FINISHER</h1>
    <div class="sub">Forearm / grip. Not part of the muscle-retention trend. Not required.</div>
    <div class="stack mt-l">
      ${state.activeSession.finishers.map(f => { const x = getExercise(f); return `<button class="btn" data-f="${f}">${esc(x.name.toUpperCase())}<span class="sub" style="font-weight:400;letter-spacing:0"> · ${esc(x.tempo.split('.')[0])}</span></button>`; }).join('')}
      <button class="btn primary" data-skipf>SKIP</button>
    </div>`;
  root.onclick = e => {
    const f = e.target.closest('[data-f]');
    if (f) { W.addFinisher(store.get(), f.dataset.f); draft = null; renderWorkout(root, [], store.get()); return; }
    if (e.target.closest('[data-skipf]')) { store.update(s => { s.activeSession.finisherOffered = true; }); renderAllDone(root, store.get()); }
  };
}

function renderAllDone(root, state) {
  const ss = state.activeSession;
  const fin = ss.finishers?.filter(f => !ss.exercises.some(e => e.exerciseId === f)) || [];
  root.innerHTML = `
    <div class="eyebrow">${esc(ss.templateName)}</div>
    <h1 class="title sm mt">ALL EXERCISES DONE</h1>
    <div class="sub num">${ss.exercises.reduce((a, e) => a + e.sets.length, 0)} sets · ${fmtDuration(Math.round((Date.now() - ss.startedAt) / 1000))}</div>
    <button class="btn primary mt-l" data-finish>FINISH WORKOUT</button>
    ${fin.length ? `<button class="btn ghost mt" data-fin>ADD OPTIONAL FINISHER</button>` : ''}
    <button class="btn ghost mt" data-list>BACK TO EXERCISE LIST</button>`;
  root.onclick = e => {
    if (e.target.closest('[data-finish]')) finishFlow();
    if (e.target.closest('[data-fin]')) { store.update(s => { s.activeSession.finisherOffered = false; }); renderFinisherChoice(root, store.get()); }
    if (e.target.closest('[data-list]')) exerciseList(root, [], store.get());
  };
}

async function finishFlow() {
  const ss = store.get().activeSession;
  const sets = ss.exercises.reduce((a, e) => a + e.sets.length, 0);
  const ok = await confirmSheet('Finish workout?', sets ? `${sets} sets logged. The session will be saved.` : 'No sets logged. The session will be saved as empty and discarded.', { okLabel: 'CONFIRM' });
  if (!ok) return;
  clearInterval(timerHandle); clearInterval(elapsedHandle);
  if (!sets) { W.discardSession(); navigate('today'); return; }
  const finished = W.finishSession();
  draft = null;
  navigate('summary/' + finished.id);
}
