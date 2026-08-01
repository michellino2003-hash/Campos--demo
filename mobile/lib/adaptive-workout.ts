import type { SessionPrescription } from './adaptive-coach';
import type { AthleteProfile } from './athlete-profile';

export type GuidedStep = {
  label: string;
  dose: string;
  instruction: string;
  rest?: string;
};

export type AdaptiveWorkoutBlock = {
  title: string;
  detail: string;
  duration: number;
  cue: string;
  type: 'prep' | 'boxing' | 'strength' | 'recovery';
  steps: GuidedStep[];
};

export type LiveSessionFeedback = {
  effort: 1 | 2 | 3 | 4 | 5;
  technique: 'sharp' | 'slipping' | 'breaking-down';
  pain: 'none' | 'mild' | 'rising';
  breathing: 'controlled' | 'working' | 'struggling';
};

export type LiveCoachAdjustment = {
  mode: 'continue' | 'ease' | 'recover' | 'stop';
  message: string;
  targetRpeDelta: number;
  extraRestSeconds: number;
  durationMultiplier: number;
  powerCeiling?: string;
};

const BASE: AdaptiveWorkoutBlock[] = [
  {
    title: 'Movement prep',
    detail: 'Boxing mobility + warm-up',
    duration: 480,
    cue: 'Move smoothly. Prepare the positions you will use today.',
    type: 'prep',
    steps: [
      { label: '90/90 breathing', dose: '60 sec', instruction: 'Long relaxed exhales. Set the ribs before loading or punching.' },
      { label: 'Open books', dose: '5/side', instruction: 'Rotate through the upper back while keeping the knees stacked.' },
      { label: 'Wall slides', dose: '8 reps', instruction: 'Keep ribs controlled and let the shoulder blades rotate upward.' },
      { label: 'Easy shadowboxing', dose: '2 min', instruction: 'Work around 40–50%. Jab, step, pivot and breathe.', rest: '30–45 sec' },
    ],
  },
  {
    title: 'Shadowboxing',
    detail: '3 × 2-minute technical rounds',
    duration: 540,
    cue: 'Stay light and finish every combination balanced.',
    type: 'boxing',
    steps: [
      { label: 'Jab + feet', dose: '2 min', instruction: 'Jab while stepping in, out and laterally. Return to stance after every punch.', rest: '60 sec' },
      { label: '1–2 + exit', dose: '2 min', instruction: 'Throw the 1–2 and immediately angle or step out.', rest: '60 sec' },
      { label: 'Defense into offense', dose: '2 min', instruction: 'Slip, roll or pull first, then answer with a short clean combination.', rest: '60 sec' },
    ],
  },
  {
    title: 'Heavy bag',
    detail: '3 controlled precision rounds',
    duration: 540,
    cue: 'Snap shots, keep your feet under you, and never admire your work.',
    type: 'boxing',
    steps: [
      { label: 'Jab control', dose: '2 min', instruction: 'Change distance with a sharp jab and reset after every exchange.', rest: '60 sec' },
      { label: 'Straight shots', dose: '2 min', instruction: 'Use clean 1–2s and 1–1–2s without overreaching.', rest: '60 sec' },
      { label: 'Combination + exit', dose: '2 min', instruction: 'Finish every combination with a pivot, step-out or defensive movement.', rest: '90 sec' },
    ],
  },
  {
    title: 'Strength block',
    detail: 'Press, row, rear delts',
    duration: 1440,
    cue: 'Own every rep. Keep one to three clean reps in reserve.',
    type: 'strength',
    steps: [
      { label: 'Landmine press', dose: '3 × 8–10/side', instruction: 'Brace gently, reach through the press, and avoid low-back arching.', rest: '75–90 sec' },
      { label: 'Chest-supported row', dose: '3 × 10–12', instruction: 'Pull toward the hips and pause without yanking.', rest: '75–90 sec' },
      { label: 'Rear-delt raise', dose: '2 × 12–15', instruction: 'Use a light load and controlled range without shrugging.', rest: '45–60 sec' },
    ],
  },
  {
    title: 'Cooldown',
    detail: 'Grip, mobility and downshift breathing',
    duration: 720,
    cue: 'Finish calmer than you started.',
    type: 'recovery',
    steps: [
      { label: 'Suitcase hold', dose: '2 × 30 sec/side', instruction: 'Stand tall and resist leaning.', rest: '30–45 sec' },
      { label: 'Forearm stretch', dose: '30 sec/side', instruction: 'Use a mild stretch only. Stop for numbness or tingling.' },
      { label: 'Crocodile breathing', dose: '2 min', instruction: 'Breathe low and slow with a longer exhale.' },
    ],
  },
];

function applyEquipment(blocks: AdaptiveWorkoutBlock[], profile?: AthleteProfile | null) {
  if (!profile?.completed) return blocks;
  let next = blocks.map((block) => ({ ...block, steps: block.steps.map((step) => ({ ...step })) }));

  if (!profile.equipment.includes('heavy-bag')) {
    next = next.map((block) => block.title === 'Heavy bag'
      ? {
          ...block,
          title: 'Shadowboxing pressure rounds',
          detail: '3 controlled rounds · no bag required',
          cue: 'Create imaginary targets, change distance, and finish every exchange balanced.',
          steps: block.steps.map((step) => ({
            ...step,
            label: step.label.replace('Jab control', 'Jab + angle').replace('Straight shots', 'Straight shots + defense').replace('Combination + exit', 'Combination + exit'),
            instruction: `${step.instruction} Work against an imaginary opponent and prioritize clean positioning over power.`,
          })),
        }
      : block);
  }

  if (!profile.equipment.includes('gym')) {
    const hasDumbbells = profile.equipment.includes('dumbbells');
    next = next.map((block) => block.type === 'strength'
      ? {
          ...block,
          detail: hasDumbbells ? 'Dumbbell strength · no gym required' : 'Bodyweight strength · no gym required',
          steps: hasDumbbells
            ? [
                { label: 'Dumbbell floor press', dose: '3 × 8–12', instruction: 'Keep the ribs controlled and stop with two clean reps in reserve.', rest: '60–90 sec' },
                { label: 'One-arm dumbbell row', dose: '3 × 10–12/side', instruction: 'Support the torso and pull toward the hip without twisting.', rest: '60–90 sec' },
                { label: 'Dumbbell rear-delt raise', dose: '2 × 12–15', instruction: 'Stay light and controlled. Do not shrug.', rest: '45–60 sec' },
              ]
            : [
                { label: 'Incline push-up', dose: '3 × 8–15', instruction: 'Choose a height that keeps every rep smooth and stop before technique slows.', rest: '60 sec' },
                { label: 'Backpack row', dose: '3 × 10–15', instruction: 'Use a secure backpack or skip loading if setup is unreliable; pull toward the ribs with control.', rest: '60 sec' },
                { label: 'Wall slide + rear-delt iso', dose: '2 rounds', instruction: 'Use slow wall slides, then hold the arms slightly behind the torso for 20–30 seconds without shrugging.', rest: '45 sec' },
              ],
        }
      : block);
  }

  return next;
}

function applyPriority(blocks: AdaptiveWorkoutBlock[], profile?: AthleteProfile | null) {
  if (!profile?.completed) return blocks;
  return blocks.map((block) => {
    if (profile.primaryPriority === 'boxing' && block.type === 'boxing') return { ...block, duration: Math.round(block.duration * 1.12), cue: `${block.cue} Boxing is your primary priority today.` };
    if (profile.primaryPriority === 'conditioning' && block.type === 'boxing') return { ...block, duration: Math.round(block.duration * 1.08), detail: `${block.detail} · conditioning emphasis` };
    if (profile.primaryPriority === 'strength' && block.type === 'strength') return { ...block, duration: Math.round(block.duration * 1.12), cue: `${block.cue} Strength quality gets the extra time today.` };
    if (profile.primaryPriority === 'physique' && block.type === 'strength') return { ...block, duration: Math.round(block.duration * 1.08), detail: `${block.detail} · physique emphasis` };
    return block;
  });
}

function fitSessionLength(blocks: AdaptiveWorkoutBlock[], profile?: AthleteProfile | null) {
  if (!profile?.completed) return blocks;
  const targetSeconds = profile.sessionMinutes * 60;
  const total = blocks.reduce((sum, block) => sum + block.duration, 0);
  if (!total || total <= targetSeconds * 1.05) return blocks;

  const protectedSeconds = blocks.reduce((sum, block) => sum + (block.type === 'prep' || block.type === 'recovery' ? Math.min(block.duration, 360) : 0), 0);
  const workTotal = blocks.reduce((sum, block) => sum + (block.type === 'boxing' || block.type === 'strength' ? block.duration : 0), 0);
  const workBudget = Math.max(600, targetSeconds - protectedSeconds);
  const multiplier = workTotal ? Math.min(1, workBudget / workTotal) : 1;

  return blocks.map((block) => {
    if (block.type === 'prep') return { ...block, duration: Math.min(block.duration, 360) };
    if (block.type === 'recovery') return { ...block, duration: Math.min(block.duration, 360) };
    const duration = Math.max(180, Math.round(block.duration * multiplier));
    const keepRatio = block.duration ? duration / block.duration : 1;
    const keepSteps = Math.max(1, Math.ceil(block.steps.length * keepRatio));
    return { ...block, duration, steps: block.steps.slice(0, keepSteps), detail: `${block.detail} · fit to ${profile.sessionMinutes}-min window` };
  });
}

function personalize(blocks: AdaptiveWorkoutBlock[], profile?: AthleteProfile | null) {
  return fitSessionLength(applyPriority(applyEquipment(blocks, profile), profile), profile);
}

export function buildAdaptiveWorkout(prescription?: SessionPrescription | null, profile?: AthleteProfile | null): AdaptiveWorkoutBlock[] {
  let blocks = BASE;
  if (prescription?.stopForPain) {
    blocks = [
      { ...BASE[0], duration: 360, detail: 'Pain-free mobility only', cue: 'Nothing should increase pain.' },
      { ...BASE[4], duration: 600, detail: 'Recovery only', steps: BASE[4].steps.filter((step) => step.label !== 'Suitcase hold') },
    ];
  } else if (prescription?.mode === 'recover') {
    blocks = [
      { ...BASE[0], duration: 420 },
      { ...BASE[1], duration: 360, detail: '2 relaxed technical rounds', steps: BASE[1].steps.slice(0, 2) },
      { ...BASE[2], duration: 300, detail: '2 light precision rounds', steps: BASE[2].steps.slice(0, 2) },
      BASE[4],
    ];
  } else if (prescription && prescription.volumeMultiplier < 1) {
    blocks = BASE.map((block) => block.type === 'strength'
      ? { ...block, duration: Math.round(block.duration * prescription.volumeMultiplier), detail: 'Reduced-volume strength · pain-free range' }
      : block.type === 'boxing'
        ? { ...block, duration: Math.round(block.duration * 0.85), detail: `${block.detail} · technical pace` }
        : block);
  } else if (prescription?.mode === 'push') {
    blocks = BASE.map((block) => block.type === 'boxing' ? { ...block, cue: `${block.cue} Press the pace only while technique stays sharp.` } : block);
  }
  return personalize(blocks, profile);
}

export function getLiveCoachAdjustment(feedback: LiveSessionFeedback): LiveCoachAdjustment {
  if (feedback.pain === 'rising') {
    return { mode: 'stop', message: 'Pain is rising. Loaded work is done for today; protect the next training day.', targetRpeDelta: -3, extraRestSeconds: 120, durationMultiplier: 0.35, powerCeiling: 'No power work' };
  }
  if (feedback.technique === 'breaking-down' || feedback.breathing === 'struggling' || feedback.effort === 5) {
    return { mode: 'recover', message: 'Quality is dropping. CampOS is cutting volume before fatigue turns into bad reps.', targetRpeDelta: -2, extraRestSeconds: 60, durationMultiplier: 0.65, powerCeiling: '50–60%' };
  }
  if (feedback.pain === 'mild' || feedback.technique === 'slipping' || feedback.effort === 4) {
    return { mode: 'ease', message: 'Stay productive, but sharpen the work: more recovery, less volume, clean technique only.', targetRpeDelta: -1, extraRestSeconds: 30, durationMultiplier: 0.82, powerCeiling: '60–70%' };
  }
  return { mode: 'continue', message: 'You are handling the session well. Keep the prescription and protect your technique.', targetRpeDelta: 0, extraRestSeconds: 0, durationMultiplier: 1 };
}

export function adaptRemainingWorkout(blocks: AdaptiveWorkoutBlock[], completedThroughIndex: number, feedback: LiveSessionFeedback): { blocks: AdaptiveWorkoutBlock[]; adjustment: LiveCoachAdjustment } {
  const adjustment = getLiveCoachAdjustment(feedback);
  if (adjustment.mode === 'continue') return { blocks, adjustment };
  const adapted = blocks.map((block, index) => {
    if (index <= completedThroughIndex) return block;
    if (adjustment.mode === 'stop') {
      if (block.type !== 'recovery') return null;
      return { ...block, duration: Math.max(300, Math.round(block.duration * 0.7)), detail: 'Pain-free recovery only', cue: adjustment.message, steps: block.steps.filter((step) => step.label !== 'Suitcase hold') };
    }
    if (block.type !== 'boxing' && block.type !== 'strength') return block;
    const keepSteps = adjustment.mode === 'recover' ? Math.max(1, Math.ceil(block.steps.length * 0.6)) : block.steps.length;
    return {
      ...block,
      duration: Math.max(120, Math.round(block.duration * adjustment.durationMultiplier)),
      detail: `${block.detail} · live adjusted`,
      cue: adjustment.message,
      steps: block.steps.slice(0, keepSteps).map((step) => ({ ...step, instruction: `${step.instruction} ${adjustment.powerCeiling ? `Cap power at ${adjustment.powerCeiling}. ` : ''}${adjustment.extraRestSeconds ? `Take up to ${adjustment.extraRestSeconds} extra seconds before repeating quality work.` : ''}`.trim() })),
    };
  }).filter((block): block is AdaptiveWorkoutBlock => Boolean(block));
  return { blocks: adapted, adjustment };
}

export function adaptiveSessionMinutes(blocks: AdaptiveWorkoutBlock[]) {
  return Math.round(blocks.reduce((total, block) => total + block.duration, 0) / 60);
}
