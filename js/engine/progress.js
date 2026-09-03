// Progress motoru: açıklanabilir, egzersiz bazlı, benzer koşullar altında karşılaştırma.
// Temel fikir: AYNI yük + AYNI tempo modifier altında tekrarları, RIR'ı hesaba katarak karşılaştır.
import { getExercise, TEMPO_PROGRESSION, TEMPO_MAP, bandLevelLabel } from '../data/exercises.js';

const EXCLUDED = new Set(['gyroball', 'hand_gripper']);

// Yük anahtarı: iki seti "karşılaştırılabilir" yapan şey.
export function loadKey(set) {
  if (set.bandId || set.bandResistance) return `band:${set.bandId || ''}:${set.bandResistance || ''}`;
  if (set.weight == null) return 'bw';
  return `kg:${set.weight}`;
}
export function loadLabel(set, state) {
  if (set.bandId || set.bandResistance) {
    const band = state?.settings.bands.find(b => b.id === set.bandId);
    return band ? `${band.name} (${bandLevelLabel(band.level)})` : (bandLevelLabel(set.bandResistance) || 'Band');
  }
  if (set.weight == null || set.weight === 0) return 'Vücut ağırlığı';
  return `${set.weight} kg`;
}

// Tekrarları okunur biçimde: tek taraflı hareketlerde set başına "SolxSağ".
export function repsLabel(sets) {
  if (!sets.length) return '';
  if (!sets.some(s => s.side)) return sets.map(s => s.reps).join(' / ');
  const bySet = {};
  for (const s of sets) { bySet[s.setNumber] = bySet[s.setNumber] || {}; bySet[s.setNumber][s.side || 'L'] = s.reps; }
  return Object.keys(bySet).sort((a, b) => a - b).map(k => { const v = bySet[k]; return `${v.L ?? '–'}|${v.R ?? '–'}`; }).join(' / ');
}

// Bu egzersizi içeren tamamlanmış seanslar, eskiden yeniye.
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

// Son performans. templateId verilirse önce aynı antrenman günündeki son seans tercih edilir
// (AĞIR ve HAFİF günlerin RIR hedefleri farklı olduğu için).
export function lastPerformance(state, exerciseId, templateId) {
  const h = exerciseHistory(state, exerciseId);
  if (!h.length) return null;
  if (templateId) {
    for (let i = h.length - 1; i >= 0; i--) if (h[i].session.templateId === templateId) return { ...h[i], sameTemplate: true };
  }
  return { ...h[h.length - 1], sameTemplate: !templateId };
}

// Seans özeti.
export function summarize(sets) {
  const reps = sets.map(s => s.reps || 0);
  const total = reps.reduce((a, b) => a + b, 0);
  const avgRir = sets.length ? sets.reduce((a, s) => a + (s.rir ?? 0), 0) / sets.length : 0;
  // Etkili tekrar: reps + RIR ≈ failure'a kadar tekrar. 20 @ 3 RIR ile 23 @ 0 RIR karşılaştırılabilir olur.
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

// Son seansla aynı koşullardaki son 3–5 seans üzerinden trend.
export function trend(state, exerciseId) {
  const hist = exerciseHistory(state, exerciseId);
  if (!hist.length) return { status: 'none', label: 'VERİ YOK', comparable: [] };
  const latest = summarize(hist[hist.length - 1].sets);
  const comparable = hist
    .map(h => ({ ...h, sum: summarize(h.sets) }))
    .filter(h => h.sum.loadKey === latest.loadKey && h.sum.tempo === latest.tempo)
    .slice(-5);
  if (comparable.length < 3) {
    return { status: 'insufficient', label: 'YETERSİZ VERİ', comparable, note: `${comparable.length}/3 karşılaştırılabilir seans` };
  }
  const vals = comparable.map(h => h.sum.effAvg);
  const half = Math.floor(vals.length / 2);
  const early = vals.slice(0, half).reduce((a, b) => a + b, 0) / half;
  const late = vals.slice(-half).reduce((a, b) => a + b, 0) / half;
  const delta = early ? (late - early) / early : 0;
  let status = 'stable', label = '→ STABİL';
  if (delta > 0.04) { status = 'improving'; label = '↑ GELİŞİYOR'; }
  else if (delta < -0.04) { status = 'declining'; label = '↓ DÜŞÜYOR'; }
  const consecutiveDown = countConsecutiveDown(vals);
  return { status, label, delta, comparable, consecutiveDown, note: `${comparable.length} karşılaştırılabilir seans · etkili tekrar %${Math.round(delta * 100)}` };
}

function countConsecutiveDown(vals) {
  let n = 0;
  for (let i = vals.length - 1; i > 0; i--) {
    if (vals[i] < vals[i - 1]) n++; else break;
  }
  return n;
}

// Tekrar PR'ları: yük başına en iyi tek set (finisher hariç).
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

export function isRepPR(state, exerciseId, set) {
  if (EXCLUDED.has(exerciseId)) return false;
  const prs = repPRs(state, exerciseId);
  const prev = prs[loadKey(set)];
  return prev ? set.reps > prev.reps : false;
}

// Öneri: yalnızca mesaj + isteğe bağlı aksiyon. Programı kendi kendine asla değiştirmez.
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
    return { key, exerciseId: es.exerciseId, text: `${sum.weight} kg ile her sette hedef tekrar aralığının üst sınırına (${es.plan.maxReps}) ulaştın. Sonraki seans: ${next} kg dene.`, action: { type: 'weight', weight: next } };
  }
  if (exercise.loadType === 'band') {
    return { key, exerciseId: es.exerciseId, text: `Her sette tekrar aralığının üst sınırına ulaştın. Sonraki seans: daha ağır band kullan veya eccentric'i yavaşlat.`, action: tempoIdx >= 0 && tempoIdx < TEMPO_PROGRESSION.length - 1 ? { type: 'tempo', tempo: TEMPO_PROGRESSION[tempoIdx + 1] } : null };
  }
  if (tempoIdx >= 0 && tempoIdx < TEMPO_PROGRESSION.length - 1) {
    const nextTempo = TEMPO_PROGRESSION[tempoIdx + 1];
    const w = sum.weight != null ? `${sum.weight} kg` : 'bu yük';
    return { key, exerciseId: es.exerciseId, text: `${w}${sum.weight === maxW ? ' (maksimum dumbbell)' : ''} ile tekrar aralığının üst sınırına ulaştın. Sonraki seans: ${TEMPO_MAP[nextTempo].label.toLowerCase()} dene.`, action: { type: 'tempo', tempo: nextTempo } };
  }
  const alt = exercise.alternatives?.[0] ? getExercise(exercise.alternatives[0]) : null;
  return { key, exerciseId: es.exerciseId, text: `En zor tempoyla tekrar aralığının üst sınırına ulaştın. Mekanik olarak daha zor bir varyasyon düşün${alt ? ` (örn. ${alt.name})` : ''}.`, action: null };
}

// Aynı şablonun önceki seansıyla egzersiz bazlı karşılaştırma (finisher hariç).
export function compareSessions(current, previous) {
  const rows = [];
  let totalDelta = 0;
  for (const es of current.exercises) {
    if (es.optional || EXCLUDED.has(es.exerciseId)) continue;
    const ex = getExercise(es.exerciseId);
    const cur = summarize(es.sets);
    const prevEs = previous?.exercises.find(p => p.exerciseId === es.exerciseId);
    if (!prevEs) { rows.push({ name: ex?.name || es.exerciseId, label: 'Yeni', delta: null }); continue; }
    const prev = summarize(prevEs.sets);
    if (prev.loadKey !== cur.loadKey || prev.tempo !== cur.tempo) {
      rows.push({ name: ex?.name || es.exerciseId, label: 'Yük/tempo değişti', delta: null });
      continue;
    }
    const d = cur.total - prev.total;
    totalDelta += d;
    rows.push({ name: ex?.name || es.exerciseId, label: d === 0 ? 'Stabil' : `${d > 0 ? '+' : ''}${d} tekrar`, delta: d });
  }
  return { rows, totalDelta, hasPrevious: !!previous };
}

export function totalSets(session) { return session.exercises.reduce((a, e) => a + e.sets.length, 0); }
export function totalReps(session) { return session.exercises.filter(e => !e.optional).reduce((a, e) => a + e.sets.reduce((x, s) => x + (s.reps || 0), 0), 0); }
