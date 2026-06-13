import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { Card } from '@/components/layout/Card';
import { PrimaryButton } from '@/components/layout/PrimaryButton';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import {
  feedbackService,
  type FeedbackArea,
  type FeedbackIssueCategory,
  type FeedbackType,
} from '@/services/feedbackService';
import { productAnalyticsService } from '@/services/productAnalyticsService';

const TYPES: Array<{ id: FeedbackType; label: string; hint: string }> = [
  { id: 'bug', label: 'Report a bug', hint: 'What broke? Steps to reproduce help us fix it fast.' },
  {
    id: 'confusion',
    label: 'Something confused me',
    hint: 'Where did you get stuck? What did you expect instead?',
  },
  { id: 'feature', label: 'Request a feature', hint: 'What would make ONE MORE better for your training?' },
  { id: 'support', label: 'Contact support', hint: 'Account, billing, or general help.' },
];

const AREAS: Array<{ id: FeedbackArea; label: string }> = [
  { id: 'workout', label: 'Workout' },
  { id: 'coach', label: 'AI Coach' },
  { id: 'nutrition', label: 'Nutrition' },
  { id: 'recovery', label: 'Recovery' },
  { id: 'voice', label: 'Voice' },
  { id: 'subscription', label: 'Subscription' },
  { id: 'onboarding', label: 'Onboarding' },
  { id: 'other', label: 'Other' },
];

function defaultIssueCategory(type: FeedbackType, missingFeature: boolean): FeedbackIssueCategory {
  if (type === 'confusion') return 'confusion';
  if (type === 'bug') return 'crash';
  if (type === 'feature') return missingFeature ? 'missing_feature' : 'feature_request';
  return 'support';
}

export default function SendFeedbackScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: FeedbackType }>();
  const initialType = useMemo(() => {
    const t = params.type;
    return t && TYPES.some((item) => item.id === t) ? t : 'bug';
  }, [params.type]);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>(initialType);
  const [area, setArea] = useState<FeedbackArea>('workout');
  const [missingFeature, setMissingFeature] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function pickScreenshot() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow photo access to attach a screenshot.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setScreenshotUri(result.assets[0].uri);
  }

  async function handleSubmit() {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to send feedback.');
      return;
    }
    if (!subject.trim() || !body.trim()) {
      Alert.alert('Missing info', 'Subject and description are required.');
      return;
    }
    setSubmitting(true);
    const result = await feedbackService.submit({
      userId: user.id,
      feedbackType,
      subject: subject.trim(),
      body: body.trim(),
      screenshotUri: screenshotUri ?? undefined,
      area,
      issueCategory: defaultIssueCategory(feedbackType, missingFeature),
    });
    setSubmitting(false);
    if (result.success) {
      void productAnalyticsService.trackFeedback(user.id, feedbackType);
      Alert.alert('Thank you', result.data.message, [{ text: 'OK', onPress: () => router.back() }]);
    } else {
      Alert.alert('Could not send', result.error);
    }
  }

  const active = TYPES.find((t) => t.id === feedbackType);

  return (
    <ScreenContainer>
      <AppText variant="title">Send Feedback</AppText>
      <AppText variant="body" color="textSecondary" style={styles.subtitle}>
        Beta feedback goes directly to the ONE MORE team with device and app metadata.
      </AppText>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow}>
        {TYPES.map((t) => (
          <PrimaryButton
            key={t.id}
            label={t.label}
            variant={feedbackType === t.id ? 'primary' : 'secondary'}
            onPress={() => setFeedbackType(t.id)}
          />
        ))}
      </ScrollView>

      {active ? (
        <AppText variant="footnote" color="textTertiary" style={styles.hint}>
          {active.hint}
        </AppText>
      ) : null}

      <AppText variant="label" color="textSecondary">
        Area
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.areaRow}>
        {AREAS.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setArea(item.id)}
            style={[styles.areaChip, area === item.id && styles.areaChipActive]}>
            <AppText variant="caption" color={area === item.id ? 'accent' : 'textSecondary'}>
              {item.label}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>

      {feedbackType === 'feature' ? (
        <Pressable onPress={() => setMissingFeature((value) => !value)} style={styles.missingToggle}>
          <AppText variant="footnote" color={missingFeature ? 'accent' : 'textSecondary'}>
            {missingFeature ? '✓ ' : '○ '}This capability should already exist (missing feature)
          </AppText>
        </Pressable>
      ) : null}

      <Card style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Subject"
          placeholderTextColor={LiftFlowColors.textTertiary}
          value={subject}
          onChangeText={setSubject}
        />
        <TextInput
          style={[styles.input, styles.bodyInput]}
          placeholder="Describe in detail…"
          placeholderTextColor={LiftFlowColors.textTertiary}
          value={body}
          onChangeText={setBody}
          multiline
        />
        {screenshotUri ? <Image source={{ uri: screenshotUri }} style={styles.screenshot} /> : null}
        <PrimaryButton
          label={screenshotUri ? 'Change screenshot' : 'Attach screenshot'}
          onPress={pickScreenshot}
          variant="secondary"
        />
        <PrimaryButton label={submitting ? 'Sending…' : 'Submit feedback'} onPress={handleSubmit} disabled={submitting} />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginBottom: Spacing.lg },
  typeRow: { marginBottom: Spacing.md },
  hint: { marginBottom: Spacing.lg },
  areaRow: { marginBottom: Spacing.md },
  areaChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
    marginRight: Spacing.sm,
  },
  areaChipActive: {
    borderColor: LiftFlowColors.accent,
    backgroundColor: LiftFlowColors.accentGlow,
  },
  missingToggle: { marginBottom: Spacing.md },
  form: { gap: Spacing.md },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LiftFlowColors.border,
    borderRadius: 12,
    padding: Spacing.md,
    color: LiftFlowColors.textPrimary,
  },
  bodyInput: { minHeight: 120, textAlignVertical: 'top' },
  screenshot: { width: '100%', height: 160, borderRadius: 8 },
});
