import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { calculateReadiness, type ReadinessSignals, type SessionPrescription } from '../lib/adaptive-coach';
import { getReadiness, saveReadiness } from '../lib/readiness-storage';
import { buildWorkoutStats, getActiveWorkoutSession, getWorkoutHistory } from '../lib/training-storage';
import { adaptiveSessionMinutes, buildAdaptiveWorkout } from '../lib/adaptive-workout';
import { buildWalkStats, getActiveWalk, getWalkHistory } from '../lib/walk-storage';
import { DEFAULT_ATHLETE_PROFILE, getAthleteProfile, profileSummary, type AthleteProfile } from '../lib/athlete-profile';

const DEFAULT_SIGNALS: ReadinessSignals = { sleep: 75, energy: 7, soreness: 3, stress: 4, jointComfort: 8, pain: 0 };

type Stats = ReturnType<typeof buildWorkoutStats>;
type WalkStats = ReturnType<typeof buildWalkStats>;
const EMPTY_STATS: Stats = { totalMissions: 0, totalMinutes: 0, averageEffort: 0, activeDays: 0, currentStreak: 0, thisWeekMissions: 0, thisWeekActiveDays: 0, thisWeekMinutes: 0 };
const EMPTY_WALKS: WalkStats = { totalWalks: 0, totalMinutes: 0, todayMinutes: 0 };

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <View style={styles.rowCard}><View><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View><View style={styles.controls}><TouchableOpacity style={styles.control} onPress={() => onChange(Math.max(min, value - 1))}><Text style={styles.controlText}>−</Text></TouchableOpacity><TouchableOpacity style={styles.control} onPress={() => onChange(Math.min(max, value + 1))}><Text style={styles.controlText}>+</Text></TouchableOpacity></View></View>;
}

export default function CampOSHome() {
  const [signals, setSignals] = useState(DEFAULT_SIGNALS);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [walks, setWalks] = useState<WalkStats>(EMPTY_WALKS);
  const [profile, setProfile] = useState<AthleteProfile>(DEFAULT_ATHLETE_PROFILE);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [hasActiveWalk, setHasActiveWalk] = useState(false);
  const prescription = useMemo(() => calculateReadiness(signals), [signals]);
  const workout = useMemo(() => buildAdaptiveWorkout(prescription, profile), [prescription, profile]);

  const refresh = React.useCallback(() => {
    Promise.all([getWorkoutHistory(), getActiveWorkoutSession(), getWalkHistory(), getActiveWalk(), getAthleteProfile()]).then(([history, active, walkHistory, activeWalk, athlete]) => {
      setStats(buildWorkoutStats(history));
      setWalks(buildWalkStats(walkHistory));
      setHasActiveSession(Boolean(active));
      setHasActiveWalk(Boolean(activeWalk));
      setProfile(athlete);
    });
  }, []);

  useEffect(() => {
    getReadiness().then((saved) => { if (saved) setSignals(saved.signals); });
    refresh();
  }, [refresh]);

  useFocusEffect(React.useCallback(() => { refresh(); }, [refresh]));

  const update = (key: keyof ReadinessSignals, value: number) => setSignals((current) => ({ ...current, [key]: value }));
  const save = async () => {
    const personalizedPrescription = { ...prescription, athleteProfile: profile } as SessionPrescription;
    await saveReadiness({ signals, prescription: personalizedPrescription, updatedAt: new Date().toISOString() });
  };
  const startWorkout = async () => {
    if (!profile.completed) {
      router.push('/onboarding');
      return;
    }
    await save();
    router.push('/workout');
  };

  const greeting = profile.displayName.trim() ? `${profile.displayName.trim()}’s mission` : 'Tonight’s mission';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topRow}>
          <View><Text style={styles.eyebrow}>CAMPOS PERFORMANCE</Text><Text style={styles.title}>{greeting}</Text></View>
          <View style={styles.navButtons}>
            <TouchableOpacity style={styles.navButton} onPress={() => router.push('/coach')}><Text style={styles.navButtonText}>COACH</Text></TouchableOpacity>
            <TouchableOpacity style={styles.navButton} onPress={() => router.push('/nutrition')}><Text style={styles.navButtonText}>FUEL</Text></TouchableOpacity>
            <TouchableOpacity style={styles.navButton} onPress={() => router.push('/walk')}><Text style={styles.navButtonText}>WALK</Text></TouchableOpacity>
            <TouchableOpacity style={styles.navButton} onPress={() => router.push('/progress')}><Text style={styles.navButtonText}>PROGRESS</Text></TouchableOpacity>
          </View>
        </View>

        {!profile.completed ? (
          <TouchableOpacity style={styles.setupCard} onPress={() => router.push('/onboarding')}>
            <View><Text style={styles.setupLabel}>PERSONALIZATION REQUIRED</Text><Text style={styles.setupTitle}>Build your athlete profile.</Text><Text style={styles.setupCopy}>Tell CampOS your goal, experience, schedule and equipment so the mission can fit your real life.</Text></View>
            <Text style={styles.setupArrow}>SET UP →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.profileCard} onPress={() => router.push('/onboarding')}>
            <View><Text style={styles.profileLabel}>YOUR CAMP</Text><Text style={styles.profileTitle}>{profile.primaryPriority.toUpperCase()} FIRST · {profile.sessionMinutes} MIN</Text><Text style={styles.profileCopy}>{profileSummary(profile)}</Text></View>
            <Text style={styles.profileArrow}>EDIT →</Text>
          </TouchableOpacity>
        )}

        <View style={styles.hero}>
          <View style={styles.heroTop}><View><Text style={styles.label}>READINESS</Text><Text style={styles.score}>{prescription.score}</Text></View><View style={styles.badge}><Text style={styles.badgeText}>{prescription.mode.toUpperCase()}</Text></View></View>
          <Text style={styles.heroMessage}>{prescription.message}</Text>
          <View style={styles.statRow}><View><Text style={styles.stat}>{prescription.targetRpe}</Text><Text style={styles.statLabel}>TARGET RPE</Text></View><View><Text style={styles.stat}>{Math.round(prescription.volumeMultiplier * 100)}%</Text><Text style={styles.statLabel}>RECOVERY LOAD</Text></View><View><Text style={styles.stat}>{adaptiveSessionMinutes(workout)}m</Text><Text style={styles.statLabel}>PERSONALIZED</Text></View></View>
          <TouchableOpacity style={styles.primary} onPress={startWorkout}><Text style={styles.primaryText}>{!profile.completed ? 'BUILD PROFILE TO START →' : hasActiveSession ? 'RESUME GUIDED MISSION →' : 'START GUIDED MISSION →'}</Text></TouchableOpacity>
        </View>

        {hasActiveWalk ? <TouchableOpacity style={styles.resumeWalk} onPress={() => router.push('/walk')}><View><Text style={styles.resumeLabel}>GUIDED WALK SAVED</Text><Text style={styles.resumeTitle}>Your recovery walk is waiting.</Text></View><Text style={styles.resumeArrow}>RESUME →</Text></TouchableOpacity> : null}

        <View style={styles.sectionRow}><Text style={styles.section}>Training command center</Text><TouchableOpacity onPress={() => router.push('/progress')}><Text style={styles.sectionLink}>VIEW RECORD →</Text></TouchableOpacity></View>
        <View style={styles.grid}>
          <View style={styles.metric}><Text style={styles.metricValue}>{stats.currentStreak}</Text><Text style={styles.metricLabel}>DAY STREAK</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{stats.thisWeekMissions}</Text><Text style={styles.metricLabel}>THIS WEEK</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{stats.totalMissions}</Text><Text style={styles.metricLabel}>MISSIONS</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{stats.totalMinutes}</Text><Text style={styles.metricLabel}>TRAIN MIN</Text></View>
          <TouchableOpacity style={styles.metric} onPress={() => router.push('/walk')}><Text style={styles.metricValue}>{walks.todayMinutes}</Text><Text style={styles.metricLabel}>WALK MIN TODAY</Text></TouchableOpacity>
          <TouchableOpacity style={styles.metric} onPress={() => router.push('/walk')}><Text style={styles.metricValue}>{walks.totalWalks}</Text><Text style={styles.metricLabel}>GUIDED WALKS</Text></TouchableOpacity>
        </View>

        <Text style={styles.section}>Today’s check-in</Text>
        <Stepper label="Sleep quality" value={Math.round(signals.sleep / 10)} min={0} max={10} onChange={(v) => update('sleep', v * 10)} />
        <Stepper label="Energy" value={signals.energy} min={0} max={10} onChange={(v) => update('energy', v)} />
        <Stepper label="Soreness" value={signals.soreness} min={0} max={10} onChange={(v) => update('soreness', v)} />
        <Stepper label="Stress" value={signals.stress} min={0} max={10} onChange={(v) => update('stress', v)} />
        <Stepper label="Joint comfort" value={signals.jointComfort} min={0} max={10} onChange={(v) => update('jointComfort', v)} />
        <Stepper label="Pain" value={signals.pain} min={0} max={10} onChange={(v) => update('pain', v)} />

        <TouchableOpacity activeOpacity={0.85} style={styles.coachCard} onPress={() => router.push('/coach')}>
          <View style={styles.coachHeader}><Text style={styles.eyebrow}>COACH DECISION</Text><Text style={styles.coachLink}>OPEN COACH →</Text></View>
          {prescription.reasons.map((reason) => <Text key={reason} style={styles.reason}>• {reason}</Text>)}
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={save}><Text style={styles.secondaryText}>SAVE READINESS</Text></TouchableOpacity>
        <Text style={styles.footer}>CampOS mobile · public source of truth</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#07090D' }, container: { padding: 22, paddingBottom: 48, gap: 12 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, navButtons: { gap: 5, alignItems: 'stretch' }, navButton: { borderWidth: 1, borderColor: '#4B4028', backgroundColor: '#15120C', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6 }, navButtonText: { color: '#D8B15C', fontSize: 7, fontWeight: '900', letterSpacing: 0.5, textAlign: 'center' },
  eyebrow: { color: '#C89B3C', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 }, title: { color: '#F5F2EA', fontSize: 34, lineHeight: 38, fontWeight: '900', marginTop: 4 },
  setupCard: { backgroundColor: '#16110B', borderWidth: 1, borderColor: '#725728', borderRadius: 19, padding: 16, gap: 9 }, setupLabel: { color: '#D4A84D', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, setupTitle: { color: '#F1EEE7', fontSize: 19, fontWeight: '900', marginTop: 4 }, setupCopy: { color: '#A49B8C', fontSize: 12, lineHeight: 18, marginTop: 5 }, setupArrow: { color: '#E2B75B', fontSize: 10, fontWeight: '900', alignSelf: 'flex-end' },
  profileCard: { backgroundColor: '#0E1312', borderWidth: 1, borderColor: '#2D3B37', borderRadius: 19, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, profileLabel: { color: '#87A99C', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, profileTitle: { color: '#E8ECE9', fontSize: 16, fontWeight: '900', marginTop: 4 }, profileCopy: { color: '#79857F', fontSize: 10, marginTop: 4 }, profileArrow: { color: '#9AB9AE', fontSize: 9, fontWeight: '900' },
  hero: { backgroundColor: '#11151B', borderWidth: 1, borderColor: '#2B313A', borderRadius: 24, padding: 20, gap: 16 }, heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  label: { color: '#858C98', fontSize: 11, fontWeight: '800', letterSpacing: 1 }, score: { color: '#F5F2EA', fontSize: 50, fontWeight: '900' }, badge: { backgroundColor: '#2A2112', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }, badgeText: { color: '#E1B75E', fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  heroMessage: { color: '#C9CDD4', fontSize: 15, lineHeight: 22 }, statRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, stat: { color: '#F5F2EA', fontSize: 18, fontWeight: '900' }, statLabel: { color: '#717985', fontSize: 8, fontWeight: '800', marginTop: 3 },
  resumeWalk: { backgroundColor: '#101510', borderWidth: 1, borderColor: '#304130', borderRadius: 18, padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, resumeLabel: { color: '#91B394', fontSize: 9, fontWeight: '900', letterSpacing: 1 }, resumeTitle: { color: '#E6E9E5', fontSize: 15, fontWeight: '900', marginTop: 4 }, resumeArrow: { color: '#A8C7AA', fontSize: 10, fontWeight: '900' },
  sectionRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginTop: 14 }, section: { color: '#F5F2EA', fontSize: 20, fontWeight: '900', marginTop: 14 }, sectionLink: { color: '#C89B3C', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, metric: { width: '48%', backgroundColor: '#0E1217', borderWidth: 1, borderColor: '#232933', borderRadius: 18, padding: 16 }, metricValue: { color: '#F5F2EA', fontSize: 26, fontWeight: '900' }, metricLabel: { color: '#717985', fontSize: 9, fontWeight: '900', marginTop: 5 },
  rowCard: { backgroundColor: '#0E1217', borderWidth: 1, borderColor: '#232933', borderRadius: 18, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, value: { color: '#F5F2EA', fontSize: 24, fontWeight: '900', marginTop: 3 }, controls: { flexDirection: 'row', gap: 8 }, control: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#191F27', alignItems: 'center', justifyContent: 'center' }, controlText: { color: '#F5F2EA', fontSize: 24, fontWeight: '800' },
  coachCard: { backgroundColor: '#12100C', borderWidth: 1, borderColor: '#3B3020', borderRadius: 20, padding: 18, gap: 8, marginTop: 8 }, coachHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, coachLink: { color: '#B5934D', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 }, reason: { color: '#D7D1C7', fontSize: 14, lineHeight: 20 },
  primary: { backgroundColor: '#C89B3C', borderRadius: 17, padding: 17, alignItems: 'center' }, primaryText: { color: '#090B0E', fontWeight: '900', letterSpacing: 1 }, secondary: { borderWidth: 1, borderColor: '#343B46', borderRadius: 17, padding: 16, alignItems: 'center' }, secondaryText: { color: '#D7DADF', fontWeight: '900', letterSpacing: 0.7 }, footer: { color: '#626A76', textAlign: 'center', marginTop: 8, fontSize: 11 },
});
