import type {
    AdPlacement,
    BaseEntity,
    ExportContentType,
    ExportFormat,
    NotificationType,
    PrivacyLevel,
    SubscriptionStatus,
    SubscriptionTier,
} from './common';

export type Subscription = BaseEntity & {
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelledAt?: string;
  updatedAt?: string;
};

export type SubscriptionEvent = BaseEntity & {
  subscriptionId: string;
  eventType: string;
  payload: Record<string, unknown>;
};

export type AdImpression = BaseEntity & {
  userId: string;
  placement: AdPlacement;
  adUnitId?: string;
  impressionAt: string;
  wasClicked: boolean;
};

export type AppNotification = BaseEntity & {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  isRead: boolean;
  sentAt: string;
  readAt?: string;
};

export type ExportedDocument = BaseEntity & {
  userId: string;
  contentType: ExportContentType;
  format: ExportFormat;
  title: string;
  fileUrl?: string;
  fileSizeBytes?: number;
  sourceEntityType?: string;
  sourceEntityId?: string;
  isPrinterFriendly: boolean;
  privacyLevel: PrivacyLevel;
  expiresAt?: string;
};

export type ShareLink = BaseEntity & {
  userId: string;
  documentId?: string;
  token: string;
  maxViews?: number;
  viewCount: number;
  expiresAt?: string;
  isActive: boolean;
};

export type ExportRequest = {
  contentType: ExportContentType;
  format: ExportFormat;
  sourceEntityId: string;
  title?: string;
  isPrinterFriendly?: boolean;
  privacyLevel?: PrivacyLevel;
};

export type ShareRequest = {
  documentId: string;
  maxViews?: number;
  expiresInHours?: number;
  password?: string;
};
