import Foundation

struct ChatTopic: Codable, Identifiable, Sendable {
  var id: String
  var title: String
  var model: ModelReference?
  var mcpIds: [String]?
}
struct ModelReference: Codable, Hashable, Sendable {
  var providerId: String
  var model: String
}
struct ChatProvider: Codable, Identifiable, Sendable {
  var id = UUID().uuidString
  var name = "新服务商"
  var baseUrl = ""
  var apiKey: String?
  var hasKey: Bool?
  var models: [String] = []
  var favorites: [String] = []
}
struct ChatInstruction: Codable, Identifiable, Sendable {
  var id = UUID().uuidString
  var title = "新的指令"
  var prompt = ""
  var enabled = true
  var topicId: String?
}
struct ChatMCP: Codable, Identifiable, Sendable {
  var id = UUID().uuidString
  var name = "新工具服务"
  var transport = "http"
  var url: String? = ""
  var command: String?
  var args: [String]?
  var enabled = false
  var headers: [String: String]?
}
struct ChatConfiguration: Codable, Sendable {
  var providers: [ChatProvider] = []
  var roles: [String: ModelReference] = [:]
  var autoMemory = true
  var instructions: [ChatInstruction] = []
  var mcp: [ChatMCP] = []
  func body() throws -> [String: Any] {
    try JSONSerialization.jsonObject(with: JSONEncoder().encode(self)) as! [String: Any]
  }
}
struct ChatAttachment: Codable, Identifiable, Sendable {
  var id: String
  var name: String
  var mime: String
  var size: Int
}
struct RecalledMemory: Codable, Identifiable, Sendable {
  var id: String
  var text: String
  var score: Double?
  var method: String?
  var sourceMessageIds: [String]?
}
struct ToolTrace: Codable, Sendable {
  var server: String
  var name: String
  var result: String
}
