export { aiService } from './aiService';
export { analyticsService } from './analyticsService';
export { authService } from './authService';
export { bodyService } from './bodyService';
export { exportService } from './exportService';
export { goalService } from './goalService';
export { nutritionService } from './nutritionService';
export { userService } from './userService';
export { voiceService } from './voiceService';
export { workoutService } from './workoutService';

import { aiService } from './aiService';
import { analyticsService } from './analyticsService';
import { authService } from './authService';
import { bodyService } from './bodyService';
import { exportService } from './exportService';
import { goalService } from './goalService';
import { nutritionService } from './nutritionService';
import { userService } from './userService';
import { voiceService } from './voiceService';
import { workoutService } from './workoutService';

export const services = {
  auth: authService,
  user: userService,
  workout: workoutService,
  nutrition: nutritionService,
  body: bodyService,
  goals: goalService,
  analytics: analyticsService,
  ai: aiService,
  voice: voiceService,
  export: exportService,
} as const;

export type Services = typeof services;
