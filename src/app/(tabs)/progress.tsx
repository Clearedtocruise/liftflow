import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useUnits } from '@/hooks/useUnits';
import { bodyService } from '@/services/bodyService';
import type { BodyCompositionRecord, PhysiqueProjection, ProgressPhoto } from '@/types';

export default function ProgressScreen() {
  const { user } = useAuth();
  const units = useUnits();
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [measurements, setMeasurements] = useState<BodyCompositionRecord[]>([]);
  const [projections, setProjections] = useState<PhysiqueProjection[]>([]);
  const [loading, setLoading] = useState(true);
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [targetBf, setTargetBf] = useState('12');
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [photosRes, bodyRes, projRes] = await Promise.all([
      bodyService.getProgressPhotos(user.id),
      bodyService.getCompositionHistory(user.id),
      bodyService.getProjections(user.id),
    ]);
    if (photosRes.success) setPhotos(photosRes.data);
    if (bodyRes.success) setMeasurements(bodyRes.data);
    if (projRes.success) setProjections(projRes.data);
    setLoading(false);
  }, [user]);

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

    const upload = await bodyService.uploadFromPicker(user.id, result.assets[0].uri, 'front');
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
    const result = await bodyService.recordComposition(user.id, {
      userId: user.id,
      recordedAt: new Date().toISOString(),
      weightKg,
      waistCm,
      bodyFatPct: bodyFat ? parseFloat(bodyFat) : undefined,
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
      Alert.alert('Projection saved', 'View comparison below.');
    } else {
      Alert.alert('Error', result.error);
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={LiftFlowColors.accent} />
      </View>
    );
  }

  const beforePhoto = photos[photos.length - 1];
  const afterPhoto = photos[0];

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <AppText variant="headline">Progress</AppText>
        <AppText variant="body" color="textSecondary">
          Photos, measurements, and projections
        </AppText>
      </View>

      <SectionHeader title="Progress Photos" />
      <PrimaryButton label="Upload Photo" onPress={handleUploadPhoto} variant="secondary" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
        {photos.map((photo) => (
          <PressablePhoto
            key={photo.id}
            photo={photo}
            selected={selectedPhotoId === photo.id}
            onSelect={() => setSelectedPhotoId(photo.id)}
          />
        ))}
      </ScrollView>

      {beforePhoto && afterPhoto && beforePhoto.id !== afterPhoto.id ? (
        <>
          <SectionHeader title="Before / After" />
          <View style={styles.comparisonRow}>
            <Image source={{ uri: beforePhoto.photoUrl }} style={styles.comparisonImage} />
            <Image source={{ uri: afterPhoto.photoUrl }} style={styles.comparisonImage} />
          </View>
        </>
      ) : null}

      <SectionHeader title="Body Measurements" />
      <Card style={styles.form}>
        <TextInput style={styles.input} placeholder={`Weight (${units.weightLabel})`} placeholderTextColor={LiftFlowColors.textTertiary} keyboardType="numeric" value={weight} onChangeText={setWeight} />
        <TextInput style={styles.input} placeholder={`Waist (${units.measurementLabel})`} placeholderTextColor={LiftFlowColors.textTertiary} keyboardType="numeric" value={waist} onChangeText={setWaist} />
        <TextInput style={styles.input} placeholder="Body fat %" placeholderTextColor={LiftFlowColors.textTertiary} keyboardType="numeric" value={bodyFat} onChangeText={setBodyFat} />
        <PrimaryButton label="Save Measurement" onPress={handleSaveMeasurement} />
      </Card>

      {measurements.length > 0 ? (
        <Card>
          {measurements.slice(0, 5).map((m) => (
            <View key={m.id} style={styles.measureRow}>
              <AppText variant="footnote" color="textSecondary">
                {new Date(m.recordedAt).toLocaleDateString()}
              </AppText>
              <AppText variant="bodyBold">
                {m.weightKg ? units.formatWeight(m.weightKg) : '—'}
                {m.waistCm ? ` · ${units.formatMeasurement(m.waistCm)} waist` : ''}
              </AppText>
            </View>
          ))}
        </Card>
      ) : null}

      <SectionHeader title="Physique Projection" />
      <Card style={styles.form}>
        <TextInput style={styles.input} placeholder="Target body fat %" placeholderTextColor={LiftFlowColors.textTertiary} keyboardType="numeric" value={targetBf} onChangeText={setTargetBf} />
        <PrimaryButton label="Estimate Body Fat" onPress={handleEstimateBodyFat} variant="secondary" />
        <PrimaryButton label="Generate Projection" onPress={handleGenerateProjection} />
      </Card>

      {projections.length > 0 ? (
        <View style={styles.projectionRow}>
          {projections[0].projectedImageUrl ? (
            <Image source={{ uri: projections[0].projectedImageUrl }} style={styles.projectionImage} />
          ) : null}
          <AppText variant="footnote" color="textSecondary">
            Target: {projections[0].targetBodyFatPct}% body fat
          </AppText>
        </View>
      ) : null}
    </ScreenContainer>
  );
}

function PressablePhoto({
  photo,
  selected,
  onSelect,
}: {
  photo: ProgressPhoto;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <View style={[styles.photoWrap, selected && styles.photoSelected]}>
      <Image source={{ uri: photo.photoUrl }} style={styles.photo} />
      <PrimaryButton label={selected ? 'Selected' : 'Select'} onPress={onSelect} variant="secondary" />
    </View>
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
  photoScroll: {
    marginVertical: Spacing.lg,
  },
  photoWrap: {
    marginRight: Spacing.md,
    gap: Spacing.sm,
    width: 140,
  },
  photoSelected: {
    opacity: 1,
  },
  photo: {
    width: 140,
    height: 180,
    borderRadius: 8,
    backgroundColor: LiftFlowColors.surface,
  },
  comparisonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  comparisonImage: {
    flex: 1,
    height: 200,
    borderRadius: 8,
    backgroundColor: LiftFlowColors.surface,
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
  measureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  projectionRow: {
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  projectionImage: {
    width: '100%',
    height: 240,
    borderRadius: 8,
    backgroundColor: LiftFlowColors.surface,
  },
});
