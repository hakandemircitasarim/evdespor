// Program: 7 günlük döngü, gün detayı, düzenleme modu (alanlar, ekle/sil/sırala).
import * as store from '../store.js';
import * as W from '../engine/workout.js';
import { EXERCISES, getExercise, TEMPO_MODIFIERS, TEMPO_MAP } from '../data/exercises.js';
import { buildDefaultProgram } from '../data/program.js';
import { $, $$, esc, sheet, confirmSheet, toast } from './common.js';
import { openExerciseDetail } from './library.js';
import { navigate } from '../app.js';
import { typeLabel } from './today.js';

export function renderProgram(root, params, state) {
  const [sub, id] = params;
  if (sub === 'day' && state.program.templates[id]) return renderDay(root, id, false);
  if (sub === 'edit' && state.program.templates[id]) return renderDay(root, id, true);
  const list = W.templateList(state);
  root.innerHTML = `
    <div class="row between"><div><div class="eyebrow">Program</div><h1 class="title">7 Günlük Döngü</h1></div><button class="btn xs ghost" data-lib>KÜTÜPHANE</button></div>
    <div class="sub mt-s">Sıralı döngü. Sıradaki: <b style="color:var(--text)">${esc(W.nextTemplate(state)?.name || '—')}</b></div>
    <div class="card mt-l"><div class="list">${list.map((t, i) => `
      <button data-day="${t.id}" style="width:100%;text-align:left">
        <span class="n">${i + 1}</span>
        <div class="grow"><div class="name">${esc(t.name)}</div><div class="meta">${esc(t.muscles)}${t.type !== 'rest' ? ` · ${t.exercises.length} egzersiz` : ''}${W.isPaused(state, t) ? ' · <span style="color:var(--warn)">duraklatıldı</span>' : ''}</div></div>
        <span class="tag ${t.type}">${typeLabel(t.type)}</span><span class="chev">›</span>
      </button>`).join('')}</div></div>
    <button class="btn ghost mt-l" data-reset>PROGRAMI VARSAYILANA DÖNDÜR</button>`;
  root.onclick = async e => {
    const d = e.target.closest('[data-day]'); if (d) { navigate('program/day/' + d.dataset.day); return; }
    if (e.target.closest('[data-lib]')) { navigate('library'); return; }
    if (e.target.closest('[data-reset]')) {
      if (await confirmSheet('Program sıfırlansın mı?', 'Tüm program düzenlemeleri varsayılan programla değiştirilir. Geçmiş korunur.', { okLabel: 'SIFIRLA', danger: true })) { store.update(s => { s.program = buildDefaultProgram(); }); toast('Program sıfırlandı'); renderProgram(root, params, store.get()); }
    }
  };
}

function renderDay(root, id, edit) {
  const state = store.get();
  const t = state.program.templates[id];
  const paused = W.isPaused(state, t);
  root.innerHTML = `
    <div class="row between">
      <button class="btn xs ghost" data-back>‹ PROGRAM</button>
      ${t.type !== 'rest' ? `<button class="btn xs ${edit ? '' : 'ghost'}" data-toggle-edit>${edit ? 'BİTTİ' : 'DÜZENLE'}</button>` : ''}
    </div>
    <span class="tag ${t.type} mt">${typeLabel(t.type)}</span>
    <h1 class="title sm mt-s">${esc(t.name)}</h1>
    <div class="sub">${esc(t.muscles)}</div>
    ${paused ? `<div class="card mt"><div class="label">ANTRENMAN KISITLAMASIYLA DURAKLATILDI</div></div>` : ''}
    ${t.type === 'rest' ? `<div class="card mt-l center"><div class="title sm">DİNLENME GÜNÜ</div><div class="sub mt-s">Direnç antrenmanı yok. İstersen Bugün ekranından herhangi bir antrenmanı başlatabilirsin.</div></div>` : `
    <div class="card mt-l"><div class="list" id="exlist">${t.exercises.map((en, i) => row(state, en, i, edit, t.exercises.length)).join('')}</div></div>
    ${t.finishers?.length ? `<div class="sub mt-s" style="font-size:12px">Bu antrenmanın sonunda opsiyonel finisher: ${t.finishers.map(f => getExercise(f)?.name).join(' / ')}</div>` : ''}
    ${edit ? `<button class="btn mt" data-add>+ EGZERSİZ EKLE</button>` : `<button class="btn primary mt-l" data-start ${state.activeSession ? 'disabled' : ''}>BU ANTRENMANI BAŞLAT</button>`}`}`;

  root.onclick = async e => {
    const b = sel => e.target.closest(sel);
    if (b('[data-back]')) { navigate('program'); return; }
    if (b('[data-toggle-edit]')) { navigate(edit ? 'program/day/' + id : 'program/edit/' + id); return; }
    if (b('[data-start]')) { if (paused && !(await confirmSheet('Kısıtlamayla duraklatıldı', 'Yine de başlansın mı?', { okLabel: 'YİNE DE BAŞLA' }))) return; W.startSession(store.get(), t); navigate('workout'); return; }
    if (b('[data-detail]')) { openExerciseDetail(b('[data-detail]').dataset.detail); return; }
    if (b('[data-edit]')) { editEntry(root, id, b('[data-edit]').dataset.edit); return; }
    if (b('[data-move]')) { const [i, dir] = b('[data-move]').dataset.move.split(':').map(Number); store.update(s => { const arr = s.program.templates[id].exercises; const j = i + dir; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }); renderDay(root, id, true); return; }
    if (b('[data-del]')) { const eid = b('[data-del]').dataset.del; if (await confirmSheet('Egzersiz kaldırılsın mı?', 'Bu egzersizin geçmişi korunur.', { okLabel: 'KALDIR', danger: true })) { store.update(s => { const tt = s.program.templates[id]; tt.exercises = tt.exercises.filter(x => x.id !== eid); }); renderDay(root, id, true); } return; }
    if (b('[data-add]')) { addExercise(root, id); return; }
  };
}

function row(state, en, i, edit, len) {
  const ex = getExercise(en.exerciseId);
  const resolved = W.resolveExerciseId(state, en.exerciseId);
  const sub = resolved !== en.exerciseId ? ` · <span style="color:var(--warn)">→ ${esc(getExercise(resolved)?.name)} (anchor yok)</span>` : '';
  const rir = en.rirMin === en.rirMax ? en.rirMin : `${en.rirMin}-${en.rirMax}`;
  const tempo = en.tempo && en.tempo !== 'normal' ? ` · ${TEMPO_MAP[en.tempo]?.short}` : '';
  if (edit) return `<div>
      <span class="n">${i + 1}</span>
      <div class="grow"><div class="name">${esc(ex?.name || en.exerciseId)}</div><div class="meta num">${en.sets} × ${en.minReps}-${en.maxReps} · RIR ${rir}${tempo}${en.rest ? ` · ${en.rest} sn` : ''}</div></div>
      <button class="btn xs ghost" data-move="${i}:-1" ${i === 0 ? 'disabled' : ''}>↑</button>
      <button class="btn xs ghost" data-move="${i}:1" ${i === len - 1 ? 'disabled' : ''}>↓</button>
      <button class="btn xs" data-edit="${en.id}">DÜZENLE</button>
      <button class="btn xs danger" data-del="${en.id}">✕</button>
    </div>`;
  return `<button data-detail="${en.exerciseId}" style="width:100%;text-align:left">
      <span class="n">${i + 1}</span>
      <div class="grow"><div class="name">${esc(ex?.name || en.exerciseId)}</div><div class="meta num">${en.sets} × ${en.minReps}-${en.maxReps}${ex?.unilateral ? ' / taraf' : ''} · RIR ${rir}${tempo}${sub}</div>${en.notes ? `<div class="meta" style="font-size:12px;color:var(--text-3)">${esc(en.notes)}</div>` : ''}</div>
      <span class="chev">›</span>
    </button>`;
}

function editEntry(root, templateId, entryId) {
  const state = store.get();
  const en = state.program.templates[templateId].exercises.find(x => x.id === entryId);
  const s = sheet(`
    <div class="title sm">Düzenle</div>
    <div class="field"><label>EGZERSİZ</label><select data-f="exerciseId">${EXERCISES.map(x => `<option value="${x.id}" ${x.id === en.exerciseId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
    <div class="grid3">
      <div class="field"><label>SET</label><input type="number" data-f="sets" value="${en.sets}" min="1" max="10"></div>
      <div class="field"><label>MİN TEKRAR</label><input type="number" data-f="minReps" value="${en.minReps}" min="1"></div>
      <div class="field"><label>MAKS TEKRAR</label><input type="number" data-f="maxReps" value="${en.maxReps}" min="1"></div>
    </div>
    <div class="grid3">
      <div class="field"><label>RIR MİN</label><input type="number" data-f="rirMin" value="${en.rirMin}" min="0" max="4"></div>
      <div class="field"><label>RIR MAKS</label><input type="number" data-f="rirMax" value="${en.rirMax}" min="0" max="4"></div>
      <div class="field"><label>DİNLENME (SN)</label><input type="number" data-f="rest" value="${en.rest ?? ''}" placeholder="otomatik" min="0"></div>
    </div>
    <div class="field"><label>TEMPO</label><select data-f="tempo">${TEMPO_MODIFIERS.map(t => `<option value="${t.id}" ${t.id === (en.tempo || 'normal') ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select></div>
    <div class="field"><label>NOTLAR</label><textarea data-f="notes">${esc(en.notes || '')}</textarea></div>
    <div class="row mt"><button class="toggle ${en.lastSetToFailure ? 'on' : ''}" data-f="lastSetToFailure"></button><span class="sub">Son set 0–1 RIR'a gidebilir</span></div>
    <div class="btn-row mt-l"><button class="btn ghost" data-cancel>VAZGEÇ</button><button class="btn primary" data-save>KAYDET</button></div>`);
  let lsf = !!en.lastSetToFailure;
  $('[data-f=lastSetToFailure]', s.panel).onclick = ev => { lsf = !lsf; ev.currentTarget.classList.toggle('on', lsf); };
  $('[data-cancel]', s.panel).onclick = () => s.close();
  $('[data-save]', s.panel).onclick = () => {
    const v = f => $(`[data-f=${f}]`, s.panel).value;
    const num = (f, d) => { const n = parseInt(v(f), 10); return isNaN(n) ? d : n; };
    store.update(st => {
      const e2 = st.program.templates[templateId].exercises.find(x => x.id === entryId);
      e2.exerciseId = v('exerciseId'); e2.sets = Math.max(1, num('sets', 3));
      e2.minReps = Math.max(1, num('minReps', 10)); e2.maxReps = Math.max(e2.minReps, num('maxReps', 20));
      e2.rirMin = Math.min(4, Math.max(0, num('rirMin', 1))); e2.rirMax = Math.min(4, Math.max(e2.rirMin, num('rirMax', 2)));
      const r = parseInt(v('rest'), 10); e2.rest = isNaN(r) || r <= 0 ? null : r;
      e2.tempo = v('tempo'); e2.notes = v('notes').trim(); e2.lastSetToFailure = lsf;
    });
    s.close(); renderDay(root, templateId, true);
  };
}

function addExercise(root, templateId) {
  const s = sheet(`<div class="title sm">Egzersiz ekle</div><div class="list mt">${EXERCISES.map(x => `<button data-x="${x.id}" style="width:100%;text-align:left"><div class="grow"><div class="name">${esc(x.name)}</div><div class="meta">${esc(x.muscles)}</div></div><span class="chev">+</span></button>`).join('')}</div>`);
  $$('[data-x]', s.panel).forEach(b => b.onclick = () => {
    store.update(st => { st.program.templates[templateId].exercises.push({ id: 'u_' + store.uid(), exerciseId: b.dataset.x, sets: 3, minReps: 15, maxReps: 25, rirMin: 1, rirMax: 2, rest: null, tempo: 'normal', notes: '', lastSetToFailure: false }); });
    s.close(); renderDay(root, templateId, true);
  });
}
