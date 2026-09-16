import SwiftUI

struct SettingsView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  @State private var address = ""
  @State private var code = ""
  @State private var playerName = ""
  @State private var baseURL = ""
  @State private var modelName = ""
  @State private var key = ""
  @State private var streaming = true
  @State private var clearKey = false
  @State private var message = ""
  @State private var pairingCode = ""
  var body: some View {
    NavigationStack {
      Form {
        Section {
          HStack(spacing: 14) {
            Image(systemName: "house.and.flag.fill").font(.largeTitle).foregroundStyle(Color.pine)
            VStack(alignment: .leading, spacing: 5) {
              Text("和 Echo 的家").font(.headline)
              Text("让每一台设备，回到同一个家。").font(.caption).foregroundStyle(.secondary)
            }
          }.padding(.vertical, 8)
        }
        Section {
          TextField("http://电脑IP:5173", text: $address).keyboardType(.URL)
            .textInputAutocapitalization(.never).autocorrectionDisabled().accessibilityIdentifier(
              "serverAddress")
          TextField("六位配对码（本机模拟器可留空）", text: $code).keyboardType(.numberPad)
            .accessibilityIdentifier("pairCode")
          Button(model.busy ? "正在连接…" : "连接并同步") {
            Task {
              if await model.connect(address, code: code) {
                populate()
                message = "连接成功，数据已同步"
                code = ""
              }
            }
          }.accessibilityIdentifier("connectServer")
          LabeledContent(
            "状态", value: model.online ? "已连接服务端" : (model.needsPairing ? "需要配对" : "未连接"))
          if let date = model.lastSync { LabeledContent("最近同步") { Text(date, style: .time) } }
        } header: {
          Text("你的服务端")
        } footer: {
          Text("模拟器可用 http://127.0.0.1:5173；真机填写电脑局域网地址。在电脑网页的设置中生成配对码，十分钟内使用。服务端需要持续运行。")
        }
        if let settings = model.settings {
          Section("怎么称呼你") {
            TextField("你的称呼", text: $playerName).accessibilityIdentifier("playerName")
          }
          Section {
            TextField("API Base URL", text: $baseURL).keyboardType(.URL)
              .textInputAutocapitalization(.never).autocorrectionDisabled()
            TextField("模型名称", text: $modelName).textInputAutocapitalization(.never)
              .autocorrectionDisabled()
            SecureField(settings.hasKey ? "已有密钥 · 留空保留" : "API Key（可选）", text: $key)
              .textInputAutocapitalization(.never).autocorrectionDisabled()
            Toggle("逐段接收回复", isOn: $streaming)
            if settings.hasKey { Toggle("清除服务端密钥", isOn: $clearKey) }
            Button("保存设置") { save(test: false) }.accessibilityIdentifier("saveSettings")
            Button("保存并测试模型") { save(test: true) }.disabled(baseURL.isEmpty || modelName.isEmpty)
          } header: {
            Text("Echo 的对话")
          } footer: {
            Text("未配置时使用服务端的规则回复。密钥保存在服务端；更换 API 地址后需重新填写。连接测试会请求你的模型服务，可能产生费用。")
          }
          if settings.canPair {
            Section("连接其他设备") {
              Button("生成配对码") {
                Task {
                  do {
                    let result: Pairing = try await model.api.load("/pairing", body: [:])
                    pairingCode = result.code
                  } catch { model.handle(error) }
                }
              }
              if !pairingCode.isEmpty {
                Text(pairingCode).font(.largeTitle.monospaced()).textSelection(.enabled)
                Text("十分钟有效 · 仅可使用一次").font(.caption)
              }
            }
          } else {
            Section {
              Button("断开此设备", role: .destructive) {
                Task {
                  await model.logout()
                  dismiss()
                }
              }
            }
          }
        }
        if let error = model.error { Section { Text(error).foregroundStyle(.red).font(.footnote) } }
        if !message.isEmpty {
          Section {
            Label(message, systemImage: "checkmark.circle.fill").foregroundStyle(Color.pine)
              .accessibilityIdentifier("settingsResult")
          }
        }
        Section {
          Text("SwiftUI 原生界面 · Liquid Glass\n世界、对话、记忆和游戏均由服务端同步。").font(.caption).foregroundStyle(
            .secondary)
        }
      }.navigationTitle("家的设置").navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { dismiss() } } }
        .disabled(model.busy || model.sending)
        .task {
          address = model.address
          if model.online {
            await model.loadSettings()
            populate()
          }
        }
    }
  }
  func populate() {
    guard let settings = model.settings else { return }
    playerName = settings.playerName
    baseURL = settings.baseUrl
    modelName = settings.model
    streaming = settings.streaming ?? true
  }
  func save(test: Bool) {
    guard !playerName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
      playerName.count <= 24
    else {
      model.error = "称呼需要 1 到 24 个字。"
      return
    }
    Task {
      if await model.saveSettings(
        [
          "playerName": playerName, "baseUrl": baseURL, "model": modelName, "apiKey": key,
          "streaming": streaming, "clearKey": clearKey,
        ], test: test)
      {
        key = ""
        clearKey = false
        message = test ? "已保存，模型连接成功" : "设置已保存到服务端"
      }
    }
  }
  struct Pairing: Decodable { let code: String }
}
