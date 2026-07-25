import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BodyCompositionSummary } from '@/components/body/BodyCompositionSummary';
import { CoachInsightsPanel } from '@/components/body/CoachInsightsPanel';
import { CoachProjectionCard } from '@/components/body/CoachProjectionCard';
import { PhotoProgressGuide } from '@/components/body/PhotoProgressGuide';
import { TransformationMilestones } from '@/components/body/TransformationMilestones';
import { TransformationProgressTimeline } from '@/components/body/TransformationProgressTimeline';
import { TransformationStoryHero } from '@/components/body/TransformationStoryHero';
import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { FeatureGate } from '@/components/subscription/PremiumGate';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useEntitlement } from '@/hooks/useEntitlement';
import { useUnits } from '@/hooks/useUnits';
import { screenDataCache } from '@/lib/screenDataCache';
import { buildTransformationStory, normalizeBodyCompositionSnapshot } from '@/lib/transformation/transformationStory';
import { bodyService } from '@/services/bodyService';
import { productAnalyticsService } from '@/services/productAnalyticsService';
import type { BodyCompositionRecord, PhotoAngle, ProgressPhoto } from '@/types';
import { TRANSFORMATION_BF_PRESETS, type TransformationProjection } from '@/types/transformation';

function isValidProjection(projection: TransformationProjection | null): projection is TransformationProjection {
  if (!projection) return false;
  if (!Number.isFinite(projection.targetBodyFatPct)) return false;
  return (
    normalizeBodyCompositionSnapshot(projection.current) != null &&
    normalizeBodyCompositionSnapshot(projection.projected) != null
  );
}

export default function ProgressScreen() {
  const { user } = useAuth();
  const units = useUnits();
  const { allowed: transformationAllowed } = useEntitlement('transformation-engine');
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [measurements, setMeasurements] = useState<BodyCompositionRecord[]>([]);
  const [transformation, setTransformation] = useState<TransformationProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningTransform, setRunningTransform] = useState(false);
  const [showLogForm, setShowLogForm] = useState(false);
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [targetBf, setTargetBf] = useState('12');
  const [uploadAngle, setUploadAngle] = useState<PhotoAngle>('front');
  const loadGenerationRef = useRef(0);
  const hydratedFromCacheRef = useRef(false);

  const story = useMemo(() => {
    if (!isValidProjection(transformation)) return null;
    try {
      return buildTransformationStory(transformation, measurements);
    } catch {
      return null;
    }
  }, [transformation, measurements]);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!user) {
      setLoading(false);
      return;
    }

    const generation = ++loadGenerationRef.current;
    const silent = options?.silent ?? hydratedFromCacheRef.current;
    if (!silent) setLoading(true);

    const [photosRes, bodyRes] = await Promise.all([
      bodyService.getProgressPhotos(user.id),
      bodyService.getCompositionHistory(user.id),
    ]);

    if (generation !== loadGenerationRef.current) return;

    const nextPhotos = photosRes.success ? photosRes.data : [];
    const nextMeasurements = bodyRes.success ? bodyRes.data : [];
    if (photosRes.success) setPhotos(nextPhotos);
    if (bodyRes.success) setMeasurements(nextMeasurements);
    setLoading(false);

    let nextTransformation: TransformationProjection | null = null;
    if (transformationAllowed) {
      const transformRes = await bodyService.getLatestTransformation(user.id);
      if (generation !== loadGenerationRef.current) return;
      if (transformRes.success) {
        nextTransformation = transformRes.data;
        setTransformation(transformRes.data);
      }
    }

    screenDataCache.writeProgress(user.id, {
      photos: nextPhotos,
      measurements: nextMeasurements,
      transformation: nextTransformation,
    });
  }, [user, transformationAllowed]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      const cached = await screenDataCache.readProgress(user.id);
      if (cancelled) return;

      if (cached) {
        setPhotos(cached.photos);
        setMeasurements(cached.measurements);
        setTransformation(cached.transformation);
        setLoading(false);
        hydratedFromCacheRef.current = true;
      }

      void load({ silent: hydratedFromCacheRef.current });
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, load]);

  async function handleUploadPhoto() {
    if (!user) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow photo library access to upload progress photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const upload = await bodyService.uploadFromPicker(user.id, result.assets[0].uri, uploadAngle);
    if (upload.success) {
      load();
    } else {
      Alert.alert('Upload failed', upload.error);
    }
  }

  async function handleSaveMeasurement() {
    if (!user) return;
    const weightKg = units.parseWeight(weight);
    const waistCm = units.parseMeasurement(waist);
    const bf = bodyFat ? parseFloat(bodyFat) : undefined;
    const leanMassKg =
      weightKg && bf != null ? Math.round(weightKg * (1 - bf / 100) * 100) / 100 : undefined;
    const result = await bodyService.recordComposition(user.id, {
      userId: user.id,
      recordedAt: new Date().toISOString(),
      weightKg,
      waistCm,
      bodyFatPct: bf,
      leanMassKg,
      estimationMethod: 'manual',
    });
    if (result.success) {
      setWeight('');
      setWaist('');
      setBodyFat('');
      setShowLogForm(false);
      load();
    } else {
      Alert.alert('Error', result.error);
    }
  }

  async function handleRunTransformation() {
    if (!user) return;
    if (measurements.length === 0 && !bodyFat) {
      Alert.alert('Log your stats', 'Add weight and body fat % so your coach can project your timeline.');
      setShowLogForm(true);
      return;
    }
    const sorted = [...photos].sort(
      (a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime(),
    );
    const beforePhoto = sorted[0];
    const currentPhoto = sorted[sorted.length - 1];
    setRunningTransform(true);
    const result = await bodyService.runTransformation(user.id, parseFloat(targetBf) || 12, {
      beforePhotoId: beforePhoto?.id,
      currentPhotoId: currentPhoto?.id ?? undefined,
    });
    setRunningTransform(false);
    if (result.success) {
      setTransformation(result.data);
      void productAnalyticsService.trackTransformation(user.id, parseFloat(targetBf) || 12);
    } else {
      Alert.alert('Projection failed', result.error);
    }
  }

  if (loading && photos.length === 0 && measurements.length === 0) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={LiftFlowColors.accent} />
        <AppText variant="caption" color="textSecondary">
          Loading your transformation…
        </AppText>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.loading}>
        <AppText variant="body" color="textSecondary">
          Sign in to track your transformation.
        </AppText>
      </View>
    );
  }

  return (
    <ScreenContainer keyboardAvoiding>
      <View style={styles.header}>
        <AppText variant="headline">Your Transformation</AppText>
        <AppText variant="body" color="textSecondary">
          Where you are, where you&apos;re going, and how to get there.
        </AppText>
      </View>

      <FeatureGate featureId="transformation-engine">
        {story ? (
          <>
            <TransformationStoryHero story={story} formatWeight={units.formatWeight} />
            <CoachProjectionCard
              story={story}
              formatWeight={units.formatWeight}
              weightUnit={units.preferredWeightUnit}
            />
            <TransformationProgressTimeline progressPercent={story.progressPercent} />
            <CoachInsightsPanel insights={story.coachInsights} />
            <TransformationMilestones milestones={story.milestones} />
          </>
        ) : (
          <Card style={styles.setupCard}>
            <AppText variant="label" color="accent">
              Start your story
            </AppText>
            <AppText variant="footnote" color="textSecondary">
              Log weight and body fat, set a goal, and your coach will map the path to your target physique.
            </AppText>
            <View style={styles.presets}>
              {TRANSFORMATION_BF_PRESETS.map((pct) => (
                <Pressable
                  key={pct}
                  style={[styles.presetChip, targetBf === String(pct) && styles.presetActive]}
                  onPress={() => setTargetBf(String(pct))}>
                  <AppText variant="caption">{pct}% goal</AppText>
                </Pressable>
              ))}
            </View>
            <PrimaryButton
              label={runningTransform ? 'Building projection…' : 'Generate coach projection'}
              onPress={handleRunTransformation}
              disabled={runningTransform}
            />
          </Card>
        )}

        {story ? (
          <Pressable onPress={handleRunTransformation} disabled={runningTransform}>
            <AppText variant="caption" color="accent" style={styles.refreshLink}>
              Refresh projection
            </AppText>
          </Pressable>
        ) : null}
      </FeatureGate>

      <PhotoProgressGuide
        photos={photos}
        uploadAngle={uploadAngle}
        onSelectAngle={setUploadAngle}
        onUpload={handleUploadPhoto}
      />

      <BodyCompositionSummary
        latestMeasurement={measurements[0]}
        projection={transformationAllowed ? transformation : null}
        formatWeight={units.formatWeight}
      />

      <Pressable onPress={() => setShowLogForm((value) => !value)}>
        <AppText variant="label" color="accent">
          {showLogForm ? 'Hide log form' : 'Log measurement'}
        </AppText>
      </Pressable>

      {showLogForm ? (
        <Card style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder={`Weight (${units.weightLabel})`}
            placeholderTextColor={LiftFlowColors.textTertiary}
            keyboardType="numeric"
            value={weight}
            onChangeText={setWeight}
          />
          <TextInput
            style={styles.input}
            placeholder={`Waist (${units.measurementLabel})`}
            placeholderTextColor={LiftFlowColors.textTertiary}
            keyboardType="numeric"
            value={waist}
            onChangeText={setWaist}
          />
          <TextInput
            style={styles.input}
            placeholder="Body fat %"
            placeholderTextColor={LiftFlowColors.textTertiary}
            keyboardType="numeric"
            value={bodyFat}
            onChangeText={setBodyFat}
          />
          <PrimaryButton label="Save measurement" onPress={handleSaveMeasurement} />
        </Card>
      ) : null}

      <AppText variant="caption" color="textTertiary" style={styles.disclaimer}>
        Projections are coach estimates from your logged data — not medical advice.
      </AppText>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: LiftFlowColors.background,
  },
  header: {
    gap: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  setupCard: { gap: Spacing.md, marginBottom: Spacing.lg },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  presetChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  presetActive: {
    borderColor: LiftFlowColors.accent,
    backgroundColor: LiftFlowColors.accentGlow,
  },
  refreshLink: { marginBottom: Spacing.lg, textAlign: 'center' },
  form: { gap: Spacing.md, marginTop: Spacing.md, marginBottom: Spacing.lg },
  input: {
    backgroundColor: LiftFlowColors.background,
    borderRadius: 8,
    padding: Spacing.md,
    color: LiftFlowColors.textPrimary,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  disclaimer: {
    marginBottom: Spacing.xxxl,
  },
});
