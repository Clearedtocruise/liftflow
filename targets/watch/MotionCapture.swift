import CoreMotion
import Foundation
import WatchKit

/// Streams accelerometer + gyro batches to iPhone for rep detection (Phase 2).
final class MotionCapture: ObservableObject {
  @Published private(set) var isStreaming = false

  private let manager = CMMotionManager()
  private var samples: [[String: Any]] = []
  private weak var connectivity: WorkoutConnectivity?
  private var runtimeSession: WKExtendedRuntimeSession?
  private let batchSize = 25

  func startStreaming(connectivity: WorkoutConnectivity) {
    guard manager.isDeviceMotionAvailable, !isStreaming else { return }

    self.connectivity = connectivity
    samples.removeAll(keepingCapacity: true)

    let session = WKExtendedRuntimeSession()
    session.start()
    runtimeSession = session

    manager.deviceMotionUpdateInterval = 0.04
    manager.startDeviceMotionUpdates(to: OperationQueue.main) { [weak self] motion, _ in
      guard let self, let motion else { return }

      let sample: [String: Any] = [
        "recordedAt": Date().timeIntervalSince1970 * 1000,
        "accelerometer": [
          "x": motion.userAcceleration.x + motion.gravity.x,
          "y": motion.userAcceleration.y + motion.gravity.y,
          "z": motion.userAcceleration.z + motion.gravity.z,
        ],
        "gyroscope": [
          "x": motion.rotationRate.x,
          "y": motion.rotationRate.y,
          "z": motion.rotationRate.z,
        ],
      ]

      self.samples.append(sample)
      if self.samples.count >= self.batchSize {
        self.flushBatch()
      }
    }

    isStreaming = true
  }

  func stopStreaming() {
    guard isStreaming else { return }

    flushBatch()
    manager.stopDeviceMotionUpdates()
    runtimeSession?.invalidate()
    runtimeSession = nil
    connectivity = nil
    isStreaming = false
  }

  private func flushBatch() {
    guard !samples.isEmpty, let connectivity else { return }

    let payload = samples
    samples.removeAll(keepingCapacity: true)

    var extra: [String: Any] = ["samples": payload]
    if let sessionId = connectivity.workoutSessionId {
      extra["workoutSessionId"] = sessionId
    }

    connectivity.sendToPhone(type: "motion_batch", extra: extra)
  }
}
