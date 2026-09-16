import SceneKit
import SwiftUI

struct HomeView: View {
  @Environment(AppModel.self) private var model
  @State private var map = false
  @Environment(\.horizontalSizeClass) private var widthClass
  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 20) {
        HStack(alignment: .bottom) {
          VStack(alignment: .leading, spacing: 9) {
            Eyebrow(text: "A LITTLE LIFE, TOGETHER")
            Text("平凡的日子，\n也想和你一起。 ").font(.system(size: 29, weight: .medium, design: .serif))
              .lineSpacing(5)
          }
          Spacer()
          VStack(alignment: .trailing, spacing: 5) {
            Text(model.state?.clock ?? "—:—").font(
              .system(.title2, design: .rounded).monospacedDigit())
            Text("共同生活 · 第 \(model.state?.day ?? 1) 天").font(.caption2).foregroundStyle(.secondary)
          }
        }
        if let state = model.state {
          sceneCard(state)
          HStack(spacing: 10) {
            Label(state.relationship, systemImage: "heart").font(.caption)
            Spacer()
            Label("餐食 \(state.meals)", systemImage: "fork.knife").font(.caption)
          }.foregroundStyle(Color.pine)
          HStack(spacing: 14) {
            meter("饱腹", value: state.hunger, symbol: "fork.knife", color: .clay)
            meter("精力", value: state.energy, symbol: "sparkles", color: .pine)
          }
          if let a = state.activity {
            VStack(alignment: .leading, spacing: 12) {
              HStack {
                Label(
                  activityNames[a.kind] ?? a.kind, systemImage: activitySymbols[a.kind] ?? "heart"
                ).font(.headline)
                Spacer()
                Text(a.together ? "和 Echo" : "Echo 正在").font(.caption)
              }
              ProgressView(value: min(max(a.progress / max(a.duration, 1), 0), 1))
              HStack {
                Text(a.stage == "walking" ? "正在走过去…" : "享受此刻的陪伴").font(.caption).foregroundStyle(
                  .secondary)
                Spacer()
                if !a.together {
                  Button("加入她") { Task { await model.act("/activity", ["kind": a.kind]) } }
                }
                Button("结束活动") { Task { await model.act("/activity/cancel") } }
                  .accessibilityIdentifier("cancelActivity")
              }.font(.caption)
            }.paperCard()
          }
          HStack {
            SectionHeading(
              title: "今天，做点什么", subtitle: "\(Place.find(state.location).activities.count) 件小事")
          }
          LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            ForEach(Place.find(state.location).activities, id: \.self) { kind in
              ActionTile(
                title: activityNames[kind] ?? kind, symbol: activitySymbols[kind] ?? "heart"
              ) { Task { await model.act("/activity", ["kind": kind]) } }
            }
          }.disabled(model.busy || model.sending || state.game?.status == "playing")
          HStack {
            Text("生活的步调").font(.subheadline)
            Spacer()
            Picker(
              "生活速度",
              selection: Binding(
                get: { state.speed },
                set: { value in Task { await model.act("/control", ["speed": value]) } })
            ) {
              Text("暂停").tag(0)
              Text("1×").tag(1)
              Text("3×").tag(3)
            }.pickerStyle(.segmented).frame(width: 185).accessibilityIdentifier("speed")
          }.paperCard()
        } else {
          ContentUnavailableView(
            "小家在等你", systemImage: "house.and.flag",
            description: Text("打开电脑上的服务端，在设置中连接。\n所有日常、对话和回忆都会与它同步。"))
        }
        Text("有你在，日常就有了回声。").font(.system(.footnote, design: .serif)).foregroundStyle(.secondary)
          .frame(maxWidth: .infinity).padding(.vertical)
      }.padding(20).frame(maxWidth: 760).frame(maxWidth: .infinity)
    }.refreshable { await model.refresh() }
      .sheet(isPresented: $map) { mapSheet }
  }
  func meter(_ title: String, value: Double, symbol: String, color: Color) -> some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack {
        Label(title, systemImage: symbol)
        Spacer()
        Text("\(Int(value))%").monospacedDigit()
      }.font(.caption)
      ProgressView(value: min(max(value / 100, 0), 1)).tint(color)
    }.frame(maxWidth: .infinity).paperCard()
  }
  func sceneCard(_ state: WorldState) -> some View {
    VStack(spacing: 0) {
      NativeWorldView(state: state) { point in
        Task { await model.act("/move", ["position": point]) }
      }
      .frame(maxWidth: .infinity).frame(height: widthClass == .regular ? 420 : 300)
      .overlay(alignment: .topLeading) {
        Label(Place.find(state.location).name, systemImage: Place.find(state.location).symbol).font(
          .caption.weight(.medium)
        ).glassCapsule().padding(14)
      }
      .overlay(alignment: .bottomTrailing) {
        Button("出门走走", systemImage: "map") { map = true }.font(.caption.weight(.medium))
          .glassCapsule().padding(14).accessibilityIdentifier("travelMap")
      }
      HStack(alignment: .top, spacing: 12) {
        Text("E").font(.system(.title3, design: .serif)).foregroundStyle(.white).frame(
          width: 38, height: 38
        ).background(Color.pine, in: Circle())
        VStack(alignment: .leading, spacing: 5) {
          HStack {
            Text("Echo").font(.subheadline.bold())
            Text(state.mood).font(.caption2).foregroundStyle(.secondary)
          }
          Text(state.messages.last(where: { $0.role == "assistant" })?.content ?? "回来啦。今天也想和你一起过。")
            .font(.subheadline).lineLimit(3).lineSpacing(4)
        }
        Spacer(minLength: 0)
      }.padding(18).frame(maxWidth: .infinity, alignment: .leading).background(.white.opacity(0.8))
    }.clipShape(RoundedRectangle(cornerRadius: 28))
  }
  var mapSheet: some View {
    NavigationStack {
      ZStack {
        PaperBackground()
        ScrollView {
          VStack(alignment: .leading, spacing: 18) {
            Eyebrow(text: "OUR LITTLE NEIGHBORHOOD")
            Text("去哪里，都和你。").font(.title2.weight(.medium))
            Text("出门会结束当前活动；进行中的小游戏需要先结束。").font(.caption).foregroundStyle(.secondary)
            ForEach(Place.all) { place in
              Button {
                Task { if await model.act("/travel", ["location": place.id]) { map = false } }
              } label: {
                HStack(spacing: 18) {
                  Image(systemName: place.symbol).font(.title2).frame(width: 36)
                  VStack(alignment: .leading, spacing: 6) {
                    Text(place.name).font(.headline)
                    Text(place.subtitle).font(.caption).foregroundStyle(.secondary)
                  }
                  Spacer()
                  Image(
                    systemName: model.state?.location == place.id
                      ? "checkmark.circle.fill" : "arrow.up.right")
                }.paperCard()
              }.buttonStyle(.plain).accessibilityIdentifier("travel-\(place.id)")
            }
          }.padding(20)
        }
      }.navigationTitle("生活地图").navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .confirmationAction) { Button("完成") { map = false } } }
    }.disabled(model.busy)
  }
}

// A native SceneKit diorama. Only presentation is local; positions and activities come from the server.
struct NativeWorldView: UIViewRepresentable {
  let state: WorldState
  let move: ([Double]) -> Void
  func makeCoordinator() -> Coordinator { Coordinator(move: move) }
  func makeUIView(context: Context) -> SCNView {
    let view = SCNView(frame: CGRect(x: 0, y: 0, width: 390, height: 320))
    view.isPlaying = true
    view.rendersContinuously = true
    view.preferredFramesPerSecond = 30
    view.backgroundColor = UIColor(red: 0.87, green: 0.91, blue: 0.84, alpha: 1)
    view.antialiasingMode = .multisampling4X
    view.allowsCameraControl = true
    view.defaultCameraController.interactionMode = .orbitTurntable
    view.addGestureRecognizer(
      UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.tap(_:))))
    return view
  }
  func sizeThatFits(_ proposal: ProposedViewSize, uiView: SCNView, context: Context) -> CGSize? {
    CGSize(width: proposal.width ?? 390, height: proposal.height ?? 320)
  }
  func updateUIView(_ view: SCNView, context: Context) {
    if context.coordinator.location != state.location {
      context.coordinator.location = state.location
      view.scene = makeScene(state.location)
      view.pointOfView = view.scene?.rootNode.childNode(withName: "camera", recursively: false)
    }
    SCNTransaction.begin()
    SCNTransaction.animationDuration = UIAccessibility.isReduceMotionEnabled ? 0 : 0.8
    let active = state.activity
    for (name, pos) in [("echo", state.echoPosition), ("player", state.playerPosition)]
    where pos.count == 2 {
      if let node = view.scene?.rootNode.childNode(withName: name, recursively: false) {
        node.position = SCNVector3(pos[0], 0.15, pos[1])
        node.eulerAngles.y = name == "echo" ? 0.25 : -0.35
        node.scale = SCNVector3(1, active?.kind == "rest" ? 0.7 : 1, 1)
      }
    }
    SCNTransaction.commit()
  }
  @MainActor final class Coordinator: NSObject {
    var location = ""
    let move: ([Double]) -> Void
    init(move: @escaping ([Double]) -> Void) { self.move = move }
    @objc func tap(_ recognizer: UITapGestureRecognizer) {
      guard let view = recognizer.view as? SCNView,
        let hit = view.hitTest(recognizer.location(in: view)).first,
        hit.node.name == "floor"
      else { return }
      move([Double(hit.worldCoordinates.x), Double(hit.worldCoordinates.z)])
    }
  }
  func makeScene(_ place: String) -> SCNScene {
    let scene = SCNScene()
    let root = scene.rootNode
    let wood = UIColor(red: 0.73, green: 0.57, blue: 0.39, alpha: 1)
    let sage = UIColor(red: 0.43, green: 0.61, blue: 0.49, alpha: 1)
    let cream = UIColor(red: 0.94, green: 0.90, blue: 0.8, alpha: 1)
    @discardableResult func box(
      _ w: CGFloat, _ h: CGFloat, _ d: CGFloat, _ x: Float, _ y: Float, _ z: Float,
      _ color: UIColor, _ name: String = ""
    ) -> SCNNode {
      let geometry = SCNBox(width: w, height: h, length: d, chamferRadius: min(0.09, h / 4))
      geometry.firstMaterial?.diffuse.contents = color
      let node = SCNNode(geometry: geometry)
      node.position = SCNVector3(x, y, z)
      node.name = name
      root.addChildNode(node)
      return node
    }
    func plant(_ x: Float, _ z: Float) {
      box(0.5, 0.5, 0.5, x, 0.4, z, wood)
      let sphere = SCNSphere(radius: 0.53)
      sphere.firstMaterial?.diffuse.contents = sage
      let n = SCNNode(geometry: sphere)
      n.position = SCNVector3(x, 1.1, z)
      n.scale = SCNVector3(0.8, 1.4, 0.8)
      root.addChildNode(n)
    }
    box(12, 0.2, 8, 0, 0, 0, place == "park" ? sage : cream, "floor")
    if place != "park" {
      box(12, 2.8, 0.15, 0, 1.45, -4, UIColor(red: 0.87, green: 0.86, blue: 0.77, alpha: 1))
      box(0.15, 2.8, 8, -6, 1.45, 0, cream)
      for x in stride(from: Float(-4.8), through: Float(0), by: 1.25) {
        box(1.12, 1.45, 0.05, x, 1.8, -3.89, UIColor(red: 0.74, green: 0.86, blue: 0.84, alpha: 1))
      }
      for x in stride(from: Float(-5.5), through: Float(5.5), by: 0.6) {
        box(0.015, 0.01, 7.8, x, 0.11, 0, wood.withAlphaComponent(0.18))
      }
    }
    switch place {
    case "home":
      box(4.5, 0.9, 0.7, -3.3, 0.6, -3.5, wood)
      box(4.6, 0.08, 0.85, -3.3, 1.09, -3.5, cream)
      box(2.7, 0.38, 1.0, -1.7, 0.42, 0.45, sage)
      box(2.7, 0.8, 0.25, -1.7, 0.65, 0, sage)
      box(0.25, 0.68, 1.05, -3.05, 0.55, 0.45, sage)
      box(0.25, 0.68, 1.05, -0.35, 0.55, 0.45, sage)
      box(3.8, 0.035, 3.4, -1.5, 0.13, 1.5, UIColor(red: 0.8, green: 0.77, blue: 0.65, alpha: 1))
      box(1.8, 0.45, 0.85, -1.6, 0.38, 1.9, wood)
      box(2.8, 0.5, 2.2, 3.2, 0.4, -2.5, wood)
      box(2.65, 0.2, 2.05, 3.2, 0.76, -2.5, cream)
      box(2.65, 0.13, 1.35, 3.2, 0.95, -2.15, sage)
      box(0.75, 0.15, 0.5, 2.6, 0.94, -3.15, .white)
      box(0.75, 0.15, 0.5, 3.65, 0.94, -3.15, .white)
      box(2.5, 0.1, 1.3, -3.2, 1.0, -1.1, wood)
      for x: Float in [-4.1, -2.3] {
        for z: Float in [-1.5, -0.7] { box(0.1, 0.9, 0.1, x, 0.5, z, wood) }
      }
      box(2.5, 0.5, 0.6, -1.5, 0.4, 3.55, wood)
      box(2, 1.2, 0.1, -1.5, 1.3, 3.55, UIColor.darkGray)
      plant(-5.3, 2.8)
      plant(5, -3.3)
      plant(-5, -2.8)
    case "park":
      box(2.6, 0.04, 8, 4.4, 0.14, 0, UIColor(red: 0.5, green: 0.75, blue: 0.8, alpha: 1))
      box(2, 0.03, 8, 0, 0.14, 0, cream)
      for z: Float in [-2.4, 2.4] {
        plant(-4, z)
        box(2, 0.45, 0.6, -2, 0.4, z, wood)
      }
    case "cinema":
      box(7, 2.4, 0.1, 0, 1.6, -3.7, UIColor(red: 0.67, green: 0.76, blue: 0.82, alpha: 1))
      for z: Float in [-1.4, 0.5, 2.3] {
        for x: Float in [-3, -1.5, 0, 1.5] {
          box(0.9, 0.55, 0.8, x, 0.4, z, UIColor(red: 0.52, green: 0.36, blue: 0.37, alpha: 1))
          box(0.9, 0.9, 0.2, x, 0.65, z + 0.35, wood)
        }
      }
    case "market":
      for x: Float in [-3.5, 2.7] {
        box(2, 0.8, 3, x, 0.5, -0.5, wood)
        for z: Float in [-1.5, -0.5, 0.5] { box(1.8, 0.3, 0.7, x, 1.0, z, sage) }
      }
      box(10, 1.2, 0.7, 0, 0.7, -3.4, wood)
    default:
      box(11, 1.0, 1, 0, 0.6, -3.3, wood)
      for x: Float in [-3, 2.5] {
        for z: Float in [-0.9, 2.1] {
          box(1.8, 0.12, 1.2, x, 0.95, z, wood)
          box(0.25, 0.85, 0.25, x, 0.5, z, wood)
          box(0.6, 0.5, 0.6, x - 1.1, 0.4, z, sage)
          box(0.6, 0.5, 0.6, x + 1.1, 0.4, z, sage)
          if place == "office" { box(0.9, 0.7, 0.06, x, 1.35, z, UIColor.darkGray) }
        }
      }
      plant(5, -2.5)
    }
    for (name, color) in [
      ("echo", UIColor(red: 0.8, green: 0.53, blue: 0.41, alpha: 1)), ("player", sage),
    ] {
      let character = SCNNode()
      character.name = name
      let body = SCNCapsule(capRadius: 0.25, height: 0.65)
      body.firstMaterial?.diffuse.contents = color
      let torso = SCNNode(geometry: body)
      torso.position.y = 0.62
      character.addChildNode(torso)
      let hair = SCNSphere(radius: 0.31)
      hair.firstMaterial?.diffuse.contents = UIColor.brown
      let h = SCNNode(geometry: hair)
      h.position = SCNVector3(0, 1.12, -0.04)
      character.addChildNode(h)
      let head = SCNSphere(radius: 0.27)
      head.firstMaterial?.diffuse.contents = UIColor(red: 0.96, green: 0.8, blue: 0.64, alpha: 1)
      let face = SCNNode(geometry: head)
      face.position = SCNVector3(0, 1.1, 0.06)
      character.addChildNode(face)
      for x: Float in [-0.1, 0.1] {
        let eye = SCNSphere(radius: 0.025)
        eye.firstMaterial?.diffuse.contents = UIColor.darkGray
        let n = SCNNode(geometry: eye)
        n.position = SCNVector3(x, 1.13, 0.3)
        character.addChildNode(n)
        let leg = SCNCapsule(capRadius: 0.09, height: 0.35)
        leg.firstMaterial?.diffuse.contents = UIColor.darkGray
        let l = SCNNode(geometry: leg)
        l.position = SCNVector3(x, 0.23, 0)
        character.addChildNode(l)
      }
      root.addChildNode(character)
    }
    let camera = SCNNode()
    camera.name = "camera"
    camera.camera = SCNCamera()
    camera.camera?.usesOrthographicProjection = true
    camera.camera?.orthographicScale = 7.2
    camera.position = SCNVector3(10, 12, 15)
    camera.look(at: SCNVector3(0, 0, 0))
    root.addChildNode(camera)
    let ambient = SCNNode()
    ambient.light = SCNLight()
    ambient.light?.type = .ambient
    ambient.light?.intensity = 700
    root.addChildNode(ambient)
    let sun = SCNNode()
    sun.light = SCNLight()
    sun.light?.type = .omni
    sun.light?.intensity = 1100
    sun.position = SCNVector3(-3, 10, 7)
    root.addChildNode(sun)
    return scene
  }
}
