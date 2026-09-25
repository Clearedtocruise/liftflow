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
import { speakVoiceConfirmation } from '@/lib/voice/voiceFeedback';
import { processVoiceTranscript } from '@/services/voiceService';
import type { ParsedVoiceCommandExtended } from '@/types/voice';

export type VoiceSetLogPayload = {
  exerciseName: string;
  weight?: number;
  reps?: number;
  /** A hold said as a length of time, e.g. "plank for 60 seconds". */
  durationSeconds?: number;
};

export type VoiceSetLogResult = {
  ok: boolean;
  /** Why the set was not saved, phrased for the lifter. Shown instead of the generic failure. */
  reason?: string;
  /** The exercise the set landed on, when the catalog spells it differently to what was said. */
  loggedAs?: string;
};

type VoiceSetLoggerProps = {
  userId: string | undefined;
  /**
   * The app's existing manual set-entry path — voice never writes sets on its own. Returning a
   * `VoiceSetLogResult` rather than a bare boolean lets the caller explain a refusal; a bare
   * `false` can only ever produce the generic message.
   */
  onLogSet: (payload: VoiceSetLogPayload) => Promise<boolean | VoiceSetLogResult>;
  activeExerciseName?: string;
  lastWeightKg?: number;
  lastReps?: number;
  /**
   * Whether the lift on screen takes a load. A pull-up or a hanging leg raise never has a weight,
   * so treating a missing one as "needs confirming" meant voice could not log a bodyweight set at
   * all — every utterance stopped at the sheet waiting for a number that does not exist.
   */
  requiresWeight?: boolean;
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
  requiresWeight = true,
  disabled,
}: VoiceSetLoggerProps) {
  const units = useUnits();
  const { settings } = useVoiceSettings(userId);

  const [pending, setPending] = useState<Pending | null>(null);
  const [saving, setSaving] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  /**
   * The last thing transcription returned, kept on screen after the attempt finishes. Without it a
   * misheard word is invisible: the lifter only sees "could not parse" and has no way to tell
   * whether the mic, the transcription or the wording is what went wrong.
   */
  const [heard, setHeard] = useState<string | null>(null);

  const logParsedSet = useCallback(
    async (
      exercise: string,
      weightKg: number | undefined,
      reps: number | undefined,
      command?: ParsedVoiceCommandExtended,
      durationSeconds?: number,
    ): Promise<{ ok: true } | { ok: false; reason: string }> => {
      const outcome = await onLogSet({
        exerciseName: exercise,
        weight: weightKg,
        reps,
        durationSeconds,
      });
      const result: VoiceSetLogResult = typeof outcome === 'boolean' ? { ok: outcome } : outcome;

      if (!result.ok) {
        const reason = result.reason ?? 'Could not save that set. Try logging it manually.';
        setStatus(null);
        setParseError(reason);
        return { ok: false, reason };
      }

      const loggedAs = result.loggedAs ?? exercise;
      setParseError(null);
      setStatus(`Logged ${loggedAs}`);
      if (command) {
        speakVoiceConfirmation(
          { ...command, exercise: loggedAs, reps: reps ?? command.reps },
          settings.voiceFeedback,
          units.weightLabel,
        );
      }
      return { ok: true };
    },
    [onLogSet, settings.voiceFeedback, units.weightLabel],
  );

  const handleTranscript = useCallback(
    async (transcript: string) => {
      setParseError(null);
      setSaveError(null);
      setStatus(null);
      setHeard(transcript.trim() || null);

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
        // A failed parse used to dead-end on a caption. Open the sheet seeded with the transcript
        // so the lifter can see what was heard and fix it rather than re-recording blind.
        setPending({
          parsed: { rawText: transcript, exercise: activeExerciseName },
          transcript,
          reason: result.error,
        });
        return;
      }

      const { parsed, requiresConfirmation, confirmationReason } = result.data;
      const weightKg = normalizeVoiceWeightToKg(parsed.weight, transcript, units.preferredWeightUnit);
      const isSetIntent = !parsed.intent || parsed.intent === 'log_set';
      const exerciseName = parsed.exercise?.trim() || activeExerciseName?.trim() || '';

      // What a set needs before it can be saved depends on the exercise. A hold is complete once
      // a duration is heard, since the time carries the effort. Everything else needs reps, and
      // needs a weight only when the exercise is actually loaded.
      //
      // A duration heard on a loaded lift is a mis-parse, not a hold — the time is dropped so the
      // sheet opens on weight and reps, which is what the lifter was trying to say.
      const isHold = parsed.durationSeconds != null && !requiresWeight;
      const heard = isHold ? parsed : { ...parsed, durationSeconds: undefined };
      const missingValues = isHold
        ? false
        : heard.reps == null || (requiresWeight && weightKg == null);

      // Anything other than a set — and anything the hardened parser flagged — goes to the sheet
      // rather than straight to the log.
      if (!isSetIntent || requiresConfirmation || !exerciseName || missingValues) {
        setPending({
          parsed: { ...heard, exercise: exerciseName || heard.exercise },
          transcript,
          weightKg,
          reason: confirmationReason,
        });
        return;
      }

      await logParsedSet(exerciseName, weightKg, heard.reps, heard, heard.durationSeconds);
    },
    [userId, activeExerciseName, lastWeightKg, lastReps, requiresWeight, units.preferredWeightUnit, logParsedSet],
  );

  const voice = useVoiceRecognition({
    inputMode: settings.inputMode === 'push_to_talk' ? 'tap_toggle' : settings.inputMode,
    enabled: !disabled,
    onFinalTranscript: (text) => void handleTranscript(text),
  });

  async function handleConfirm(set: ConfirmedVoiceSet) {
    setSaving(true);
    setSaveError(null);
    const exerciseName = set.exercise.trim() || activeExerciseName?.trim() || '';
    const result = await logParsedSet(
      exerciseName,
      set.weightKg,
      set.reps,
      pending?.parsed,
      set.durationSeconds,
    );
    setSaving(false);
    if (result.ok) {
      setPending(null);
      setSaveError(null);
      voice.clearTranscript();
      return;
    }
    // Keep the sheet open and surface the refusal here — the caption under the mic is covered.
    setSaveError(result.reason);
  }

  function handleReject() {
    setPending(null);
    setParseError(null);
    setSaveError(null);
    voice.clearTranscript();
  }

  // The mic prints its own failure, so a second copy here just stacked the same sentence twice.
  const micShowsError = voice.state === 'error' && Boolean(voice.error);

  return (
    <View style={styles.wrapper}>
      <MicrophoneButton
        state={voice.state}
        inputMode={voice.inputMode}
        disabled={disabled}
        errorMessage={voice.error}
        onPress={() => {
          setHeard(null);
          void voice.handleMicPress();
        }}
        onPressIn={() => {
          setHeard(null);
          void voice.handlePressIn();
        }}
        onPressOut={voice.handlePressOut}
      />

      {heard ? (
        <AppText variant="body" align="center" numberOfLines={4}>
          Heard: &quot;{heard}&quot;
        </AppText>
      ) : null}

      {voice.error && !micShowsError ? (
        <AppText variant="caption" color="error" align="center">
          {voice.error}
        </AppText>
      ) : parseError ? (
        <AppText variant="caption" color="error" align="center">
          {parseError}
        </AppText>
      ) : voice.state === 'recording' ? (
        <AppText variant="caption" color="accent" align="center">
          {voice.isHearingSpeech ? 'Hearing you… pause when you\u2019re done' : 'Listening… speak your set'}
        </AppText>
      ) : voice.state === 'transcribing' ? (
        <AppText variant="caption" color="accent" align="center">
          Transcribing…
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

      {voice.state === 'error' && voice.lastCapture ? (
        <AppText variant="caption" color="textTertiary" align="center">
          {`Mic: ${voice.lastCapture.seconds}s · ${voice.lastCapture.kilobytes} KB · ${
            voice.lastCapture.heardSpeech ? 'speech detected' : 'no speech detected'
          }`}
        </AppText>
      ) : null}

      <VoiceConfirmModal
        visible={pending !== null}
        parsed={pending?.parsed ?? null}
        transcript={pending?.transcript ?? ''}
        weightKg={pending?.weightKg}
        activeExerciseName={activeExerciseName}
        reason={pending?.reason}
        saveError={saveError}
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
