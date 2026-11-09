import SwiftUI
import UIKit

enum Keyboard {
    static func dismiss() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }
}

enum AppHaptic {
    static func notify(success: Bool) {
        UINotificationFeedbackGenerator().notificationOccurred(success ? .success : .error)
    }
}

enum Copy {
    static func text(_ en: String, _ ar: String, language: String) -> String {
        language == "ar" ? ar : en
    }
}
