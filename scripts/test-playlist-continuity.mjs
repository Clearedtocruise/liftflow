#!/usr/bin/env node
/** Playlist continuity unit tests */

function resolvePlaybackMode(settings) {
  if (settings.playbackMode === 'workout_mode') return 'workout_mode';
  if (settings.continueFromPeakSong) return 'continue_from_peak';
  if (settings.resumePreviousPlaylistAfterSet) return 'return_to_playlist';
  return settings.playbackMode;
}

function selectTrackForSet(settings, context, queue, prTracks) {
  if (settings.autoSelectPeakForPr && context?.isPrAttempt) {
    return prTracks[0] ?? queue.find((t) => t.role === 'pr');
  }
  if (context?.isHeavySet) return queue.find((t) => t.role === 'peak');
  return queue.find((t) => t.role === 'build_up');
}

function nextHypeTrack(queue, currentIndex) {
  const hype = queue.filter((t) => t.role === 'peak' || t.role === 'pr');
  if (hype.length === 0) return queue[(currentIndex + 1) % queue.length];
  return hype[0];
}

const queue = [
  { role: 'rest', name: 'Rest' },
  { role: 'build_up', name: 'Build' },
  { role: 'peak', name: 'Peak' },
  { role: 'pr', name: 'PR' },
];

const checks = [];
function pass(n) {
  checks.push(1);
  console.log(`  ✓ ${n}`);
}
function fail(n) {
  checks.push(0);
  console.log(`  ✗ ${n}`);
}

console.log('=== Playlist Continuity Tests ===\n');

if (resolvePlaybackMode({ playbackMode: 'workout_mode', continueFromPeakSong: true, resumePreviousPlaylistAfterSet: true }) === 'workout_mode') {
  pass('Workout mode takes priority');
} else fail('Workout mode priority');

if (resolvePlaybackMode({ playbackMode: 'return_to_playlist', continueFromPeakSong: true, resumePreviousPlaylistAfterSet: false }) === 'continue_from_peak') {
  pass('Continue from peak when flag set');
} else fail('Continue from peak');

const prTrack = selectTrackForSet({ autoSelectPeakForPr: true }, { isPrAttempt: true }, queue, [{ role: 'pr', name: 'PR' }]);
if (prTrack?.name === 'PR') pass('PR song auto-select');
else fail('PR auto-select');

const heavy = selectTrackForSet({ autoSelectPeakForPr: false }, { isHeavySet: true }, queue, []);
if (heavy?.role === 'peak') pass('Heavy set → peak track');
else fail('Heavy set peak');

const hype = nextHypeTrack(queue, 0);
if (hype?.role === 'peak' || hype?.role === 'pr') pass('Next hype track');
else fail('Next hype');

console.log(`\n=== Summary: ${checks.filter(Boolean).length}/${checks.length} PASS ===`);
process.exit(checks.every(Boolean) ? 0 : 1);
