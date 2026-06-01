import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { Card } from '@/components/layout/Card';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { AppText } from '@/components/ui/AppText';
import { LiftFlowColors, Spacing } from '@/constants/theme';
import { feedbackService } from '@/services/feedbackService';

export default function ReleaseNotesScreen() {
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Array<{ version: string; title: string; body: string; published_at?: string }>>([]);
  const [changelog, setChangelog] = useState<Array<{ version: string; category: string; summary: string }>>([]);

  useEffect(() => {
    Promise.all([feedbackService.getReleaseNotes(), feedbackService.getChangelog()]).then(([notesRes, logRes]) => {
      if (notesRes.success) setNotes(notesRes.data.notes);
      if (logRes.success) setChangelog(logRes.data.entries);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={LiftFlowColors.accent} />
      </View>
    );
  }

  return (
    <ScreenContainer>
      <AppText variant="title">Release Notes</AppText>
      <AppText variant="body" color="textSecondary" style={styles.subtitle}>
        What&apos;s new in ONE MORE beta builds
      </AppText>

      {notes.length === 0 ? (
        <Card>
          <AppText variant="body" color="textSecondary">
            Release notes will appear here as beta builds ship. See changelog below.
          </AppText>
        </Card>
      ) : (
        notes.map((note) => (
          <Card key={note.version} style={styles.card}>
            <AppText variant="bodyBold">
              v{note.version} — {note.title}
            </AppText>
            <AppText variant="body" color="textSecondary">
              {note.body}
            </AppText>
          </Card>
        ))
      )}

      <AppText variant="label" color="accent" style={styles.section}>
        Changelog
      </AppText>
      <ScrollView>
        {changelog.map((entry, i) => (
          <AppText key={`${entry.version}-${i}`} variant="footnote" color="textSecondary" style={styles.logLine}>
            [{entry.category}] v{entry.version} — {entry.summary}
          </AppText>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  subtitle: { marginBottom: Spacing.lg },
  card: { gap: Spacing.sm, marginBottom: Spacing.md },
  section: { marginTop: Spacing.xl, marginBottom: Spacing.md },
  logLine: { marginBottom: Spacing.xs },
});
