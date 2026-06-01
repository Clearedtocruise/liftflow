/** Passthrough stub — disables @expo/metro-runtime error overlay when EXPO_DISABLE_ERROR_OVERLAY=1 */
function withErrorOverlay(Comp) {
  return Comp;
}

module.exports = { withErrorOverlay };
