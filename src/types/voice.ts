import type { ConfirmationMode } from './common';
import type { ParsedVoiceCommand } from './workout';

/** How the microphone is activated during workouts */
export type VoiceInputMode = 'push_to_talk' | 'tap_toggle' | 'continuous';

/** Parsed voice intent — extends workout command with control intents */
export type VoiceIntent =
  | 'log_set'
  | 'completed_set'
  | 'adjust_weight'
  | 'feedback'
  | 'undo_last_set'
  | 'delete_last_set'
  | 'next_set'
  | 'declare_exercise'
  | 'recovery_query'
  | 'train_today_query'
  | 'build_workout'
  | 'nutrition_query'
  | 'grocery_list_query'
  | 'coach_query'
  | 'play_peak'
  | 'start_at_chorus'
  | 'sync_next_set'
  | 'use_pr_song'
  | 'resume_playlist'
  | 'next_hype_song'
  | 'sync_music_next_set'
  | 'transformation_query'
  | 'transformation_progress'
  | 'transformation_target_bf';

/**
 * `intent` is omitted before widening: intersecting two optional unions narrows the property to
 * their overlap, which silently made every control intent below unassignable.
 */
export type ParsedVoiceCommandExtended = Omit<ParsedVoiceCommand, 'intent'> & {
  intent?: VoiceIntent;
  /** Explicit target weight e.g. "increase to 235" */
  targetWeight?: number;
  weightUnit?: 'lb' | 'kg';
  /** Resolved exercise when user says "same weight" without naming exercise */
  usesContextWeight?: boolean;
  usesContextExercise?: boolean;
  recoveryVoiceLine?: string;
  trainTodayVoiceLine?: string;
  buildWorkoutVoiceLine?: string;
  nutritionVoiceLine?: string;
  groceryVoiceLine?: string;
  targetBodyFatPct?: number;
  transformationVoiceLine?: string;
  /** A value failed a range check — must never auto-commit. */
  implausible?: boolean;
  /** Weight/reps order was inferred from magnitude, not from the wording. */
  ambiguousOrder?: boolean;
  /** The utterance described more sets than were parsed. */
  multipleSetsHeard?: boolean;
  validationReason?: string;
};

export type VoiceParseContext = {
  activeExerciseName?: string;
  lastWeight?: number;
  lastReps?: number;
  preferredWeightUnit?: 'lb' | 'kg';
  setNumber?: number;
};

export type VoiceSettings = {
  /** Profile confirmation_mode — always | smart | none */
  confirmationMode: ConfirmationMode;
  /** When true, skip confirmation modal even in smart mode if confidence high */
  autoLog: boolean;
  /** Speak/haptic feedback after successful log */
  voiceFeedback: boolean;
  /** Default tap-to-toggle for one-touch logging */
  inputMode: VoiceInputMode;
  /** Future: "Hey ONE MORE" wake phrase */
  wakePhraseEnabled: boolean;
};

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  confirmationMode: 'smart',
  autoLog: true,
  voiceFeedback: true,
  inputMode: 'tap_toggle',
  wakePhraseEnabled: false,
};

export type VoiceRecognitionState = {
  isAvailable: boolean;
  isListening: boolean;
  interimTranscript: string;
  finalTranscript: string;
  error: string | null;
};

export type ProcessVoiceResult = {
  parsed: ParsedVoiceCommandExtended;
  confidence: number;
  requiresConfirmation: boolean;
  confirmationReason?: string;
};
