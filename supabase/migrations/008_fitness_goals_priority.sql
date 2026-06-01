-- fitness_goals stores ordered training goal IDs (index 0 = highest priority / nutrition driver)
comment on column public.profiles.fitness_goals is
  'Ordered training goals; index 0 = highest priority (drives nutrition via primary_training_goal).';

comment on column public.profiles.primary_training_goal is
  'Nutrition macro driver — synced from fitness_goals[0] (fat_loss, muscle_gain, strength, general_fitness).';
