import React, { useCallback, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { calculateReadiness, type ReadinessSignals } from '../lib/adaptive-coach';
import { getReadiness } from '../lib/readiness-storage';
import { getWorkoutHistory } from '../lib/training-storage';
import { getWalkHistory } from '../lib/walk-storage';
import { getNutritionDay, getNutritionGoals } from '../lib/nutrition-storage';
import {
  buildRecoverySnapshot,
  buildRecoveryTrend,
  getRecoveryHistory,
  saveRecoverySnapshot,
  type RecoverySnapshot,
} from '../lib/recovery-intelligence';

const DEFAULT_SIGNALS: ReadinessSignals = { sleep: 75, energy: 7, soreness: 3, stress: 4, jointComfort: 8, pain: 0 };

const MODE_COPY = {
  perform: { label: 'PERFORM', title: 'Capacity is available.', detail: 'Train with intent, but keep technique and pain guardrails active.' },
  maintain: { label: 'MAINTAIN', title: 'Execute without forcing.', detail: 'A controlled session is the highest-value move today.' },
  restore: { label: 'RESTORE', title: 'Reduce pressure and rebuild.', detail: 'Easy movement and lower volume protect tomorrow’s capacity.' },
  deload: { label: 'DELOAD', title: 'Fatigue has earned a pullback.', detail: 'Remove hard loading and let recovery become the mission.' },
};

export default function RecoveryScreen() {
  const [snapshot, setSnapshot] = useState<RecoverySnapshot | null>(null);
  const [history, setHistory] = useState<RecoverySnapshot[]>([]);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const [savedReadiness, workouts, walks, nutritionDay, nutritionGoals, recoveryHistory] = await Promise.all([
      getReadiness(),
      getWorkoutHistory(),
      getWalkHistory(),
      getNutritionDay(),
      getNutritionGoals(),
      getRecoveryHistory(),
    ]);
    const signals = savedReadiness?.signals ?? DEFAULT_SIGNALS;
    const next = buildRecoverySnapshot({ signals, workouts, walks, nutritionEntries: nutritionDay.entries, nutritionGoals });
    setSnapshot(next);
    setHistory(recoveryHistory);
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const trend = useMemo(() => buildRecoveryTrend(history), [history]);
  const mode = snapshot ? MODE_COPY[snapshot.mode] : MODE_COPY.maintain;

  const saveToday = async () => {
    if (!snapshot || saving) return;
    setSaving(true);
    await saveRecoverySnapshot(snapshot);
    await refresh();
    setSaving(false);
  };

  if (!snapshot) return <SafeAreaView style={styles.safe} />;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topRow}>
          <View><Text style={styles.eyebrow}>RECOVERY INTELLIGENCE</Text><Text style={styles.title}>Protect the next win.</Text></View>
          <TouchableOpacity style={styles.back} onPress={() => router.back()}><Text style={styles.backText}>BACK</Text></TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View><Text style={styles.cardLabel}>RECOVERY SCORE</Text><Text style={styles.score}>{snapshot.score}</Text></View>
            <View style={styles.badge}><Text style={styles.badgeText}>{mode.label}</Text></View>
          </View>
          <Text style={styles.heroTitle}>{mode.title}</Text>
          <Text style={styles.heroCopy}>{mode.detail}</Text>
          <TouchableOpacity style={styles.primary} onPress={saveToday}><Text style={styles.primaryText}>{saving ? 'SAVING…' : 'SAVE TODAY’S RECOVERY READ'}</Text></TouchableOpacity>
        </View>

        <Text style={styles.section}>Recovery systems</Text>
        <View style={styles.grid}>
          <Metric value={snapshot.sleepScore} label="SLEEP" />
          <Metric value={snapshot.bodyScore} label="BODY" />
          <Metric value={snapshot.stressScore} label="STRESS" />
          <Metric value={snapshot.fuelScore} label="FUEL" />
          <Metric value={snapshot.loadScore} label="LOAD" />
          <Metric value={snapshot.trainingLoad7d} label="7D LOAD" raw />
        </View>

        <View style={styles.trendCard}>
          <View><Text style={styles.cardLabel}>7-DAY TREND</Text><Text style={styles.trendValue}>{trend.average || '—'}</Text></View>
          <View style={styles.trendRight}><Text style={styles.trendDelta}>{trend.delta > 0 ? '+' : ''}{trend.delta}</Text><Text style={styles.trendMeta}>{trend.restoreDays} restore · {trend.deloadDays} deload</Text></View>
        </View>

        <Text style={styles.section}>Today’s recovery prescription</Text>
        {snapshot.recommendations.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={item.route ? 0.82 : 1}
            style={styles.recommendation}
            onPress={() => item.route && router.push(item.route)}
          >
            <View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View>
            <View style={styles.recommendationCopy}>
              <View style={styles.recommendationHead}>
                <Text style={styles.recommendationTitle}>{item.title}</Text>
                {item.minutes ? <Text style={styles.minutes}>{item.minutes} MIN</Text> : null}
              </View>
              <Text style={styles.recommendationDetail}>{item.detail}</Text>
              {item.route ? <Text style={styles.open}>OPEN →</Text> : null}
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.calendarCard}>
          <Text style={styles.cardLabel}>RECENT RECOVERY DAYS</Text>
          <View style={styles.calendarRow}>
            {[...history].slice(0, 7).reverse().map((item) => (
              <View key={item.id} style={styles.day}>
                <Text style={styles.dayLabel}>{new Date(item.recordedAt).toLocaleDateString(undefined, { weekday: 'narrow' })}</Text>
                <View style={[styles.dayDot, item.mode === 'perform' && styles.perform, item.mode === 'restore' && styles.restore, item.mode === 'deload' && styles.deload]}><Text style={styles.dayScore}>{item.score}</Text></View>
              </View>
            ))}
            {history.length === 0 ? <Text style={styles.empty}>Save today’s recovery read to begin the calendar.</Text> : null}
          </View>
        </View>

        <View style={styles.guardrail}>
          <Text style={styles.cardLabel}>GUARDRAIL</Text>
          <Text style={styles.guardrailTitle}>Recovery is not laziness.</Text>
          <Text style={styles.guardrailCopy}>CampOS uses recovery to preserve consistency and performance. It does not diagnose illness or replace medical care for severe, worsening, or unexplained symptoms.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ value, label, raw = false }: { value: number; label: string; raw?: boolean }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{raw ? value : `${value}`}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#07090D' },
  container: { padding: 22, paddingBottom: 58, gap: 13 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  eyebrow: { color: '#C89B3C', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: '#F5F2EA', fontSize: 34, lineHeight: 38, fontWeight: '900', marginTop: 4 },
  back: { borderWidth: 1, borderColor: '#303640', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 9 },
  backText: { color: '#9BA2AD', fontWeight: '900', fontSize: 10 },
  hero: { backgroundColor: '#11151B', borderWidth: 1, borderColor: '#3C3320', borderRadius: 24, padding: 20, gap: 13 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLabel: { color: '#C89B3C', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  score: { color: '#F5F2EA', fontSize: 58, fontWeight: '900' },
  badge: { backgroundColor: '#2A2112', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  badgeText: { color: '#E1B75E', fontWeight: '900', fontSize: 10, letterSpacing: 1 },
  heroTitle: { color: '#F4F1EA', fontSize: 24, lineHeight: 29, fontWeight: '900' },
  heroCopy: { color: '#A0A6AF', fontSize: 14, lineHeight: 21 },
  primary: { backgroundColor: '#C89B3C', borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 3 },
  primaryText: { color: '#090B0E', fontWeight: '900', letterSpacing: 0.7, fontSize: 11 },
  section: { color: '#F5F2EA', fontSize: 20, fontWeight: '900', marginTop: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { width: '31%', backgroundColor: '#0E1217', borderWidth: 1, borderColor: '#242A32', borderRadius: 17, padding: 14 },
  metricValue: { color: '#F5F2EA', fontSize: 24, fontWeight: '900' },
  metricLabel: { color: '#717985', fontSize: 8, fontWeight: '900', marginTop: 5 },
  trendCard: { backgroundColor: '#11151B', borderWidth: 1, borderColor: '#2B313A', borderRadius: 20, padding: 17, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trendValue: { color: '#F5F2EA', fontSize: 30, fontWeight: '900', marginTop: 4 },
  trendRight: { alignItems: 'flex-end' }, trendDelta: { color: '#D9B45F', fontWeight: '900', fontSize: 18 }, trendMeta: { color: '#777F8A', fontSize: 10, marginTop: 4 },
  recommendation: { flexDirection: 'row', gap: 12, backgroundColor: '#0E1217', borderWidth: 1, borderColor: '#252C35', borderRadius: 18, padding: 15 },
  number: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#211B11', alignItems: 'center', justifyContent: 'center' },
  numberText: { color: '#E1B75E', fontWeight: '900' }, recommendationCopy: { flex: 1 }, recommendationHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  recommendationTitle: { color: '#F0EEE9', fontWeight: '900', flex: 1 }, minutes: { color: '#D0AA58', fontSize: 9, fontWeight: '900' },
  recommendationDetail: { color: '#969DA7', fontSize: 13, lineHeight: 19, marginTop: 6 }, open: { color: '#C89B3C', fontSize: 9, fontWeight: '900', marginTop: 8 },
  calendarCard: { backgroundColor: '#10130F', borderWidth: 1, borderColor: '#2E3A2D', borderRadius: 20, padding: 17, gap: 13 }, calendarRow: { flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 54 },
  day: { alignItems: 'center', gap: 5 }, dayLabel: { color: '#777F89', fontSize: 9, fontWeight: '900' }, dayDot: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2A2E34', alignItems: 'center', justifyContent: 'center' },
  perform: { backgroundColor: '#2F4A32' }, restore: { backgroundColor: '#4A4028' }, deload: { backgroundColor: '#4A2B2B' }, dayScore: { color: '#F4F1EA', fontSize: 11, fontWeight: '900' }, empty: { color: '#737B86', fontSize: 11 },
  guardrail: { backgroundColor: '#12100C', borderWidth: 1, borderColor: '#403421', borderRadius: 20, padding: 18, gap: 7 }, guardrailTitle: { color: '#EEEAE2', fontSize: 18, fontWeight: '900' }, guardrailCopy: { color: '#A59D91', fontSize: 13, lineHeight: 19 },
});
