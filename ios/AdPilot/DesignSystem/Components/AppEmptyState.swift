import SwiftUI

struct AppEmptyState: View {
    let systemImage: String
    let message: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        VStack(spacing: AppSpacing.md) {
            Image(systemName: systemImage)
                .font(AppFont.screenTitle)
                .foregroundStyle(AppColor.accent)
                .accessibilityHidden(true)
            Text(message)
                .font(AppFont.secondary)
                .foregroundStyle(AppColor.mutedForeground)
                .multilineTextAlignment(.center)
            if let actionTitle, let action {
                AppButton(actionTitle, action: action)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(AppSpacing.xl)
        .accessibilityElement(children: .contain)
    }
}

#Preview("Empty") {
    AppEmptyState(
        systemImage: "house",
        message: "No ads yet. Start with a sentence about what you want to promote.",
        actionTitle: "Start from Home",
        action: {}
    )
}

#Preview("Dark") {
    AppEmptyState(systemImage: "building.2", message: "No businesses yet.", actionTitle: "Add", action: {})
        .padding(AppSpacing.lg)
        .background(AppColor.background)
        .preferredColorScheme(.dark)
}

#Preview("Large text") {
    AppEmptyState(systemImage: "text.bubble", message: "No saved briefs yet.", actionTitle: "Start from Home", action: {})
        .environment(\.dynamicTypeSize, .accessibility3)
}
