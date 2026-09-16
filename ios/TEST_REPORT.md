# iOS 原生客户端验收

日期：2026-09-17。Xcode 27.0 beta 6（27A5252f），iOS 27.0 Simulator。App 最低支持 iOS 26。

## 实现与数据来源

- SwiftUI 原生页面、SceneKit 原生三维场景、系统 Liquid Glass 标签栏/工具栏/按钮；无 WebView 或 H5 容器。
- URLSession 调用仓库现有 Node/SQLite 服务端；活动推进、游戏规则、成绩和持久化由服务端负责。
- 前台每两秒同步；操作后采用服务端返回状态；后台停止轮询。聊天支持 NDJSON 流、引用及相同 UUID 重试去重。
- 交付包括 Xcode 工程、XcodeGen 配置、原生源代码、App 图标、UI 测试与 Swift 网络契约测试。

## 验证结果

| 验证层 | 结果 | 覆盖内容 |
| --- | --- | --- |
| Xcode 编译 | 通过 | arm64 与 x86_64 模拟器构建 |
| 服务端回归 | 20/20 通过 | 活动/出行/存档、认证配对、流式聊天、记忆、游戏规则与结算 |
| 原生 Swift 网络契约 | 60/60 通过 | 同一生产 APIClient 的真实 HTTP 请求和解码；六地点、13 活动、移动、聊天 UTF-8 流/引用/去重、记忆增改置顶遗忘、四种互动、棋步与 409、完整八对翻牌、三轮调饮、再次读取恢复游戏 |
| iPhone UI 主流程 | 通过，0 失败 | 咖啡馆出行、活动开始/取消、聊天发送、手记新增、互动回应、棋局落子并等待服务端返回棋谱/认输、翻牌、调饮反馈、终止 App 后恢复同一局 |
| iPhone UI 同步与设置 | 通过，0 失败 | App 保存称呼后由独立 HTTP 读取验证；另一客户端写入回忆后自动显示；横屏检查 |
| Xcode GUI 调试 | 已完成 | 通过电脑工具打开工程、执行 Run；Xcode 成功附加 iPad 模拟器，检查原生页面与三维场景 |

已完成的 App 运行/操作中未观察到 App 闪退。机器高负载及 beta XCTest 初始化曾导致测试 runner 超时；释放多余模拟器后，UI 测试已成功完成。测试 runner 的启动失败不作为 App 功能通过依据，保留了原始日志。

## 证据

- [最终构建日志](../artifacts/ios/build-final.log)
- [服务端测试日志](../artifacts/ios/server-tests.log)
- [Swift 网络契约日志](../artifacts/ios/native-api-tests.log)
- [主流程 UI 日志](../artifacts/ios/final-flows.log) / [Xcode 结果](../artifacts/ios/Final-flows.xcresult)
- [跨端同步 UI 日志](../artifacts/ios/sync-ui-tests.log) / [Xcode 结果](../artifacts/ios/Sync-acceptance.xcresult)
- [服务端存档核对](../artifacts/ios/verified-server-state.json)：确认聊天和新增手记存在、调饮进度及试味分数来自服务端。

## 实际模拟器截图

| 页面 | 截图 |
| --- | --- |
| 小家与原生三维场景 | [小家](../artifacts/ios/01-home.png) |
| 外出活动 | [咖啡馆](../artifacts/ios/02-cafe-activity.png) |
| 聊天 | [聊天记录](../artifacts/ios/03-chat.png) |
| 回忆 | [手记](../artifacts/ios/04-memories.png) |
| 国际象棋 | [棋桌](../artifacts/ios/05-chess.png) |
| 翻牌 | [翻牌](../artifacts/ios/06-pairs.png) |
| 调饮 | [调饮与评分](../artifacts/ios/07-drinks.png) |
| 重新启动 | [恢复同一局](../artifacts/ios/08-restored-game.png) |
| 设置 | [保存到服务端](../artifacts/ios/09-settings.png) |
| 外部写入自动刷新 | [跨端同步](../artifacts/ios/10-external-sync.png) |
| 横屏 | [横屏回忆](../artifacts/ios/11-landscape.png) |
| iPad | [Xcode 调试画面](../artifacts/ios/ipad-debug.png) |

## 验证范围

API/UI 写入验收使用 `/tmp/echo-ios-acceptance` 和 `/tmp/echo-native-contract` 独立 SQLite 数据目录。没有通过拦截请求提供假数据。聊天验收使用服务端规则回复；真实模型调用需用户在设置中提供地址、模型和密钥。服务端兼容模型协议由现有测试中的测试服务验证。

尚未进行真机签名安装、App Store 上架或真实模型供应商验收；iOS 26 的实际运行时未安装，本次运行验证使用 iOS 27。三维布景为原生重建，未逐帧复制 Web 端全部人物动作。

运行与复测步骤见 [README](README.md)。
