import { ResizeMode, Video } from 'expo-av';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Radius, Spacing } from '@/constants/theme';
import { guideHasStructure, type ExerciseFormGuide } from '@/lib/exerciseGuideTypes';

type ExerciseMovementMediaProps = {
  guide: ExerciseFormGuide;
  exerciseName: string;
};

function IllustratedMovementCard({ guide }: { guide: ExerciseFormGuide }) {
  if (guideHasStructure(guide)) return null;

  const steps = guide.illustratedSteps ?? [];
  if (steps.length === 0) return null;

  return (
    <View style={styles.illustratedCard}>
      <AppText variant="label" color="textSecondary">
        Movement breakdown
      </AppText>
      {steps.map((step, index) => (
        <View key={`${step.label}-${index}`} style={styles.illustratedStep}>
          <View style={styles.illustratedBadge}>
            <AppText variant="caption" color="accent">
              {index + 1}
            </AppText>
          </View>
          <View style={styles.illustratedCopy}>
            <AppText variant="footnote" color="accent">
              {step.label}
            </AppText>
            <AppText variant="body" color="textPrimary">
              {step.description}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

function GifMedia({ url }: { url: string }) {
  return (
    <Image
      source={{ uri: url }}
      style={styles.mediaFrame}
      contentFit="contain"
      accessibilityLabel="Exercise demonstration"
    />
  );
}

function Mp4Media({ url, posterUrl }: { url: string; posterUrl?: string }) {
  const ref = useRef<Video>(null);

  useEffect(() => {
    void ref.current?.playAsync();
    return () => {
      void ref.current?.stopAsync();
    };
  }, [url]);

  return (
    <Video
      ref={ref}
      source={{ uri: url }}
      style={styles.mediaFrame}
      resizeMode={ResizeMode.CONTAIN}
      isLooping
      isMuted
      shouldPlay
      usePoster={Boolean(posterUrl)}
      posterSource={posterUrl ? { uri: posterUrl } : undefined}
    />
  );
}

function ImageSequenceMedia({ frames }: { frames: string[] }) {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (frames.length <= 1) return;
    const timer = setInterval(() => {
      setFrameIndex((current) => (current + 1) % frames.length);
    }, 900);
    return () => clearInterval(timer);
  }, [frames]);

  const uri = frames[frameIndex] ?? frames[0];
  if (!uri) return null;

  return (
    <Image
      source={{ uri }}
      style={styles.mediaFrame}
      contentFit="contain"
      accessibilityLabel="Exercise movement sequence"
    />
  );
}

export function ExerciseMovementMedia({ guide, exerciseName }: ExerciseMovementMediaProps) {
  const media = guide.media;

  if (!media) {
    return <IllustratedMovementCard guide={guide} />;
  }

  return (
    <View style={styles.mediaCard}>
      <AppText variant="label" color="textSecondary">
        Demo — {exerciseName}
      </AppText>
      {media.type === 'gif' ? <GifMedia url={media.url} /> : null}
      {media.type === 'mp4' ? <Mp4Media url={media.url} posterUrl={media.posterUrl} /> : null}
      {media.type === 'image-sequence' && media.frames?.length ? (
        <ImageSequenceMedia frames={media.frames} />
      ) : null}
      {!media.frames?.length && media.type === 'image-sequence' ? (
        <IllustratedMovementCard guide={guide} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mediaCard: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.surface,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  mediaFrame: {
    width: '100%',
    height: 220,
    borderRadius: Radius.sm,
    backgroundColor: LiftFlowColors.background,
  },
  illustratedCard: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: LiftFlowColors.surface,
    borderWidth: 1,
    borderColor: LiftFlowColors.border,
  },
  illustratedStep: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  illustratedBadge: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(31, 107, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustratedCopy: {
    flex: 1,
    gap: 2,
  },
});
