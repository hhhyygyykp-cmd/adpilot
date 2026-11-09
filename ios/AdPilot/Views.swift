import AVKit
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
        let canSubmit = !model.busy && email.contains("@") && password.count >= 8 && (!registering || name.count >= 2)
        return ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.lg) {
                Text("AdPilot")
                    .font(AppFont.largeTitle)
                    .foregroundStyle(AppColor.foreground)
                Text(Copy.text(
                    "Tell us what you want to promote. Your AI advertising agency handles the rest.",
                    "أخبرنا بما تريد الترويج له. وكالتك الإعلانية تتولى الباقي.",
                    language: language
                ))
                .font(AppFont.secondary)
                .foregroundStyle(AppColor.mutedForeground)
                Picker("", selection: $registering) {
                    Text(Copy.text("Create account", "حساب جديد", language: language)).tag(true)
                    Text(Copy.text("Sign in", "دخول", language: language)).tag(false)
                }
                .pickerStyle(.segmented)
                .accessibilityLabel(Copy.text("Account mode", "نوع الحساب", language: language))
                .onChange(of: registering) { _, _ in Keyboard.dismiss() }
                if registering {
                    AppTextField(
                        label: Copy.text("Your name", "اسمك", language: language),
                        text: $name
                    )
                    Picker(Copy.text("Language", "اللغة", language: language), selection: $language) {
                        Text("English").tag("en")
                        Text("العربية").tag("ar")
                    }
                }
                AppTextField(
                    label: Copy.text("Email", "البريد", language: language),
                    text: $email,
                    keyboardType: .emailAddress,
                    textInputAutocapitalization: .never
                )
                AppTextField(
                    label: Copy.text("Password", "كلمة المرور", language: language),
                    text: $password,
                    isSecure: true
                )
                if let error = model.errorMessage, !error.isEmpty {
                    Text(error)
                        .font(AppFont.caption)
                        .foregroundStyle(AppColor.destructive)
                        .accessibilityLabel(error)
                }
                AppButton(
                    registering
                        ? Copy.text("Create account", "إنشاء الحساب", language: language)
                        : Copy.text("Sign in", "تسجيل الدخول", language: language),
                    isLoading: model.busy,
                    isEnabled: canSubmit
                ) {
                    Keyboard.dismiss()
                    model.errorMessage = nil
                    Task {
                        if registering {
                            await model.register(name: name, email: email, password: password, language: language)
                        } else {
                            await model.login(email: email, password: password)
                        }
                    }
                }
            }
            .padding(AppSpacing.xl)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(AppColor.background)
    }
}

struct HomeView: View {
    @EnvironmentObject private var model: AppModel
    @State private var prompt = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: AppSpacing.lg) {
                    Text(model.activeBusiness.map {
                        Copy.text("Advertising for", "الإعلان لـ", language: model.language) + " " + $0.name
                    } ?? Copy.text("Add a business first", "أضف عملاً أولاً", language: model.language))
                    .font(AppFont.caption)
                    .foregroundStyle(AppColor.accent)
                    Text(Copy.text(
                        "What would you like to advertise today?",
                        "ماذا تريد أن تعلن اليوم؟",
                        language: model.language
                    ))
                    .font(AppFont.largeTitle)
                    .foregroundStyle(AppColor.foreground)
                    if model.activeBusiness == nil {
                        AppButton(Copy.text("Add a business", "أضف عملاً", language: model.language)) {
                            Keyboard.dismiss()
                            model.tab = 3
                        }
                    } else {
                        AppTextField(
                            label: Copy.text("Brief", "الطلب", language: model.language),
                            placeholder: Copy.text(
                                "Describe the product, offer, and goal…",
                                "صف المنتج والعرض والهدف…",
                                language: model.language
                            ),
                            text: $prompt,
                            axis: .vertical,
                            lineLimit: 4...8
                        )
                        AppButton(
                            Copy.text("Create Advertisement", "أنشئ الإعلان", language: model.language),
                            isLoading: model.busy,
                            isEnabled: prompt.trimmingCharacters(in: .whitespacesAndNewlines).count >= 3 && !model.busy
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
                        .font(AppFont.caption)
                        .foregroundStyle(AppColor.mutedForeground)
                    if model.busy && model.campaigns.isEmpty {
                        AppSkeleton(rows: 2)
                    } else if model.campaigns.isEmpty {
                        AppEmptyState(
                            systemImage: "text.bubble",
                            message: Copy.text(
                                "No ads yet. Start with a sentence about what you want to promote.",
                                "لا إعلانات بعد. ابدأ بجملة عما تريد الترويج له.",
                                language: model.language
                            )
                        )
                    } else {
                        ForEach(Array(model.campaigns.prefix(6))) { item in
                            Button {
                                Task { await model.openCampaign(item.id) }
                            } label: {
                                AppCard {
                                    Text(item.title)
                                        .font(AppFont.body)
                                        .foregroundStyle(AppColor.foreground)
                                    Text(item.businessName ?? "")
                                        .font(AppFont.caption)
                                        .foregroundStyle(AppColor.mutedForeground)
                                }
                            }
                            .accessibilityHint(Copy.text("Opens this brief", "يفتح هذا الطلب", language: model.language))
                        }
                    }
                }
                .padding(AppSpacing.lg)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(AppColor.background)
            .navigationTitle("AdPilot")
        }
    }
}

struct CreateAdView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var draft = ""
    @State private var authorize = false

    var body: some View {
        let motion: Animation? = reduceMotion ? nil : .spring(response: 0.45, dampingFraction: 0.86)
        let stillCount = model.campaign?.creatives.filter { $0.kind == "image" }.count ?? 0
        return NavigationStack {
            ScrollView {
                if let campaign = model.campaign {
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        Text(campaign.title)
                            .font(AppFont.screenTitle)
                            .foregroundStyle(AppColor.foreground)
                        ForEach(campaign.conversation) { message in
                            ChatBubble(text: message.text, isUser: message.role == "customer")
                        }
                        if campaign.status == "drafting" {
                            ChatComposer(
                                text: $draft,
                                placeholder: Copy.text("Type your answer…", "اكتب إجابتك…", language: model.language),
                                sendTitle: Copy.text("Send", "إرسال", language: model.language),
                                skipTitle: Copy.text("Skip", "تخطَّ", language: model.language),
                                skipRemainingTitle: Copy.text("Skip remaining", "تخطَّ الباقي", language: model.language),
                                showsSkipRemaining: campaign.productName != nil && campaign.objective != nil,
                                onSend: {
                                    Keyboard.dismiss()
                                    let text = draft
                                    draft = ""
                                    Task {
                                        model.errorMessage = nil
                                        await model.sendCampaign(text: text)
                                        AppHaptic.notify(success: model.errorMessage == nil)
                                    }
                                },
                                onSkip: {
                                    Task {
                                        model.errorMessage = nil
                                        await model.sendCampaign(skip: true)
                                        AppHaptic.notify(success: model.errorMessage == nil)
                                    }
                                },
                                onSkipRemaining: {
                                    Task {
                                        model.errorMessage = nil
                                        await model.sendCampaign(skipRemaining: true)
                                        AppHaptic.notify(success: model.errorMessage == nil)
                                    }
                                }
                            )
                        }
                        if let set = campaign.conceptSet, campaign.status != "drafting" {
                            Text(set.recommendationReason)
                                .font(AppFont.secondary)
                                .foregroundStyle(AppColor.mutedForeground)
                            ForEach(set.concepts) { concept in
                                Button {
                                    Task { await model.chooseConcept(id: concept.id, recommended: false) }
                                } label: {
                                    AppCard {
                                        Text(concept.title)
                                            .font(AppFont.section)
                                            .foregroundStyle(AppColor.foreground)
                                        Text(concept.hook)
                                            .font(AppFont.body)
                                            .foregroundStyle(AppColor.foreground)
                                        if !concept.headline.isEmpty {
                                            Text(concept.headline)
                                                .font(AppFont.section)
                                                .foregroundStyle(AppColor.accent)
                                        }
                                        Text(concept.supportingCopy.isEmpty ? concept.coreMessage : concept.supportingCopy)
                                            .font(AppFont.caption)
                                            .foregroundStyle(AppColor.mutedForeground)
                                        if set.selectedId == concept.id {
                                            AppBadge(
                                                title: Copy.text("Selected", "مختار", language: model.language),
                                                tone: .positive
                                            )
                                        }
                                    }
                                }
                                .accessibilityHint(Copy.text("Selects this concept", "يختار هذا الاتجاه", language: model.language))
                            }
                            .animation(motion, value: set.concepts.map(\.id))
                            AppButton(Copy.text("Use recommended", "استخدم المقترح", language: model.language), role: .secondary) {
                                Task { await model.chooseConcept(id: nil, recommended: true) }
                            }
                            .accessibilityHint(Copy.text("Uses the recommended concept", "يستخدم الاتجاه المقترح", language: model.language))
                        }
                        if campaign.status == "brief_ready" {
                            AppButton(
                                Copy.text("Confirm brief and concept", "أكّد الملخص والاتجاه", language: model.language),
                                isEnabled: campaign.conceptSet?.selectedId != nil
                            ) {
                                Task {
                                    model.errorMessage = nil
                                    await model.confirmCampaign()
                                    AppHaptic.notify(success: model.errorMessage == nil)
                                }
                            }
                        }
                        ForEach(campaign.creatives.filter { $0.kind == "video" }) { creative in
                            CreativeVideo(id: creative.id)
                            Text(creative.note)
                                .font(AppFont.caption)
                                .foregroundStyle(AppColor.mutedForeground)
                        }
                        if campaign.status == "confirmed", let quote = campaign.mediaQuote {
                            let chargesVideo = quote.chargesVideo ?? (quote.video != nil)
                            let chargesStill = quote.chargesStill ?? (quote.video == nil)
                            AppCard {
                                Text(Copy.text("This tap", "هذه الضغطة", language: model.language))
                                    .font(AppFont.caption)
                                    .foregroundStyle(AppColor.accent)
                                Text(String(format: "$%.3f", quote.totalUsd))
                                    .font(AppFont.screenTitle)
                                    .foregroundStyle(AppColor.foreground)
                                if chargesVideo, let video = quote.video {
                                    Text("\(video.label) · \(video.seconds ?? 5)s · \(String(format: "$%.3f", video.usd))")
                                        .font(AppFont.caption)
                                        .foregroundStyle(AppColor.mutedForeground)
                                }
                                if chargesStill, let still = quote.still {
                                    Text("\(still.label) · \(String(format: "$%.3f", still.usd))")
                                        .font(AppFont.caption)
                                        .foregroundStyle(AppColor.mutedForeground)
                                }
                                if chargesVideo {
                                    Text(Copy.text(
                                        "The video takes a few minutes. Leave this screen open until it appears.",
                                        "الفيديو يستغرق بضع دقائق. ابق في هذه الشاشة حتى يظهر.",
                                        language: model.language
                                    ))
                                    .font(AppFont.caption)
                                    .foregroundStyle(AppColor.mutedForeground)
                                }
                                if quote.waitingForKey {
                                    Text(Copy.text(
                                        "Paid fal.ai waits until the server has FAL_KEY. A free still is available without authorization.",
                                        "الصور المدفوعة تنتظر مفتاح fal على الخادم. الصورة المجانية متاحة بدون تفويض.",
                                        language: model.language
                                    ))
                                    .font(AppFont.caption)
                                    .foregroundStyle(AppColor.mutedForeground)
                                }
                                AppSwitchRow(
                                    title: Copy.text("Authorize this paid generation", "أفوض هذا التوليد المدفوع", language: model.language),
                                    isOn: $authorize
                                )
                            }
                            AppButton(
                                authorize
                                    ? (chargesVideo && !chargesStill
                                        ? Copy.text("Generate paid video", "ولّد الفيديو المدفوع", language: model.language)
                                        : Copy.text("Generate paid ad", "ولّد الإعلان المدفوع", language: model.language))
                                    : Copy.text("Generate free still", "ولّد صورة مجانية", language: model.language),
                                role: authorize ? .primary : .outline,
                                isLoading: model.busy,
                                isEnabled: !model.busy
                            ) {
                                let paid = authorize
                                Task {
                                    model.errorMessage = nil
                                    await model.generate(authorizePaid: paid)
                                    AppHaptic.notify(success: model.errorMessage == nil)
                                }
                            }
                        }
                        if !campaign.generationNote.isEmpty {
                            Text(campaign.generationNote)
                                .font(AppFont.caption)
                                .foregroundStyle(AppColor.mutedForeground)
                        }
                        ForEach(campaign.creatives.filter { $0.kind == "image" }) { creative in
                            CreativeImage(id: creative.id)
                            Text(creative.note)
                                .font(AppFont.caption)
                                .foregroundStyle(AppColor.mutedForeground)
                        }
                        .animation(motion, value: campaign.creatives.map(\.id))
                    }
                    .padding(AppSpacing.lg)
                    .onChange(of: campaign.id) { _, _ in
                        authorize = false
                    }
                    .onChange(of: stillCount) { oldCount, newCount in
                        guard newCount > oldCount else { return }
                        UIAccessibility.post(
                            notification: .announcement,
                            argument: Copy.text("Still ready", "الصورة جاهزة", language: model.language)
                        )
                    }
                } else {
                    AppEmptyState(
                        systemImage: "plus.circle",
                        message: Copy.text(
                            "Start from Home with a sentence about what you want to promote.",
                            "ابدأ من الرئيسية بجملة عما تريد الترويج له.",
                            language: model.language
                        ),
                        actionTitle: Copy.text("Go to Home", "إلى الرئيسية", language: model.language)
                    ) {
                        Keyboard.dismiss()
                        model.tab = 0
                    }
                    .padding(AppSpacing.lg)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .background(AppColor.background)
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
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous))
                if let file = shareFile {
                    ShareLink(item: file) {
                        Text(Copy.text("Share", "مشاركة", language: model.language))
                            .font(AppFont.button)
                            .frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .accessibilityLabel(Copy.text("Share", "مشاركة", language: model.language))
                }
            } else if failed {
                Text(Copy.text("Image could not be loaded", "تعذر تحميل الصورة", language: model.language))
                    .font(AppFont.secondary)
                    .foregroundStyle(AppColor.destructive)
            } else {
                AppSkeleton(rows: 1)
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

struct CreativeVideo: View {
    @EnvironmentObject private var model: AppModel
    let id: String
    @State private var player: AVPlayer?
    @State private var shareFile: URL?
    @State private var failed = false

    var body: some View {
        Group {
            if let player {
                VideoPlayer(player: player)
                    .frame(minHeight: 220)
                    .clipShape(RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous))
                if let file = shareFile {
                    ShareLink(item: file) {
                        Text(Copy.text("Share video", "شارك الفيديو", language: model.language))
                            .font(AppFont.button)
                            .frame(maxWidth: .infinity, minHeight: 44)
                    }
                }
            } else if failed {
                Text(Copy.text("Video could not be loaded", "تعذر تحميل الفيديو", language: model.language))
                    .font(AppFont.secondary)
                    .foregroundStyle(AppColor.destructive)
            } else {
                AppSkeleton(rows: 1)
            }
        }
        .task(id: id) {
            do {
                let data = try await model.creativeData(id)
                let url = FileManager.default.temporaryDirectory.appendingPathComponent("adpilot-\(id).mp4")
                try data.write(to: url, options: .atomic)
                shareFile = url
                player = AVPlayer(url: url)
            } catch {
                failed = true
            }
        }
    }
}

struct AdsView: View {
    @EnvironmentObject private var model: AppModel
    @State private var isLoading = true

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && model.campaigns.isEmpty {
                    AppSkeleton()
                        .padding(AppSpacing.lg)
                } else if model.campaigns.isEmpty {
                    AppEmptyState(
                        systemImage: "photo.on.rectangle",
                        message: Copy.text("No saved briefs yet.", "لا ملخصات محفوظة بعد.", language: model.language),
                        actionTitle: Copy.text("Start from Home", "ابدأ من الرئيسية", language: model.language)
                    ) {
                        model.tab = 0
                    }
                } else {
                    List(model.campaigns) { item in
                        Button {
                            Task { await model.openCampaign(item.id) }
                        } label: {
                            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                                Text(item.title)
                                    .font(AppFont.body)
                                    .foregroundStyle(AppColor.foreground)
                                AppBadge(title: status(item.status), tone: tone(item.status))
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .frame(minHeight: 44)
                        }
                        .accessibilityHint(Copy.text("Opens this brief", "يفتح هذا الطلب", language: model.language))
                        .listRowBackground(AppColor.card)
                    }
                    .scrollContentBackground(.hidden)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(AppColor.background)
            .navigationTitle(Copy.text("My Ads", "إعلاناتي", language: model.language))
            .task {
                isLoading = true
                await model.refreshLists()
                isLoading = false
            }
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

    private func tone(_ value: String) -> AppBadgeTone {
        switch value {
        case "brief_ready": return .accent
        case "confirmed": return .positive
        default: return .neutral
        }
    }
}

struct BusinessTab: View {
    @EnvironmentObject private var model: AppModel
    @State private var isLoading = true

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && model.businesses.isEmpty {
                    AppSkeleton()
                        .padding(AppSpacing.lg)
                } else if model.businesses.isEmpty {
                    AppEmptyState(
                        systemImage: "building.2",
                        message: Copy.text("No businesses yet.", "لا أعمال بعد.", language: model.language),
                        actionTitle: Copy.text("Add", "إضافة", language: model.language)
                    ) {
                        Task { _ = await model.startBusiness() }
                    }
                } else {
                    List {
                        ForEach(model.businesses) { business in
                            NavigationLink {
                                BusinessChat(businessId: business.id)
                            } label: {
                                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                                    Text(business.name.isEmpty ? Copy.text("New business", "عمل جديد", language: model.language) : business.name)
                                        .font(AppFont.body)
                                        .foregroundStyle(AppColor.foreground)
                                    if business.isActive {
                                        AppBadge(
                                            title: Copy.text("Active", "نشط", language: model.language),
                                            tone: .accent
                                        )
                                    }
                                }
                                .frame(minHeight: 44, alignment: .leading)
                            }
                            .listRowBackground(AppColor.card)
                        }
                    }
                    .scrollContentBackground(.hidden)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(AppColor.background)
            .navigationTitle(Copy.text("My Business", "أعمالي", language: model.language))
            .toolbar {
                Button(Copy.text("Add", "إضافة", language: model.language)) {
                    Task { _ = await model.startBusiness() }
                }
                .frame(minWidth: 44, minHeight: 44)
            }
            .task {
                isLoading = true
                await model.refreshLists()
                isLoading = false
            }
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
            VStack(alignment: .leading, spacing: AppSpacing.md) {
                if let business {
                    Text(business.name.isEmpty ? Copy.text("New business", "عمل جديد", language: model.language) : business.name)
                        .font(AppFont.screenTitle)
                        .foregroundStyle(AppColor.foreground)
                    if !business.isActive {
                        AppButton(Copy.text("Use for ads", "استخدمه للإعلانات", language: model.language)) {
                            Task {
                                model.errorMessage = nil
                                await model.activateBusiness(business.id)
                                await reload()
                                AppHaptic.notify(success: model.errorMessage == nil)
                            }
                        }
                    }
                    ForEach(business.onboardingState.messages) { message in
                        ChatBubble(text: message.text, isUser: message.role == "customer")
                    }
                    if !business.onboardingComplete {
                        ChatComposer(
                            text: $draft,
                            placeholder: Copy.text("Your answer", "إجابتك", language: model.language),
                            sendTitle: Copy.text("Send", "إرسال", language: model.language),
                            skipRemainingTitle: Copy.text("Skip remaining", "تخطَّ الباقي", language: model.language),
                            showsSkipRemaining: !business.name.isEmpty,
                            onSend: {
                                Keyboard.dismiss()
                                let text = draft
                                draft = ""
                                Task {
                                    model.errorMessage = nil
                                    await send(text: text)
                                    AppHaptic.notify(success: model.errorMessage == nil)
                                }
                            },
                            onSkipRemaining: {
                                Task {
                                    model.errorMessage = nil
                                    await send(skipRemaining: true)
                                    AppHaptic.notify(success: model.errorMessage == nil)
                                }
                            }
                        )
                    }
                } else {
                    AppSkeleton(rows: 4)
                }
            }
            .padding(AppSpacing.lg)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(AppColor.background)
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
                VStack(alignment: .leading, spacing: AppSpacing.md) {
                    Text(model.customer?.email ?? "")
                        .font(AppFont.secondary)
                        .foregroundStyle(AppColor.mutedForeground)
                    if let error = model.errorMessage, !error.isEmpty {
                        Text(error)
                            .font(AppFont.caption)
                            .foregroundStyle(AppColor.destructive)
                            .accessibilityLabel(error)
                    }
                    AppTextField(
                        label: Copy.text("Your name", "اسمك", language: model.language),
                        text: $name
                    )
                    AppButton(Copy.text("Save name", "احفظ الاسم", language: model.language)) {
                        Task {
                            model.errorMessage = nil
                            await model.saveProfile(name: name)
                            AppHaptic.notify(success: model.errorMessage == nil)
                        }
                    }
                    Picker(Copy.text("Language", "اللغة", language: model.language), selection: language) {
                        Text("English").tag("en")
                        Text("العربية").tag("ar")
                    }
                    .frame(minHeight: 44)
                    AppTextField(
                        label: Copy.text("Current password", "كلمة المرور الحالية", language: model.language),
                        text: $currentPassword,
                        isSecure: true
                    )
                    AppTextField(
                        label: Copy.text("New password", "كلمة المرور الجديدة", language: model.language),
                        text: $newPassword,
                        isSecure: true
                    )
                    AppButton(
                        Copy.text("Change password", "غيّر كلمة المرور", language: model.language),
                        isEnabled: newPassword.count >= 8
                    ) {
                        Task {
                            model.errorMessage = nil
                            await model.changePassword(current: currentPassword, new: newPassword)
                            if model.errorMessage == nil {
                                currentPassword = ""
                                newPassword = ""
                                AppHaptic.notify(success: true)
                            } else {
                                AppHaptic.notify(success: false)
                            }
                        }
                    }
                    AppButton(Copy.text("Sign out", "تسجيل الخروج", language: model.language), role: .ghost) {
                        Task { await model.logout() }
                    }
                    Text(Copy.text(
                        "Instagram and Facebook publishing, and live ad analytics, are not in this version.",
                        "نشر إنستغرام وفيسبوك وتحليلات الإعلانات المباشرة ليست في هذا الإصدار.",
                        language: model.language
                    ))
                    .font(AppFont.caption)
                    .foregroundStyle(AppColor.mutedForeground)
                }
                .padding(AppSpacing.lg)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(AppColor.background)
            .navigationTitle(Copy.text("Account", "الحساب", language: model.language))
            .onAppear { name = model.customer?.name ?? "" }
        }
    }

    private var language: Binding<String> {
        Binding(
            get: { model.language },
            set: { value in
                Task {
                    model.errorMessage = nil
                    await model.saveLanguage(value)
                    AppHaptic.notify(success: model.errorMessage == nil)
                }
            }
        )
    }
}
