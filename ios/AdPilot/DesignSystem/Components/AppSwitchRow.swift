import SwiftUI

struct AppSwitchRow: View {
    let title: String
    var subtitle: String?
    @Binding var isOn: Bool

    var body: some View {
        Toggle(isOn: $isOn) {
            VStack(alignment: .leading, spacing: AppSpacing.xxs) {
                Text(title)
                    .font(AppFont.body)
                    .foregroundStyle(AppColor.foreground)
                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(AppFont.caption)
                        .foregroundStyle(AppColor.mutedForeground)
                }
            }
        }
        .tint(AppColor.primary)
        .padding(AppSpacing.md)
        .frame(minHeight: 44)
        .background(AppColor.muted)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.button, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.button, style: .continuous)
                .stroke(isOn ? AppColor.ring : AppColor.border, lineWidth: isOn ? 1.5 : 1)
        )
    }
}

#Preview("Off") {
    PreviewSwitch(startOn: false)
        .padding(AppSpacing.lg)
}

#Preview("On, dark") {
    PreviewSwitch(startOn: true)
        .padding(AppSpacing.lg)
        .background(AppColor.background)
        .preferredColorScheme(.dark)
}

#Preview("Large text") {
    PreviewSwitch(startOn: false)
        .padding(AppSpacing.lg)
        .environment(\.dynamicTypeSize, .accessibility3)
}

private struct PreviewSwitch: View {
    @State private var isOn: Bool
    init(startOn: Bool) { _isOn = State(initialValue: startOn) }
    var body: some View {
        AppSwitchRow(
            title: "Authorize this paid generation",
            subtitle: "Paid fal.ai waits until the server has FAL_KEY.",
            isOn: $isOn
        )
    }
}
