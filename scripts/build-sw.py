#!/usr/bin/env python3
"""sw.js'yi yeniden üretir: precache listesi + içerik hash'inden türeyen sürüm.
Her kod değişikliğinden sonra çalıştır; sürüm değişince telefondaki PWA yeni dosyaları alır."""
import glob, hashlib, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

files = ['./index.html', './manifest.webmanifest', './css/app.css']
files += sorted('./' + p for p in glob.glob('js/**/*.js', recursive=True))
files += sorted('./' + p for p in glob.glob('assets/**/*.*', recursive=True))

h = hashlib.sha1()
for f in files:
    with open(f, 'rb') as fh:
        h.update(f.encode()); h.update(fh.read())
version = 'evdespor-' + h.hexdigest()[:10]

sw = f"""// Service worker: uygulama kabuğu + demo medyası önbelleğe alınır, antrenman ağ gerektirmez.
// Bu dosya scripts/build-sw.py tarafından üretilir. Elle düzenleme.
const VERSION = '{version}';
const PRECACHE = {json.dumps(files, indent=2)};

self.addEventListener('install', e => {{
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
}});
self.addEventListener('activate', e => {{
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
}});
self.addEventListener('fetch', e => {{
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // Navigasyon ve sw.js: önce ağ (güncellemeleri hızlı al), düşerse önbellek.
  if (e.request.mode === 'navigate' || url.pathname.endsWith('/sw.js')) {{
    e.respondWith(fetch(e.request).then(res => {{
      const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return res;
    }}).catch(() => caches.match(e.request, {{ ignoreSearch: true }}).then(hit => hit || caches.match('./index.html'))));
    return;
  }}
  // Diğer her şey: önce önbellek.
  e.respondWith(
    caches.match(e.request, {{ ignoreSearch: true }}).then(hit => hit || fetch(e.request).then(res => {{
      if (res.ok) {{ const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }}
      return res;
    }}))
  );
}});
"""
with open('sw.js', 'w') as fh:
    fh.write(sw)
print(version, len(files), 'files')
