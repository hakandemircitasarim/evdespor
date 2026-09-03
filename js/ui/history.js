// Antrenman geçmişi: seans listesi ve seans detayı (not/derece düzenlenebilir, seans silinebilir).
import * as store from '../store.js';
import { getExercise, TEMPO_MAP } from '../data/exercises.js';
import { totalSets, totalReps, loadLabel } from '../engine/progress.js';
import { $, $$, esc, fmtDuration, fmtDate, daysAgo, confirmSheet, toast } from './common.js';
import { navigate } from '../app.js';
import { RATINGS, ratingLabel } from './summary.js';
import { typeLabel } from './today.js';

const REC = { ready: 'Hazır', tired: 'Biraz yorgun', not_recovered: 'Toparlanmamış' };
const SIDE = { L: 'Sol', R: 'Sağ' };

export function renderHistory(root, params, state) {
  const id = params[0];
  if (id) { const s = state.sessions.find(x => x.id === id); if (s) return renderSession(root, s); }
  const list = state.sessions.slice().reverse();
  root.innerHTML = `
    <div class="row between"><div><div class="eyebrow">Gelişim</div><h1 class="title">Antrenman Geçmişi</h1></div><button class="btn xs ghost" data-back>GERİ</button></div>
    ${list.length ? `<div class="card mt-l"><div class="list">${list.map(s => `
      <button data-s="${s.id}" style="width:100%;text-align:left">
        <span class="tag ${s.templateType || ''}">${typeLabel(s.templateType || '')}</span>
        <div class="grow"><div class="name">${esc(s.templateName)}</div><div class="meta num">${fmtDate(s.startedAt)} · ${totalSets(s)} set · ${totalReps(s)} tekrar · ${fmtDuration(s.durationSec || 0)}${s.rating ? ' · ' + ratingLabel(s.rating) : ''}</div></div>
        <span class="chev">›</span>
      </button>`).join('')}</div></div>` : '<div class="card mt-l sub">Henüz seans yok.</div>'}`;
  root.onclick = e => {
    if (e.target.closest('[data-back]')) { navigate('progress'); return; }
    const b = e.target.closest('[data-s]'); if (b) navigate('history/' + b.dataset.s);
  };
}

function renderSession(root, s) {
  const state = store.get();
  root.innerHTML = `
    <div class="row between"><button class="btn xs ghost" data-back>‹ GEÇMİŞ</button><button class="btn xs danger" data-del>SİL</button></div>
    <span class="tag ${s.templateType || ''} mt">${typeLabel(s.templateType || '')}</span>
    <h1 class="title sm mt-s">${esc(s.templateName)}</h1>
    <div class="sub num">${new Date(s.startedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} · ${daysAgo(s.startedAt)} · ${fmtDuration(s.durationSec || 0)} · ${totalSets(s)} set · ${totalReps(s)} tekrar${s.recovery ? ' · ' + REC[s.recovery] : ''}</div>
    <div class="stack mt-l">
      ${s.exercises.map(es => { const ex = getExercise(es.exerciseId); return `<button class="card" data-ex="${es.exerciseId}" style="width:100%;text-align:left;display:block">
        <div class="row between"><span style="font-weight:600">${esc(ex?.name || es.exerciseId)}${es.optional ? ' <span class="sub">(opsiyonel)</span>' : ''}</span><span class="chev">›</span></div>
        ${es.sets.map(x => `<div class="row between num sub" style="padding:3px 0"><span>Set ${x.setNumber}${x.side ? ' ' + SIDE[x.side] : ''}</span><span style="color:var(--text)">${esc(loadLabel(x, state))} · ${x.reps}${x.unit === 'sec' ? ' sn' : ''} @ RIR ${x.rir === 4 ? '4+' : x.rir}${x.tempoModifier && x.tempoModifier !== 'normal' ? ' · ' + (TEMPO_MAP[x.tempoModifier]?.short || '') : ''}</span></div>`).join('')}
      </button>`; }).join('')}
      <div class="card">
        <div class="label">BUGÜN NASILDI?</div>
        <div class="seg sm wrap">${RATINGS.map(([id, l]) => `<button data-r="${id}" class="${s.rating === id ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="field"><label>NOT</label><textarea data-note>${esc(s.note || '')}</textarea></div>
        <button class="btn sm mt" data-save-note>NOTU KAYDET</button>
      </div>
    </div>`;
  root.onclick = async e => {
    const b = sel => e.target.closest(sel);
    if (b('[data-back]')) { navigate('history'); return; }
    if (b('[data-ex]')) { navigate('progress/' + b('[data-ex]').dataset.ex); return; }
    if (b('[data-r]')) { const r = b('[data-r]').dataset.r; store.update(st => { const x = st.sessions.find(y => y.id === s.id); if (x) x.rating = r; }); $$('[data-r]', root).forEach(x => x.classList.toggle('on', x.dataset.r === r)); return; }
    if (b('[data-save-note]')) { const note = $('[data-note]', root).value.trim(); store.update(st => { const x = st.sessions.find(y => y.id === s.id); if (x) x.note = note; }); toast('Kaydedildi'); return; }
    if (b('[data-del]')) {
      if (await confirmSheet('Seans silinsin mi?', `${s.templateName} · ${fmtDate(s.startedAt)} geçmişten kalıcı olarak silinir.`, { okLabel: 'SİL', danger: true })) {
        store.update(st => {
          st.sessions = st.sessions.filter(y => y.id !== s.id);
          const lastDone = st.sessions[st.sessions.length - 1];
          st.lastCompletedTemplateId = lastDone ? lastDone.templateId : null;
        });
        toast('Seans silindi'); navigate('history');
      }
    }
  };
}
