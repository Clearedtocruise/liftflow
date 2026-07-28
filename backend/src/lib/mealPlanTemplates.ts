import { adaptMealName, violatesRestrictions, type NutritionPreferenceInput } from './dietaryRestrictions.js';
import { addCalendarDays, localDateString, weekStartFromDateString } from './localDate.js';

export type MealSlotTemplate = {
  mealType: string;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

type DietaryStyle =
  | 'high_protein'
  | 'low_carb'
  | 'keto'
  | 'mediterranean'
  | 'vegetarian'
  | 'balanced';

const BASE_CALORIES = 2400;
const BASE_PROTEIN = 180;

/** Rotate options by day index so each day of the week gets different meals. */
function pickFromPool<T>(pool: T[], dayIndex: number): T {
  return pool[dayIndex % pool.length]!;
}

function scaleMeal(
  meal: Omit<MealSlotTemplate, 'mealType'> & { mealType: string },
  calories: number,
  proteinG: number,
): MealSlotTemplate {
  const calorieScale = calories / BASE_CALORIES;
  const proteinScale = proteinG / BASE_PROTEIN;
  return {
    mealType: meal.mealType,
    name: meal.name,
    calories: Math.round(meal.calories * calorieScale),
    proteinG: Math.round(meal.proteinG * proteinScale),
    carbsG: Math.round(meal.carbsG * calorieScale),
    fatG: Math.round(meal.fatG * calorieScale),
  };
}

function dayIndexFromDate(date: string, weekStart?: string): number {
  const start = weekStart ?? weekStartFromDateString(date);
  const startMs = new Date(`${start}T12:00:00.000Z`).getTime();
  const dateMs = new Date(`${date.slice(0, 10)}T12:00:00.000Z`).getTime();
  const diff = Math.round((dateMs - startMs) / 86_400_000);
  return ((diff % 7) + 7) % 7;
}

const PRE_WORKOUT_POOL: Omit<MealSlotTemplate, 'scheduledDate'>[] = [
  { mealType: 'pre_workout', name: 'Pre-workout banana and oats', calories: 280, proteinG: 12, carbsG: 48, fatG: 5 },
  { mealType: 'pre_workout', name: 'Rice cakes with honey', calories: 240, proteinG: 4, carbsG: 52, fatG: 2 },
  { mealType: 'pre_workout', name: 'Berry and banana smoothie', calories: 260, proteinG: 10, carbsG: 46, fatG: 4 },
  { mealType: 'pre_workout', name: 'Toast with jam', calories: 250, proteinG: 6, carbsG: 50, fatG: 3 },
  { mealType: 'pre_workout', name: 'Apple with rice cakes', calories: 230, proteinG: 4, carbsG: 48, fatG: 2 },
  { mealType: 'pre_workout', name: 'Overnight oats cup', calories: 270, proteinG: 11, carbsG: 44, fatG: 6 },
  { mealType: 'pre_workout', name: 'Greek yogurt with granola', calories: 290, proteinG: 18, carbsG: 38, fatG: 6 },
];

const POST_WORKOUT_POOL: Omit<MealSlotTemplate, 'scheduledDate'>[] = [
  { mealType: 'post_workout', name: 'Protein shake with banana', calories: 300, proteinG: 30, carbsG: 30, fatG: 5 },
  { mealType: 'post_workout', name: 'Chocolate milk and banana', calories: 320, proteinG: 18, carbsG: 48, fatG: 6 },
  { mealType: 'post_workout', name: 'Greek yogurt with granola', calories: 310, proteinG: 28, carbsG: 32, fatG: 8 },
  { mealType: 'post_workout', name: 'Turkey sandwich on whole grain', calories: 380, proteinG: 32, carbsG: 40, fatG: 10 },
  { mealType: 'post_workout', name: 'Recovery smoothie bowl', calories: 340, proteinG: 26, carbsG: 42, fatG: 7 },
  { mealType: 'post_workout', name: 'Cottage cheese with pineapple', calories: 280, proteinG: 28, carbsG: 24, fatG: 6 },
  { mealType: 'post_workout', name: 'Egg white wrap with salsa', calories: 300, proteinG: 30, carbsG: 28, fatG: 8 },
];

const MEAL_POOLS: Record<DietaryStyle, Record<'breakfast' | 'lunch' | 'dinner' | 'snack', Omit<MealSlotTemplate, 'mealType'>[]>> = {
  balanced: {
    breakfast: [
      { name: 'Greek yogurt bowl with berries', calories: 450, proteinG: 35, carbsG: 45, fatG: 12 },
      { name: 'Oatmeal with banana and peanut butter', calories: 420, proteinG: 18, carbsG: 55, fatG: 14 },
      { name: 'Scrambled eggs with avocado toast', calories: 440, proteinG: 28, carbsG: 32, fatG: 22 },
      { name: 'Cottage cheese with fruit and honey', calories: 380, proteinG: 32, carbsG: 38, fatG: 10 },
      { name: 'Protein pancakes with maple syrup', calories: 460, proteinG: 34, carbsG: 48, fatG: 12 },
      { name: 'Veggie omelette with whole grain toast', calories: 410, proteinG: 30, carbsG: 28, fatG: 18 },
      { name: 'Smoothie bowl with granola and whey', calories: 430, proteinG: 36, carbsG: 46, fatG: 10 },
    ],
    lunch: [
      { name: 'Grilled chicken rice bowl', calories: 650, proteinG: 50, carbsG: 60, fatG: 15 },
      { name: 'Turkey and quinoa salad', calories: 580, proteinG: 46, carbsG: 48, fatG: 16 },
      { name: 'Tuna wrap with mixed greens', calories: 540, proteinG: 42, carbsG: 44, fatG: 14 },
      { name: 'Beef and sweet potato bowl', calories: 620, proteinG: 44, carbsG: 52, fatG: 20 },
      { name: 'Salmon salad with chickpeas', calories: 560, proteinG: 40, carbsG: 38, fatG: 22 },
      { name: 'Shrimp stir-fry with brown rice', calories: 590, proteinG: 38, carbsG: 58, fatG: 14 },
      { name: 'Mediterranean chicken pita', calories: 570, proteinG: 42, carbsG: 50, fatG: 16 },
    ],
    dinner: [
      { name: 'Salmon with roasted vegetables', calories: 700, proteinG: 45, carbsG: 35, fatG: 28 },
      { name: 'Lean beef stir-fry with rice', calories: 680, proteinG: 48, carbsG: 42, fatG: 24 },
      { name: 'Baked cod with asparagus', calories: 620, proteinG: 44, carbsG: 32, fatG: 20 },
      { name: 'Chicken fajita bowl', calories: 640, proteinG: 46, carbsG: 48, fatG: 18 },
      { name: 'Pork tenderloin with roasted potatoes', calories: 660, proteinG: 42, carbsG: 46, fatG: 22 },
      { name: 'Turkey meatballs with zucchini noodles', calories: 600, proteinG: 44, carbsG: 34, fatG: 20 },
      { name: 'White fish tacos with slaw', calories: 630, proteinG: 40, carbsG: 52, fatG: 18 },
    ],
    snack: [
      { name: 'Apple with almond butter', calories: 220, proteinG: 6, carbsG: 24, fatG: 12 },
      { name: 'Protein bar and apple', calories: 260, proteinG: 20, carbsG: 28, fatG: 8 },
      { name: 'Greek yogurt with nuts', calories: 240, proteinG: 18, carbsG: 18, fatG: 12 },
      { name: 'Hummus with vegetables', calories: 200, proteinG: 8, carbsG: 22, fatG: 10 },
      { name: 'Cottage cheese with berries', calories: 210, proteinG: 20, carbsG: 16, fatG: 6 },
      { name: 'Trail mix with string cheese', calories: 250, proteinG: 14, carbsG: 20, fatG: 14 },
      { name: 'Rice cakes with peanut butter', calories: 230, proteinG: 10, carbsG: 26, fatG: 10 },
    ],
  },
  high_protein: {
    breakfast: [
      { name: 'Greek yogurt with berries and whey', calories: 420, proteinG: 42, carbsG: 32, fatG: 10 },
      { name: 'Egg white scramble with turkey', calories: 380, proteinG: 40, carbsG: 12, fatG: 14 },
      { name: 'Protein oats with banana', calories: 440, proteinG: 38, carbsG: 44, fatG: 10 },
      { name: 'Cottage cheese power bowl', calories: 400, proteinG: 44, carbsG: 28, fatG: 8 },
      { name: 'Smoked salmon on toast', calories: 430, proteinG: 36, carbsG: 30, fatG: 16 },
      { name: 'Turkey sausage and egg bowl', calories: 410, proteinG: 42, carbsG: 18, fatG: 18 },
      { name: 'Protein smoothie with spinach', calories: 390, proteinG: 40, carbsG: 34, fatG: 8 },
    ],
    lunch: [
      { name: 'Grilled chicken quinoa bowl', calories: 620, proteinG: 54, carbsG: 48, fatG: 14 },
      { name: 'Steak and rice bowl', calories: 660, proteinG: 52, carbsG: 44, fatG: 22 },
      { name: 'Tuna and white bean salad', calories: 580, proteinG: 48, carbsG: 36, fatG: 16 },
      { name: 'Turkey breast burrito bowl', calories: 600, proteinG: 50, carbsG: 46, fatG: 14 },
      { name: 'Shrimp and edamame bowl', calories: 560, proteinG: 46, carbsG: 40, fatG: 12 },
      { name: 'Chicken Caesar with extra protein', calories: 590, proteinG: 52, carbsG: 28, fatG: 20 },
      { name: 'Lean beef lettuce wraps', calories: 570, proteinG: 48, carbsG: 32, fatG: 18 },
    ],
    dinner: [
      { name: 'Salmon with roasted vegetables', calories: 680, proteinG: 48, carbsG: 28, fatG: 26 },
      { name: 'Grilled chicken with broccoli', calories: 640, proteinG: 52, carbsG: 24, fatG: 18 },
      { name: 'Turkey chili with beans', calories: 620, proteinG: 46, carbsG: 42, fatG: 16 },
      { name: 'Cod with quinoa and greens', calories: 600, proteinG: 44, carbsG: 38, fatG: 14 },
      { name: 'Pork loin with green beans', calories: 630, proteinG: 46, carbsG: 30, fatG: 20 },
      { name: 'Baked chicken thighs with salad', calories: 650, proteinG: 50, carbsG: 22, fatG: 24 },
      { name: 'Lean beef kebabs with rice', calories: 670, proteinG: 48, carbsG: 40, fatG: 22 },
    ],
    snack: [
      { name: 'Protein shake with almonds', calories: 260, proteinG: 30, carbsG: 12, fatG: 10 },
      { name: 'Jerky and cheese stick', calories: 240, proteinG: 28, carbsG: 6, fatG: 12 },
      { name: 'Hard-boiled eggs and fruit', calories: 220, proteinG: 18, carbsG: 16, fatG: 10 },
      { name: 'Greek yogurt with whey', calories: 250, proteinG: 32, carbsG: 14, fatG: 6 },
      { name: 'Tuna pouch with crackers', calories: 230, proteinG: 26, carbsG: 18, fatG: 6 },
      { name: 'Cottage cheese with nuts', calories: 240, proteinG: 24, carbsG: 10, fatG: 12 },
      { name: 'Deli turkey roll-ups', calories: 210, proteinG: 26, carbsG: 8, fatG: 8 },
    ],
  },
  low_carb: {
    breakfast: [
      { name: 'Eggs with avocado and spinach', calories: 420, proteinG: 26, carbsG: 12, fatG: 28 },
      { name: 'Smoked salmon and cream cheese plate', calories: 380, proteinG: 28, carbsG: 8, fatG: 24 },
      { name: 'Turkey and cheese omelette', calories: 400, proteinG: 32, carbsG: 6, fatG: 26 },
      { name: 'Greek yogurt with walnuts', calories: 360, proteinG: 24, carbsG: 14, fatG: 22 },
      { name: 'Bacon and egg breakfast bowl', calories: 440, proteinG: 30, carbsG: 8, fatG: 30 },
      { name: 'Cottage cheese with berries', calories: 340, proteinG: 28, carbsG: 16, fatG: 14 },
      { name: 'Chia pudding with almond butter', calories: 370, proteinG: 16, carbsG: 18, fatG: 24 },
    ],
    lunch: [
      { name: 'Turkey lettuce wraps', calories: 480, proteinG: 42, carbsG: 18, fatG: 22 },
      { name: 'Grilled chicken Caesar salad', calories: 520, proteinG: 44, carbsG: 16, fatG: 26 },
      { name: 'Beef and vegetable bowl', calories: 560, proteinG: 40, carbsG: 20, fatG: 28 },
      { name: 'Salmon avocado salad', calories: 540, proteinG: 38, carbsG: 14, fatG: 32 },
      { name: 'Tuna stuffed peppers', calories: 460, proteinG: 36, carbsG: 18, fatG: 22 },
      { name: 'Chicken zucchini noodle bowl', calories: 500, proteinG: 42, carbsG: 16, fatG: 24 },
      { name: 'Steak and arugula salad', calories: 580, proteinG: 46, carbsG: 12, fatG: 32 },
    ],
    dinner: [
      { name: 'Grilled steak with asparagus', calories: 640, proteinG: 46, carbsG: 12, fatG: 36 },
      { name: 'Baked salmon with Brussels sprouts', calories: 620, proteinG: 42, carbsG: 14, fatG: 34 },
      { name: 'Chicken thighs with roasted cauliflower', calories: 600, proteinG: 44, carbsG: 16, fatG: 30 },
      { name: 'Pork chops with green beans', calories: 580, proteinG: 40, carbsG: 12, fatG: 32 },
      { name: 'Shrimp and broccoli stir-fry', calories: 520, proteinG: 38, carbsG: 18, fatG: 24 },
      { name: 'Turkey meatloaf with salad', calories: 560, proteinG: 42, carbsG: 14, fatG: 28 },
      { name: 'Cod with lemon butter greens', calories: 540, proteinG: 40, carbsG: 10, fatG: 26 },
    ],
    snack: [
      { name: 'Cottage cheese with walnuts', calories: 220, proteinG: 18, carbsG: 8, fatG: 14 },
      { name: 'Cheese and almonds', calories: 240, proteinG: 14, carbsG: 6, fatG: 18 },
      { name: 'Hard-boiled eggs', calories: 180, proteinG: 14, carbsG: 2, fatG: 12 },
      { name: 'Celery with peanut butter', calories: 200, proteinG: 8, carbsG: 10, fatG: 14 },
      { name: 'Beef jerky', calories: 160, proteinG: 20, carbsG: 4, fatG: 6 },
      { name: 'Avocado with turkey slices', calories: 260, proteinG: 18, carbsG: 8, fatG: 18 },
      { name: 'Protein shake', calories: 210, proteinG: 26, carbsG: 6, fatG: 6 },
    ],
  },
  keto: {
    breakfast: [
      { name: 'Scrambled eggs with cheese and avocado', calories: 480, proteinG: 28, carbsG: 8, fatG: 36 },
      { name: 'Bacon and egg cups', calories: 460, proteinG: 26, carbsG: 4, fatG: 38 },
      { name: 'Smoked salmon and cream cheese roll', calories: 420, proteinG: 24, carbsG: 6, fatG: 32 },
      { name: 'Keto chia pudding', calories: 400, proteinG: 14, carbsG: 10, fatG: 32 },
      { name: 'Sausage and spinach frittata', calories: 440, proteinG: 30, carbsG: 6, fatG: 34 },
      { name: 'Bulletproof coffee with eggs', calories: 430, proteinG: 18, carbsG: 4, fatG: 36 },
      { name: 'Ham and cheese omelette', calories: 450, proteinG: 32, carbsG: 4, fatG: 32 },
    ],
    lunch: [
      { name: 'Salmon salad with olive oil dressing', calories: 560, proteinG: 38, carbsG: 10, fatG: 40 },
      { name: 'Chicken Caesar without croutons', calories: 540, proteinG: 42, carbsG: 8, fatG: 34 },
      { name: 'Bunless burger bowl', calories: 580, proteinG: 40, carbsG: 12, fatG: 38 },
      { name: 'Tuna avocado boats', calories: 500, proteinG: 34, carbsG: 8, fatG: 32 },
      { name: 'Steak and arugula salad', calories: 600, proteinG: 44, carbsG: 8, fatG: 42 },
      { name: 'Zucchini noodle alfredo with chicken', calories: 560, proteinG: 40, carbsG: 12, fatG: 36 },
      { name: 'Egg salad lettuce cups', calories: 480, proteinG: 28, carbsG: 6, fatG: 34 },
    ],
    dinner: [
      { name: 'Ribeye with buttered greens', calories: 720, proteinG: 46, carbsG: 8, fatG: 52 },
      { name: 'Baked salmon with asparagus', calories: 640, proteinG: 42, carbsG: 10, fatG: 44 },
      { name: 'Chicken thighs with broccoli', calories: 620, proteinG: 44, carbsG: 10, fatG: 40 },
      { name: 'Pork belly with cabbage slaw', calories: 680, proteinG: 36, carbsG: 12, fatG: 48 },
      { name: 'Lamb chops with roasted peppers', calories: 660, proteinG: 40, carbsG: 10, fatG: 46 },
      { name: 'Shrimp scampi with zucchini', calories: 580, proteinG: 38, carbsG: 12, fatG: 36 },
      { name: 'Turkey meatball marinara bowl', calories: 600, proteinG: 42, carbsG: 14, fatG: 38 },
    ],
    snack: [
      { name: 'Macadamia nuts and cheese', calories: 260, proteinG: 10, carbsG: 4, fatG: 22 },
      { name: 'Pepperoni and mozzarella', calories: 240, proteinG: 14, carbsG: 2, fatG: 20 },
      { name: 'Avocado half with salt', calories: 200, proteinG: 2, carbsG: 8, fatG: 18 },
      { name: 'Pork rinds with guacamole', calories: 220, proteinG: 12, carbsG: 6, fatG: 16 },
      { name: 'Celery with almond butter', calories: 210, proteinG: 6, carbsG: 8, fatG: 16 },
      { name: 'Hard-boiled eggs', calories: 180, proteinG: 14, carbsG: 2, fatG: 12 },
      { name: 'String cheese and olives', calories: 190, proteinG: 10, carbsG: 4, fatG: 14 },
    ],
  },
  mediterranean: {
    breakfast: [
      { name: 'Oats with nuts and honey', calories: 420, proteinG: 16, carbsG: 58, fatG: 14 },
      { name: 'Greek yogurt with figs and walnuts', calories: 400, proteinG: 22, carbsG: 38, fatG: 16 },
      { name: 'Whole grain toast with olive tapenade', calories: 380, proteinG: 12, carbsG: 44, fatG: 16 },
      { name: 'Shakshuka with bread', calories: 440, proteinG: 24, carbsG: 36, fatG: 20 },
      { name: 'Fruit and nut bowl', calories: 360, proteinG: 10, carbsG: 48, fatG: 14 },
      { name: 'Ricotta toast with tomatoes', calories: 390, proteinG: 18, carbsG: 40, fatG: 16 },
      { name: 'Mediterranean egg scramble', calories: 410, proteinG: 26, carbsG: 24, fatG: 22 },
    ],
    lunch: [
      { name: 'Grilled fish with couscous', calories: 580, proteinG: 40, carbsG: 52, fatG: 18 },
      { name: 'Chicken souvlaki with salad', calories: 560, proteinG: 42, carbsG: 38, fatG: 20 },
      { name: 'Falafel bowl with tahini', calories: 540, proteinG: 18, carbsG: 58, fatG: 22 },
      { name: 'Tuna niçoise salad', calories: 520, proteinG: 36, carbsG: 28, fatG: 24 },
      { name: 'Lentil and vegetable soup with bread', calories: 500, proteinG: 22, carbsG: 56, fatG: 14 },
      { name: 'Hummus plate with pita and veggies', calories: 530, proteinG: 16, carbsG: 60, fatG: 18 },
      { name: 'Grilled shrimp orzo salad', calories: 570, proteinG: 34, carbsG: 48, fatG: 20 },
    ],
    dinner: [
      { name: 'Chicken souvlaki with salad', calories: 640, proteinG: 44, carbsG: 36, fatG: 24 },
      { name: 'Baked cod with tomatoes and olives', calories: 600, proteinG: 40, carbsG: 28, fatG: 26 },
      { name: 'Lamb kebabs with tabbouleh', calories: 660, proteinG: 38, carbsG: 42, fatG: 28 },
      { name: 'Stuffed peppers with rice', calories: 580, proteinG: 24, carbsG: 52, fatG: 18 },
      { name: 'Seafood stew with bread', calories: 620, proteinG: 36, carbsG: 44, fatG: 22 },
      { name: 'Eggplant moussaka', calories: 600, proteinG: 28, carbsG: 38, fatG: 30 },
      { name: 'Grilled salmon with quinoa', calories: 640, proteinG: 42, carbsG: 40, fatG: 26 },
    ],
    snack: [
      { name: 'Hummus with vegetables', calories: 200, proteinG: 8, carbsG: 22, fatG: 10 },
      { name: 'Olives and cheese', calories: 220, proteinG: 10, carbsG: 4, fatG: 18 },
      { name: 'Fresh fruit with almonds', calories: 210, proteinG: 6, carbsG: 28, fatG: 10 },
      { name: 'Tzatziki with cucumber', calories: 180, proteinG: 8, carbsG: 12, fatG: 10 },
      { name: 'Whole grain crackers with feta', calories: 230, proteinG: 10, carbsG: 24, fatG: 10 },
      { name: 'Dates with walnuts', calories: 240, proteinG: 4, carbsG: 36, fatG: 10 },
      { name: 'Yogurt with honey', calories: 200, proteinG: 12, carbsG: 26, fatG: 6 },
    ],
  },
  vegetarian: {
    breakfast: [
      { name: 'Tofu scramble with toast', calories: 420, proteinG: 24, carbsG: 38, fatG: 16 },
      { name: 'Greek yogurt parfait', calories: 400, proteinG: 22, carbsG: 44, fatG: 12 },
      { name: 'Overnight oats with chia', calories: 410, proteinG: 16, carbsG: 52, fatG: 12 },
      { name: 'Avocado toast with eggs', calories: 430, proteinG: 18, carbsG: 36, fatG: 20 },
      { name: 'Protein smoothie bowl', calories: 390, proteinG: 26, carbsG: 42, fatG: 10 },
      { name: 'Peanut butter banana toast', calories: 440, proteinG: 14, carbsG: 50, fatG: 18 },
      { name: 'Cottage cheese fruit bowl', calories: 380, proteinG: 28, carbsG: 34, fatG: 10 },
    ],
    lunch: [
      { name: 'Lentil and vegetable bowl', calories: 540, proteinG: 26, carbsG: 62, fatG: 14 },
      { name: 'Chickpea salad wrap', calories: 520, proteinG: 22, carbsG: 54, fatG: 16 },
      { name: 'Quinoa power bowl', calories: 560, proteinG: 24, carbsG: 58, fatG: 18 },
      { name: 'Black bean burrito bowl', calories: 580, proteinG: 26, carbsG: 64, fatG: 14 },
      { name: 'Caprese sandwich with pesto', calories: 500, proteinG: 20, carbsG: 48, fatG: 22 },
      { name: 'Tempeh stir-fry with rice', calories: 550, proteinG: 28, carbsG: 56, fatG: 16 },
      { name: 'Mediterranean grain bowl', calories: 530, proteinG: 18, carbsG: 60, fatG: 16 },
    ],
    dinner: [
      { name: 'Chickpea curry with rice', calories: 620, proteinG: 24, carbsG: 68, fatG: 18 },
      { name: 'Stuffed bell peppers with quinoa', calories: 580, proteinG: 22, carbsG: 54, fatG: 16 },
      { name: 'Eggplant parmesan with salad', calories: 600, proteinG: 26, carbsG: 48, fatG: 24 },
      { name: 'Tofu peanut stir-fry', calories: 560, proteinG: 28, carbsG: 44, fatG: 22 },
      { name: 'Vegetable lasagna', calories: 640, proteinG: 24, carbsG: 58, fatG: 26 },
      { name: 'Lentil shepherd\'s pie', calories: 610, proteinG: 28, carbsG: 56, fatG: 20 },
      { name: 'Mushroom risotto with greens', calories: 590, proteinG: 18, carbsG: 62, fatG: 18 },
    ],
    snack: [
      { name: 'Greek yogurt with fruit', calories: 210, proteinG: 16, carbsG: 24, fatG: 6 },
      { name: 'Hummus with pita', calories: 240, proteinG: 8, carbsG: 32, fatG: 10 },
      { name: 'Trail mix', calories: 250, proteinG: 8, carbsG: 22, fatG: 14 },
      { name: 'Edamame with sea salt', calories: 190, proteinG: 16, carbsG: 14, fatG: 8 },
      { name: 'Apple with peanut butter', calories: 220, proteinG: 6, carbsG: 26, fatG: 12 },
      { name: 'Protein bar', calories: 230, proteinG: 20, carbsG: 24, fatG: 8 },
      { name: 'Cheese and crackers', calories: 240, proteinG: 12, carbsG: 20, fatG: 12 },
    ],
  },
};

/**
 * Prefer a pool entry that already satisfies the user's restrictions; only fall
 * back to renaming when every option in the pool is blocked.
 */
function pickAllowedFromPool<T extends { name: string }>(
  pool: T[],
  dayIndex: number,
  restrictions: string[] | undefined,
): T {
  const allowed = pool.filter((item) => !violatesRestrictions(item.name, restrictions));
  return pickFromPool(allowed.length > 0 ? allowed : pool, dayIndex);
}

export function selectDailyCoreMeals(
  date: string,
  macros: { calories: number; proteinG: number; carbsG: number; fatG: number },
  style: DietaryStyle = 'balanced',
  prefs: NutritionPreferenceInput = {},
): MealSlotTemplate[] {
  const dayIndex = dayIndexFromDate(date);
  const pools = MEAL_POOLS[style] ?? MEAL_POOLS.balanced;
  const split = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 } as const;
  // Guard against inflated daily targets (e.g. lbs stored as ~400 kg → 11k kcal)
  // landing almost a full day's food on one dinner slot.
  const dailyCalories = Math.max(1200, Math.min(4500, macros.calories));
  const scale = macros.calories > 0 ? dailyCalories / macros.calories : 1;
  const dailyProtein = Math.round(macros.proteinG * scale);
  const dailyCarbs = Math.round(macros.carbsG * scale);
  const dailyFat = Math.round(macros.fatG * scale);

  return (['breakfast', 'lunch', 'dinner', 'snack'] as const).map((mealType) => {
    const picked = pickAllowedFromPool(pools[mealType], dayIndex, prefs.dietaryRestrictions);
    const ratio = split[mealType];
    return {
      mealType,
      name: adaptMealName(picked.name, mealType, prefs).name,
      calories: Math.round(dailyCalories * ratio),
      proteinG: Math.round(dailyProtein * ratio),
      carbsG: Math.round(dailyCarbs * ratio),
      fatG: Math.round(dailyFat * ratio),
    };
  });
}

export function generateWeeklyMealPlanMeals(
  proteinG = BASE_PROTEIN,
  calories = BASE_CALORIES,
  style: DietaryStyle = 'balanced',
  weekStart = weekStartFromDateString(localDateString()),
  prefs: NutritionPreferenceInput = {},
) {
  const meals: Array<MealSlotTemplate & { scheduledDate: string }> = [];
  const safeCalories = Math.max(1200, Math.min(4500, calories));
  const safeProtein =
    calories > 0 && calories !== safeCalories
      ? Math.round(proteinG * (safeCalories / calories))
      : proteinG;
  // Carbs take whatever energy protein and fat leave, so the grams add up to
  // the calorie target instead of overshooting it.
  const fatG = Math.round((safeCalories * 0.25) / 9);
  const carbsG = Math.max(0, Math.round((safeCalories - safeProtein * 4 - fatG * 9) / 4));

  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    const dateStr = addCalendarDays(weekStart, dayIndex);
    const pre = scaleMeal(pickAllowedFromPool(PRE_WORKOUT_POOL, dayIndex, prefs.dietaryRestrictions), safeCalories, safeProtein);
    const post = scaleMeal(pickAllowedFromPool(POST_WORKOUT_POOL, dayIndex, prefs.dietaryRestrictions), safeCalories, safeProtein);
    const core = selectDailyCoreMeals(dateStr, { calories: safeCalories, proteinG: safeProtein, carbsG, fatG }, style, prefs);

    // Core meals already ran through adaptMealName in selectDailyCoreMeals —
    // adapting again turns "Lean salmon…" → "lean beef…" → "Lean lean beef…".
    const adaptedPre = { ...pre, name: adaptMealName(pre.name, pre.mealType, prefs).name };
    const adaptedPost = { ...post, name: adaptMealName(post.name, post.mealType, prefs).name };
    for (const meal of [adaptedPre, adaptedPost, ...core]) {
      meals.push({ ...meal, scheduledDate: dateStr });
    }
  }

  return meals;
}

export function prePostWorkoutNamesForDate(date: string): { preWorkout: string; postWorkout: string } {
  const dayIndex = dayIndexFromDate(date);
  return {
    preWorkout: pickFromPool(PRE_WORKOUT_POOL, dayIndex).name,
    postWorkout: pickFromPool(POST_WORKOUT_POOL, dayIndex).name,
  };
}

export function uniqueMealNamesAcrossWeek(meals: Array<{ name: string; scheduledDate: string }>): number {
  const namesByDate = new Map<string, Set<string>>();
  for (const meal of meals) {
    const date = meal.scheduledDate.slice(0, 10);
    const set = namesByDate.get(date) ?? new Set<string>();
    set.add(meal.name);
    namesByDate.set(date, set);
  }
  return namesByDate.size;
}
