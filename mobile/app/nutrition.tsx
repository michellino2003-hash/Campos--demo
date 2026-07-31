import React, { useCallback, useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  buildNutritionStats,
  DEFAULT_NUTRITION_GOALS,
  deleteNutritionEntry,
  getNutritionDay,
  getNutritionGoals,
  saveNutritionEntry,
  saveNutritionGoals,
  type NutritionEntry,
  type NutritionGoals,
} from '../lib/nutrition-storage';

const QUICK_FOODS = [
  { name: 'Egg breakfast', calories: 310, protein: 24 },
  { name: 'Protein shake', calories: 180, protein: 30 },
  { name: 'Chicken & rice', calories: 540, protein: 48 },
  { name: 'Greek yogurt', calories: 140, protein: 15 },
];

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export default function NutritionScreen() {
  const [entries, setEntries] = useState<NutritionEntry[]>([]);
  const [goals, setGoals] = useState<NutritionGoals>(DEFAULT_NUTRITION_GOALS);
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [editingGoals, setEditingGoals] = useState(false);
  const [calorieGoal, setCalorieGoal] = useState(`${DEFAULT_NUTRITION_GOALS.calories}`);
  const [proteinGoal, setProteinGoal] = useState(`${DEFAULT_NUTRITION_GOALS.protein}`);
  const [resetChoice, setResetChoice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [day, savedGoals] = await Promise.all([getNutritionDay(), getNutritionGoals()]);
    setEntries(day.entries);
    setGoals(savedGoals);
    setCalorieGoal(`${savedGoals.calories}`);
    setProteinGoal(`${savedGoals.protein}`);
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const stats = useMemo(() => buildNutritionStats(entries, goals), [entries, goals]);

  const addFood = async (food: { name: string; calories: number; protein: number }) => {
    await saveNutritionEntry({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      loggedAt: new Date().toISOString(),
      name: food.name,
      calories: food.calories,
      protein: food.protein,
    });
    await refresh();
  };

  const addCustom = async () => {
    const calorieValue = Number(calories.trim());
    const proteinValue = Number(protein.trim());
    const cleanName = name.trim();
    if (!cleanName || !Number.isFinite(calorieValue) || calorieValue <= 0 || !Number.isFinite(proteinValue) || proteinValue < 0) return;
    await addFood({ name: cleanName, calories: Math.round(calorieValue), protein: Math.round(proteinValue) });
    setName('');
    setCalories('');
    setProtein('');
  };

  const saveGoals = async () => {
    const caloriesValue = Number(calorieGoal);
    const proteinValue = Number(proteinGoal);
    if (!Number.isFinite(caloriesValue) || caloriesValue < 1000 || caloriesValue > 6000) return;
    if (!Number.isFinite(proteinValue) || proteinValue < 40 || proteinValue > 400) return;
    const next = { calories: Math.round(caloriesValue), protein: Math.round(proteinValue) };
    await saveNutritionGoals(next);
    setGoals(next);
    setEditingGoals(false);
  };

  const removeEntry = async (id: string) => {
    await deleteNutritionEntry(id);
    await refresh();
  };

  const caloriePct = Math.min(100, Math.round(stats.calorieProgress * 100));
  const proteinPct = Math.min(100, Math.round(stats.proteinProgress * 100));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <View><Text style={styles.eyebrow}>CAMPOS FUEL</Text><Text style={styles.title}>Fuel the mission.</Text></View>
          <TouchableOpacity style={styles.back} onPress={() => router.back()}><Text style={styles.backText}>BACK</Text></TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View><Text style={styles.label}>CALORIES</Text><Text style={styles.bigValue}>{stats.calories}</Text><Text style={styles.meta}>of {goals.calories}</Text></View>
            <View style={styles.rightMetric}><Text style={styles.label}>PROTEIN</Text><Text style={styles.proteinValue}>{stats.protein}g</Text><Text style={styles.meta}>of {goals.protein}g</Text></View>
          </View>
          <Progress value={caloriePct} label={`${caloriePct}% calories`} />
          <Progress value={proteinPct} label={`${proteinPct}% protein`} />
          <View style={styles.remainingRow}>
            <Text style={styles.remaining}>{stats.overCalories ? `${stats.calorieDelta} cal over target` : `${stats.caloriesRemaining} cal remaining`}</Text>
            <Text style={styles.remaining}>{stats.proteinRemaining}g protein remaining</Text>
          </View>
          <TouchableOpacity onPress={() => setEditingGoals((value) => !value)}><Text style={styles.goalLink}>{editingGoals ? 'CANCEL GOAL EDIT' : 'ADJUST DAILY GOALS'}</Text></TouchableOpacity>
          {editingGoals ? (
            <View style={styles.goalEdit}>
              <TextInput value={calorieGoal} onChangeText={setCalorieGoal} keyboardType="number-pad" style={styles.goalInput} placeholder="Calories" placeholderTextColor="#5F6670" />
              <TextInput value={proteinGoal} onChangeText={setProteinGoal} keyboardType="number-pad" style={styles.goalInput} placeholder="Protein" placeholderTextColor="#5F6670" />
              <TouchableOpacity style={styles.smallGold} onPress={saveGoals}><Text style={styles.smallGoldText}>SAVE GOALS</Text></TouchableOpacity>
            </View>
          ) : null}
        </View>

        {stats.overCalories ? (
          <View style={styles.resetCard}>
            <Text style={styles.eyebrow}>WIN THE DAY</Text>
            <Text style={styles.resetTitle}>Nothing needs to be “burned off.”</Text>
            <Text style={styles.resetCopy}>One imperfect day does not erase the work. Pick one small action that reinforces the next decision and keep moving forward normally.</Text>
            {['10-minute easy walk', 'Hydrate and reset', 'Prepare the next meal', '5 minutes of light mobility'].map((option) => (
              <TouchableOpacity key={option} style={[styles.resetOption, resetChoice === option && styles.resetOptionActive]} onPress={() => setResetChoice(option)}>
                <Text style={[styles.resetOptionText, resetChoice === option && styles.resetOptionTextActive]}>{resetChoice === option ? '✓ ' : ''}{option}</Text>
              </TouchableOpacity>
            ))}
            {resetChoice ? <Text style={styles.selectedReset}>Selected: {resetChoice}. Do that, then continue the day normally.</Text> : null}
          </View>
        ) : null}

        <Text style={styles.section}>Quick log</Text>
        <View style={styles.quickGrid}>
          {QUICK_FOODS.map((food) => (
            <TouchableOpacity key={food.name} style={styles.quickCard} onPress={() => addFood(food)}>
              <Text style={styles.quickName}>{food.name}</Text>
              <Text style={styles.quickMeta}>{food.calories} cal · {food.protein}g protein</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.section}>Custom food</Text>
        <View style={styles.customCard}>
          <TextInput value={name} onChangeText={setName} style={styles.fullInput} placeholder="Food or meal name" placeholderTextColor="#5F6670" />
          <View style={styles.inputRow}>
            <TextInput value={calories} onChangeText={setCalories} keyboardType="number-pad" style={styles.halfInput} placeholder="Calories" placeholderTextColor="#5F6670" />
            <TextInput value={protein} onChangeText={setProtein} keyboardType="number-pad" style={styles.halfInput} placeholder="Protein g" placeholderTextColor="#5F6670" />
          </View>
          <TouchableOpacity style={styles.primary} onPress={addCustom}><Text style={styles.primaryText}>LOG FOOD</Text></TouchableOpacity>
        </View>

        <Text style={styles.section}>Today’s food</Text>
        {entries.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyTitle}>Nothing logged yet.</Text><Text style={styles.emptyCopy}>Use a quick option or add a custom meal above.</Text></View>
        ) : entries.map((entry) => (
          <View key={entry.id} style={styles.foodRow}>
            <View style={styles.foodCopy}><Text style={styles.foodName}>{entry.name}</Text><Text style={styles.foodMeta}>{formatTime(entry.loggedAt)} · {entry.calories} cal · {entry.protein}g protein</Text></View>
            <TouchableOpacity style={styles.delete} onPress={() => removeEntry(entry.id)}><Text style={styles.deleteText}>REMOVE</Text></TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Progress({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${value}%` }]} /></View>
      <Text style={styles.progressLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#07090D' },
  container: { padding: 22, paddingBottom: 60, gap: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  eyebrow: { color: '#C89B3C', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: '#F5F2EA', fontSize: 34, lineHeight: 38, fontWeight: '900', marginTop: 4 },
  back: { borderWidth: 1, borderColor: '#343B46', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 9 },
  backText: { color: '#A8AFB8', fontSize: 10, fontWeight: '900' },
  hero: { backgroundColor: '#11151B', borderWidth: 1, borderColor: '#2A313B', borderRadius: 24, padding: 20, gap: 13 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  label: { color: '#777F8B', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  bigValue: { color: '#F5F2EA', fontSize: 44, fontWeight: '900', marginTop: 2 },
  rightMetric: { alignItems: 'flex-end' }, proteinValue: { color: '#E1B75E', fontSize: 30, fontWeight: '900', marginTop: 5 }, meta: { color: '#747C87', fontSize: 11 },
  progressWrap: { gap: 5 }, progressTrack: { height: 8, backgroundColor: '#202630', borderRadius: 99, overflow: 'hidden' }, progressFill: { height: '100%', backgroundColor: '#C89B3C', borderRadius: 99 }, progressLabel: { color: '#6F7782', fontSize: 9, fontWeight: '800' },
  remainingRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, remaining: { color: '#A5ABB4', fontSize: 11, flex: 1 }, goalLink: { color: '#C89B3C', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  goalEdit: { flexDirection: 'row', gap: 7, alignItems: 'center' }, goalInput: { flex: 1, backgroundColor: '#0B0F14', borderWidth: 1, borderColor: '#303742', borderRadius: 12, color: '#F3F1EC', padding: 11 }, smallGold: { backgroundColor: '#C89B3C', paddingHorizontal: 11, paddingVertical: 12, borderRadius: 12 }, smallGoldText: { color: '#090B0E', fontSize: 9, fontWeight: '900' },
  resetCard: { backgroundColor: '#13110D', borderWidth: 1, borderColor: '#45381F', borderRadius: 22, padding: 18, gap: 10 }, resetTitle: { color: '#F2EFE8', fontSize: 21, fontWeight: '900' }, resetCopy: { color: '#A69E91', fontSize: 13, lineHeight: 19 }, resetOption: { borderWidth: 1, borderColor: '#33302A', backgroundColor: '#0F0F0E', borderRadius: 14, padding: 13 }, resetOptionActive: { borderColor: '#C89B3C', backgroundColor: '#231E13' }, resetOptionText: { color: '#B9B5AE', fontWeight: '800' }, resetOptionTextActive: { color: '#E7C66F' }, selectedReset: { color: '#B9A97D', fontSize: 12, lineHeight: 18 },
  section: { color: '#F5F2EA', fontSize: 20, fontWeight: '900', marginTop: 12 }, quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, quickCard: { width: '48%', backgroundColor: '#0E1217', borderWidth: 1, borderColor: '#252B34', borderRadius: 17, padding: 14 }, quickName: { color: '#F0EEE9', fontSize: 13, fontWeight: '900' }, quickMeta: { color: '#777F8A', fontSize: 10, marginTop: 6, lineHeight: 15 },
  customCard: { backgroundColor: '#0E1217', borderWidth: 1, borderColor: '#252B34', borderRadius: 18, padding: 14, gap: 9 }, fullInput: { backgroundColor: '#090D12', borderWidth: 1, borderColor: '#303742', borderRadius: 13, color: '#F3F1EC', padding: 13 }, inputRow: { flexDirection: 'row', gap: 8 }, halfInput: { flex: 1, backgroundColor: '#090D12', borderWidth: 1, borderColor: '#303742', borderRadius: 13, color: '#F3F1EC', padding: 13 }, primary: { backgroundColor: '#C89B3C', borderRadius: 14, padding: 14, alignItems: 'center' }, primaryText: { color: '#090B0E', fontWeight: '900', letterSpacing: 0.8 },
  empty: { borderWidth: 1, borderColor: '#242A33', borderRadius: 17, padding: 17 }, emptyTitle: { color: '#EDEAE5', fontWeight: '900' }, emptyCopy: { color: '#777F89', fontSize: 12, marginTop: 5 },
  foodRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0E1217', borderWidth: 1, borderColor: '#242A33', borderRadius: 16, padding: 14 }, foodCopy: { flex: 1 }, foodName: { color: '#F0EEE9', fontWeight: '900' }, foodMeta: { color: '#777F89', fontSize: 10, marginTop: 5 }, delete: { paddingHorizontal: 8, paddingVertical: 8 }, deleteText: { color: '#9A7272', fontSize: 9, fontWeight: '900' },
});
