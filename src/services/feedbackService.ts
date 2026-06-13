import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { fail, fromError, ok } from '@/lib/serviceResult';
import { getAccessToken } from '@/supabase/client';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com';

export type FeedbackType = 'bug' | 'feature' | 'support' | 'confusion';

export type FeedbackArea =
  | 'workout'
  | 'coach'
  | 'nutrition'
  | 'recovery'
  | 'voice'
  | 'subscription'
  | 'onboarding'
  | 'other';

export type FeedbackIssueCategory =
  | 'crash'
  | 'confusion'
  | 'missing_feature'
  | 'feature_request'
  | 'support'
  | 'other';

export type SubmitFeedbackInput = {
  userId: string;
  feedbackType: FeedbackType;
  subject: string;
  body: string;
  screenshotUri?: string;
  area?: FeedbackArea;
  issueCategory?: FeedbackIssueCategory;
};

async function collectDeviceMetadata() {
  return {
    platform: Platform.OS,
    osVersion: Platform.Version,
    deviceName: Device.deviceName ?? 'unknown',
    modelName: Device.modelName ?? 'unknown',
    isDevice: Device.isDevice,
    brand: Device.brand ?? 'unknown',
  };
}

function appVersion(): string {
  return Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '1.0.0';
}

export const feedbackService = {
  async submit(input: SubmitFeedbackInput) {
    try {
      const token = await getAccessToken();
      const deviceMetadata = await collectDeviceMetadata();

      const response = await fetch(`${API_BASE_URL}/api/feedback/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: input.userId,
          feedbackType: input.feedbackType,
          subject: input.subject,
          body: input.body,
          screenshotUrl: input.screenshotUri,
          area: input.area,
          issueCategory: input.issueCategory,
          deviceMetadata,
          appVersion: appVersion(),
          appEnvironment: __DEV__ ? 'development' : 'production',
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: response.statusText }));
        return fail(err.message ?? 'Feedback submit failed');
      }

      const result = await response.json();
      return ok(result as { id: string; message: string });
    } catch (e) {
      return fromError(e);
    }
  },

  async redeemInvite(userId: string, code: string) {
    try {
      const token = await getAccessToken();
      const response = await fetch(`${API_BASE_URL}/api/beta/invite/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId, code }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: response.statusText }));
        return fail(err.message ?? 'Invite redeem failed');
      }

      return ok(await response.json());
    } catch (e) {
      return fromError(e);
    }
  },

  async getReleaseNotes() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/beta/release-notes`);
      if (!response.ok) return fail('Failed to load release notes');
      return ok((await response.json()) as { notes: Array<{ version: string; title: string; body: string }> });
    } catch (e) {
      return fromError(e);
    }
  },

  async getChangelog() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/beta/changelog`);
      if (!response.ok) return fail('Failed to load changelog');
      return ok((await response.json()) as { entries: Array<{ version: string; category: string; summary: string }> });
    } catch (e) {
      return fromError(e);
    }
  },
};
