import XCTest

final class ChatFeaturesUITests: XCTestCase {
  @MainActor func testChatSettingsAndNativeAttachmentSurfaces() async throws {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launchEnvironment["ECHO_SERVER_URL"] = "http://127.0.0.1:5187"
    app.launchEnvironment["ECHO_TAB"] = "1"
    app.launch()
    XCTAssertTrue(app.buttons["chatSettings"].waitForExistence(timeout: 30))
    capture("chat-01-topics-and-composer")
    app.buttons["chatCamera"].tap()
    XCTAssertTrue(app.staticTexts["当前设备没有可用相机；可以从照片中选择图片。"].waitForExistence(timeout: 5))
    capture("chat-03-camera-simulator-limit")
    app.buttons["chatSettings"].tap()
    XCTAssertTrue(app.buttons["chatSection-模型"].waitForExistence(timeout: 10))
    XCTAssertTrue(app.textFields["服务商名称"].waitForExistence(timeout: 10))
    capture("chat-02-model-management")
    for section in ["记忆", "指令", "MCP", "话题", "语音"] {
      let button = app.buttons["chatSection-" + section]
      if !button.isHittable { app.scrollViews.firstMatch.swipeLeft() }
      button.tap()
      capture("chat-settings-" + section)
    }
    app.buttons["完成"].tap()
    app.buttons["chatFiles"].tap()
    XCTAssertTrue(
      app.buttons["取消"].waitForExistence(timeout: 10)
        || app.buttons["Cancel"].waitForExistence(timeout: 3))
    capture("chat-04-native-file-picker")
    if app.buttons["取消"].exists {
      app.buttons["取消"].tap()
    } else if app.buttons["Cancel"].exists {
      app.buttons["Cancel"].tap()
    }
    app.buttons["chatPhotos"].tap()
    XCTAssertTrue(
      app.images.matching(identifier: "PXGGridLayout-Info").firstMatch.waitForExistence(timeout: 15)
    )
    capture("chat-05-native-photo-picker")
  }

  @MainActor func testRealConversationAndRecall() async throws {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launchEnvironment["ECHO_SERVER_URL"] = "http://127.0.0.1:5187"
    app.launchEnvironment["ECHO_TAB"] = "1"
    app.launch()
    XCTAssertTrue(app.buttons["newChatTopic"].waitForExistence(timeout: 30))
    app.buttons["newChatTopic"].tap()
    let title = app.textFields["newTopicTitle"]
    XCTAssertTrue(title.waitForExistence(timeout: 5))
    title.tap()
    title.typeText("iOS acceptance")
    app.buttons["createTopic"].tap()
    XCTAssertTrue(title.waitForNonExistence(timeout: 10))
    let input = app.textFields["chatInput"]
    XCTAssertTrue(input.waitForExistence(timeout: 10))
    input.tap()
    input.typeText("Where do I usually read on Saturday afternoons? Please use my memories.")
    if app.buttons["dismissKeyboard"].exists { app.buttons["dismissKeyboard"].tap() }
    app.buttons["sendChat"].tap()
    XCTAssertTrue(app.buttons["usedMemories"].firstMatch.waitForExistence(timeout: 180))
    capture("chat-06-real-recalled-answer")
    app.buttons["usedMemories"].firstMatch.tap()
    capture("chat-07-memory-provenance")
    let speak = app.buttons["speakMessage"].firstMatch
    if speak.isHittable {
      speak.tap()
      capture("chat-08-device-speech-playback")
    }
  }

  @MainActor func testNativePhotoUploadAndPreview() async throws {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launchEnvironment["ECHO_SERVER_URL"] = "http://127.0.0.1:5187"
    app.launchEnvironment["ECHO_TAB"] = "1"
    app.launch()
    XCTAssertTrue(app.buttons["chatPhotos"].waitForExistence(timeout: 30))
    app.buttons["chatPhotos"].tap()
    let cell = app.images.matching(identifier: "PXGGridLayout-Info").firstMatch
    XCTAssertTrue(cell.waitForExistence(timeout: 15))
    capture("chat-photo-library")
    cell.tap()
    XCTAssertTrue(app.staticTexts["照片.jpg"].firstMatch.waitForExistence(timeout: 30))
    capture("chat-photo-uploaded")
    let input = app.textFields["chatInput"]
    input.tap()
    input.typeText("What is the main color of this image? Reply with the color only.")
    if app.buttons["dismissKeyboard"].exists { app.buttons["dismissKeyboard"].tap() }
    let (beforeData, _) = try await URLSession.shared.data(
      from: URL(string: "http://127.0.0.1:5187/api/state")!)
    let beforeState = try JSONSerialization.jsonObject(with: beforeData) as! [String: Any]
    let previousMessageID = (beforeState["messages"] as! [[String: Any]]).last?["id"] as? String
    app.buttons["sendChat"].tap()
    var verified = false
    for _ in 0..<90 {
      let (data, _) = try await URLSession.shared.data(
        from: URL(string: "http://127.0.0.1:5187/api/state")!)
      let state = try JSONSerialization.jsonObject(with: data) as! [String: Any]
      let messages = state["messages"] as! [[String: Any]]
      if let answer = messages.last, answer["role"] as? String == "assistant",
        answer["id"] as? String != previousMessageID,
        let text = answer["content"] as? String,
        text.lowercased().contains("red") || text.contains("红"),
        let user = messages.dropLast().last, (user["attachments"] as? [Any])?.count == 1
      {
        verified = true
        break
      }
      try await Task.sleep(for: .seconds(1))
    }
    XCTAssertTrue(verified)
    capture("chat-photo-real-vision-answer")
    app.buttons["照片.jpg"].firstMatch.tap()
    XCTAssertTrue(
      app.otherElements["com.apple.paper.imageCanvasElementView"].waitForExistence(timeout: 20))
    capture("chat-photo-native-preview")
  }

  @MainActor private func capture(_ name: String) {
    let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }
}
