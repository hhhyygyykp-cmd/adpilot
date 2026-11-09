import SwiftUI

enum AppBadgeTone {
    case neutral
    case accent
    case positive
}

struct AppBadge: View {
    let title: String
    var tone: AppBadgeTone = .neutral

    var body: some View {
        Text(title)
            .font(AppFont.caption)
            .foregroundStyle(foreground)
            .padding(.horizontal, AppSpacing.sm)
            .padding(.vertical, AppSpacing.xxs)
            .background(background)
            .clipShape(Capsule())
            .overlay(Capsule().stroke(border, lineWidth: 1))
            .accessibilityLabel(title)
    }

    private var foreground: Color {
        switch tone {
        case .neutral: return AppColor.mutedForeground
        case .accent, .positive: return AppColor.primaryForeground
        }
    }

    private var background: Color {
        switch tone {
        case .neutral: return AppColor.muted
        case .accent: return AppColor.accent
        case .positive: return AppColor.primary
        }
    }

    private var border: Color {
        switch tone {
        case .neutral: return AppColor.border
        case .accent, .positive: return .clear
        }
    }
}

#Preview("Badges") {
    HStack {
        AppBadge(title: "In conversation")
        AppBadge(title: "Brief ready", tone: .accent)
        AppBadge(title: "Confirmed", tone: .positive)
    }
    .padding(AppSpacing.lg)
}

#Preview("Dark") {
    AppBadge(title: "Active", tone: .accent)
        .padding(AppSpacing.lg)
        .background(AppColor.background)
        .preferredColorScheme(.dark)
}

#Preview("Large text") {
    AppBadge(title: "Brief confirmed", tone: .positive)
        .padding(AppSpacing.lg)
        .environment(\.dynamicTypeSize, .accessibility3)
}
