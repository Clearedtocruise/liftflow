/**
 * Service layer interfaces for ONE MORE.
 * Each interface defines the contract for a domain service.
 * MVP implementations use mocks/placeholders; production swaps in Supabase + API calls.
 */

import type {
    AICoachingSession,
    AIInsight,
    AIRecommendation,
    AnalyticsSnapshot,
    BodyCompositionRecord,
    CardioSession,
    CoachingRequest,
    CreateSetPayload,
    DashboardSummary,
    ExportRequest,
    ExportedDocument,
    Goal,
    GroceryList,
    HeartRateSample,
    HydrationLog,
    IntegrationConnection,
    MealPlan,
    NutritionGoals,
    NutritionRecommendation,
    ParseVoiceRequest,
    ParseVoiceResponse,
    PerformanceTrend,
    PhotoComparison,
    PhysiqueProjection,
    PlannedWorkout,
    ProgressPhoto,
    ProgressionSuggestion,
    RecoveryAssessment,
    RestPeriod,
    ShareLink,
    ShareRequest,
    StartSessionPayload,
    Subscription,
    SuggestedMuscleGroups,
    TrainingPhase,
    TrainingProgram,
    UserMetric,
    UserPreferences,
    UserProfile,
    VoiceLogEntry,
    WorkoutDensityMetrics,
    WorkoutHistoryItem,
    WorkoutSession,
    WorkoutTemplate,
} from '@/types';
import type { PaginatedResponse, ServiceResult } from '@/types/common';
import type { AppNotification } from '@/types/platform';
import type { PasswordResetPayload, SignInPayload, SignUpPayload } from '@/types/user';

// =============================================================================
// AUTH & USER
// =============================================================================

export interface IAuthService {
  signUp(payload: SignUpPayload): Promise<UserProfile>;
  signIn(payload: SignInPayload): Promise<UserProfile>;
  signOut(): Promise<void>;
  resetPassword(payload: PasswordResetPayload): Promise<void>;
  getSession(): Promise<UserProfile | null>;
}

export interface IUserService {
  getProfile(userId: string): Promise<ServiceResult<UserProfile>>;
  updateProfile(userId: string, updates: Partial<UserProfile>): Promise<ServiceResult<UserProfile>>;
  getPreferences(userId: string): Promise<ServiceResult<UserPreferences>>;
  updatePreferences(userId: string, updates: Partial<UserPreferences>): Promise<ServiceResult<UserPreferences>>;
  recordMetric(userId: string, metric: Omit<UserMetric, 'id' | 'createdAt'>): Promise<ServiceResult<UserMetric>>;
  getMetrics(userId: string, limit?: number): Promise<ServiceResult<UserMetric[]>>;
}

// =============================================================================
// WORKOUT
// =============================================================================

export interface IWorkoutService {
  /** MVP: Start active session */
  startSession(userId: string, payload: StartSessionPayload): Promise<ServiceResult<WorkoutSession>>;
  /** Start session linked to a planned workout with template exercises preloaded */
  startSessionFromPlanned(
    userId: string,
    plannedWorkoutId: string,
    payload: StartSessionPayload,
  ): Promise<ServiceResult<WorkoutSession>>;
  getActiveSession(userId: string): Promise<ServiceResult<WorkoutSession | null>>;
  endSession(sessionId: string): Promise<ServiceResult<WorkoutSession>>;
  /** MVP: Log a set */
  logSet(payload: CreateSetPayload): Promise<ServiceResult<import('@/types').WorkoutSet>>;
  updateSet(setId: string, payload: import('@/types').UpdateSetPayload): Promise<ServiceResult<import('@/types').WorkoutSet>>;
  deleteSet(setId: string): Promise<ServiceResult<void>>;
  pauseSession(sessionId: string): Promise<ServiceResult<WorkoutSession>>;
  resumeSession(sessionId: string): Promise<ServiceResult<WorkoutSession>>;
  cancelSession(sessionId: string): Promise<ServiceResult<WorkoutSession>>;
  /** History */
  getHistory(userId: string, page?: number): Promise<ServiceResult<PaginatedResponse<WorkoutHistoryItem>>>;
  getSession(sessionId: string): Promise<ServiceResult<WorkoutSession>>;
  deleteSession(sessionId: string): Promise<ServiceResult<void>>;
  updateSession(sessionId: string, updates: { name?: string; notes?: string }): Promise<ServiceResult<WorkoutSession>>;
  addExercise(sessionId: string, exerciseId: string, sortOrder?: number): Promise<ServiceResult<import('@/types').WorkoutExercise>>;
  findOrCreateExerciseByName(name: string, userId: string): Promise<ServiceResult<string>>;
  /** Rest timers */
  startRestTimer(sessionId: string, setId: string, recommendedSeconds: number): Promise<ServiceResult<RestPeriod>>;
  endRestTimer(restPeriodId: string, actualSeconds: number, wasSkipped?: boolean): Promise<ServiceResult<RestPeriod>>;
  /** Recent performance for exercise history UI */
  getRecentSetsForExercise(
    userId: string,
    exerciseId: string,
    limit?: number,
    mode?: import('@/lib/exerciseModality').ExerciseLoggingMode,
  ): Promise<ServiceResult<import('@/types/workoutExecution').ExerciseHistorySet[]>>;
  /** Per-lift progress: recent tracked exercises + deeper set history for charts */
  listTrackedLiftExercises(
    userId: string,
    limit?: number,
  ): Promise<ServiceResult<import('@/lib/exerciseProgress').TrackedLiftExercise[]>>;
  getExerciseProgressSets(
    userId: string,
    exerciseId: string,
    limit?: number,
  ): Promise<ServiceResult<import('@/types/workoutExecution').ExerciseHistorySet[]>>;
  /** Density tracking */
  calculateDensity(sessionId: string): Promise<ServiceResult<WorkoutDensityMetrics>>;
  skipActiveRestTimer(userId: string): Promise<ServiceResult<void>>;
  removeExercise(workoutExerciseId: string): Promise<ServiceResult<boolean>>;
  replaceSessionExercise(
    workoutExerciseId: string,
    newExerciseName: string,
    userId: string,
  ): Promise<ServiceResult<WorkoutSession>>;
  updateExerciseSortOrders(updates: Array<{ id: string; sortOrder: number }>): Promise<ServiceResult<boolean>>;
  applySessionExercisePlan(
    sessionId: string,
    userId: string,
    exercises: import('@/types/workoutExecution').EditableWorkoutExercise[],
  ): Promise<ServiceResult<WorkoutSession>>;
  searchExercises(
    query: string,
    userId: string,
    limit?: number,
  ): Promise<ServiceResult<import('@/types').Exercise[]>>;
}

// =============================================================================
// VOICE
// =============================================================================

export interface IVoiceService {
  /** MVP: Parse voice transcript via backend AI */
  parseCommand(request: ParseVoiceRequest): Promise<ServiceResult<ParseVoiceResponse>>;
  logEntry(userId: string, entry: Omit<VoiceLogEntry, 'id' | 'createdAt'>): Promise<ServiceResult<VoiceLogEntry>>;
  confirmEntry(entryId: string): Promise<ServiceResult<VoiceLogEntry>>;
  rejectEntry(entryId: string): Promise<ServiceResult<VoiceLogEntry>>;
}

// =============================================================================
// TRAINING & PLANNING
// =============================================================================

export interface ITrainingService {
  getPrograms(userId: string): Promise<ServiceResult<TrainingProgram[]>>;
  getActivePhase(userId: string): Promise<ServiceResult<TrainingPhase | null>>;
  getTemplates(userId: string): Promise<ServiceResult<WorkoutTemplate[]>>;
  getPlannedWorkouts(userId: string, from: string, to: string, timeZone?: string | null): Promise<ServiceResult<PlannedWorkout[]>>;
  suggestMuscleGroups(userId: string): Promise<ServiceResult<SuggestedMuscleGroups>>;
  assessRecovery(userId: string): Promise<ServiceResult<RecoveryAssessment>>;
  createPlannedWorkout(userId: string, workout: Omit<PlannedWorkout, 'id' | 'createdAt'>): Promise<ServiceResult<PlannedWorkout>>;
  generateProgram(userId: string, payload: import('@/types').CreateProgramPayload): Promise<ServiceResult<import('@/types').ProgramDashboard | null>>;
  regenerateProgramIfNeeded(userId: string): Promise<ServiceResult<{ regenerated: boolean }>>;
  forceRegenerateProgram(userId: string): Promise<ServiceResult<{ regenerated: boolean }>>;
  repairProgramFromHistory(
    userId: string,
  ): Promise<ServiceResult<{ regenerated: boolean; startDateRepaired: boolean }>>;
  getDashboard(userId: string): Promise<ServiceResult<import('@/types').ProgramDashboard | null>>;
  adaptProgram(userId: string): Promise<ServiceResult<import('@/types').ProgramDashboard | null>>;
  rescheduleWorkout(plannedWorkoutId: string, scheduledDate: string): Promise<ServiceResult<PlannedWorkout>>;
  adaptScheduleChange(
    userId: string,
    change: import('@/types/planAdaptation').ScheduleChange,
  ): Promise<ServiceResult<import('@/types/planAdaptation').PlanAdaptationResult>>;
  updatePlannedWorkoutExercises(
    plannedWorkoutId: string,
    exercises: import('@/types/workoutExecution').EditableWorkoutExercise[],
    existingMetadata?: PlannedWorkout['metadata'],
  ): Promise<ServiceResult<PlannedWorkout>>;
}

// =============================================================================
// AI COACHING & RECOMMENDATIONS
// =============================================================================

export interface IAICoachingService {
  getRecommendations(userId: string): Promise<ServiceResult<AIRecommendation[]>>;
  acceptRecommendation(id: string): Promise<ServiceResult<AIRecommendation>>;
  dismissRecommendation(id: string): Promise<ServiceResult<void>>;
  getInsights(userId: string): Promise<ServiceResult<AIInsight[]>>;
  markInsightRead(id: string): Promise<ServiceResult<void>>;
  /** Evidence-based coaching conversation */
  askCoach(userId: string, request: CoachingRequest): Promise<ServiceResult<AICoachingSession>>;
  /** Progression suggestions grounded in exercise science */
  suggestProgression(userId: string, exerciseId: string): Promise<ServiceResult<ProgressionSuggestion>>;
  suggestWorkout(userId: string): Promise<ServiceResult<PlannedWorkout>>;
  generateWorkoutPlan(userId: string): Promise<ServiceResult<PlannedWorkout & { metadata?: Record<string, unknown> }>>;
  refreshCoaching(userId: string): Promise<ServiceResult<AIRecommendation[]>>;
}

// =============================================================================
// CARDIO & INTEGRATIONS
// =============================================================================

export interface ICardioService {
  startSession(userId: string, type: import('@/types').CardioType): Promise<ServiceResult<CardioSession>>;
  endSession(sessionId: string, metrics: Partial<CardioSession>): Promise<ServiceResult<CardioSession>>;
  getHistory(userId: string): Promise<ServiceResult<CardioSession[]>>;
  logHeartRate(sample: Omit<HeartRateSample, 'id' | 'createdAt'>): Promise<ServiceResult<HeartRateSample>>;
}

export interface IIntegrationService {
  getConnections(userId: string): Promise<ServiceResult<IntegrationConnection[]>>;
  connect(userId: string, provider: import('@/types').IntegrationProvider): Promise<ServiceResult<IntegrationConnection>>;
  disconnect(userId: string, provider: import('@/types').IntegrationProvider): Promise<ServiceResult<void>>;
  syncHealthKit(userId: string): Promise<ServiceResult<{ synced: number }>>;
  /** Future: Apple Watch, motion detection, rep counting */
  syncWatchSession(userId: string, sessionId: string): Promise<ServiceResult<import('@/types').WatchSession>>;
}

// =============================================================================
// NUTRITION
// =============================================================================

export interface INutritionService {
  getGoals(userId: string): Promise<ServiceResult<NutritionGoals | null>>;
  updateGoals(userId: string, goals: Partial<NutritionGoals>): Promise<ServiceResult<NutritionGoals>>;
  logFood(
    userId: string,
    food: {
      name: string;
      mealType: import('@/types').MealType;
      calories?: number;
      proteinG?: number;
      carbsG?: number;
      fatG?: number;
      date?: string;
      instructions?: string;
    },
  ): Promise<ServiceResult<import('@/types').Meal>>;
  updateMeal(
    mealId: string,
    updates: Partial<
      Pick<
        import('@/types').Meal,
        'name' | 'calories' | 'proteinG' | 'carbsG' | 'fatG' | 'instructions' | 'mealType'
      >
    >,
  ): Promise<ServiceResult<import('@/types').Meal>>;
  markMealStatus(
    mealId: string,
    name: string,
    instructions: string | undefined,
    status: 'completed' | 'skipped' | 'modified' | 'planned',
  ): Promise<ServiceResult<import('@/types').Meal>>;
  getMealsForDate(userId: string, date: string): Promise<ServiceResult<import('@/types').Meal[]>>;
  getDailySummary(userId: string, date?: string): Promise<ServiceResult<import('@/types').DailyNutritionSummary>>;
  getMealPlans(userId: string): Promise<ServiceResult<MealPlan[]>>;
  generateWeeklyMealPlan(userId: string, timeZone?: string | null): Promise<ServiceResult<MealPlan>>;
  ensureWeekMealCoverage(
    userId: string,
    timeZone?: string | null,
  ): Promise<ServiceResult<number>>;
  pruneDuplicateMeals(userId: string, range?: { from?: string; to?: string }): Promise<ServiceResult<number>>;
  getMealsForWeek(userId: string, from: string, to: string): Promise<ServiceResult<import('@/types').Meal[]>>;
  removePlannedMealsForWeek(userId: string, weekStart: string): Promise<ServiceResult<number>>;
  generateGroceryList(userId: string, mealPlanId?: string): Promise<ServiceResult<GroceryList>>;
  syncGroceryListFromMeals(
    userId: string,
    from: string,
    to: string,
  ): Promise<ServiceResult<GroceryList | null>>;
  getGroceryLists(userId: string): Promise<ServiceResult<GroceryList[]>>;
  logHydration(userId: string, amountMl: number): Promise<ServiceResult<HydrationLog>>;
  getAdaptiveTargets(userId: string): Promise<ServiceResult<import('@/types/coaching').AdaptiveMacroTargets>>;
  generateDailyPlan(userId: string, dietaryStyle?: string): Promise<ServiceResult<import('@/types/coaching').DailyMealPlan>>;
  getRecommendations(userId: string): Promise<ServiceResult<NutritionRecommendation[]>>;
}

// =============================================================================
// BODY & PROGRESS
// =============================================================================

export interface IBodyService {
  recordComposition(userId: string, record: Omit<BodyCompositionRecord, 'id' | 'createdAt'>): Promise<ServiceResult<BodyCompositionRecord>>;
  getCompositionHistory(userId: string): Promise<ServiceResult<BodyCompositionRecord[]>>;
  uploadProgressPhoto(userId: string, photo: Omit<ProgressPhoto, 'id' | 'createdAt'>): Promise<ServiceResult<ProgressPhoto>>;
  getProgressPhotos(userId: string): Promise<ServiceResult<ProgressPhoto[]>>;
  createComparison(userId: string, comparison: Omit<PhotoComparison, 'id' | 'createdAt'>): Promise<ServiceResult<PhotoComparison>>;
  generatePhysiqueProjection(userId: string, photoId: string, targetDate: string): Promise<ServiceResult<PhysiqueProjection>>;
  uploadFromPicker(userId: string, uri: string, angle: import('@/types').PhotoAngle, weightKg?: number): Promise<ServiceResult<ProgressPhoto>>;
  estimateBodyFat(userId: string, photoId: string): Promise<ServiceResult<{ bodyFatPct: number; analysis: string }>>;
  getProjections(userId: string): Promise<ServiceResult<PhysiqueProjection[]>>;
  runTransformation(
    userId: string,
    targetBodyFatPct: number,
    options?: { beforePhotoId?: string; currentPhotoId?: string },
  ): Promise<ServiceResult<import('@/types/transformation').TransformationProjection>>;
  getLatestTransformation(userId: string): Promise<ServiceResult<import('@/types/transformation').TransformationProjection | null>>;
  getTransformationHistory(
    userId: string,
    limit?: number,
  ): Promise<ServiceResult<import('@/types/transformation').TransformationProjection[]>>;
}

// =============================================================================
// GOALS & ANALYTICS
// =============================================================================

export interface IGoalService {
  getGoals(userId: string): Promise<ServiceResult<Goal[]>>;
  createGoal(userId: string, goal: Omit<Goal, 'id' | 'createdAt' | 'milestones'>): Promise<ServiceResult<Goal>>;
  updateGoalProgress(goalId: string, currentValue: number): Promise<ServiceResult<Goal>>;
  completeGoal(goalId: string): Promise<ServiceResult<Goal>>;
}

export interface IAnalyticsService {
  getDashboard(userId: string): Promise<ServiceResult<DashboardSummary>>;
  getWorkoutStreak(userId: string): Promise<ServiceResult<number>>;
  getSnapshots(userId: string, periodType: string): Promise<ServiceResult<AnalyticsSnapshot[]>>;
  getPerformanceTrends(userId: string, exerciseId?: string): Promise<ServiceResult<PerformanceTrend[]>>;
  generateSnapshot(userId: string, date: string): Promise<ServiceResult<AnalyticsSnapshot>>;
}

// =============================================================================
// PLATFORM: SUBSCRIPTIONS, ADS, NOTIFICATIONS, EXPORT
// =============================================================================

export interface ISubscriptionService {
  getSubscription(userId: string): Promise<ServiceResult<Subscription>>;
  /** Future: Stripe/Apple/Google IAP */
  upgrade(userId: string, tier: import('@/types').SubscriptionTier): Promise<ServiceResult<Subscription>>;
  cancel(userId: string): Promise<ServiceResult<Subscription>>;
  restorePurchases(userId: string): Promise<ServiceResult<Subscription>>;
}

export interface IAdService {
  shouldShowAd(userId: string, placement: import('@/types').AdPlacement): Promise<boolean>;
  recordImpression(userId: string, placement: import('@/types').AdPlacement): Promise<void>;
  recordClick(impressionId: string): Promise<void>;
}

export interface INotificationService {
  getNotifications(userId: string): Promise<ServiceResult<AppNotification[]>>;
  markRead(notificationId: string): Promise<ServiceResult<void>>;
  registerDevice(userId: string, token: string, platform: string): Promise<ServiceResult<void>>;
  /** Future: push notification scheduling */
  scheduleWorkoutReminder(userId: string, time: string): Promise<ServiceResult<void>>;
}

export interface IExportService {
  exportContent(userId: string, request: ExportRequest): Promise<ServiceResult<ExportedDocument>>;
  getDocuments(userId: string): Promise<ServiceResult<ExportedDocument[]>>;
  createShareLink(userId: string, request: ShareRequest): Promise<ServiceResult<ShareLink>>;
  /** Printer-friendly HTML generation */
  generatePrintView(documentId: string): Promise<ServiceResult<string>>;
  /** PDF generation via backend */
  generatePdf(userId: string, request: ExportRequest): Promise<ServiceResult<ExportedDocument>>;
  downloadAndShare(userId: string, request: ExportRequest): Promise<ServiceResult<ExportedDocument>>;
}
