#!/usr/bin/env node
/**
 * Sprint 7.X — Peak Music Sync architecture validation
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const checks = [];
function pass(n, d = '') {
  checks.push({ n, s: 'PASS', d });
  console.log(`  ✓ ${n}${d ? ' — ' + d : ''}`);
}
function fail(n, d = '') {
  checks.push({ n, s: 'FAIL', d });
  console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

console.log('=== Sprint 7.X Peak Music Sync Validation ===\n');

const required = [
  'src/types/peakMusic.ts',
  'src/integrations/music/MusicProvider.ts',
  'src/integrations/music/musicProviderRegistry.ts',
  'src/integrations/music/peakPlaybackEngine.ts',
  'src/integrations/music/peakMomentStore.ts',
  'src/integrations/music/playlistContinuityEngine.ts',
  'src/integrations/music/playlistStateStore.ts',
  'src/integrations/music/providers/index.ts',
  'src/services/peakMusicService.ts',
  'src/hooks/usePeakMusicSync.ts',
  'src/app/(features)/peak-music-settings.tsx',
  'docs/PEAK_MUSIC_SYNC.md',
  'docs/PLAYLIST_CONTINUITY.md',
  'supabase/migrations/013_peak_music_moments.sql',
];

for (const f of required) {
  if (fs.existsSync(path.join(root, f))) pass('File', f);
  else fail('Missing', f);
}

const engine = read('src/integrations/music/peakPlaybackEngine.ts');
if (engine.includes('computePeakPlaybackPlan') && engine.includes('shouldAutoSyncPeak')) pass('Playback engine');
else fail('Playback engine');

const service = read('src/services/peakMusicService.ts');
for (const t of ['savePeakMoment', 'onRestStarted', 'onSetCompleted', 'handleVoicePeakCommand', 'planPlaylistContinuity']) {
  if (service.includes(t)) pass('Service', t);
  else fail('Service missing', t);
}

const registry = read('src/integrations/music/musicProviderRegistry.ts');
for (const p of ['apple_music', 'spotify', 'amazon_music', 'pandora']) {
  if (registry.includes(p)) pass('Provider', p);
  else fail('Provider missing', p);
}

const voice = read('src/lib/voice/parseVoiceCommand.ts');
for (const intent of ['play_peak', 'sync_next_set', 'start_at_chorus', 'use_pr_song', 'resume_playlist', 'next_hype_song', 'sync_music_next_set']) {
  if (voice.includes(intent)) pass('Voice intent', intent);
  else fail('Voice intent missing', intent);
}

const continuity = read('src/integrations/music/playlistContinuityEngine.ts');
if (continuity.includes('buildContinuityPlan') && continuity.includes('resolvePlaybackMode')) pass('Continuity engine');
else fail('Continuity engine');

const types = read('src/types/peakMusic.ts');
if (types.includes('PeakPlaybackMode') && types.includes('PlaylistSnapshot')) pass('Continuity types');
else fail('Continuity types');

const settings = read('src/app/(features)/peak-music-settings.tsx');
if (settings.includes('playbackMode') && settings.includes('resumePreviousPlaylistAfterSet')) pass('Settings UI');
else fail('Settings UI');

const doc = read('docs/PEAK_MUSIC_SYNC.md');
if (doc.includes('Feasibility Verdict') && doc.includes('copyrighted audio analysis') && doc.includes('Pandora')) {
  pass('Architecture doc');
} else fail('Architecture doc');

const continuityDoc = read('docs/PLAYLIST_CONTINUITY.md');
if (continuityDoc.includes('Return to Previous Playlist') && continuityDoc.includes('Amazon Music')) pass('Continuity doc');
else fail('Continuity doc');

console.log('\n--- Unit tests ---');
const unit = spawnSync('node', ['scripts/test-peak-music-sync.mjs'], { cwd: root, encoding: 'utf8' });
process.stdout.write(unit.stdout ?? '');
if (unit.status === 0) pass('Peak sync unit tests');
else fail('Peak sync unit tests');

const continuityUnit = spawnSync('node', ['scripts/test-playlist-continuity.mjs'], { cwd: root, encoding: 'utf8' });
process.stdout.write(continuityUnit.stdout ?? '');
if (continuityUnit.status === 0) pass('Continuity unit tests');
else fail('Continuity unit tests');

const failed = checks.filter((c) => c.s === 'FAIL').length;
console.log(`\n=== Sprint 7.X Summary: ${checks.length - failed}/${checks.length} PASS ===`);
process.exit(failed ? 1 : 0);
