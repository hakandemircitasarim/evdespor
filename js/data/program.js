// Varsayılan 7 günlük döngü. Yalnızca yapısal veri — workout engine bunu okur.
// Egzersiz alanları kullanıcı tarafından düzenlenebilir (Program → Düzenle). `rest` null =
// antrenman tipi + egzersiz mekaniğinden settings.restDefaults ile türetilir.

export const PROGRAM_VERSION = 2;

let n = 0;
const ex = (exerciseId, sets, minReps, maxReps, rirMin, rirMax, extra = {}) => ({
  id: `d${extra.day}_${++n}`,
  exerciseId, sets, minReps, maxReps, rirMin, rirMax,
  rest: null, tempo: 'normal', notes: extra.notes || '',
  lastSetToFailure: !!extra.lastSet,
});

export function buildDefaultProgram() {
  n = 0;
  const templates = {
    hard_push: {
      id: 'hard_push', name: 'AĞIR PUSH', type: 'hard', focus: 'push', muscles: 'Göğüs · Omuz · Triceps',
      exercises: [
        ex('db_bench_press', 4, 15, 30, 1, 2, { day: 1, notes: 'Kontrollü tempo. Maksimum ağırlık kolaylaşırsa: 3 s eccentric + 1 s pause.' }),
        ex('incline_db_press', 3, 15, 25, 1, 2, { day: 1, notes: 'Bench 30–45°. Üst göğüs.' }),
        ex('db_squeeze_press', 3, 15, 30, 1, 2, { day: 1, notes: 'Dumbbell\'ları hareket boyunca birbirine bastır.' }),
        ex('seated_db_shoulder_press', 3, 15, 25, 1, 2, { day: 1 }),
        ex('db_lateral_raise', 4, 20, 40, 1, 2, { day: 1, lastSet: true, notes: 'Son set isteğe bağlı 0–1 RIR.' }),
        ex('db_overhead_triceps_extension', 3, 15, 30, 1, 2, { day: 1, notes: 'Tek 20 kg dumbbell kullanılabilir.' }),
      ],
    },
    light_pull: {
      id: 'light_pull', name: 'HAFİF PULL', type: 'light', focus: 'pull', muscles: 'Sırt · Arka omuz · Biceps',
      finishers: ['gyroball', 'hand_gripper'],
      exercises: [
        ex('band_lat_pulldown', 3, 20, 35, 3, 4, { day: 2, notes: 'Yalnız güvenli yüksek anchor varsa.' }),
        ex('one_arm_db_row', 3, 20, 35, 3, 3, { day: 2 }),
        ex('chest_supported_db_row', 3, 20, 35, 3, 3, { day: 2 }),
        ex('band_face_pull', 3, 20, 35, 3, 4, { day: 2, notes: 'Yalnız güvenli anchor varsa.' }),
        ex('chest_supported_reverse_fly', 3, 20, 40, 3, 4, { day: 2 }),
        ex('alternating_db_curl', 3, 20, 30, 3, 3, { day: 2 }),
        ex('hammer_curl', 2, 20, 30, 3, 3, { day: 2 }),
      ],
    },
    hard_legs: {
      id: 'hard_legs', name: 'AĞIR BACAK', type: 'hard', focus: 'legs', muscles: 'Quadriceps · Kalça · Hamstring · Baldır',
      exercises: [
        ex('bulgarian_split_squat', 4, 15, 25, 1, 2, { day: 3, notes: 'Bench destek olarak. Tek 20 kg veya iki dumbbell.' }),
        ex('goblet_squat', 4, 20, 35, 1, 2, { day: 3, notes: '20 kg\'a kadar. Hafif kalırsa: 3 s eccentric + 1–2 s pause.' }),
        ex('sl_rdl', 3, 15, 25, 1, 2, { day: 3 }),
        ex('sl_hip_thrust', 3, 15, 30, 1, 2, { day: 3 }),
        ex('sl_calf_raise', 4, 20, 40, 1, 2, { day: 3 }),
      ],
    },
    light_push: {
      id: 'light_push', name: 'HAFİF PUSH', type: 'light', focus: 'push', muscles: 'Göğüs · Omuz · Triceps',
      exercises: [
        ex('db_bench_press', 3, 20, 35, 3, 4, { day: 4 }),
        ex('incline_pushup', 3, 15, 30, 3, 3, { day: 4 }),
        ex('seated_db_shoulder_press', 2, 20, 30, 3, 3, { day: 4 }),
        ex('db_lateral_raise', 4, 25, 40, 3, 3, { day: 4 }),
        ex('db_skull_crusher', 3, 20, 30, 3, 3, { day: 4 }),
      ],
    },
    hard_pull: {
      id: 'hard_pull', name: 'AĞIR PULL', type: 'hard', focus: 'pull', muscles: 'Sırt · Arka omuz · Biceps',
      finishers: ['gyroball', 'hand_gripper'],
      exercises: [
        ex('band_lat_pulldown', 4, 15, 30, 1, 2, { day: 5, notes: 'Yalnız güvenli anchor varsa. Sırt için önemli.' }),
        ex('one_arm_db_row', 4, 15, 25, 1, 2, { day: 5, notes: '20 kg\'a kadar. Üstte ~2 s sıkma, 2–3 s eccentric.' }),
        ex('chest_supported_db_row', 4, 15, 25, 1, 2, { day: 5 }),
        ex('db_pullover', 2, 15, 25, 1, 2, { day: 5, notes: 'Band Lat Pulldown yapılamıyorsa 3 sete çıkar.' }),
        ex('rear_delt_row', 3, 20, 30, 1, 2, { day: 5 }),
        ex('db_curl', 3, 15, 25, 1, 2, { day: 5, lastSet: true, notes: 'Son set isteğe bağlı 0–1 RIR.' }),
        ex('hammer_curl', 2, 15, 25, 1, 2, { day: 5 }),
      ],
    },
    light_legs: {
      id: 'light_legs', name: 'HAFİF BACAK', type: 'light', focus: 'legs', muscles: 'Quadriceps · Kalça · Hamstring · Baldır',
      exercises: [
        ex('goblet_squat', 3, 25, 40, 3, 4, { day: 6 }),
        ex('reverse_lunge', 3, 20, 30, 3, 4, { day: 6 }),
        ex('sl_rdl', 3, 20, 30, 3, 3, { day: 6 }),
        ex('hip_thrust', 3, 25, 40, 3, 3, { day: 6 }),
        ex('calf_raise', 3, 25, 40, 3, 3, { day: 6 }),
      ],
    },
    rest: { id: 'rest', name: 'DİNLENME', type: 'rest', focus: 'rest', muscles: 'Direnç antrenmanı yok', exercises: [] },
  };
  return {
    version: PROGRAM_VERSION,
    cycle: ['hard_push', 'light_pull', 'hard_legs', 'light_push', 'hard_pull', 'light_legs', 'rest'],
    templates,
  };
}

export const FINISHER_DEFAULTS = {
  gyroball: { sets: 3, minReps: 30, maxReps: 60, rirMin: 2, rirMax: 4, unit: 'sec' },
  hand_gripper: { sets: 3, minReps: 10, maxReps: 30, rirMin: 1, rirMax: 3, unit: 'reps' },
};
