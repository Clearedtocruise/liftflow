import { mapMetric, mapPreferences, mapProfile } from '@/lib/db-mappers';
import { fail, fromError, ok } from '@/lib/serviceResult';
import { preferredUnitsFromGranular } from '@/lib/unitConversion';
import type { IUserService } from '@/services/interfaces';
import { supabase } from '@/supabase/client';

export const userService: IUserService = {
  async getProfile(userId) {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (error) return fail(error.message);
      return ok(mapProfile(data));
    } catch (e) {
      return fromError(e);
    }
  },

  async updateProfile(userId, updates) {
    try {
      const payload: Record<string, unknown> = {};
      if (updates.displayName !== undefined) payload.display_name = updates.displayName;
      if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;
      if (updates.dateOfBirth !== undefined) payload.date_of_birth = updates.dateOfBirth;
      if (updates.sex !== undefined) payload.sex = updates.sex;
      if (updates.heightCm !== undefined) payload.height_cm = updates.heightCm;
      if (updates.weightKg !== undefined) payload.weight_kg = updates.weightKg;
      if (updates.bodyFatPct !== undefined) payload.body_fat_pct = updates.bodyFatPct;
      if (updates.trainingExperience !== undefined) payload.training_experience = updates.trainingExperience;
      if (updates.fitnessGoals !== undefined) payload.fitness_goals = updates.fitnessGoals;
      if (updates.preferredUnits !== undefined) payload.preferred_units = updates.preferredUnits;
      if (updates.preferredHeightUnit !== undefined) payload.preferred_height_unit = updates.preferredHeightUnit;
      if (updates.preferredWeightUnit !== undefined) payload.preferred_weight_unit = updates.preferredWeightUnit;
      if (updates.preferredDistanceUnit !== undefined) payload.preferred_distance_unit = updates.preferredDistanceUnit;
      if (updates.preferredMeasurementUnit !== undefined) {
        payload.preferred_measurement_unit = updates.preferredMeasurementUnit;
      }
      if (updates.preferredWaterUnit !== undefined) payload.preferred_water_unit = updates.preferredWaterUnit;

      const granularKeys = [
        'preferredHeightUnit',
        'preferredWeightUnit',
        'preferredDistanceUnit',
        'preferredMeasurementUnit',
        'preferredWaterUnit',
      ] as const;
      if (granularKeys.some((key) => updates[key] !== undefined) && updates.preferredUnits === undefined) {
        const merged = {
          preferredHeightUnit: updates.preferredHeightUnit,
          preferredWeightUnit: updates.preferredWeightUnit,
          preferredDistanceUnit: updates.preferredDistanceUnit,
          preferredMeasurementUnit: updates.preferredMeasurementUnit,
          preferredWaterUnit: updates.preferredWaterUnit,
        };
        const hasAll = granularKeys.every((key) => merged[key] != null);
        if (hasAll) {
          payload.preferred_units = preferredUnitsFromGranular({
            preferredHeightUnit: merged.preferredHeightUnit!,
            preferredWeightUnit: merged.preferredWeightUnit!,
            preferredDistanceUnit: merged.preferredDistanceUnit!,
            preferredMeasurementUnit: merged.preferredMeasurementUnit!,
            preferredWaterUnit: merged.preferredWaterUnit!,
          });
        }
      }
      if (updates.confirmationMode !== undefined) payload.confirmation_mode = updates.confirmationMode;
      if (updates.timezone !== undefined) payload.timezone = updates.timezone;
      if (updates.trainingLocation !== undefined) payload.training_location = updates.trainingLocation;
      if (updates.primaryGymName !== undefined) payload.primary_gym_name = updates.primaryGymName;
      if (updates.availableEquipment !== undefined) payload.available_equipment = updates.availableEquipment;
      if (updates.primaryTrainingGoal !== undefined) payload.primary_training_goal = updates.primaryTrainingGoal;
      if (updates.strengthBaselines !== undefined) payload.strength_baselines = updates.strengthBaselines;
      if (updates.onboardingCompleted !== undefined) payload.onboarding_completed = updates.onboardingCompleted;
      if (updates.metadata !== undefined) payload.metadata = updates.metadata;

      const { data, error } = await supabase.from('profiles').update(payload).eq('id', userId).select('*').single();
      if (error) return fail(error.message);
      return ok(mapProfile(data));
    } catch (e) {
      return fromError(e);
    }
  },

  async getPreferences(userId) {
    try {
      const { data, error } = await supabase.from('user_preferences').select('*').eq('user_id', userId).single();
      if (error) return fail(error.message);
      return ok(mapPreferences(data));
    } catch (e) {
      return fromError(e);
    }
  },

  async updatePreferences(userId, updates) {
    try {
      const payload: Record<string, unknown> = {};
      if (updates.restTimerSound !== undefined) payload.rest_timer_sound = updates.restTimerSound;
      if (updates.restTimerHaptics !== undefined) payload.rest_timer_haptics = updates.restTimerHaptics;
      if (updates.voiceFeedback !== undefined) payload.voice_feedback = updates.voiceFeedback;
      if (updates.showAds !== undefined) payload.show_ads = updates.showAds;
      if (updates.shareAnalytics !== undefined) payload.share_analytics = updates.shareAnalytics;
      if (updates.printerFriendlyDefault !== undefined) payload.printer_friendly_default = updates.printerFriendlyDefault;
      if (updates.notificationPreferences !== undefined) payload.notification_preferences = updates.notificationPreferences;
      if (updates.coachingPreferences !== undefined) payload.coaching_preferences = updates.coachingPreferences;
      if (updates.privacySettings !== undefined) payload.privacy_settings = updates.privacySettings;

      const { data, error } = await supabase
        .from('user_preferences')
        .update(payload)
        .eq('user_id', userId)
        .select('*')
        .single();
      if (error) return fail(error.message);
      return ok(mapPreferences(data));
    } catch (e) {
      return fromError(e);
    }
  },

  async recordMetric(userId, metric) {
    try {
      const { data, error } = await supabase
        .from('user_metrics')
        .insert({
          user_id: userId,
          recorded_at: metric.recordedAt,
          weight_kg: metric.weightKg,
          height_cm: metric.heightCm,
          body_fat_pct: metric.bodyFatPct,
          muscle_mass_kg: metric.muscleMassKg,
          resting_heart_rate: metric.restingHeartRate,
          vo2_max: metric.vo2Max,
          source: metric.source,
          notes: metric.notes,
        })
        .select('*')
        .single();
      if (error) return fail(error.message);

      if (metric.weightKg) {
        await supabase.from('profiles').update({ weight_kg: metric.weightKg }).eq('id', userId);
      }

      return ok(mapMetric(data));
    } catch (e) {
      return fromError(e);
    }
  },

  async getMetrics(userId, limit = 30) {
    try {
      const { data, error } = await supabase
        .from('user_metrics')
        .select('*')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: false })
        .limit(limit);
      if (error) return fail(error.message);
      return ok((data ?? []).map(mapMetric));
    } catch (e) {
      return fromError(e);
    }
  },
};
