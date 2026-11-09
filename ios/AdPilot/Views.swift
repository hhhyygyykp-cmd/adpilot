import SwiftUI
import UIKit

struct AuthView: View {
    @EnvironmentObject private var model: AppModel
    @State private var registering = true
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var language = "en"

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("AdPilot")
                    .font(.system(size: 42, weight: .regular, design: .serif))
                    .foregroundStyle(AdColor.cream)
                Text(Copy.text(
                    "Tell us what you want to promote. Your AI advertising agency handles the rest.",
                    "أخبرنا بما تريد الترويج له. وكالتك الإعلانية تتولى الباقي.",
                    language: language
                ))
                .foregroundStyle(AdColor.muted)
                Picker("", selection: $registering) {
                    Text(Copy.text("Create account", "حساب جديد", language: language)).tag(true)
                    Text(Copy.text("Sign in", "دخول", language: language)).tag(false)
                }
                .pickerStyle(.segmented)
                .onChange(of: registering) { _, _ in Keyboard.dismiss() }
                if registering {
                    field(Copy.text("Your name", "اسمك", language: language), text: $name)
                    Picker(Copy.text("Language", "اللغة", language: language), selection: $language) {
                        Text("English").tag("en")
                        Text("العربية").tag("ar")
                    }
                }
                field(Copy.text("Email", "البريد", language: language), text: $email)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                SecureField(Copy.text("Password", "كلمة المرور", language: language), text: $password)
                    .padding(14)
                    .background(AdColor.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                GoldButton(
                    title: registering
                        ? Copy.text("Create account", "إنشاء الحساب", language: language)
                        : Copy.text("Sign in", "تسجيل الدخول", language: language),
                    enabled: !model.busy && email.contains("@") && password.count >= 8 && (!registering || name.count >= 2)
                ) {
                    Keyboard.dismiss()
                    Task {
                        if registering {
                            await model.register(name: name, email: email, password: password, language: language)
                        } else {
                            await model.login(email: email, password: password)
                        }
                    }
                }
            }
            .padding(24)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private func field(_ title: String, text: Binding<String>) -> some View {
        TextField(title, text: text)
            .padding(14)
            .background(AdColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

struct HomeView: View {
    @EnvironmentObject private var model: AppModel
    @State private var prompt = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text(model.activeBusiness.map {
                        Copy.text("Advertising for", "الإعلان لـ", language: model.language) + " " + $0.name
                    } ?? Copy.text("Add a business first", "أضف عملاً أولاً", language: model.language))
                    .font(.caption)
                    .foregroundStyle(AdColor.gold)
                    Text(Copy.text(
                        "What would you like to advertise today?",
                        "ماذا تريد أن تعلن اليوم؟",
                        language: model.language
                    ))
                    .font(.system(size: 34, weight: .regular, design: .serif))
                    .foregroundStyle(AdColor.cream)
                    if model.activeBusiness == nil {
                        GoldButton(title: Copy.text("Add a business", "أضف عملاً", language: model.language)) {
                            Keyboard.dismiss()
                            model.tab = 3
                        }
                    } else {
                        Panel {
                            TextField(Copy.text(
                                "Describe the product, offer, and goal…",
                                "صف المنتج والعرض والهدف…",
                                language: model.language
                            ), text: $prompt, axis: .vertical)
                            .lineLimit(4...8)
                        }
                        GoldButton(
                            title: Copy.text("Create Advertisement", "أنشئ الإعلان", language: model.language),
                            enabled: prompt.trimmingCharacters(in: .whitespacesAndNewlines).count >= 3 && !model.busy
                        ) {
                            Keyboard.dismiss()
                            let text = prompt
                            prompt = ""
                            Task {
                                await model.startCampaign(prompt: text, businessId: model.activeBusiness!.id)
                            }
                        }
                    }
                    Text(Copy.text("Recent briefs", "آخر الطلبات", language: model.language))
                        .font(.caption)
                        .foregroundStyle(AdColor.muted)
                    if model.campaigns.isEmpty {
                        Text(Copy.text(
                            "No ads yet. Start with a sentence about what you want to promote.",
                            "لا إعلانات بعد. ابدأ بجملة عما تريد الترويج له.",
                            language: model.language
                        ))
                        .foregroundStyle(AdColor.muted)
                    } else {
                        ForEach(Array(model.campaigns.prefix(6))) { item in
                            Button {
                                Task { await model.openCampaign(item.id) }
                            } label: {
                                Panel {
                                    Text(item.title).foregroundStyle(AdColor.cream)
                                    Text(item.businessName ?? "").font(.caption).foregroundStyle(AdColor.muted)
                                }
                            }
                        }
                    }
                }
                .padding(20)
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("AdPilot")
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
    }
}

struct CreateAdView: View {
    @EnvironmentObject private var model: AppModel
    @State private var draft = ""
    @State private var authorize = false

    var body: some View {
        NavigationStack {
            ScrollView {
                if let campaign = model.campaign {
                    VStack(alignment: .leading, spacing: 14) {
                        Text(campaign.title)
                            .font(.system(size: 28, weight: .regular, design: .serif))
                        ForEach(campaign.conversation) { message in
                            HStack {
                                if message.role == "customer" { Spacer(minLength: 40) }
                                Text(message.text)
                                    .padding(12)
                                    .background(message.role == "customer" ? AdColor.gold.opacity(0.2) : AdColor.surface)
                                    .clipShape(RoundedRectangle(cornerRadius: 16))
                                if message.role != "customer" { Spacer(minLength: 40) }
                            }
                        }
                        if campaign.status == "drafting" {
                            TextField(Copy.text("Type your answer…", "اكتب إجابتك…", language: model.language), text: $draft, axis: .vertical)
                                .padding(12)
                                .background(AdColor.surface)
                                .clipShape(RoundedRectangle(cornerRadius: 16))
                            GoldButton(title: Copy.text("Send", "إرسال", language: model.language), enabled: !draft.trimmingCharacters(in: .whitespaces).isEmpty) {
                                Keyboard.dismiss()
                                let text = draft
                                draft = ""
                                Task { await model.sendCampaign(text: text) }
                            }
                            Button(Copy.text("Skip", "تخطَّ", language: model.language)) {
                                Task { await model.sendCampaign(skip: true) }
                            }
                            .foregroundStyle(AdColor.muted)
                            if campaign.productName != nil && campaign.objective != nil {
                                Button(Copy.text("Skip remaining", "تخطَّ الباقي", language: model.language)) {
                                    Task { await model.sendCampaign(skipRemaining: true) }
                                }
                                .foregroundStyle(AdColor.gold)
                            }
                        }
                        if let set = campaign.conceptSet, campaign.status != "drafting" {
                            Text(set.recommendationReason)
                                .font(.subheadline)
                                .foregroundStyle(AdColor.muted)
                            ForEach(set.concepts) { concept in
                                Button {
                                    Task { await model.chooseConcept(id: concept.id, recommended: false) }
                                } label: {
                                    Panel {
                                        Text(concept.title).font(.headline).foregroundStyle(AdColor.cream)
                                        Text(concept.hook).foregroundStyle(AdColor.cream)
                                        Text(concept.coreMessage).font(.caption).foregroundStyle(AdColor.muted)
                                        if set.selectedId == concept.id {
                                            Text(Copy.text("Selected", "مختار", language: model.language))
                                                .font(.caption)
                                                .foregroundStyle(AdColor.gold)
                                        }
                                    }
                                }
                            }
                            GoldButton(title: Copy.text("Use recommended", "استخدم المقترح", language: model.language)) {
                                Task { await model.chooseConcept(id: nil, recommended: true) }
                            }
                        }
                        if campaign.status == "brief_ready" {
                            GoldButton(title: Copy.text("Confirm brief and concept", "أكّد الملخص والاتجاه", language: model.language), enabled: campaign.conceptSet?.selectedId != nil) {
                                Task { await model.confirmCampaign() }
                            }
                        }
                        if campaign.status == "confirmed", let quote = campaign.mediaQuote {
                            Panel {
                                Text(Copy.text("Estimate", "التقدير", language: model.language))
                                    .font(.caption)
                                    .foregroundStyle(AdColor.gold)
                                Text(String(format: "$%.3f", quote.totalUsd))
                                    .font(.title2)
                                if let still = quote.still {
                                    Text("\(still.label) · \(String(format: "$%.3f", still.usd))")
                                        .font(.caption)
                                        .foregroundStyle(AdColor.muted)
                                }
                                if quote.waitingForKey {
                                    Text(Copy.text(
                                        "Paid fal.ai waits until the server has FAL_KEY. A free still is available without authorization.",
                                        "الصور المدفوعة تنتظر مفتاح fal على الخادم. الصورة المجانية متاحة بدون تفويض.",
                                        language: model.language
                                    ))
                                    .font(.caption)
                                    .foregroundStyle(AdColor.muted)
                                }
                                Toggle(Copy.text("Authorize this paid generation", "أفوض هذا التوليد المدفوع", language: model.language), isOn: $authorize)
                            }
                            GoldButton(
                                title: authorize
                                    ? Copy.text("Generate paid ad", "ولّد الإعلان المدفوع", language: model.language)
                                    : Copy.text("Generate free still", "ولّد صورة مجانية", language: model.language),
                                enabled: !model.busy
                            ) {
                                Task { await model.generate(authorizePaid: authorize) }
                            }
                        }
                        if !campaign.generationNote.isEmpty {
                            Text(campaign.generationNote)
                                .font(.footnote)
                                .foregroundStyle(AdColor.muted)
                        }
                        ForEach(campaign.creatives) { creative in
                            if creative.kind == "image" {
                                CreativeImage(id: creative.id)
                                Text(creative.note).font(.caption2).foregroundStyle(AdColor.muted)
                            } else {
                                Text(creative.note).font(.caption).foregroundStyle(AdColor.cream)
                            }
                        }
                    }
                    .padding(20)
                } else {
                    VStack(alignment: .leading, spacing: 12) {
                        Text(Copy.text("Create Ad", "إنشاء إعلان", language: model.language))
                            .font(.system(size: 32, weight: .regular, design: .serif))
                        Text(Copy.text(
                            "Start from Home with a sentence about what you want to promote.",
                            "ابدأ من الرئيسية بجملة عما تريد الترويج له.",
                            language: model.language
                        ))
                        .foregroundStyle(AdColor.muted)
                        GoldButton(title: Copy.text("Go to Home", "إلى الرئيسية", language: model.language)) {
                            Keyboard.dismiss()
                            model.tab = 0
                        }
                    }
                    .padding(20)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(Copy.text("Create Ad", "إنشاء إعلان", language: model.language))
        }
    }
}

struct CreativeImage: View {
    @EnvironmentObject private var model: AppModel
    let id: String
    @State private var image: UIImage?
    @State private var shareFile: URL?
    @State private var failed = false

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                if let file = shareFile {
                    ShareLink(item: file) {
                        Text(Copy.text("Share", "مشاركة", language: model.language))
                    }
                }
            } else if failed {
                Text(Copy.text("Image could not be loaded", "تعذر تحميل الصورة", language: model.language))
                    .foregroundStyle(AdColor.danger)
            } else {
                ProgressView()
            }
        }
        .task(id: id) {
            do {
                let data = try await model.creativeData(id)
                image = UIImage(data: data)
                failed = image == nil
                if image != nil {
                    let url = FileManager.default.temporaryDirectory.appendingPathComponent("adpilot-\(id).jpg")
                    try? data.write(to: url)
                    shareFile = url
                }
            } catch {
                failed = true
            }
        }
    }
}

struct AdsView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        NavigationStack {
            List(model.campaigns) { item in
                Button {
                    Task { await model.openCampaign(item.id) }
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.title).foregroundStyle(AdColor.cream)
                        Text(status(item.status)).font(.caption).foregroundStyle(AdColor.gold)
                    }
                }
                .listRowBackground(AdColor.surface)
            }
            .scrollContentBackground(.hidden)
            .navigationTitle(Copy.text("My Ads", "إعلاناتي", language: model.language))
            .overlay {
                if model.campaigns.isEmpty {
                    Text(Copy.text("No saved briefs yet.", "لا ملخصات محفوظة بعد.", language: model.language))
                        .foregroundStyle(AdColor.muted)
                }
            }
            .task { await model.refreshLists() }
        }
    }

    private func status(_ value: String) -> String {
        switch value {
        case "drafting": return Copy.text("In conversation", "في المحادثة", language: model.language)
        case "brief_ready": return Copy.text("Brief ready", "الملخص جاهز", language: model.language)
        case "confirmed": return Copy.text("Brief confirmed", "تم التأكيد", language: model.language)
        default: return value
        }
    }
}

struct BusinessTab: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        NavigationStack {
            List {
                ForEach(model.businesses) { business in
                    NavigationLink {
                        BusinessChat(businessId: business.id)
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(business.name.isEmpty ? Copy.text("New business", "عمل جديد", language: model.language) : business.name)
                                .foregroundStyle(AdColor.cream)
                            if business.isActive {
                                Text(Copy.text("Active", "نشط", language: model.language))
                                    .font(.caption)
                                    .foregroundStyle(AdColor.gold)
                            }
                        }
                    }
                    .listRowBackground(AdColor.surface)
                }
            }
            .scrollContentBackground(.hidden)
            .navigationTitle(Copy.text("My Business", "أعمالي", language: model.language))
            .toolbar {
                Button(Copy.text("Add", "إضافة", language: model.language)) {
                    Task { _ = await model.startBusiness() }
                }
            }
            .overlay {
                if model.businesses.isEmpty {
                    Text(Copy.text("No businesses yet.", "لا أعمال بعد.", language: model.language))
                        .foregroundStyle(AdColor.muted)
                }
            }
            .task { await model.refreshLists() }
        }
    }
}

struct BusinessChat: View {
    @EnvironmentObject private var model: AppModel
    let businessId: String
    @State private var business: Business?
    @State private var draft = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if let business {
                    Text(business.name.isEmpty ? Copy.text("New business", "عمل جديد", language: model.language) : business.name)
                        .font(.title.weight(.regular))
                    if !business.isActive {
                        GoldButton(title: Copy.text("Use for ads", "استخدمه للإعلانات", language: model.language)) {
                            Task {
                                await model.activateBusiness(business.id)
                                await reload()
                            }
                        }
                    }
                    ForEach(business.onboardingState.messages) { message in
                        Text(message.text)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: message.role == "customer" ? .trailing : .leading)
                            .background(AdColor.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                    }
                    if !business.onboardingComplete {
                        TextField(Copy.text("Your answer", "إجابتك", language: model.language), text: $draft, axis: .vertical)
                            .padding(12)
                            .background(AdColor.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                        GoldButton(title: Copy.text("Send", "إرسال", language: model.language), enabled: !draft.trimmingCharacters(in: .whitespaces).isEmpty) {
                            Keyboard.dismiss()
                            let text = draft
                            draft = ""
                            Task { await send(text: text) }
                        }
                        if !business.name.isEmpty {
                            Button(Copy.text("Skip remaining", "تخطَّ الباقي", language: model.language)) {
                                Task { await send(skipRemaining: true) }
                            }
                            .foregroundStyle(AdColor.gold)
                        }
                    }
                } else {
                    ProgressView()
                }
            }
            .padding(20)
        }
        .scrollDismissesKeyboard(.interactively)
        .task { await reload() }
    }

    private func reload() async {
        business = model.businesses.first { $0.id == businessId }
        if business == nil { await model.refreshLists() }
        business = model.businesses.first { $0.id == businessId }
    }

    private func send(text: String? = nil, skipRemaining: Bool = false) async {
        business = await model.sendBusiness(businessId, text: text, skipRemaining: skipRemaining)
    }
}

struct AccountView: View {
    @EnvironmentObject private var model: AppModel
    @State private var name = ""
    @State private var currentPassword = ""
    @State private var newPassword = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text(model.customer?.email ?? "")
                        .foregroundStyle(AdColor.muted)
                    TextField(Copy.text("Your name", "اسمك", language: model.language), text: $name)
                        .padding(14)
                        .background(AdColor.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                    GoldButton(title: Copy.text("Save name", "احفظ الاسم", language: model.language)) {
                        Task { await model.saveProfile(name: name) }
                    }
                    Picker(Copy.text("Language", "اللغة", language: model.language), selection: language) {
                        Text("English").tag("en")
                        Text("العربية").tag("ar")
                    }
                    SecureField(Copy.text("Current password", "كلمة المرور الحالية", language: model.language), text: $currentPassword)
                        .padding(14)
                        .background(AdColor.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                    SecureField(Copy.text("New password", "كلمة المرور الجديدة", language: model.language), text: $newPassword)
                        .padding(14)
                        .background(AdColor.surface)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                    GoldButton(title: Copy.text("Change password", "غيّر كلمة المرور", language: model.language), enabled: newPassword.count >= 8) {
                        Task {
                            await model.changePassword(current: currentPassword, new: newPassword)
                            currentPassword = ""
                            newPassword = ""
                        }
                    }
                    Button(Copy.text("Sign out", "تسجيل الخروج", language: model.language)) {
                        Task { await model.logout() }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .foregroundStyle(AdColor.muted)
                    Text(Copy.text(
                        "Instagram and Facebook publishing, and live ad analytics, are not in this version.",
                        "نشر إنستغرام وفيسبوك وتحليلات الإعلانات المباشرة ليست في هذا الإصدار.",
                        language: model.language
                    ))
                    .font(.caption)
                    .foregroundStyle(AdColor.muted)
                }
                .padding(20)
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(Copy.text("Account", "الحساب", language: model.language))
            .onAppear { name = model.customer?.name ?? "" }
        }
    }

    private var language: Binding<String> {
        Binding(
            get: { model.language },
            set: { value in Task { await model.saveLanguage(value) } }
        )
    }
}
