import SwiftUI

struct TogetherView: View {
  @Environment(AppModel.self) private var model
  @State private var difficulty = "gentle"
  @State private var selectedSquare: String?
  @State private var base = "jasmine"
  @State private var sweetness = 50.0
  @State private var ice = 30.0
  @State private var strength = 50.0
  @State private var confirmEnd = false
  @State private var promotionMoves: [Game.Move] = []
  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 18) {
        Eyebrow(text: "JUST THE TWO OF US")
        Text("靠近一点，\n让快乐发生。").font(.system(size: 29, weight: .medium, design: .serif)).lineSpacing(
          5)
        if let pending = model.state?.companion?.pending {
          VStack(alignment: .leading, spacing: 14) {
            Label(pending.label, systemImage: "heart.fill").font(.headline)
            Text(pending.line).font(.subheadline).lineSpacing(5)
            ForEach(pending.choices, id: \.self) { choice in
              Button(choice) {
                Task { await model.act("/interaction", ["kind": "answer", "choice": choice]) }
              }.buttonStyle(.glass).accessibilityIdentifier("answer-\(choice)")
            }
          }.paperCard()
        } else {
          LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            interaction("牵牵手", "hand", "hand.draw")
            interaction("抱抱 Echo", "hug", "heart")
            interaction("听她说心事", "listen", "ear")
            interaction("认真夸夸她", "praise", "sparkles")
          }
          if let line = model.state?.companion?.lastLine, !line.isEmpty {
            Text(line).font(.subheadline).lineSpacing(4).paperCard()
          }
        }
        SectionHeading(title: "两个人的游乐场", subtitle: "随时回来，接着玩")
        if let game = model.state?.game {
          gameView(game)
        }
        if model.state?.game?.status != "playing" {
          Picker("棋力", selection: $difficulty) {
            Text("轻松玩").tag("gentle")
            Text("认真较量").tag("thoughtful")
          }.pickerStyle(.segmented)
          gameTile("窗边棋桌", "chess", "checkerboard.rectangle", "白棋先行，慢慢下一局。")
          gameTile("心动翻牌", "pairs", "square.grid.2x2", "16 张牌，找到属于我们的一对。")
          gameTile("两人的调饮台", "drinks", "cup.and.saucer", "三杯特调，把心意调进茶里。")
        }
      }.padding(20).frame(maxWidth: 740).frame(maxWidth: .infinity)
    }.disabled(model.busy || model.sending || !model.online)
      .confirmationDialog(
        "结束当前游戏？未完成的游戏不会结算奖励。", isPresented: $confirmEnd, titleVisibility: .visible
      ) {
        Button("结束这一局", role: .destructive) {
          Task { await model.gameAction(model.state?.game?.kind == "chess" ? "resign" : "end") }
        }
      }
      .confirmationDialog(
        "选择升变棋子",
        isPresented: Binding(
          get: { !promotionMoves.isEmpty }, set: { if !$0 { promotionMoves = [] } }),
        titleVisibility: .visible
      ) {
        ForEach(promotionMoves, id: \.promotion) { move in
          Button(["q": "皇后", "r": "车", "b": "象", "n": "马"][move.promotion ?? "q"] ?? "皇后") {
            play(move)
          }
        }
      }
  }
  func interaction(_ title: String, _ kind: String, _ symbol: String) -> some View {
    ActionTile(title: title, symbol: symbol) {
      Task { await model.act("/interaction", ["kind": kind]) }
    }
  }
  func gameTile(_ title: String, _ kind: String, _ symbol: String, _ subtitle: String) -> some View
  {
    Button {
      selectedSquare = nil
      Task { await model.act("/game/start", ["kind": kind, "difficulty": difficulty]) }
    } label: {
      HStack(spacing: 16) {
        Image(systemName: symbol).font(.largeTitle).foregroundStyle(Color.pine).frame(width: 48)
        VStack(alignment: .leading, spacing: 7) {
          Text(title).font(.headline)
          Text(subtitle).font(.caption).foregroundStyle(.secondary)
        }
        Spacer()
        Image(systemName: "arrow.up.right")
      }.paperCard()
    }.buttonStyle(.plain).accessibilityIdentifier("start-\(kind)")
  }
  @ViewBuilder func gameView(_ game: Game) -> some View {
    VStack(alignment: .leading, spacing: 16) {
      HStack {
        Text(["chess": "窗边棋桌", "pairs": "心动翻牌", "drinks": "两人的调饮台"][game.kind] ?? "一起玩").font(
          .headline)
        Spacer()
        if game.status == "playing" {
          Button("结束") { confirmEnd = true }.font(.caption).accessibilityIdentifier("endGame")
        }
      }
      Text(game.line).font(.subheadline).lineSpacing(4).accessibilityIdentifier("gameLine")
      if game.status != "playing" {
        Label(
          game.status == "abandoned" ? "已结束，可以重新开始" : "本局已完成 · 已同步", systemImage: "checkmark.seal"
        ).font(.caption).foregroundStyle(Color.pine)
      }
      if game.kind == "chess" { chessBoard(game) }
      if game.kind == "pairs" { pairsBoard(game) }
      if game.kind == "drinks" { drinks(game) }
    }.paperCard()
  }
  func chessBoard(_ game: Game) -> some View {
    VStack(spacing: 10) {
      if game.check == true { Text("将军！请保护国王").font(.caption).foregroundStyle(Color.clay) }
      LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 8), spacing: 0)
      {
        ForEach(0..<64, id: \.self) { index in
          let square = "\(Array("abcdefgh")[index % 8])\(8 - index / 8)"
          let piece = game.board?[index]
          let possible =
            game.legal?.contains { $0.from == selectedSquare && $0.to == square } == true
          Button {
            let moves = game.legal?.filter { $0.from == selectedSquare && $0.to == square } ?? []
            if moves.count > 1 {
              promotionMoves = moves
            } else if let move = moves.first {
              play(move)
            } else {
              selectedSquare = piece?.color == "w" ? square : nil
            }
          } label: {
            ZStack {
              Rectangle().fill(
                (index / 8 + index % 8).isMultiple(of: 2)
                  ? Color(red: 0.91, green: 0.9, blue: 0.8) : Color.pine.opacity(0.52))
              if selectedSquare == square { Rectangle().strokeBorder(Color.clay, lineWidth: 3) }
              if let piece {
                Text(pieceSymbol(piece)).font(.system(size: 29)).foregroundStyle(
                  piece.color == "w" ? Color.white : Color.black
                )
              } else if possible {
                Circle().fill(Color.pine).frame(width: 10, height: 10)
              }
            }.aspectRatio(1, contentMode: .fit)
          }.buttonStyle(.plain).disabled(game.status != "playing").accessibilityLabel(
            "\(square)\(piece.map { " \($0.color == "w" ? "白" : "黑")\($0.type)" } ?? " 空格")"
          ).accessibilityIdentifier("square-\(square)")
        }
      }.clipShape(RoundedRectangle(cornerRadius: 10))
      Text("你执白棋 · 点击棋子查看合法落点").font(.caption).foregroundStyle(.secondary)
      if let moves = game.moves, !moves.isEmpty {
        Text(moves.enumerated().map { "\($0.offset + 1). \($0.element)" }.joined(separator: "  "))
          .font(.caption.monospaced()).frame(maxWidth: .infinity, alignment: .leading)
          .accessibilityIdentifier("chessMoves")
      }
    }
  }
  func pieceSymbol(_ p: Game.Piece) -> String {
    let symbols =
      p.color == "w"
      ? ["k": "♔", "q": "♕", "r": "♖", "b": "♗", "n": "♘", "p": "♙"]
      : ["k": "♚", "q": "♛", "r": "♜", "b": "♝", "n": "♞", "p": "♟"]
    return (symbols[p.type] ?? "") + "\u{FE0E}"
  }
  func play(_ move: Game.Move) {
    selectedSquare = nil
    promotionMoves = []
    Task {
      await model.gameAction(
        "move", ["from": move.from, "to": move.to, "promotion": move.promotion ?? "q"])
    }
  }
  func pairsBoard(_ game: Game) -> some View {
    VStack(spacing: 14) {
      if case .pairs(let player, let echo) = game.scores {
        HStack {
          Text("你  \(player)")
          Spacer()
          Text("Echo  \(echo)")
        }.font(.headline).foregroundStyle(Color.pine)
      }
      LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 9), count: 4), spacing: 9)
      {
        ForEach(0..<16, id: \.self) { i in
          let value = game.cards?[i]
          let matched = game.matched?.contains(i) == true
          Button {
            Task { await model.gameAction("flip", ["index": i]) }
          } label: {
            ZStack {
              RoundedRectangle(cornerRadius: 13).fill(value == nil ? Color.pine : Color.cream)
              Text(value.map { ["🍓", "🍵", "🌼", "🍋", "🍒", "🌿", "🍑", "🌙"][$0 % 8] } ?? "✦").font(
                .title
              )
              .foregroundStyle(Color.cream)
            }.aspectRatio(0.85, contentMode: .fit).opacity(matched ? 0.4 : 1)
          }.buttonStyle(.plain).disabled(
            game.status != "playing" || matched || value != nil || game.turn != "player"
              || (game.revealed?.count ?? 0) >= 2
          )
          .accessibilityLabel(value.map { "卡片 \(i + 1)，图案 \($0)" } ?? "卡片 \(i + 1)，未翻开")
          .accessibilityIdentifier("card-\(i)")
        }
      }
      if game.status == "playing", game.turn == "echo" || (game.revealed?.count ?? 0) >= 2 {
        Button("继续翻牌") { Task { await model.gameAction("continue") } }.buttonStyle(.glassProminent)
          .accessibilityIdentifier("continuePairs")
      }
    }
  }
  func drinks(_ game: Game) -> some View {
    VStack(alignment: .leading, spacing: 14) {
      if let order = game.order {
        HStack {
          Image(systemName: "cup.and.saucer.fill").font(.largeTitle).foregroundStyle(Color.clay)
          VStack(alignment: .leading, spacing: 5) {
            Text(order.name).font(.headline)
            Text(order.wish).font(.caption).foregroundStyle(.secondary)
          }
        }
      }
      Text("第 \((game.round ?? 0) + 1) 杯 · 已试味 \(game.attempts ?? 0) / 3 次").font(.caption)
      if game.status == "playing" {
        Picker("茶底", selection: $base) {
          Text("茉莉").tag("jasmine")
          Text("抹茶").tag("matcha")
          Text("红茶").tag("black")
        }.pickerStyle(.segmented)
        recipeSlider("甜度", value: $sweetness)
        recipeSlider("冰量", value: $ice)
        recipeSlider("茶香", value: $strength)
        if game.served == true {
          Button(game.round == 2 ? "完成调饮" : "下一杯") { Task { await model.gameAction("next") } }
            .buttonStyle(.glassProminent).accessibilityIdentifier("nextDrink")
        } else {
          Button("请 Echo 试味") {
            Task {
              await model.gameAction(
                "serve",
                [
                  "recipe": [
                    "base": base, "sweetness": Int(sweetness), "ice": Int(ice),
                    "strength": Int(strength),
                  ]
                ])
            }
          }.buttonStyle(.glassProminent).accessibilityIdentifier("serveDrink")
        }
      }
      if let feedback = game.feedback {
        Text("\(feedback.score) 分 · \(feedback.tips.joined(separator: " "))").font(.subheadline)
          .foregroundStyle(Color.pine).accessibilityIdentifier("drinkFeedback")
      }
      if case .drinks(let scores) = game.scores, !scores.isEmpty {
        Text("每杯成绩：" + scores.map { "\($0) 分" }.joined(separator: " · ")).font(.caption)
      }
    }
  }
  func recipeSlider(_ title: String, value: Binding<Double>) -> some View {
    HStack {
      Text(title).font(.caption).frame(width: 30)
      Slider(value: value, in: 0...100, step: 10).accessibilityLabel(title)
      Text("\(Int(value.wrappedValue))").font(.caption.monospacedDigit()).frame(width: 28)
    }
  }
}
