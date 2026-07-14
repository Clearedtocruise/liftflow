import Foundation
import HealthKit
import WatchConnectivity
import WatchKit

final class WorkoutConnectivity: NSObject, ObservableObject, WCSessionDelegate, HKWorkoutSessionDelegate, HKLiveWorkoutBuilderDelegate {
  @Published var exerciseName = "ONE MORE"
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

  @Published var isCardioMode = false
  @Published var cardioActivityLabel = ""
  @Published var cardioElapsedSeconds = 0
  @Published var cardioDistanceLabel = ""
  @Published var cardioPaceLabel = ""
  @Published var cardioRunning = false
  @Published var cardioPhaseLabel = ""

  private(set) var workoutSessionId: String?
  private var cardioSessionId: String?
  private var cardioSessionStartedAt: Date?
  private var cardioElapsedTimer: Timer?
  private var lastHeartRateSentAt: Date?
  private var previousPhase = "idle"
  private var didPlayRestWarning = false
  private var didPlayRestCompleteHaptic = false
  private var isRestCountdownActive = false
  private var suppressRestCompleteHaptic = false
  private var restEndDate: Date?
  private var restTimer: Timer?
  private var calorieTimer: Timer?
  private var workoutRuntimeSession: WKExtendedRuntimeSession?
  private var healthStore = HKHealthStore()
  private var hkWorkoutSession: HKWorkoutSession?
  private var hkWorkoutBuilder: HKLiveWorkoutBuilder?
  private var lastHrSampleAt: Date?
  private var restingHeartRate = 65
  /// Keeps Watch on workout UI across brief sync gaps until phone clears the session.
  private var sessionLatchActive = false

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
    sendHeartRateSampleIfNeeded(bpm: bpm, at: now)
  }

  private func sendHeartRateSampleIfNeeded(bpm: Int, at: Date) {
    guard isCardioMode, cardioRunning else { return }
    if let lastSent = lastHeartRateSentAt, at.timeIntervalSince(lastSent) < 3 {
      return
    }
    lastHeartRateSentAt = at
    sendToPhone(type: "heart_rate_sample", extra: [
      "bpm": bpm,
      "recordedAt": ISO8601DateFormatter().string(from: at),
    ])
  }

  private func applyCardioState(_ state: [String: Any], shouldPresent: Bool = false) {
    let previousSession = cardioSessionId
    isCardioMode = true
    workoutSessionId = nil
    phase = "cardio"
    cardioSessionId = state["sessionId"] as? String
    cardioActivityLabel = state["activityLabel"] as? String ?? "Cardio"
    cardioRunning = state["running"] as? Bool ?? false
    cardioPhaseLabel = state["phaseLabel"] as? String ?? ""

    if let startedAt = state["sessionStartedAt"] as? String {
      cardioSessionStartedAt = ISO8601DateFormatter().date(from: startedAt)
    } else if cardioSessionStartedAt == nil, cardioRunning {
      cardioSessionStartedAt = Date().addingTimeInterval(-Double(state["elapsedSeconds"] as? Int ?? 0))
    }

    if cardioRunning {
      startCardioElapsedTimer()
      cardioElapsedSeconds = computeCardioElapsed()
    } else {
      cardioElapsedSeconds = state["elapsedSeconds"] as? Int ?? computeCardioElapsed()
      stopCardioElapsedTimer()
    }

    exerciseName = cardioActivityLabel
    setLabel = formatCardioElapsed(cardioElapsedSeconds)
    statusLine = cardioPhaseLabel.isEmpty ? (cardioRunning ? "In progress" : "Paused") : cardioPhaseLabel

    if let pace = state["paceLabel"] as? String, !pace.isEmpty {
      cardioPaceLabel = pace
    } else {
      cardioPaceLabel = ""
    }

    if let distanceMeters = state["distanceMeters"] as? Double, distanceMeters > 0 {
      let km = distanceMeters / 1000.0
      cardioDistanceLabel = String(format: "%.2f km", km)
    } else if let distanceMeters = state["distanceMeters"] as? Int, distanceMeters > 0 {
      let km = Double(distanceMeters) / 1000.0
      cardioDistanceLabel = String(format: "%.2f km", km)
    } else {
      cardioDistanceLabel = ""
    }

    if let calories = state["calories"] as? Int {
      sessionCalories = calories
      activeCalories = calories
    }

    if let hr = state["heartRateBpm"] as? Int {
      heartRateBpm = hr
    }

    if previousSession == nil, cardioSessionId != nil {
      let activity: HKWorkoutActivityType = {
        let label = cardioActivityLabel.lowercased()
        if label.contains("run") { return .running }
        if label.contains("bike") || label.contains("cycle") { return .cycling }
        if label.contains("walk") { return .walking }
        if label.contains("row") { return .rowing }
        return .mixedCardio
      }()
      beginWorkoutRuntime(activityType: activity)
      if shouldPresent {
        WKInterfaceDevice.current().play(.start)
        lastSpokenResponse = "Cardio started on iPhone"
      }
    } else if cardioSessionId != nil {
      sessionLatchActive = true
    }

    if cardioRunning {
      if calorieTimer == nil {
        startCalorieTimer()
      }
    } else if !cardioRunning, cardioElapsedSeconds == 0, previousSession != nil, cardioSessionId == nil {
      clearCardioState()
    }
  }

  private func clearCardioState() {
    isCardioMode = false
    cardioSessionId = nil
    cardioSessionStartedAt = nil
    stopCardioElapsedTimer()
    cardioActivityLabel = ""
    cardioElapsedSeconds = 0
    cardioDistanceLabel = ""
    cardioPaceLabel = ""
    cardioRunning = false
    cardioPhaseLabel = ""
    lastHeartRateSentAt = nil
    phase = "idle"
    exerciseName = "ONE MORE"
    setLabel = ""
    statusLine = ""
    stopCalorieTimer()
    sessionCalories = 0
    activeCalories = 0
    endWorkoutRuntime()
  }

  private func formatCardioElapsed(_ seconds: Int) -> String {
    let m = seconds / 60
    let s = seconds % 60
    return String(format: "%d:%02d", m, s)
  }

  private func computeCardioElapsed() -> Int {
    guard let started = cardioSessionStartedAt else { return cardioElapsedSeconds }
    return max(0, Int(Date().timeIntervalSince(started)))
  }

  private func startCardioElapsedTimer() {
    cardioElapsedTimer?.invalidate()
    cardioElapsedTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
      guard let self, self.isCardioMode, self.cardioRunning else { return }
      self.cardioElapsedSeconds = self.computeCardioElapsed()
      self.setLabel = self.formatCardioElapsed(self.cardioElapsedSeconds)
    }
  }

  private func stopCardioElapsedTimer() {
    cardioElapsedTimer?.invalidate()
    cardioElapsedTimer = nil
  }

  func pauseCardio() {
    sendToPhone(type: "cardio_pause")
  }

  func resumeCardio() {
    sendToPhone(type: "cardio_resume")
  }

  func finishCardio() {
    sendToPhone(type: "cardio_finish")
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

    if type == "cardio_state" {
      let shouldPresent = message["presentWorkout"] as? Bool ?? false
      if let state = message["state"] as? [String: Any] {
        applyCardioState(state, shouldPresent: shouldPresent)
      } else if let state = message["state"] as? NSDictionary {
        applyCardioState(state as? [String: Any] ?? [:], shouldPresent: shouldPresent)
      } else if message["state"] == nil || message["state"] is NSNull {
        clearCardioState()
      }
      return
    }

    if type == "error", let messageText = message["message"] as? String {
      lastSpokenResponse = messageText
      return
    }

    if type == "rest_complete" {
      playRestCompleteHaptic()
      return
    }
  }

  private func beginWorkoutRuntime(activityType: HKWorkoutActivityType = .traditionalStrengthTraining) {
    sessionLatchActive = true
    startHealthKitWorkout(activityType: activityType)

    guard workoutRuntimeSession == nil else { return }
    let session = WKExtendedRuntimeSession()
    session.start()
    workoutRuntimeSession = session
  }

  private func endWorkoutRuntime() {
    sessionLatchActive = false
    stopHealthKitWorkout()
    workoutRuntimeSession?.invalidate()
    workoutRuntimeSession = nil
  }

  /** Always release latch, clear rest, and show idle/home UI. */
  private func teardownToIdle(spoken: String? = nil) {
    clearRestCountdown(announceComplete: false)
    stopCalorieTimer()
    sessionCalories = 0
    activeCalories = 0
    didPlayRestWarning = false
    currentRepCount = 0
    targetReps = 0
    motionTrackingEnabled = false
    workoutSessionId = nil
    weightLbs = nil
    stationLabel = ""
    statusLine = ""
    supersetHint = ""
    progressionLine = ""
    phase = "idle"
    previousPhase = "idle"
    if let spoken, !spoken.isEmpty {
      lastSpokenResponse = spoken
    }
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
      exerciseName = "ONE MORE"
      setLabel = ""
    }
    endWorkoutRuntime()
    WKInterfaceDevice.current().play(.stop)
  }

  private func startHealthKitWorkout(activityType: HKWorkoutActivityType) {
    guard HKHealthStore.isHealthDataAvailable() else { return }
    if hkWorkoutSession != nil { return }

    let configuration = HKWorkoutConfiguration()
    configuration.activityType = activityType
    configuration.locationType = activityType == .running || activityType == .cycling
      ? .outdoor
      : .indoor

    do {
      let session = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
      let builder = session.associatedWorkoutBuilder()
      builder.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: configuration)
      session.delegate = self
      builder.delegate = self
      hkWorkoutSession = session
      hkWorkoutBuilder = builder
      session.startActivity(with: Date())
      builder.beginCollection(withStart: Date()) { _, _ in }
    } catch {
      print("[ONEMOREWatch] HKWorkoutSession failed: \(error.localizedDescription)")
    }
  }

  private func stopHealthKitWorkout() {
    let end = Date()
    hkWorkoutSession?.end()
    hkWorkoutBuilder?.endCollection(withEnd: end) { [weak self] _, _ in
      self?.hkWorkoutBuilder?.finishWorkout { _, _ in }
      DispatchQueue.main.async {
        self?.hkWorkoutSession = nil
        self?.hkWorkoutBuilder = nil
      }
    }
    if hkWorkoutBuilder == nil {
      hkWorkoutSession = nil
    }
  }

  func workoutSession(
    _ workoutSession: HKWorkoutSession,
    didChangeTo toState: HKWorkoutSessionState,
    from fromState: HKWorkoutSessionState,
    date: Date
  ) {
    DispatchQueue.main.async {
      if toState == .ended || toState == .stopped {
        self.sessionLatchActive = false
        return
      }
      // Keep UI latched while HealthKit considers the workout running/paused.
      if toState == .running || toState == .paused {
        self.sessionLatchActive = true
      }
    }
  }

  func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
    print("[ONEMOREWatch] HKWorkoutSession error: \(error.localizedDescription)")
  }

  func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {}

  func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

  private func applyWorkoutState(_ state: [String: Any], shouldPresent: Bool = false) {
    // Cardio owns the Watch while a run/ride is active on iPhone — ignore strength pushes.
    if isCardioMode, cardioSessionId != nil {
      return
    }

    isCardioMode = false
    let previousSessionId = workoutSessionId
    let previousStatePhase = phase
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
      playPhaseTransitionCue(from: previousStatePhase, to: phase)

      if let rest = activeSet["restSecondsRemaining"] as? Int, rest > 0 {
        startRestCountdown(seconds: rest)
      } else if phase != "rest" {
        clearRestCountdown(announceComplete: false)
      }

      if previousSessionId == nil, workoutSessionId != nil {
        beginWorkoutRuntime(activityType: .traditionalStrengthTraining)
        if shouldPresent {
          WKInterfaceDevice.current().play(.start)
          lastSpokenResponse = "Workout started on iPhone"
        }
      } else if workoutSessionId != nil {
        sessionLatchActive = true
        if hkWorkoutSession == nil {
          beginWorkoutRuntime(activityType: .traditionalStrengthTraining)
        }
      }
    } else {
      // Idle preview / recommendation — do not tear down an in-progress session on sync gaps.
      let explicitlyEnded = state["sessionEnded"] as? Bool == true
      if explicitlyEnded {
        self.teardownToIdle(spoken: state["lastSpokenResponse"] as? String)
        return
      }
      if sessionLatchActive, previousSessionId != nil {
        if !workoutRecommendation.isEmpty {
          lastSpokenResponse = workoutRecommendation
        }
        return
      }

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
        exerciseName = "ONE MORE"
        setLabel = ""
      }
      phase = "idle"
      previousPhase = "idle"
      didPlayRestWarning = false
      currentRepCount = 0
      targetReps = 0
      motionTrackingEnabled = false
      workoutSessionId = nil
      weightLbs = nil
      stationLabel = ""
      statusLine = ""
      supersetHint = ""
      clearRestCountdown(announceComplete: false)
      stopCalorieTimer()
      sessionCalories = 0
      activeCalories = 0
      if previousSessionId != nil || sessionLatchActive {
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

  private func playRestCompleteHaptic() {
    guard !didPlayRestCompleteHaptic, !suppressRestCompleteHaptic else {
      suppressRestCompleteHaptic = false
      return
    }
    didPlayRestCompleteHaptic = true
    WKInterfaceDevice.current().play(.notification)
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
      WKInterfaceDevice.current().play(.success)
    }
  }

  private func startRestCountdown(seconds: Int) {
    let continuingSameRest =
      restEndDate != nil && seconds > 0 && seconds <= (restSeconds ?? seconds) + 1
    if !continuingSameRest {
      didPlayRestWarning = false
      didPlayRestCompleteHaptic = false
      suppressRestCompleteHaptic = false
    }

    isRestCountdownActive = true
    restEndDate = Date().addingTimeInterval(TimeInterval(seconds))
    restSeconds = seconds
    restTimer?.invalidate()
    restTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
      guard let self, let end = self.restEndDate else { return }
      let remaining = max(0, Int(end.timeIntervalSinceNow.rounded(.up)))
      self.restSeconds = remaining > 0 ? remaining : nil
      if remaining <= 3 && remaining > 0 && !self.didPlayRestWarning {
        self.didPlayRestWarning = true
        WKInterfaceDevice.current().play(.directionUp)
      }
      if remaining <= 0 {
        self.playRestCompleteHaptic()
        self.clearRestCountdown(announceComplete: false)
      }
    }
  }

  private func clearRestCountdown(announceComplete: Bool = false) {
    if announceComplete && isRestCountdownActive {
      playRestCompleteHaptic()
    }
    restTimer?.invalidate()
    restTimer = nil
    restEndDate = nil
    restSeconds = nil
    didPlayRestWarning = false
    isRestCountdownActive = false
    suppressRestCompleteHaptic = false
  }

  private func playPhaseTransitionCue(from oldPhase: String, to newPhase: String) {
    guard oldPhase != newPhase else { return }
    if newPhase == "rest" {
      WKInterfaceDevice.current().play(.directionDown)
    } else if oldPhase == "rest" && (newPhase == "active_set" || newPhase == "between_sets") {
      WKInterfaceDevice.current().play(.start)
    }
    previousPhase = newPhase
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
    suppressRestCompleteHaptic = true
    clearRestCountdown(announceComplete: false)
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
    // Tear down immediately so Watch doesn't stay stuck if phone reply is slow/lost.
    teardownToIdle(spoken: "Ending workout…")
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
