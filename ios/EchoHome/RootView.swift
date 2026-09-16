import SwiftUI

struct RootView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.scenePhase) private var phase
  @State private var showSettings = false
  var body: some View {
    @Bindable var model = model
    TabView(selection: $model.selectedTab) {
      Tab("小家", systemImage: "house", value: 0) { page("和 Echo 的家") { HomeView() } }
      Tab("聊天", systemImage: "bubble.left.and.bubble.right", value: 1) {
        page("慢慢聊") { ChatView() }
      }
      Tab("一起玩", systemImage: "suit.heart", value: 2) { page("把时间交给彼此") { TogetherView() } }
      Tab("回忆", systemImage: "book.closed", value: 3) { page("我们的手记") { MemoriesView() } }
    }
    .sheet(isPresented: $showSettings) { SettingsView() }
    .alert(
      "暂时没有完成",
      isPresented: Binding(get: { model.error != nil }, set: { if !$0 { model.error = nil } })
    ) {
      Button("知道了", role: .cancel) { model.error = nil }
    } message: {
      Text(model.error ?? "")
    }
    .task(id: phase) { if phase == .active { await model.poll() } }
  }
  func page<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
    NavigationStack {
      ZStack {
        PaperBackground()
        content()
      }
      .navigationTitle(title).navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .topBarLeading) {
          HStack(spacing: 5) {
            Circle().fill(model.online ? Color.pine : Color.orange).frame(width: 6, height: 6)
            Text(model.online ? "已同步" : "未连接").font(.caption2).fixedSize()
          }.accessibilityIdentifier("syncStatus")
        }
        ToolbarItem(placement: .topBarTrailing) {
          Button("设置", systemImage: "slider.horizontal.3") { showSettings = true }
            .accessibilityIdentifier("settings")
        }
      }
      .safeAreaInset(edge: .top) {
        if !model.online {
          Button {
            showSettings = true
          } label: {
            Label(
              model.needsPairing ? "这台设备需要配对 · 点击输入配对码" : "连接你的家 · 点击设置服务端地址",
              systemImage: "wifi.exclamationmark"
            )
            .font(.caption).frame(maxWidth: .infinity).padding(10).background(.thinMaterial)
          }.buttonStyle(.plain)
        }
      }
    }
  }
}
