import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LiveSessionFeedback } from './adaptive-workout';

const HISTORY_KEY = '@campos/workout-history-v1';
const ACTIVE_SESSION_KEY = '@campos/active-workout-session-v1';

export type WorkoutSession = {
  id: string;
  completedAt: string;
  title: string;
  category: string;
  durationSeconds: number;
  blocksCompleted: number;
  totalBlocks: number;
  effort: number;
};

export type LiveSessionAdaptation = {
  afterBlock: number;
  feedback: LiveSessionFeedback;
};

export type ActiveWorkoutSession = {
  version: 1;
  startedAt: string;
  updatedAt: string;
  title: string;
  category: string;
  activeBlock: number;
  secondsLeft: number;
  completedBlocks: number[];
  sessionSeconds: number;
  isRunning: boolean;
  adaptations?: LiveSessionAdaptation[];
};

export async function getWorkoutHistory(): Promise<WorkoutSession[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WorkoutSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveWorkoutSession(session: WorkoutSession): Promise<void> {
  const current = await getWorkoutHistory();
  const next = [session, ...current].slice(0, 100);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

export async function clearWorkoutHistory(): Promise<void> {
  await AsyncStorage.removeItem(HISTORY_KEY);
}

export async function saveActiveWorkoutSession(
  session: Omit<ActiveWorkoutSession, 'version' | 'updatedAt'>,
): Promise<void> {
  const payload: ActiveWorkoutSession = {
    ...session,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(payload));
}

export async function getActiveWorkoutSession(): Promise<ActiveWorkoutSession | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveWorkoutSession>;
    if (
      parsed.version !== 1 ||
      typeof parsed.startedAt !== 'string' ||
      typeof parsed.updatedAt !== 'string' ||
      typeof parsed.title !== 'string' ||
      typeof parsed.category !== 'string' ||
      typeof parsed.activeBlock !== 'number' ||
      typeof parsed.secondsLeft !== 'number' ||
      !Array.isArray(parsed.completedBlocks) ||
      typeof parsed.sessionSeconds !== 'number' ||
      typeof parsed.isRunning !== 'boolean'
    ) return null;

    const adaptations = Array.isArray(parsed.adaptations)
      ? parsed.adaptations.filter((item) =>
          item &&
          typeof item.afterBlock === 'number' &&
          item.feedback &&
          typeof item.feedback.effort === 'number' &&
          typeof item.feedback.technique === 'string' &&
          typeof item.feedback.pain === 'string' &&
          typeof item.feedback.breathing === 'string',
        )
      : [];

    return { ...(parsed as ActiveWorkoutSession), adaptations };
  } catch {
    return null;
  }
}

export async function clearActiveWorkoutSession(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
}

const dayKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function calculateStreak(history: WorkoutSession[]) {
  if (!history.length) return 0;
  const completedDays = new Set(history.map((session) => dayKey(new Date(session.completedAt))));
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  if (!completedDays.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (completedDays.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function buildWorkoutStats(history: WorkoutSession[]) {
  const totalSeconds = history.reduce((sum, session) => sum + session.durationSeconds, 0);
  const averageEffort = history.length ? history.reduce((sum, session) => sum + session.effort, 0) / history.length : 0;
  const uniqueDays = new Set(history.map((session) => dayKey(new Date(session.completedAt))));
  const now = new Date();
  const weekStart = new Date(now);
  const daysSinceMonday = (now.getDay() + 6) % 7;
  weekStart.setDate(now.getDate() - daysSinceMonday);
  weekStart.setHours(0, 0, 0, 0);
  const thisWeek = history.filter((session) => new Date(session.completedAt) >= weekStart);
  const thisWeekDays = new Set(thisWeek.map((session) => dayKey(new Date(session.completedAt))));
  const thisWeekMinutes = Math.round(thisWeek.reduce((sum, session) => sum + session.durationSeconds, 0) / 60);
  return {
    totalMissions: history.length,
    totalMinutes: Math.round(totalSeconds / 60),
    averageEffort: Number(averageEffort.toFixed(1)),
    activeDays: uniqueDays.size,
    currentStreak: calculateStreak(history),
    thisWeekMissions: thisWeek.length,
    thisWeekActiveDays: thisWeekDays.size,
    thisWeekMinutes,
  };
}
