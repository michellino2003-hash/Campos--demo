export type ReadinessMode = 'push' | 'normal' | 'recover';

export type ReadinessSignals = {
  sleep: number;
  energy: number;
  soreness: number;
  stress: number;
  jointComfort: number;
  pain: number;
  recentEffort?: number;
};

export type SessionPrescription = {
  score: number;
  mode: ReadinessMode;
  targetRpe: number;
  volumeMultiplier: number;
  boxingFocus: 'performance' | 'technical' | 'recovery';
  message: string;
  reasons: string[];
  stopForPain: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function calculateReadiness(signals: ReadinessSignals): SessionPrescription {
  const sleep = clamp(signals.sleep, 0, 100);
  const energy = clamp(signals.energy, 0, 10) * 10;
  const sorenessRecovery = 100 - clamp(signals.soreness, 0, 10) * 10;
  const stressRecovery = 100 - clamp(signals.stress, 0, 10) * 10;
  const joints = clamp(signals.jointComfort, 0, 10) * 10;
  const recentRecovery = signals.recentEffort == null ? 70 : 100 - clamp((signals.recentEffort - 5) * 12, 0, 48);
  const pain = clamp(signals.pain, 0, 10);

  let score = Math.round(
    sleep * 0.28 + energy * 0.22 + sorenessRecovery * 0.16 + stressRecovery * 0.12 + joints * 0.16 + recentRecovery * 0.06,
  );

  const reasons: string[] = [];
  if (sleep < 65) reasons.push('Sleep is below your normal performance range.');
  if (signals.energy <= 5) reasons.push('Energy is limited today.');
  if (signals.soreness >= 7) reasons.push('Soreness is elevated.');
  if (signals.stress >= 7) reasons.push('Stress load is elevated.');
  if (signals.jointComfort <= 5) reasons.push('Joint comfort is reduced.');

  if (pain >= 7) {
    score = Math.min(score, 35);
    reasons.unshift('High pain overrides the normal training recommendation.');
  } else if (pain >= 4) {
    score = Math.min(score, 58);
    reasons.unshift('Pain is present, so the session should be modified.');
  }

  const mode: ReadinessMode = score >= 82 ? 'push' : score >= 60 ? 'normal' : 'recover';

  if (mode === 'push') {
    return {
      score,
      mode,
      targetRpe: 8,
      volumeMultiplier: 1.05,
      boxingFocus: 'performance',
      message: 'Recovery is strong. Use the extra capacity without chasing failure.',
      reasons: reasons.length ? reasons : ['Recovery signals are aligned for a high-quality performance day.'],
      stopForPain: pain >= 7,
    };
  }

  if (mode === 'normal') {
    return {
      score,
      mode,
      targetRpe: pain >= 4 ? 6 : 7,
      volumeMultiplier: pain >= 4 ? 0.82 : 1,
      boxingFocus: pain >= 4 ? 'technical' : 'performance',
      message: pain >= 4 ? 'Keep the purpose of the session, but remove unnecessary strain.' : 'You are ready for the planned session. Stay controlled and finish clean.',
      reasons: reasons.length ? reasons : ['Readiness is stable and supports the planned workload.'],
      stopForPain: pain >= 7,
    };
  }

  return {
    score,
    mode,
    targetRpe: pain >= 4 ? 5 : 6,
    volumeMultiplier: pain >= 4 ? 0.55 : 0.7,
    boxingFocus: pain >= 4 ? 'recovery' : 'technical',
    message: pain >= 4 ? 'Do not push through pain. Use pain-free movement and recovery work.' : 'Preserve the habit, reduce fatigue, and leave feeling better than you started.',
    reasons: reasons.length ? reasons : ['Your combined recovery signals favor a reduced training load today.'],
    stopForPain: pain >= 7,
  };
}
