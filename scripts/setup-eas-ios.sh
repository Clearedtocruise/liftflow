#!/bin/bash
# Run in Terminal — Apple 2FA required once. Apple Developer must be active.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== LiftFlow iOS dev build (device install) ==="
echo ""
echo "Profile: development (dev client, internal install — NOT TestFlight)"
echo "Bundle ID: com.liftflow.app"
echo ""

echo "Step 1: Configure Apple credentials (choose DEVELOPMENT profile when prompted)"
npx eas-cli credentials:configure-build --platform ios --profile development

echo ""
echo "Step 2: Start cloud build (~15–25 min)"
npx eas-cli build --platform ios --profile development

echo ""
echo "Step 3: When build finishes, open the install URL on your iPhone (Safari)."
echo "        Dashboard: https://expo.dev/accounts/liftflow1/projects/liftflow/builds"
echo ""
echo "Step 4: On Mac, start Metro for the dev client:"
echo "        npm run start:dev-client"
echo ""
echo "Test login: liftflow.tester@clearedtocruise.com / LiftFlow2026!Test"
