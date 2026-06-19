import Foundation
import HealthKit

final class HeartRateReader: ObservableObject {
  @Published var bpm: Int?

  private let store = HKHealthStore()
  private var query: HKAnchoredObjectQuery?

  func requestAuthorization() {
    guard HKHealthStore.isHealthDataAvailable(),
          let heartRate = HKObjectType.quantityType(forIdentifier: .heartRate) else { return }

    store.requestAuthorization(toShare: [], read: [heartRate]) { _, _ in }
  }

  func start() {
    guard HKHealthStore.isHealthDataAvailable(),
          let heartRateType = HKObjectType.quantityType(forIdentifier: .heartRate) else { return }

    let predicate = HKQuery.predicateForSamples(withStart: Date().addingTimeInterval(-300), end: nil)
    query = HKAnchoredObjectQuery(
      type: heartRateType,
      predicate: predicate,
      anchor: nil,
      limit: HKObjectQueryNoLimit
    ) { [weak self] _, samples, _, _, _ in
      self?.publishLatest(samples)
    }

    query?.updateHandler = { [weak self] _, samples, _, _, _ in
      self?.publishLatest(samples)
    }

    if let query {
      store.execute(query)
    }
  }

  func stop() {
    if let query {
      store.stop(query)
    }
    query = nil
  }

  private func publishLatest(_ samples: [HKSample]?) {
    guard let quantity = samples?.last as? HKQuantitySample else { return }
    let unit = HKUnit.count().unitDivided(by: .minute())
    let value = Int(quantity.quantity.doubleValue(for: unit).rounded())
    DispatchQueue.main.async {
      self.bpm = value
    }
  }
}
