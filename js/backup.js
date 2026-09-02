// Export / import. JSON = full state (restores everything). CSV = flat set history.
import * as store from './store.js';
import { getExercise } from './data/exercises.js';

export function exportJSON() {
  const state = store.get();
  const payload = { app: 'evdespor', exportedAt: new Date().toISOString(), schemaVersion: state.schemaVersion, state };
  download(`evdespor-backup-${stamp()}.json`, JSON.stringify(payload, null, 2), 'application/json');
}

export function exportCSV() {
  const state = store.get();
  const rows = [['session_id', 'date', 'workout', 'exercise_id', 'exercise', 'set', 'side', 'weight_kg', 'band', 'band_level', 'reps', 'unit', 'rir', 'tempo', 'optional', 'notes']];
  for (const s of state.sessions) for (const es of s.exercises) for (const r of es.sets) {
    const band = state.settings.bands.find(b => b.id === r.bandId);
    rows.push([s.id, new Date(r.timestamp).toISOString(), s.templateName, es.exerciseId, getExercise(es.exerciseId)?.name || es.exerciseId, r.setNumber, r.side || '', r.weight ?? '', band?.name || '', r.bandResistance || '', r.reps, r.unit || 'reps', r.rir, r.tempoModifier, es.optional ? 1 : 0, r.notes || '']);
  }
  download(`evdespor-history-${stamp()}.csv`, rows.map(r => r.map(csv).join(',')).join('\n'), 'text/csv');
}

export async function importJSON(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const state = parsed.state && parsed.app === 'evdespor' ? parsed.state : parsed;
  if (!state || !state.program || !Array.isArray(state.sessions)) throw new Error('Not an EVDESPOR backup');
  store.replaceState(state);
  return state.sessions.length;
}

const csv = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const stamp = () => new Date().toISOString().slice(0, 10);

function download(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
}
