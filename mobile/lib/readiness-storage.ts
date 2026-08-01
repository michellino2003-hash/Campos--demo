import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReadinessSignals, SessionPrescription } from './adaptive-coach';

const READINESS_KEY = '@campos/readiness-v1';
const READINESS_HISTORY_KEY = '@campos/readiness-history-v1';

export type SavedReadiness = {
  signals: ReadinessSignals;
  prescription: SessionPrescription;
  updatedAt: string;
};

export async function getReadinessHistory(): Promise<SavedReadiness[]> {
  try {
    const raw = await AsyncStorage.getItem(READINESS_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedReadiness[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveReadiness(value: SavedReadiness) {
  await AsyncStorage.setItem(READINESS_KEY, JSON.stringify(value));

  const history = await getReadinessHistory();
  const today = new Date(value.updatedAt).toDateString();
  const next = [
    value,
    ...history.filter((item) => new Date(item.updatedAt).toDateString() !== today),
  ].slice(0, 90);

  await AsyncStorage.setItem(READINESS_HISTORY_KEY, JSON.stringify(next));
}

export async function getReadiness(): Promise<SavedReadiness | null> {
  try {
    const raw = await AsyncStorage.getItem(READINESS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedReadiness;
  } catch {
    return null;
  }
}
