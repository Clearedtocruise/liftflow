/** How load is applied — orthogonal to exercise type (strength/timed/cardio). */
export type LoadingMethod =
  | 'bodyweight'
  | 'bodyweight_plus_weight'
  | 'external_load'
  | 'timed_hold'
  | 'distance';

export type LoadingMethodOption = {
  method: LoadingMethod;
  label: string;
};
