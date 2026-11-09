import SwiftUI

struct AppSkeleton: View {
    var rows = 3
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var dimmed = false

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            ForEach(0..<rows, id: \.self) { index in
                RoundedRectangle(cornerRadius: AppRadius.field, style: .continuous)
                    .fill(AppColor.muted)
                    .frame(maxWidth: .infinity)
                    .frame(height: index == 0 ? 28 : 44)
                    .opacity(dimmed ? 0.45 : 1)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading")
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) {
                dimmed = true
            }
        }
    }
}

#Preview("Skeleton") {
    AppSkeleton()
        .padding(AppSpacing.lg)
}

#Preview("Dark") {
    AppSkeleton(rows: 2)
        .padding(AppSpacing.lg)
        .background(AppColor.background)
        .preferredColorScheme(.dark)
}

#Preview("Large text") {
    AppSkeleton()
        .padding(AppSpacing.lg)
        .environment(\.dynamicTypeSize, .accessibility3)
}
