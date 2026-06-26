import type { WatchCardioState } from '@/integrations/watch/types';

type HeartRateListener = (bpm: number) => void;
type CardioCommand = 'pause' | 'resume' | 'finish';

type CardioCommandListener = (command: CardioCommand) => void;

let activeCardio: WatchCardioState | null = null;
const heartRateListeners = new Set<HeartRateListener>();
const commandListeners = new Set<CardioCommandListener>();

export const watchCardioBridge = {
  getActive(): WatchCardioState | null {
    return activeCardio;
  },

  setActive(state: WatchCardioState | null): void {
    activeCardio = state;
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
