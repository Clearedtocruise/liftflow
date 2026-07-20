import type { WatchCardioState } from '@/integrations/watch/types';

type HeartRateListener = (bpm: number) => void;
type CardioCommand = 'pause' | 'resume' | 'finish';

type CardioCommandListener = (command: CardioCommand) => void;

let activeCardio: WatchCardioState | null = null;
const heartRateListeners = new Set<HeartRateListener>();
const commandListeners = new Set<CardioCommandListener>();
type ActiveListener = (state: WatchCardioState | null) => void;
const activeListeners = new Set<ActiveListener>();

export const watchCardioBridge = {
  getActive(): WatchCardioState | null {
    return activeCardio;
  },

  /** Extra/cardio Watch mode removed — strength companion always owns the Watch. */
  isWatchOwnedByCardio(): boolean {
    return false;
  },

  setActive(state: WatchCardioState | null): void {
    // Intentionally ignore cardio ownership — Apple Fitness is the activity source.
    activeCardio = null;
    for (const listener of activeListeners) {
      listener(null);
    }
  },

  subscribeActive(listener: ActiveListener): () => void {
    activeListeners.add(listener);
    return () => {
      activeListeners.delete(listener);
    };
  },

  recordHeartRate(bpm: number): void {
    if (!activeCardio) return;
    activeCardio = { ...activeCardio, heartRateBpm: bpm, updatedAt: new Date().toISOString() };
    for (const listener of heartRateListeners) {
      listener(bpm);
    }
  },

  subscribeHeartRate(listener: HeartRateListener): () => void {
    heartRateListeners.add(listener);
    return () => {
      heartRateListeners.delete(listener);
    };
  },

  emitCommand(command: CardioCommand): void {
    for (const listener of commandListeners) {
      listener(command);
    }
  },

  subscribeCommands(listener: CardioCommandListener): () => void {
    commandListeners.add(listener);
    return () => {
      commandListeners.delete(listener);
    };
  },
};
