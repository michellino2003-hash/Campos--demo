import AsyncStorage from '@react-native-async-storage/async-storage';

const WEIGHT_KEY = '@campos/bodyweight-history-v1';

export type WeightEntry = {
  id: string;
  recordedAt: string;
  weight: number;
};

export async function getWeightHistory(): Promise<WeightEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(WEIGHT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WeightEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveWeightEntry(entry: WeightEntry): Promise<void> {
  const current = await getWeightHistory();
  const next = [entry, ...current].slice(0, 365);
  await AsyncStorage.setItem(WEIGHT_KEY, JSON.stringify(next));
}

export async function deleteWeightEntry(id: string): Promise<void> {
  const current = await getWeightHistory();
  await AsyncStorage.setItem(WEIGHT_KEY, JSON.stringify(current.filter((entry) => entry.id !== id)));
}

export function buildWeightStats(history: WeightEntry[]) {
  if (history.length === 0) return { current: 0, starting: 0, change: 0, trend: 'No data' };
  const current = history[0].weight;
  const starting = history[history.length - 1].weight;
  const change = Number((current - starting).toFixed(1));
  return {
    current,
    starting,
    change,
    trend: change < 0 ? 'Trending down' : change > 0 ? 'Trending up' : 'Holding steady',
  };
}
