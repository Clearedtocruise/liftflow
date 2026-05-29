import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'liftflow-supabase-auth';

export const supabaseAuthStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

export { STORAGE_KEY };
