import SwiftUI

enum AppShadowStyle {
    case subtle
    case card
    case elevated
}

extension View {
    @ViewBuilder
    func appShadow(_ style: AppShadowStyle) -> some View {
        modifier(AppShadowModifier(style: style))
    }
}

private struct AppShadowModifier: ViewModifier {
    @Environment(\.colorScheme) private var colorScheme
    let style: AppShadowStyle

    func body(content: Content) -> some View {
        content.shadow(color: color, radius: radius, x: 0, y: yOffset)
    }

    private var color: Color {
        guard colorScheme == .light else { return .clear }
        switch style {
        case .subtle: return .black.opacity(0.04)
        case .card: return .black.opacity(0.06)
        case .elevated: return .black.opacity(0.12)
        }
    }

    private var radius: CGFloat {
        switch style {
        case .subtle: return 2
        case .card: return 8
        case .elevated: return 16
        }
    }

    private var yOffset: CGFloat {
        switch style {
        case .subtle: return 1
        case .card: return 2
        case .elevated: return 6
        }
    }
}
