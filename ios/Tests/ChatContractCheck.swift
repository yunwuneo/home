import Foundation

@main struct ChatContractCheck {
  @MainActor static func main() async throws {
    let api = APIClient(address: "http://127.0.0.1:5187")
    let config: ChatConfiguration = try await api.load("/chat/config")
    precondition(config.providers.first?.hasKey == true)
    precondition(config.providers.first?.apiKey == nil)
    precondition(config.roles["embedding"]?.model == "text-embedding-3-small")
    var state: WorldState = try await api.load("/chat/topics", body: ["operation":"create","title":"原生文件链路验收"])
    let topic = state.topics!.first!.id
    var attachments: [ChatAttachment] = []
    for (path,mime) in [("tests/fixtures/reading.pdf","application/pdf"),("tests/fixtures/reading.docx","application/vnd.openxmlformats-officedocument.wordprocessingml.document"),("artifacts/chat/red-card.png","image/png")] {
      let url = URL(fileURLWithPath:FileManager.default.currentDirectoryPath).appendingPathComponent(path)
      let bytes = try Data(contentsOf:url)
      let attachment:ChatAttachment = try await api.load("/chat/upload",body:["name":url.lastPathComponent,"mime":mime,"data":bytes.base64EncodedString()])
      precondition(attachment.size == bytes.count)
      let (download,response) = try await api.session.data(for:api.request("/chat/files/"+attachment.id))
      try api.check(response,data:download);precondition(download == bytes)
      attachments.append(attachment)
    }
    let id = UUID().uuidString
    let body:[String:Any] = ["text":"请读取附件：PDF 和 DOCX 各自的编号是什么？图片主要是什么颜色？","topicId":topic,"requestId":id,"attachmentIds":attachments.map(\.id),"stream":true]
    var streamed = ""
    state = try await api.chat(body) {streamed += $0}
    let reply = state.messages.last!.content
    precondition(reply.contains("4832") && reply.contains("2816") && reply.contains("红"))
    precondition(streamed == reply)
    precondition(state.messages[state.messages.count-2].attachments?.count == 3)
    let retried:WorldState = try await api.chat(body) {_ in}
    precondition(retried.messages.count == state.messages.count)
    print("Native chat contract passed: encrypted config, model roles, three uploads, byte-identical downloads, real streaming LLM/vision, retry deduplication")
    print(reply)
  }
}
