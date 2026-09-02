import { getExercise, TEMPO_MAP } from '../data/exercises.js';
import { exerciseHistory, summarize, trend, repPRs, loadLabel } from '../engine/progress.js';
import { $, $$, esc, fmtDate, sheet } from './common.js';

let selected = null;

export function renderProgress(root, params, state) {
  const ids = [...new Set(state.sessions.flatMap(s => s.exercises.map(e => e.exerciseId)))].filter(id => getExercise(id));
  if (!selected || !ids.includes(selected)) selected = ids[0] || null;
  if (!selected) {
    root.innerHTML = `<div class="eyebrow">Progress</div><h1 class="title">Progress</h1><div class="card mt-l sub">No workouts yet. History appears here after the first session.</div>`;
    return;
  }
  const ex = getExercise(selected);
  const hist = exerciseHistory(state, selected).slice().reverse();
  const tr = trend(state, selected);
  const prs = repPRs(state, selected);
  const trClass = tr.status === 'improving' ? 'ok' : tr.status === 'declining' ? 'warn' : '';
  root.innerHTML = `
    <div class="eyebrow">Progress</div>
    <button class="row between mt-s" data-pick style="width:100%;text-align:left"><h1 class="title sm grow">${esc(ex.name)}</h1><span class="chev">⌄</span></button>
    <div class="card mt">
      <div class="row between"><span class="label" style="margin:0">TREND</span><span class="tag ${trClass}">${esc(tr.label)}</span></div>
      <div class="sub mt-s">${esc(tr.note || 'Trend needs 3 sessions at the same load and tempo.')}</div>
      ${tr.status === 'declining' && tr.consecutiveDown >= 3 ? `<div class="mt-s" style="color:var(--warn)">Performance has declined across the last ${tr.consecutiveDown + 1} comparable sessions.</div><div class="sub">Possible reasons: recovery · calorie deficit · sleep · fatigue. Your decision.</div>` : ''}
      <div class="mt">${chart(hist.slice().reverse(), tr)}</div>
      <div class="sub" style="font-size:11px">Effective reps per set (reps + RIR). Dim points = different load/tempo.</div>
    </div>
    ${Object.keys(prs).length ? `<div class="card"><div class="label">REP PR</div>${Object.values(prs).sort((a, b) => (b.weight || 0) - (a.weight || 0)).map(p => `<div class="row between num" style="padding:3px 0"><span>${esc(loadLabel(p, state))}</span><span>× ${p.reps} <span class="sub">${fmtDate(p.date)}</span></span></div>`).join('')}</div>` : ''}
    <div class="eyebrow mt-l">Timeline</div>
    ${hist.map(h => { const s = summarize(h.sets); return `<div class="card mt-s">
      <div class="row between"><span style="font-weight:600">${fmtDate(h.date)}</span><span class="sub">${esc(h.session.templateName)}</span></div>
      <div class="num mt-s"><span class="sub">${esc(loadLabel(h.sets[0], state))}${s.tempo !== 'normal' ? ' · ' + TEMPO_MAP[s.tempo]?.short : ''}</span></div>
      <div class="num" style="font-size:20px;font-weight:700">${h.sets.map(x => x.reps).join(' / ')}</div>
      <div class="sub num">Avg RIR ${s.avgRir.toFixed(1)} · ${s.total} total</div>
    </div>`; }).join('')}`;
  $('[data-pick]', root).onclick = () => {
    const sh = sheet(`<div class="title sm">Exercise</div><div class="list mt">${ids.map(id => `<button data-id="${id}" style="width:100%;text-align:left"><div class="grow name">${esc(getExercise(id).name)}</div>${id === selected ? '<span class="tag">CURRENT</span>' : ''}</button>`).join('')}</div>`);
    $$('[data-id]', sh.panel).forEach(b => b.onclick = () => { selected = b.dataset.id; sh.close(); renderProgress(root, params, state); });
  };
}

function chart(hist, tr) {
  const pts = hist.slice(-12).map(h => ({ ...summarize(h.sets), date: h.date }));
  if (pts.length < 2) return '<div class="sub">Chart appears after 2 sessions.</div>';
  const W = 320, H = 150, px = 28, py = 14;
  const vals = pts.map(p => p.effAvg);
  const min = Math.floor(Math.min(...vals) - 2), max = Math.ceil(Math.max(...vals) + 2);
  const x = i => px + i * (W - px - 8) / (pts.length - 1);
  const y = v => py + (H - py - 18) * (1 - (v - min) / (max - min || 1));
  const latest = pts[pts.length - 1];
  const comparable = p => p.loadKey === latest.loadKey && p.tempo === latest.tempo;
  const compPts = pts.map((p, i) => ({ p, i })).filter(({ p }) => comparable(p));
  const line = compPts.map(({ p, i }, k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.effAvg).toFixed(1)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    ${[min, Math.round((min + max) / 2), max].map(v => `<line class="grid" x1="${px}" x2="${W - 8}" y1="${y(v)}" y2="${y(v)}"/><text x="0" y="${y(v) + 3}">${v}</text>`).join('')}
    <path class="line" d="${line}"/>
    ${pts.map((p, i) => `<circle class="dot ${comparable(p) ? '' : 'other'}" cx="${x(i)}" cy="${y(p.effAvg)}" r="3.5"/>`).join('')}
    ${pts.map((p, i) => i % Math.ceil(pts.length / 6) === 0 || i === pts.length - 1 ? `<text x="${x(i) - 10}" y="${H - 4}">${fmtDate(p.date)}</text>` : '').join('')}
  </svg>`;
}
