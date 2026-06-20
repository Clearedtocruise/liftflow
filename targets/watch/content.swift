import SwiftUI

private let accent = Color(red: 0.05, green: 0.56, blue: 1.0)

struct ContentView: View {
  @StateObject private var connectivity = WorkoutConnectivity()
  @StateObject private var heartRate = HeartRateReader()

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 8) {
        statusRow

        Text(connectivity.exerciseName)
          .font(.headline)
          .lineLimit(2)
          .minimumScaleFactor(0.8)

        if !connectivity.setLabel.isEmpty {
          Text(connectivity.setLabel)
            .font(.caption)
            .foregroundStyle(.secondary)
        }

        if !connectivity.progressionLine.isEmpty {
          Text(connectivity.progressionLine)
            .font(.caption2)
            .foregroundStyle(accent)
            .lineLimit(2)
        }

        metricsRow

        if connectivity.isRestPhase {
          restPanel
        } else if connectivity.isActiveSetPhase {
          activeSetPanel
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
      }
      .padding(.horizontal, 4)
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
        connectivity.heartRateBpm = newValue
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

  private var metricsRow: some View {
    HStack(spacing: 12) {
      if let hr = heartRate.bpm ?? connectivity.heartRateBpm {
        Label("\(hr)", systemImage: "heart.fill")
          .font(.caption)
          .foregroundStyle(accent)
      }
      if connectivity.isActiveSetPhase {
        if let weight = connectivity.weightLbs, weight > 0 {
          Text("\(weight) lb · \(connectivity.targetReps) reps")
            .font(.caption)
            .foregroundStyle(.secondary)
        } else {
          Text("Target \(connectivity.targetReps) reps")
            .font(.caption)
            .foregroundStyle(.secondary)
        }
      }
    }
  }

  private var restPanel: some View {
    VStack(spacing: 6) {
      Text("REST")
        .font(.caption2)
        .foregroundStyle(.secondary)
      Text(formatRest(connectivity.restSeconds ?? 0))
        .font(.system(size: 34, weight: .bold, design: .rounded))
        .monospacedDigit()
      Button("Skip Rest") { connectivity.skipRest() }
        .buttonStyle(.borderedProminent)
        .tint(accent)

      Button("End Workout") { connectivity.cancelWorkout() }
        .buttonStyle(.bordered)
        .tint(.red)
    }
    .frame(maxWidth: .infinity)
    .padding(.vertical, 6)
  }

  private var activeSetPanel: some View {
    VStack(spacing: 8) {
      if connectivity.progressionLine.isEmpty == false {
        Text(connectivity.progressionLine)
          .font(.caption2)
          .foregroundStyle(accent)
          .multilineTextAlignment(.center)
      } else {
        Text("Log on iPhone for weight & reps")
          .font(.caption2)
          .foregroundStyle(.secondary)
          .multilineTextAlignment(.center)
      }

      Button("Log Set") { connectivity.logSet() }
        .buttonStyle(.borderedProminent)
        .tint(accent)

      Button("Say Reps") { connectivity.voiceReps() }
        .buttonStyle(.bordered)
        .tint(accent)

      Button("Say Weight") { connectivity.voiceWeight() }
        .buttonStyle(.bordered)
        .tint(accent)

      Button("End Workout") { connectivity.cancelWorkout() }
        .buttonStyle(.bordered)
        .tint(.red)
    }
  }

  private var idlePanel: some View {
    VStack(spacing: 8) {
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
