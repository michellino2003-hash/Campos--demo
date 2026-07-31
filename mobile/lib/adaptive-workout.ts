import type { SessionPrescription } from './adaptive-coach';

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

export function buildAdaptiveWorkout(prescription?: SessionPrescription | null): AdaptiveWorkoutBlock[] {
  if (!prescription) return BASE;
  if (prescription.stopForPain) {
    return [
      { ...BASE[0], duration: 360, detail: 'Pain-free mobility only', cue: 'Nothing should increase pain.' },
      { ...BASE[4], duration: 600, detail: 'Recovery only', steps: BASE[4].steps.filter((step) => step.label !== 'Suitcase hold') },
    ];
  }
  if (prescription.mode === 'recover') {
    return [
      { ...BASE[0], duration: 420 },
      { ...BASE[1], duration: 360, detail: '2 relaxed technical rounds', steps: BASE[1].steps.slice(0, 2) },
      { ...BASE[2], duration: 300, detail: '2 light precision rounds', steps: BASE[2].steps.slice(0, 2) },
      BASE[4],
    ];
  }
  if (prescription.volumeMultiplier < 1) {
    return BASE.map((block) => block.type === 'strength'
      ? { ...block, duration: Math.round(block.duration * prescription.volumeMultiplier), detail: 'Reduced-volume strength · pain-free range' }
      : block.type === 'boxing'
        ? { ...block, duration: Math.round(block.duration * 0.85), detail: `${block.detail} · technical pace` }
        : block);
  }
  if (prescription.mode === 'push') {
    return BASE.map((block) => block.type === 'boxing' ? { ...block, cue: `${block.cue} Press the pace only while technique stays sharp.` } : block);
  }
  return BASE;
}

export function adaptiveSessionMinutes(blocks: AdaptiveWorkoutBlock[]) {
  return Math.round(blocks.reduce((total, block) => total + block.duration, 0) / 60);
}
