/** In-app legal document content — also published at liftflow.app */
import { SUBSCRIPTION } from '@/constants/subscription';

export const LEGAL_VERSION = '2026-05-30';

export const PRIVACY_POLICY = `# Privacy Policy

Effective date: May 28, 2026

LiftFlow ("we") provides a fitness coaching app. This policy describes how we handle your data.

## Data we collect
- Account: email, display name, profile fields
- Fitness: workouts, sets, nutrition, progress photos, goals
- Health (optional): steps, weight, heart rate, workouts from Apple Health when you sync
- Voice: speech transcripts for coaching and set logging
- Device: push notification tokens
- Billing: subscription status via Apple and RevenueCat (no card numbers stored by us)

## How we use data
- Provide tracking, AI coaching, meal plans, and integrations you enable
- Process subscriptions and send workout reminders
- Improve reliability and support

## Third parties
Supabase (database), Render (API), OpenAI (AI features), RevenueCat (subscriptions), Apple/Google (app stores), Expo (push delivery).

## Deletion
Delete your account in Settings → Delete Account.

## Contact
support@liftflow.app`;

export const TERMS_OF_SERVICE = `# Terms of Service

Effective date: May 28, 2026

By using LiftFlow you agree to these terms.

LiftFlow is for informational coaching only — not medical advice. Exercise at your own risk.

You must be 13+ to use the app. Keep your credentials secure.

Premium features require a paid subscription billed through Apple App Store. See Subscription Terms for billing details.

We may suspend accounts that violate these terms. You may delete your account anytime.

Contact: support@liftflow.app`;

export const SUBSCRIPTION_TERMS = `# Subscription Terms

LiftFlow Premium — ${SUBSCRIPTION.displayPrice}/month (local pricing may vary)

Product ID: ${SUBSCRIPTION.appleProductId}

Auto-renewing monthly subscription. Renews unless cancelled 24 hours before period end. Manage in Apple ID → Subscriptions.

Restore Purchases on the Subscription screen when reinstalling.

Contact: support@liftflow.app`;

export const SUPPORT_CONTENT = `# Support

Email: support@liftflow.app

We respond within 2 business days.

For billing issues, include your Apple ID email and approximate purchase date.

For bugs, include device model and iOS version.`;
