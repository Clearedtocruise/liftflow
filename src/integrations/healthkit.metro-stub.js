/** Metro stub — HealthKit native module is unavailable in Expo Go. */
module.exports = {
  isHealthDataAvailableAsync: async () => false,
  requestAuthorization: async () => false,
  queryQuantitySamples: async () => [],
  queryWorkoutSamples: async () => [],
};
