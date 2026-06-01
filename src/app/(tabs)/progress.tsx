import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, View } from 'react-native';

import { BodyCompositionSummary } from '@/components/body/BodyCompositionSummary';
import { PhotoAnglePicker } from '@/components/body/PhotoAnglePicker';
import { PhotoTimeline } from '@/components/body/PhotoTimeline';
import { TransformationDashboard } from '@/components/body/TransformationDashboard';
import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FeatureGate } from '@/components/subscription/PremiumGate';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useEntitlement } from '@/hooks/useEntitlement';
import { useUnits } from '@/hooks/useUnits';
import { bodyService } from '@/services/bodyService';
import { productAnalyticsService } from '@/services/productAnalyticsService';
import type { BodyCompositionRecord, PhotoAngle, PhysiqueProjection, ProgressPhoto } from '@/types';
import type { TransformationProjection } from '@/types/transformation';

export default function ProgressScreen() {
  const { user } = useAuth();
  const units = useUnits();
  const { allowed: transformationAllowed } = useEntitlement('transformation-engine');
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [measurements, setMeasurements] = useState<BodyCompositionRecord[]>([]);
  const [projections, setProjections] = useState<PhysiqueProjection[]>([]);
  const [transformation, setTransformation] = useState<TransformationProjection | null>(null);
  const [transformHistory, setTransformHistory] = useState<TransformationProjection[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningTransform, setRunningTransform] = useState(false);
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [targetBf, setTargetBf] = useState('12');
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [uploadAngle, setUploadAngle] = useState<PhotoAngle>('front');

  const load = useCallback(async () => {
    if (!user) return;
    const [photosRes, bodyRes, projRes, transformRes, historyRes] = await Promise.all([
      bodyService.getProgressPhotos(user.id),
      bodyService.getCompositionHistory(user.id),
      transformationAllowed ? bodyService.getProjections(user.id) : Promise.resolve({ success: true as const, data: [] }),
      transformationAllowed ? bodyService.getLatestTransformation(user.id) : Promise.resolve({ success: true as const, data: null }),
      transformationAllowed ? bodyService.getTransformationHistory(user.id) : Promise.resolve({ success: true as const, data: [] }),
    ]);
    if (photosRes.success) setPhotos(photosRes.data);
    if (bodyRes.success) setMeasurements(bodyRes.data);
    if (projRes.success) setProjections(projRes.data);
    if (transformRes.success) setTransformation(transformRes.data);
    if (historyRes.success) setTransformHistory(historyRes.data);
    setLoading(false);
  }, [user, transformationAllowed]);

  useEffect(() => {
    load();
  }, [load]);

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
      setSelectedPhotoId(upload.data.id);
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
      load();
    } else {
      Alert.alert('Error', result.error);
    }
  }

  async function handleEstimateBodyFat() {
    if (!user || !selectedPhotoId) {
      Alert.alert('Select a photo', 'Upload or select a progress photo first.');
      return;
    }
    const result = await bodyService.estimateBodyFat(user.id, selectedPhotoId);
    if (result.success) {
      Alert.alert('Body Fat Estimate', `${result.data.bodyFatPct}% — ${result.data.analysis}`);
      load();
    } else {
      Alert.alert('Error', result.error);
    }
  }

  async function handleGenerateProjection() {
    if (!user || !selectedPhotoId) {
      Alert.alert('Select a photo', 'Upload a current photo first.');
      return;
    }
    const result = await bodyService.generatePhysiqueProjection(user.id, selectedPhotoId, targetBf);
    if (result.success) {
      load();
      Alert.alert('Projection saved', 'View comparison in the dashboard.');
    } else {
      Alert.alert('Error', result.error);
    }
  }

  async function handleRunTransformation() {
    if (!user) return;
    if (photos.length === 0) {
      Alert.alert('Add a photo', 'Upload at least one progress photo to run a transformation projection.');
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
      currentPhotoId: currentPhoto?.id ?? selectedPhotoId ?? undefined,
    });
    setRunningTransform(false);
    if (result.success) {
      setTransformation(result.data);
      void productAnalyticsService.trackTransformation(user.id, parseFloat(targetBf) || 12);
      const history = await bodyService.getTransformationHistory(user.id);
      if (history.success) setTransformHistory(history.data);
    } else {
      Alert.alert('Transformation failed', result.error);
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={LiftFlowColors.accent} />
      </View>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <AppText variant="headline">Progress</AppText>
        <AppText variant="body" color="textSecondary">
          Photo timeline, body composition, and transformation projections
        </AppText>
      </View>

      <SectionHeader title="Photo Timeline" />
      <PhotoAnglePicker value={uploadAngle} onChange={setUploadAngle} />
      <PrimaryButton label="Upload Photo" onPress={handleUploadPhoto} variant="secondary" />
      <PhotoTimeline photos={photos} selectedId={selectedPhotoId} onSelect={(p) => setSelectedPhotoId(p.id)} />

      <SectionHeader title="Body Measurements" />
      <BodyCompositionSummary
        latestMeasurement={measurements[0]}
        projection={transformationAllowed ? transformation : null}
        formatWeight={units.formatWeight}
      />
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
        <PrimaryButton label="Save Measurement" onPress={handleSaveMeasurement} />
      </Card>

      <SectionHeader title="Transformation Engine" />
      <FeatureGate featureId="transformation-engine">
        <TransformationDashboard
          photos={photos}
          measurements={measurements}
          projection={transformation}
          history={transformHistory}
          targetBf={targetBf}
          onTargetBfChange={setTargetBf}
          onRun={handleRunTransformation}
          running={runningTransform}
          formatWeight={units.formatWeight}
          projectedImageUrl={projections[0]?.projectedImageUrl}
        />
        <Card style={styles.form}>
          <PrimaryButton label="Estimate Body Fat (AI)" onPress={handleEstimateBodyFat} variant="secondary" />
          <PrimaryButton label="Generate AI Physique Image" onPress={handleGenerateProjection} variant="secondary" />
        </Card>
      </FeatureGate>

      <AppText variant="caption" color="textTertiary" style={styles.disclaimer}>
        Projections are estimates based on your logged data — not medical advice.
      </AppText>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LiftFlowColors.background,
  },
  header: {
    gap: Spacing.xs,
    marginBottom: Spacing.xxl,
  },
  form: {
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
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
