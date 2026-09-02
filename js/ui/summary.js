import * as store from '../store.js';
import * as W from '../engine/workout.js';
import { compareSessions, totalSets } from '../engine/progress.js';
import { $, $$, esc, fmtDuration } from './common.js';
import { navigate } from '../app.js';

const RATINGS = [['very_bad', 'VERY BAD'], ['bad', 'BAD'], ['normal', 'NORMAL'], ['good', 'GOOD'], ['very_good', 'VERY GOOD']];

export function renderSummary(root, params, state) {
  const id = params[0];
  const session = state.sessions.find(s => s.id === id) || state.sessions[state.sessions.length - 1];
  if (!session) { navigate('today'); return; }
  const prev = W.previousSessionOfTemplate(state, session.templateId, session.id);
  const cmp = compareSessions(session, prev);
  root.innerHTML = `
    <div class="eyebrow">Summary</div>
    <h1 class="title mt-s">${esc(session.templateName)} COMPLETE</h1>
    <div class="card mt-l">
      <div class="row between"><span class="label" style="margin:0">DURATION</span><span class="num" style="font-size:22px;font-weight:700">${fmtDuration(session.durationSec || 0)}</span></div>
      <div class="row between mt-s"><span class="label" style="margin:0">SETS</span><span class="num" style="font-size:22px;font-weight:700">${totalSets(session)}</span></div>
    </div>
    <div class="card">
      <div class="label">VS PREVIOUS ${esc(session.templateName)}</div>
      ${cmp.hasPrevious ? `<div class="num" style="font-size:22px;font-weight:700">${cmp.totalDelta > 0 ? '+' : ''}${cmp.totalDelta} total reps <span class="sub" style="font-size:13px;font-weight:400">(same load & tempo only)</span></div>` : '<div class="sub">First time. Nothing to compare yet.</div>'}
      <div class="mt-s">${cmp.rows.map(r => `<div class="row between" style="padding:6px 0;border-top:1px solid var(--line)"><span>${esc(r.name)}</span><span class="num ${r.delta > 0 ? '' : r.delta < 0 ? 'muted' : 'sub'}" style="${r.delta > 0 ? 'color:var(--ok)' : r.delta < 0 ? 'color:var(--warn)' : ''}">${esc(r.label)}</span></div>`).join('')}</div>
    </div>
    <div class="card">
      <div class="label">HOW WAS TODAY?</div>
      <div class="seg sm wrap">${RATINGS.map(([id, l]) => `<button data-r="${id}" class="${session.rating === id ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="field"><label>NOTE (OPTIONAL)</label><textarea data-note placeholder="Sleep, deficit, fatigue…">${esc(session.note || '')}</textarea></div>
    </div>
    <button class="btn primary mt-l" data-done>DONE</button>`;
  root.onclick = e => {
    const r = e.target.closest('[data-r]');
    if (r) { store.update(s => { const ss = s.sessions.find(x => x.id === session.id); if (ss) ss.rating = r.dataset.r; }); $$('[data-r]', root).forEach(b => b.classList.toggle('on', b === r)); }
    if (e.target.closest('[data-done]')) { const note = $('[data-note]', root).value.trim(); store.update(s => { const ss = s.sessions.find(x => x.id === session.id); if (ss) ss.note = note; }); navigate('today'); }
  };
}
