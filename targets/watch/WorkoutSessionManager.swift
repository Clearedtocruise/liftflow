import Foundation
import HealthKit

/**
 * Owns the `HKWorkoutSession` that keeps the watch app running while a workout is in progress.
 *
 * Without a live workout session watchOS suspends the app on wrist-down, which silently kills
 * haptics, heart-rate collection and the rest countdown mid-set. The session therefore stays
 * running for the whole workout — including rest periods, which are part of the workout, not a
 * pause — and only ends when the workout completes or is cancelled.
 *
 * Requires the `workout-processing` background mode in Info.plist and the HealthKit entitlement.
 */
final class WorkoutSessionManager: NSObject, ObservableObject {
  private static let delayedEndGraceSeconds: TimeInterval = 10

  @Published var isRunning = false
  @Published var heartRateBpm: Int?
  @Published var lastError: String?

  private let store = HKHealthStore()
  private var session: HKWorkoutSession?
  private var builder: HKLiveWorkoutBuilder?
  private var delayedEndWorkItem: DispatchWorkItem?
  /// A workout is in progress on the phone, so the session should be running or being started.
  private var wantsSession = false
  private var isStarting = false

  private var shareTypes: Set<HKSampleType> {
    var types: Set<HKSampleType> = [HKObjectType.workoutType()]
    if let energy = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) {
      types.insert(energy)
    }
    return types
  }

  private var readTypes: Set<HKObjectType> {
    var types: Set<HKObjectType> = []
    if let heartRate = HKObjectType.quantityType(forIdentifier: .heartRate) {
      types.insert(heartRate)
    }
    if let energy = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) {
      types.insert(energy)
    }
    return types
  }

  func requestAuthorization() {
    guard HKHealthStore.isHealthDataAvailable() else { return }
    store.requestAuthorization(toShare: shareTypes, read: readTypes) { _, _ in }
  }

  /**
   * Idempotent: calling this while a session is already running is a no-op, so repeated phone
   * pushes cannot restart — and thereby split — the workout.
   *
   * Authorization is resolved *before* the session is created. Creating an `HKWorkoutSession`
   * while the HealthKit prompt is still outstanding fails, and a workout app with no running
   * session does not own the wrist: watchOS hands the raise to whichever app does, which is how
   * the Fitness app ended up taking over as soon as the wrist went down.
   */
  func start() {
    delayedEndWorkItem?.cancel()
    delayedEndWorkItem = nil
    wantsSession = true

    guard HKHealthStore.isHealthDataAvailable(), session == nil, !isStarting else { return }
    isStarting = true

    store.requestAuthorization(toShare: shareTypes, read: readTypes) { [weak self] granted, error in
      DispatchQueue.main.async {
        guard let self else { return }
        self.isStarting = false

        if let error {
          self.lastError = error.localizedDescription
          return
        }
        guard granted else {
          self.lastError = "Allow Health access so the workout can stay on your wrist."
          return
        }
        // The workout may have ended while the prompt was up.
        guard self.wantsSession, self.session == nil else { return }
        self.beginSession()
      }
    }
  }

  private func beginSession() {
    let configuration = HKWorkoutConfiguration()
    configuration.activityType = .traditionalStrengthTraining
    configuration.locationType = .indoor

    do {
      let newSession = try HKWorkoutSession(healthStore: store, configuration: configuration)
      let newBuilder = newSession.associatedWorkoutBuilder()
      newBuilder.dataSource = HKLiveWorkoutDataSource(
        healthStore: store,
        workoutConfiguration: configuration
      )
      newSession.delegate = self
      newBuilder.delegate = self

      session = newSession
      builder = newBuilder

      let startDate = Date()
      newSession.startActivity(with: startDate)
      newBuilder.beginCollection(withStart: startDate) { [weak self] _, error in
        if let error { self?.publishError(error) }
      }
      isRunning = true
    } catch {
      publishError(error)
      teardown()
    }
  }

  /// Ends the workout and saves it to Health, so the user keeps credit for the time trained.
  /// Used for both completion and wrist-side cancellation.
  func end() {
    wantsSession = false
    guard session != nil else { return }
    delayedEndWorkItem?.cancel()

    let workItem = DispatchWorkItem { [weak self] in
      guard let self else { return }
      self.session?.end()
    }
    delayedEndWorkItem = workItem
    DispatchQueue.main.asyncAfter(
      deadline: .now() + Self.delayedEndGraceSeconds,
      execute: workItem
    )
  }

  private func finish() {
    guard let builder else {
      teardown()
      return
    }

    builder.endCollection(withEnd: Date()) { [weak self] _, _ in
      self?.saveWorkout(from: builder)
    }
  }

  private func saveWorkout(from builder: HKLiveWorkoutBuilder) {
    builder.finishWorkout { [weak self] _, error in
      if let error { self?.publishError(error) }
      self?.teardown()
    }
  }

  private func teardown() {
    delayedEndWorkItem?.cancel()
    delayedEndWorkItem = nil
    isStarting = false
    session?.delegate = nil
    builder?.delegate = nil
    session = nil
    builder = nil
    DispatchQueue.main.async {
      self.isRunning = false
      self.heartRateBpm = nil
    }
  }

  private func publishError(_ error: Error) {
    DispatchQueue.main.async {
      self.lastError = error.localizedDescription
    }
  }
}

extension WorkoutSessionManager: HKWorkoutSessionDelegate {
  func workoutSession(
    _ workoutSession: HKWorkoutSession,
    didChangeTo toState: HKWorkoutSessionState,
    from fromState: HKWorkoutSessionState,
    date: Date
  ) {
    switch toState {
    case .running:
      DispatchQueue.main.async { self.isRunning = true }
    case .ended:
      finish()
    default:
      break
    }
  }

  func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
    publishError(error)
    teardown()
  }
}

extension WorkoutSessionManager: HKLiveWorkoutBuilderDelegate {
  func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

  func workoutBuilder(
    _ workoutBuilder: HKLiveWorkoutBuilder,
    didCollectDataOf collectedTypes: Set<HKSampleType>
  ) {
    guard let heartRateType = HKObjectType.quantityType(forIdentifier: .heartRate),
          collectedTypes.contains(heartRateType),
          let statistics = workoutBuilder.statistics(for: heartRateType) else { return }

    let unit = HKUnit.count().unitDivided(by: .minute())
    guard let bpm = statistics.mostRecentQuantity()?.doubleValue(for: unit) else { return }
    let value = Int(bpm.rounded())
    DispatchQueue.main.async {
      self.heartRateBpm = value
    }
  }
}
