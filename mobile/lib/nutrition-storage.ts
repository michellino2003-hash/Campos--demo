import AsyncStorage from '@react-native-async-storage/async-storage';

const NUTRITION_KEY = '@campos/nutrition-v1';
const GOALS_KEY = '@campos/nutrition-goals-v1';

export type NutritionEntry = {
  id: string;
  loggedAt: string;
  name: string;
  calories: number;
  protein: number;
  carbs?: number;
  fat?: number;
};

export type NutritionGoals = {
  calories: number;
  protein: number;
};

export type DailyNutrition = {
  dateKey: string;
  entries: NutritionEntry[];
};

export const DEFAULT_NUTRITION_GOALS: NutritionGoals = {
  calories: 2100,
  protein: 190,
};

const localDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

async function getAllDays(): Promise<Record<string, NutritionEntry[]>> {
  try {
    const raw = await AsyncStorage.getItem(NUTRITION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, NutritionEntry[]>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function getNutritionDay(date = new Date()): Promise<DailyNutrition> {
  const dateKey = localDateKey(date);
  const all = await getAllDays();
  return { dateKey, entries: Array.isArray(all[dateKey]) ? all[dateKey] : [] };
}

export async function saveNutritionEntry(entry: NutritionEntry): Promise<void> {
  const all = await getAllDays();
  const dateKey = localDateKey(new Date(entry.loggedAt));
  const current = Array.isArray(all[dateKey]) ? all[dateKey] : [];
  all[dateKey] = [entry, ...current].slice(0, 80);

  const keys = Object.keys(all).sort().reverse();
  for (const key of keys.slice(45)) delete all[key];

  await AsyncStorage.setItem(NUTRITION_KEY, JSON.stringify(all));
}

export async function deleteNutritionEntry(id: string, date = new Date()): Promise<void> {
  const all = await getAllDays();
  const dateKey = localDateKey(date);
  const current = Array.isArray(all[dateKey]) ? all[dateKey] : [];
  all[dateKey] = current.filter((entry) => entry.id !== id);
  await AsyncStorage.setItem(NUTRITION_KEY, JSON.stringify(all));
}

export async function getNutritionGoals(): Promise<NutritionGoals> {
  try {
    const raw = await AsyncStorage.getItem(GOALS_KEY);
    if (!raw) return DEFAULT_NUTRITION_GOALS;
    const parsed = JSON.parse(raw) as Partial<NutritionGoals>;
    if (typeof parsed.calories !== 'number' || typeof parsed.protein !== 'number') return DEFAULT_NUTRITION_GOALS;
    return { calories: parsed.calories, protein: parsed.protein };
  } catch {
    return DEFAULT_NUTRITION_GOALS;
  }
}

export async function saveNutritionGoals(goals: NutritionGoals): Promise<void> {
  await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(goals));
}

export function buildNutritionStats(entries: NutritionEntry[], goals: NutritionGoals) {
  const calories = entries.reduce((sum, entry) => sum + entry.calories, 0);
  const protein = entries.reduce((sum, entry) => sum + entry.protein, 0);
  const carbs = entries.reduce((sum, entry) => sum + (entry.carbs ?? 0), 0);
  const fat = entries.reduce((sum, entry) => sum + (entry.fat ?? 0), 0);
  const calorieDelta = calories - goals.calories;

  return {
    calories,
    protein,
    carbs,
    fat,
    caloriesRemaining: Math.max(0, goals.calories - calories),
    proteinRemaining: Math.max(0, goals.protein - protein),
    calorieProgress: goals.calories > 0 ? calories / goals.calories : 0,
    proteinProgress: goals.protein > 0 ? protein / goals.protein : 0,
    overCalories: calorieDelta > 0,
    calorieDelta,
  };
}
