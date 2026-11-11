import SwiftUI

enum AppColor {
    static let background = Color("Background")
    static let foreground = Color("Foreground")
    static let card = Color("Card")
    static let muted = Color("Muted")
    static let mutedForeground = Color("MutedForeground")
    static let border = Color("Border")
    static let input = Color("Input")
    static let primary = Color("Primary")
    static let primaryForeground = Color("PrimaryForeground")
    static let secondary = Color("Secondary")
    static let destructive = Color("Destructive")
    static let accent = Color("BrandAccent")
    static let ring = Color("Ring")

    static let brandGradient = LinearGradient(
        colors: [
            Color(red: 0.45, green: 0.32, blue: 0.98),
            Color(red: 0.62, green: 0.35, blue: 0.96),
        ],
        startPoint: .leading,
        endPoint: .trailing
    )

    static let heroGradient = LinearGradient(
        colors: [
            Color(red: 0.28, green: 0.18, blue: 0.62),
            Color(red: 0.45, green: 0.22, blue: 0.72),
            Color(red: 0.20, green: 0.16, blue: 0.42),
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}
