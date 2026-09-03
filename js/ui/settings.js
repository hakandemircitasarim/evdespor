import * as store from '../store.js';
import * as W from '../engine/workout.js';
import { BAND_LEVELS, bandLevelLabel } from '../data/exercises.js';
import { exportJSON, exportCSV, importJSON } from '../backup.js';
import { $, $$, esc, sheet, confirmSheet, promptNumber, toast } from './common.js';
import { navigate } from '../app.js';

export function renderSettings(root, params, state) {
  const st = state.settings;
  const r = st.restriction;
  const templates = W.templateList(state).filter(t => t.type !== 'rest');
  root.innerHTML = `
    <div class="eyebrow">Ayarlar</div>
    <h1 class="title">Ayarlar</h1>

    <div class="card mt-l"><div class="label">MEVCUT DUMBBELL AĞIRLIKLARI (KG)</div><div id="weights"></div></div>

    <div class="card">
      <div class="setting"><div><div class="t">Güvenli yüksek anchor var</div><div class="d">KAPALI ise band pulldown / face pull anchor gerektirmeyen alternatiflerle değiştirilir.</div></div><button class="toggle ${st.safeAnchor ? 'on' : ''}" data-tg="safeAnchor"></button></div>
      <div class="setting"><div><div class="t">Dinlenme sayacı titreşimi</div></div><button class="toggle ${st.vibration ? 'on' : ''}" data-tg="vibration"></button></div>
      <div class="setting"><div><div class="t">Dinlenme sayacı sesi</div></div><button class="toggle ${st.sound ? 'on' : ''}" data-tg="sound"></button></div>
    </div>

    <div class="card"><div class="label">VARSAYILAN DİNLENME (SANİYE)</div>
      <div class="grid2">
        ${[['hardCompound', 'AĞIR COMPOUND'], ['hardIsolation', 'AĞIR İZOLASYON'], ['lightCompound', 'HAFİF COMPOUND'], ['lightIsolation', 'HAFİF İZOLASYON']].map(([k, l]) => `<button class="btn" data-rest="${k}" style="flex-direction:column;gap:2px;min-height:64px"><span class="sub" style="font-size:10px;letter-spacing:.14em">${l}</span><span class="num" style="font-size:22px">${st.restDefaults[k]}</span></button>`).join('')}
      </div></div>

    <div class="card"><div class="label">BANDLAR</div>
      <div class="list" id="bands">${st.bands.map(b => `<div><div class="grow"><div class="name">${esc(b.name)}</div><div class="meta">${esc(bandLevelLabel(b.level))}</div></div><button class="btn xs ghost" data-band-edit="${b.id}">DÜZENLE</button><button class="btn xs danger" data-band-del="${b.id}">✕</button></div>`).join('')}</div>
      <button class="btn sm mt" data-band-add>+ BAND EKLE</button></div>

    <div class="card">
      <div class="setting"><div><div class="t">Antrenman kısıtlama modu</div><div class="d">Yalnızca senin koyduğun kısıtlamayı uygular. Karar verdiğinde kendin kaldır.</div></div><button class="toggle ${r.enabled ? 'on' : ''}" data-tg="restriction"></button></div>
      ${r.enabled ? `
        <div class="seg sm mt">${[['all', 'TÜM ANTRENMAN'], ['legs', 'YALNIZ BACAK'], ['custom', 'ÖZEL']].map(([k, l]) => `<button data-rtype="${k}" class="${r.type === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        ${r.type === 'custom' ? `<div class="chips mt">${templates.map(t => `<button class="chip ${r.customTemplateIds.includes(t.id) ? 'on' : ''}" data-rt="${t.id}">${esc(t.name)}</button>`).join('')}</div>` : ''}` : ''}
    </div>

    <div class="card"><div class="label">YEDEKLEME</div>
      <div class="stack">
        <button class="btn" data-export>VERİYİ DIŞA AKTAR (JSON)</button>
        <button class="btn ghost" data-csv>ANTRENMAN GEÇMİŞİ (CSV)</button>
        <button class="btn ghost" data-import>VERİYİ İÇE AKTAR (JSON)</button>
        <input type="file" accept="application/json,.json" id="importFile" hidden>
      </div>
      <div class="sub mt-s" style="font-size:12px">Bu cihazda ${state.sessions.length} seans kayıtlı.${st.lastExportAt ? ` Son yedek: ${new Date(st.lastExportAt).toLocaleDateString('tr-TR')}.` : ' Henüz yedek alınmadı.'}</div>
    </div>

    <div class="card"><button class="btn danger" data-wipe>TÜM VERİYİ SİL</button></div>
    <div class="sub center mt-l" style="font-size:11px">EVDESPOR · çevrimdışı · hesap yok · veriler bu cihazda kalır<br>Demo görselleri: free-exercise-db (kamu malı)</div>`;

  renderWeightEditor($('#weights', root));

  root.onclick = async e => {
    const b = sel => e.target.closest(sel);
    const rerender = () => renderSettings(root, params, store.get());
    if (b('[data-tg]')) {
      const k = b('[data-tg]').dataset.tg;
      store.update(s => { if (k === 'restriction') s.settings.restriction.enabled = !s.settings.restriction.enabled; else s.settings[k] = !s.settings[k]; });
      rerender(); return;
    }
    if (b('[data-rtype]')) { store.update(s => { s.settings.restriction.type = b('[data-rtype]').dataset.rtype; }); rerender(); return; }
    if (b('[data-rt]')) { const id = b('[data-rt]').dataset.rt; store.update(s => { const a = s.settings.restriction.customTemplateIds; const i = a.indexOf(id); i >= 0 ? a.splice(i, 1) : a.push(id); }); rerender(); return; }
    if (b('[data-rest]')) { const k = b('[data-rest]').dataset.rest; const v = await promptNumber('Dinlenme (saniye)', st.restDefaults[k], { min: 10, max: 600 }); if (v != null) { store.update(s => { s.settings.restDefaults[k] = Math.round(v); }); rerender(); } return; }
    if (b('[data-band-add]')) { editBand(null, rerender); return; }
    if (b('[data-band-edit]')) { editBand(b('[data-band-edit]').dataset.bandEdit, rerender); return; }
    if (b('[data-band-del]')) { const id = b('[data-band-del]').dataset.bandDel; store.update(s => { s.settings.bands = s.settings.bands.filter(x => x.id !== id); }); rerender(); return; }
    if (b('[data-export]')) { exportJSON(); store.update(s => { s.settings.lastExportAt = Date.now(); }); toast('JSON dışa aktarıldı'); rerender(); return; }
    if (b('[data-csv]')) { exportCSV(); toast('CSV dışa aktarıldı'); return; }
    if (b('[data-import]')) { $('#importFile', root).click(); return; }
    if (b('[data-wipe]')) { if (await confirmSheet('TÜM veri silinsin mi?', 'Geçmiş, program düzenlemeleri ve ayarlar bu cihazdan silinir. Emin değilsen önce dışa aktar.', { okLabel: 'HEPSİNİ SİL', danger: true })) { store.resetAll(); navigate('onboarding'); } return; }
  };
  $('#importFile', root).addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    if (!(await confirmSheet('Yedek içe aktarılsın mı?', 'Bu cihazdaki mevcut veri yedekle değiştirilir.', { okLabel: 'İÇE AKTAR', danger: true }))) return;
    try { const n = await importJSON(f); toast(`İçe aktarıldı · ${n} seans`); renderSettings(root, params, store.get()); }
    catch (err) { toast('İçe aktarma başarısız: ' + err.message, 3000); }
  });
}

export function renderWeightEditor(host) {
  const draw = () => {
    const ws = [...store.get().settings.dumbbellWeights].sort((a, b) => a - b);
    host.innerHTML = `<div class="chips">${ws.map(w => `<button class="chip" data-w="${w}">${w} <span class="x">✕</span></button>`).join('')}<button class="chip" data-add>+ EKLE</button></div>
      <div class="sub mt-s" style="font-size:12px">Kaldırmak için ağırlığa dokun. Dumbbell başına ağırlık.</div>`;
  };
  draw();
  host.addEventListener('click', async e => {
    const w = e.target.closest('[data-w]');
    if (w) { store.update(s => { s.settings.dumbbellWeights = s.settings.dumbbellWeights.filter(x => x !== +w.dataset.w); }); draw(); return; }
    if (e.target.closest('[data-add]')) { const v = await promptNumber('Dumbbell ağırlığı ekle (kg)', '', { min: 0.5, max: 200, step: 0.5 }); if (v != null && v > 0) { store.update(s => { if (!s.settings.dumbbellWeights.includes(v)) s.settings.dumbbellWeights.push(v); }); draw(); } }
  });
}

function editBand(id, done) {
  const b = id ? store.get().settings.bands.find(x => x.id === id) : { id: null, name: '', level: 'Medium' };
  const s = sheet(`<div class="title sm">${id ? 'Bandı düzenle' : 'Yeni band'}</div>
    <div class="field"><label>AD</label><input type="text" data-name value="${esc(b.name)}" placeholder="Kırmızı Band"></div>
    <div class="field"><label>DİRENÇ</label><div class="seg sm wrap">${BAND_LEVELS.map(l => `<button data-l="${l}" class="${b.level === l ? 'on' : ''}">${esc(bandLevelLabel(l).toUpperCase())}</button>`).join('')}</div></div>
    <div class="btn-row mt-l"><button class="btn ghost" data-cancel>VAZGEÇ</button><button class="btn primary" data-save>KAYDET</button></div>`);
  let level = b.level;
  $$('[data-l]', s.panel).forEach(x => x.onclick = () => { level = x.dataset.l; $$('[data-l]', s.panel).forEach(y => y.classList.toggle('on', y === x)); });
  $('[data-cancel]', s.panel).onclick = () => s.close();
  $('[data-save]', s.panel).onclick = () => {
    const name = $('[data-name]', s.panel).value.trim() || `${bandLevelLabel(level)} Band`;
    store.update(st => { if (id) { const x = st.settings.bands.find(y => y.id === id); x.name = name; x.level = level; } else st.settings.bands.push({ id: 'band_' + store.uid(), name, level }); });
    s.close(); done();
  };
}
