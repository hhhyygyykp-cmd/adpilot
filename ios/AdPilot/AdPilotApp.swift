import SwiftUI

@main
struct AdPilotApp: App {
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .environment(\.layoutDirection, model.language == "ar" ? .rightToLeft : .leftToRight)
                .tint(AppColor.primary)
                .preferredColorScheme(.dark)
                .background(AppColor.background)
                .task { await model.restore() }
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var model: AppModel
    @State private var toastText: String?

    var body: some View {
        Group {
            if model.customer == nil {
                AuthView()
            } else {
                MainTabs()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppColor.background.ignoresSafeArea())
        .overlay(alignment: .top) {
            if let toastText, model.customer != nil, model.tab != 4 {
                AppToast(message: toastText) {
                    self.toastText = nil
                    model.errorMessage = nil
                }
                .padding(.horizontal, AppSpacing.md)
                .padding(.top, AppSpacing.sm)
            }
        }
        .onChange(of: model.errorMessage) { _, newValue in
            guard let newValue, !newValue.isEmpty else {
                toastText = nil
                return
            }
            if model.customer == nil || model.tab == 4 {
                toastText = nil
                return
            }
            Keyboard.dismiss()
            toastText = newValue
        }
    }
}

struct MainTabs: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        TabView(selection: tab) {
            HomeView().tag(0).tabItem { Label(Copy.text("Home", "الرئيسية", language: model.language), systemImage: "house") }
            CreateAdView().tag(1).tabItem { Label(Copy.text("Create", "إنشاء", language: model.language), systemImage: "plus.circle") }
            AdsView().tag(2).tabItem { Label(Copy.text("My Ads", "إعلاناتي", language: model.language), systemImage: "photo.on.rectangle") }
            BusinessTab().tag(3).tabItem { Label(Copy.text("Business", "العمل", language: model.language), systemImage: "building.2") }
            AccountView().tag(4).tabItem { Label(Copy.text("Account", "الحساب", language: model.language), systemImage: "person") }
        }
        .toolbarBackground(AppColor.background, for: .tabBar)
        .toolbarBackground(.visible, for: .tabBar)
    }

    private var tab: Binding<Int> {
        Binding(
            get: { model.tab },
            set: { newValue in
                Keyboard.dismiss()
                model.tab = newValue
            }
        )
    }
}
