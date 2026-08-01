import { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import {
  clearActiveWalk,
  getActiveWalk,
  saveActiveWalk,
  saveWalkSession,
  type WalkMood,
} from '../lib/walk-storage';

const MOODS: { key: WalkMood; label: string; cue: string; sound: string }[] = [
  { key: 'upbeat', label: 'Upbeat', cue: 'Walk tall and let the pace feel light, rhythmic, and easy to repeat.', sound: 'Bright instrumentals · energetic beats' },
  { key: 'tired', label: 'Tired', cue: 'No pace target. The win is simply moving and finishing a little better than you started.', sound: 'Low-key instrumentals · soft rhythm' },
  { key: 'calm', label: 'Calm', cue: 'Relax the jaw and shoulders. Use an easy pace with long, quiet exhales.', sound: 'Ambient · mellow electronic' },
  { key: 'reflective', label: 'Reflective', cue: 'Keep the phone down when safe. Let thoughts pass without needing to solve all of them.', sound: 'Cinematic instrumentals · piano' },
  { key: 'focused', label: 'Focused', cue: 'Steady pace. Pick one priority for the rest of the day and return attention to it when your mind wanders.', sound: 'Minimal beats · deep focus' },
];

const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${`${seconds % 60}`.padStart(2, '0')}`;

export default function WalkScreen() {
  const [mood, setMood] = useState<WalkMood>('calm');
  const [targetSeconds, setTargetSeconds] = useState(600);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [finished, setFinished] = useState(false);
  const [saved, setSaved] = useState(false);
  const hydrated = useRef(false);
  const savingCompletion = useRef(false);

  const moodData = useMemo(() => MOODS.find((item) => item.key === mood) ?? MOODS[2], [mood]);
  const progress = Math.min(100, Math.round((elapsedSeconds / targetSeconds) * 100));

  useEffect(() => {
    getActiveWalk().then((active) => {
      if (active) {
        setMood(active.mood);
        setTargetSeconds(active.targetSeconds);
        setElapsedSeconds(active.elapsedSeconds);
        setStartedAt(active.startedAt);
        setRunning(false);
        setRestored(true);
      }
      hydrated.current = true;
    });
  }, []);

  useEffect(() => {
    if (!running || finished) return;
    const timer = setInterval(() => {
      setElapsedSeconds((value) => {
        const next = value + 1;
        if (next >= targetSeconds) {
          setRunning(false);
          setFinished(true);
          return targetSeconds;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running, finished, targetSeconds]);

  useEffect(() => {
    if (!hydrated.current || !startedAt || finished) return;
    saveActiveWalk({ startedAt, mood, targetSeconds, elapsedSeconds, isRunning: running }).catch(() => {});
  }, [elapsedSeconds, finished, mood, running, startedAt, targetSeconds]);

  useEffect(() => {
    if (!finished || savingCompletion.current || saved) return;
    savingCompletion.current = true;
    saveWalkSession({
      id: `${Date.now()}`,
      completedAt: new Date().toISOString(),
      mood,
      durationSeconds: Math.max(elapsedSeconds, 60),
      targetSeconds,
    })
      .then(clearActiveWalk)
      .then(() => setSaved(true))
      .finally(() => { savingCompletion.current = false; });
  }, [elapsedSeconds, finished, mood, saved, targetSeconds]);

  const start = () => {
    if (!startedAt) setStartedAt(new Date().toISOString());
    setFinished(false);
    setSaved(false);
    setRunning(true);
  };

  const finish = () => {
    setRunning(false);
    setFinished(true);
  };

  const exit = async () => {
    setRunning(false);
    if (startedAt && !finished) {
      await saveActiveWalk({ startedAt, mood, targetSeconds, elapsedSeconds, isRunning: false });
    }
    router.back();
  };

  if (finished) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.complete}>
          <View style={styles.victory}><Text style={styles.victoryText}>✓</Text></View>
          <Text style={styles.eyebrow}>WALK COMPLETE</Text>
          <Text style={styles.completeTitle}>You kept the day moving.</Text>
          <Text style={styles.copy}>That walk counts as recovery, consistency, and momentum. No need to turn it into punishment or chase extra work.</Text>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{formatTime(elapsedSeconds)}</Text>
            <Text style={styles.summaryLabel}>{moodData.label.toUpperCase()} WALK · {saved ? 'SAVED' : 'SAVING…'}</Text>
          </View>
          <TouchableOpacity disabled={!saved} style={[styles.primary, !saved && styles.disabled]} onPress={() => router.replace('/coach')}><Text style={styles.primaryText}>{saved ? 'RETURN TO COACH →' : 'SAVING WALK…'}</Text></TouchableOpacity>
          <TouchableOpacity disabled={!saved} style={[styles.secondary, !saved && styles.disabled]} onPress={() => router.replace('/')}><Text style={styles.secondaryText}>HOME</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topRow}>
          <View><Text style={styles.eyebrow}>GUIDED WALK</Text><Text style={styles.title}>{startedAt ? 'Stay with the rhythm.' : 'How do you feel?'}</Text></View>
          <TouchableOpacity style={styles.back} onPress={exit}><Text style={styles.backText}>EXIT</Text></TouchableOpacity>
        </View>

        {restored ? <View style={styles.restored}><Text style={styles.restoredText}>WALK RESTORED · CONTINUE WHEN READY</Text></View> : null}

        {!startedAt ? (
          <>
            <Text style={styles.section}>Choose the walk’s energy</Text>
            <View style={styles.moodGrid}>
              {MOODS.map((item) => (
                <TouchableOpacity key={item.key} style={[styles.moodButton, mood === item.key && styles.moodButtonActive]} onPress={() => setMood(item.key)}>
                  <Text style={[styles.moodText, mood === item.key && styles.moodTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.coachCard}>
              <Text style={styles.cardLabel}>COACH CUE</Text>
              <Text style={styles.coachTitle}>{moodData.cue}</Text>
              <Text style={styles.sound}>MUSIC DIRECTION · {moodData.sound}</Text>
            </View>

            <Text style={styles.section}>Duration</Text>
            <View style={styles.durationRow}>
              {[600, 1200, 1800].map((seconds) => (
                <TouchableOpacity key={seconds} style={[styles.durationButton, targetSeconds === seconds && styles.durationButtonActive]} onPress={() => setTargetSeconds(seconds)}>
                  <Text style={[styles.durationText, targetSeconds === seconds && styles.durationTextActive]}>{seconds / 60} min</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.primary} onPress={start}><Text style={styles.primaryText}>START GUIDED WALK →</Text></TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.timerCard}>
              <Text style={styles.cardLabel}>{moodData.label.toUpperCase()} · {Math.round(targetSeconds / 60)} MIN</Text>
              <Text style={styles.timer}>{formatTime(elapsedSeconds)}</Text>
              <Text style={styles.progress}>{progress}% COMPLETE</Text>
              <View style={styles.track}><View style={[styles.fill, { width: `${progress}%` }]} /></View>
              <Text style={styles.liveCue}>{moodData.cue}</Text>
              <Text style={styles.sound}>MUSIC DIRECTION · {moodData.sound}</Text>
            </View>

            <View style={styles.controls}>
              <TouchableOpacity style={styles.secondaryControl} onPress={() => setElapsedSeconds((value) => Math.max(0, value - 60))}><Text style={styles.secondaryText}>−1 MIN</Text></TouchableOpacity>
              <TouchableOpacity style={styles.primaryControl} onPress={() => setRunning((value) => !value)}><Text style={styles.primaryText}>{running ? 'PAUSE' : 'RESUME'}</Text></TouchableOpacity>
              <TouchableOpacity style={styles.secondaryControl} onPress={() => setElapsedSeconds((value) => Math.min(targetSeconds, value + 60))}><Text style={styles.secondaryText}>+1 MIN</Text></TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.finishButton} onPress={finish}><Text style={styles.finishText}>FINISH WALK</Text></TouchableOpacity>
            <Text style={styles.note}>CampOS records time only here. Step count and distance will be added when device-health permissions are connected.</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#07090D' },
  container: { padding: 22, paddingBottom: 58, gap: 14 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  eyebrow: { color: '#C89B3C', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: '#F5F2EA', fontSize: 34, lineHeight: 38, fontWeight: '900', marginTop: 4 },
  back: { borderWidth: 1, borderColor: '#303640', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 9 },
  backText: { color: '#9BA2AD', fontWeight: '900', fontSize: 10 },
  restored: { backgroundColor: '#142117', borderWidth: 1, borderColor: '#355A3A', borderRadius: 14, padding: 12 },
  restoredText: { color: '#9ED7A8', fontSize: 10, fontWeight: '900', letterSpacing: 0.7, textAlign: 'center' },
  section: { color: '#F5F2EA', fontSize: 20, fontWeight: '900', marginTop: 8 },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  moodButton: { borderWidth: 1, borderColor: '#2C333D', backgroundColor: '#10141A', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 },
  moodButtonActive: { borderColor: '#C89B3C', backgroundColor: '#211B11' },
  moodText: { color: '#9299A4', fontWeight: '800' },
  moodTextActive: { color: '#E3B95E' },
  coachCard: { backgroundColor: '#12100C', borderWidth: 1, borderColor: '#403421', borderRadius: 20, padding: 18, gap: 9 },
  cardLabel: { color: '#C89B3C', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  coachTitle: { color: '#ECE9E2', fontSize: 18, lineHeight: 25, fontWeight: '800' },
  sound: { color: '#7F8792', fontSize: 10, fontWeight: '800', lineHeight: 15 },
  durationRow: { flexDirection: 'row', gap: 9 },
  durationButton: { flex: 1, borderWidth: 1, borderColor: '#303640', borderRadius: 15, padding: 15, alignItems: 'center' },
  durationButtonActive: { borderColor: '#C89B3C', backgroundColor: '#211B11' },
  durationText: { color: '#A0A6AF', fontWeight: '900' },
  durationTextActive: { color: '#E3B95E' },
  primary: { backgroundColor: '#C89B3C', borderRadius: 17, padding: 17, alignItems: 'center', marginTop: 4 },
  primaryText: { color: '#090B0E', fontWeight: '900', letterSpacing: 0.7 },
  disabled: { opacity: 0.5 },
  timerCard: { backgroundColor: '#11151B', borderWidth: 1, borderColor: '#2B313A', borderRadius: 24, padding: 21, gap: 12 },
  timer: { color: '#E1B75E', fontSize: 62, fontWeight: '900', textAlign: 'center', marginTop: 6 },
  progress: { color: '#777F8A', fontSize: 10, fontWeight: '900', textAlign: 'center', letterSpacing: 0.8 },
  track: { height: 8, borderRadius: 99, backgroundColor: '#252B33', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#C89B3C' },
  liveCue: { color: '#D1D4D9', fontSize: 15, lineHeight: 22, marginTop: 4 },
  controls: { flexDirection: 'row', gap: 8 },
  secondaryControl: { flex: 1, borderWidth: 1, borderColor: '#343B46', borderRadius: 15, padding: 14, alignItems: 'center' },
  primaryControl: { flex: 1.4, backgroundColor: '#C89B3C', borderRadius: 15, padding: 14, alignItems: 'center' },
  secondary: { borderWidth: 1, borderColor: '#343B46', borderRadius: 16, padding: 15, alignItems: 'center' },
  secondaryText: { color: '#D6D9DF', fontWeight: '900', fontSize: 10 },
  finishButton: { borderWidth: 1, borderColor: '#4B4028', backgroundColor: '#15120C', borderRadius: 16, padding: 15, alignItems: 'center' },
  finishText: { color: '#D8B15C', fontWeight: '900', letterSpacing: 0.7 },
  note: { color: '#626A76', fontSize: 10, lineHeight: 15, textAlign: 'center' },
  complete: { flex: 1, padding: 24, justifyContent: 'center', gap: 16 },
  victory: { alignSelf: 'center', width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: '#C89B3C', backgroundColor: '#17140E', alignItems: 'center', justifyContent: 'center' },
  victoryText: { color: '#E1B75E', fontSize: 35, fontWeight: '900' },
  completeTitle: { color: '#F5F2EA', fontSize: 36, lineHeight: 40, fontWeight: '900' },
  copy: { color: '#9BA1AA', fontSize: 14, lineHeight: 21 },
  summaryCard: { backgroundColor: '#0E1217', borderWidth: 1, borderColor: '#292F38', borderRadius: 20, padding: 20, alignItems: 'center' },
  summaryValue: { color: '#E3B95E', fontSize: 38, fontWeight: '900' },
  summaryLabel: { color: '#747C87', fontSize: 10, fontWeight: '900', marginTop: 5, letterSpacing: 0.8 },
});
