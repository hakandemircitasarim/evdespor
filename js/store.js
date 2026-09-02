// Persistent app state. Single JSON document in localStorage, saved synchronously after every mutation.
import { buildDefaultProgram } from './data/program.js';

const KEY = 'evdespor.state.v1';
export const SCHEMA_VERSION = 1;

export function defaultSettings() {
  return {
    onboarded: false,
    dumbbellWeights: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    safeAnchor: false,
    vibration: true,
    sound: false,
    restDefaults: { hardCompound: 120, hardIsolation: 90, lightCompound: 75, lightIsolation: 60 },
    bands: [
      { id: 'band_1', name: 'Red Band', level: 'Light' },
      { id: 'band_2', name: 'Black Band', level: 'Medium' },
      { id: 'band_3', name: 'Purple Band', level: 'Heavy' },
    ],
    restriction: { enabled: false, type: 'all', customTemplateIds: [] },
  };
}

export function defaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: defaultSettings(),
    program: buildDefaultProgram(),
    sessions: [],            // completed WorkoutSession[]
    activeSession: null,     // in-progress WorkoutSession (persisted after every set)
    recovery: { date: null, state: null },  // 'ready' | 'tired' | 'not_recovered'
    exerciseState: {},       // exerciseId -> { plannedWeight, plannedBandId, plannedTempo }
    suggestions: {},         // exerciseId -> { key, text, action, dismissed }
    lastCompletedTemplateId: null,
    mediaMeta: {},           // exerciseId -> user-overridden media metadata (reserved)
  };
}

let state = null;
const listeners = new Set();

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = migrate(parsed);
    }
  } catch (e) {
    console.error('State load failed', e);
  }
  if (!state) state = defaultState();
  return state;
}

function migrate(s) {
  const base = defaultState();
  const out = { ...base, ...s };
  out.settings = { ...base.settings, ...(s.settings || {}) };
  out.settings.restDefaults = { ...base.settings.restDefaults, ...(s.settings?.restDefaults || {}) };
  out.settings.restriction = { ...base.settings.restriction, ...(s.settings?.restriction || {}) };
  if (!out.program || !out.program.templates) out.program = base.program;
  out.schemaVersion = SCHEMA_VERSION;
  return out;
}

export function get() { return state || load(); }

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('State save failed', e);
    alert('Could not save data (storage full or unavailable).');
  }
  listeners.forEach(fn => fn(state));
}

export function update(fn) {
  fn(state);
  save();
  return state;
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function replaceState(next) {
  state = migrate(next);
  save();
}

export function resetAll() {
  state = defaultState();
  save();
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
