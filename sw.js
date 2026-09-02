// Service worker: precache app shell + demo media so workouts never need the network.
const VERSION = 'evdespor-v1';
const PRECACHE = [
  "./index.html",
  "./manifest.webmanifest",
  "./css/app.css",
  "./js/app.js",
  "./js/backup.js",
  "./js/data/exercises.js",
  "./js/data/program.js",
  "./js/engine/progress.js",
  "./js/engine/workout.js",
  "./js/store.js",
  "./js/ui/common.js",
  "./js/ui/library.js",
  "./js/ui/onboarding.js",
  "./js/ui/program.js",
  "./js/ui/progress.js",
  "./js/ui/settings.js",
  "./js/ui/summary.js",
  "./js/ui/today.js",
  "./js/ui/workout.js",
  "./assets/demos/Band_Pull_Apart_0.webp",
  "./assets/demos/Band_Pull_Apart_1.webp",
  "./assets/demos/Barbell_Hip_Thrust_0.webp",
  "./assets/demos/Barbell_Hip_Thrust_1.webp",
  "./assets/demos/Barbell_Rear_Delt_Row_0.webp",
  "./assets/demos/Barbell_Rear_Delt_Row_1.webp",
  "./assets/demos/Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench_0.webp",
  "./assets/demos/Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench_1.webp",
  "./assets/demos/Bent_Over_Two-Dumbbell_Row_0.webp",
  "./assets/demos/Bent_Over_Two-Dumbbell_Row_1.webp",
  "./assets/demos/Decline_Dumbbell_Triceps_Extension_0.webp",
  "./assets/demos/Decline_Dumbbell_Triceps_Extension_1.webp",
  "./assets/demos/Dumbbell_Alternate_Bicep_Curl_0.webp",
  "./assets/demos/Dumbbell_Alternate_Bicep_Curl_1.webp",
  "./assets/demos/Dumbbell_Bench_Press_0.webp",
  "./assets/demos/Dumbbell_Bench_Press_1.webp",
  "./assets/demos/Dumbbell_Bench_Press_with_Neutral_Grip_0.webp",
  "./assets/demos/Dumbbell_Bench_Press_with_Neutral_Grip_1.webp",
  "./assets/demos/Dumbbell_Bicep_Curl_0.webp",
  "./assets/demos/Dumbbell_Bicep_Curl_1.webp",
  "./assets/demos/Dumbbell_Rear_Lunge_0.webp",
  "./assets/demos/Dumbbell_Rear_Lunge_1.webp",
  "./assets/demos/Dumbbell_Shoulder_Press_0.webp",
  "./assets/demos/Dumbbell_Shoulder_Press_1.webp",
  "./assets/demos/Face_Pull_0.webp",
  "./assets/demos/Face_Pull_1.webp",
  "./assets/demos/Goblet_Squat_0.webp",
  "./assets/demos/Goblet_Squat_1.webp",
  "./assets/demos/Hammer_Curls_0.webp",
  "./assets/demos/Hammer_Curls_1.webp",
  "./assets/demos/Incline_Dumbbell_Press_0.webp",
  "./assets/demos/Incline_Dumbbell_Press_1.webp",
  "./assets/demos/Incline_Push-Up_0.webp",
  "./assets/demos/Incline_Push-Up_1.webp",
  "./assets/demos/Kettlebell_One-Legged_Deadlift_0.webp",
  "./assets/demos/Kettlebell_One-Legged_Deadlift_1.webp",
  "./assets/demos/One-Arm_Dumbbell_Row_0.webp",
  "./assets/demos/One-Arm_Dumbbell_Row_1.webp",
  "./assets/demos/Seated_Cable_Rows_0.webp",
  "./assets/demos/Seated_Cable_Rows_1.webp",
  "./assets/demos/Side_Lateral_Raise_0.webp",
  "./assets/demos/Side_Lateral_Raise_1.webp",
  "./assets/demos/Single_Leg_Glute_Bridge_0.webp",
  "./assets/demos/Single_Leg_Glute_Bridge_1.webp",
  "./assets/demos/Split_Squat_with_Dumbbells_0.webp",
  "./assets/demos/Split_Squat_with_Dumbbells_1.webp",
  "./assets/demos/Standing_Dumbbell_Calf_Raise_0.webp",
  "./assets/demos/Standing_Dumbbell_Calf_Raise_1.webp",
  "./assets/demos/Standing_Dumbbell_Triceps_Extension_0.webp",
  "./assets/demos/Standing_Dumbbell_Triceps_Extension_1.webp",
  "./assets/demos/Straight-Arm_Dumbbell_Pullover_0.webp",
  "./assets/demos/Straight-Arm_Dumbbell_Pullover_1.webp",
  "./assets/demos/Straight-Arm_Pulldown_0.webp",
  "./assets/demos/Straight-Arm_Pulldown_1.webp",
  "./assets/demos/Wide-Grip_Lat_Pulldown_0.webp",
  "./assets/demos/Wide-Grip_Lat_Pulldown_1.webp",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512-maskable.png",
  "./assets/icons/icon-512.png"
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok && new URL(e.request.url).origin === location.origin) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
