import SwiftUI

enum AppButtonRole {
    case primary
    case secondary
    case outline
    case ghost
    case destructive
}

enum AppButtonSize {
    case small
    case medium
    case large
}

enum AppButtonImageEdge {
    case leading
    case trailing
}

struct AppButton: View {
    let title: String
    var role: AppButtonRole = .primary
    var size: AppButtonSize = .large
    var isLoading = false
    var isEnabled = true
    var systemImage: String?
    var imageEdge: AppButtonImageEdge = .leading
    let action: () -> Void

    init(
        _ title: String,
        role: AppButtonRole = .primary,
        size: AppButtonSize = .large,
        isLoading: Bool = false,
        isEnabled: Bool = true,
        systemImage: String? = nil,
        imageEdge: AppButtonImageEdge = .leading,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.role = role
        self.size = size
        self.isLoading = isLoading
        self.isEnabled = isEnabled
        self.systemImage = systemImage
        self.imageEdge = imageEdge
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: AppSpacing.xs) {
                if let systemImage, imageEdge == .leading {
                    Image(systemName: systemImage)
                }
                Text(title)
                    .font(AppFont.button)
                    .multilineTextAlignment(.center)
                if isLoading {
                    ProgressView()
                        .controlSize(.small)
                }
                if let systemImage, imageEdge == .trailing {
                    Image(systemName: systemImage)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 44)
        }
        .buttonStyle(AppButtonStyle(role: role, size: size))
        .disabled(!isEnabled || isLoading)
        .accessibilityLabel(title)
        .accessibilityValue(isLoading ? Text("Loading") : Text(""))
    }
}

private struct AppButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    let role: AppButtonRole
    let size: AppButtonSize

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .padding(.horizontal, horizontalPadding)
            .foregroundStyle(foreground)
            .background {
                if role == .primary {
                    Capsule().fill(AppColor.brandGradient)
                } else {
                    Capsule().fill(background)
                }
            }
            .overlay(
                Capsule().stroke(border, lineWidth: role == .outline ? 1 : 0)
            )
            .clipShape(Capsule())
            .opacity(configuration.isPressed ? 0.82 : (isEnabled ? 1 : 0.45))
    }

    private var horizontalPadding: CGFloat {
        switch size {
        case .small: return AppSpacing.sm
        case .medium: return AppSpacing.md
        case .large: return AppSpacing.lg
        }
    }

    private var foreground: Color {
        switch role {
        case .primary: return AppColor.primaryForeground
        case .destructive: return AppColor.card
        case .secondary, .outline, .ghost: return AppColor.foreground
        }
    }

    private var background: Color {
        switch role {
        case .primary: return AppColor.primary
        case .secondary: return AppColor.secondary
        case .destructive: return AppColor.destructive
        case .outline, .ghost: return .clear
        }
    }

    private var border: Color {
        switch role {
        case .outline: return AppColor.border
        case .primary, .secondary, .destructive, .ghost: return .clear
        }
    }
}

#Preview("Variants") {
    VStack(spacing: AppSpacing.sm) {
        AppButton("Primary") {}
        AppButton("Secondary", role: .secondary) {}
        AppButton("Outline", role: .outline) {}
        AppButton("Ghost", role: .ghost) {}
        AppButton("Destructive", role: .destructive) {}
    }
    .padding(AppSpacing.lg)
}

#Preview("Sizes and states") {
    VStack(spacing: AppSpacing.sm) {
        AppButton("Small", size: .small) {}
        AppButton("Medium", size: .medium) {}
        AppButton("Loading", isLoading: true) {}
        AppButton("Disabled", isEnabled: false) {}
        AppButton("With icon", systemImage: "plus") {}
    }
    .padding(AppSpacing.lg)
}

#Preview("Dark") {
    VStack(spacing: AppSpacing.sm) {
        AppButton("Primary") {}
        AppButton("Disabled", isEnabled: false) {}
    }
    .padding(AppSpacing.lg)
    .background(AppColor.background)
    .preferredColorScheme(.dark)
}

#Preview("Large text") {
    AppButton("Create advertisement") {}
        .padding(AppSpacing.lg)
        .environment(\.dynamicTypeSize, .accessibility3)
}
