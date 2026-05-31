import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FeatureGate } from '@/components/subscription/PremiumGate';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { usePeakMusicSync } from '@/hooks/usePeakMusicSync';
import { listProviderCapabilities } from '@/integrations/music/musicProviderRegistry';
import { peakMomentStore } from '@/integrations/music/peakMomentStore';
import type { MusicProviderId, PeakMoment, PeakPlaybackMode } from '@/types/peakMusic';

const PROVIDER_ORDER: MusicProviderId[] = ['apple_music', 'spotify', 'amazon_music', 'pandora', 'local'];

const PLAYBACK_MODES: Array<{ id: PeakPlaybackMode; label: string; description: string }> = [
  {
    id: 'return_to_playlist',
    label: 'Return to playlist',
    description: 'Save position → play peak → resume original playlist after set',
  },
  {
    id: 'continue_from_peak',
    label: 'Continue from peak',
    description: 'Play peak section, then keep playing that song normally',
  },
  {
    id: 'workout_mode',
    label: 'Workout mode',
    description: 'LiftFlow queue: rest, build-up, peak, and PR tracks',
  },
];

export default function PeakMusicSettingsScreen() {
  const { user } = useAuth();
  const { settings, updateSettings } = usePeakMusicSync(user?.id);
  const caps = listProviderCapabilities().sort(
    (a, b) => PROVIDER_ORDER.indexOf(a.id) - PROVIDER_ORDER.indexOf(b.id),
  );

  return (
    <ScreenContainer>
      <AppText variant="title">Peak Music Sync</AppText>
      <AppText variant="body" color="textSecondary" style={styles.subtitle}>
        Optional — sync song peaks with rest timers and manage playlist continuity during workouts.
      </AppText>

      <FeatureGate featureId="peak-music-sync">
      <Card style={styles.card}>
        <ToggleRow label="Enable peak sync" value={settings.enabled} onChange={(v) => updateSettings({ enabled: v })} />
      </Card>

      <SectionHeader title="Playback mode" />
      <Card style={styles.card}>
        {PLAYBACK_MODES.map((mode) => (
          <Pressable
            key={mode.id}
            style={[styles.modeRow, settings.playbackMode === mode.id && styles.modeActive]}
            onPress={() => updateSettings({ playbackMode: mode.id })}>
            <AppText variant="bodyBold">{mode.label}</AppText>
            <AppText variant="footnote" color="textSecondary">
              {mode.description}
            </AppText>
          </Pressable>
        ))}
      </Card>

      <SectionHeader title="Music provider" />
      <Card style={styles.card}>
        {PROVIDER_ORDER.map((id) => {
          const cap = caps.find((c) => c.id === id);
          if (!cap) return null;
          const selected = settings.activeProvider === id;
          return (
            <Pressable
              key={id}
              style={[styles.modeRow, selected && styles.modeActive]}
              onPress={() => updateSettings({ activeProvider: id })}>
              <AppText variant="bodyBold">{cap.displayName}</AppText>
              <AppText variant="footnote" color="textSecondary">
                {cap.oauthAvailable ? 'OAuth supported' : 'Limited'} · {selected ? 'Active' : 'Tap to select'}
              </AppText>
            </Pressable>
          );
        })}
        <AppText variant="caption" color="textTertiary">
          Real playback requires an EAS dev client (not Expo Go). Apple Music is the primary Sprint 8.3 target.
        </AppText>
      </Card>

      <SectionHeader title="Peak Song Library" />
      <PeakLibrarySection userId={user?.id} activeProvider={settings.activeProvider} />

      <SectionHeader title="Continuity settings" />
      <Card style={styles.card}>
        <ToggleRow
          label="Resume previous playlist after set"
          value={settings.resumePreviousPlaylistAfterSet}
          onChange={(v) => updateSettings({ resumePreviousPlaylistAfterSet: v })}
        />
        <ToggleRow
          label="Continue from peak song"
          value={settings.continueFromPeakSong}
          onChange={(v) => updateSettings({ continueFromPeakSong: v })}
        />
        <ToggleRow
          label="Auto-select peak songs for PR attempts"
          value={settings.autoSelectPeakForPr}
          onChange={(v) => updateSettings({ autoSelectPeakForPr: v })}
        />
        <ToggleRow
          label="Sync music start with rest timer end"
          value={settings.syncMusicWithRestCompletion}
          onChange={(v) => updateSettings({ syncMusicWithRestCompletion: v })}
        />
      </Card>

      <SectionHeader title="Auto-sync triggers" />
      <Card style={styles.card}>
        <ToggleRow
          label="Heavy sets only"
          value={settings.autoSyncHeavySetsOnly}
          onChange={(v) => updateSettings({ autoSyncHeavySetsOnly: v })}
        />
        <ToggleRow
          label="PR attempts only"
          value={settings.autoSyncPrAttemptsOnly}
          onChange={(v) => updateSettings({ autoSyncPrAttemptsOnly: v })}
        />
      </Card>

      <SectionHeader title="Providers & limitations" />
      {caps.map((c) => (
        <Card key={c.id} style={styles.providerCard}>
          <AppText variant="bodyBold">{c.displayName}</AppText>
          <AppText variant="footnote" color="textSecondary">
            Snapshot: {c.playlistSnapshot ? 'yes' : 'no'} · Resume: {c.queueInterruptResume ? 'yes' : 'no'} · Workout
            queue: {c.workoutQueueManaged ? 'yes' : 'no'}
          </AppText>
          <AppText variant="caption" color="textTertiary">
            {c.notes}
          </AppText>
        </Card>
      ))}

      <Card style={styles.card}>
        <AppText variant="caption" color="textTertiary">
          Voice: “Play the good part”, “Use a PR song”, “Resume playlist”, “Next hype song”, “Sync music to next set”.
          See docs/PLAYLIST_CONTINUITY.md for provider feasibility.
        </AppText>
      </Card>
      </FeatureGate>
    </ScreenContainer>
  );
}

function PeakLibrarySection({
  userId,
  activeProvider,
}: {
  userId?: string;
  activeProvider?: MusicProviderId;
}) {
  const [moments, setMoments] = useState<PeakMoment[]>([]);

  useEffect(() => {
    if (!userId) return;
    peakMomentStore.list(userId).then(setMoments);
  }, [userId]);

  const filtered = activeProvider ? moments.filter((m) => m.provider === activeProvider) : moments;

  return (
    <Card style={styles.card}>
      {filtered.length === 0 ? (
        <AppText variant="body" color="textSecondary">
          Save peak moments during rest. Voice: “Play the good part”. PR and heavy-set tags apply during workouts.
        </AppText>
      ) : (
        filtered.map((m) => (
          <View key={m.id} style={styles.peakRow}>
            <AppText variant="bodyBold">{m.trackName}</AppText>
            <AppText variant="footnote" color="textSecondary">
              {m.artistName ?? m.provider} · peak at {Math.round(m.peakOffsetMs / 1000)}s
            </AppText>
            {m.label ? (
              <AppText variant="caption" color="accent">
                {m.label}
              </AppText>
            ) : null}
          </View>
        ))
      )}
    </Card>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <AppText variant="body" style={styles.rowLabel}>
        {label}
      </AppText>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: LiftFlowColors.accent, false: LiftFlowColors.border }} />
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginBottom: Spacing.lg },
  card: { gap: Spacing.sm, marginBottom: Spacing.lg },
  providerCard: { gap: Spacing.xs, marginBottom: Spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md },
  rowLabel: { flex: 1 },
  modeRow: { gap: Spacing.xs, paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LiftFlowColors.border },
  modeActive: { backgroundColor: LiftFlowColors.surfaceElevated, borderRadius: 8, paddingHorizontal: Spacing.sm },
  peakRow: { gap: Spacing.xs, paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LiftFlowColors.border },
});
