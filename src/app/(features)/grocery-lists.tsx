import { Redirect } from 'expo-router';

/** Grocery lists live on Nutrition → Shop. */
export default function GroceryListsRedirect() {
  return <Redirect href="/(tabs)/nutrition?section=shopping" />;
}
