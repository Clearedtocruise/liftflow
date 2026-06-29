import type { ImageSource } from 'expo-image';

/** Bundled lifestyle photos — always available offline, no CDN required. */
export const BundledLifestyle = {
  workoutTraining: require('@/assets/images/lifestyle/workout-training.jpg'),
  workoutLifting: require('@/assets/images/lifestyle/workout-lifting.jpg'),
  nutritionFriends: require('@/assets/images/lifestyle/nutrition-friends.jpg'),
  nutritionMeal: require('@/assets/images/lifestyle/nutrition-meal.jpg'),
  restYoga: require('@/assets/images/lifestyle/rest-yoga.jpg'),
  heroWorkout: require('@/assets/images/lifestyle/hero-workout.jpg'),
  heroRest: require('@/assets/images/lifestyle/hero-rest.jpg'),
  checkInGroup: require('@/assets/images/lifestyle/check-in-group.jpg'),
} as const satisfies Record<string, ImageSource>;
