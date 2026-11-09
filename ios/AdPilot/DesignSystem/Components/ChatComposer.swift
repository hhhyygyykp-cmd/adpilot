import SwiftUI

struct ChatBubble: View {
    let text: String
    let isUser: Bool

    var body: some View {
        HStack(alignment: .top, spacing: AppSpacing.xs) {
            if isUser {
                Spacer(minLength: AppSpacing.xxl)
            }
            Text(text)
                .font(AppFont.body)
                .foregroundStyle(isUser ? AppColor.primaryForeground : AppColor.foreground)
                .padding(AppSpacing.sm)
                .background(isUser ? AppColor.primary : AppColor.card)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.button, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: AppRadius.button, style: .continuous)
                        .stroke(isUser ? Color.clear : AppColor.border, lineWidth: 1)
                )
            if !isUser {
                Spacer(minLength: AppSpacing.xxl)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

struct ChatComposer: View {
    @Binding var text: String
    let placeholder: String
    let sendTitle: String
    var skipTitle: String?
    var skipRemainingTitle: String?
    var showsSkipRemaining = false
    let onSend: () -> Void
    var onSkip: (() -> Void)?
    var onSkipRemaining: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            AppTextField(
                label: placeholder,
                text: $text,
                axis: .vertical,
                lineLimit: 2...6
            )
            AppButton(
                sendTitle,
                isEnabled: !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                action: onSend
            )
            if let skipTitle, let onSkip {
                AppButton(skipTitle, role: .ghost, action: onSkip)
            }
            if showsSkipRemaining, let skipRemainingTitle, let onSkipRemaining {
                AppButton(skipRemainingTitle, role: .outline, action: onSkipRemaining)
            }
        }
    }
}

#Preview("Bubbles") {
    VStack {
        ChatBubble(text: "What is the product?", isUser: false)
        ChatBubble(text: "A lunch special.", isUser: true)
    }
    .padding(AppSpacing.lg)
}

#Preview("Composer, dark") {
    PreviewComposer()
        .padding(AppSpacing.lg)
        .background(AppColor.background)
        .preferredColorScheme(.dark)
}

#Preview("Large text") {
    ChatBubble(text: "A longer agency question that should wrap.", isUser: false)
        .padding(AppSpacing.lg)
        .environment(\.dynamicTypeSize, .accessibility3)
}

private struct PreviewComposer: View {
    @State private var text = ""
    var body: some View {
        ChatComposer(
            text: $text,
            placeholder: "Your answer",
            sendTitle: "Send",
            skipTitle: "Skip",
            skipRemainingTitle: "Skip remaining",
            showsSkipRemaining: true,
            onSend: {},
            onSkip: {},
            onSkipRemaining: {}
        )
    }
}
