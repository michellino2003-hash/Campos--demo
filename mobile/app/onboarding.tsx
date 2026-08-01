import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import {
  DEFAULT_ATHLETE_PROFILE,
  getAthleteProfile,
  saveAthleteProfile,
  type AthleteProfile,
  type EquipmentKey,
  type ExperienceLevel,
  type GoalMode,
  type TrainingPriority,
} from '../lib/athlete-profile';

type Draft = Omit<AthleteProfile, 'version' | 'updatedAt'>;

const GOALS: Array<{ key: GoalMode; label: string; copy: string }> = [
  { key: 'cut', label: 'Cut', copy: 'Reduce body fat while protecting performance.' },
  { key: 'maintain', label: 'Maintain', copy: 'Build consistency and performance around a stable bodyweight.' },
  { key: 'build', label: 'Build', copy: 'Prioritize muscle, strength and recovery while keeping boxing sharp.' },
];

const PRIORITIES: Array<{ key: TrainingPriority; label: string }> = [
  { key: 'boxing', label: 'Boxing' },
  { key: 'conditioning', label: 'Conditioning' },
  { key: 'physique', label: 'Physique' },
  { key: 'strength', label: 'Strength' },
];

const EQUIPMENT: Array<{ key: EquipmentKey; label: string }> = [
  { key: 'heavy-bag', label: 'Heavy bag' },
  { key: 'gym', label: 'Full gym' },
  { key: 'dumbbells', label: 'Dumbbells' },
  { key: 'bodyweight', label: 'Bodyweight' },
];

export default function OnboardingScreen() {
  const [draft, setDraft] = useState<Draft>({ ...DEFAULT_ATHLETE_PROFILE, completed: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAthleteProfile().then((profile) => {
      setDraft({
        completed: profile.completed,
        displayName: profile.displayName,
        goalMode: profile.goalMode,
        experience: profile.experience,
        primaryPriority: profile.primaryPriority,
        trainingDaysPerWeek: profile.trainingDaysPerWeek,
        sessionMinutes: profile.sessionMinutes,
        equipment: profile.equipment,
      });
    });
  }, []);

  const toggleEquipment = (key: EquipmentKey) => {
    setDraft((current) => {
      const exists = current.equipment.includes(key);
      const next = exists ? current.equipment.filter((item) => item !== key) : [...current.equipment, key];
      return { ...current, equipment: next.length ? next : ['bodyweight'] };
    });
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    await saveAthleteProfile({ ...draft, completed: true });
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <View><Text style={styles.eyebrow}>BUILD YOUR CAMP</Text><Text style={styles.title}>Make CampOS yours.</Text></View>
          {draft.completed ? <TouchableOpacity style={styles.back} onPress={() => router.back()}><Text style={styles.backText}>BACK</Text></TouchableOpacity> : null}
        </View>
        <Text style={styles.intro}>This profile controls how CampOS shapes session length, boxing volume, equipment choices, and coaching priorities.</Text>

        <Section title="What should we call you?">
          <TextInput value={draft.displayName} onChangeText={(displayName) => setDraft((current) => ({ ...current, displayName }))} placeholder="First name" placeholderTextColor="#5E6672" style={styles.input} />
        </Section>

        <Section title="Current goal">
          {GOALS.map((item) => <Choice key={item.key} active={draft.goalMode === item.key} title={item.label} copy={item.copy} onPress={() => setDraft((current) => ({ ...current, goalMode: item.key }))} />)}
        </Section>

        <Section title="Experience">
          <View style={styles.segmentRow}>
            {(['beginner', 'intermediate', 'advanced'] as ExperienceLevel[]).map((value) => <Pill key={value} active={draft.experience === value} label={value} onPress={() => setDraft((current) => ({ ...current, experience: value }))} />)}
          </View>
        </Section>

        <Section title="Primary training priority">
          <View style={styles.segmentRow}>
            {PRIORITIES.map((item) => <Pill key={item.key} active={draft.primaryPriority === item.key} label={item.label} onPress={() => setDraft((current) => ({ ...current, primaryPriority: item.key }))} />)}
          </View>
        </Section>

        <Section title="Training days per week">
          <View style={styles.segmentRow}>
            {[2, 3, 4, 5, 6].map((value) => <Pill key={value} active={draft.trainingDaysPerWeek === value} label={`${value}`} onPress={() => setDraft((current) => ({ ...current, trainingDaysPerWeek: value }))} />)}
          </View>
        </Section>

        <Section title="Typical session length">
          <View style={styles.segmentRow}>
            {([30, 45, 60, 75] as const).map((value) => <Pill key={value} active={draft.sessionMinutes === value} label={`${value} min`} onPress={() => setDraft((current) => ({ ...current, sessionMinutes: value }))} />)}
          </View>
        </Section>

        <Section title="Equipment you can reliably use">
          <View style={styles.segmentRow}>
            {EQUIPMENT.map((item) => <Pill key={item.key} active={draft.equipment.includes(item.key)} label={item.label} onPress={() => toggleEquipment(item.key)} />)}
          </View>
        </Section>

        <View style={styles.summary}>
          <Text style={styles.eyebrow}>CAMP PREVIEW</Text>
          <Text style={styles.summaryTitle}>{draft.primaryPriority.toUpperCase()} FIRST · {draft.sessionMinutes} MIN</Text>
          <Text style={styles.summaryCopy}>{draft.trainingDaysPerWeek} training days/week · {draft.experience} · {draft.goalMode} · {draft.equipment.length} equipment option{draft.equipment.length === 1 ? '' : 's'}</Text>
        </View>

        <TouchableOpacity style={styles.primary} onPress={save}><Text style={styles.primaryText}>{saving ? 'BUILDING CAMP…' : draft.completed ? 'SAVE PROFILE →' : 'BUILD MY CAMP →'}</Text></TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function Choice({ active, title, copy, onPress }: { active: boolean; title: string; copy: string; onPress: () => void }) {
  return <TouchableOpacity style={[styles.choice, active && styles.choiceActive]} onPress={onPress}><View style={styles.choiceTop}><Text style={[styles.choiceTitle, active && styles.choiceTitleActive]}>{title}</Text><Text style={styles.check}>{active ? '✓' : ''}</Text></View><Text style={styles.choiceCopy}>{copy}</Text></TouchableOpacity>;
}

function Pill({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <TouchableOpacity style={[styles.pill, active && styles.pillActive]} onPress={onPress}><Text style={[styles.pillText, active && styles.pillTextActive]}>{label.toUpperCase()}</Text></TouchableOpacity>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#07090D' }, container: { padding: 22, paddingBottom: 60, gap: 18 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, eyebrow: { color: '#C89B3C', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 }, title: { color: '#F5F2EA', fontSize: 34, lineHeight: 38, fontWeight: '900', marginTop: 4 },
  back: { borderWidth: 1, borderColor: '#303640', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 9 }, backText: { color: '#9BA2AD', fontWeight: '900', fontSize: 10 },
  intro: { color: '#999FA9', fontSize: 14, lineHeight: 21 }, section: { gap: 10 }, sectionTitle: { color: '#EFEDE8', fontSize: 18, fontWeight: '900' },
  input: { backgroundColor: '#0E1217', borderWidth: 1, borderColor: '#29303A', borderRadius: 16, paddingHorizontal: 15, paddingVertical: 14, color: '#F5F2EA', fontSize: 17, fontWeight: '800' },
  choice: { backgroundColor: '#0E1217', borderWidth: 1, borderColor: '#252C35', borderRadius: 17, padding: 15, gap: 6 }, choiceActive: { borderColor: '#6D592F', backgroundColor: '#17140E' }, choiceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, choiceTitle: { color: '#B5BBC4', fontSize: 16, fontWeight: '900' }, choiceTitleActive: { color: '#E3B95E' }, check: { color: '#E3B95E', fontWeight: '900' }, choiceCopy: { color: '#767E89', fontSize: 12, lineHeight: 18 },
  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, pill: { borderWidth: 1, borderColor: '#303741', backgroundColor: '#10141A', borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11 }, pillActive: { borderColor: '#C89B3C', backgroundColor: '#211B11' }, pillText: { color: '#8F97A2', fontSize: 10, fontWeight: '900' }, pillTextActive: { color: '#E3B95E' },
  summary: { backgroundColor: '#12100C', borderWidth: 1, borderColor: '#403421', borderRadius: 20, padding: 18, gap: 7 }, summaryTitle: { color: '#F1EEE7', fontSize: 20, fontWeight: '900' }, summaryCopy: { color: '#999184', fontSize: 13, lineHeight: 19 },
  primary: { backgroundColor: '#C89B3C', borderRadius: 17, padding: 17, alignItems: 'center' }, primaryText: { color: '#090B0E', fontWeight: '900', letterSpacing: 0.8 },
});
