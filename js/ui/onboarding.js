import * as store from '../store.js';
import { $, $$, toast } from './common.js';
import { navigate } from '../app.js';
import { renderWeightEditor } from './settings.js';

export function renderOnboarding(root, params, state) {
  root.innerHTML = `
    <div class="eyebrow">Kurulum</div>
    <h1 class="title">EVDESPOR</h1>
    <p class="sub">Üç ayar. Gerisi hazır.</p>
    <div class="card mt-l"><div class="label">MEVCUT DUMBBELL AĞIRLIKLARI (KG)</div><div id="weights"></div></div>
    <div class="card"><div class="label">GÜVENLİ YÜKSEK BAND ANCHOR VAR MI?</div>
      <div class="seg sm"><button data-anchor="1" class="${state.settings.safeAnchor ? 'on' : ''}">EVET</button><button data-anchor="0" class="${state.settings.safeAnchor ? '' : 'on'}">HAYIR</button></div>
      <div class="sub mt-s">HAYIR ise band pulldown / face pull anchor gerektirmeyen alternatiflerle değiştirilir. Bandı kapı koluna veya kırılabilecek mobilyaya asla bağlama.</div></div>
    <div class="card"><div class="label">DİNLENME SAYACI TİTREŞİMİ</div>
      <div class="seg sm"><button data-vib="1" class="${state.settings.vibration ? 'on' : ''}">AÇIK</button><button data-vib="0" class="${state.settings.vibration ? '' : 'on'}">KAPALI</button></div></div>
    <button class="btn primary mt-l" data-done>TAMAM</button>`;
  renderWeightEditor($('#weights', root));
  root.onclick = e => {
    const a = e.target.closest('[data-anchor]'), v = e.target.closest('[data-vib]');
    if (a) { store.update(s => { s.settings.safeAnchor = a.dataset.anchor === '1'; }); $$('[data-anchor]', root).forEach(b => b.classList.toggle('on', b === a)); }
    if (v) { store.update(s => { s.settings.vibration = v.dataset.vib === '1'; }); $$('[data-vib]', root).forEach(b => b.classList.toggle('on', b === v)); }
    if (e.target.closest('[data-done]')) {
      if (!store.get().settings.dumbbellWeights.length) { toast('En az bir dumbbell ağırlığı ekle'); return; }
      store.update(s => { s.settings.onboarded = true; });
      navigate('today');
    }
  };
}
