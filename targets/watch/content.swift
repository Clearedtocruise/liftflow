import SwiftUI

private let accent = Color(red: 0.05, green: 0.56, blue: 1.0)

struct ContentView: View {
  @StateObject private var connectivity = WorkoutConnectivity()
  @StateObject private var heartRate = HeartRateReader()
  @StateObject private var workoutSession = WorkoutSessionManager()
  @Environment(\.scenePhase) private var scenePhase

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 10) {
        statusRow
        workoutStatusCard
        metricsRow

        if connectivity.isRestPhase {
          restPanel
        } else if connectivity.workoutSessionId != nil {
          activeSetPanel
        } else {
          idlePanel
        }

        if !connectivity.lastSpokenResponse.isEmpty {
          Text(connectivity.lastSpokenResponse)
            .font(.caption2)
            .foregroundStyle(connectivity.lastSpokenResponse.contains("iPhone") ? .orange : .secondary)
            .lineLimit(3)
        }

        if let sessionError = workoutSession.lastError {
          Text(sessionError)
            .font(.caption2)
            .foregroundStyle(.orange)
            .lineLimit(2)
        }
      }
      .padding(.horizontal, 6)
    }
    .onAppear {
      heartRate.requestAuthorization()
      heartRate.start()
      workoutSession.requestAuthorization()
      connectivity.requestPhoneSync()
      // A workout may already be in progress when the view first appears (wrist raise after the
      // phone started one), so mirror the current state rather than waiting for a change.
      if connectivity.workoutSessionId != nil { workoutSession.start() }
    }
    .onDisappear {
      heartRate.stop()
    }
    .onChange(of: heartRate.bpm) { newValue in
      if let newValue {
        connectivity.recordHeartRate(newValue)
      }
    }
    .onChange(of: connectivity.workoutSessionId) { sessionId in
      if sessionId != nil {
        workoutSession.start()
      } else {
        workoutSession.end()
      }
    }
    .onChange(of: scenePhase) { phase in
      // Whichever app owns a running workout session owns the wrist. If ours was refused at the
      // Health prompt or lost to another workout app, reclaim it the next time the wrist comes up
      // rather than leaving the lifter staring at the Fitness app for the rest of the session.
      guard phase == .active else { return }
      if connectivity.workoutSessionId != nil && !workoutSession.isRunning {
        workoutSession.start()
      }
    }
  }

  private var statusRow: some View {
    HStack {
      Circle()
        .fill(connectivity.isReachable ? Color.green : Color.orange)
        .frame(width: 8, height: 8)
      Text(connectivity.isReachable ? "Connected" : "Waiting for iPhone")
        .font(.caption2)
        .foregroundStyle(.secondary)
      Spacer()
    }
  }

  private var workoutStatusCard: some View {
    VStack(alignment: .leading, spacing: 4) {
      if !connectivity.stationLabel.isEmpty {
        Text(connectivity.stationLabel)
          .font(.caption)
          .foregroundStyle(accent)
      }

      Text(connectivity.exerciseName)
        .font(.headline)
        .lineLimit(2)
        .minimumScaleFactor(0.75)

      if !connectivity.statusLine.isEmpty {
        Text(connectivity.statusLine)
          .font(.system(size: 22, weight: .bold, design: .rounded))
          .monospacedDigit()
      } else if !connectivity.setLabel.isEmpty {
        Text(connectivity.setLabel)
          .font(.system(size: 22, weight: .bold, design: .rounded))
          .monospacedDigit()
      }

      if !connectivity.supersetHint.isEmpty {
        Text(connectivity.supersetHint)
          .font(.caption)
          .foregroundStyle(accent)
          .lineLimit(2)
      }

      if connectivity.currentRepCount > 0 {
        Text("\(connectivity.currentRepCount) reps logged")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(8)
    .background(Color.white.opacity(0.06))
    .clipShape(RoundedRectangle(cornerRadius: 10))
  }

  private var metricsRow: some View {
    HStack(spacing: 10) {
      if let hr = workoutSession.heartRateBpm ?? heartRate.bpm ?? connectivity.heartRateBpm {
        Label("\(hr)", systemImage: "heart.fill")
          .font(.caption)
          .foregroundStyle(.pink)
      }
      if connectivity.sessionCalories > 0 {
        VStack(alignment: .leading, spacing: 0) {
          Text("\(connectivity.sessionCalories) cal")
            .font(.caption)
            .foregroundStyle(.orange)
          Text("session")
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
      }
      if connectivity.activeCalories > 0 {
        VStack(alignment: .leading, spacing: 0) {
          Text("\(connectivity.activeCalories) cal")
            .font(.caption)
            .foregroundStyle(accent)
          Text("active")
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
      }
      if let weight = connectivity.weightLbs, weight > 0 {
        Text("\(weight) lb")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
    }
  }

  private var restPanel: some View {
    VStack(spacing: 8) {
      Text("REST")
        .font(.caption2)
        .foregroundStyle(.secondary)
      Text(formatRest(connectivity.restSeconds ?? 0))
        .font(.system(size: 36, weight: .bold, design: .rounded))
        .monospacedDigit()
      if !connectivity.supersetHint.isEmpty {
        Text("Next: \(connectivity.supersetHint)")
          .font(.caption2)
          .foregroundStyle(accent)
          .multilineTextAlignment(.center)
          .lineLimit(2)
      }
      Button("Skip Rest") { connectivity.skipRest() }
        .buttonStyle(.borderedProminent)
        .tint(accent)
      Button("End Workout") { connectivity.cancelWorkout() }
        .buttonStyle(.bordered)
        .tint(.red)
    }
    .frame(maxWidth: .infinity)
  }

  private var activeSetPanel: some View {
    VStack(spacing: 8) {
      if !connectivity.progressionLine.isEmpty {
        Text(connectivity.progressionLine)
          .font(.caption2)
          .foregroundStyle(accent)
          .multilineTextAlignment(.center)
          .lineLimit(2)
      }

      Button("Log Set") { connectivity.logSet() }
        .buttonStyle(.borderedProminent)
        .tint(accent)

      // TextFieldLink rather than presentTextInputController: the latter needs a WatchKit
      // interface controller, which does not exist under the SwiftUI app lifecycle.
      HStack(spacing: 6) {
        TextFieldLink("Say Reps", prompt: Text("Reps")) { text in
          connectivity.submitSpokenReps(text)
        }
        .buttonStyle(.bordered)
        .tint(accent)

        TextFieldLink("Say Weight", prompt: Text("Weight (lb)")) { text in
          connectivity.submitSpokenWeight(text)
        }
        .buttonStyle(.bordered)
        .tint(accent)
      }

      Button("End Workout") { connectivity.cancelWorkout() }
        .buttonStyle(.bordered)
        .tint(.red)
    }
  }

  private var idlePanel: some View {
    VStack(spacing: 8) {
      if !connectivity.workoutRecommendation.isEmpty {
        Text(connectivity.workoutRecommendation)
          .font(.caption)
          .foregroundStyle(.secondary)
          .multilineTextAlignment(.center)
          .lineLimit(3)
      }
      Button("Start Today's Workout") { connectivity.startTodaysWorkout() }
        .buttonStyle(.borderedProminent)
        .tint(accent)
    }
  }

  private func formatRest(_ seconds: Int) -> String {
    let m = seconds / 60
    let s = seconds % 60
    return String(format: "%d:%02d", m, s)
  }
}

struct ContentView_Previews: PreviewProvider {
  static var previews: some View {
    ContentView()
  }
}
