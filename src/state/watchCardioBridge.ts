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

  /** True while phone is driving the Watch cardio UI — blocks strength workout pushes. */
  isWatchOwnedByCardio(): boolean {
    return activeCardio != null;
  },

  setActive(state: WatchCardioState | null): void {
    activeCardio = state;
    for (const listener of activeListeners) {
      listener(state);
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
