import SwiftUI

struct AppToast: View {
    let message: String
    var onDismiss: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: AppSpacing.sm) {
            Image(systemName: "exclamationmark.circle")
                .foregroundStyle(AppColor.destructive)
                .accessibilityHidden(true)
            Text(message)
                .font(AppFont.secondary)
                .foregroundStyle(AppColor.foreground)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .frame(minWidth: 44, minHeight: 44)
            }
            .accessibilityLabel("Dismiss")
        }
        .padding(.leading, AppSpacing.md)
        .padding(.vertical, AppSpacing.xs)
        .background(AppColor.card)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.button, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.button, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        )
        .appShadow(.elevated)
        .accessibilityElement(children: .combine)
        .onAppear {
            UIAccessibility.post(notification: .announcement, argument: message)
        }
        .task {
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            onDismiss()
        }
    }
}

#Preview("Toast") {
    AppToast(message: "The server could not save that change.") {}
        .padding(AppSpacing.lg)
}

#Preview("Dark") {
    AppToast(message: "The server could not save that change.") {}
        .padding(AppSpacing.lg)
        .background(AppColor.background)
        .preferredColorScheme(.dark)
}

#Preview("Large text") {
    AppToast(message: "A longer message that should wrap onto more than one line.") {}
        .padding(AppSpacing.lg)
        .environment(\.dynamicTypeSize, .accessibility3)
}
