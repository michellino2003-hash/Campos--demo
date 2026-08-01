import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReadinessSignals } from './adaptive-coach';
import type { WorkoutSession } from './training-storage';
import type { WalkSession } from './walk-storage';
import type { NutritionEntry, NutritionGoals } from './nutrition-storage';

const RECOVERY_HISTORY_KEY = '@campos/recovery-history-v1';

export type RecoveryMode = 'perform' | 'maintain' | 'restore' | 'deload';

export type RecoverySnapshot = {
  id: string;
  recordedAt: string;
  score: number;
  mode: RecoveryMode;
  sleepScore: number;
  bodyScore: number;
  stressScore: number;
  fuelScore: number;
  loadScore: number;
  signals: ReadinessSignals;
  trainingLoad7d: number;
  recommendations: RecoveryRecommendation[];
};

export type RecoveryRecommendation = {
  id: string;
  title: string;
  detail: string;
  action: 'workout' | 'walk' | 'mobility' | 'fuel' | 'sleep' | 'rest';
  route?: '/workout' | '/walk' | '/nutrition';
  minutes?: number;
  priority: 1 | 2 | 3;
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const hoursAgo = (iso: string) => (Date.now() - new Date(iso).getTime()) / 3_600_000;

function calculateTrainingLoad(history: WorkoutSession[]) {
  return history
    .filter((session) => hoursAgo(session.completedAt) <= 24 * 7)
    .reduce((sum, session) => sum + (session.durationSeconds / 60) * Math.max(1, session.effort), 0);
}

function recentHardDays(history: WorkoutSession[]) {
  const days = new Set(
    history
      .filter((session) => hoursAgo(session.completedAt) <= 24 * 5 && session.effort >= 8)
      .map((session) => new Date(session.completedAt).toDateString()),
  );
  return days.size;
}

function nutritionTotals(entries: NutritionEntry[]) {
  return entries.reduce(
    (totals, entry) => ({ calories: totals.calories + entry.calories, protein: totals.protein + entry.protein }),
    { calories: 0, protein: 0 },
  );
}

export function buildRecoverySnapshot(input: {
  signals: ReadinessSignals;
  workouts: WorkoutSession[];
  walks: WalkSession[];
  nutritionEntries: NutritionEntry[];
  nutritionGoals: NutritionGoals;
}): RecoverySnapshot {
  const { signals, workouts, walks, nutritionEntries, nutritionGoals } = input;
  const trainingLoad7d = calculateTrainingLoad(workouts);
  const hardDays = recentHardDays(workouts);
  const todayWalkMinutes = walks
    .filter((walk) => new Date(walk.completedAt).toDateString() === new Date().toDateString())
    .reduce((sum, walk) => sum + walk.durationSeconds / 60, 0);
  const fuel = nutritionTotals(nutritionEntries);

  const sleepScore = clamp(signals.sleep);
  const bodyScore = clamp(((10 - signals.soreness) * 6) + (signals.jointComfort * 4) - (signals.pain * 5));
  const stressScore = clamp((10 - signals.stress) * 10);
  const proteinRatio = nutritionGoals.protein > 0 ? fuel.protein / nutritionGoals.protein : 0;
  const calorieRatio = nutritionGoals.calories > 0 ? fuel.calories / nutritionGoals.calories : 0;
  const fuelScore = clamp((Math.min(proteinRatio, 1) * 55) + (Math.min(calorieRatio, 1) * 35) + (fuel.calories > 0 ? 10 : 0));
  const loadPenalty = clamp((trainingLoad7d - 900) / 18, 0, 45) + hardDays * 6;
  const movementBonus = Math.min(todayWalkMinutes, 20) * 0.5;
  const loadScore = clamp(100 - loadPenalty + movementBonus);

  const score = Math.round(
    sleepScore * 0.27 +
    bodyScore * 0.27 +
    stressScore * 0.18 +
    fuelScore * 0.13 +
    loadScore * 0.15,
  );

  let mode: RecoveryMode = 'maintain';
  if (signals.pain >= 7 || score < 42 || hardDays >= 3) mode = 'deload';
  else if (score < 58 || signals.soreness >= 7 || signals.stress >= 8) mode = 'restore';
  else if (score >= 78 && signals.energy >= 7 && signals.pain <= 2) mode = 'perform';

  const recommendations: RecoveryRecommendation[] = [];

  if (signals.pain >= 7) {
    recommendations.push({ id: 'pain-stop', title: 'Loaded work is off the table.', detail: 'Use pain-free movement only and seek medical evaluation for severe, worsening, or unexplained pain.', action: 'rest', priority: 1 });
  } else if (mode === 'deload') {
    recommendations.push({ id: 'deload', title: 'Run a deload day.', detail: 'Keep intensity low, remove failure work, and preserve the habit with recovery-focused movement.', action: 'mobility', minutes: 15, priority: 1 });
  } else if (mode === 'restore') {
    recommendations.push({ id: 'restore-walk', title: 'Choose a recovery walk first.', detail: 'Ten to twenty relaxed minutes can lower stress and preserve momentum without adding meaningful fatigue.', action: 'walk', route: '/walk', minutes: 10, priority: 1 });
  } else {
    recommendations.push({ id: 'train', title: mode === 'perform' ? 'Capacity supports a performance day.' : 'Execute the planned session cleanly.', detail: 'Use readiness and live coaching guardrails instead of chasing exhaustion.', action: 'workout', route: '/workout', priority: 1 });
  }

  if (signals.sleep < 60) recommendations.push({ id: 'sleep', title: 'Protect tonight’s sleep window.', detail: 'Keep the evening predictable, reduce late stimulation, and prioritize a consistent bedtime.', action: 'sleep', priority: 2 });
  if (signals.soreness >= 6 || signals.jointComfort <= 5) recommendations.push({ id: 'mobility', title: 'Use pain-free mobility, not aggressive stretching.', detail: 'Move the irritated areas gently for 8–12 minutes and stop if symptoms increase.', action: 'mobility', minutes: 10, priority: 2 });
  if (fuel.protein < nutritionGoals.protein * 0.7 && fuel.calories > 0) recommendations.push({ id: 'protein', title: 'Close the protein gap normally.', detail: 'Choose a regular protein-forward meal or snack. No need to force-feed or compensate.', action: 'fuel', route: '/nutrition', priority: 2 });
  if (fuel.calories > nutritionGoals.calories) recommendations.push({ id: 'over-target', title: 'Do not compensate for food.', detail: 'No punishment cardio or skipped meals. Hydrate, take a normal walk if it feels good, and continue tomorrow.', action: 'walk', route: '/walk', minutes: 10, priority: 3 });
  if (todayWalkMinutes === 0 && mode !== 'perform') recommendations.push({ id: 'easy-movement', title: 'Add a small dose of easy movement.', detail: 'A short walk can support recovery without turning the day into another workout.', action: 'walk', route: '/walk', minutes: 10, priority: 3 });

  return {
    id: `${Date.now()}`,
    recordedAt: new Date().toISOString(),
    score,
    mode,
    sleepScore: Math.round(sleepScore),
    bodyScore: Math.round(bodyScore),
    stressScore: Math.round(stressScore),
    fuelScore: Math.round(fuelScore),
    loadScore: Math.round(loadScore),
    signals,
    trainingLoad7d: Math.round(trainingLoad7d),
    recommendations: recommendations.sort((a, b) => a.priority - b.priority).slice(0, 5),
  };
}

export async function getRecoveryHistory(): Promise<RecoverySnapshot[]> {
  try {
    const raw = await AsyncStorage.getItem(RECOVERY_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecoverySnapshot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveRecoverySnapshot(snapshot: RecoverySnapshot): Promise<void> {
  const current = await getRecoveryHistory();
  const today = new Date(snapshot.recordedAt).toDateString();
  const next = [snapshot, ...current.filter((item) => new Date(item.recordedAt).toDateString() !== today)].slice(0, 60);
  await AsyncStorage.setItem(RECOVERY_HISTORY_KEY, JSON.stringify(next));
}

export function buildRecoveryTrend(history: RecoverySnapshot[]) {
  const recent = history.slice(0, 7);
  const average = recent.length ? Math.round(recent.reduce((sum, item) => sum + item.score, 0) / recent.length) : 0;
  const latest = recent[0]?.score ?? 0;
  const previous = recent[1]?.score ?? latest;
  return {
    average,
    latest,
    delta: latest - previous,
    deloadDays: recent.filter((item) => item.mode === 'deload').length,
    restoreDays: recent.filter((item) => item.mode === 'restore').length,
  };
}
