import SwiftUI
import UIKit

struct AppTextField: View {
    let label: String
    var placeholder = ""
    @Binding var text: String
    var isSecure = false
    var error: String?
    var hint: String?
    var isEnabled = true
    var axis: Axis = .horizontal
    var lineLimit: ClosedRange<Int>?
    var keyboardType: UIKeyboardType = .default
    var textInputAutocapitalization: TextInputAutocapitalization = .sentences
    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.xs) {
            Text(label)
                .font(AppFont.fieldLabel)
                .foregroundStyle(AppColor.foreground)
                .accessibilityHidden(true)
            field
                .font(AppFont.body)
                .foregroundStyle(AppColor.foreground)
                .padding(AppSpacing.md)
                .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                .background(AppColor.input)
                .clipShape(RoundedRectangle(cornerRadius: AppRadius.field, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: AppRadius.field, style: .continuous)
                        .stroke(borderColor, lineWidth: isFocused ? 1.5 : 1)
                )
                .focused($isFocused)
                .accessibilityLabel(label)
            if let error, !error.isEmpty {
                Text(error)
                    .font(AppFont.caption)
                    .foregroundStyle(AppColor.destructive)
                    .accessibilityLabel(error)
            } else if let hint, !hint.isEmpty {
                Text(hint)
                    .font(AppFont.caption)
                    .foregroundStyle(AppColor.mutedForeground)
            }
        }
        .opacity(isEnabled ? 1 : 0.45)
        .disabled(!isEnabled)
    }

    @ViewBuilder
    private var field: some View {
        if isSecure {
            SecureField(placeholder, text: $text)
                .textInputAutocapitalization(.never)
                .keyboardType(keyboardType)
        } else if axis == .vertical {
            TextField(placeholder, text: $text, axis: .vertical)
                .lineLimit(lineLimit ?? 3...6)
                .textInputAutocapitalization(textInputAutocapitalization)
                .keyboardType(keyboardType)
        } else {
            TextField(placeholder, text: $text)
                .textInputAutocapitalization(textInputAutocapitalization)
                .keyboardType(keyboardType)
        }
    }

    private var borderColor: Color {
        if error?.isEmpty == false { return AppColor.destructive }
        if isFocused { return AppColor.ring }
        return AppColor.border
    }
}

#Preview("Fields") {
    PreviewFields(error: nil, secure: false)
        .padding(AppSpacing.lg)
}

#Preview("Error and secure") {
    PreviewFields(error: "Enter a valid email", secure: true)
        .padding(AppSpacing.lg)
}

#Preview("Dark") {
    PreviewFields(error: "Password is too short", secure: true)
        .padding(AppSpacing.lg)
        .background(AppColor.background)
        .preferredColorScheme(.dark)
}

#Preview("Large text") {
    PreviewFields(error: nil, secure: false)
        .padding(AppSpacing.lg)
        .environment(\.dynamicTypeSize, .accessibility3)
}

private struct PreviewFields: View {
    @State private var text = "studio@adpilot.com"
    let error: String?
    let secure: Bool

    var body: some View {
        AppTextField(
            label: "Email",
            placeholder: "you@studio.com",
            text: $text,
            isSecure: secure,
            error: error,
            hint: error == nil ? "Used to sign in" : nil
        )
    }
}
