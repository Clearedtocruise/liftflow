module.exports = {
  getReachability: async () => false,
  isWatchAppInstalled: async () => false,
  sendMessage: async () => {},
  updateApplicationContext: async () => {},
  transferUserInfo: async () => {},
  getIsPaired: async () => false,
  watchEvents: { addListener: () => ({ remove: () => {} }) },
};
