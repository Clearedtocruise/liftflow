module.exports = {
  setNotificationHandler: () => {},
  getPermissionsAsync: async () => ({ status: 'denied', granted: false }),
  requestPermissionsAsync: async () => ({ status: 'denied', granted: false }),
  getExpoPushTokenAsync: async () => ({ data: 'stub-token' }),
  setNotificationChannelAsync: async () => {},
  scheduleNotificationAsync: async () => 'stub-id',
  addNotificationReceivedListener: () => ({ remove: () => {} }),
  addNotificationResponseReceivedListener: () => ({ remove: () => {} }),
  AndroidImportance: { MAX: 5 },
  IosAuthorizationStatus: { AUTHORIZED: 2, PROVISIONAL: 3 },
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
};
