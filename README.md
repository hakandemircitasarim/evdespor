# EVDESPOR — Cut-period resistance training console

Personal, offline-first, installable PWA for tracking home resistance training during a cut.
No backend, no account, no build step. Plain HTML/CSS/ES modules + a service worker.

## Geliştirme

Arayüz Türkçe, hareket adları İngilizce. Kod değişikliğinden sonra `python3 scripts/build-sw.py` çalıştır: precache listesi ve içerik hash'inden türeyen service worker sürümü yeniden üretilir; sürüm değişmezse telefondaki PWA eski dosyaları kullanmaya devam eder. Pages deploy'u her push'ta otomatik.

## Run

Any static file server works (a service worker needs `http://localhost` or `https://`):

```
python3 -m http.server 8080
# open http://localhost:8080/
```

## Install on Samsung Galaxy S23 Ultra

1. Live URL (GitHub Pages, deployed by `.github/workflows/pages.yml` on every push): https://hakandemircitasarim.github.io/evdespor/
2. Open the URL in Chrome → menu → **Add to Home screen** / **Install app**.
3. First launch precaches the app shell and all demo media, so workouts do not need a network after that.

## Structure

```
index.html              app shell
sw.js                   service worker (precache list, cache-first)
manifest.webmanifest    PWA manifest
css/app.css             dark, high-contrast, large-control UI
js/app.js               hash router + bottom nav (TODAY · PROGRAM · PROGRESS · SETTINGS)
js/store.js             persistent state (localStorage), migrations, export/import entry point
js/backup.js            JSON (full state) + CSV (set history) export, JSON import
js/data/exercises.js    exercise library: cues, alternatives, anchor substitutes, media metadata
js/data/program.js      default 7-day cycle as structured data
js/engine/workout.js    session building, unilateral L/R sets, rest defaults, restriction, next-workout logic
js/engine/progress.js   trend (same load + same tempo, RIR-aware), suggestions, rep PRs, session comparison
js/ui/*.js              screens: today, workout (+ rest timer, finisher), summary, program (+ edit), progress, history, settings, library/detail, onboarding
scripts/build-sw.py     regenerates sw.js (precache list + content-hash version)
assets/demos/           two-frame demo images (start/end position), shown as a slow loop
```

## Data model

`WorkoutSession { id, templateId, startedAt, endedAt, durationSec, recovery, rating, note, exercises: ExerciseSession[] }`
`ExerciseSession { exerciseId, originalExerciseId, optional, plan, planned, sets: SetRecord[] }`
`SetRecord { exerciseId, timestamp, setNumber, side, weight, reps, rir, tempoModifier, bandId, bandResistance, notes, unit }`

Everything lives in one JSON document under `localStorage["evdespor.state.v1"]`. EXPORT DATA writes that document; IMPORT DATA restores it.

## Progress logic (deliberately simple)

- Sets are comparable when load key (kg / band / bodyweight) and tempo modifier match.
- Per session: effective reps = mean(reps + RIR) across sets.
- Trend uses the last 3–5 comparable sessions; early half vs late half, ±4% threshold → IMPROVING / STABLE / DECLINING.
- Suggestions appear only when every set hits the top of the rep range within target RIR: next dumbbell → slower eccentric → eccentric + pause → 1.5 reps → harder variation. APPLY / IGNORE; the app never changes the program on its own.

## Demo media

All embedded demo images come from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Unlicense / public domain), resized to WebP.
Where the database has no exact match, the closest public-domain variation is shown with a note (e.g. cable version for band pulldown / face pull, barbell hip thrust). Gyroball and hand gripper have no licensed media and use text cues only. Source, license and provider are shown on each Exercise Detail page.
