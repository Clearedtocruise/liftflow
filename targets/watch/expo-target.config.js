/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'watch',
  name: 'ONEMOREWatch',
  displayName: 'ONE MORE',
  icon: '../../assets/branding/one-more-icon-1024.png',
  colors: { $accent: '#0E90FF' },
  deploymentTarget: '10.0',
  frameworks: ['WatchConnectivity', 'HealthKit', 'CoreMotion'],
  entitlements: {
    'com.apple.security.application-groups': ['group.com.liftflow.app'],
    'com.apple.developer.healthkit': true,
  },
});
