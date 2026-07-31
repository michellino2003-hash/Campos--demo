import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { calculateReadiness, type ReadinessSignals } from '../lib/adaptive-coach';
import { getReadiness, saveReadiness } from '../lib/readiness-storage';
import { buildWorkoutStats, getActiveWorkoutSession, getWorkoutHistory } from '../lib/training-storage';
import { adaptiveSessionMinutes, buildAdaptiveWorkout } from '../lib/adaptive-workout';

const DEFAULT_SIGNALS: ReadinessSignals = { sleep: 75, energy: 7, soreness: 3, stress: 4, jointComfort: 8, pain: 0 };

type Stats = ReturnType<typeof buildWorkoutStats>;
const EMPTY_STATS: Stats = { totalMissions: 0, totalMinutes: 0, averageEffort: 0, activeDays: 0, currentStreak: 0, thisWeekMissions: 0, thisWeekActiveDays: 0, thisWeekMinutes: 0 };

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <View style={styles.rowCard}><View><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View><View style={styles.controls}><TouchableOpacity style={styles.control} onPress={() => onChange(Math.max(min, value - 1))}><Text style={styles.controlText}>−</Text></TouchableOpacity><TouchableOpacity style={styles.control} onPress={() => onChange(Math.min(max, value + 1))}><Text style={styles.controlText}>+</Text></TouchableOpacity></View></View>;
}

export default function CampOSHome() {
  const [signals, setSignals] = useState(DEFAULT_SIGNALS);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const prescription = useMemo(() => calculateReadiness(signals), [signals]);
  const workout = useMemo(() => buildAdaptiveWorkout(prescription), [prescription]);

  const refreshTraining = React.useCallback(() => {
    Promise.all([getWorkoutHistory(), getActiveWorkoutSession()]).then(([history, active]) => {
      setStats(buildWorkoutStats(history));
      setHasActiveSession(Boolean(active));
    });
  }, []);

  useEffect(() => {
    getReadiness().then((saved) => { if (saved) setSignals(saved.signals); });
    refreshTraining();
  }, [refreshTraining]);

  useFocusEffect(React.useCallback(() => { refreshTraining(); }, [refreshTraining]));

  const update = (key: keyof ReadinessSignals, value: number) => setSignals((current) => ({ ...current, [key]: value }));
  const save = async () => saveReadiness({ signals, prescription, updatedAt: new Date().toISOString() });
  const startWorkout = async () => {
    await save();
    router.push('/workout');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>CAMPOS PERFORMANCE</Text>
        <Text style={styles.title}>Tonight’s mission</Text>

        <View style={styles.hero}>
          <View style={styles.heroTop}><View><Text style={styles.label}>READINESS</Text><Text style={styles.score}>{prescription.score}</Text></View><View style={styles.badge}><Text style={styles.badgeText}>{prescription.mode.toUpperCase()}</Text></View></View>
          <Text style={styles.heroMessage}>{prescription.message}</Text>
          <View style={styles.statRow}><View><Text style={styles.stat}>{prescription.targetRpe}</Text><Text style={styles.statLabel}>TARGET RPE</Text></View><View><Text style={styles.stat}>{Math.round(prescription.volumeMultiplier * 100)}%</Text><Text style={styles.statLabel}>VOLUME</Text></View><View><Text style={styles.stat}>{adaptiveSessionMinutes(workout)}m</Text><Text style={styles.statLabel}>SESSION</Text></View></View>
          <TouchableOpacity style={styles.primary} onPress={startWorkout}><Text style={styles.primaryText}>{hasActiveSession ? 'RESUME GUIDED MISSION →' : 'START GUIDED MISSION →'}</Text></TouchableOpacity>
        </View>

        <Text style={styles.section}>Training command center</Text>
        <View style={styles.grid}>
          <View style={styles.metric}><Text style={styles.metricValue}>{stats.currentStreak}</Text><Text style={styles.metricLabel}>DAY STREAK</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{stats.thisWeekMissions}</Text><Text style={styles.metricLabel}>THIS WEEK</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{stats.totalMissions}</Text><Text style={styles.metricLabel}>MISSIONS</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{stats.totalMinutes}</Text><Text style={styles.metricLabel}>MINUTES</Text></View>
        </View>

        <Text style={styles.section}>Today’s check-in</Text>
        <Stepper label="Sleep quality" value={Math.round(signals.sleep / 10)} min={0} max={10} onChange={(v) => update('sleep', v * 10)} />
        <Stepper label="Energy" value={signals.energy} min={0} max={10} onChange={(v) => update('energy', v)} />
        <Stepper label="Soreness" value={signals.soreness} min={0} max={10} onChange={(v) => update('soreness', v)} />
        <Stepper label="Stress" value={signals.stress} min={0} max={10} onChange={(v) => update('stress', v)} />
        <Stepper label="Joint comfort" value={signals.jointComfort} min={0} max={10} onChange={(v) => update('jointComfort', v)} />
        <Stepper label="Pain" value={signals.pain} min={0} max={10} onChange={(v) => update('pain', v)} />

        <View style={styles.coachCard}><Text style={styles.eyebrow}>COACH DECISION</Text>{prescription.reasons.map((reason) => <Text key={reason} style={styles.reason}>• {reason}</Text>)}</View>
        <TouchableOpacity style={styles.secondary} onPress={save}><Text style={styles.secondaryText}>SAVE READINESS</Text></TouchableOpacity>
        <Text style={styles.footer}>CampOS mobile · public source of truth</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#07090D' }, container: { padding: 22, paddingBottom: 48, gap: 12 },
  eyebrow: { color: '#C89B3C', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 }, title: { color: '#F5F2EA', fontSize: 34, lineHeight: 38, fontWeight: '900', marginBottom: 10 },
  hero: { backgroundColor: '#11151B', borderWidth: 1, borderColor: '#2B313A', borderRadius: 24, padding: 20, gap: 16 }, heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  label: { color: '#858C98', fontSize: 11, fontWeight: '800', letterSpacing: 1 }, score: { color: '#F5F2EA', fontSize: 50, fontWeight: '900' }, badge: { backgroundColor: '#2A2112', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }, badgeText: { color: '#E1B75E', fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  heroMessage: { color: '#C9CDD4', fontSize: 15, lineHeight: 22 }, statRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, stat: { color: '#F5F2EA', fontSize: 18, fontWeight: '900' }, statLabel: { color: '#717985', fontSize: 9, fontWeight: '800', marginTop: 3 },
  section: { color: '#F5F2EA', fontSize: 20, fontWeight: '900', marginTop: 14 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, metric: { width: '48%', backgroundColor: '#0E1217', borderWidth: 1, borderColor: '#232933', borderRadius: 18, padding: 16 }, metricValue: { color: '#F5F2EA', fontSize: 26, fontWeight: '900' }, metricLabel: { color: '#717985', fontSize: 9, fontWeight: '900', marginTop: 5 },
  rowCard: { backgroundColor: '#0E1217', borderWidth: 1, borderColor: '#232933', borderRadius: 18, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, value: { color: '#F5F2EA', fontSize: 24, fontWeight: '900', marginTop: 3 }, controls: { flexDirection: 'row', gap: 8 }, control: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#191F27', alignItems: 'center', justifyContent: 'center' }, controlText: { color: '#F5F2EA', fontSize: 24, fontWeight: '800' },
  coachCard: { backgroundColor: '#12100C', borderWidth: 1, borderColor: '#3B3020', borderRadius: 20, padding: 18, gap: 8, marginTop: 8 }, reason: { color: '#D7D1C7', fontSize: 14, lineHeight: 20 },
  primary: { backgroundColor: '#C89B3C', borderRadius: 17, padding: 17, alignItems: 'center' }, primaryText: { color: '#090B0E', fontWeight: '900', letterSpacing: 1 }, secondary: { borderWidth: 1, borderColor: '#343B46', borderRadius: 17, padding: 16, alignItems: 'center' }, secondaryText: { color: '#D7DADF', fontWeight: '900', letterSpacing: 0.7 }, footer: { color: '#626A76', textAlign: 'center', marginTop: 8, fontSize: 11 },
});
