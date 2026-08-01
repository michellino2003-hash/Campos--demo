import AsyncStorage from '@react-native-async-storage/async-storage';

const WALK_HISTORY_KEY = '@campos/walk-history-v1';
const ACTIVE_WALK_KEY = '@campos/active-walk-v1';

export type WalkMood = 'upbeat' | 'tired' | 'calm' | 'reflective' | 'focused';

export type WalkSession = {
  id: string;
  completedAt: string;
  mood: WalkMood;
  durationSeconds: number;
  targetSeconds: number;
};

export type ActiveWalk = {
  version: 1;
  startedAt: string;
  updatedAt: string;
  mood: WalkMood;
  targetSeconds: number;
  elapsedSeconds: number;
  isRunning: boolean;
};

export async function getWalkHistory(): Promise<WalkSession[]> {
  try {
    const raw = await AsyncStorage.getItem(WALK_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WalkSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveWalkSession(session: WalkSession): Promise<void> {
  const current = await getWalkHistory();
  await AsyncStorage.setItem(WALK_HISTORY_KEY, JSON.stringify([session, ...current].slice(0, 180)));
}

export async function saveActiveWalk(walk: Omit<ActiveWalk, 'version' | 'updatedAt'>): Promise<void> {
  const payload: ActiveWalk = { ...walk, version: 1, updatedAt: new Date().toISOString() };
  await AsyncStorage.setItem(ACTIVE_WALK_KEY, JSON.stringify(payload));
}

export async function getActiveWalk(): Promise<ActiveWalk | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_WALK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveWalk>;
    if (
      parsed.version !== 1 ||
      typeof parsed.startedAt !== 'string' ||
      typeof parsed.updatedAt !== 'string' ||
      typeof parsed.mood !== 'string' ||
      typeof parsed.targetSeconds !== 'number' ||
      typeof parsed.elapsedSeconds !== 'number' ||
      typeof parsed.isRunning !== 'boolean'
    ) return null;
    return parsed as ActiveWalk;
  } catch {
    return null;
  }
}

export async function clearActiveWalk(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_WALK_KEY);
}

export function buildWalkStats(history: WalkSession[]) {
  const totalSeconds = history.reduce((sum, item) => sum + item.durationSeconds, 0);
  const todayKey = new Date().toDateString();
  const todaySeconds = history
    .filter((item) => new Date(item.completedAt).toDateString() === todayKey)
    .reduce((sum, item) => sum + item.durationSeconds, 0);
  return {
    totalWalks: history.length,
    totalMinutes: Math.round(totalSeconds / 60),
    todayMinutes: Math.round(todaySeconds / 60),
  };
}
