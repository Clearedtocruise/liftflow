#!/bin/bash
# Run once interactively in Terminal (Apple 2FA required).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== Step 1: Configure iOS credentials (Apple login + 2FA) ==="
npx eas-cli credentials:configure-build --platform ios --profile development

echo ""
echo "=== Step 2: Start development build ==="
npx eas-cli build --platform ios --profile development

echo ""
echo "When build finishes, open the install URL on your iPhone (Safari)."
echo "Then run: npm run start:dev-client"
