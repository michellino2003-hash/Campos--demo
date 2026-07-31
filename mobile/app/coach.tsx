import React, { useCallback, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { calculateReadiness, type ReadinessSignals, type SessionPrescription } from '../lib/adaptive-coach';
import { getReadiness } from '../lib/readiness-storage';
import { buildWeightStats, getWeightHistory } from '../lib/progress-storage';
import { buildWorkoutStats, getActiveWorkoutSession, getWorkoutHistory } from '../lib/training-storage';
import { buildNutritionStats, getNutritionDay, getNutritionGoals } from '../lib/nutrition-storage';

const DEFAULT_SIGNALS: ReadinessSignals = { sleep: 75, energy: 7, soreness: 3, stress: 4, jointComfort: 8, pain: 0 };

type TrainingStats = ReturnType<typeof buildWorkoutStats>;
type WeightStats = ReturnType<typeof buildWeightStats>;
type NutritionStats = ReturnType<typeof buildNutritionStats>;

const EMPTY_TRAINING: TrainingStats = { totalMissions: 0, totalMinutes: 0, averageEffort: 0, activeDays: 0, currentStreak: 0, thisWeekMissions: 0, thisWeekActiveDays: 0, thisWeekMinutes: 0 };
const EMPTY_WEIGHT: WeightStats = { current: 0, starting: 0, change: 0, trend: 'No data' };
const EMPTY_NUTRITION: NutritionStats = { calories: 0, protein: 0, carbs: 0, fat: 0, caloriesRemaining: 0, proteinRemaining: 0, calorieProgress: 0, proteinProgress: 0, overCalories: false, calorieDelta: 0 };

export default function CoachScreen() {
  const [prescription, setPrescription] = useState<SessionPrescription>(() => calculateReadiness(DEFAULT_SIGNALS));
  const [training, setTraining] = useState<TrainingStats>(EMPTY_TRAINING);
  const [weight, setWeight] = useState<WeightStats>(EMPTY_WEIGHT);
  const [nutrition, setNutrition] = useState<NutritionStats>(EMPTY_NUTRITION);
  const [hasActiveSession, setHasActiveSession] = useState(false);

  const refresh = useCallback(async () => {
    const [readiness, history, weights, active, nutritionDay, nutritionGoals] = await Promise.all([
      getReadiness(),
      getWorkoutHistory(),
      getWeightHistory(),
      getActiveWorkoutSession(),
      getNutritionDay(),
      getNutritionGoals(),
    ]);
    setPrescription(readiness?.prescription ?? calculateReadiness(DEFAULT_SIGNALS));
    setTraining(buildWorkoutStats(history));
    setWeight(buildWeightStats(weights));
    setNutrition(buildNutritionStats(nutritionDay.entries, nutritionGoals));
    setHasActiveSession(Boolean(active));
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const decision = useMemo(() => {
    if (hasActiveSession) return { title: 'Finish the mission already in progress.', detail: 'CampOS saved your exact block, timer, completed work, and live adaptations.', action: 'RESUME MISSION', route: '/workout' as const };
    if (prescription.stopForPain) return { title: 'Recovery is the mission today.', detail: 'High pain overrides the normal plan. Keep movement pain-free and do not force loaded work.', action: 'VIEW READINESS', route: '/' as const };
    if (prescription.mode === 'recover') return { title: 'Preserve the habit without creating more fatigue.', detail: 'Your readiness signals favor a reduced technical session. Showing up still counts.', action: 'START RECOVERY SESSION', route: '/workout' as const };
    if (training.totalMissions === 0) return { title: 'Create the first piece of evidence.', detail: 'Complete one guided mission so CampOS can begin learning from real training history.', action: 'START FIRST MISSION', route: '/workout' as const };
    if (training.thisWeekMissions === 0) return { title: 'Put the first win on this week.', detail: 'Your history exists. Now re-establish momentum with one controlled mission.', action: 'START MISSION', route: '/workout' as const };
    if (prescription.mode === 'push') return { title: 'Use the extra capacity—without chasing failure.', detail: 'Recovery supports a performance day. Press pace only while movement stays sharp.', action: 'START PERFORMANCE DAY', route: '/workout' as const };
    return { title: 'Execute the planned work cleanly.', detail: 'Readiness is stable. The highest-value move is a controlled session followed by normal recovery.', action: 'START GUIDED MISSION', route: '/workout' as const };
  }, [hasActiveSession, prescription, training]);

  const fuelDecision = useMemo(() => {
    if (nutrition.overCalories) {
      return {
        title: 'No compensation required.',
        detail: `Today is ${nutrition.calorieDelta} calories above the current target. Do not add punishment cardio or skip meals. Choose one small reset action and continue normally.`,
      };
    }
    if (nutrition.proteinRemaining > 30) {
      return {
        title: 'Protein is the clearest fuel gap.',
        detail: `${nutrition.proteinRemaining}g remains against today’s protein target. Use the Fuel screen to finish the day with a normal protein-forward meal or snack.`,
      };
    }
    if (nutrition.calories === 0) {
      return {
        title: 'Fuel data is still empty today.',
        detail: 'Log a meal when convenient. CampOS can give better context once it knows what has actually been eaten.',
      };
    }
    return {
      title: 'Fueling is in a workable range.',
      detail: 'Keep eating normally, hydrate, and avoid trying to make the day perfect. Consistency matters more than a single number.',
    };
  }, [nutrition]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topRow}>
          <View><Text style={styles.eyebrow}>CAMPOS COACH</Text><Text style={styles.title}>Next best action.</Text></View>
          <TouchableOpacity style={styles.back} onPress={() => router.back()}><Text style={styles.backText}>BACK</Text></TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View><Text style={styles.cardLabel}>READINESS</Text><Text style={styles.score}>{prescription.score}</Text></View>
            <View style={styles.badge}><Text style={styles.badgeText}>{prescription.mode.toUpperCase()}</Text></View>
          </View>
          <Text style={styles.heroTitle}>{decision.title}</Text>
          <Text style={styles.heroCopy}>{decision.detail}</Text>
          <TouchableOpacity style={styles.primary} onPress={() => router.push(decision.route)}><Text style={styles.primaryText}>{decision.action} →</Text></TouchableOpacity>
        </View>

        <Text style={styles.section}>Why CampOS chose this</Text>
        {prescription.reasons.map((reason, index) => (
          <View key={`${reason}-${index}`} style={styles.reasonRow}><View style={styles.reasonNumber}><Text style={styles.reasonNumberText}>{index + 1}</Text></View><Text style={styles.reasonText}>{reason}</Text></View>
        ))}

        <Text style={styles.section}>Current signals</Text>
        <View style={styles.grid}>
          <Metric value={`${training.currentStreak}`} label="DAY STREAK" />
          <Metric value={`${training.thisWeekMissions}`} label="WEEK MISSIONS" />
          <Metric value={training.averageEffort ? `${training.averageEffort}` : '—'} label="AVG RPE" />
          <Metric value={weight.current ? `${weight.current.toFixed(1)}` : '—'} label="BODYWEIGHT" />
          <Metric value={`${nutrition.calories}`} label="CALORIES" />
          <Metric value={`${nutrition.protein}g`} label="PROTEIN" />
        </View>

        <TouchableOpacity activeOpacity={0.85} style={styles.fuelCard} onPress={() => router.push('/nutrition')}>
          <View style={styles.fuelHeader}><Text style={styles.guardrailLabel}>FUEL READ</Text><Text style={styles.fuelLink}>OPEN FUEL →</Text></View>
          <Text style={styles.guardrailTitle}>{fuelDecision.title}</Text>
          <Text style={styles.guardrailCopy}>{fuelDecision.detail}</Text>
        </TouchableOpacity>

        <View style={styles.guardrail}>
          <Text style={styles.guardrailLabel}>COACH GUARDRAIL</Text>
          <Text style={styles.guardrailTitle}>{prescription.stopForPain ? 'Pain overrides ambition.' : 'Progress without blind pushing.'}</Text>
          <Text style={styles.guardrailCopy}>{prescription.stopForPain ? 'CampOS will not recommend loaded training when the pain signal crosses the safety threshold.' : 'During the workout, effort, breathing, pain, and technique can automatically reduce the remaining prescription.'}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.secondary} onPress={() => router.push('/')}><Text style={styles.secondaryText}>UPDATE READINESS</Text></TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={() => router.push('/nutrition')}><Text style={styles.secondaryText}>VIEW FUEL</Text></TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={() => router.push('/progress')}><Text style={styles.secondaryText}>VIEW PROGRESS</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#07090D' },
  container: { padding: 22, paddingBottom: 58, gap: 13 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: '#C89B3C', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: '#F5F2EA', fontSize: 34, lineHeight: 38, fontWeight: '900', marginTop: 4 },
  back: { borderWidth: 1, borderColor: '#303640', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 9 },
  backText: { color: '#9BA2AD', fontWeight: '900', fontSize: 10 },
  hero: { backgroundColor: '#11151B', borderWidth: 1, borderColor: '#3C3320', borderRadius: 24, padding: 20, gap: 13 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLabel: { color: '#777F8B', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  score: { color: '#F5F2EA', fontSize: 50, fontWeight: '900' },
  badge: { backgroundColor: '#2A2112', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  badgeText: { color: '#E1B75E', fontWeight: '900', fontSize: 10, letterSpacing: 1 },
  heroTitle: { color: '#F4F1EA', fontSize: 24, lineHeight: 29, fontWeight: '900' },
  heroCopy: { color: '#A0A6AF', fontSize: 14, lineHeight: 21 },
  primary: { backgroundColor: '#C89B3C', borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 3 },
  primaryText: { color: '#090B0E', fontWeight: '900', letterSpacing: 0.7 },
  section: { color: '#F5F2EA', fontSize: 20, fontWeight: '900', marginTop: 11 },
  reasonRow: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#0E1217', borderWidth: 1, borderColor: '#242A32', borderRadius: 17, padding: 14 },
  reasonNumber: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#211B11', alignItems: 'center', justifyContent: 'center' },
  reasonNumberText: { color: '#DDB45C', fontWeight: '900' },
  reasonText: { flex: 1, color: '#B7BCC4', fontSize: 13, lineHeight: 19 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { width: '48%', backgroundColor: '#0E1217', borderWidth: 1, borderColor: '#242A32', borderRadius: 18, padding: 16 },
  metricValue: { color: '#F5F2EA', fontSize: 25, fontWeight: '900' },
  metricLabel: { color: '#717985', fontSize: 9, fontWeight: '900', marginTop: 5 },
  fuelCard: { backgroundColor: '#101510', borderWidth: 1, borderColor: '#304130', borderRadius: 20, padding: 18, gap: 7, marginTop: 4 },
  fuelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, fuelLink: { color: '#99B69A', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  guardrail: { backgroundColor: '#12100C', borderWidth: 1, borderColor: '#403421', borderRadius: 20, padding: 18, gap: 7, marginTop: 4 },
  guardrailLabel: { color: '#C89B3C', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  guardrailTitle: { color: '#EEEAE2', fontSize: 18, fontWeight: '900' },
  guardrailCopy: { color: '#A59D91', fontSize: 13, lineHeight: 19 },
  actions: { gap: 9 },
  secondary: { borderWidth: 1, borderColor: '#343B46', borderRadius: 16, padding: 15, alignItems: 'center' },
  secondaryText: { color: '#D6D9DF', fontWeight: '900', fontSize: 11, letterSpacing: 0.7 },
});
