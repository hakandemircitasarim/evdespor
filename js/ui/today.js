import * as store from '../store.js';
import * as W from '../engine/workout.js';
import { getExercise } from '../data/exercises.js';
import { $, $$, esc, daysAgo, fmtDuration, sheet, confirmSheet } from './common.js';
import { navigate } from '../app.js';
import { totalSets, totalReps } from '../engine/progress.js';

const RECOVERY = [['ready', 'HAZIRIM'], ['tired', 'BİRAZ YORGUN'], ['not_recovered', 'TOPARLANMADIM']];
const TYPE_LABEL = { hard: 'AĞIR', light: 'HAFİF', rest: 'DİNLENME' };
export const typeLabel = t => TYPE_LABEL[t] || t;

export function renderToday(root, params, state) {
  const active = state.activeSession;
  const t = W.nextTemplate(state);
  const next = t ? W.templateAfter(state, t.id) : null;
  const prevOfT = t ? W.previousSessionOfTemplate(state, t.id) : null;
  const last = state.sessions[state.sessions.length - 1];
  const rec = state.recovery.date === W.today() ? state.recovery.state : null;
  const paused = t && W.isPaused(state, t);
  const restr = state.settings.restriction;
  const restrLabel = restr.type === 'all' ? 'Tüm antrenman' : restr.type === 'legs' ? 'Yalnız bacak' : 'Özel';
  const weekAgo = Date.now() - 7 * 86400000;
  const week = state.sessions.filter(s => s.startedAt >= weekAgo);
  const weekCount = week.length, weekSets = week.reduce((a, s) => a + totalSets(s), 0);
  const lastExport = state.settings.lastExportAt || 0;
  const backupDue = state.sessions.length >= 3 && Date.now() - lastExport > 14 * 86400000;

  root.innerHTML = `
    <div class="eyebrow">Bugün</div>
    ${backupDue ? `<button class="sub mt-s" data-backup style="text-align:left;font-size:12px;color:var(--warn)">Yedek ${lastExport ? Math.floor((Date.now() - lastExport) / 86400000) + ' gün önce' : 'hiç'} alınmadı · Ayarlar → Dışa aktar ›</button>` : ''}
    ${active ? `
      <div class="card mt" style="border-color:rgba(201,168,106,.5)">
        <div class="label">${esc(active.templateName)} DEVAM ETSİN Mİ?</div>
        <div class="sub">Egzersiz: <b style="color:var(--text)">${esc(getExercise(active.exercises[active.exIndex]?.exerciseId)?.name || '')}</b><br>Set: ${(active.exercises[active.exIndex]?.sets.length || 0) + 1} / ${active.exercises[active.exIndex]?.planned.length || 0} · başlangıç ${daysAgo(active.startedAt).toLowerCase()}</div>
        <div class="btn-row mt"><button class="btn danger" data-discard>SİL</button><button class="btn primary" data-resume>DEVAM ET</button></div>
      </div>` : ''}
    ${t ? `
    <div class="mt-l">
      <span class="tag ${t.type}">${typeLabel(t.type)}</span>
      <h1 class="title mt-s">${esc(t.name)}</h1>
      <div class="sub mt-s">${esc(t.muscles)}</div>
    </div>
    ${t.type === 'rest' ? `<div class="card mt-l center"><div class="title sm">DİNLENME GÜNÜ</div><div class="sub mt-s">Planlı direnç antrenmanı yok.</div></div>` : ''}
    ${paused ? `<div class="card mt"><div class="label">ANTRENMAN KISITLAMASIYLA DURAKLATILDI</div><div class="sub">${restrLabel} kısıtlaması aktif. Karar verdiğinde Ayarlar'dan kaldır.</div></div>` : ''}
    ${restr.enabled && !paused ? `<div class="sub mt" style="font-size:12px">Antrenman kısıtlaması aktif (${restrLabel.toLowerCase()}). Bu antrenman etkilenmiyor.</div>` : ''}
    <div class="card mt-l">
      <div class="row between"><span class="label" style="margin:0">SON ${esc(t.name)}</span><span class="num">${prevOfT ? `${daysAgo(prevOfT.startedAt)} · ${totalReps(prevOfT)} tekrar` : 'Hiç yapılmadı'}</span></div>
      <div class="hr"></div>
      <div class="label">TOPARLANMA</div>
      <div class="seg sm">${RECOVERY.map(([id, l]) => `<button data-rec="${id}" class="${rec === id ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${rec === 'not_recovered' ? `<div class="sub mt-s">Toparlanma düşük görünüyor. Bugün performansı zorlamadan değerlendir. Karar senin.</div>` : ''}
      ${rec === 'tired' ? `<div class="sub mt-s">Biraz yorgun. Bugün RIR'ı dürüst tut.</div>` : ''}
    </div>
    ${t.type !== 'rest' && !paused && !active ? `<button class="btn primary mt-l" data-start="${t.id}">ANTRENMANA BAŞLA</button>` : ''}
    <button class="btn ghost mt" data-choose>${t.type === 'rest' || paused ? 'ANTRENMAN SEÇ' : 'BAŞKA BİR GÜN SEÇ'}</button>
    ` : `<div class="card mt-l">Programda antrenman yok.</div>`}
    <div class="mt-l">
      <div class="row between"><span class="eyebrow">Son 7 gün</span><span class="sub num">${weekCount} antrenman · ${weekSets} set</span></div>
      ${next ? `<div class="row between mt-s"><span class="eyebrow">Sıradaki</span><span class="sub">${esc(next.name)}</span></div>` : ''}
      ${last ? `<button class="row between mt-s" data-last style="width:100%;text-align:left"><span class="eyebrow">Son antrenman</span><span class="sub">${esc(last.templateName)} · ${daysAgo(last.startedAt)} · ${totalSets(last)} set · ${totalReps(last)} tekrar · ${fmtDuration(last.durationSec || 0)} ›</span></button>` : ''}
    </div>`;

  root.onclick = async e => {
    const r = e.target.closest('[data-rec]');
    if (r) { store.update(s => { s.recovery = { date: W.today(), state: r.dataset.rec }; }); renderToday(root, params, store.get()); return; }
    const st = e.target.closest('[data-start]');
    if (st) { startWorkout(st.dataset.start); return; }
    if (e.target.closest('[data-resume]')) { navigate('workout'); return; }
    if (e.target.closest('[data-last]')) { navigate('history/' + last.id); return; }
    if (e.target.closest('[data-backup]')) { navigate('settings'); return; }
    if (e.target.closest('[data-discard]')) {
      if (await confirmSheet('Aktif antrenman silinsin mi?', 'Bu seansta girilen setler kaybolur.', { okLabel: 'SİL', danger: true })) { W.discardSession(); renderToday(root, params, store.get()); }
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
  const s = sheet(`<div class="title sm">Antrenman seç</div><div class="list mt">${list.map(t => `
    <button data-t="${t.id}" style="width:100%;text-align:left" ${state.activeSession ? 'disabled' : ''}>
      <span class="tag ${t.type}">${typeLabel(t.type)}</span><div class="grow"><div class="name">${esc(t.name)}</div><div class="meta">${esc(t.muscles)}${W.isPaused(state, t) ? ' · kısıtlamayla duraklatıldı' : ''}</div></div><span class="chev">›</span></button>`).join('')}</div>
    ${state.activeSession ? '<div class="sub mt">Önce aktif antrenmanı bitir veya sil.</div>' : ''}`);
  $$('[data-t]', s.panel).forEach(b => b.onclick = async () => {
    const t = state.program.templates[b.dataset.t];
    if (W.isPaused(state, t)) {
      const ok = await confirmSheet('Kısıtlamayla duraklatıldı', `${t.name} koyduğun kısıtlama nedeniyle duraklatılmış. Yine de başlansın mı?`, { okLabel: 'YİNE DE BAŞLA' });
      if (!ok) return;
    }
    s.panel.parentElement.remove();
    startWorkout(b.dataset.t);
  });
}
