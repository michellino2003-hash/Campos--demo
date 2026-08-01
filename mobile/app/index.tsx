import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { calculateReadiness, type ReadinessSignals, type SessionPrescription } from '../lib/adaptive-coach';
import { getReadiness, saveReadiness } from '../lib/readiness-storage';
import { buildWorkoutStats, getActiveWorkoutSession, getWorkoutHistory } from '../lib/training-storage';
import { adaptiveSessionMinutes, buildAdaptiveWorkout } from '../lib/adaptive-workout';
import { buildWalkStats, getActiveWalk, getWalkHistory } from '../lib/walk-storage';
import { DEFAULT_ATHLETE_PROFILE, getAthleteProfile, profileSummary, type AthleteProfile } from '../lib/athlete-profile';
import { buildNutritionStats, getNutritionDay, getNutritionGoals } from '../lib/nutrition-storage';
import { buildRecoverySnapshot, type RecoverySnapshot } from '../lib/recovery-intelligence';

const DEFAULT_SIGNALS: ReadinessSignals = { sleep: 75, energy: 7, soreness: 3, stress: 4, jointComfort: 8, pain: 0 };

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <View style={styles.rowCard}><View><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View><View style={styles.controls}><TouchableOpacity style={styles.control} onPress={() => onChange(Math.max(min, value - 1))}><Text style={styles.controlText}>−</Text></TouchableOpacity><TouchableOpacity style={styles.control} onPress={() => onChange(Math.min(max, value + 1))}><Text style={styles.controlText}>+</Text></TouchableOpacity></View></View>;
}

export default function CampOSHome() {
  const [signals, setSignals] = useState(DEFAULT_SIGNALS);
  const [profile, setProfile] = useState<AthleteProfile>(DEFAULT_ATHLETE_PROFILE);
  const [training, setTraining] = useState({ currentStreak: 0, thisWeekMissions: 0, totalMissions: 0, totalMinutes: 0 });
  const [walks, setWalks] = useState({ totalWalks: 0, totalMinutes: 0, todayMinutes: 0 });
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [hasActiveWalk, setHasActiveWalk] = useState(false);
  const [recovery, setRecovery] = useState<RecoverySnapshot | null>(null);

  const prescription = useMemo(() => calculateReadiness(signals), [signals]);
  const workout = useMemo(() => buildAdaptiveWorkout(prescription, profile), [prescription, profile]);

  const refresh = useCallback(async () => {
    const [history, active, walkHistory, activeWalk, athlete, nutritionDay, nutritionGoals] = await Promise.all([
      getWorkoutHistory(), getActiveWorkoutSession(), getWalkHistory(), getActiveWalk(), getAthleteProfile(), getNutritionDay(), getNutritionGoals(),
    ]);
    const workoutStats = buildWorkoutStats(history);
    setTraining({ currentStreak: workoutStats.currentStreak, thisWeekMissions: workoutStats.thisWeekMissions, totalMissions: workoutStats.totalMissions, totalMinutes: workoutStats.totalMinutes });
    setWalks(buildWalkStats(walkHistory));
    setHasActiveSession(Boolean(active));
    setHasActiveWalk(Boolean(activeWalk));
    setProfile(athlete);
    setRecovery(buildRecoverySnapshot({ signals, workouts: history, walks: walkHistory, nutritionEntries: nutritionDay.entries, nutritionGoals }));
  }, [signals]);

  useEffect(() => { getReadiness().then((saved) => saved && setSignals(saved.signals)); }, []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const save = async () => {
    const personalizedPrescription = { ...prescription, athleteProfile: profile } as SessionPrescription;
    await saveReadiness({ signals, prescription: personalizedPrescription, updatedAt: new Date().toISOString() });
    await refresh();
  };

  const startWorkout = async () => {
    if (!profile.completed) return router.push('/onboarding');
    await save();
    router.push('/workout');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topRow}>
          <View><Text style={styles.eyebrow}>CAMPOS PERFORMANCE</Text><Text style={styles.title}>{profile.displayName ? `${profile.displayName}’s mission` : 'Tonight’s mission'}</Text></View>
          <View style={styles.navButtons}>
            {['COACH', 'RECOVERY', 'FUEL', 'WALK', 'PROGRESS'].map((label) => <TouchableOpacity key={label} style={styles.navButton} onPress={() => router.push(`/${label.toLowerCase()}` as never)}><Text style={styles.navButtonText}>{label}</Text></TouchableOpacity>)}
          </View>
        </View>

        {!profile.completed ? <TouchableOpacity style={styles.setupCard} onPress={() => router.push('/onboarding')}><Text style={styles.setupLabel}>PERSONALIZATION REQUIRED</Text><Text style={styles.setupTitle}>Build your athlete profile.</Text><Text style={styles.setupCopy}>Set goals, equipment, schedule and preferred session length.</Text></TouchableOpacity> : <TouchableOpacity style={styles.profileCard} onPress={() => router.push('/onboarding')}><View><Text style={styles.profileLabel}>YOUR CAMP</Text><Text style={styles.profileTitle}>{profile.primaryPriority.toUpperCase()} FIRST · {profile.sessionMinutes} MIN</Text><Text style={styles.profileCopy}>{profileSummary(profile)}</Text></View><Text style={styles.profileArrow}>EDIT →</Text></TouchableOpacity>}

        <View style={styles.hero}>
          <View style={styles.heroTop}><View><Text style={styles.label}>READINESS</Text><Text style={styles.score}>{prescription.score}</Text></View><View style={styles.badge}><Text style={styles.badgeText}>{prescription.mode.toUpperCase()}</Text></View></View>
          <Text style={styles.heroMessage}>{prescription.message}</Text>
          <View style={styles.statRow}><View><Text style={styles.stat}>{prescription.targetRpe}</Text><Text style={styles.statLabel}>TARGET RPE</Text></View><View><Text style={styles.stat}>{Math.round(prescription.volumeMultiplier * 100)}%</Text><Text style={styles.statLabel}>LOAD</Text></View><View><Text style={styles.stat}>{adaptiveSessionMinutes(workout)}m</Text><Text style={styles.statLabel}>SESSION</Text></View></View>
          <TouchableOpacity style={styles.primary} onPress={startWorkout}><Text style={styles.primaryText}>{!profile.completed ? 'BUILD PROFILE TO START →' : hasActiveSession ? 'RESUME GUIDED MISSION →' : 'START GUIDED MISSION →'}</Text></TouchableOpacity>
        </View>

        {recovery ? <TouchableOpacity style={styles.recoveryCard} onPress={() => router.push('/recovery')}><View><Text style={styles.recoveryLabel}>RECOVERY INTELLIGENCE</Text><Text style={styles.recoveryTitle}>{recovery.score} · {recovery.mode.toUpperCase()}</Text><Text style={styles.recoveryCopy}>{recovery.recommendations[0]?.title}</Text></View><Text style={styles.recoveryArrow}>OPEN →</Text></TouchableOpacity> : null}
        {hasActiveWalk ? <TouchableOpacity style={styles.resumeWalk} onPress={() => router.push('/walk')}><Text style={styles.resumeTitle}>Guided walk saved · resume →</Text></TouchableOpacity> : null}

        <Text style={styles.section}>Command center</Text>
        <View style={styles.grid}>
          <Metric value={training.currentStreak} label="DAY STREAK" />
          <Metric value={training.thisWeekMissions} label="THIS WEEK" />
          <Metric value={training.totalMissions} label="MISSIONS" />
          <Metric value={training.totalMinutes} label="TRAIN MIN" />
          <Metric value={walks.todayMinutes} label="WALK MIN" />
          <Metric value={recovery?.score ?? 0} label="RECOVERY" onPress={() => router.push('/recovery')} />
        </View>

        <Text style={styles.section}>Today’s check-in</Text>
        <Stepper label="Sleep quality" value={Math.round(signals.sleep / 10)} min={0} max={10} onChange={(v) => setSignals((s) => ({ ...s, sleep: v * 10 }))} />
        <Stepper label="Energy" value={signals.energy} min={0} max={10} onChange={(v) => setSignals((s) => ({ ...s, energy: v }))} />
        <Stepper label="Soreness" value={signals.soreness} min={0} max={10} onChange={(v) => setSignals((s) => ({ ...s, soreness: v }))} />
        <Stepper label="Stress" value={signals.stress} min={0} max={10} onChange={(v) => setSignals((s) => ({ ...s, stress: v }))} />
        <Stepper label="Joint comfort" value={signals.jointComfort} min={0} max={10} onChange={(v) => setSignals((s) => ({ ...s, jointComfort: v }))} />
        <Stepper label="Pain" value={signals.pain} min={0} max={10} onChange={(v) => setSignals((s) => ({ ...s, pain: v }))} />

        <TouchableOpacity style={styles.secondary} onPress={save}><Text style={styles.secondaryText}>SAVE READINESS & RECALCULATE</Text></TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ value, label, onPress }: { value: number; label: string; onPress?: () => void }) {
  const Component = onPress ? TouchableOpacity : View;
  return <Component style={styles.metric} onPress={onPress}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></Component>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#07090D' }, container: { padding: 22, paddingBottom: 52, gap: 12 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, eyebrow: { color: '#C89B3C', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 }, title: { color: '#F5F2EA', fontSize: 32, lineHeight: 36, fontWeight: '900', marginTop: 4 },
  navButtons: { gap: 4 }, navButton: { borderWidth: 1, borderColor: '#4B4028', backgroundColor: '#15120C', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 }, navButtonText: { color: '#D8B15C', fontSize: 7, fontWeight: '900', textAlign: 'center' },
  setupCard: { backgroundColor: '#16110B', borderWidth: 1, borderColor: '#725728', borderRadius: 19, padding: 16 }, setupLabel: { color: '#D4A84D', fontSize: 9, fontWeight: '900' }, setupTitle: { color: '#F1EEE7', fontSize: 19, fontWeight: '900', marginTop: 5 }, setupCopy: { color: '#A49B8C', fontSize: 12, marginTop: 5 },
  profileCard: { backgroundColor: '#0E1312', borderWidth: 1, borderColor: '#2D3B37', borderRadius: 19, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, profileLabel: { color: '#87A99C', fontSize: 9, fontWeight: '900' }, profileTitle: { color: '#E8ECE9', fontSize: 16, fontWeight: '900', marginTop: 4 }, profileCopy: { color: '#79857F', fontSize: 10, marginTop: 4 }, profileArrow: { color: '#9AB9AE', fontSize: 9, fontWeight: '900' },
  hero: { backgroundColor: '#11151B', borderWidth: 1, borderColor: '#2B313A', borderRadius: 24, padding: 20, gap: 15 }, heroTop: { flexDirection: 'row', justifyContent: 'space-between' }, label: { color: '#858C98', fontSize: 10, fontWeight: '800' }, score: { color: '#F5F2EA', fontSize: 50, fontWeight: '900' }, badge: { backgroundColor: '#2A2112', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }, badgeText: { color: '#E1B75E', fontWeight: '900', fontSize: 10 }, heroMessage: { color: '#C9CDD4', fontSize: 14, lineHeight: 21 }, statRow: { flexDirection: 'row', justifyContent: 'space-between' }, stat: { color: '#F5F2EA', fontSize: 18, fontWeight: '900' }, statLabel: { color: '#717985', fontSize: 8, fontWeight: '800' },
  primary: { backgroundColor: '#C89B3C', borderRadius: 16, padding: 16, alignItems: 'center' }, primaryText: { color: '#090B0E', fontWeight: '900', fontSize: 11 },
  recoveryCard: { backgroundColor: '#11140F', borderWidth: 1, borderColor: '#34402E', borderRadius: 19, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, recoveryLabel: { color: '#9AB68B', fontSize: 9, fontWeight: '900' }, recoveryTitle: { color: '#EDF1EA', fontSize: 20, fontWeight: '900', marginTop: 4 }, recoveryCopy: { color: '#8A9685', fontSize: 11, marginTop: 4 }, recoveryArrow: { color: '#B1C5A8', fontSize: 9, fontWeight: '900' },
  resumeWalk: { backgroundColor: '#101510', borderWidth: 1, borderColor: '#304130', borderRadius: 16, padding: 14 }, resumeTitle: { color: '#E6E9E5', fontWeight: '900' },
  section: { color: '#F5F2EA', fontSize: 20, fontWeight: '900', marginTop: 12 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, metric: { width: '48%', backgroundColor: '#0E1217', borderWidth: 1, borderColor: '#232933', borderRadius: 18, padding: 16 }, metricValue: { color: '#F5F2EA', fontSize: 26, fontWeight: '900' }, metricLabel: { color: '#717985', fontSize: 9, fontWeight: '900', marginTop: 5 },
  rowCard: { backgroundColor: '#0E1217', borderWidth: 1, borderColor: '#232933', borderRadius: 18, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, value: { color: '#F5F2EA', fontSize: 24, fontWeight: '900', marginTop: 3 }, controls: { flexDirection: 'row', gap: 8 }, control: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#191F27', alignItems: 'center', justifyContent: 'center' }, controlText: { color: '#F5F2EA', fontSize: 24, fontWeight: '800' },
  secondary: { borderWidth: 1, borderColor: '#343B46', borderRadius: 17, padding: 16, alignItems: 'center', marginTop: 4 }, secondaryText: { color: '#D7DADF', fontWeight: '900', fontSize: 11 },
});
