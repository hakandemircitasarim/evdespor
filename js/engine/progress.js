// Progress engine: explainable, per-exercise comparisons under similar conditions.
// Core idea: compare reps at the SAME load + SAME tempo modifier with RIR taken into account.
import { getExercise, TEMPO_PROGRESSION, TEMPO_MAP } from '../data/exercises.js';

const EXCLUDED = new Set(['gyroball', 'hand_gripper']);

// Load key: what makes two sets "comparable" in load terms.
export function loadKey(set) {
  if (set.bandId || set.bandResistance) return `band:${set.bandId || ''}:${set.bandResistance || ''}`;
  if (set.weight == null) return 'bw';
  return `kg:${set.weight}`;
}
export function loadLabel(set, state) {
  if (set.bandId || set.bandResistance) {
    const band = state?.settings.bands.find(b => b.id === set.bandId);
    return band ? `${band.name} (${band.level})` : (set.bandResistance || 'Band');
  }
  if (set.weight == null) return 'Bodyweight';
  return `${set.weight} kg`;
}

// All completed sessions containing this exercise, oldest → newest.
export function exerciseHistory(state, exerciseId) {
  const out = [];
  for (const session of state.sessions) {
    for (const es of session.exercises) {
      if (es.exerciseId !== exerciseId || !es.sets.length) continue;
      out.push({ session, es, date: session.startedAt, sets: es.sets });
    }
  }
  return out;
}

export function lastPerformance(state, exerciseId) {
  const h = exerciseHistory(state, exerciseId);
  return h.length ? h[h.length - 1] : null;
}

// Per-session summary used everywhere.
export function summarize(sets) {
  const reps = sets.map(s => s.reps || 0);
  const total = reps.reduce((a, b) => a + b, 0);
  const avgRir = sets.length ? sets.reduce((a, s) => a + (s.rir ?? 0), 0) / sets.length : 0;
  // Effective reps: reps + RIR ≈ reps to failure. Lets a 20 @ 3 RIR compare with 23 @ 0 RIR.
  const effAvg = sets.length ? sets.reduce((a, s) => a + (s.reps || 0) + (s.rir ?? 0), 0) / sets.length : 0;
  const dominant = dominantKey(sets);
  return { reps, total, avgRir, effAvg, sets: sets.length, loadKey: dominant.loadKey, tempo: dominant.tempo, weight: dominant.weight };
}

function dominantKey(sets) {
  const counts = {};
  for (const s of sets) {
    const k = `${loadKey(s)}|${s.tempoModifier || 'normal'}`;
    counts[k] = counts[k] || { n: 0, loadKey: loadKey(s), tempo: s.tempoModifier || 'normal', weight: s.weight };
    counts[k].n++;
  }
  return Object.values(counts).sort((a, b) => b.n - a.n)[0] || { loadKey: 'bw', tempo: 'normal', weight: null };
}

// Trend across the last 3–5 sessions under the same conditions as the most recent one.
export function trend(state, exerciseId) {
  const hist = exerciseHistory(state, exerciseId);
  if (!hist.length) return { status: 'none', label: 'NO DATA', comparable: [] };
  const latest = summarize(hist[hist.length - 1].sets);
  const comparable = hist
    .map(h => ({ ...h, sum: summarize(h.sets) }))
    .filter(h => h.sum.loadKey === latest.loadKey && h.sum.tempo === latest.tempo)
    .slice(-5);
  if (comparable.length < 3) {
    return { status: 'insufficient', label: 'NOT ENOUGH DATA', comparable, note: `${comparable.length}/3 comparable sessions` };
  }
  const vals = comparable.map(h => h.sum.effAvg);
  const half = Math.floor(vals.length / 2);
  const early = vals.slice(0, half).reduce((a, b) => a + b, 0) / half;
  const late = vals.slice(-half).reduce((a, b) => a + b, 0) / half;
  const delta = early ? (late - early) / early : 0;
  let status = 'stable', label = '→ STABLE';
  if (delta > 0.04) { status = 'improving'; label = '↑ IMPROVING'; }
  else if (delta < -0.04) { status = 'declining'; label = '↓ DECLINING'; }
  // Declining alarm only when the last sessions are consistently lower
  const consecutiveDown = countConsecutiveDown(vals);
  return { status, label, delta, comparable, consecutiveDown, note: `${comparable.length} comparable sessions · ${Math.round(delta * 100)}% effective reps` };
}

function countConsecutiveDown(vals) {
  let n = 0;
  for (let i = vals.length - 1; i > 0; i--) {
    if (vals[i] < vals[i - 1]) n++; else break;
  }
  return n;
}

// Rep PRs: best single-set reps per load key (exclude finishers).
export function repPRs(state, exerciseId) {
  const best = {};
  for (const h of exerciseHistory(state, exerciseId)) {
    for (const s of h.sets) {
      const k = loadKey(s);
      if (!best[k] || s.reps > best[k].reps) best[k] = { ...s, date: h.date };
    }
  }
  return best;
}

// Is this set a new rep PR for its load? (checked before it is added)
export function isRepPR(state, exerciseId, set) {
  if (EXCLUDED.has(exerciseId)) return false;
  const prs = repPRs(state, exerciseId);
  const prev = prs[loadKey(set)];
  return prev ? set.reps > prev.reps : false;
}

// Suggestion: only a message + optional action. Never changes the program by itself.
export function buildSuggestion(state, es, template) {
  const exercise = getExercise(es.exerciseId);
  if (!exercise || es.optional || EXCLUDED.has(es.exerciseId) || es.sets.length < es.plan.sets) return null;
  const main = es.sets.filter(s => !s.side || s.side === 'L');
  const allTop = main.every(s => s.reps >= es.plan.maxReps && (s.rir ?? 0) >= es.plan.rirMin);
  if (!allTop) return null;
  const sum = summarize(es.sets);
  const key = `${es.exerciseId}|${sum.loadKey}|${sum.tempo}|${es.plan.maxReps}`;
  const weights = [...state.settings.dumbbellWeights].sort((a, b) => a - b);
  const maxW = weights[weights.length - 1];
  const tempoIdx = TEMPO_PROGRESSION.indexOf(sum.tempo);
  if (exercise.loadType === 'dumbbell' && sum.weight != null && sum.weight < maxW) {
    const next = weights.find(w => w > sum.weight);
    return { key, exerciseId: es.exerciseId, text: `You reached the top of the rep range (${es.plan.maxReps}) on every set at ${sum.weight} kg. Next session: try ${next} kg.`, action: { type: 'weight', weight: next } };
  }
  if (exercise.loadType === 'band') {
    return { key, exerciseId: es.exerciseId, text: `Top of the rep range reached on every set. Next session: use a heavier band or slow the eccentric.`, action: tempoIdx >= 0 && tempoIdx < TEMPO_PROGRESSION.length - 1 ? { type: 'tempo', tempo: TEMPO_PROGRESSION[tempoIdx + 1] } : null };
  }
  if (tempoIdx >= 0 && tempoIdx < TEMPO_PROGRESSION.length - 1) {
    const nextTempo = TEMPO_PROGRESSION[tempoIdx + 1];
    const w = sum.weight != null ? `${sum.weight} kg` : 'this load';
    return { key, exerciseId: es.exerciseId, text: `Top of the rep range reached with ${w}${sum.weight === maxW ? ' (your max dumbbell)' : ''}. Next session: try ${TEMPO_MAP[nextTempo].label.toLowerCase()}.`, action: { type: 'tempo', tempo: nextTempo } };
  }
  const alt = exercise.alternatives?.[0] ? getExercise(exercise.alternatives[0]) : null;
  return { key, exerciseId: es.exerciseId, text: `Top of the rep range reached with the hardest tempo. Consider a mechanically harder variation${alt ? ` (e.g. ${alt.name})` : ''}.`, action: null };
}

// Session vs previous session of same template, per exercise (excludes finishers).
export function compareSessions(current, previous) {
  const rows = [];
  let totalDelta = 0;
  for (const es of current.exercises) {
    if (es.optional || EXCLUDED.has(es.exerciseId)) continue;
    const ex = getExercise(es.exerciseId);
    const cur = summarize(es.sets);
    const prevEs = previous?.exercises.find(p => p.exerciseId === es.exerciseId);
    if (!prevEs) { rows.push({ name: ex?.name || es.exerciseId, label: 'New', delta: null }); continue; }
    const prev = summarize(prevEs.sets);
    if (prev.loadKey !== cur.loadKey || prev.tempo !== cur.tempo) {
      rows.push({ name: ex?.name || es.exerciseId, label: 'Load/tempo changed', delta: null });
      continue;
    }
    const d = cur.total - prev.total;
    totalDelta += d;
    rows.push({ name: ex?.name || es.exerciseId, label: d === 0 ? 'Stable' : `${d > 0 ? '+' : ''}${d} reps`, delta: d });
  }
  return { rows, totalDelta, hasPrevious: !!previous };
}

export function totalSets(session) { return session.exercises.reduce((a, e) => a + e.sets.length, 0); }
export function totalReps(session) { return session.exercises.filter(e => !e.optional).reduce((a, e) => a + e.sets.reduce((x, s) => x + (s.reps || 0), 0), 0); }
