// Default 7-day cycle. Structured data only — the workout engine reads this.
// Per-exercise fields are editable by the user (Program → Edit). `rest` null = derived from
// workout type + exercise mechanic via settings.restDefaults.

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
      id: 'hard_push', name: 'HARD PUSH', type: 'hard', focus: 'push', muscles: 'Chest · Shoulders · Triceps',
      exercises: [
        ex('db_bench_press', 4, 15, 30, 1, 2, { day: 1, notes: 'Controlled tempo. If max weight gets easy: 3 s eccentric + 1 s pause.' }),
        ex('db_squeeze_press', 3, 15, 30, 1, 2, { day: 1, notes: 'Press the dumbbells together the whole time.' }),
        ex('seated_db_shoulder_press', 3, 15, 25, 1, 2, { day: 1 }),
        ex('db_lateral_raise', 4, 20, 40, 1, 2, { day: 1, lastSet: true, notes: 'Last set optional 0–1 RIR.' }),
        ex('db_overhead_triceps_extension', 3, 15, 30, 1, 2, { day: 1, notes: 'Single 20 kg dumbbell can be used.' }),
      ],
    },
    light_pull: {
      id: 'light_pull', name: 'LIGHT PULL', type: 'light', focus: 'pull', muscles: 'Back · Rear delts · Biceps',
      finishers: ['gyroball', 'hand_gripper'],
      exercises: [
        ex('band_lat_pulldown', 3, 20, 35, 3, 4, { day: 2, notes: 'Only with a safe high anchor.' }),
        ex('one_arm_db_row', 3, 20, 35, 3, 3, { day: 2 }),
        ex('chest_supported_db_row', 3, 20, 35, 3, 3, { day: 2 }),
        ex('band_face_pull', 3, 20, 35, 3, 4, { day: 2, notes: 'Only with a safe anchor.' }),
        ex('chest_supported_reverse_fly', 3, 20, 40, 3, 4, { day: 2 }),
        ex('alternating_db_curl', 3, 20, 30, 3, 3, { day: 2 }),
        ex('hammer_curl', 2, 20, 30, 3, 3, { day: 2 }),
      ],
    },
    hard_legs: {
      id: 'hard_legs', name: 'HARD LEGS', type: 'hard', focus: 'legs', muscles: 'Quads · Glutes · Hamstrings · Calves',
      exercises: [
        ex('bulgarian_split_squat', 4, 15, 25, 1, 2, { day: 3, notes: 'Bench as support. One 20 kg or two dumbbells.' }),
        ex('goblet_squat', 4, 20, 35, 1, 2, { day: 3, notes: 'Up to 20 kg. If light: 3 s eccentric + 1–2 s pause.' }),
        ex('sl_rdl', 3, 15, 25, 1, 2, { day: 3 }),
        ex('sl_hip_thrust', 3, 15, 30, 1, 2, { day: 3 }),
        ex('sl_calf_raise', 4, 20, 40, 1, 2, { day: 3 }),
      ],
    },
    light_push: {
      id: 'light_push', name: 'LIGHT PUSH', type: 'light', focus: 'push', muscles: 'Chest · Shoulders · Triceps',
      exercises: [
        ex('db_bench_press', 3, 20, 35, 3, 4, { day: 4 }),
        ex('incline_pushup', 3, 15, 30, 3, 3, { day: 4 }),
        ex('seated_db_shoulder_press', 2, 20, 30, 3, 3, { day: 4 }),
        ex('db_lateral_raise', 4, 25, 40, 3, 3, { day: 4 }),
        ex('db_skull_crusher', 3, 20, 30, 3, 3, { day: 4 }),
      ],
    },
    hard_pull: {
      id: 'hard_pull', name: 'HARD PULL', type: 'hard', focus: 'pull', muscles: 'Back · Rear delts · Biceps',
      finishers: ['gyroball', 'hand_gripper'],
      exercises: [
        ex('band_lat_pulldown', 4, 15, 30, 1, 2, { day: 5, notes: 'Only with a safe anchor. Important for the back.' }),
        ex('one_arm_db_row', 4, 15, 25, 1, 2, { day: 5, notes: 'Up to 20 kg. ~2 s squeeze at the top, 2–3 s eccentric.' }),
        ex('chest_supported_db_row', 4, 15, 25, 1, 2, { day: 5 }),
        ex('db_pullover', 2, 15, 25, 1, 2, { day: 5, notes: 'If Band Lat Pulldown is not possible, raise to 3 sets.' }),
        ex('rear_delt_row', 3, 20, 30, 1, 2, { day: 5 }),
        ex('db_curl', 3, 15, 25, 1, 2, { day: 5, lastSet: true, notes: 'Last set optional 0–1 RIR.' }),
        ex('hammer_curl', 2, 15, 25, 1, 2, { day: 5 }),
      ],
    },
    light_legs: {
      id: 'light_legs', name: 'LIGHT LEGS', type: 'light', focus: 'legs', muscles: 'Quads · Glutes · Hamstrings · Calves',
      exercises: [
        ex('goblet_squat', 3, 25, 40, 3, 4, { day: 6 }),
        ex('reverse_lunge', 3, 20, 30, 3, 4, { day: 6 }),
        ex('sl_rdl', 3, 20, 30, 3, 3, { day: 6 }),
        ex('hip_thrust', 3, 25, 40, 3, 3, { day: 6 }),
        ex('calf_raise', 3, 25, 40, 3, 3, { day: 6 }),
      ],
    },
    rest: { id: 'rest', name: 'REST', type: 'rest', focus: 'rest', muscles: 'No resistance training', exercises: [] },
  };
  return {
    cycle: ['hard_push', 'light_pull', 'hard_legs', 'light_push', 'hard_pull', 'light_legs', 'rest'],
    templates,
  };
}

export const FINISHER_DEFAULTS = {
  gyroball: { sets: 3, minReps: 30, maxReps: 60, rirMin: 2, rirMax: 4, unit: 'sec' },
  hand_gripper: { sets: 3, minReps: 10, maxReps: 30, rirMin: 1, rirMax: 3, unit: 'reps' },
};
