// Egzersiz kütüphanesi listesi + Egzersiz Detay paneli.
import { EXERCISES, getExercise } from '../data/exercises.js';
import { $, $$, esc, sheet, demoHTML, daysAgo } from './common.js';
import * as store from '../store.js';
import { lastPerformance, summarize, loadLabel, repsLabel } from '../engine/progress.js';

const GROUPS = [
  ['chest', 'GÖĞÜS'], ['shoulders', 'OMUZ'], ['triceps', 'TRICEPS'],
  ['back', 'SIRT'], ['rear_delts', 'ARKA OMUZ'], ['biceps', 'BICEPS'],
  ['quads', 'QUADRICEPS'], ['hamstrings', 'HAMSTRING'], ['glutes', 'KALÇA'], ['calves', 'BALDIR'], ['forearms', 'ÖN KOL / KAVRAMA'],
];

export function renderLibrary(root, params, state) {
  root.innerHTML = `
    <div class="row between mb">
      <div><div class="eyebrow">Program</div><h1 class="title">Egzersiz Kütüphanesi</h1></div>
      <button class="btn xs ghost" data-back>GERİ</button>
    </div>
    ${GROUPS.map(([g, label]) => {
      const list = EXERCISES.filter(e => e.primary === g);
      if (!list.length) return '';
      return `<div class="eyebrow mt-l">${label}</div>
      <div class="card mt-s"><div class="list">${list.map(e => `
        <button data-ex="${e.id}" style="width:100%;text-align:left">
          ${demoHTML(e, true).replace('class="demo small"', 'class="demo small" style="width:56px"')}
          <div class="grow"><div class="name">${esc(e.name)}</div><div class="meta">${esc(e.muscles)}</div></div>
          <span class="chev">›</span>
        </button>`).join('')}</div></div>`;
    }).join('')}`;
  root.onclick = e => {
    if (e.target.closest('[data-back]')) { history.back(); return; }
    const b = e.target.closest('[data-ex]'); if (b) openExerciseDetail(b.dataset.ex);
  };
}

export function openExerciseDetail(exerciseId, { onClose } = {}) {
  const ex = getExercise(exerciseId);
  if (!ex) return;
  const state = store.get();
  const last = lastPerformance(state, exerciseId);
  const lastHtml = last ? (() => { const s = summarize(last.sets); return `<div class="card"><div class="label">GEÇEN SEFER · ${esc(last.session.templateName)} · ${daysAgo(last.date).toUpperCase()}</div><div class="num">${esc(loadLabel(last.sets[0], state))} · ${esc(repsLabel(last.sets))}</div><div class="sub">Ort. RIR ${s.avgRir.toFixed(1)}</div></div>`; })() : '';
  const m = ex.media;
  const html = `
    <div class="row between"><div class="eyebrow">${esc(ex.muscles)}</div><button class="btn xs ghost" data-close>KAPAT</button></div>
    <h2 class="title sm mt-s">${esc(ex.name)}</h2>
    <div class="mt">${demoHTML(ex)}</div>
    ${m?.note ? `<div class="sub mt-s" style="font-size:12px">${esc(m.note)}</div>` : ''}
    <div class="stack mt">
      ${lastHtml}
      <div class="card"><div class="label">EKİPMAN</div><div>${esc(ex.equipment.join(' · '))}</div></div>
      <div class="card"><div class="label">BAŞLANGIÇ POZİSYONU</div><div>${esc(ex.setup)}</div></div>
      <div class="card"><div class="label">UYGULAMA</div><div>${esc(ex.execution)}</div></div>
      <div class="card"><div class="label">FORM İPUÇLARI</div>${ex.cues.map(c => `<div>· ${esc(c)}</div>`).join('')}</div>
      <div class="card"><div class="label">SIK HATALAR</div>${ex.mistakes.map(c => `<div class="sub">· ${esc(c)}</div>`).join('')}</div>
      <div class="card"><div class="label">TEMPO</div><div>${esc(ex.tempo)}</div></div>
      <div class="card"><div class="label">ALTERNATİFLER</div><div class="chips">${(ex.alternatives || []).map(a => getExercise(a) ? `<button class="chip" data-alt="${a}">${esc(getExercise(a).name)}</button>` : '').join('')}</div></div>
      ${m ? `<div class="sub" style="font-size:12px"><div class="label">KAYNAK</div>Kaynak: <a href="${esc(m.source)}" target="_blank" rel="noopener">${esc(m.sourceId)}</a><br>Lisans: ${esc(m.license)}<br>Yazar/Sağlayıcı: ${esc(m.author)}</div>` : `<div class="sub" style="font-size:12px"><div class="label">KAYNAK</div>Bu hareket için lisanslı demo bulunamadı. Yalnızca yazılı ipuçları.</div>`}
    </div>`;
  const s = sheet(html, { onClose });
  $('[data-close]', s.panel).onclick = () => s.close();
  $$('[data-alt]', s.panel).forEach(b => b.onclick = () => { s.panel.parentElement.remove(); openExerciseDetail(b.dataset.alt, { onClose }); });
}
