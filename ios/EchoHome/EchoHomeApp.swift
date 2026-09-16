import SwiftUI

@main struct EchoHomeApp: App {
  @State private var model = AppModel()
  var body: some Scene {
    WindowGroup { RootView().environment(model).tint(.pine).preferredColorScheme(.light) }
  }
}
