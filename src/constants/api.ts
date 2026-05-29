/** Production API base URL — override with EXPO_PUBLIC_API_URL in .env for local dev. */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com';
