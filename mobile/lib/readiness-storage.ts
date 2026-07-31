import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReadinessSignals, SessionPrescription } from './adaptive-coach';

const READINESS_KEY = '@campos/readiness-v1';

export type SavedReadiness = {
  signals: ReadinessSignals;
  prescription: SessionPrescription;
  updatedAt: string;
};

export async function saveReadiness(value: SavedReadiness) {
  await AsyncStorage.setItem(READINESS_KEY, JSON.stringify(value));
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
