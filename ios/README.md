# 和 Echo 的家 · 原生 iOS

Swift 6 + SwiftUI + SceneKit，最低 iOS 26。没有 WebView、H5 或 JavaScript 运行时。SwiftUI 的系统标签栏、工具栏和自定义 `glassEffect` 控件使用 Liquid Glass。

## 运行

1. 在仓库根目录运行 `pnpm dev`，保持 Node 服务运行。
2. 用 Xcode 26 或更新版本打开 `ios/EchoHome.xcodeproj`，选择 iPhone / iPad 模拟器，运行 EchoHome scheme。
3. 模拟器默认连接 `http://127.0.0.1:5173`。如端口改变，在 App 设置中修改。
4. 真机使用电脑的局域网 IP，在电脑网页设置中生成配对码，再在 App 填写地址和六位码。真机安装需要自己的 Signing Team。

工程文件已提交，日常不需要 XcodeGen。新增文件或修改项目结构后，可运行 `xcodegen generate --spec ios/project.yml` 再生成工程。

## 数据流

`APIClient` 使用 URLSession 访问现有 `/api`，保留 HttpOnly 配对 Cookie。App 不在本地推进世界、判断棋步、翻出隐藏牌、计算调饮成绩或结算关系奖励。

`AppModel` 在前台每两秒拉取一次状态，切入后台停止轮询。操作直接采用服务端返回的完整状态；操作期间隔离旧轮询响应，409 后重新读取游戏进度。离线保留最后一次画面并标识“未连接”，不伪造操作成功。

聊天使用服务端 NDJSON 流，完整 `done` 后提交状态；重试保留同一个请求 UUID，避免重复落档。服务端未配置模型时明确显示“服务端规则回复”。API 密钥只通过服务端设置接口保存，不存入 App 的 UserDefaults。

## 功能

- 原生三维小家和六个地点：旋转缩放视角、点地面移动、服务端人物位置同步。
- 13 种日常/外出活动、加入 Echo、结束活动、暂停/1×/3×、饱腹和精力、餐食库存。
- 流式聊天、引用、搜索、保存消息到手记、失败重试。
- 四种陪伴互动与后续回应。
- 国际象棋（合法落点、升变选择、棋谱、认输）、翻牌（轮次和分数）、三杯调饮（配方、反馈和成绩）。
- 手记搜索、分类、新增、编辑、置顶和遗忘。
- 服务端地址、设备配对、模型配置/测试、称呼、断开设备。

场景是重新制作的原生低多边形布景，不直接复用 Web 端 Three.js 的模型和逐帧动作。当前没有语音或公网账号体系，沿用项目的私人局域网配对协议。

## 验收

服务端回归：`pnpm test`。

使用独立目录启动验收服务端：

```sh
HOST=127.0.0.1 PORT=5187 ECHO_DATA_DIR=/tmp/echo-ios-acceptance node server/index.mjs --production
```

UI 测试通过真实 HTTP 访问此服务端（不会拦截 API），操作会修改这个专用目录的存档。运行前确保没有另一项测试占用同一模拟器。Xcode `Product > Test` 或：

```sh
xcodebuild -project ios/EchoHome.xcodeproj -scheme EchoHome \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' \
  -collect-test-diagnostics never CODE_SIGNING_ALLOWED=NO test
```

`EchoHomeUITests` 通过启动环境 `ECHO_SERVER_URL` 指向验收端口。测试截图作为 XCTAttachment 保留在 xcresult 中。不要用真实用户存档运行写入验收。

Liquid Glass 参考：[Apple glassEffect](https://developer.apple.com/documentation/swiftui/view/glasseffect(_:in:))。

额外的 Swift 网络契约验收直接编译生产版 `APIClient.swift` 和 `Models.swift`，用独立服务端验证 60 个检查点（包括完整翻牌与三杯调饮）：

```sh
HOST=127.0.0.1 PORT=5189 ECHO_DATA_DIR=/tmp/echo-native-contract node server/index.mjs --production
# 在另一个终端：
swiftc -parse-as-library -swift-version 6 \
  ios/EchoHome/Models.swift ios/EchoHome/APIClient.swift \
  ios/Tests/ClientContractCheck.swift -o /tmp/echo-client-check
/tmp/echo-client-check
```

该命令在 macOS 上运行同一 Swift 请求/解码实现，补充验证协议，不替代 iOS 页面操作测试。请为每次契约验收使用新的临时数据目录。
