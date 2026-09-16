import XCTest

final class EchoHomeUITests: XCTestCase {
  @MainActor func testNativeFlows() async throws {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launchEnvironment["ECHO_SERVER_URL"] = "http://127.0.0.1:5187"
    let (initial, _) = try await URLSession.shared.data(
      from: URL(string: "http://127.0.0.1:5187/api/state")!)
    let initialState = try JSONSerialization.jsonObject(with: initial) as! [String: Any]
    if let game = initialState["game"] as? [String: Any], game["status"] as? String == "playing" {
      var end = URLRequest(url: URL(string: "http://127.0.0.1:5187/api/game/action")!)
      end.httpMethod = "POST"
      end.setValue("application/json", forHTTPHeaderField: "Content-Type")
      end.httpBody = try JSONSerialization.data(withJSONObject: [
        "id": game["id"]!, "revision": game["revision"]!, "action": "end",
      ])
      _ = try await URLSession.shared.data(for: end)
    }
    let unique = String(UUID().uuidString.prefix(5))
    let chatText = "Tea time " + unique
    let memoryTitle = "iOS Memory " + unique
    app.launch()
    XCTAssertTrue(app.buttons["travelMap"].waitForExistence(timeout: 20))
    capture("01-home")
    app.buttons["travelMap"].tap()
    XCTAssertTrue(app.buttons["travel-cafe"].waitForExistence(timeout: 5))
    app.buttons["travel-cafe"].tap()
    XCTAssertTrue(app.buttons["喝杯咖啡"].waitForExistence(timeout: 10))
    app.buttons["喝杯咖啡"].tap()
    XCTAssertTrue(app.buttons["cancelActivity"].waitForExistence(timeout: 10))
    capture("02-cafe-activity")
    app.buttons["cancelActivity"].tap()
    app.buttons["travelMap"].tap()
    app.buttons["travel-home"].tap()
    app.tabBars.buttons["聊天"].tap()
    let input = app.textFields["chatInput"]
    XCTAssertTrue(input.waitForExistence(timeout: 5))
    input.tap()
    input.typeText(chatText)
    capture("chat-keyboard")
    if app.buttons["dismissKeyboard"].exists { app.buttons["dismissKeyboard"].tap() }
    app.buttons["sendChat"].tap()
    XCTAssertTrue(app.staticTexts[chatText].waitForExistence(timeout: 20))
    capture("03-chat")
    app.tabBars.buttons["回忆"].tap()
    app.buttons["addMemory"].tap()
    app.textFields["memoryTitle"].tap()
    app.textFields["memoryTitle"].typeText(memoryTitle)
    app.descendants(matching: .any)["memoryText"].firstMatch.tap()
    app.descendants(matching: .any)["memoryText"].firstMatch.typeText(
      "A lovely day, synced with our home server.")
    app.buttons["saveMemory"].tap()
    XCTAssertTrue(app.staticTexts[memoryTitle].waitForExistence(timeout: 10))
    capture("04-memories")
    app.tabBars.buttons["一起玩"].tap()
    app.buttons["牵牵手"].tap()
    XCTAssertTrue(app.buttons["answer-安静地陪着她"].waitForExistence(timeout: 10))
    app.buttons["answer-安静地陪着她"].tap()
    app.swipeUp()
    app.buttons["start-chess"].tap()
    let e2 = app.buttons["square-e2"]
    XCTAssertTrue(e2.waitForExistence(timeout: 10))
    e2.tap()
    app.buttons["square-e4"].tap()
    XCTAssertTrue(app.staticTexts["chessMoves"].waitForExistence(timeout: 15))
    XCTAssertTrue(app.staticTexts["chessMoves"].label.contains("e4"))
    capture("05-chess")
    app.buttons["endGame"].tap()
    app.buttons["结束这一局"].tap()
    app.swipeUp()
    XCTAssertTrue(app.buttons["start-pairs"].waitForExistence(timeout: 10))
    app.buttons["start-pairs"].tap()
    XCTAssertTrue(app.buttons["card-0"].waitForExistence(timeout: 10))
    app.buttons["card-0"].tap()
    app.buttons["card-1"].tap()
    let revealed = XCTNSPredicateExpectation(
      predicate: NSPredicate(format: "label CONTAINS %@", "图案"), object: app.buttons["card-1"])
    XCTAssertEqual(XCTWaiter.wait(for: [revealed], timeout: 10), .completed)
    capture("06-pairs")
    app.buttons["endGame"].tap()
    app.buttons["结束这一局"].tap()
    app.swipeUp()
    XCTAssertTrue(app.buttons["start-drinks"].waitForExistence(timeout: 10))
    app.buttons["start-drinks"].tap()
    app.swipeUp()
    XCTAssertTrue(app.buttons["serveDrink"].waitForExistence(timeout: 10))
    app.buttons["serveDrink"].tap()
    XCTAssertTrue(app.staticTexts["drinkFeedback"].waitForExistence(timeout: 10))
    capture("07-drinks")
    app.terminate()
    app.launch()
    app.tabBars.buttons["一起玩"].tap()
    app.swipeUp()
    XCTAssertTrue(app.staticTexts["drinkFeedback"].waitForExistence(timeout: 10))
    capture("08-restored-game")
  }
  @MainActor func testSettingsAndExternalSync() async throws {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launchEnvironment["ECHO_SERVER_URL"] = "http://127.0.0.1:5187"
    app.launch()
    XCTAssertTrue(app.buttons["travelMap"].waitForExistence(timeout: 20))
    app.buttons["settings"].tap()
    let name = app.textFields["playerName"]
    XCTAssertTrue(name.waitForExistence(timeout: 15))
    name.tap()
    let old = name.value as? String ?? ""
    name.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: old.count))
    name.typeText("Native Sync")
    app.buttons["saveSettings"].tap()
    if !app.staticTexts["settingsResult"].exists { app.swipeUp() }
    XCTAssertTrue(app.staticTexts["settingsResult"].waitForExistence(timeout: 15))
    capture("09-settings")
    let (data, _) = try await URLSession.shared.data(
      from: URL(string: "http://127.0.0.1:5187/api/state")!)
    let state = try JSONSerialization.jsonObject(with: data) as! [String: Any]
    XCTAssertEqual(state["playerName"] as? String, "Native Sync")
    app.buttons["完成"].tap()
    app.tabBars.buttons["回忆"].tap()
    let title = "External sync " + String(UUID().uuidString.prefix(6))
    var request = URLRequest(url: URL(string: "http://127.0.0.1:5187/api/memory")!)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONSerialization.data(withJSONObject: [
      "operation": "add", "title": title,
      "text": "Created by another client; received by the iOS polling loop.", "kind": "moment",
    ])
    let (_, response) = try await URLSession.shared.data(for: request)
    XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
    XCTAssertTrue(app.staticTexts[title].waitForExistence(timeout: 15))
    capture("10-external-sync")
    XCUIDevice.shared.orientation = .landscapeLeft
    XCTAssertTrue(app.staticTexts[title].waitForExistence(timeout: 5))
    capture("11-landscape")
    XCUIDevice.shared.orientation = .portrait
  }

  @MainActor private func capture(_ name: String) {
    let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }
}
