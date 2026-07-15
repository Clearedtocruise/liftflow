import SwiftUI

private let accent = Color(red: 0.05, green: 0.56, blue: 1.0)
private let accentMuted = Color(red: 0.09, green: 0.45, blue: 0.82)

struct ContentView: View {
  @StateObject private var connectivity = WorkoutConnectivity()
  @StateObject private var heartRate = HeartRateReader()

  private var isHomeScreen: Bool {
    !connectivity.isCardioMode && connectivity.workoutSessionId == nil && !connectivity.isRestPhase
  }

  var body: some View {
    Group {
      if isHomeScreen {
        WatchHomeScreen(connectivity: connectivity, heartRate: heartRate)
      } else {
        activeWorkoutScreen
      }
    }
    .onAppear {
      heartRate.requestAuthorization()
      heartRate.start()
      connectivity.requestPhoneSync()
    }
    .onDisappear {
      heartRate.stop()
    }
    .onChange(of: heartRate.bpm) { newValue in
      if let newValue {
        connectivity.recordHeartRate(newValue)
      }
    }
    .sheet(isPresented: Binding(
      get: { connectivity.voiceEntryMode != nil },
      set: { if !$0 { connectivity.cancelVoiceEntry() } }
    )) {
      VoiceEntrySheet(connectivity: connectivity)
    }
  }

  private var activeWorkoutScreen: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 10) {
        statusRow
        workoutStatusCard
        metricsRow

        if connectivity.isCardioMode {
          cardioPanel
        } else if connectivity.isRestPhase {
          restPanel
        } else if connectivity.workoutSessionId != nil {
          activeSetPanel
        }

        if !connectivity.lastSpokenResponse.isEmpty {
          Text(connectivity.lastSpokenResponse)
            .font(.caption2)
            .foregroundStyle(connectivity.lastSpokenResponse.contains("iPhone") ? .orange : .secondary)
            .lineLimit(3)
        }
      }
      .padding(.horizontal, 6)
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
      if let hr = heartRate.bpm ?? connectivity.heartRateBpm {
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

  private var cardioPanel: some View {
    VStack(spacing: 8) {
      Text(connectivity.cardioActivityLabel)
        .font(.caption2)
        .foregroundStyle(.secondary)
        .lineLimit(1)
      Text(connectivity.cardioRunning ? "ACTIVE" : "PAUSED")
        .font(.caption2)
        .foregroundStyle(connectivity.cardioRunning ? accent : .orange)
      Text(formatRest(connectivity.cardioElapsedSeconds))
        .font(.system(size: 36, weight: .bold, design: .rounded))
        .monospacedDigit()
      if !connectivity.cardioDistanceLabel.isEmpty {
        Text(connectivity.cardioDistanceLabel)
          .font(.caption)
          .foregroundStyle(accent)
      }
      if !connectivity.cardioPaceLabel.isEmpty {
        Text(connectivity.cardioPaceLabel)
          .font(.caption2)
          .foregroundStyle(.secondary)
      }
      if connectivity.sessionCalories > 0 {
        Text("\(connectivity.sessionCalories) cal")
          .font(.caption)
          .foregroundStyle(.orange)
      }
      if let hr = heartRate.bpm ?? connectivity.heartRateBpm {
        Label("\(hr) bpm", systemImage: "heart.fill")
          .font(.caption)
          .foregroundStyle(.pink)
      }
      HStack(spacing: 8) {
        Button(connectivity.cardioRunning ? "Pause" : "Resume") {
          if connectivity.cardioRunning {
            connectivity.pauseCardio()
          } else {
            connectivity.resumeCardio()
          }
        }
        .buttonStyle(.bordered)
        .tint(accent)
        Button("Finish") { connectivity.finishCardio() }
          .buttonStyle(.borderedProminent)
          .tint(.orange)
      }
    }
    .frame(maxWidth: .infinity)
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

      HStack(spacing: 6) {
        Button("Say Reps") { connectivity.voiceReps() }
          .buttonStyle(.bordered)
          .tint(accent)
        Button("Say Weight") { connectivity.voiceWeight() }
          .buttonStyle(.bordered)
          .tint(accent)
      }

      Button("End Workout") { connectivity.cancelWorkout() }
        .buttonStyle(.bordered)
        .tint(.red)
    }
  }

  private func formatRest(_ seconds: Int) -> String {
    let m = seconds / 60
    let s = seconds % 60
    return String(format: "%d:%02d", m, s)
  }
}

private struct VoiceEntrySheet: View {
  @ObservedObject var connectivity: WorkoutConnectivity

  private var title: String {
    connectivity.voiceEntryMode == "weight" ? "Weight (lb)" : "Reps"
  }

  var body: some View {
    VStack(spacing: 10) {
      Text(title)
        .font(.headline)
      TextField(
        connectivity.voiceEntryMode == "weight" ? "e.g. 45" : "e.g. 10",
        text: $connectivity.voiceEntryText
      )
      .textInputAutocapitalization(.never)
      HStack(spacing: 8) {
        Button("Cancel") { connectivity.cancelVoiceEntry() }
          .buttonStyle(.bordered)
        Button("Send") { connectivity.submitVoiceEntry() }
          .buttonStyle(.borderedProminent)
          .tint(accent)
      }
    }
    .padding()
  }
}

private struct WatchHomeScreen: View {
  @ObservedObject var connectivity: WorkoutConnectivity
  @ObservedObject var heartRate: HeartRateReader

  var body: some View {
    ScrollView {
      VStack(spacing: 14) {
        VStack(spacing: 4) {
          Text("ONE MORE")
            .font(.system(size: 22, weight: .bold, design: .rounded))
            .foregroundStyle(accent)
          Text("Workout companion")
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
        .padding(.top, 4)

        HStack(spacing: 6) {
          Circle()
            .fill(connectivity.isReachable ? Color.green : Color.orange)
            .frame(width: 8, height: 8)
          Text(connectivity.isReachable ? "iPhone connected" : "Open ONE MORE on iPhone")
            .font(.caption2)
            .foregroundStyle(connectivity.isReachable ? Color.green : .orange)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.white.opacity(0.08))
        .clipShape(Capsule())

        if let hr = heartRate.bpm ?? connectivity.heartRateBpm {
          Label("\(hr) bpm", systemImage: "heart.fill")
            .font(.caption)
            .foregroundStyle(.pink)
        }

        if !connectivity.workoutRecommendation.isEmpty {
          Text(connectivity.workoutRecommendation)
            .font(.caption)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .lineLimit(4)
            .padding(.horizontal, 4)
        } else {
          Text("Start a lift, run, or cardio session on your phone. Your sets, rest timer, and heart rate show up here.")
            .font(.caption2)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .lineLimit(5)
            .padding(.horizontal, 4)
        }

        VStack(spacing: 8) {
          featureRow(icon: "figure.strengthtraining.traditional", label: "Log sets & rest")
          featureRow(icon: "figure.run", label: "Cardio & HIIT")
          featureRow(icon: "heart.fill", label: "Heart rate")
        }
        .padding(.vertical, 4)

        Button("Sync with iPhone") {
          connectivity.requestPhoneSync()
        }
        .buttonStyle(.bordered)
        .tint(accentMuted)

        Button("Start Today's Workout") {
          connectivity.startTodaysWorkout()
        }
        .buttonStyle(.borderedProminent)
        .tint(accent)

        if !connectivity.lastSpokenResponse.isEmpty {
          Text(connectivity.lastSpokenResponse)
            .font(.caption2)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .lineLimit(2)
        }
      }
      .padding(.horizontal, 8)
      .padding(.bottom, 8)
    }
  }

  private func featureRow(icon: String, label: String) -> some View {
    HStack(spacing: 8) {
      Image(systemName: icon)
        .font(.caption)
        .foregroundStyle(accent)
        .frame(width: 18)
      Text(label)
        .font(.caption2)
        .foregroundStyle(.primary)
      Spacer()
    }
    .padding(.horizontal, 10)
    .padding(.vertical, 8)
    .background(Color.white.opacity(0.06))
    .clipShape(RoundedRectangle(cornerRadius: 10))
  }
}

struct ContentView_Previews: PreviewProvider {
  static var previews: some View {
    ContentView()
  }
}
