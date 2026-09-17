import Foundation

struct APIError: LocalizedError {
  let message: String
  let status: Int
  var errorDescription: String? { message }
}
@MainActor final class APIClient {
  var baseURL: URL
  let session: URLSession
  init(address: String) {
    baseURL = URL(string: address) ?? URL(string: "http://127.0.0.1:5173")!
    let config = URLSessionConfiguration.default
    config.timeoutIntervalForRequest = 240
    config.requestCachePolicy = .reloadIgnoringLocalCacheData
    config.httpCookieStorage = .shared
    session = URLSession(configuration: config)
  }
  static func validated(_ address: String) throws -> URL {
    guard let url = URL(string: address.trimmingCharacters(in: .whitespacesAndNewlines)),
      let scheme = url.scheme, ["http", "https"].contains(scheme), let host = url.host,
      !host.isEmpty,
      url.user == nil, url.password == nil, url.query == nil, url.fragment == nil,
      url.path.isEmpty || url.path == "/"
    else {
      throw APIError(message: "请输入服务端地址，例如 http://192.168.1.2:5173（不含 /api）。", status: 0)
    }
    return url
  }
  func request(_ path: String, body: [String: Any]? = nil) throws -> URLRequest {
    var req = URLRequest(url: baseURL.appendingPathComponent("api" + path))
    if let body {
      req.httpMethod = "POST"
      req.setValue("application/json", forHTTPHeaderField: "Content-Type")
      req.httpBody = try JSONSerialization.data(withJSONObject: body)
    }
    return req
  }
  func load<T: Decodable>(_ path: String, body: [String: Any]? = nil) async throws -> T {
    let (data, response) = try await session.data(for: request(path, body: body))
    try check(response, data: data)
    return try JSONDecoder().decode(T.self, from: data)
  }
  func check(_ response: URLResponse, data: Data) throws {
    guard let http = response as? HTTPURLResponse else {
      throw APIError(message: "服务端没有返回有效响应。", status: 0)
    }
    guard (200..<300).contains(http.statusCode) else {
      let error = try? JSONDecoder().decode(ErrorBody.self, from: data)
      throw APIError(message: error?.error ?? "服务暂不可用（\(http.statusCode)）", status: http.statusCode)
    }
  }
  func chat(_ body: [String: Any], delta: (String) -> Void) async throws -> WorldState {
    let (bytes, response) = try await session.bytes(for: request("/chat", body: body))
    if (response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Type")?.contains("ndjson")
      != true
    {
      var data = Data()
      for try await byte in bytes { data.append(byte) }
      try check(response, data: data)
      return try JSONDecoder().decode(WorldState.self, from: data)
    }
    try check(response, data: Data())
    var final: WorldState?
    for try await line in bytes.lines where !line.isEmpty {
      let event = try JSONDecoder().decode(ChatEvent.self, from: Data(line.utf8))
      if event.type == "error" { throw APIError(message: event.error ?? "回复中断，请重试。", status: 502) }
      if let text = event.text, event.type == "delta" { delta(text) }
      if event.type == "done" { final = event.state }
    }
    guard let final else { throw APIError(message: "回复未完整接收，重试会避免重复发送。", status: 0) }
    return final
  }
  private struct ErrorBody: Decodable { let error: String }
  private struct ChatEvent: Decodable {
    let type: String
    let text: String?
    let error: String?
    let state: WorldState?
  }
}
