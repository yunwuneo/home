import AVFoundation
import PhotosUI
import Speech
import SwiftUI
import UniformTypeIdentifiers

struct ChatSettingsView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  @State private var config = ChatConfiguration()
  @State private var section = "模型"
  @State private var working = false
  @State private var status = ""
  @State private var query = ""
  @State private var results: [RecalledMemory] = []
  @State private var topicTitle = ""
  let sections = ["模型", "记忆", "指令", "MCP", "话题", "语音"]
  var body: some View {
    NavigationStack {
      VStack(spacing: 0) {
        ScrollView(.horizontal, showsIndicators: false) {
          HStack {
            ForEach(sections, id: \.self) { item in
              Button(item) { section = item }.buttonStyle(.bordered)
                .tint(section == item ? Color.pine : .secondary).accessibilityIdentifier(
                  "chatSection-" + item)
            }
          }.padding(.horizontal)
        }
        Form {
          if section == "模型" { providerSections }
          if section == "记忆" { memorySections }
          if section == "指令" { instructionSections }
          if section == "MCP" { mcpSections }
          if section == "话题" { topicSections }
          if section == "语音" { voiceSections }
          if !status.isEmpty {
            Section { Text(status).font(.caption).accessibilityIdentifier("chatSettingsStatus") }
          }
        }.disabled(working)
      }.navigationTitle("聊天设置").navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .cancellationAction) { Button("完成") { dismiss() } }
          ToolbarItem(placement: .confirmationAction) {
            Button("保存") { run { try await save() } }.disabled(working).accessibilityIdentifier(
              "saveChatSettings")
          }
        }.task {
          do {
            config = try await model.api.load("/chat/config")
            topicTitle = model.state?.topics?.first(where: { $0.id == model.topicID })?.title ?? ""
          } catch { status = error.localizedDescription }
        }
    }
  }
  var providerSections: some View {
    Group {
      Section { Text("iOS 和 Web 共用服务端配置。密钥仅在服务端加密保存。").font(.caption).foregroundStyle(.secondary) }
      ForEach($config.providers) { $provider in
        Section(provider.name) {
          TextField("服务商名称", text: $provider.name)
          TextField("API 地址（含 /v1）", text: $provider.baseUrl).textInputAutocapitalization(.never)
            .autocorrectionDisabled()
          SecureField(
            provider.hasKey == true ? "密钥已保存，留空保留" : "API Key",
            text: Binding(get: { provider.apiKey ?? "" }, set: { provider.apiKey = $0 }))
          Button("保存并获取模型") {
            let id = provider.id
            run {
              try await save()
              struct List: Decodable { let models: [String] }
              let list: List = try await model.api.load("/chat/models", body: ["providerId": id])
              if let index = config.providers.firstIndex(where: { $0.id == id }) {
                config.providers[index].models = list.models
              }
              status = "已获取 \(list.models.count) 个模型"
            }
          }
          DisclosureGroup("收藏模型（\(provider.favorites.count)）") {
            ForEach(provider.models, id: \.self) { name in
              Button {
                if provider.favorites.contains(name) {
                  provider.favorites.removeAll { $0 == name }
                } else {
                  provider.favorites.append(name)
                }
              } label: {
                Label(name, systemImage: provider.favorites.contains(name) ? "star.fill" : "star")
              }
            }
          }
          Button("移除服务商", role: .destructive) {
            let id = provider.id
            config.providers.removeAll { $0.id == id }
            config.roles = config.roles.filter { $0.value.providerId != id }
          }
        }
      }
      Section { Button("添加服务商") { config.providers.append(ChatProvider()) } }
      Section("分别选择模型") {
        rolePicker("chat", "对话模型")
        rolePicker("memory", "记忆提取模型")
        rolePicker("embedding", "向量模型")
      }
    }
  }
  func rolePicker(_ role: String, _ title: String) -> some View {
    Picker(
      title,
      selection: Binding<ModelReference?>(
        get: { config.roles[role] }, set: { config.roles[role] = $0 })
    ) {
      Text(role == "memory" ? "沿用对话模型" : "未配置").tag(Optional<ModelReference>.none)
      ForEach(config.providers) { p in
        ForEach(p.models, id: \.self) { name in
          Text("\(p.favorites.contains(name) ? "★ " : "")\(p.name) / \(name)").tag(
            Optional(ModelReference(providerId: p.id, model: name)))
        }
      }
    }
  }
  var memorySections: some View {
    Group {
      Section("让下次对话接得上这一次") {
        Toggle("自动提取并保存", isOn: $config.autoMemory)
        Text("从明确的用户陈述中记住稳定信息。跨话题召回，并在每条回答下显示本次使用的记忆。修改与遗忘可在回忆手记完成。").font(.caption)
        Button("更新全部记忆向量") {
          run {
            try await save()
            struct Result: Decodable { let count: Int }
            let r: Result = try await model.api.load("/chat/memory/reindex", body: [:])
            status = "向量索引已更新：\(r.count) 条"
          }
        }
      }
      Section("试着回忆") {
        TextField("我平时喜欢喝什么？", text: $query).accessibilityIdentifier("memoryRecallQuery")
        Button("检索记忆") {
          run {
            struct Result: Decodable {
              let results: [RecalledMemory]
              let mode: String
            }
            let r: Result = try await model.api.load("/chat/memory/search", body: ["query": query])
            results = r.results
            status = "召回 \(results.count) 条 · \(r.mode)"
          }
        }.disabled(query.isEmpty).accessibilityIdentifier("recallMemory")
        ForEach(results) { item in
          VStack(alignment: .leading, spacing: 5) {
            Text(item.text)
            Text("\(item.method ?? "关键词") · 来源 \(item.sourceMessageIds?.count ?? 0) 条消息").font(
              .caption
            ).foregroundStyle(.secondary)
          }
        }
      }
    }
  }
  var instructionSections: some View {
    Group {
      Section { Text("变量：{{user}}、{{assistant}}、{{date}}、{{topic}}。指令会随设置同步到 Web。").font(.caption) }
      ForEach($config.instructions) { $rule in
        Section(rule.title) {
          TextField("名称", text: $rule.title)
          TextEditor(text: $rule.prompt).frame(minHeight: 100).accessibilityLabel("指令内容")
          Picker(
            "生效范围",
            selection: Binding(
              get: { rule.topicId ?? "" }, set: { rule.topicId = $0.isEmpty ? nil : $0 })
          ) {
            Text("所有话题").tag("")
            ForEach(model.state?.topics ?? []) { t in Text(t.title).tag(t.id) }
          }
          Toggle("启用", isOn: $rule.enabled)
          Button("删除指令", role: .destructive) {
            let id = rule.id
            config.instructions.removeAll { $0.id == id }
          }
        }
      }
      Section { Button("添加指令") { config.instructions.append(ChatInstruction()) } }
    }
  }
  var mcpSections: some View {
    Group {
      Section { Text("工具在服务端统一连接，Echo 可在对话中调用。stdio 配置需在服务器电脑上完成。").font(.caption) }
      ForEach($config.mcp) { $mcp in
        Section(mcp.name) {
          TextField("名称", text: $mcp.name)
          Picker("连接方式", selection: $mcp.transport) {
            Text("HTTP").tag("http")
            Text("SSE").tag("sse")
            Text("stdio").tag("stdio")
          }
          if mcp.transport == "stdio" {
            TextField("启动命令", text: Binding(get: { mcp.command ?? "" }, set: { mcp.command = $0 }))
            TextField(
              "参数（每行一个）",
              text: Binding(
                get: { (mcp.args ?? []).joined(separator: "\n") },
                set: { mcp.args = $0.components(separatedBy: "\n") }), axis: .vertical)
          } else {
            TextField("URL", text: Binding(get: { mcp.url ?? "" }, set: { mcp.url = $0 }))
              .textInputAutocapitalization(.never).autocorrectionDisabled()
          }
          if mcp.transport != "stdio" {
            SecureField(
              "Authorization（留空保留）",
              text: Binding(
                get: { mcp.headers?["Authorization"] ?? "" },
                set: { mcp.headers = $0.isEmpty ? nil : ["Authorization": $0] }))
          }
          Toggle("允许 Echo 使用", isOn: $mcp.enabled)
          Button("保存并测试连接") {
            let id = mcp.id
            run {
              try await save()
              struct Tool: Decodable {
                let name: String
                let description: String
              }
              struct Result: Decodable { let tools: [Tool] }
              let r: Result = try await model.api.load("/chat/mcp/test", body: ["id": id])
              status = "连接成功：" + r.tools.map(\.description).joined(separator: "、")
            }
          }
          Button("移除 MCP", role: .destructive) {
            let id = mcp.id
            config.mcp.removeAll { $0.id == id }
          }
        }
      }
      Section { Button("添加 MCP") { config.mcp.append(ChatMCP()) } }
    }
  }
  var topicSections: some View {
    Group {
      Section("当前话题") {
        TextField("话题名称", text: $topicTitle)
        Button("重命名") {
          Task {
            await model.act(
              "/chat/topics", ["operation": "update", "id": model.topicID, "title": topicTitle])
          }
        }
        Picker(
          "话题模型",
          selection: Binding<ModelReference?>(
            get: { model.state?.topics?.first(where: { $0.id == model.topicID })?.model },
            set: { value in
              Task {
                var body: [String: Any] = ["operation": "update", "id": model.topicID]
                body["model"] =
                  value.map { ["providerId": $0.providerId, "model": $0.model] } ?? NSNull() as Any
                await model.act("/chat/topics", body)
              }
            })
        ) {
          Text("沿用默认模型").tag(Optional<ModelReference>.none)
          ForEach(config.providers) { p in
            ForEach(p.models, id: \.self) { name in
              Text("\(p.name) / \(name)").tag(
                Optional(ModelReference(providerId: p.id, model: name)))
            }
          }
        }
        ForEach(config.mcp) { service in
          Toggle(
            service.name,
            isOn: Binding(
              get: {
                model.state?.topics?.first(where: { $0.id == model.topicID })?.mcpIds?.contains(
                  service.id) ?? true
              },
              set: { enabled in
                var ids =
                  model.state?.topics?.first(where: { $0.id == model.topicID })?.mcpIds
                  ?? config.mcp.map(\.id)
                ids.removeAll { $0 == service.id }
                if enabled { ids.append(service.id) }
                Task {
                  await model.act(
                    "/chat/topics", ["operation": "update", "id": model.topicID, "mcpIds": ids])
                }
              }))
        }
        if model.topicID != "home" {
          Button("删除话题", role: .destructive) {
            Task {
              if await model.act("/chat/topics", ["operation": "delete", "id": model.topicID]) {
                model.switchTopic("home")
                dismiss()
              }
            }
          }
        }
      }
    }
  }
  var voiceSections: some View {
    Section("语音服务") {
      Text("默认使用设备识别与朗读。选择服务商并输入模型名称可启用云端语音；支持情况由服务商决定。").font(.caption)
      ForEach(["asr", "tts"], id: \.self) { key in
        Picker(
          key == "asr" ? "语音识别" : "语音朗读",
          selection: Binding(
            get: { config.roles[key]?.providerId ?? "" },
            set: {
              config.roles[key] =
                $0.isEmpty
                ? nil : ModelReference(providerId: $0, model: config.roles[key]?.model ?? "")
            })
        ) {
          Text("设备语音服务").tag("")
          ForEach(config.providers) { p in Text(p.name).tag(p.id) }
        }
        if config.roles[key] != nil {
          TextField(
            "模型名称",
            text: Binding(
              get: { config.roles[key]?.model ?? "" }, set: { config.roles[key]?.model = $0 })
          ).textInputAutocapitalization(.never)
        }
      }
    }
  }
  func run(_ operation: @escaping @MainActor () async throws -> Void) {
    working = true
    status = "处理中…"
    Task {
      do { try await operation() } catch { status = error.localizedDescription }
      working = false
    }
  }
  func save() async throws {
    config = try await model.api.load("/chat/config", body: config.body())
    status = "已同步到服务端"
  }
}

@MainActor @Observable final class ChatVoice {
  var recording = false
  var transcript = ""
  var error: String?
  private let engine = AVAudioEngine()
  private var task: SFSpeechRecognitionTask?
  private var request: SFSpeechAudioBufferRecognitionRequest?
  private let speaker = AVSpeechSynthesizer()
  private var player: AVAudioPlayer?
  private var recorder: AVAudioRecorder?
  private var tapInstalled = false
  func begin(cloud: Bool) async {
    do {
      guard await AVAudioApplication.requestRecordPermission() else {
        throw APIError(message: "请在系统设置中允许麦克风访问。", status: 0)
      }
      try AVAudioSession.sharedInstance().setCategory(
        .playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetoothHFP])
      try AVAudioSession.sharedInstance().setActive(true)
      transcript = ""
      error = nil
      if cloud {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("echo-voice.m4a")
        recorder = try AVAudioRecorder(
          url: url,
          settings: [
            AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: 44100, AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
          ])
        guard recorder?.record() == true else { throw APIError(message: "录音启动失败。", status: 0) }
      } else {
        let authorization = await withCheckedContinuation { continuation in
          SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0) }
        }
        guard authorization == .authorized,
          let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "zh-CN")),
          recognizer.isAvailable
        else { throw APIError(message: "此设备暂不可用语音识别，请检查权限或配置云端识别。", status: 0) }
        let request = SFSpeechAudioBufferRecognitionRequest()
        self.request = request
        let node = engine.inputNode
        node.installTap(onBus: 0, bufferSize: 1024, format: node.outputFormat(forBus: 0)) {
          buffer, _ in request.append(buffer)
        }
        tapInstalled = true
        task = recognizer.recognitionTask(with: request) { result, error in
          let text = result?.bestTranscription.formattedString
          let failure = error?.localizedDescription
          Task { @MainActor in
            if let text { self.transcript = text }
            if let failure {
              self.error = failure
              self.stop()
            }
          }
        }
        engine.prepare()
        try engine.start()
      }
      recording = true
    } catch {
      self.error = error.localizedDescription
      stop()
    }
  }
  func stop() {
    recorder?.stop()
    engine.stop()
    if tapInstalled {
      engine.inputNode.removeTap(onBus: 0)
      tapInstalled = false
    }
    request?.endAudio()
    recording = false
  }
  func audioData() throws -> Data? {
    guard let url = recorder?.url else { return nil }
    return try Data(contentsOf: url)
  }
  func speak(_ text: String) {
    if speaker.isSpeaking {
      speaker.stopSpeaking(at: .immediate)
      return
    }
    try? AVAudioSession.sharedInstance().setCategory(.playback)
    let utterance = AVSpeechUtterance(string: text)
    utterance.voice = AVSpeechSynthesisVoice(language: "zh-CN")
    speaker.speak(utterance)
  }
  func play(_ data: Data) throws {
    if player?.isPlaying == true {
      player?.stop()
      return
    }
    try AVAudioSession.sharedInstance().setCategory(.playback)
    player = try AVAudioPlayer(data: data)
    player?.play()
  }
  func cancel() {
    stop()
    task?.cancel()
    speaker.stopSpeaking(at: .immediate)
    player?.stop()
  }
}
struct CameraPicker: UIViewControllerRepresentable {
  var picked: (Data) -> Void
  @Environment(\.dismiss) private var dismiss
  func makeCoordinator() -> Coordinator { Coordinator(self) }
  func makeUIViewController(context: Context) -> UIImagePickerController {
    let controller = UIImagePickerController()
    controller.sourceType = .camera
    controller.delegate = context.coordinator
    return controller
  }
  func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}
  final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate
  {
    let parent: CameraPicker
    init(_ parent: CameraPicker) { self.parent = parent }
    func imagePickerController(
      _ picker: UIImagePickerController,
      didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
    ) {
      if let image = info[.originalImage] as? UIImage,
        let data = image.jpegData(compressionQuality: 0.8)
      {
        parent.picked(data)
      }
      parent.dismiss()
    }
    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { parent.dismiss() }
  }
}
