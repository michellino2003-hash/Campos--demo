import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_KEY = '@campos/athlete-profile-v1';

export type GoalMode = 'cut' | 'maintain' | 'build';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type TrainingPriority = 'boxing' | 'conditioning' | 'strength' | 'physique';
export type EquipmentKey = 'heavy-bag' | 'gym' | 'dumbbells' | 'bodyweight';

export type AthleteProfile = {
  version: 1;
  completed: boolean;
  displayName: string;
  goalMode: GoalMode;
  experience: ExperienceLevel;
  primaryPriority: TrainingPriority;
  trainingDaysPerWeek: number;
  sessionMinutes: 30 | 45 | 60 | 75;
  equipment: EquipmentKey[];
  updatedAt: string;
};

export const DEFAULT_ATHLETE_PROFILE: AthleteProfile = {
  version: 1,
  completed: false,
  displayName: '',
  goalMode: 'maintain',
  experience: 'beginner',
  primaryPriority: 'boxing',
  trainingDaysPerWeek: 3,
  sessionMinutes: 60,
  equipment: ['bodyweight'],
  updatedAt: new Date(0).toISOString(),
};

export async function getAthleteProfile(): Promise<AthleteProfile> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (!raw) return DEFAULT_ATHLETE_PROFILE;
    const parsed = JSON.parse(raw) as Partial<AthleteProfile>;
    if (parsed.version !== 1) return DEFAULT_ATHLETE_PROFILE;
    return {
      ...DEFAULT_ATHLETE_PROFILE,
      ...parsed,
      equipment: Array.isArray(parsed.equipment) && parsed.equipment.length ? parsed.equipment as EquipmentKey[] : ['bodyweight'],
    };
  } catch {
    return DEFAULT_ATHLETE_PROFILE;
  }
}

export async function saveAthleteProfile(profile: Omit<AthleteProfile, 'version' | 'updatedAt'>): Promise<AthleteProfile> {
  const payload: AthleteProfile = {
    ...profile,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(payload));
  return payload;
}

export function profileSummary(profile: AthleteProfile) {
  const priority = profile.primaryPriority.charAt(0).toUpperCase() + profile.primaryPriority.slice(1);
  const experience = profile.experience.charAt(0).toUpperCase() + profile.experience.slice(1);
  return `${experience} · ${priority} first · ${profile.trainingDaysPerWeek} days/week · ${profile.sessionMinutes} min`;
}
