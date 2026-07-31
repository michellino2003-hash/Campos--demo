import React, { useCallback, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { buildWeightStats, getWeightHistory, saveWeightEntry, type WeightEntry } from '../lib/progress-storage';
import { buildWorkoutStats, getWorkoutHistory, type WorkoutSession } from '../lib/training-storage';

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const formatDuration = (seconds: number) => `${Math.max(1, Math.round(seconds / 60))} min`;

export default function ProgressScreen() {
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [weightInput, setWeightInput] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const [sessions, bodyweight] = await Promise.all([getWorkoutHistory(), getWeightHistory()]);
    setHistory(sessions);
    setWeights(bodyweight);
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const training = buildWorkoutStats(history);
  const body = buildWeightStats(weights);

  const logWeight = async () => {
    const value = Number(weightInput.trim());
    if (!Number.isFinite(value) || value < 80 || value > 500 || saving) return;
    setSaving(true);
    await saveWeightEntry({ id: `${Date.now()}`, recordedAt: new Date().toISOString(), weight: Number(value.toFixed(1)) });
    setWeightInput('');
    await refresh();
    setSaving(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <View><Text style={styles.eyebrow}>CAMPOS PROGRESS</Text><Text style={styles.title}>Built over time.</Text></View>
          <TouchableOpacity style={styles.back} onPress={() => router.back()}><Text style={styles.backText}>BACK</Text></TouchableOpacity>
        </View>

        <Text style={styles.section}>Training record</Text>
        <View style={styles.grid}>
          <Metric value={`${training.currentStreak}`} label="DAY STREAK" />
          <Metric value={`${training.totalMissions}`} label="MISSIONS" />
          <Metric value={`${training.totalMinutes}`} label="MINUTES" />
          <Metric value={training.averageEffort ? `${training.averageEffort}` : '—'} label="AVG RPE" />
        </View>

        <View style={styles.weekCard}>
          <View><Text style={styles.cardLabel}>THIS WEEK</Text><Text style={styles.weekValue}>{training.thisWeekMissions} missions</Text></View>
          <View style={styles.weekStats}><Text style={styles.weekStat}>{training.thisWeekActiveDays} active days</Text><Text style={styles.weekStat}>{training.thisWeekMinutes} min trained</Text></View>
        </View>

        <Text style={styles.section}>Bodyweight</Text>
        <View style={styles.weightCard}>
          <View style={styles.weightTop}>
            <View><Text style={styles.cardLabel}>CURRENT</Text><Text style={styles.weightValue}>{body.current ? `${body.current.toFixed(1)} lb` : '—'}</Text></View>
            <View style={styles.changeWrap}><Text style={styles.change}>{body.current ? `${body.change > 0 ? '+' : ''}${body.change.toFixed(1)} lb` : 'NO DATA'}</Text><Text style={styles.changeLabel}>{body.trend.toUpperCase()}</Text></View>
          </View>
          {body.current ? <Text style={styles.weightMeta}>Starting record: {body.starting.toFixed(1)} lb · {weights.length} check-ins</Text> : <Text style={styles.weightMeta}>Log your first weigh-in to begin the trend.</Text>}
          <View style={styles.inputRow}>
            <TextInput value={weightInput} onChangeText={setWeightInput} keyboardType="decimal-pad" placeholder="190.0" placeholderTextColor="#59616D" style={styles.input} />
            <TouchableOpacity style={styles.logButton} onPress={logWeight}><Text style={styles.logButtonText}>{saving ? 'SAVING' : 'LOG'}</Text></TouchableOpacity>
          </View>
        </View>

        {weights.length > 0 ? <>
          <Text style={styles.subsection}>Recent weigh-ins</Text>
          {weights.slice(0, 5).map((entry) => <View key={entry.id} style={styles.listRow}><Text style={styles.listPrimary}>{entry.weight.toFixed(1)} lb</Text><Text style={styles.listSecondary}>{formatDate(entry.recordedAt)}</Text></View>)}
        </> : null}

        <Text style={styles.section}>Workout history</Text>
        {history.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>Your record starts with the first mission.</Text><Text style={styles.emptyText}>Completed workouts will appear here automatically.</Text></View> : history.slice(0, 12).map((session) => (
          <View key={session.id} style={styles.sessionCard}>
            <View style={styles.sessionTop}><Text style={styles.sessionTitle}>{session.title}</Text><Text style={styles.rpe}>RPE {session.effort}</Text></View>
            <Text style={styles.sessionCategory}>{session.category}</Text>
            <View style={styles.sessionMeta}><Text style={styles.metaText}>{formatDate(session.completedAt)}</Text><Text style={styles.metaText}>{formatDuration(session.durationSeconds)}</Text><Text style={styles.metaText}>{session.blocksCompleted}/{session.totalBlocks} blocks</Text></View>
          </View>
        ))}

        <Text style={styles.footer}>Every completed mission becomes evidence.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#07090D' }, container: { padding: 22, paddingBottom: 56, gap: 12 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, eyebrow: { color: '#C89B3C', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 }, title: { color: '#F5F2EA', fontSize: 32, fontWeight: '900', marginTop: 4 },
  back: { borderWidth: 1, borderColor: '#333A45', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 9 }, backText: { color: '#A5ABB5', fontSize: 11, fontWeight: '900' },
  section: { color: '#F5F2EA', fontSize: 20, fontWeight: '900', marginTop: 14 }, subsection: { color: '#D9D7D1', fontSize: 15, fontWeight: '900', marginTop: 5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, metric: { width: '48%', backgroundColor: '#0E1217', borderWidth: 1, borderColor: '#232933', borderRadius: 18, padding: 16 }, metricValue: { color: '#F5F2EA', fontSize: 28, fontWeight: '900' }, metricLabel: { color: '#717985', fontSize: 9, fontWeight: '900', marginTop: 5 },
  weekCard: { backgroundColor: '#11151B', borderWidth: 1, borderColor: '#2B313A', borderRadius: 20, padding: 17, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, cardLabel: { color: '#858C98', fontSize: 10, fontWeight: '900', letterSpacing: 1 }, weekValue: { color: '#F5F2EA', fontSize: 20, fontWeight: '900', marginTop: 5 }, weekStats: { alignItems: 'flex-end', gap: 4 }, weekStat: { color: '#8F96A1', fontSize: 11, fontWeight: '700' },
  weightCard: { backgroundColor: '#11100D', borderWidth: 1, borderColor: '#3C3221', borderRadius: 22, padding: 18, gap: 13 }, weightTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, weightValue: { color: '#F5F2EA', fontSize: 30, fontWeight: '900', marginTop: 4 }, changeWrap: { alignItems: 'flex-end' }, change: { color: '#E1B75E', fontSize: 18, fontWeight: '900' }, changeLabel: { color: '#776B55', fontSize: 8, fontWeight: '900', marginTop: 3 }, weightMeta: { color: '#8E8A80', fontSize: 12 },
  inputRow: { flexDirection: 'row', gap: 9 }, input: { flex: 1, backgroundColor: '#0B0D10', borderWidth: 1, borderColor: '#303640', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, color: '#F5F2EA', fontSize: 18, fontWeight: '800' }, logButton: { backgroundColor: '#C89B3C', borderRadius: 14, paddingHorizontal: 22, justifyContent: 'center' }, logButtonText: { color: '#090B0E', fontWeight: '900' },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#0E1217', borderWidth: 1, borderColor: '#232933', borderRadius: 14, padding: 14 }, listPrimary: { color: '#EDEBE6', fontWeight: '900' }, listSecondary: { color: '#787F89', fontSize: 12 },
  sessionCard: { backgroundColor: '#0E1217', borderWidth: 1, borderColor: '#232933', borderRadius: 18, padding: 16 }, sessionTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, sessionTitle: { color: '#F0EEE9', fontSize: 15, fontWeight: '900', flex: 1 }, rpe: { color: '#D1A956', fontSize: 11, fontWeight: '900' }, sessionCategory: { color: '#737B87', fontSize: 10, fontWeight: '900', marginTop: 4 }, sessionMeta: { flexDirection: 'row', gap: 12, marginTop: 12, flexWrap: 'wrap' }, metaText: { color: '#9299A4', fontSize: 11 },
  empty: { borderWidth: 1, borderColor: '#272E37', borderRadius: 18, padding: 18 }, emptyTitle: { color: '#EDEBE6', fontWeight: '900' }, emptyText: { color: '#7D8590', fontSize: 12, marginTop: 6, lineHeight: 18 }, footer: { color: '#626A76', textAlign: 'center', marginTop: 14, fontSize: 11 },
});
