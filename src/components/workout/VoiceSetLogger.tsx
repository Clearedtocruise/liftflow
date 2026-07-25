import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { MicrophoneButton } from '@/components/workout/MicrophoneButton';
import { VoiceConfirmModal, type ConfirmedVoiceSet } from '@/components/workout/VoiceConfirmModal';
import { Spacing } from '@/constants/theme';
import { useUnits } from '@/hooks/useUnits';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { useVoiceSettings } from '@/hooks/useVoiceSettings';
import { normalizeVoiceWeightToKg } from '@/lib/unitConversion';
import { processVoiceTranscript } from '@/services/voiceService';
import type { ParsedVoiceCommandExtended } from '@/types/voice';

export type VoiceSetLogPayload = {
  exerciseName: string;
  weight?: number;
  reps?: number;
};

type VoiceSetLoggerProps = {
  userId: string | undefined;
  /** The app's existing manual set-entry path — voice never writes sets on its own. */
  onLogSet: (payload: VoiceSetLogPayload) => Promise<boolean>;
  activeExerciseName?: string;
  lastWeightKg?: number;
  lastReps?: number;
  disabled?: boolean;
};

type Pending = {
  parsed: ParsedVoiceCommandExtended;
  transcript: string;
  weightKg?: number;
  reason?: string;
};

export function VoiceSetLogger({
  userId,
  onLogSet,
  activeExerciseName,
  lastWeightKg,
  lastReps,
  disabled,
}: VoiceSetLoggerProps) {
  const units = useUnits();
  const { settings } = useVoiceSettings(userId);

  const [pending, setPending] = useState<Pending | null>(null);
  const [saving, setSaving] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const logParsedSet = useCallback(
    async (exercise: string, weightKg: number | undefined, reps: number | undefined) => {
      const saved = await onLogSet({ exerciseName: exercise, weight: weightKg, reps });
      setStatus(saved ? `Logged ${exercise}` : null);
      if (!saved) setParseError('Could not save that set. Try logging it manually.');
      return saved;
    },
    [onLogSet],
  );

  const handleTranscript = useCallback(
    async (transcript: string) => {
      setParseError(null);
      setStatus(null);

      if (!userId) {
        setParseError('Sign in to log sets by voice.');
        return;
      }

      const result = await processVoiceTranscript(userId, {
        transcript,
        context: {
          activeExerciseName,
          lastWeight: lastWeightKg,
          lastReps,
          preferredWeightUnit: units.preferredWeightUnit,
        },
      });

      if (!result.success) {
        setParseError(result.error);
        return;
      }

      const { parsed, requiresConfirmation, confirmationReason } = result.data;
      const weightKg = normalizeVoiceWeightToKg(parsed.weight, transcript, units.preferredWeightUnit);
      const isSetIntent = !parsed.intent || parsed.intent === 'log_set';

      // Anything other than a set — and anything the hardened parser flagged — goes to the sheet
      // rather than straight to the log.
      if (!isSetIntent || requiresConfirmation || !parsed.exercise || parsed.reps == null) {
        setPending({ parsed, transcript, weightKg, reason: confirmationReason });
        return;
      }

      await logParsedSet(parsed.exercise, weightKg, parsed.reps);
    },
    [userId, activeExerciseName, lastWeightKg, lastReps, units.preferredWeightUnit, logParsedSet],
  );

  const voice = useVoiceRecognition({
    inputMode: settings.inputMode,
    enabled: !disabled,
    onFinalTranscript: (text) => void handleTranscript(text),
  });

  async function handleConfirm(set: ConfirmedVoiceSet) {
    setSaving(true);
    const saved = await logParsedSet(set.exercise, set.weightKg, set.reps);
    setSaving(false);
    if (saved) {
      setPending(null);
      voice.clearTranscript();
    }
  }

  function handleReject() {
    setPending(null);
    setParseError(null);
    voice.clearTranscript();
  }

  return (
    <View style={styles.wrapper}>
      <MicrophoneButton
        state={voice.state}
        inputMode={voice.inputMode}
        disabled={disabled}
        errorMessage={voice.error}
        onPress={() => void voice.handleMicPress()}
        onPressIn={() => void voice.handlePressIn()}
        onPressOut={voice.handlePressOut}
      />

      {parseError ? (
        <AppText variant="caption" color="error" align="center">
          {parseError}
        </AppText>
      ) : status ? (
        <AppText variant="caption" color="accent" align="center">
          {status}
        </AppText>
      ) : (
        <AppText variant="caption" color="textSecondary" align="center">
          Try &quot;bench press 225 for 8&quot;
        </AppText>
      )}

      <VoiceConfirmModal
        visible={pending !== null}
        parsed={pending?.parsed ?? null}
        transcript={pending?.transcript ?? ''}
        weightKg={pending?.weightKg}
        reason={pending?.reason}
        saving={saving}
        onConfirm={handleConfirm}
        onReject={handleReject}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
});
