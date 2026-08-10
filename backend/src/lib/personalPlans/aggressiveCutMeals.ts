/**
 * Aggressive cut nutrition from the athlete's PDF (193 → 180).
 * Targets: 2100–2250 kcal · 210g protein · 170–220g carbs · 55–70g fat.
 * Day 7 (rest): slightly lower calories / carbs.
 */

export type CutMeal = {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre_workout' | 'post_workout';
  name: string;
  scheduledTime: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  notes?: string;
};

export type CutNutritionDay = {
  dayIndex: number;
  liftTime?: string;
  meals: CutMeal[];
};

export const AGGRESSIVE_CUT_NUTRITION_GOALS = {
  calories: 2175,
  proteinG: 210,
  carbsG: 195,
  fatG: 62,
  restCalories: 2050,
  restCarbsG: 160,
  restFatG: 58,
  waterGallons: 1,
} as const;

const day1: CutMeal[] = [
  { mealType: 'pre_workout', name: 'Whey + Banana + 5g Creatine', scheduledTime: '3:20 AM', calories: 280, proteinG: 28, carbsG: 32, fatG: 4 },
  { mealType: 'breakfast', name: 'Eggs, egg whites, oats, berries + multivitamin', scheduledTime: '5:30 AM', calories: 480, proteinG: 40, carbsG: 45, fatG: 16 },
  { mealType: 'lunch', name: 'Chicken, rice, vegetables', scheduledTime: '9:00 AM', calories: 520, proteinG: 48, carbsG: 55, fatG: 10 },
  { mealType: 'snack', name: 'Greek yogurt, berries, almonds', scheduledTime: '1:00 PM', calories: 320, proteinG: 28, carbsG: 28, fatG: 12 },
  { mealType: 'dinner', name: 'Lean beef, potatoes, vegetables', scheduledTime: '6:00 PM', calories: 520, proteinG: 45, carbsG: 45, fatG: 16 },
  { mealType: 'snack', name: 'Casein + Animal Stak', scheduledTime: '9:30 PM', calories: 160, proteinG: 28, carbsG: 6, fatG: 3, notes: 'Before bed' },
];

const day2: CutMeal[] = [
  { mealType: 'breakfast', name: 'Eggs, oats, berries', scheduledTime: '7:00 AM', calories: 450, proteinG: 35, carbsG: 42, fatG: 16 },
  { mealType: 'lunch', name: 'Chicken + rice', scheduledTime: '11:30 AM', calories: 500, proteinG: 48, carbsG: 52, fatG: 8 },
  { mealType: 'pre_workout', name: 'Whey + banana + creatine', scheduledTime: '2:30 PM', calories: 280, proteinG: 28, carbsG: 32, fatG: 4 },
  { mealType: 'dinner', name: 'Lean beef + potatoes + vegetables', scheduledTime: '5:30 PM', calories: 540, proteinG: 48, carbsG: 48, fatG: 16 },
  { mealType: 'snack', name: 'Casein', scheduledTime: '9:30 PM', calories: 140, proteinG: 26, carbsG: 4, fatG: 2, notes: 'Before bed' },
];

const day3: CutMeal[] = [
  { mealType: 'breakfast', name: 'Eggs + oats + berries', scheduledTime: '7:00 AM', calories: 450, proteinG: 35, carbsG: 42, fatG: 16 },
  { mealType: 'pre_workout', name: 'Whey + banana', scheduledTime: '10:00 AM', calories: 260, proteinG: 26, carbsG: 30, fatG: 3 },
  { mealType: 'lunch', name: 'Chicken + rice + vegetables', scheduledTime: '12:30 PM', calories: 520, proteinG: 48, carbsG: 55, fatG: 10 },
  { mealType: 'snack', name: 'Greek yogurt + almonds', scheduledTime: '4:00 PM', calories: 300, proteinG: 26, carbsG: 18, fatG: 14 },
  { mealType: 'dinner', name: 'Salmon + potatoes + vegetables', scheduledTime: '7:00 PM', calories: 520, proteinG: 42, carbsG: 40, fatG: 18 },
  { mealType: 'snack', name: 'Casein', scheduledTime: '9:30 PM', calories: 140, proteinG: 26, carbsG: 4, fatG: 2, notes: 'Before bed' },
];

/** Days 4–5 share the same structure (6 AM lift). */
const earlyLiftDay: CutMeal[] = [
  { mealType: 'pre_workout', name: 'Whey + banana + creatine', scheduledTime: '5:15 AM', calories: 280, proteinG: 28, carbsG: 32, fatG: 4 },
  { mealType: 'breakfast', name: 'Eggs + oats', scheduledTime: '7:30 AM', calories: 420, proteinG: 32, carbsG: 38, fatG: 14 },
  { mealType: 'lunch', name: 'Chicken + rice + vegetables', scheduledTime: '11:30 AM', calories: 520, proteinG: 48, carbsG: 55, fatG: 10 },
  { mealType: 'snack', name: 'Greek yogurt', scheduledTime: '3:30 PM', calories: 180, proteinG: 22, carbsG: 14, fatG: 4 },
  { mealType: 'dinner', name: 'Lean beef + potatoes', scheduledTime: '6:30 PM', calories: 520, proteinG: 45, carbsG: 45, fatG: 16 },
  { mealType: 'snack', name: 'Casein', scheduledTime: '9:30 PM', calories: 140, proteinG: 26, carbsG: 4, fatG: 2, notes: 'Before bed' },
];

/** Day 6: same structure with slightly higher carbs. */
const day6: CutMeal[] = [
  { mealType: 'pre_workout', name: 'Whey + banana + creatine', scheduledTime: '5:15 AM', calories: 280, proteinG: 28, carbsG: 32, fatG: 4 },
  { mealType: 'breakfast', name: 'Eggs + oats', scheduledTime: '7:30 AM', calories: 420, proteinG: 32, carbsG: 38, fatG: 14 },
  { mealType: 'post_workout', name: 'Extra 1/2 cup rice (carb bump)', scheduledTime: '8:00 AM', calories: 110, proteinG: 2, carbsG: 24, fatG: 0, notes: 'Day 6 carb increase' },
  { mealType: 'lunch', name: 'Chicken + rice + vegetables', scheduledTime: '11:30 AM', calories: 520, proteinG: 48, carbsG: 55, fatG: 10 },
  { mealType: 'snack', name: 'Greek yogurt', scheduledTime: '3:30 PM', calories: 180, proteinG: 22, carbsG: 14, fatG: 4 },
  { mealType: 'dinner', name: 'Lean beef + potatoes (extra potatoes OK)', scheduledTime: '6:30 PM', calories: 560, proteinG: 45, carbsG: 55, fatG: 16 },
  { mealType: 'snack', name: 'Casein', scheduledTime: '9:30 PM', calories: 140, proteinG: 26, carbsG: 4, fatG: 2, notes: 'Before bed' },
];

const restDay: CutMeal[] = [
  { mealType: 'breakfast', name: 'Eggs + oats + berries', scheduledTime: '8:00 AM', calories: 420, proteinG: 35, carbsG: 38, fatG: 14 },
  { mealType: 'lunch', name: 'Chicken + vegetables (lower carbs)', scheduledTime: '12:00 PM', calories: 420, proteinG: 48, carbsG: 25, fatG: 12 },
  { mealType: 'snack', name: 'Greek yogurt + almonds', scheduledTime: '3:30 PM', calories: 300, proteinG: 28, carbsG: 16, fatG: 14 },
  { mealType: 'dinner', name: 'Lean beef + vegetables + small potato', scheduledTime: '6:30 PM', calories: 480, proteinG: 45, carbsG: 30, fatG: 16 },
  { mealType: 'snack', name: 'Casein', scheduledTime: '9:30 PM', calories: 140, proteinG: 26, carbsG: 4, fatG: 2, notes: 'Before bed · 10–12k steps · optional incline walk' },
];

export const AGGRESSIVE_CUT_NUTRITION_DAYS: CutNutritionDay[] = [
  { dayIndex: 0, liftTime: '4:00 AM', meals: day1 },
  { dayIndex: 1, liftTime: '1:00 PM', meals: day2 },
  { dayIndex: 2, liftTime: '11:00 AM', meals: day3 },
  { dayIndex: 3, liftTime: '6:00 AM', meals: earlyLiftDay },
  { dayIndex: 4, liftTime: '6:00 AM', meals: earlyLiftDay },
  { dayIndex: 5, liftTime: '6:00 AM', meals: day6 },
  { dayIndex: 6, meals: restDay },
];
