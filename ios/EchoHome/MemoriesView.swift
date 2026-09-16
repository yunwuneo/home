import SwiftUI

struct MemoriesView: View {
  @Environment(AppModel.self) private var model
  @State private var query = ""
  @State private var filter = "all"
  @State private var editing: Memory?
  @State private var editor = false
  @State private var forgetting: Memory?
  var memories: [Memory] {
    (model.state?.memories ?? []).filter {
      (filter == "all" || $0.kind == filter)
        && (query.isEmpty || ($0.title + $0.text).localizedCaseInsensitiveContains(query))
    }
    .sorted { a, b in
      if (a.pinned == true) != (b.pinned == true) { return a.pinned == true }
      if a.day != b.day { return a.day > b.day }
      return a.minute > b.minute
    }
  }
  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 18) {
        Eyebrow(text: "LITTLE MOMENTS, LONG MEMORIES")
        HStack(alignment: .bottom) {
          Text("日子会过去，\n我们会记得。").font(.system(size: 29, weight: .medium, design: .serif))
            .lineSpacing(5)
          Spacer()
          Text("\(model.state?.memories.count ?? 0)\n段回忆").font(.caption).multilineTextAlignment(
            .trailing
          ).foregroundStyle(.secondary)
        }
        ScrollView(.horizontal, showsIndicators: false) {
          HStack {
            filterButton("全部", "all")
            ForEach(memoryKinds.keys.sorted(), id: \.self) { key in
              filterButton(memoryKinds[key] ?? key, key)
            }
          }
        }
        if memories.isEmpty {
          ContentUnavailableView(
            "把小事写下来", systemImage: "book.pages", description: Text("共同活动、游戏和那些想记住的话，\n会在这里成为我们的故事。")
          )
        }
        ForEach(memories) { memory in
          VStack(alignment: .leading, spacing: 12) {
            HStack {
              Text("DAY \(String(format: "%02d", memory.day))").font(.caption.monospaced())
                .foregroundStyle(Color.clay)
              Text(memoryKinds[memory.kind] ?? "日常").font(.caption).foregroundStyle(.secondary)
              Spacer()
              if memory.pinned == true {
                Image(systemName: "pin.fill").font(.caption).foregroundStyle(Color.clay)
              }
              Menu {
                Button(memory.pinned == true ? "取消置顶" : "置顶", systemImage: "pin") {
                  Task { await model.act("/memory", ["operation": "pin", "id": memory.id]) }
                }
                Button("编辑", systemImage: "pencil") {
                  editing = memory
                  editor = true
                }
                Button("遗忘", systemImage: "trash", role: .destructive) { forgetting = memory }
              } label: {
                Image(systemName: "ellipsis").padding(8)
              }.accessibilityLabel("管理回忆 \(memory.title)")
            }
            Text(memory.title).font(.headline)
            Text(memory.text).font(.subheadline).lineSpacing(5).foregroundStyle(.secondary)
          }.paperCard()
        }
      }.padding(20).frame(maxWidth: 740).frame(maxWidth: .infinity)
    }.searchable(text: $query, prompt: "寻找一段回忆")
      .toolbar {
        ToolbarItem(placement: .primaryAction) {
          Button("写手记", systemImage: "square.and.pencil") {
            editing = nil
            editor = true
          }.accessibilityIdentifier("addMemory")
        }
      }
      .sheet(isPresented: $editor) { MemoryEditor(memory: editing) }
      .confirmationDialog(
        "遗忘这段回忆？Echo 之后不会再引用它。",
        isPresented: Binding(get: { forgetting != nil }, set: { if !$0 { forgetting = nil } }),
        titleVisibility: .visible
      ) {
        Button("遗忘这段回忆", role: .destructive) {
          if let memory = forgetting {
            Task { await model.act("/memory", ["operation": "forget", "id": memory.id]) }
          }
          forgetting = nil
        }
      }
  }
  func filterButton(_ title: String, _ key: String) -> some View {
    Button(title) { filter = key }.font(.caption).padding(.horizontal, 14).padding(.vertical, 10)
      .foregroundStyle(filter == key ? Color.white : .pine).background(
        filter == key ? Color.pine : Color.white.opacity(0.65), in: Capsule())
  }
}
struct MemoryEditor: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  let memory: Memory?
  @State private var title = ""
  @State private var text = ""
  @State private var kind = "moment"
  var body: some View {
    NavigationStack {
      Form {
        Section("想记住的小事") {
          TextField("标题", text: $title).accessibilityIdentifier("memoryTitle")
          TextField("写下这一刻…", text: $text, axis: .vertical).lineLimit(6...12)
            .accessibilityIdentifier("memoryText")
          Picker("分类", selection: $kind) {
            ForEach(memoryKinds.keys.sorted(), id: \.self) { Text(memoryKinds[$0] ?? $0).tag($0) }
          }
        }
        if let error = model.error { Section { Text(error).foregroundStyle(.red).font(.footnote) } }
        Section {
          Text("保存在服务端，与其他设备共享。\(text.count) / 1000 字").font(.caption).foregroundStyle(.secondary)
        }
      }.navigationTitle(memory == nil ? "写一页手记" : "修改回忆").navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
          ToolbarItem(placement: .confirmationAction) {
            Button("保存") {
              Task {
                var body: [String: Any] = [
                  "operation": memory == nil ? "add" : "edit",
                  "title": title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    ? "想记住的事" : title, "text": text, "kind": kind,
                ]
                if let memory { body["id"] = memory.id }
                if await model.act("/memory", body) { dismiss() }
              }
            }.disabled(
              text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || text.count > 1000
                || title.count > 60 || model.busy
            ).accessibilityIdentifier("saveMemory")
          }
        }.onAppear {
          if let memory {
            title = memory.title
            text = memory.text
            kind = memoryKinds[memory.kind] == nil ? "moment" : memory.kind
          }
        }
    }
  }
}
