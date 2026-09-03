import * as store from '../store.js';
import * as W from '../engine/workout.js';
import { compareSessions, totalSets, totalReps } from '../engine/progress.js';
import { $, $$, esc, fmtDuration } from './common.js';
import { navigate } from '../app.js';

export const RATINGS = [['very_bad', 'ÇOK KÖTÜ'], ['bad', 'KÖTÜ'], ['normal', 'NORMAL'], ['good', 'İYİ'], ['very_good', 'ÇOK İYİ']];
export const ratingLabel = id => (RATINGS.find(r => r[0] === id) || [])[1] || '';

export function renderSummary(root, params, state) {
  const id = params[0];
  const session = state.sessions.find(s => s.id === id) || state.sessions[state.sessions.length - 1];
  if (!session) { navigate('today'); return; }
  const prev = W.previousSessionOfTemplate(state, session.templateId, session.id);
  const cmp = compareSessions(session, prev);
  root.innerHTML = `
    <div class="eyebrow">Özet</div>
    <h1 class="title mt-s">${esc(session.templateName)} TAMAM</h1>
    <div class="card mt-l">
      <div class="row between"><span class="label" style="margin:0">SÜRE</span><span class="num" style="font-size:22px;font-weight:700">${fmtDuration(session.durationSec || 0)}</span></div>
      <div class="row between mt-s"><span class="label" style="margin:0">SET</span><span class="num" style="font-size:22px;font-weight:700">${totalSets(session)}</span></div>
      <div class="row between mt-s"><span class="label" style="margin:0">TOPLAM TEKRAR</span><span class="num" style="font-size:22px;font-weight:700">${totalReps(session)}</span></div>
    </div>
    <div class="card">
      <div class="label">ÖNCEKİ ${esc(session.templateName)} İLE</div>
      ${cmp.hasPrevious ? `<div class="num" style="font-size:22px;font-weight:700">${cmp.totalDelta > 0 ? '+' : ''}${cmp.totalDelta} toplam tekrar <span class="sub" style="font-size:13px;font-weight:400">(yalnız aynı yük ve tempo)</span></div>` : '<div class="sub">İlk kez. Henüz karşılaştırılacak veri yok.</div>'}
      <div class="mt-s">${cmp.rows.map(r => `<div class="row between" style="padding:6px 0;border-top:1px solid var(--line)"><span>${esc(r.name)}</span><span class="num" style="${r.delta > 0 ? 'color:var(--ok)' : r.delta < 0 ? 'color:var(--warn)' : 'color:var(--text-2)'}">${esc(r.label)}</span></div>`).join('')}</div>
    </div>
    <div class="card">
      <div class="label">BUGÜN NASILDI?</div>
      <div class="seg sm wrap">${RATINGS.map(([id, l]) => `<button data-r="${id}" class="${session.rating === id ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="field"><label>NOT (İSTEĞE BAĞLI)</label><textarea data-note placeholder="Uyku, açık, yorgunluk…">${esc(session.note || '')}</textarea></div>
    </div>
    <button class="btn primary mt-l" data-done>TAMAM</button>`;
  root.onclick = e => {
    const r = e.target.closest('[data-r]');
    if (r) { store.update(s => { const ss = s.sessions.find(x => x.id === session.id); if (ss) ss.rating = r.dataset.r; }); $$('[data-r]', root).forEach(b => b.classList.toggle('on', b === r)); }
    if (e.target.closest('[data-done]')) { const note = $('[data-note]', root).value.trim(); store.update(s => { const ss = s.sessions.find(x => x.id === session.id); if (ss) ss.note = note; }); navigate('today'); }
  };
}
