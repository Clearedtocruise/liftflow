import SwiftUI

private let accent = Color(red: 0.05, green: 0.56, blue: 1.0)

struct ContentView: View {
  @StateObject private var connectivity = WorkoutConnectivity()
  @StateObject private var heartRate = HeartRateReader()
  @StateObject private var motion = MotionCapture()

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 8) {
        statusRow

        if let score = connectivity.recoveryScore {
          recoveryBadge(score: score, label: connectivity.recoveryLabel)
        }

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
        } else {
          idlePanel
        }

        if !connectivity.lastSpokenResponse.isEmpty {
          Text(connectivity.lastSpokenResponse)
            .font(.caption2)
            .foregroundStyle(.secondary)
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
      motion.stopStreaming()
    }
    .onChange(of: heartRate.bpm) { newValue in
      if let newValue {
        connectivity.heartRateBpm = newValue
      }
    }
    .onChange(of: connectivity.phase) { newPhase in
      syncMotionStreaming(for: newPhase)
    }
    .onChange(of: connectivity.motionTrackingEnabled) { enabled in
      if enabled && connectivity.isActiveSetPhase {
        motion.startStreaming(connectivity: connectivity)
      } else {
        motion.stopStreaming()
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
      if motion.isStreaming {
        Label("Motion", systemImage: "waveform.path")
          .font(.caption2)
          .foregroundStyle(accent)
      }
    }
  }

  private func recoveryBadge(score: Int, label: String) -> some View {
    HStack(spacing: 6) {
      Text("Recovery")
        .font(.caption2)
        .foregroundStyle(.secondary)
      Text("\(score)")
        .font(.caption.bold())
        .foregroundStyle(accent)
      if !label.isEmpty {
        Text(label)
          .font(.caption2)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
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
        Label("\(connectivity.currentRepCount)/\(connectivity.targetReps)", systemImage: "figure.strengthtraining.traditional")
          .font(.caption)
          .foregroundStyle(.primary)
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
      voiceQuickActions
    }
    .frame(maxWidth: .infinity)
    .padding(.vertical, 6)
  }

  private var activeSetPanel: some View {
    VStack(spacing: 6) {
      if connectivity.motionTrackingEnabled {
        repConfidenceBar
      }

      Button("Log Set") { connectivity.logSet() }
        .buttonStyle(.borderedProminent)
        .tint(accent)

      if connectivity.needsConfirmation {
        Button("Confirm Reps") { connectivity.confirmReps() }
          .buttonStyle(.bordered)
      }

      voiceQuickActions
    }
  }

  private var idlePanel: some View {
    VStack(spacing: 8) {
      Button("Start Today's Workout") { connectivity.startTodaysWorkout() }
        .buttonStyle(.borderedProminent)
        .tint(accent)

      voiceQuickActions
    }
  }

  private var repConfidenceBar: some View {
    VStack(alignment: .leading, spacing: 4) {
      HStack {
        Text("Reps")
          .font(.caption2)
          .foregroundStyle(.secondary)
        Spacer()
        Text("\(Int(connectivity.motionConfidence * 100))%")
          .font(.caption2)
          .foregroundStyle(connectivity.needsConfirmation ? .orange : accent)
      }
      ProgressView(value: min(max(connectivity.motionConfidence, 0), 1))
        .tint(connectivity.needsConfirmation ? .orange : accent)
    }
  }

  private var voiceQuickActions: some View {
    VStack(spacing: 4) {
      HStack(spacing: 4) {
        quickVoiceChip("Log set") { connectivity.sendVoiceCommand("Log set") }
        quickVoiceChip("Recovery") { connectivity.sendVoiceCommand("How recovered am I?") }
      }
      quickVoiceChip("Next set") { connectivity.sendVoiceCommand("Next set") }
    }
  }

  private func quickVoiceChip(_ title: String, action: @escaping () -> Void) -> some View {
    Button(title, action: action)
      .font(.caption2)
      .buttonStyle(.bordered)
      .tint(accent)
  }

  private func syncMotionStreaming(for phase: String) {
    if connectivity.motionTrackingEnabled && (phase == "active_set" || phase == "between_sets") {
      motion.startStreaming(connectivity: connectivity)
    } else {
      motion.stopStreaming()
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
