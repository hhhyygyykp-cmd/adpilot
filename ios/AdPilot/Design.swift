import SwiftUI
import UIKit

enum Keyboard {
    static func dismiss() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }
}

enum AppHaptic {
    static func notify(success: Bool) {
        UINotificationFeedbackGenerator().notificationOccurred(success ? .success : .error)
    }
}

struct BrandMark: View {
    var size: CGFloat = 36

    var body: some View {
        ZStack {
            BrandTriangle()
                .fill(AppColor.brandGradient)
            Text("A")
                .font(.system(size: size * 0.42, weight: .bold))
                .foregroundStyle(.white)
                .offset(y: size * 0.04)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

private struct BrandTriangle: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.minY + rect.height * 0.08))
        path.addLine(to: CGPoint(x: rect.maxX - rect.width * 0.06, y: rect.maxY - rect.height * 0.06))
        path.addLine(to: CGPoint(x: rect.minX + rect.width * 0.06, y: rect.maxY - rect.height * 0.06))
        path.closeSubpath()
        return path
    }
}

struct BrandLockup: View {
    var language: String

    var body: some View {
        HStack(spacing: 10) {
            BrandMark()
            VStack(alignment: .leading, spacing: 1) {
                Text("AdPilot")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(AppColor.foreground)
                Text(Copy.text("Your AI Advertising Agency", "وكالتك الإعلانية بالذكاء الاصطناعي", language: language))
                    .font(AppFont.caption)
                    .foregroundStyle(AppColor.mutedForeground)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

enum Copy {
    static func text(_ en: String, _ ar: String, language: String) -> String {
        language == "ar" ? ar : en
    }
}
