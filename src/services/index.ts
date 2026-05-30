export { aiService } from './aiService';
export { analyticsService } from './analyticsService';
export { authService } from './authService';
export { bodyService } from './bodyService';
export { coachCheckInService } from './coachCheckInService';
export { exportService } from './exportService';
export { goalService } from './goalService';
export { integrationService } from './integrationService';
export { limitationService } from './limitationService';
export { notificationService } from './notificationService';
export { nutritionService } from './nutritionService';
export { recoveryService } from './recoveryService';
export { socialShareService } from './socialShareService';
export { subscriptionService } from './subscriptionService';
export { trainingService } from './trainingService';
export { userService } from './userService';
export { voiceCoachingService } from './voiceCoachingService';
export { voiceService } from './voiceService';
export { workoutService } from './workoutService';

import { aiService } from './aiService';
import { analyticsService } from './analyticsService';
import { authService } from './authService';
import { bodyService } from './bodyService';
import { coachCheckInService } from './coachCheckInService';
import { exportService } from './exportService';
import { goalService } from './goalService';
import { integrationService } from './integrationService';
import { limitationService } from './limitationService';
import { notificationService } from './notificationService';
import { nutritionService } from './nutritionService';
import { recoveryService } from './recoveryService';
import { socialShareService } from './socialShareService';
import { subscriptionService } from './subscriptionService';
import { trainingService } from './trainingService';
import { userService } from './userService';
import { voiceCoachingService } from './voiceCoachingService';
import { voiceService } from './voiceService';
import { workoutService } from './workoutService';

export const services = {
  auth: authService,
  user: userService,
  workout: workoutService,
  training: trainingService,
  nutrition: nutritionService,
  body: bodyService,
  goals: goalService,
  analytics: analyticsService,
  ai: aiService,
  recovery: recoveryService,
  limitations: limitationService,
  coachCheckIn: coachCheckInService,
  voice: voiceService,
  export: exportService,
  socialShare: socialShareService,
  integration: integrationService,
  subscription: subscriptionService,
  notifications: notificationService,
  voiceCoaching: voiceCoachingService,
} as const;

export type Services = typeof services;
