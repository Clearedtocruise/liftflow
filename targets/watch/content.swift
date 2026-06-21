import SwiftUI

private let accent = Color(red: 0.05, green: 0.56, blue: 1.0)

struct ContentView: View {
  @StateObject private var connectivity = WorkoutConnectivity()
  @StateObject private var heartRate = HeartRateReader()

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
      }
      .padding(.horizontal, 6)
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
