import Observation
import SwiftUI

@MainActor @Observable final class AppModel {
  var state: WorldState?
  var settings: ServerSettings?
  var error: String?
  var online = false
  var needsPairing = false
  var busy = false
  var sending = false
  var partialReply = ""
  var draft = ""
  var quote: Message?
  var failedChat:
    (text: String, id: String, quoteID: String?, topicID: String, attachments: [String])?
  var topicID = "home"
  var attachments: [ChatAttachment] = []
  private var topicDrafts: [String: String] = [:]
  func switchTopic(_ id: String) {
    guard !sending else { return }
    topicDrafts[topicID] = draft
    draft = topicDrafts[id] ?? ""
    topicID = id
    quote = nil
    attachments = []
    failedChat = nil
  }
  var lastSync: Date?
  var address: String
  var selectedTab = 0
  let api: APIClient
  private var generation = 0
  init() {
    let address =
      ProcessInfo.processInfo.environment["ECHO_SERVER_URL"] ?? UserDefaults.standard.string(
        forKey: "serverAddress") ?? "http://127.0.0.1:5173"
    self.address = address
    api = APIClient(address: address)
    #if DEBUG
      // Enables deterministic simulator screenshots of real server data.
      if let tab = Int(ProcessInfo.processInfo.environment["ECHO_TAB"] ?? ""), (0...3).contains(tab)
      {
        selectedTab = tab
      }
    #endif
  }
  func handle(_ failure: Error, visible: Bool = true) {
    guard !(failure is CancellationError), (failure as? URLError)?.code != .cancelled else {
      return
    }
    if let failure = failure as? APIError {
      if failure.status == 401 {
        needsPairing = true
        online = false
        state = nil
      }
    } else if failure is URLError {
      online = false
    }
    if visible { error = failure.localizedDescription }
  }
  func refresh() async {
    guard !busy, !sending else { return }
    let version = generation
    do {
      let latest: WorldState = try await api.load("/state")
      guard version == generation, !busy, !sending else { return }
      state = latest
      online = true
      needsPairing = false
      lastSync = Date()
    } catch {
      guard version == generation else { return }
      online = false
      handle(error, visible: false)
    }
  }
  func poll() async {
    while !Task.isCancelled {
      await refresh()
      do { try await Task.sleep(for: .seconds(2)) } catch { return }
    }
  }
  @discardableResult func act(_ path: String, _ body: [String: Any] = [:]) async -> Bool {
    guard !busy, !sending else { return false }
    busy = true
    generation += 1
    defer { busy = false }
    do {
      state = try await api.load(path, body: body)
      online = true
      lastSync = Date()
      return true
    } catch {
      handle(error)
      if (error as? APIError)?.status == 409 {
        if let latest: WorldState = try? await api.load("/state") { state = latest }
      }
      return false
    }
  }
  func gameAction(_ action: String, _ extra: [String: Any] = [:]) async {
    guard let game = state?.game else { return }
    var body = extra
    body["action"] = action
    body["id"] = game.id
    body["revision"] = game.revision
    await act("/game/action", body)
  }
  func send(retry: Bool = false) async {
    guard !sending, !busy else { return }
    let pending =
      retry
      ? failedChat
      : (
        draft.trimmingCharacters(in: .whitespacesAndNewlines), UUID().uuidString, quote?.id,
        topicID, attachments.map(\.id)
      )
    guard let pending, !pending.0.isEmpty, pending.0.count <= 1500 else { return }
    sending = true
    generation += 1
    partialReply = ""
    failedChat = pending
    defer { sending = false }
    var body: [String: Any] = [
      "text": pending.0, "requestId": pending.1, "stream": true, "topicId": pending.3,
      "attachmentIds": pending.4,
    ]
    if let quoteID = pending.2 { body["replyToId"] = quoteID }
    do {
      state = try await api.chat(body) { self.partialReply += $0 }
      if draft.trimmingCharacters(in: .whitespacesAndNewlines) == pending.0 { draft = "" }
      quote = nil
      failedChat = nil
      attachments = []
      partialReply = ""
      online = true
      lastSync = Date()
    } catch {
      partialReply = ""
      handle(error)
    }
  }
  func connect(_ newAddress: String, code: String = "") async -> Bool {
    guard !busy, !sending else { return false }
    busy = true
    generation += 1
    defer { busy = false }
    do {
      let url = try APIClient.validated(newAddress)
      if api.baseURL != url {
        state = nil
        settings = nil
        quote = nil
        failedChat = nil
        needsPairing = false
        online = false
      }
      api.baseURL = url
      address = url.absoluteString
      UserDefaults.standard.set(address, forKey: "serverAddress")
      if !code.isEmpty { let _: OK = try await api.load("/session", body: ["code": code]) }
      state = try await api.load("/state")
      settings = try await api.load("/settings")
      needsPairing = false
      online = true
      lastSync = Date()
      return true
    } catch {
      handle(error)
      return false
    }
  }
  func loadSettings() async {
    do { settings = try await api.load("/settings") } catch { handle(error) }
  }
  func saveSettings(_ body: [String: Any], test: Bool) async -> Bool {
    guard !busy, !sending else { return false }
    busy = true
    generation += 1
    defer { busy = false }
    do {
      settings = try await api.load("/settings", body: body)
      state = try await api.load("/state")
      if test { let _: OK = try await api.load("/settings/test", body: [:]) }
      return true
    } catch {
      handle(error)
      return false
    }
  }
  func logout() async {
    do {
      let _: OK = try await api.load("/session/logout", body: [:])
      HTTPCookieStorage.shared.cookies(for: api.baseURL)?.forEach {
        HTTPCookieStorage.shared.deleteCookie($0)
      }
      state = nil
      settings = nil
      online = false
      needsPairing = true
    } catch { handle(error) }
  }
  struct OK: Decodable { let ok: Bool }
}
