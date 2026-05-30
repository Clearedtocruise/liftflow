import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/** In-memory fallback when Metro evaluates auth code in Node (no window). */
const memoryStore = new Map<string, string>();

function isNodeWithoutDom(): boolean {
  return typeof window === 'undefined' && Platform.OS === 'web';
}

export const authStorage = {
  getItem(key: string): Promise<string | null> {
    if (isNodeWithoutDom()) {
      return Promise.resolve(memoryStore.get(key) ?? null);
    }
    return AsyncStorage.getItem(key);
  },
  setItem(key: string, value: string): Promise<void> {
    if (isNodeWithoutDom()) {
      memoryStore.set(key, value);
      return Promise.resolve();
    }
    return AsyncStorage.setItem(key, value);
  },
  removeItem(key: string): Promise<void> {
    if (isNodeWithoutDom()) {
      memoryStore.delete(key);
      return Promise.resolve();
    }
    return AsyncStorage.removeItem(key);
  },
};
