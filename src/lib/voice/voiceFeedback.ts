import { Platform, Vibration } from 'react-native';

import { speakCue } from '@/lib/voice/speakCue';
import type { ParsedVoiceCommandExtended } from '@/types/voice';

export function speakRecoveryLine(message: string, enabled: boolean): void {
  if (!enabled || Platform.OS === 'web') return;
  void speakCue(message, { rate: 1.0, pitch: 1 });
  Vibration.vibrate(20);
}

export function speakVoiceConfirmation(
  command: ParsedVoiceCommandExtended,
  enabled: boolean,
  weightLabel = 'lb',
): void {
  if (!enabled || Platform.OS === 'web') return;

  let message = 'Logged';
  if (command.intent === 'undo_last_set' || command.intent === 'delete_last_set') {
    message = 'Last set removed';
  } else if (command.intent === 'next_set' || command.intent === 'completed_set') {
    message = 'Next set';
  } else if (command.intent === 'declare_exercise') {
    message = command.exercise ? `Starting ${command.exercise}` : 'Exercise noted';
  } else if (command.exercise && command.reps != null) {
    const weightPart = command.weight != null ? `${command.weight} ${weightLabel} ` : '';
    message = `${command.exercise}, ${weightPart}${command.reps} reps`;
  } else if (command.intent === 'adjust_weight') {
    message = command.targetWeight
      ? `Weight ${command.targetWeight} ${weightLabel}`
      : 'Weight adjusted';
  } else if (command.intent === 'recovery_query') {
    message = command.recoveryVoiceLine ?? 'Checking recovery';
  } else if (command.intent === 'train_today_query') {
    message = command.trainTodayVoiceLine ?? 'Checking training recommendation';
  } else if (command.intent === 'build_workout') {
    message = command.buildWorkoutVoiceLine ?? command.trainTodayVoiceLine ?? 'Building your workout';
  } else if (command.intent === 'transformation_query' || command.intent === 'transformation_progress' || command.intent === 'transformation_target_bf') {
    message = command.transformationVoiceLine ?? 'Running transformation projection';
  }

  void speakCue(message, { rate: 1.05, pitch: 1 });
  Vibration.vibrate(20);
}
