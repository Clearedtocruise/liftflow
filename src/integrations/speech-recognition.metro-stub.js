module.exports = {
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: async () => ({ granted: false }),
    start: async () => {},
    stop: async () => {},
  },
  useSpeechRecognitionEvent: () => {},
};
