import SwiftUI

/// Drop this file into a watchOS 10 app target. Apple Watch Series 8 is the controller:
/// tap, double tap, Digital Crown, long press, and brightness call the same session
/// the Even Hub plugin paints onto Even G2.
@main
struct VodcoachWatchApp: App {
  var body: some Scene {
    WindowGroup {
      ContentView()
    }
  }
}

struct ContentView: View {
  @AppStorage("vodcoach.glasses.api") private var api = "http://192.168.1.10:3000"
  @AppStorage("vodcoach.glasses.code") private var code = ""
  @State private var crown = 0.0
  @State private var lastStep = 0
  @State private var status = "未接続"

  var body: some View {
    ScrollView {
      VStack(spacing: 8) {
        TextField("API", text: $api)
          .textInputAutocapitalization(.never)
          .autocorrectionDisabled()
        TextField("コード", text: $code)
          .textInputAutocapitalization(.characters)
          .autocorrectionDisabled()
        Text(status)
          .font(.caption2)
          .foregroundStyle(.secondary)
        Button("タップ") { send("click") }
          .buttonStyle(.borderedProminent)
        Button("ダブルタップ") { send("double-click") }
        HStack {
          Button("明るく") { send("brighter") }
          Button("暗く") { send("dimmer") }
        }
        Button("長押しで待機") { send("long-press") }
        Text("クラウンで履歴")
          .font(.caption2)
          .foregroundStyle(.secondary)
      }
      .padding(.horizontal, 4)
    }
    .focusable(true)
    .digitalCrownRotation(
      $crown,
      from: -80,
      through: 80,
      by: 1,
      sensitivity: .medium,
      isContinuous: false,
      isHapticFeedbackEnabled: true
    )
    .onChange(of: crown) { _, newValue in
      let step = Int(newValue.rounded())
      guard step != lastStep else { return }
      let gesture = step > lastStep ? "scroll-up" : "scroll-down"
      lastStep = step
      send(gesture)
    }
    .task(id: code) {
      while !Task.isCancelled {
        await ping()
        try? await Task.sleep(nanoseconds: 4_000_000_000)
      }
    }
  }

  private func send(_ gesture: String) {
    Task { await post(["action": "gesture", "gesture": gesture, "source": "watch"]) }
  }

  private func ping() async {
    guard let endpoint = endpoint() else { return }
    var parts = URLComponents(url: endpoint, resolvingAgainstBaseURL: false)
    parts?.queryItems = [URLQueryItem(name: "code", value: normalized(code) ?? ""), URLQueryItem(name: "role", value: "watch")]
    guard let url = parts?.url else { return }
    do {
      let (_, response) = try await URLSession.shared.data(from: url)
      guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
        status = "届かない"
        return
      }
      status = "Watch 8"
    } catch {
      status = "届かない"
    }
  }

  private func post(_ payload: [String: String]) async {
    guard let endpoint = endpoint(), let pair = normalized(code) else {
      status = "コードかAPIが不正"
      return
    }
    var body = payload
    body["code"] = pair
    var request = URLRequest(url: endpoint)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try? JSONSerialization.data(withJSONObject: body)
    do {
      let (data, response) = try await URLSession.shared.data(for: request)
      guard let http = response as? HTTPURLResponse, http.statusCode == 200,
            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
        status = "届かない"
        return
      }
      status = (json["mode"] as? String) == "cue" ? "指示" : "待機"
    } catch {
      status = "届かない"
    }
  }

  private func endpoint() -> URL? {
    let trimmed = api.trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    guard let base = URL(string: trimmed) else { return nil }
    return URL(string: "/api/glasses/session", relativeTo: base)?.absoluteURL
  }

  private func normalized(_ value: String) -> String? {
    let code = value.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
    guard code.count == 4, code.allSatisfy({ character in
      let letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
      return letters.contains(character)
    }) else { return nil }
    return code
  }
}
