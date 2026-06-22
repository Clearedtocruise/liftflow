import Foundation
import WatchConnectivity
import WatchKit

final class WorkoutConnectivity: NSObject, ObservableObject, WCSessionDelegate {
  @Published var exerciseName = "Start on iPhone"
  @Published var setLabel = ""
  @Published var statusLine = ""
  @Published var stationLabel = ""
  @Published var supersetHint = ""
  @Published var phase = "idle"
  @Published var restSeconds: Int?
  @Published var heartRateBpm: Int?
  @Published var isReachable = false

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
  @Published var weightLbs: Int?
  @Published var sessionCalories = 0
  @Published var activeCalories = 0

  private(set) var workoutSessionId: String?
  private var restEndDate: Date?
  private var restTimer: Timer?
  private var calorieTimer: Timer?
  private var workoutRuntimeSession: WKExtendedRuntimeSession?
  private var lastHrSampleAt: Date?
  private var restingHeartRate = 65

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

  func recordHeartRate(_ bpm: Int) {
    heartRateBpm = bpm
    let now = Date()
    if let last = lastHrSampleAt {
      let elapsed = now.timeIntervalSince(last)
      accumulateCalories(bpm: bpm, seconds: elapsed)
    }
    lastHrSampleAt = now
    if calorieTimer == nil {
      startCalorieTimer()
    }
  }

  private func startCalorieTimer() {
    calorieTimer?.invalidate()
    calorieTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
      guard let self, let bpm = self.heartRateBpm else { return }
      self.accumulateCalories(bpm: bpm, seconds: 1)
      self.lastHrSampleAt = Date()
    }
  }

  private func stopCalorieTimer() {
    calorieTimer?.invalidate()
    calorieTimer = nil
    lastHrSampleAt = nil
  }

  /** Rough active calorie estimate from heart rate (Keytel-style, 80 kg default). */
  private func accumulateCalories(bpm: Int, seconds: TimeInterval) {
    guard bpm > restingHeartRate + 5, seconds > 0 else { return }
    let weightKg = 80.0
    let age = 30.0
    let male = true
    let hours = seconds / 3600.0
    let perHour: Double
    if male {
      perHour = (-55.0969 + 0.6309 * Double(bpm) + 0.1988 * weightKg + 0.2017 * age) / 4.184
    } else {
      perHour = (-20.4022 + 0.4472 * Double(bpm) - 0.1263 * weightKg + 0.074 * age) / 4.184
    }
    let burned = max(0, perHour * hours)
    sessionCalories = max(0, sessionCalories + Int(burned.rounded()))
    activeCalories = sessionCalories
  }

  private func applyMessage(_ message: [String: Any]) {
    guard let type = message["type"] as? String else { return }

    if type == "workout_state" {
      let shouldPresent = message["presentWorkout"] as? Bool ?? false
      if let state = message["state"] as? [String: Any] {
        applyWorkoutState(state, shouldPresent: shouldPresent)
      } else if let state = message["state"] as? NSDictionary {
        applyWorkoutState(state as? [String: Any] ?? [:], shouldPresent: shouldPresent)
      }
      return
    }

    if type == "error", let messageText = message["message"] as? String {
      lastSpokenResponse = messageText
    }
  }

  private func beginWorkoutRuntime() {
    guard workoutRuntimeSession == nil else { return }
    let session = WKExtendedRuntimeSession()
    session.start()
    workoutRuntimeSession = session
  }

  private func endWorkoutRuntime() {
    workoutRuntimeSession?.invalidate()
    workoutRuntimeSession = nil
  }

  private func applyWorkoutState(_ state: [String: Any], shouldPresent: Bool = false) {
    let previousSessionId = workoutSessionId
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
      weightLbs = activeSet["weightLbs"] as? Int
      stationLabel = activeSet["stationLabel"] as? String ?? ""
      statusLine = activeSet["statusLine"] as? String ?? ""
      supersetHint = activeSet["supersetHint"] as? String ?? ""
      setLabel = "Set \(setNumber)/\(targetSets) · \(targetReps) reps"
      if statusLine.isEmpty {
        statusLine = "Set \(setNumber)/\(targetSets)"
      }
      phase = activeSet["phase"] as? String ?? "active_set"

      if let rest = activeSet["restSecondsRemaining"] as? Int, rest > 0 {
        startRestCountdown(seconds: rest)
      } else if phase != "rest" {
        clearRestCountdown()
      }

      if previousSessionId == nil, workoutSessionId != nil {
        beginWorkoutRuntime()
        if shouldPresent {
          WKInterfaceDevice.current().play(.start)
          lastSpokenResponse = "Workout started on iPhone"
        }
      }
    } else {
      if !workoutRecommendation.isEmpty {
        let parts = workoutRecommendation.components(separatedBy: " · ")
        if parts.count >= 2 {
          exerciseName = parts[0]
          setLabel = parts.dropFirst().joined(separator: " · ")
        } else {
          exerciseName = workoutRecommendation
          setLabel = "Start Today's Workout"
        }
      } else {
        exerciseName = "Start on iPhone"
        setLabel = "Open ONE MORE on iPhone"
      }
      phase = "idle"
      currentRepCount = 0
      targetReps = 0
      motionTrackingEnabled = false
      workoutSessionId = nil
      weightLbs = nil
      stationLabel = ""
      statusLine = ""
      supersetHint = ""
      clearRestCountdown()
      stopCalorieTimer()
      sessionCalories = 0
      activeCalories = 0
      if previousSessionId != nil {
        endWorkoutRuntime()
      }
    }

    if let health = state["healthSnapshot"] as? [String: Any] {
      if let hr = health["heartRateBpm"] as? Int {
        heartRateBpm = hr
      }
      if let resting = health["restingHeartRateBpm"] as? Int {
        restingHeartRate = resting
      }
      if let active = health["activeCalories"] as? Int {
        activeCalories = active
      }
      if let session = health["sessionCalories"] as? Int {
        sessionCalories = session
      }
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

    guard WCSession.default.activationState == .activated else {
      lastSpokenResponse = "Waiting for iPhone…"
      return
    }

    lastSpokenResponse = "Contacting iPhone…"

    if WCSession.default.isReachable {
      WCSession.default.sendMessage(payload, replyHandler: { [weak self] reply in
        DispatchQueue.main.async {
          self?.applyMessage(reply)
        }
      }, errorHandler: { [weak self] error in
        DispatchQueue.main.async {
          self?.lastSpokenResponse = "Open ONE MORE on iPhone"
          print("[ONEMOREWatch] sendMessage failed: \(error.localizedDescription)")
          WCSession.default.transferUserInfo(payload)
        }
      })
    } else {
      WCSession.default.transferUserInfo(payload)
      lastSpokenResponse = "Open ONE MORE on iPhone"
    }

    WKInterfaceDevice.current().play(.click)
  }

  func logSet() {
    sendToPhone(type: "log_set")
  }

  func skipRest() {
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

  func cancelWorkout() {
    sendToPhone(type: "cancel_workout")
  }

  func voiceReps() {
    guard let controller = WKExtension.shared().visibleInterfaceController else {
      lastSpokenResponse = "Open ONE MORE on iPhone"
      return
    }
    controller.presentTextInputController(
      withSuggestions: ["6", "8", "10", "12"],
      allowedInputMode: .plain
    ) { [weak self] results in
      DispatchQueue.main.async {
        guard let self, let text = results?.first as? String, !text.isEmpty else { return }
        self.sendVoiceCommand(text)
      }
    }
  }

  func voiceWeight() {
    guard let controller = WKExtension.shared().visibleInterfaceController else {
      lastSpokenResponse = "Open ONE MORE on iPhone"
      return
    }
    controller.presentTextInputController(
      withSuggestions: ["135", "185", "225"],
      allowedInputMode: .plain
    ) { [weak self] results in
      DispatchQueue.main.async {
        guard let self, let text = results?.first as? String, !text.isEmpty else { return }
        let digits = text.filter { $0.isNumber }
        guard let lbs = Int(digits), lbs > 0 else {
          self.lastSpokenResponse = "Enter weight in pounds"
          return
        }
        self.sendToPhone(type: "set_weight", extra: ["weightLbs": lbs])
      }
    }
  }

  func requestPhoneSync() {
    sendToPhone(type: "request_sync")
  }

  var isActiveSetPhase: Bool {
    phase == "active_set" || phase == "between_sets"
  }

  var isRestPhase: Bool {
    if let restSeconds, restSeconds > 0 { return true }
    return phase == "rest"
  }
}
