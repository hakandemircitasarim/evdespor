import * as store from '../store.js';
import { $, $$, esc, toast } from './common.js';
import { navigate } from '../app.js';
import { renderWeightEditor } from './settings.js';

export function renderOnboarding(root, params, state) {
  root.innerHTML = `
    <div class="eyebrow">Setup</div>
    <h1 class="title">EVDESPOR</h1>
    <p class="sub">Three settings. Everything else is ready.</p>
    <div class="card mt-l"><div class="label">AVAILABLE DUMBBELL WEIGHTS (KG)</div><div id="weights"></div></div>
    <div class="card"><div class="label">SAFE HIGH BAND ANCHOR AVAILABLE?</div>
      <div class="seg sm"><button data-anchor="1" class="${state.settings.safeAnchor ? 'on' : ''}">YES</button><button data-anchor="0" class="${state.settings.safeAnchor ? '' : 'on'}">NO</button></div>
      <div class="sub mt-s">If NO, band pulldown / face pull are replaced by non-anchor alternatives. Never attach a band to a door handle or fragile furniture.</div></div>
    <div class="card"><div class="label">REST TIMER VIBRATION</div>
      <div class="seg sm"><button data-vib="1" class="${state.settings.vibration ? 'on' : ''}">ON</button><button data-vib="0" class="${state.settings.vibration ? '' : 'on'}">OFF</button></div></div>
    <button class="btn primary mt-l" data-done>DONE</button>`;
  renderWeightEditor($('#weights', root));
  root.onclick = e => {
    const a = e.target.closest('[data-anchor]'), v = e.target.closest('[data-vib]');
    if (a) { store.update(s => { s.settings.safeAnchor = a.dataset.anchor === '1'; }); $$('[data-anchor]', root).forEach(b => b.classList.toggle('on', b === a)); }
    if (v) { store.update(s => { s.settings.vibration = v.dataset.vib === '1'; }); $$('[data-vib]', root).forEach(b => b.classList.toggle('on', b === v)); }
  };
  $('[data-done]', root).onclick = () => {
    if (!store.get().settings.dumbbellWeights.length) { toast('Add at least one dumbbell weight'); return; }
    store.update(s => { s.settings.onboarded = true; });
    navigate('today');
  };
}
