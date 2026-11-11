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
                BrandLockup(language: language)
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
    @State private var notice: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: AppSpacing.lg) {
                    HStack(alignment: .center) {
                        BrandLockup(language: model.language)
                        Spacer(minLength: AppSpacing.sm)
                        Button {
                            notice = Copy.text("No notifications yet.", "لا إشعارات بعد.", language: model.language)
                        } label: {
                            Image(systemName: "bell")
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundStyle(AppColor.foreground)
                                .frame(width: 44, height: 44)
                        }
                        .accessibilityLabel(Copy.text("Notifications", "الإشعارات", language: model.language))
                        Button {
                            model.tab = 4
                        } label: {
                            Text(initials(model.customer?.name ?? ""))
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(.white)
                                .frame(width: 40, height: 40)
                                .background(AppColor.brandGradient)
                                .clipShape(Circle())
                        }
                        .accessibilityLabel(Copy.text("Account", "الحساب", language: model.language))
                    }
                    VStack(alignment: .leading, spacing: AppSpacing.sm) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 22, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(width: 48, height: 48)
                            .background(Circle().fill(.white.opacity(0.16)))
                        Text(Copy.text(
                            "What would you like to advertise today?",
                            "ماذا تريد أن تعلن اليوم؟",
                            language: model.language
                        ))
                        .font(.system(size: 28, weight: .bold))
                        .foregroundStyle(.white)
                        Text(Copy.text(
                            "Tell us what you want to promote. Our AI will handle the strategy, design, and production.",
                            "أخبرنا بما تريد الترويج له. سيتولى الذكاء الاصطناعي الاستراتيجية والتصميم والإنتاج.",
                            language: model.language
                        ))
                        .font(AppFont.secondary)
                        .foregroundStyle(.white.opacity(0.88))
                    }
                    .padding(AppSpacing.lg)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(AppColor.heroGradient)
                    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                    if model.activeBusiness == nil {
                        AppButton(Copy.text("Add a business", "أضف عملاً", language: model.language)) {
                            Keyboard.dismiss()
                            model.tab = 3
                        }
                    } else {
                        HStack(alignment: .center, spacing: AppSpacing.sm) {
                            TextField(
                                "",
                                text: $prompt,
                                prompt: Text(Copy.text(
                                    "e.g. I want to promote our new burger meal for AED 39…",
                                    "مثال: أريد الترويج لوجبة البرجر الجديدة بـ 39 درهماً…",
                                    language: model.language
                                )).foregroundStyle(AppColor.mutedForeground),
                                axis: .vertical
                            )
                            .lineLimit(2...4)
                            .font(AppFont.body)
                            .foregroundStyle(AppColor.foreground)
                            Image(systemName: "mic")
                                .foregroundStyle(AppColor.mutedForeground)
                                .accessibilityHidden(true)
                        }
                        .padding(AppSpacing.md)
                        .background(AppColor.input)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(AppColor.border, lineWidth: 1)
                        )
                        AppButton(
                            Copy.text("Create Advertisement", "أنشئ الإعلان", language: model.language),
                            isLoading: model.busy,
                            isEnabled: prompt.trimmingCharacters(in: .whitespacesAndNewlines).count >= 3 && !model.busy,
                            systemImage: "plus",
                            imageEdge: .trailing
                        ) {
                            Keyboard.dismiss()
                            let text = prompt
                            prompt = ""
                            Task {
                                await model.startCampaign(prompt: text, businessId: model.activeBusiness!.id)
                            }
                        }
                    }
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 4), spacing: 12) {
                        HomeTile(title: Copy.text("My Ads", "إعلاناتي", language: model.language), systemImage: "square.grid.2x2") { model.tab = 2 }
                        HomeTile(title: Copy.text("My Business", "عملي", language: model.language), systemImage: "building.2") { model.tab = 3 }
                        HomeTile(title: Copy.text("Analytics", "التحليلات", language: model.language), systemImage: "chart.bar") {
                            notice = Copy.text(
                                "Live ad analytics are not in this version. Counts are hidden until real results exist.",
                                "تحليلات الإعلانات المباشرة ليست في هذا الإصدار. الأرقام مخفية حتى تتوفر نتائج حقيقية.",
                                language: model.language
                            )
                        }
                        HomeTile(title: Copy.text("Support", "الدعم", language: model.language), systemImage: "questionmark.circle") {
                            notice = Copy.text(
                                "Support is not connected yet. Your account and ads stay on this phone’s AdPilot server.",
                                "الدعم غير متصل بعد. حسابك وإعلاناتك تبقى على خادم AdPilot في هذا الجهاز.",
                                language: model.language
                            )
                        }
                    }
                    HStack {
                        Text(Copy.text("Recent Campaigns", "الحملات الأخيرة", language: model.language))
                            .font(AppFont.section)
                            .foregroundStyle(AppColor.foreground)
                        Spacer()
                        Button(Copy.text("View All", "عرض الكل", language: model.language)) { model.tab = 2 }
                            .font(AppFont.caption)
                            .foregroundStyle(AppColor.accent)
                    }
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
                                HStack(spacing: AppSpacing.md) {
                                    Text(String(item.title.prefix(1)).uppercased())
                                        .font(.system(size: 18, weight: .bold))
                                        .foregroundStyle(.white)
                                        .frame(width: 64, height: 64)
                                        .background(AppColor.heroGradient)
                                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                    VStack(alignment: .leading, spacing: 6) {
                                        Text(item.title)
                                            .font(AppFont.body)
                                            .foregroundStyle(AppColor.foreground)
                                            .lineLimit(2)
                                        Text(campaignStatus(item.status))
                                            .font(.system(size: 12, weight: .semibold))
                                            .foregroundStyle(item.status == "confirmed" ? Color(red: 0.55, green: 0.9, blue: 0.65) : AppColor.mutedForeground)
                                    }
                                    Spacer(minLength: 0)
                                }
                                .padding(AppSpacing.sm)
                                .background(AppColor.card)
                                .clipShape(RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous))
                            }
                            .accessibilityHint(Copy.text("Opens this brief", "يفتح هذا الطلب", language: model.language))
                        }
                    }
                    if let notice {
                        Text(notice)
                            .font(AppFont.caption)
                            .foregroundStyle(AppColor.mutedForeground)
                    }
                }
                .padding(AppSpacing.lg)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(AppColor.background)
            .toolbar(.hidden, for: .navigationBar)
        }
    }

    private func initials(_ name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        let letters = parts.compactMap { $0.first }.map(String.init).joined()
        return letters.isEmpty ? "A" : letters.uppercased()
    }

    private func campaignStatus(_ value: String) -> String {
        switch value {
        case "confirmed": return Copy.text("Confirmed", "مؤكد", language: model.language)
        case "brief_ready": return Copy.text("Ready", "جاهز", language: model.language)
        default: return Copy.text("Draft", "مسودة", language: model.language)
        }
    }
}

private struct HomeTile: View {
    let title: String
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: systemImage)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(AppColor.foreground)
                Text(title)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(AppColor.mutedForeground)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, minHeight: 78)
            .background(AppColor.card)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .accessibilityLabel(title)
    }
}

struct CreateAdView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var draft = ""
    @State private var authorize = false
    @State private var forceStep: Int?
    @State private var mediaMode = "image"
    @State private var approved = false

    var body: some View {
        let motion: Animation? = reduceMotion ? nil : .spring(response: 0.45, dampingFraction: 0.86)
        let stillCount = model.campaign?.creatives.filter { $0.kind == "image" }.count ?? 0
        return NavigationStack {
            ScrollView {
                if let campaign = model.campaign {
                    let step = forceStep ?? naturalStep(campaign)
                    VStack(alignment: .leading, spacing: AppSpacing.md) {
                        HStack {
                            Button {
                                goBack(from: step)
                            } label: {
                                Image(systemName: "chevron.left")
                                    .font(.system(size: 18, weight: .semibold))
                                    .foregroundStyle(AppColor.foreground)
                                    .frame(width: 44, height: 44)
                            }
                            .accessibilityLabel(Copy.text("Back", "رجوع", language: model.language))
                            Spacer()
                            Text(step == 4
                                 ? Copy.text("Advertisement Result", "نتيجة الإعلان", language: model.language)
                                 : Copy.text("Create Advertisement", "إنشاء إعلان", language: model.language))
                                .font(AppFont.section)
                                .foregroundStyle(AppColor.foreground)
                            Spacer()
                            Color.clear.frame(width: 44, height: 44)
                        }
                        if step < 4 {
                            StepProgress(step: step, language: model.language)
                        }
                        if step == 1 {
                            briefStep(campaign)
                        } else if step == 2 {
                            strategyStep(campaign, motion: motion)
                        } else if step == 3 {
                            createStep(campaign)
                        } else {
                            resultStep(campaign)
                        }
                    }
                    .padding(AppSpacing.lg)
                    .onChange(of: campaign.id) { _, _ in
                        authorize = false
                        forceStep = nil
                        approved = false
                        mediaMode = "image"
                    }
                    .onChange(of: stillCount) { oldCount, newCount in
                        guard newCount > oldCount else { return }
                        forceStep = nil
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
            .toolbar(.hidden, for: .navigationBar)
        }
    }

    private func naturalStep(_ campaign: Campaign) -> Int {
        let hasCreative = campaign.creatives.contains { $0.kind == "image" || $0.kind == "video" }
        if hasCreative { return 4 }
        if campaign.status == "confirmed" { return 3 }
        if campaign.status == "brief_ready" || !(campaign.conceptSet?.concepts.isEmpty ?? true) && campaign.status != "drafting" {
            return 2
        }
        return 1
    }

    private func goBack(from step: Int) {
        if step <= 1 {
            model.tab = 0
        } else {
            forceStep = step - 1
        }
    }

    @ViewBuilder
    private func briefStep(_ campaign: Campaign) -> some View {
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
        } else {
            AppButton(Copy.text("Continue", "متابعة", language: model.language), systemImage: "arrow.right", imageEdge: .trailing) {
                forceStep = 2
            }
        }
    }

    @ViewBuilder
    private func strategyStep(_ campaign: Campaign, motion: Animation?) -> some View {
        Text(Copy.text(
            "Here are 3 marketing strategies for your advertisement",
            "هذه 3 استراتيجيات تسويقية لإعلانك",
            language: model.language
        ))
        .font(.system(size: 26, weight: .bold))
        .foregroundStyle(AppColor.foreground)
        Text(Copy.text(
            "Based on your business, goal, and target audience",
            "بناءً على عملك وهدفك والجمهور",
            language: model.language
        ))
        .font(AppFont.secondary)
        .foregroundStyle(AppColor.mutedForeground)
        if let set = campaign.conceptSet {
            ForEach(set.concepts) { concept in
                let selected = set.selectedId == concept.id || (set.selectedId == nil && set.recommendedId == concept.id)
                let recommended = set.recommendedId == concept.id
                Button {
                    Task { await model.chooseConcept(id: concept.id, recommended: false) }
                } label: {
                    HStack(alignment: .top, spacing: AppSpacing.sm) {
                        Text(String(concept.title.prefix(1)))
                            .font(.system(size: 20, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 72, height: 72)
                            .background(AppColor.heroGradient)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(concept.title)
                                    .font(AppFont.section)
                                    .foregroundStyle(AppColor.foreground)
                                if recommended {
                                    Text(Copy.text("Recommended", "موصى به", language: model.language))
                                        .font(.system(size: 11, weight: .bold))
                                        .foregroundStyle(.white)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 3)
                                        .background(Capsule().fill(AppColor.brandGradient))
                                }
                                Spacer(minLength: 0)
                                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(selected ? AppColor.accent : AppColor.mutedForeground)
                            }
                            Text(concept.hook)
                                .font(AppFont.caption)
                                .foregroundStyle(AppColor.mutedForeground)
                                .multilineTextAlignment(.leading)
                            HStack(spacing: 6) {
                                if let objective = campaign.objective, !objective.isEmpty {
                                    chip(objective)
                                }
                                chip(concept.recommendedFormat == "video"
                                     ? Copy.text("Video", "فيديو", language: model.language)
                                     : Copy.text("Image", "صورة", language: model.language))
                            }
                        }
                    }
                    .padding(AppSpacing.sm)
                    .background(AppColor.card)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(selected || recommended ? AppColor.accent : AppColor.border, lineWidth: selected || recommended ? 1.5 : 1)
                    )
                    .shadow(color: (selected || recommended) ? AppColor.accent.opacity(0.35) : .clear, radius: 12)
                }
                .accessibilityHint(Copy.text("Selects this concept", "يختار هذا الاتجاه", language: model.language))
            }
            .animation(motion, value: set.concepts.map(\.id))
            if !set.recommendationReason.isEmpty {
                HStack(alignment: .top, spacing: AppSpacing.sm) {
                    Image(systemName: "info.circle")
                        .foregroundStyle(AppColor.accent)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(Copy.text("Why this recommendation?", "لماذا هذه التوصية؟", language: model.language))
                            .font(AppFont.body)
                            .foregroundStyle(AppColor.foreground)
                        Text(set.recommendationReason)
                            .font(AppFont.caption)
                            .foregroundStyle(AppColor.mutedForeground)
                    }
                }
                .padding(AppSpacing.md)
                .background(AppColor.card)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
        }
        HStack(spacing: AppSpacing.sm) {
            AppButton(Copy.text("Back", "رجوع", language: model.language), role: .outline) {
                forceStep = 1
            }
            AppButton(Copy.text("Continue", "متابعة", language: model.language), systemImage: "arrow.right", imageEdge: .trailing, isLoading: model.busy) {
                Task {
                    model.errorMessage = nil
                    if campaign.conceptSet?.selectedId == nil {
                        await model.chooseConcept(id: nil, recommended: true)
                    }
                    if campaign.status == "brief_ready" {
                        await model.confirmCampaign()
                    }
                    forceStep = nil
                    AppHaptic.notify(success: model.errorMessage == nil)
                }
            }
        }
    }

    @ViewBuilder
    private func createStep(_ campaign: Campaign) -> some View {
        Text(Copy.text("Create the advertisement", "أنشئ الإعلان", language: model.language))
            .font(AppFont.screenTitle)
            .foregroundStyle(AppColor.foreground)
        if let quote = campaign.mediaQuote {
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
                if chargesVideo && (quote.video?.usd ?? 0) > 0 {
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
                    if model.errorMessage == nil { forceStep = nil }
                    AppHaptic.notify(success: model.errorMessage == nil)
                }
            }
        }
        if !campaign.generationNote.isEmpty {
            Text(campaign.generationNote)
                .font(AppFont.caption)
                .foregroundStyle(AppColor.mutedForeground)
        }
    }

    @ViewBuilder
    private func resultStep(_ campaign: Campaign) -> some View {
        let images = campaign.creatives.filter { $0.kind == "image" }
        let videos = campaign.creatives.filter { $0.kind == "video" }
        HStack(spacing: 0) {
            modeButton("image", title: Copy.text("Image", "صورة", language: model.language), systemImage: "photo")
            modeButton("video", title: Copy.text("Video", "فيديو", language: model.language), systemImage: "play.fill")
        }
        .padding(4)
        .background(AppColor.card)
        .clipShape(Capsule())
        if mediaMode == "video" {
            if let video = videos.first {
                CreativeVideo(id: video.id)
                Text(video.note)
                    .font(AppFont.caption)
                    .foregroundStyle(AppColor.mutedForeground)
            } else {
                Text(Copy.text("No video is saved for this ad yet.", "لا يوجد فيديو محفوظ لهذا الإعلان بعد.", language: model.language))
                    .font(AppFont.secondary)
                    .foregroundStyle(AppColor.mutedForeground)
            }
        } else if let image = images.first {
            CreativeImage(id: image.id)
            Text(image.note)
                .font(AppFont.caption)
                .foregroundStyle(AppColor.mutedForeground)
        }
        HStack(spacing: 8) {
            resultAction(Copy.text("Edit", "تعديل", language: model.language), systemImage: "pencil") { forceStep = 2 }
            resultAction(Copy.text("Regenerate", "إعادة", language: model.language), systemImage: "arrow.triangle.2.circlepath") { forceStep = 3 }
        }
        Text(Copy.text(
            "Share under the preview saves the file. Approve only marks it reviewed on this phone.",
            "المشاركة تحت المعاينة تحفظ الملف. الموافقة تعلّمه كمراجع على هذا الهاتف فقط.",
            language: model.language
        ))
        .font(AppFont.caption)
        .foregroundStyle(AppColor.mutedForeground)
        AppButton(
            approved
                ? Copy.text("Approved", "تمت الموافقة", language: model.language)
                : Copy.text("Approve", "موافقة", language: model.language),
            systemImage: "checkmark"
        ) {
            approved = true
            AppHaptic.notify(success: true)
        }
        .accessibilityHint(Copy.text("Marks this ad reviewed on this phone. It does not publish it.", "يعلّم الإعلان كمراجع على هذا الهاتف. لا ينشره.", language: model.language))
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            Text(Copy.text("Campaign Summary", "ملخص الحملة", language: model.language))
                .font(AppFont.section)
                .foregroundStyle(AppColor.foreground)
            summaryRow(Copy.text("Strategy", "الاستراتيجية", language: model.language), selectedStrategy(campaign))
            summaryRow(Copy.text("Goal", "الهدف", language: model.language), campaign.objective ?? "—")
            summaryRow(Copy.text("Format", "الصيغة", language: model.language), formatLine(campaign))
        }
        .padding(AppSpacing.md)
        .background(AppColor.card)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        if !campaign.generationNote.isEmpty {
            Text(campaign.generationNote)
                .font(AppFont.caption)
                .foregroundStyle(AppColor.mutedForeground)
        }
    }

    private func modeButton(_ mode: String, title: String, systemImage: String) -> some View {
        Button {
            mediaMode = mode
        } label: {
            Label(title, systemImage: systemImage)
                .font(AppFont.button)
                .foregroundStyle(mediaMode == mode ? .white : AppColor.mutedForeground)
                .frame(maxWidth: .infinity, minHeight: 40)
                .background {
                    if mediaMode == mode { Capsule().fill(AppColor.brandGradient) }
                }
        }
        .accessibilityAddTraits(mediaMode == mode ? .isSelected : AccessibilityTraits())
    }

    private func resultAction(_ title: String, systemImage: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: systemImage)
                Text(title)
                    .font(.system(size: 11, weight: .medium))
            }
            .foregroundStyle(AppColor.foreground)
            .frame(maxWidth: .infinity, minHeight: 64)
            .background(AppColor.card)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .accessibilityLabel(title)
    }

    private func chip(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(AppColor.mutedForeground)
            .lineLimit(1)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(AppColor.muted)
            .clipShape(Capsule())
    }

    private func summaryRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .foregroundStyle(AppColor.mutedForeground)
            Spacer()
            Text(value)
                .foregroundStyle(AppColor.foreground)
                .multilineTextAlignment(.trailing)
        }
        .font(AppFont.caption)
    }

    private func selectedStrategy(_ campaign: Campaign) -> String {
        guard let set = campaign.conceptSet else { return "—" }
        let id = set.selectedId ?? set.recommendedId
        return set.concepts.first { $0.id == id }?.title ?? "—"
    }

    private func formatLine(_ campaign: Campaign) -> String {
        let hasImage = campaign.creatives.contains { $0.kind == "image" }
        let hasVideo = campaign.creatives.contains { $0.kind == "video" }
        if hasImage && hasVideo { return Copy.text("Image and video", "صورة وفيديو", language: model.language) }
        if hasVideo { return Copy.text("Video", "فيديو", language: model.language) }
        if hasImage { return Copy.text("Image", "صورة", language: model.language) }
        return campaign.conceptSet?.concepts.first { $0.id == (campaign.conceptSet?.selectedId ?? "") }?.recommendedFormat ?? "—"
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
