const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * expo-notifications adds aps-environment even for local-only reminders.
 * Our App Store provisioning profile does not include Push Notifications yet.
 * Strip the entitlement so EAS/Xcode signing succeeds.
 */
function withLocalNotificationsOnly(config) {
  return withEntitlementsPlist(config, (mod) => {
    delete mod.modResults['aps-environment'];
    return mod;
  });
}

module.exports = withLocalNotificationsOnly;
