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
  @Published var isRunning = false
  @Published var heartRateBpm: Int?
  @Published var lastError: String?

  private let store = HKHealthStore()
  private var session: HKWorkoutSession?
  private var builder: HKLiveWorkoutBuilder?

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

  /// Idempotent: calling this while a session is already running is a no-op, so repeated phone
  /// pushes cannot restart — and thereby split — the workout.
  func start() {
    guard HKHealthStore.isHealthDataAvailable(), session == nil else { return }

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
    session?.end()
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
