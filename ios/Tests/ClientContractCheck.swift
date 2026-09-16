import Foundation

// Compile with the production Models.swift and APIClient.swift. Uses a disposable server on :5189.
@main struct ClientContractCheck {
  @MainActor static func main() async throws {
    let api = APIClient(address: "http://127.0.0.1:5189")
    var checks = 0
    func check(_ condition: Bool, _ name: String) throws {
      guard condition else { throw APIError(message: "FAILED: " + name, status: 0) }
      checks += 1
      print("PASS \(checks): \(name)")
    }
    var s: WorldState = try await api.load("/control", body: ["speed": 0])
    try check(s.location == "home", "decode initial world")
    let settings: ServerSettings = try await api.load(
      "/settings", body: ["baseUrl": "", "model": "", "playerName": "Swift 验收"])
    try check(settings.playerName == "Swift 验收", "settings persist through API")
    s = try await api.load("/state")
    try check(
      s.playerName == settings.playerName && s.speed == 0,
      "independent reads see settings and speed")
    for place in Place.all {
      s = try await api.load("/travel", body: ["location": place.id])
      try check(s.location == place.id, "travel \(place.id)")
      for kind in place.activities {
        s = try await api.load("/activity", body: ["kind": kind])
        try check(s.activity?.kind == kind && s.activity?.together == true, "start \(kind)")
        s = try await api.load("/activity/cancel", body: [:])
        try check(s.activity == nil, "cancel \(kind)")
      }
    }
    s = try await api.load("/travel", body: ["location": "home"])
    s = try await api.load("/move", body: ["position": [0.5, 2.8]])
    try check(s.playerPosition == [0.5, 2.8], "server-validated movement")
    var streamed = ""
    let requestID = UUID().uuidString
    s = try await api.chat(["text": "我喜欢茉莉茶", "requestId": requestID, "stream": true]) {
      streamed += $0
    }
    try check(
      !streamed.isEmpty && s.messages.last?.content == streamed,
      "UTF-8 NDJSON stream commits exact final reply")
    let messageCount = s.messages.count
    s = try await api.chat(["text": "我喜欢茉莉茶", "requestId": requestID, "stream": true]) { _ in }
    try check(s.messages.count == messageCount, "chat retry UUID avoids duplicate messages")
    let quote = s.messages.last!.id
    s = try await api.chat([
      "text": "你还记得吗？", "replyToId": quote, "requestId": UUID().uuidString, "stream": true,
    ]) { _ in }
    try check(s.messages[s.messages.count - 2].replyTo?.id == quote, "quoted reply persists")
    s = try await api.load(
      "/memory",
      body: ["operation": "add", "title": "Swift 手记", "text": "来自原生网络层", "kind": "moment"])
    let memory = s.memories.first { $0.title == "Swift 手记" }!
    s = try await api.load(
      "/memory", body: ["operation": "edit", "id": memory.id, "title": "已修改", "text": "服务器的新内容"])
    try check(s.memories.first { $0.id == memory.id }?.text == "服务器的新内容", "edit memory")
    s = try await api.load("/memory", body: ["operation": "pin", "id": memory.id])
    try check(s.memories.first { $0.id == memory.id }?.pinned == true, "pin memory")
    s = try await api.load("/memory", body: ["operation": "forget", "id": memory.id])
    try check(!s.memories.contains { $0.id == memory.id }, "forget memory")
    s = try await api.load("/memory", body: ["operation": "save-message", "id": quote])
    try check(s.memories.contains { $0.title == "想留住的一句话" }, "save chat into journal")
    for kind in ["hand", "hug", "listen", "praise"] {
      s = try await api.load("/interaction", body: ["kind": kind])
      try check(s.companion?.pending?.kind == kind, "interaction \(kind)")
      s = try await api.load(
        "/interaction", body: ["kind": "answer", "choice": s.companion!.pending!.choices[0]])
      try check(s.companion?.pending == nil, "interaction response \(kind)")
    }
    s = try await api.load("/game/start", body: ["kind": "chess"])
    let chess = s.game!
    try check(
      chess.board?.count == 64
        && chess.legal?.contains { $0.from == "e2" && $0.to == "e4" } == true,
      "chess board and legal moves")
    s = try await api.load(
      "/game/action",
      body: [
        "id": chess.id, "revision": chess.revision, "action": "move", "from": "e2", "to": "e4",
      ])
    try check((s.game?.moves?.count ?? 0) >= 2, "server makes Echo's chess response")
    do {
      let _: WorldState = try await api.load(
        "/game/action",
        body: [
          "id": chess.id, "revision": chess.revision, "action": "move", "from": "e2", "to": "e4",
        ])
      throw APIError(message: "stale revision accepted", status: 0)
    } catch let error as APIError { try check(error.status == 409, "stale revision gives 409") }
    s = try await api.load(
      "/game/action", body: ["id": s.game!.id, "revision": s.game!.revision, "action": "resign"])
    try check(s.game?.status == "finished", "chess resignation commits result")
    s = try await api.load("/game/start", body: ["kind": "pairs"])
    try check(
      s.game?.cards?.allSatisfy { $0 == nil } == true,
      "hidden cards remain hidden from native client")
    var known: [Int: Int] = [:]
    var iterations = 0
    while let game = s.game, game.status == "playing", iterations < 300 {
      iterations += 1
      for (i, v) in (game.cards ?? []).enumerated() { if let v { known[i] = v } }
      var body: [String: Any] = ["id": game.id, "revision": game.revision]
      if (game.revealed?.count ?? 0) >= 2 {
        body["action"] = "continue"
      } else {
        let available = (0..<16).filter {
          !(game.matched ?? []).contains($0) && !(game.revealed ?? []).contains($0)
        }
        var choice: Int?
        if let first = game.revealed?.first, let value = known[first] {
          choice = available.first { known[$0] == value }
        } else {
          choice = available.first { a in
            known[a] != nil && available.contains { b in a != b && known[a] == known[b] }
          }
        }
        body["action"] = "flip"
        body["index"] = choice ?? available.first { known[$0] == nil } ?? available[0]
      }
      s = try await api.load("/game/action", body: body)
    }
    try check(
      s.game?.status == "finished" && s.game?.matched?.count == 16,
      "complete all 8 pairs with server scoring")
    s = try await api.load("/game/start", body: ["kind": "drinks"])
    while let game = s.game, game.status == "playing" {
      var body: [String: Any] = [
        "id": game.id, "revision": game.revision, "action": game.served == true ? "next" : "serve",
      ]
      if game.served != true {
        body["recipe"] = ["base": "jasmine", "sweetness": 30, "ice": 30, "strength": 60]
      }
      s = try await api.load("/game/action", body: body)
    }
    if case .drinks(let scores) = s.game?.scores {
      try check(scores.count == 3, "three drink rounds decode and finish with server scores")
    } else {
      throw APIError(message: "Missing drink results", status: 0)
    }
    let again: WorldState = try await api.load("/state")
    try check(
      again.game?.id == s.game?.id && again.game?.status == "finished",
      "fresh client read restores final game")
    try check(
      again.memories.count > 8, "activities, interactions and games remain in server journal")
    print("\(checks) native API contract checks passed")
  }
}
