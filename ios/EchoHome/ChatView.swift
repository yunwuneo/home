import SwiftUI

struct ChatView: View {
  @Environment(AppModel.self) private var model
  @State private var search = ""
  @FocusState private var inputFocused: Bool
  var messages: [Message] {
    (model.state?.messages ?? []).filter {
      search.isEmpty || $0.content.localizedCaseInsensitiveContains(search)
    }
  }
  var body: some View {
    @Bindable var model = model
    VStack(spacing: 0) {
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
                || model.draft.count > 1500 || model.sending || model.busy || !model.online)
          }
          if model.draft.count > 1400 {
            Text("\(model.draft.count) / 1500 字").font(.caption).foregroundStyle(
              model.draft.count > 1500 ? .red : .secondary)
          }
        }.padding(.horizontal, 16).padding(.vertical, 10).background(.ultraThinMaterial)
      }
    }.toolbar {
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
      }.padding(16).background(
        message.role == "user" ? Color.pine.opacity(0.12) : .white.opacity(0.8),
        in: RoundedRectangle(cornerRadius: 21)
      )
      .contextMenu {
        Button("引用回复", systemImage: "arrowshape.turn.up.left") { model.quote = message }
        Button("记入手记", systemImage: "bookmark") {
          Task { await model.act("/memory", ["operation": "save-message", "id": message.id]) }
        }
      }
      if message.role != "user" { Spacer(minLength: 28) }
    }
  }
}
