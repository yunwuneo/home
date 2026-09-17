import PhotosUI
import QuickLook
import SwiftUI
import UniformTypeIdentifiers

struct ChatView: View {
  @Environment(AppModel.self) private var model
  @State private var search = ""
  @State private var showSettings = false
  @State private var newTopic = false
  @State private var topicTitle = ""
  @State private var photo: PhotosPickerItem?
  @State private var showFiles = false
  @State private var showCamera = false
  @State private var uploading = false
  @State private var attachmentStatus = ""
  @State private var previewURL: URL?
  @State private var voice = ChatVoice()
  @State private var cloudRecording = false
  @FocusState private var inputFocused: Bool
  var messages: [Message] {
    (model.state?.messages ?? []).filter {
      ($0.topicId ?? "home") == model.topicID
        && (search.isEmpty || $0.content.localizedCaseInsensitiveContains(search))
    }
  }
  var body: some View {
    @Bindable var model = model
    VStack(spacing: 0) {
      HStack {
        Picker("话题", selection: Binding(get: { model.topicID }, set: { model.switchTopic($0) })) {
          ForEach(model.state?.topics ?? []) { t in Text(t.title).tag(t.id) }
        }.lineLimit(1).fixedSize(horizontal: true, vertical: false).accessibilityIdentifier(
          "chatTopicPicker")
        Spacer()
        Button("新话题", systemImage: "plus.bubble") { newTopic = true }.labelStyle(.iconOnly)
          .accessibilityIdentifier("newChatTopic")
        Button("聊天设置", systemImage: "slider.horizontal.3") { showSettings = true }.labelStyle(
          .iconOnly
        ).accessibilityIdentifier("chatSettings")
      }.padding(.horizontal, 20).padding(.vertical, 8).disabled(model.sending)
      ScrollViewReader { proxy in
        ScrollView {
          LazyVStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 8) {
              Eyebrow(text: "THERE IS ALWAYS TIME FOR YOU")
              Text("今天有什么，想告诉我？").font(.title2.weight(.medium))
              Label(
                model.state?.configured == true ? "模型对话 · 服务端连接" : "本地对话 · 服务端规则回复",
                systemImage: "sparkle"
              ).font(.caption).foregroundStyle(.secondary)
            }.padding(.vertical, 12)
            ForEach(messages) { message in bubble(message) }
            if model.sending {
              HStack {
                ProgressView()
                Text(model.partialReply.isEmpty ? "Echo 正在想怎么回答…" : model.partialReply).font(
                  .subheadline)
              }.paperCard()
            }
            if model.failedChat != nil && !model.sending {
              Button("消息未完成，点击重试", systemImage: "arrow.clockwise") {
                Task { await model.send(retry: true) }
              }.font(.subheadline).buttonStyle(.bordered)
            }
            Color.clear.frame(height: 1).id("bottom")
          }.padding(20).frame(maxWidth: 740).frame(maxWidth: .infinity)
        }.defaultScrollAnchor(.bottom).scrollDismissesKeyboard(.interactively)
          .onChange(of: model.state?.messages.count) { _, _ in
            if search.isEmpty { proxy.scrollTo("bottom", anchor: .bottom) }
          }
          .onChange(of: model.partialReply) { _, _ in proxy.scrollTo("bottom", anchor: .bottom) }
          .searchable(text: $search, prompt: "找一句我们说过的话")
      }
      Group {
        VStack(spacing: 10) {
          HStack(spacing: 18) {
            Button("拍照", systemImage: "camera") {
              #if targetEnvironment(simulator)
                attachmentStatus = "当前设备没有可用相机；可以从照片中选择图片。"
              #else
                if UIImagePickerController.isSourceTypeAvailable(.camera) {
                  showCamera = true
                } else {
                  attachmentStatus = "当前设备没有可用相机；可以从照片中选择图片。"
                }
              #endif
            }.accessibilityIdentifier("chatCamera")
            PhotosPicker(selection: $photo, matching: .images) { Label("照片", systemImage: "photo") }
              .accessibilityIdentifier("chatPhotos")
            Button("文件", systemImage: "paperclip") { showFiles = true }.accessibilityIdentifier(
              "chatFiles")
            Button(
              voice.recording ? "停止" : "语音",
              systemImage: voice.recording ? "stop.circle.fill" : "mic"
            ) { Task { await toggleVoice() } }.accessibilityIdentifier("chatVoice")
            if uploading { ProgressView() }
          }.font(.caption).buttonStyle(.bordered).disabled(model.sending || uploading)
          if !attachmentStatus.isEmpty {
            Text(attachmentStatus).font(.caption).foregroundStyle(.secondary)
          }
          if voice.recording { Text("正在聆听…再次点击停止").font(.caption).foregroundStyle(.secondary) }
          if !model.attachments.isEmpty {
            ScrollView(.horizontal) {
              HStack {
                ForEach(model.attachments) { a in
                  HStack {
                    Text(a.name).lineLimit(1)
                    Button("移除", systemImage: "xmark") {
                      model.attachments.removeAll { $0.id == a.id }
                    }.labelStyle(.iconOnly)
                  }.font(.caption).padding(7).background(.green.opacity(0.08), in: Capsule())
                }
              }
            }
          }
          if let quote = model.quote {
            HStack {
              Text("引用：\(quote.content)").lineLimit(1)
              Spacer()
              Button("取消引用", systemImage: "xmark") { model.quote = nil }.labelStyle(.iconOnly)
            }.font(.caption).padding(.horizontal)
          }
          HStack(alignment: .bottom, spacing: 10) {
            TextField("把今天的小事说给 Echo…", text: $model.draft, axis: .vertical).lineLimit(1...5)
              .padding(13).background(.white.opacity(0.7), in: RoundedRectangle(cornerRadius: 23))
              .focused($inputFocused).accessibilityIdentifier("chatInput")
            Button {
              inputFocused = false
              Task { await model.send() }
            } label: {
              Image(systemName: "arrow.up").font(.headline).frame(width: 42, height: 42)
            }
            .buttonStyle(.glassProminent).accessibilityLabel("发送").accessibilityIdentifier(
              "sendChat"
            )
            .disabled(
              model.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                || model.draft.count > 1500 || model.sending || model.busy || uploading
                || !model.online)
          }
          if model.draft.count > 1400 {
            Text("\(model.draft.count) / 1500 字").font(.caption).foregroundStyle(
              model.draft.count > 1500 ? .red : .secondary)
          }
        }.padding(.horizontal, 16).padding(.vertical, 10).background(.ultraThinMaterial)
      }.zIndex(2)
    }
    .sheet(isPresented: $showSettings) { ChatSettingsView() }
    .sheet(isPresented: $showCamera) {
      CameraPicker { data in Task { await upload(data, name: "照片.jpg", mime: "image/jpeg") } }
    }
    .sheet(isPresented: $newTopic) {
      NavigationStack {
        Form { TextField("话题名称", text: $topicTitle).accessibilityIdentifier("newTopicTitle") }
          .navigationTitle("新话题")
          .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("取消") { newTopic = false } }
            ToolbarItem(placement: .confirmationAction) {
              Button("创建") {
                Task {
                  if await model.act(
                    "/chat/topics",
                    ["operation": "create", "title": topicTitle.isEmpty ? "新的话题" : topicTitle]),
                    let id = model.state?.topics?.first?.id
                  {
                    model.switchTopic(id)
                    topicTitle = ""
                    newTopic = false
                  }
                }
              }.disabled(model.busy || model.sending).accessibilityIdentifier("createTopic")
            }
          }
      }.presentationDetents([.large])
    }
    .fileImporter(
      isPresented: $showFiles,
      allowedContentTypes: [.pdf, .plainText, .image, UTType(filenameExtension: "docx")!],
      allowsMultipleSelection: true
    ) { result in
      Task {
        do {
          for url in try result.get() {
            let access = url.startAccessingSecurityScopedResource()
            defer { if access { url.stopAccessingSecurityScopedResource() } }
            await upload(
              try Data(contentsOf: url), name: url.lastPathComponent,
              mime: UTType(filenameExtension: url.pathExtension)?.preferredMIMEType
                ?? "application/octet-stream")
          }
        } catch { model.error = error.localizedDescription }
      }
    }
    .onChange(of: photo) { _, item in
      Task {
        do {
          if let data = try await item?.loadTransferable(type: Data.self),
            let image = UIImage(data: data), let jpg = image.jpegData(compressionQuality: 0.85)
          {
            await upload(jpg, name: "照片.jpg", mime: "image/jpeg")
          }
        } catch { model.error = error.localizedDescription }
        photo = nil
      }
    }
    .onChange(of: voice.transcript) { _, text in if !text.isEmpty { model.draft = text } }
    .onChange(of: voice.error) { _, error in if let error { model.error = error } }
    .quickLookPreview($previewURL)
    .onDisappear { voice.cancel() }
    .toolbar {
      ToolbarItemGroup(placement: .keyboard) {
        Spacer()
        Button("收起键盘") { inputFocused = false }.accessibilityIdentifier("dismissKeyboard")
      }
    }
  }
  func bubble(_ message: Message) -> some View {
    HStack {
      if message.role == "user" { Spacer(minLength: 40) }
      VStack(alignment: .leading, spacing: 8) {
        HStack {
          Text(message.role == "user" ? model.state?.playerName ?? "你" : "Echo").fontWeight(
            .semibold)
          Spacer()
          Text("第 \(message.day) 天")
        }.font(.caption2).foregroundStyle(.secondary)
        if let quote = message.replyTo {
          Text(quote.content).font(.caption).foregroundStyle(.secondary).padding(8).background(
            .black.opacity(0.04), in: RoundedRectangle(cornerRadius: 8))
        }
        Text(message.content).font(.subheadline).lineSpacing(5).textSelection(.enabled)
        ForEach(message.attachments ?? []) { a in
          Button {
            Task {
              do {
                let (data, response) = try await model.api.session.data(
                  for: model.api.request("/chat/files/" + a.id))
                try model.api.check(response, data: data)
                let directory = FileManager.default.temporaryDirectory.appendingPathComponent(
                  a.id, isDirectory: true)
                try FileManager.default.createDirectory(
                  at: directory, withIntermediateDirectories: true)
                let url = directory.appendingPathComponent((a.name as NSString).lastPathComponent)
                try data.write(to: url)
                previewURL = url
              } catch { model.error = error.localizedDescription }
            }
          } label: {
            Label(a.name, systemImage: a.mime.hasPrefix("image/") ? "photo" : "doc")
          }.font(.caption)

        }
        if let recalled = message.memoryUsed, !recalled.isEmpty {
          DisclosureGroup("使用了 \(recalled.count) 条记忆") {
            ForEach(recalled) { m in
              VStack(alignment: .leading) {
                Text(m.text)
                Text(m.method ?? "关键词").foregroundStyle(.secondary)
                ForEach(m.sourceMessageIds ?? [], id: \.self) { id in
                  if let source = model.state?.messages.first(where: { $0.id == id }) {
                    Text("来源：" + source.content).foregroundStyle(.secondary)
                  }
                }
              }.padding(.vertical, 3)
            }
          }.font(.caption).accessibilityIdentifier("usedMemories")
        }
        if let calls = message.toolTrace, !calls.isEmpty {
          DisclosureGroup("工具调用 \(calls.count) 次") {
            ForEach(Array(calls.enumerated()), id: \.offset) { _, call in
              Text("\(call.server) / \(call.name)\n\(call.result)").textSelection(.enabled)
            }
          }.font(.caption)
        }
        if message.role == "assistant" {
          Button("朗读 / 停止", systemImage: "speaker.wave.2") { Task { await speak(message.content) } }
            .font(.caption).accessibilityIdentifier("speakMessage")
        }

      }.padding(16).background(
        message.role == "user" ? Color.pine.opacity(0.12) : .white.opacity(0.8),
        in: RoundedRectangle(cornerRadius: 21)
      )
      .contextMenu {
        Button("引用回复", systemImage: "arrowshape.turn.up.left") { model.quote = message }
        if message.role == "user" {
          Button("提取记忆", systemImage: "brain") {
            Task { await model.act("/chat/memory/extract", ["messageId": message.id]) }
          }
        }
        Button("记入手记", systemImage: "bookmark") {
          Task { await model.act("/memory", ["operation": "save-message", "id": message.id]) }
        }
      }
      if message.role != "user" { Spacer(minLength: 28) }
    }
  }
  func upload(_ data: Data, name: String, mime: String) async {
    guard data.count <= 10 * 1024 * 1024, model.attachments.count < 6 else {
      model.error = "每次最多 6 个附件，每个小于 10 MB。"
      return
    }
    uploading = true
    defer { uploading = false }
    do {
      let attachment: ChatAttachment = try await model.api.load(
        "/chat/upload", body: ["name": name, "mime": mime, "data": data.base64EncodedString()])
      model.attachments.append(attachment)
    } catch { model.error = error.localizedDescription }
  }
  func toggleVoice() async {
    if voice.recording {
      voice.stop()
      if cloudRecording {
        do {
          if let data = try voice.audioData() {
            struct Result: Decodable { let text: String }
            let result: Result = try await model.api.load(
              "/chat/voice/transcribe",
              body: [
                "data": data.base64EncodedString(), "name": "recording.m4a", "mime": "audio/mp4",
              ])
            model.draft = result.text
          }
        } catch { model.error = error.localizedDescription }
      }
    } else {
      do {
        let config: ChatConfiguration = try await model.api.load("/chat/config")
        cloudRecording = config.roles["asr"] != nil
        await voice.begin(cloud: cloudRecording)
      } catch { model.error = error.localizedDescription }
    }
  }
  func speak(_ text: String) async {
    do {
      let config: ChatConfiguration = try await model.api.load("/chat/config")
      if config.roles["tts"] != nil {
        struct Result: Decodable { let data: String }
        let result: Result = try await model.api.load("/chat/voice/speak", body: ["text": text])
        if let data = Data(base64Encoded: result.data) { try voice.play(data) }
      } else {
        voice.speak(text)
      }
    } catch { model.error = error.localizedDescription }
  }

}
