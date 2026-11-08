import SwiftUI

@main
struct AdPilotApp: App {
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .environment(\.layoutDirection, model.language == "ar" ? .rightToLeft : .leftToRight)
                .preferredColorScheme(.dark)
                .tint(AdColor.gold)
                .background(AdColor.ink)
                .task { await model.restore() }
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        Group {
            if model.customer == nil {
                AuthView()
            } else {
                MainTabs()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AdColor.ink.ignoresSafeArea())
        .alert("AdPilot", isPresented: errorShown) {
            Button("OK", role: .cancel) { model.errorMessage = nil }
        } message: {
            Text(model.errorMessage ?? "")
        }
    }

    private var errorShown: Binding<Bool> {
        Binding(
            get: { model.errorMessage != nil },
            set: { if !$0 { model.errorMessage = nil } }
        )
    }
}

struct MainTabs: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        TabView(selection: $model.tab) {
            HomeView().tag(0).tabItem { Label(Copy.text("Home", "الرئيسية", language: model.language), systemImage: "house") }
            CreateAdView().tag(1).tabItem { Label(Copy.text("Create", "إنشاء", language: model.language), systemImage: "plus.circle") }
            AdsView().tag(2).tabItem { Label(Copy.text("My Ads", "إعلاناتي", language: model.language), systemImage: "photo.on.rectangle") }
            BusinessTab().tag(3).tabItem { Label(Copy.text("Business", "العمل", language: model.language), systemImage: "building.2") }
            AccountView().tag(4).tabItem { Label(Copy.text("Account", "الحساب", language: model.language), systemImage: "person") }
        }
    }
}
