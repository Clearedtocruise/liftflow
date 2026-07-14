import { ResizeMode, Video } from 'expo-av';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type ImageStyle } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import type { AppTheme } from '@/constants/themes';
import { useThemedStyles } from '@/hooks/useLiftFlowTheme';
import { guideHasStructure, type ExerciseFormGuide } from '@/lib/exerciseGuideTypes';

type ExerciseMovementMediaProps = {
  guide: ExerciseFormGuide;
  exerciseName: string;
};

function IllustratedMovementCard({
  guide,
  styles,
}: {
  guide: ExerciseFormGuide;
  styles: ReturnType<typeof createStyles>;
}) {
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

function GifMedia({ url, frameStyle }: { url: string; frameStyle: ImageStyle }) {
  return (
    <Image
      source={{ uri: url }}
      style={frameStyle}
      contentFit="contain"
      accessibilityLabel="Exercise demonstration"
    />
  );
}

function Mp4Media({
  url,
  posterUrl,
  frameStyle,
}: {
  url: string;
  posterUrl?: string;
  frameStyle: ImageStyle;
}) {
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
      style={frameStyle}
      resizeMode={ResizeMode.CONTAIN}
      isLooping
      isMuted
      shouldPlay
      usePoster={Boolean(posterUrl)}
      posterSource={posterUrl ? { uri: posterUrl } : undefined}
    />
  );
}

function ImageSequenceMedia({ frames, frameStyle }: { frames: string[]; frameStyle: ImageStyle }) {
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
      style={frameStyle}
      contentFit="contain"
      accessibilityLabel="Exercise movement sequence"
    />
  );
}

export function ExerciseMovementMedia({ guide, exerciseName }: ExerciseMovementMediaProps) {
  const styles = useThemedStyles(createStyles);
  const media = guide.media;

  if (!media) {
    return <IllustratedMovementCard guide={guide} styles={styles} />;
  }

  return (
    <View style={styles.mediaCard}>
      <AppText variant="label" color="textSecondary">
        Demo — {exerciseName}
      </AppText>
      {media.type === 'gif' ? <GifMedia url={media.url} frameStyle={styles.mediaFrame} /> : null}
      {media.type === 'mp4' ? (
        <Mp4Media url={media.url} posterUrl={media.posterUrl} frameStyle={styles.mediaFrame} />
      ) : null}
      {media.type === 'image-sequence' && media.frames?.length ? (
        <ImageSequenceMedia frames={media.frames} frameStyle={styles.mediaFrame} />
      ) : null}
      {!media.frames?.length && media.type === 'image-sequence' ? (
        <IllustratedMovementCard guide={guide} styles={styles} />
      ) : null}
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    mediaCard: {
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    mediaFrame: {
      width: '100%',
      height: 220,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.colors.backgroundSecondary,
    },
    illustratedCard: {
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    illustratedStep: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      alignItems: 'flex-start',
    },
    illustratedBadge: {
      width: 24,
      height: 24,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.primaryGlow,
      alignItems: 'center',
      justifyContent: 'center',
    },
    illustratedCopy: {
      flex: 1,
      gap: 2,
    },
  });
}
