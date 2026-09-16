import Foundation

struct WorldState: Decodable, Sendable {
  var location: String
  var day: Int
  var minute: Double
  var speed: Int
  var playerName: String
  var echoPosition: [Double]
  var playerPosition: [Double]
  var activity: Activity?
  var hunger: Double
  var energy: Double
  var meals: Int
  var mood: String
  var relationship: String
  var messages: [Message]
  var memories: [Memory]
  var preferences: [String]
  var configured: Bool
  var completed: [String]
  var chatBusy: Bool?
  var game: Game?
  var companion: Companion?
  var clock: String { String(format: "%02d:%02d", Int(minute) / 60, Int(minute) % 60) }
}
struct Activity: Decodable, Sendable {
  let kind: String
  let together: Bool
  let progress: Double
  let duration: Double
  let stage: String
}
struct Message: Decodable, Identifiable, Sendable {
  let id: String
  let role: String
  let content: String
  let source: String
  let day: Int
  let minute: Double
  let replyTo: Quote?
  struct Quote: Decodable, Sendable {
    let id: String
    let content: String
    let role: String
  }
}
struct Memory: Decodable, Identifiable, Sendable {
  let id: String
  let day: Int
  let minute: Double
  let title: String
  let text: String
  let kind: String
  let pinned: Bool?
}
struct Companion: Decodable, Sendable {
  let pending: Pending?
  let lastLine: String?
  struct Pending: Decodable, Sendable {
    let kind: String
    let label: String
    let line: String
    let choices: [String]
  }
}
struct Game: Decodable, Identifiable, Sendable {
  let id: String
  let kind: String
  let status: String
  let revision: Int
  let line: String
  let result: String?
  let board: [Piece?]?
  let legal: [Move]?
  let moves: [String]?
  let check: Bool?
  let cards: [Int?]?
  let matched: [Int]?
  let revealed: [Int]?
  let turn: String?
  let scores: GameScores?
  let round: Int?
  let attempts: Int?
  let best: Int?
  let served: Bool?
  let order: Order?
  let feedback: Feedback?
  struct Piece: Decodable, Sendable {
    let square: String
    let color: String
    let type: String
  }
  struct Move: Decodable, Sendable {
    let from: String
    let to: String
    let promotion: String?
  }
  struct Order: Decodable, Sendable {
    let name: String
    let wish: String
  }
  struct Feedback: Decodable, Sendable {
    let score: Int
    let tips: [String]
  }
  enum GameScores: Decodable, Sendable {
    case pairs(Int, Int)
    case drinks([Int])
    init(from decoder: Decoder) throws {
      let c = try decoder.singleValueContainer()
      if let values = try? c.decode([Int].self) {
        self = .drinks(values)
      } else {
        let values = try c.decode([String: Int].self)
        self = .pairs(values["player"] ?? 0, values["echo"] ?? 0)
      }
    }
  }
}
struct ServerSettings: Codable, Sendable {
  var baseUrl: String
  var model: String
  var hasKey: Bool
  var playerName: String
  var configured: Bool
  var streaming: Bool?
  var canPair: Bool
}
struct Place: Identifiable {
  let id: String
  let name: String
  let subtitle: String
  let symbol: String
  let activities: [String]
  static let all: [Place] = [
    .init(
      id: "home", name: "我们的小家", subtitle: "柴米油盐，也有你", symbol: "house",
      activities: ["cook", "eat", "tv", "rest", "tea", "water", "read", "wash"]),
    .init(id: "market", name: "青禾超市", subtitle: "挑选晚餐食材", symbol: "basket", activities: ["shop"]),
    .init(id: "cinema", name: "星光电影院", subtitle: "并肩看一场电影", symbol: "film", activities: ["movie"]),
    .init(
      id: "office", name: "晴川公司", subtitle: "一起专注，一起下班", symbol: "desktopcomputer",
      activities: ["work"]),
    .init(
      id: "cafe", name: "转角咖啡馆", subtitle: "留一点时间给彼此", symbol: "cup.and.saucer",
      activities: ["coffee"]),
    .init(id: "park", name: "河畔公园", subtitle: "吹吹风，慢慢走", symbol: "tree", activities: ["stroll"]),
  ]
  static func find(_ id: String) -> Place { all.first { $0.id == id } ?? all[0] }
}
let activityNames = [
  "cook": "一起做饭", "eat": "一起吃饭", "tv": "一起看电视", "rest": "休息一会儿", "tea": "泡一壶茶", "water": "照顾绿植",
  "read": "一起读书", "wash": "整理洗漱台", "shop": "一起买菜", "movie": "一起看电影", "work": "一起专注",
  "coffee": "喝杯咖啡", "stroll": "河畔散步",
]
let activitySymbols = [
  "cook": "frying.pan", "eat": "fork.knife", "tv": "tv", "rest": "bed.double",
  "tea": "cup.and.saucer", "water": "leaf", "read": "book", "wash": "drop", "shop": "basket",
  "movie": "film", "work": "desktopcomputer", "coffee": "cup.and.saucer", "stroll": "figure.walk",
]
let memoryKinds = [
  "moment": "共同瞬间", "preference": "喜好", "profile": "生活信息", "boundary": "边界", "promise": "约定",
]
