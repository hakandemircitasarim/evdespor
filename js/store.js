// Kalıcı uygulama durumu. localStorage'da tek JSON belgesi, her değişiklikten sonra senkron kaydedilir.
import { buildDefaultProgram, PROGRAM_VERSION } from './data/program.js';

const KEY = 'evdespor.state.v1';
export const SCHEMA_VERSION = 2;

export function defaultSettings() {
  return {
    onboarded: false,
    dumbbellWeights: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    safeAnchor: false,
    vibration: true,
    sound: false,
    restDefaults: { hardCompound: 120, hardIsolation: 90, lightCompound: 75, lightIsolation: 60 },
    bands: [
      { id: 'band_1', name: 'Kırmızı Band', level: 'Light' },
      { id: 'band_2', name: 'Siyah Band', level: 'Medium' },
      { id: 'band_3', name: 'Mor Band', level: 'Heavy' },
    ],
    restriction: { enabled: false, type: 'all', customTemplateIds: [] },
  };
}

export function defaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: defaultSettings(),
    program: buildDefaultProgram(),
    sessions: [],            // tamamlanmış WorkoutSession[]
    activeSession: null,     // devam eden WorkoutSession (her setten sonra kaydedilir)
    recovery: { date: null, state: null },  // 'ready' | 'tired' | 'not_recovered'
    exerciseState: {},       // exerciseId -> { plannedWeight, plannedTempo, lastWeight, ... }
    suggestions: {},         // exerciseId -> { key, text, action, status }
    lastCompletedTemplateId: null,
    mediaMeta: {},
  };
}

let state = null;
const listeners = new Set();

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // migrate() nesneyi yerinde değiştirebilir; kararı önce ver.
      const needsSave = parsed.schemaVersion !== SCHEMA_VERSION || (parsed.program?.version || 1) !== PROGRAM_VERSION;
      state = migrate(parsed);
      // Geçiş yapıldıysa hemen kalıcı hale getir (dışa aktarma güncel şemayı içersin).
      if (needsSave) save();
    }
  } catch (e) {
    console.error('State load failed', e);
  }
  if (!state) state = defaultState();
  return state;
}

// Eski İngilizce şablon adları → Türkçe (v1 → v2)
const NAME_MAP = { 'HARD PUSH': 'AĞIR PUSH', 'LIGHT PULL': 'HAFİF PULL', 'HARD LEGS': 'AĞIR BACAK', 'LIGHT PUSH': 'HAFİF PUSH', 'HARD PULL': 'AĞIR PULL', 'LIGHT LEGS': 'HAFİF BACAK', 'REST': 'DİNLENME' };
const BAND_NAME_MAP = { 'Red Band': 'Kırmızı Band', 'Black Band': 'Siyah Band', 'Purple Band': 'Mor Band' };

function migrate(s) {
  const base = defaultState();
  const out = { ...base, ...s };
  out.settings = { ...base.settings, ...(s.settings || {}) };
  out.settings.restDefaults = { ...base.settings.restDefaults, ...(s.settings?.restDefaults || {}) };
  out.settings.restriction = { ...base.settings.restriction, ...(s.settings?.restriction || {}) };
  if (!out.program || !out.program.templates) out.program = base.program;

  if ((out.program.version || 1) < PROGRAM_VERSION) migrateProgramV2(out, base);

  for (const b of out.settings.bands || []) if (BAND_NAME_MAP[b.name]) b.name = BAND_NAME_MAP[b.name];
  for (const ss of out.sessions || []) if (NAME_MAP[ss.templateName]) ss.templateName = NAME_MAP[ss.templateName];
  if (out.activeSession && NAME_MAP[out.activeSession.templateName]) out.activeSession.templateName = NAME_MAP[out.activeSession.templateName];

  out.schemaVersion = SCHEMA_VERSION;
  return out;
}

// v2: Türkçe adlar/notlar ve Day 1'e Incline Dumbbell Press.
function migrateProgramV2(out, base) {
  const stored = out.program;
  const fresh = base.program;
  const ids = t => (t?.exercises || []).map(e => e.exerciseId).join(',');
  const v1Default = { ...fresh.templates };
  const v1HardPush = { ...fresh.templates.hard_push, exercises: fresh.templates.hard_push.exercises.filter(e => e.exerciseId !== 'incline_db_press') };
  v1Default.hard_push = v1HardPush;
  const untouched = Object.keys(v1Default).every(id => ids(stored.templates[id]) === ids(v1Default[id]))
    && JSON.stringify(stored.cycle) === JSON.stringify(fresh.cycle);
  if (untouched) {
    // Kullanıcı programı hiç değiştirmemiş: v2 varsayılanını doğrudan al (tempo/rest düzenlemeleri korunur).
    for (const [id, t] of Object.entries(fresh.templates)) {
      const old = stored.templates[id];
      for (const en of t.exercises) {
        const prev = old?.exercises.find(e => e.exerciseId === en.exerciseId);
        if (prev) { en.tempo = prev.tempo || en.tempo; en.rest = prev.rest ?? en.rest; en.id = prev.id || en.id; }
      }
    }
    out.program = fresh;
    return;
  }
  // Kullanıcı düzenlemiş: minimal değişiklik.
  for (const [id, t] of Object.entries(stored.templates)) {
    if (NAME_MAP[t.name]) t.name = NAME_MAP[t.name];
    if (fresh.templates[id] && t.muscles && /[A-Za-z]/.test(t.muscles) && !/[çğıöşüÇĞİÖŞÜ]/.test(t.muscles)) t.muscles = fresh.templates[id].muscles;
  }
  const hp = stored.templates.hard_push;
  if (hp && !hp.exercises.some(e => e.exerciseId === 'incline_db_press')) {
    const i = hp.exercises.findIndex(e => e.exerciseId === 'db_bench_press');
    hp.exercises.splice(i + 1, 0, { id: 'd1_incline', exerciseId: 'incline_db_press', sets: 3, minReps: 15, maxReps: 25, rirMin: 1, rirMax: 2, rest: null, tempo: 'normal', notes: 'Bench 30–45°. Üst göğüs.', lastSetToFailure: false });
  }
  stored.version = PROGRAM_VERSION;
}

export function get() { return state || load(); }

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('State save failed', e);
    alert('Veri kaydedilemedi (depolama dolu veya kullanılamıyor).');
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
