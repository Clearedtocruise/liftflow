/** Metro stub — RevenueCat is unavailable in Expo Go. */
module.exports = {
  LOG_LEVEL: { DEBUG: 0 },
  configure: () => {},
  setLogLevel: () => {},
  getCustomerInfo: async () => ({ entitlements: { active: {} } }),
  getOfferings: async () => ({ current: null }),
  purchasePackage: async () => {
    throw new Error('In-app purchases require a development build');
  },
  restorePurchases: async () => ({ entitlements: { active: {} } }),
  addCustomerInfoUpdateListener: () => {},
  removeCustomerInfoUpdateListener: () => {},
};
