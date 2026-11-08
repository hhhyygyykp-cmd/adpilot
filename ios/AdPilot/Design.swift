import SwiftUI

enum AdColor {
    static let ink = Color(red: 0.047, green: 0.043, blue: 0.035)
    static let surface = Color(red: 0.106, green: 0.094, blue: 0.078)
    static let gold = Color(red: 0.831, green: 0.706, blue: 0.514)
    static let cream = Color(red: 0.957, green: 0.937, blue: 0.902)
    static let muted = Color(red: 0.612, green: 0.576, blue: 0.525)
    static let danger = Color(red: 0.878, green: 0.478, blue: 0.373)
    static let ok = Color(red: 0.561, green: 0.678, blue: 0.478)
}

enum Copy {
    static func text(_ en: String, _ ar: String, language: String) -> String {
        language == "ar" ? ar : en
    }
}

struct GoldButton: View {
    let title: String
    var enabled: Bool = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(AdColor.gold.opacity(enabled ? 1 : 0.4))
                .foregroundStyle(AdColor.ink)
                .clipShape(Capsule())
        }
        .disabled(!enabled)
    }
}

struct Panel<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        content
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AdColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(AdColor.gold.opacity(0.16), lineWidth: 1)
            )
    }
}
