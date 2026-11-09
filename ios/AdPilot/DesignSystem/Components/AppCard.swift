import SwiftUI

struct AppCard<Header: View, Content: View, Footer: View>: View {
    private let header: Header
    private let content: Content
    private let footer: Footer

    init(
        @ViewBuilder header: () -> Header,
        @ViewBuilder content: () -> Content,
        @ViewBuilder footer: () -> Footer
    ) {
        self.header = header()
        self.content = content()
        self.footer = footer()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            if Header.self != EmptyView.self {
                header
            }
            content
            if Footer.self != EmptyView.self {
                footer
            }
        }
        .padding(AppSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppColor.card)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous)
                .stroke(AppColor.border, lineWidth: 1)
        )
        .appShadow(.card)
    }
}

extension AppCard where Header == EmptyView, Footer == EmptyView {
    init(@ViewBuilder content: () -> Content) {
        self.init(header: { EmptyView() }, content: content, footer: { EmptyView() })
    }
}

extension AppCard where Footer == EmptyView {
    init(@ViewBuilder header: () -> Header, @ViewBuilder content: () -> Content) {
        self.init(header: header, content: content, footer: { EmptyView() })
    }
}

#Preview("Content") {
    AppCard {
        Text("Harbor Coffee")
            .font(AppFont.section)
        Text("Weekday lunch brief")
            .font(AppFont.secondary)
            .foregroundStyle(AppColor.mutedForeground)
    }
    .padding(AppSpacing.lg)
}

#Preview("Header and footer") {
    AppCard {
        Text("Brief")
            .font(AppFont.fieldLabel)
    } content: {
        Text("Describe the offer.")
            .font(AppFont.body)
    } footer: {
        Text("Not sent yet")
            .font(AppFont.caption)
            .foregroundStyle(AppColor.mutedForeground)
    }
    .padding(AppSpacing.lg)
}

#Preview("Dark") {
    AppCard {
        Text("Harbor Coffee")
            .font(AppFont.section)
            .foregroundStyle(AppColor.foreground)
    }
    .padding(AppSpacing.lg)
    .background(AppColor.background)
    .preferredColorScheme(.dark)
}

#Preview("Large text") {
    AppCard {
        Text("A longer campaign title that should wrap")
            .font(AppFont.section)
    }
    .padding(AppSpacing.lg)
    .environment(\.dynamicTypeSize, .accessibility3)
}
