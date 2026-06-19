import Foundation
import WatchConnectivity
import WatchKit

final class WorkoutConnectivity: NSObject, ObservableObject, WCSessionDelegate {
  @Published var exerciseName = "Start on iPhone"
  @Published var setLabel = ""
  @Published var phase = "idle"
  @Published var restSeconds: Int?
  @Published var heartRateBpm: Int?
  @Published var isReachable = false

  // Phase 2 — rep tracking + intelligence
  @Published var currentRepCount = 0
  @Published var targetReps = 0
  @Published var motionConfidence: Double = 0
  @Published var needsConfirmation = false
  @Published var motionTrackingEnabled = false
  @Published var recoveryScore: Int?
  @Published var recoveryLabel = ""
  @Published var workoutRecommendation = ""
  @Published var progressionLine = ""
  @Published var lastSpokenResponse = ""

  private(set) var workoutSessionId: String?
  private var restEndDate: Date?
  private var restTimer: Timer?

  override init() {
    super.init()
    activateSession()
  }

  private func activateSession() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    DispatchQueue.main.async {
      self.isReachable = session.isReachable
    }
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    DispatchQueue.main.async {
      self.isReachable = session.isReachable
    }
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    DispatchQueue.main.async {
      self.applyMessage(message)
    }
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    DispatchQueue.main.async {
      self.applyMessage(applicationContext)
    }
  }

  private func applyMessage(_ message: [String: Any]) {
    guard let type = message["type"] as? String else { return }

    if type == "workout_state" {
      if let state = message["state"] as? [String: Any] {
        applyWorkoutState(state)
      } else if let state = message["state"] as? NSDictionary {
        applyWorkoutState(state as? [String: Any] ?? [:])
      }
    }
  }

  private func applyWorkoutState(_ state: [String: Any]) {
    recoveryScore = state["recoveryScore"] as? Int
    recoveryLabel = state["recoveryLabel"] as? String ?? ""
    workoutRecommendation = state["workoutRecommendation"] as? String ?? ""
    progressionLine = state["progressionLine"] as? String ?? ""
    lastSpokenResponse = state["lastSpokenResponse"] as? String ?? ""

    if let activeSet = state["activeSet"] as? [String: Any] {
      exerciseName = activeSet["exerciseName"] as? String ?? exerciseName
      let setNumber = activeSet["setNumber"] as? Int ?? 1
      let targetSets = activeSet["targetSets"] as? Int ?? 1
      targetReps = activeSet["targetReps"] as? Int ?? 0
      currentRepCount = activeSet["currentRepCount"] as? Int ?? 0
      motionConfidence = activeSet["motionConfidence"] as? Double ?? 0
      needsConfirmation = activeSet["needsConfirmation"] as? Bool ?? false
      motionTrackingEnabled = activeSet["exerciseProfileId"] != nil
      workoutSessionId = activeSet["workoutSessionId"] as? String
      setLabel = "Set \(setNumber)/\(targetSets) · \(targetReps) reps"
      phase = activeSet["phase"] as? String ?? "active_set"

      if let rest = activeSet["restSecondsRemaining"] as? Int, rest > 0 {
        startRestCountdown(seconds: rest)
      } else if phase != "rest" {
        clearRestCountdown()
      }
    } else {
      exerciseName = "Start on iPhone"
      setLabel = workoutRecommendation.isEmpty ? "Open ONE MORE on iPhone" : workoutRecommendation
      phase = "idle"
      currentRepCount = 0
      targetReps = 0
      motionTrackingEnabled = false
      workoutSessionId = nil
      clearRestCountdown()
    }

    if let health = state["healthSnapshot"] as? [String: Any],
       let hr = health["heartRateBpm"] as? Int {
      heartRateBpm = hr
    }
  }

  private func startRestCountdown(seconds: Int) {
    restEndDate = Date().addingTimeInterval(TimeInterval(seconds))
    restSeconds = seconds
    restTimer?.invalidate()
    restTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
      guard let self, let end = self.restEndDate else { return }
      let remaining = max(0, Int(end.timeIntervalSinceNow.rounded()))
      self.restSeconds = remaining > 0 ? remaining : nil
      if remaining <= 0 {
        WKInterfaceDevice.current().play(.notification)
        self.clearRestCountdown()
      }
    }
  }

  private func clearRestCountdown() {
    restTimer?.invalidate()
    restTimer = nil
    restEndDate = nil
    restSeconds = nil
  }

  func sendToPhone(type: String, extra: [String: Any] = [:]) {
    var payload: [String: Any] = ["type": type]
    for (key, value) in extra {
      payload[key] = value
    }

    if let sessionId = workoutSessionId {
      payload["workoutSessionId"] = sessionId
    }

    guard WCSession.default.activationState == .activated else { return }

    if WCSession.default.isReachable {
      WCSession.default.sendMessage(payload, replyHandler: nil) { error in
        print("[ONEMOREWatch] sendMessage failed: \(error.localizedDescription)")
      }
    } else {
      try? WCSession.default.updateApplicationContext(payload)
    }

    WKInterfaceDevice.current().play(.click)
  }

  func logSet() {
    sendToPhone(type: "log_set")
  }

  func skipRest() {
    clearRestCountdown()
    phase = "active_set"
    sendToPhone(type: "skip_rest")
  }

  func nextSet() {
    sendToPhone(type: "next_set")
  }

  func confirmReps() {
    sendToPhone(type: "confirm_reps")
  }

  func sendVoiceCommand(_ transcript: String) {
    sendToPhone(type: "voice_command", extra: ["transcript": transcript])
  }

  func startTodaysWorkout() {
    sendToPhone(type: "start_workout")
  }

  var isActiveSetPhase: Bool {
    phase == "active_set" || phase == "between_sets"
  }

  var isRestPhase: Bool {
    if let restSeconds, restSeconds > 0 { return true }
    return phase == "rest"
  }
}
