// Workout engine: builds sessions from program templates, applies settings
// (anchor substitution, restriction), manages the active session.
import * as store from '../store.js';
import { getExercise } from '../data/exercises.js';
import { FINISHER_DEFAULTS } from '../data/program.js';

export function templateList(state) {
  return state.program.cycle.map(id => state.program.templates[id]).filter(Boolean);
}

export function isPaused(state, template) {
  const r = state.settings.restriction;
  if (!r.enabled || template.type === 'rest') return false;
  if (r.type === 'all') return true;
  if (r.type === 'legs') return template.focus === 'legs';
  if (r.type === 'custom') return (r.customTemplateIds || []).includes(template.id);
  return false;
}

// Sequential cycle: the workout after the last completed one. Skips paused templates.
export function nextTemplate(state) {
  const cycle = state.program.cycle;
  if (!cycle.length) return null;
  let idx = cycle.indexOf(state.lastCompletedTemplateId);
  for (let i = 1; i <= cycle.length; i++) {
    const t = state.program.templates[cycle[(idx + i) % cycle.length]];
    if (t && !isPaused(state, t)) return t;
  }
  return state.program.templates[cycle[(idx + 1) % cycle.length]] || null;
}

export function templateAfter(state, templateId) {
  const cycle = state.program.cycle;
  const idx = cycle.indexOf(templateId);
  return state.program.templates[cycle[(idx + 1) % cycle.length]] || null;
}

// Substitute anchor-dependent exercises when no safe anchor is available.
export function resolveExerciseId(state, exerciseId) {
  const ex = getExercise(exerciseId);
  if (!ex) return exerciseId;
  if (ex.needsAnchor && !state.settings.safeAnchor && ex.noAnchorAlt) return ex.noAnchorAlt;
  return exerciseId;
}

export function restSeconds(state, template, exercise, entry) {
  if (entry && entry.rest) return entry.rest;
  const d = state.settings.restDefaults;
  const hard = template.type === 'hard';
  const compound = exercise.mechanic === 'compound';
  if (hard) return compound ? d.hardCompound : d.hardIsolation;
  return compound ? d.lightCompound : d.lightIsolation;
}

// Build the list of planned sets for an exercise entry (unilateral → L/R per set).
function plannedSets(entry, exercise) {
  const sets = [];
  for (let s = 1; s <= entry.sets; s++) {
    if (exercise.unilateral) {
      sets.push({ setNumber: s, side: 'L' });
      sets.push({ setNumber: s, side: 'R' });
    } else sets.push({ setNumber: s, side: null });
  }
  return sets;
}

export function buildExerciseSession(state, entry, opts = {}) {
  const exerciseId = opts.exerciseId || resolveExerciseId(state, entry.exerciseId);
  const exercise = getExercise(exerciseId);
  return {
    id: store.uid(),
    entryId: entry.id,
    exerciseId,
    originalExerciseId: entry.exerciseId !== exerciseId ? entry.exerciseId : null,
    substitutedReason: entry.exerciseId !== exerciseId ? (opts.reason || 'no_anchor') : null,
    optional: !!opts.optional,
    plan: {
      sets: entry.sets, minReps: entry.minReps, maxReps: entry.maxReps,
      rirMin: entry.rirMin, rirMax: entry.rirMax, tempo: entry.tempo || 'normal',
      notes: entry.notes || '', lastSetToFailure: !!entry.lastSetToFailure,
      unit: opts.unit || (exercise.loadType === 'time' ? 'sec' : 'reps'),
      rest: entry.rest || null,
    },
    planned: plannedSets(entry, exercise),
    sets: [],       // SetRecord[]
    skipped: false,
  };
}

export function startSession(state, template) {
  const session = {
    id: store.uid(),
    templateId: template.id,
    templateName: template.name,
    templateType: template.type,
    startedAt: Date.now(),
    endedAt: null,
    recovery: state.recovery.date === today() ? state.recovery.state : null,
    exercises: template.exercises.map(e => buildExerciseSession(state, e)),
    finishers: template.finishers || [],
    finisherOffered: false,
    exIndex: 0,
    setIndex: 0,
    rest: null,     // { endsAt, total }
    rating: null, note: '',
  };
  store.update(s => { s.activeSession = session; });
  return session;
}

export function addFinisher(state, exerciseId) {
  const d = FINISHER_DEFAULTS[exerciseId];
  const entry = { id: 'fin_' + exerciseId, exerciseId, sets: d.sets, minReps: d.minReps, maxReps: d.maxReps, rirMin: d.rirMin, rirMax: d.rirMax, rest: 45, tempo: 'normal', notes: '' };
  store.update(s => {
    const es = buildExerciseSession(s, entry, { exerciseId, optional: true, unit: d.unit });
    s.activeSession.exercises.push(es);
    s.activeSession.exIndex = s.activeSession.exercises.length - 1;
    s.activeSession.setIndex = 0;
    s.activeSession.finisherOffered = true;
  });
}

export const today = () => new Date().toISOString().slice(0, 10);

export function currentExercise(session) { return session.exercises[session.exIndex] || null; }

export function nextPlannedSet(es) {
  return es.planned[es.sets.length] || null;
}

export function isExerciseDone(es) { return es.skipped || es.sets.length >= es.planned.length; }

export function completeSet(record) {
  store.update(s => {
    const ss = s.activeSession;
    const es = ss.exercises[ss.exIndex];
    const planned = nextPlannedSet(es);
    const rec = {
      id: store.uid(),
      exerciseId: es.exerciseId,
      timestamp: Date.now(),
      setNumber: planned ? planned.setNumber : es.sets.length + 1,
      side: planned ? planned.side : null,
      weight: record.weight ?? null,
      reps: record.reps,
      rir: record.rir,
      tempoModifier: record.tempoModifier || 'normal',
      bandResistance: record.bandResistance ?? null,
      bandId: record.bandId ?? null,
      notes: record.notes || '',
      unit: es.plan.unit || 'reps',
    };
    es.sets.push(rec);
    // remember last used load per exercise for next time
    s.exerciseState[es.exerciseId] = {
      ...(s.exerciseState[es.exerciseId] || {}),
      lastWeight: rec.weight, lastBandId: rec.bandId, lastBandResistance: rec.bandResistance, lastTempo: rec.tempoModifier,
    };
  });
}

export function undoLastSet() {
  store.update(s => {
    const es = s.activeSession.exercises[s.activeSession.exIndex];
    es.sets.pop();
    s.activeSession.rest = null;
  });
}

export function editLastSet(patch) {
  store.update(s => {
    const es = s.activeSession.exercises[s.activeSession.exIndex];
    const last = es.sets[es.sets.length - 1];
    if (last) Object.assign(last, patch);
  });
}

export function setRest(rest) { store.update(s => { if (s.activeSession) s.activeSession.rest = rest; }); }

export function goToExercise(index) {
  store.update(s => { s.activeSession.exIndex = index; s.activeSession.rest = null; });
}

// Advance to the next exercise that is not finished. Returns false if none left.
export function advanceExercise() {
  let moved = false;
  store.update(s => {
    const ss = s.activeSession;
    for (let i = ss.exIndex + 1; i < ss.exercises.length; i++) {
      if (!isExerciseDone(ss.exercises[i])) { ss.exIndex = i; moved = true; break; }
    }
    if (!moved) {
      for (let i = 0; i < ss.exercises.length; i++) {
        if (!isExerciseDone(ss.exercises[i])) { ss.exIndex = i; moved = true; break; }
      }
    }
    ss.rest = null;
  });
  return moved;
}

export function skipExercise() {
  store.update(s => { s.activeSession.exercises[s.activeSession.exIndex].skipped = true; });
  return advanceExercise();
}

export function swapExercise(altId) {
  store.update(s => {
    const ss = s.activeSession;
    const es = ss.exercises[ss.exIndex];
    const entry = { ...es.plan, id: es.entryId, exerciseId: altId };
    const fresh = buildExerciseSession(s, entry, { exerciseId: altId, reason: 'manual', optional: es.optional, unit: entry.unit });
    fresh.originalExerciseId = es.originalExerciseId || es.exerciseId;
    fresh.substitutedReason = 'manual';
    ss.exercises[ss.exIndex] = fresh;
    ss.rest = null;
  });
}

export function allMainDone(session) {
  return session.exercises.filter(e => !e.optional).every(isExerciseDone);
}

export function finishSession(extra = {}) {
  let finished = null;
  store.update(s => {
    const ss = s.activeSession;
    if (!ss) return;
    ss.endedAt = Date.now();
    ss.durationSec = Math.round((ss.endedAt - ss.startedAt) / 1000);
    Object.assign(ss, extra);
    // Drop exercises with no sets
    ss.exercises = ss.exercises.filter(e => e.sets.length > 0);
    delete ss.rest;
    s.sessions.push(ss);
    s.lastCompletedTemplateId = ss.templateId;
    s.activeSession = null;
    finished = ss;
  });
  return finished;
}

export function discardSession() { store.update(s => { s.activeSession = null; }); }

// Previous session of the same template (for summary comparison)
export function previousSessionOfTemplate(state, templateId, excludeId) {
  for (let i = state.sessions.length - 1; i >= 0; i--) {
    const s = state.sessions[i];
    if (s.templateId === templateId && s.id !== excludeId) return s;
  }
  return null;
}

// Weight stepping through the available dumbbell list
export function stepWeight(state, current, dir) {
  const list = [...state.settings.dumbbellWeights].sort((a, b) => a - b);
  if (!list.length) return Math.max(0, (current || 0) + dir);
  if (current == null) return list[0];
  const i = list.findIndex(w => w >= current);
  if (dir > 0) {
    if (i === -1) return current;
    return list[Math.min(list.length - 1, list[i] === current ? i + 1 : i)];
  }
  if (i === -1) return list[list.length - 1];
  return list[Math.max(0, list[i] === current ? i - 1 : i - 1)];
}
