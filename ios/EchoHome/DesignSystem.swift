import SwiftUI

extension Color {
  static let pine = Color(red: 0.23, green: 0.39, blue: 0.31)
  static let cream = Color(red: 0.97, green: 0.96, blue: 0.92)
  static let clay = Color(red: 0.72, green: 0.43, blue: 0.32)
}
struct PaperBackground: View {
  var body: some View {
    LinearGradient(
      colors: [.cream, Color(red: 0.9, green: 0.94, blue: 0.88), .cream], startPoint: .topLeading,
      endPoint: .bottomTrailing
    ).ignoresSafeArea()
  }
}
extension View {
  func paperCard() -> some View {
    padding(18).background(.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 24))
  }
  func glassCapsule() -> some View {
    padding(.horizontal, 16).padding(.vertical, 11).glassEffect(.regular, in: Capsule())
  }
}
struct Eyebrow: View {
  let text: String
  var body: some View {
    Text(text).font(.system(size: 10, weight: .semibold, design: .monospaced)).tracking(3)
      .foregroundStyle(Color.pine.opacity(0.7))
  }
}
struct SectionHeading: View {
  let title: String
  var subtitle: String = ""
  var body: some View {
    HStack(alignment: .firstTextBaseline) {
      Text(title).font(.title3.bold())
      Spacer()
      if !subtitle.isEmpty { Text(subtitle).font(.caption).foregroundStyle(.secondary) }
    }.padding(.top, 8)
  }
}
struct ActionTile: View {
  let title: String
  let symbol: String
  var subtitle: String = ""
  let action: () -> Void
  var body: some View {
    Button(action: action) {
      VStack(alignment: .leading, spacing: 12) {
        Image(systemName: symbol).font(.title2).foregroundStyle(Color.pine).frame(height: 28)
        Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(.primary)
        if !subtitle.isEmpty { Text(subtitle).font(.caption).foregroundStyle(.secondary) }
      }.frame(maxWidth: .infinity, alignment: .leading).paperCard()
    }.buttonStyle(.plain).accessibilityIdentifier(title)
  }
}
