import { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import {
  adaptRemainingWorkout,
  adaptiveSessionMinutes,
  buildAdaptiveWorkout,
  type LiveSessionFeedback,
} from '../lib/adaptive-workout';
import { getReadiness } from '../lib/readiness-storage';
import {
  clearActiveWorkoutSession,
  getActiveWorkoutSession,
  saveActiveWorkoutSession,
  saveWorkoutSession,
  type LiveSessionAdaptation,
} from '../lib/training-storage';

const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${`${seconds % 60}`.padStart(2, '0')}`;

const DEFAULT_FEEDBACK: LiveSessionFeedback = {
  effort: 3,
  technique: 'sharp',
  pain: 'none',
  breathing: 'controlled',
};

export default function WorkoutScreen() {
  const [blocks, setBlocks] = useState(() => buildAdaptiveWorkout(null));
  const [activeBlock, setActiveBlock] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(blocks[0].duration);
  const [completedBlocks, setCompletedBlocks] = useState<number[]>([]);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState(new Date().toISOString());
  const [restored, setRestored] = useState(false);
  const [finished, setFinished] = useState(false);
  const [effort, setEffort] = useState(7);
  const [saving, setSaving] = useState(false);
  const [checkIn, setCheckIn] = useState(false);
  const [feedback, setFeedback] = useState<LiveSessionFeedback>(DEFAULT_FEEDBACK);
  const [adaptations, setAdaptations] = useState<LiveSessionAdaptation[]>([]);
  const [liveCoachMessage, setLiveCoachMessage] = useState<string | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    Promise.all([getReadiness(), getActiveWorkoutSession()]).then(([readiness, active]) => {
      let nextBlocks = buildAdaptiveWorkout(readiness?.prescription ?? null);
      const restoredAdaptations = active?.adaptations ?? [];
      restoredAdaptations.forEach((adaptation) => {
        nextBlocks = adaptRemainingWorkout(nextBlocks, adaptation.afterBlock, adaptation.feedback).blocks;
      });
      setBlocks(nextBlocks);
      setAdaptations(restoredAdaptations);

      if (active && active.activeBlock < nextBlocks.length) {
        setActiveBlock(active.activeBlock);
        setSecondsLeft(active.secondsLeft);
        setCompletedBlocks(active.completedBlocks.filter((index) => index < nextBlocks.length));
        setSessionSeconds(active.sessionSeconds);
        setStartedAt(active.startedAt);
        setRunning(false);
        setRestored(true);
      } else {
        setSecondsLeft(nextBlocks[0].duration);
        setRunning(true);
      }
      hydrated.current = true;
    });
  }, []);

  useEffect(() => {
    if (!running || finished || checkIn) return;
    const timer = setInterval(() => {
      setSessionSeconds((value) => value + 1);
      setSecondsLeft((value) => {
        if (value <= 1) {
          setRunning(false);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running, finished, checkIn]);

  useEffect(() => {
    if (!hydrated.current || finished || checkIn) return;
    saveActiveWorkoutSession({
      startedAt,
      title: 'Speed, precision & strength',
      category: 'BOXING + UPPER BODY',
      activeBlock,
      secondsLeft,
      completedBlocks,
      sessionSeconds,
      isRunning: running,
      adaptations,
    }).catch(() => {});
  }, [activeBlock, adaptations, checkIn, completedBlocks, finished, running, secondsLeft, sessionSeconds, startedAt]);

  const progress = useMemo(() => Math.round((completedBlocks.length / blocks.length) * 100), [blocks.length, completedBlocks.length]);
  const block = blocks[activeBlock];

  const advanceToNextBlock = (nextBlocks = blocks) => {
    const next = activeBlock + 1;
    if (next >= nextBlocks.length) {
      setRunning(false);
      setFinished(true);
      return;
    }
    setActiveBlock(next);
    setSecondsLeft(nextBlocks[next].duration);
    setRunning(true);
  };

  const completeBlock = () => {
    const nextCompleted = completedBlocks.includes(activeBlock) ? completedBlocks : [...completedBlocks, activeBlock];
    setCompletedBlocks(nextCompleted);

    if (activeBlock === blocks.length - 1) {
      setRunning(false);
      setCompletedBlocks(blocks.map((_, index) => index));
      setFinished(true);
      return;
    }

    if (block.type === 'boxing' || block.type === 'strength') {
      setRunning(false);
      setFeedback(DEFAULT_FEEDBACK);
      setCheckIn(true);
      return;
    }

    advanceToNextBlock();
  };

  const applyLiveCheckIn = () => {
    const result = adaptRemainingWorkout(blocks, activeBlock, feedback);
    const nextAdaptations = [...adaptations, { afterBlock: activeBlock, feedback }];
    setBlocks(result.blocks);
    setAdaptations(nextAdaptations);
    setLiveCoachMessage(result.adjustment.message);
    setCheckIn(false);
    advanceToNextBlock(result.blocks);
  };

  const saveMission = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await saveWorkoutSession({
        id: `${Date.now()}`,
        completedAt: new Date().toISOString(),
        title: 'Speed, precision & strength',
        category: 'BOXING + UPPER BODY',
        durationSeconds: Math.max(sessionSeconds, 60),
        blocksCompleted: blocks.length,
        totalBlocks: blocks.length,
        effort,
      });
      await clearActiveWorkoutSession();
      router.replace('/progress');
    } finally {
      setSaving(false);
    }
  };

  const exit = async () => {
    setRunning(false);
    await saveActiveWorkoutSession({
      startedAt,
      title: 'Speed, precision & strength',
      category: 'BOXING + UPPER BODY',
      activeBlock,
      secondsLeft,
      completedBlocks,
      sessionSeconds,
      isRunning: false,
      adaptations,
    });
    router.back();
  };

  if (checkIn) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.checkInContainer}>
          <Text style={styles.eyebrow}>LIVE COACH CHECK-IN</Text>
          <Text style={styles.completeTitle}>How is the session actually going?</Text>
          <Text style={styles.completeCopy}>CampOS will use this to change the work that remains—not just record it after the fact.</Text>

          <FeedbackGroup title="EFFORT" options={[1, 2, 3, 4, 5]} value={feedback.effort} onChange={(value) => setFeedback((current) => ({ ...current, effort: value as LiveSessionFeedback['effort'] }))} />
          <FeedbackGroup title="TECHNIQUE" options={['sharp', 'slipping', 'breaking-down']} value={feedback.technique} onChange={(value) => setFeedback((current) => ({ ...current, technique: value as LiveSessionFeedback['technique'] }))} />
          <FeedbackGroup title="PAIN" options={['none', 'mild', 'rising']} value={feedback.pain} onChange={(value) => setFeedback((current) => ({ ...current, pain: value as LiveSessionFeedback['pain'] }))} />
          <FeedbackGroup title="BREATHING" options={['controlled', 'working', 'struggling']} value={feedback.breathing} onChange={(value) => setFeedback((current) => ({ ...current, breathing: value as LiveSessionFeedback['breathing'] }))} />

          <View style={styles.coachCard}>
            <Text style={styles.completeEyebrow}>WHY THIS MATTERS</Text>
            <Text style={styles.coachTitle}>The plan should respond before form collapses.</Text>
            <Text style={styles.coachCopy}>If pain rises, technique breaks down, or breathing becomes uncontrolled, CampOS can cut volume, cap power, add recovery, or end loaded work.</Text>
          </View>

          <TouchableOpacity style={styles.primary} onPress={applyLiveCheckIn}><Text style={styles.primaryText}>APPLY COACH DECISION →</Text></TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (finished) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.completeContainer}>
          <View style={styles.victory}><Text style={styles.victoryText}>✓</Text></View>
          <Text style={styles.completeEyebrow}>MISSION COMPLETE</Text>
          <Text style={styles.completeTitle}>Another promise kept.</Text>
          <Text style={styles.completeCopy}>You completed the prescription. Rate the session so CampOS can build a more useful training history instead of guessing how the work felt.</Text>

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>SESSION TIME</Text><Text style={styles.summaryValue}>{formatTime(sessionSeconds)}</Text></View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>BLOCKS</Text><Text style={styles.summaryValue}>{blocks.length}/{blocks.length}</Text></View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>LIVE ADJUSTMENTS</Text><Text style={styles.summaryValue}>{adaptations.length}</Text></View>
          </View>

          <Text style={styles.effortTitle}>How hard did that feel?</Text>
          <View style={styles.effortRow}>
            {[5, 6, 7, 8, 9].map((value) => (
              <TouchableOpacity key={value} style={[styles.effortButton, effort === value && styles.effortButtonActive]} onPress={() => setEffort(value)}>
                <Text style={[styles.effortValue, effort === value && styles.effortValueActive]}>{value}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.effortCaption}>RPE {effort} · {effort <= 6 ? 'Comfortable' : effort <= 8 ? 'Productive' : 'Very hard'}</Text>

          <View style={styles.coachCard}><Text style={styles.completeEyebrow}>COACH</Text><Text style={styles.coachTitle}>Recovery starts now.</Text><Text style={styles.coachCopy}>Hydrate, eat normally, and let the work settle in. The goal is to stack another good day—not punish yourself for this one.</Text></View>

          <TouchableOpacity style={styles.primary} onPress={saveMission}><Text style={styles.primaryText}>{saving ? 'SAVING MISSION…' : 'SAVE MISSION & VIEW PROGRESS →'}</Text></TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.eyebrow}>MISSION IN PROGRESS</Text>
            <Text style={styles.title}>Block {activeBlock + 1} of {blocks.length}</Text>
          </View>
          <TouchableOpacity onPress={exit} style={styles.exit}><Text style={styles.exitText}>EXIT</Text></TouchableOpacity>
        </View>

        {restored ? <View style={styles.restored}><Text style={styles.restoredText}>SESSION RESTORED · PICK UP WHERE YOU LEFT OFF</Text></View> : null}
        {liveCoachMessage ? <View style={styles.liveCoach}><Text style={styles.liveCoachLabel}>LIVE COACH ADJUSTMENT</Text><Text style={styles.liveCoachText}>{liveCoachMessage}</Text></View> : null}

        <View style={styles.timerCard}>
          <Text style={styles.blockTitle}>{block.title}</Text>
          <Text style={styles.detail}>{block.detail}</Text>
          <Text style={styles.timer}>{formatTime(secondsLeft)}</Text>
          <Text style={styles.session}>SESSION {formatTime(sessionSeconds)} · {progress}% COMPLETE</Text>
          <Text style={styles.cue}>{block.cue}</Text>
          <View style={styles.controls}>
            <TouchableOpacity style={styles.control} onPress={() => setSecondsLeft((v) => v + 30)}><Text style={styles.controlText}>+30</Text></TouchableOpacity>
            <TouchableOpacity style={styles.play} onPress={() => setRunning((v) => !v)}><Text style={styles.playText}>{running ? 'PAUSE' : 'RESUME'}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.control} onPress={() => setSecondsLeft((v) => Math.max(0, v - 30))}><Text style={styles.controlText}>−30</Text></TouchableOpacity>
          </View>
        </View>

        <Text style={styles.section}>Exactly what to do</Text>
        {block.steps.map((step, index) => (
          <View key={`${block.title}-${step.label}`} style={styles.stepCard}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View>
            <View style={styles.stepCopy}>
              <View style={styles.stepHead}><Text style={styles.stepTitle}>{step.label}</Text><Text style={styles.dose}>{step.dose}</Text></View>
              <Text style={styles.instruction}>{step.instruction}</Text>
              {step.rest ? <Text style={styles.rest}>REST · {step.rest}</Text> : null}
            </View>
          </View>
        ))}

        <Text style={styles.section}>Mission map</Text>
        {blocks.map((item, index) => (
          <TouchableOpacity key={item.title} style={[styles.mapRow, index === activeBlock && styles.mapRowActive]} onPress={() => {
            setActiveBlock(index);
            setSecondsLeft(item.duration);
            setRunning(false);
          }}>
            <Text style={styles.mapNumber}>{completedBlocks.includes(index) ? '✓' : index + 1}</Text>
            <View style={styles.mapCopy}><Text style={styles.mapTitle}>{item.title}</Text><Text style={styles.mapDetail}>{Math.round(item.duration / 60)} min · {item.type}</Text></View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.primary} onPress={completeBlock}>
          <Text style={styles.primaryText}>{activeBlock === blocks.length - 1 ? 'FINISH MISSION' : 'COMPLETE BLOCK →'}</Text>
        </TouchableOpacity>
        <Text style={styles.footer}>{adaptiveSessionMinutes(blocks)} minute adaptive prescription</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeedbackGroup({ title, options, value, onChange }: { title: string; options: Array<string | number>; value: string | number; onChange: (value: string | number) => void }) {
  return (
    <View style={styles.feedbackCard}>
      <Text style={styles.feedbackLabel}>{title}</Text>
      <View style={styles.feedbackOptions}>
        {options.map((option) => {
          const selected = option === value;
          return <TouchableOpacity key={`${title}-${option}`} style={[styles.feedbackButton, selected && styles.feedbackButtonActive]} onPress={() => onChange(option)}><Text style={[styles.feedbackButtonText, selected && styles.feedbackButtonTextActive]}>{String(option).replace('-', ' ').toUpperCase()}</Text></TouchableOpacity>;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#07090D' },
  container: { padding: 22, paddingBottom: 54, gap: 12 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: '#C89B3C', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: '#F5F2EA', fontSize: 30, fontWeight: '900', marginTop: 4 },
  exit: { borderWidth: 1, borderColor: '#333A45', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 9 },
  exitText: { color: '#A5ABB5', fontWeight: '900', fontSize: 11 },
  restored: { backgroundColor: '#142117', borderWidth: 1, borderColor: '#355A3A', borderRadius: 14, padding: 12 },
  restoredText: { color: '#9ED7A8', fontSize: 10, fontWeight: '900', letterSpacing: 0.7, textAlign: 'center' },
  liveCoach: { backgroundColor: '#17140E', borderWidth: 1, borderColor: '#6C572C', borderRadius: 16, padding: 14, gap: 5 },
  liveCoachLabel: { color: '#D9B45F', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  liveCoachText: { color: '#D8D2C7', fontSize: 13, lineHeight: 19 },
  timerCard: { backgroundColor: '#11151B', borderWidth: 1, borderColor: '#2B313A', borderRadius: 24, padding: 20, gap: 10 },
  blockTitle: { color: '#F5F2EA', fontSize: 25, fontWeight: '900' },
  detail: { color: '#8A919C', fontSize: 13 },
  timer: { color: '#E1B75E', fontSize: 58, fontWeight: '900', textAlign: 'center', marginVertical: 4 },
  session: { color: '#737B87', textAlign: 'center', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  cue: { color: '#CDD1D7', fontSize: 14, lineHeight: 20, marginTop: 6 },
  controls: { flexDirection: 'row', gap: 8, marginTop: 8 },
  control: { flex: 1, backgroundColor: '#1A2028', borderRadius: 14, padding: 13, alignItems: 'center' },
  controlText: { color: '#D6D9DE', fontWeight: '900' },
  play: { flex: 1.5, backgroundColor: '#C89B3C', borderRadius: 14, padding: 13, alignItems: 'center' },
  playText: { color: '#090B0E', fontWeight: '900' },
  section: { color: '#F5F2EA', fontSize: 20, fontWeight: '900', marginTop: 12 },
  stepCard: { flexDirection: 'row', gap: 12, backgroundColor: '#0E1217', borderWidth: 1, borderColor: '#232933', borderRadius: 18, padding: 15 },
  stepNumber: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#211B11', alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: '#E1B75E', fontWeight: '900' },
  stepCopy: { flex: 1 },
  stepHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  stepTitle: { color: '#F0EEE9', fontWeight: '900', flex: 1 },
  dose: { color: '#D1A956', fontSize: 11, fontWeight: '900' },
  instruction: { color: '#9BA1AB', fontSize: 13, lineHeight: 19, marginTop: 7 },
  rest: { color: '#777F8B', fontSize: 10, fontWeight: '800', marginTop: 8 },
  mapRow: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 13, borderRadius: 16, borderWidth: 1, borderColor: '#20262E' },
  mapRowActive: { borderColor: '#6C572C', backgroundColor: '#17140E' },
  mapNumber: { color: '#D9B45F', fontWeight: '900', width: 24, textAlign: 'center' },
  mapCopy: { flex: 1 },
  mapTitle: { color: '#ECEAE5', fontWeight: '800' },
  mapDetail: { color: '#737B87', fontSize: 11, marginTop: 3 },
  primary: { backgroundColor: '#C89B3C', borderRadius: 17, padding: 17, alignItems: 'center', marginTop: 10 },
  primaryText: { color: '#090B0E', fontWeight: '900', letterSpacing: 0.8 },
  footer: { color: '#626A76', textAlign: 'center', fontSize: 11 },
  checkInContainer: { padding: 24, paddingTop: 42, paddingBottom: 60, gap: 14 },
  feedbackCard: { backgroundColor: '#0E1217', borderWidth: 1, borderColor: '#292F38', borderRadius: 18, padding: 15, gap: 10 },
  feedbackLabel: { color: '#7E8691', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  feedbackOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  feedbackButton: { flexGrow: 1, minWidth: 54, borderWidth: 1, borderColor: '#313843', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 11, alignItems: 'center', backgroundColor: '#12171D' },
  feedbackButtonActive: { borderColor: '#C89B3C', backgroundColor: '#241E12' },
  feedbackButtonText: { color: '#8C949F', fontSize: 10, fontWeight: '900' },
  feedbackButtonTextActive: { color: '#E2B85E' },
  completeContainer: { padding: 24, paddingTop: 50, paddingBottom: 60, alignItems: 'stretch', gap: 16 },
  victory: { alignSelf: 'center', width: 74, height: 74, borderRadius: 37, borderWidth: 2, borderColor: '#C89B3C', backgroundColor: '#17140E', alignItems: 'center', justifyContent: 'center' },
  victoryText: { color: '#E1B75E', fontSize: 34, fontWeight: '900' },
  completeEyebrow: { color: '#C89B3C', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  completeTitle: { color: '#F5F2EA', fontSize: 36, lineHeight: 39, fontWeight: '900' },
  completeCopy: { color: '#989FA9', fontSize: 14, lineHeight: 21 },
  summaryCard: { backgroundColor: '#0E1217', borderWidth: 1, borderColor: '#292F38', borderRadius: 20, padding: 17 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  summaryLabel: { color: '#737B87', fontSize: 10, fontWeight: '900' },
  summaryValue: { color: '#F0EEE9', fontWeight: '900' },
  divider: { height: 1, backgroundColor: '#222832', marginVertical: 8 },
  effortTitle: { color: '#F5F2EA', fontSize: 20, fontWeight: '900', marginTop: 4 },
  effortRow: { flexDirection: 'row', gap: 8 },
  effortButton: { flex: 1, aspectRatio: 1, borderRadius: 15, borderWidth: 1, borderColor: '#323945', backgroundColor: '#10141A', alignItems: 'center', justifyContent: 'center' },
  effortButtonActive: { borderColor: '#C89B3C', backgroundColor: '#241E12' },
  effortValue: { color: '#8E96A1', fontSize: 20, fontWeight: '900' },
  effortValueActive: { color: '#E3B95E' },
  effortCaption: { color: '#777F89', textAlign: 'center', fontSize: 12 },
  coachCard: { backgroundColor: '#12100C', borderWidth: 1, borderColor: '#3B3020', borderRadius: 20, padding: 18, gap: 7 },
  coachTitle: { color: '#F0EEE8', fontSize: 18, fontWeight: '900' },
  coachCopy: { color: '#A49C90', fontSize: 13, lineHeight: 19 },
});
