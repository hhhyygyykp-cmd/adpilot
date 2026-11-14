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
                Text(Copy.text(
                    "If OpenAI is enabled, AdPilot may send brief text you type to OpenAI to extract campaign fields. This is optional; AdPilot works without it.",
                    "إذا فُعّل OpenAI، قد يُرسل أدبايلوت نص الملخص الذي تكتبه إلى OpenAI لاستخراج حقول الحملة. هذا اختياري؛ يعمل أدبايلوت بدونه.",
                    language: language
                ))
                .font(AppFont.caption)
                .foregroundStyle(AppColor.mutedForeground)
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
        Text(Copy.text(
            "If OpenAI is enabled, AdPilot may send this brief to OpenAI to extract campaign fields. This is optional; AdPilot works without it.",
            "إذا فُعّل OpenAI، قد يُرسل أدبايلوت هذا الملخص إلى OpenAI لاستخراج حقول الحملة. هذا اختياري؛ يعمل أدبايلوت بدونه.",
            language: model.language
        ))
        .font(AppFont.caption)
        .foregroundStyle(AppColor.mutedForeground)
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
            AppButton(Copy.text("Continue", "متابعة", language: model.language), isLoading: model.busy, systemImage: "arrow.right", imageEdge: .trailing) {
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
            "Approve sends this finished ad to the agency queue. AdPilot publishes it only after an administrator authorizes the agency Instagram account. You never connect Instagram.",
            "الموافقة ترسل الإعلان النهائي إلى قائمة الوكالة. أدبايلوت لا ينشره إلا بعد تفويض المسؤول لحساب إنستغرام الخاص بالوكالة. لن تربط إنستغرام بنفسك.",
            language: model.language
        ))
        .font(AppFont.caption)
        .foregroundStyle(AppColor.mutedForeground)
        if let creative = (mediaMode == "video" ? videos.first : images.first) {
            let publication = campaign.publications.first { $0.creativeId == creative.id }
            if let publication {
                publicationBlock(publication)
            } else {
                AppButton(
                    Copy.text("Approve this advertisement", "الموافقة على هذا الإعلان", language: model.language),
                    systemImage: "checkmark"
                ) {
                    Task {
                        await model.approveCreative(id: creative.id, caption: defaultCaption(campaign), requestedAt: nil)
                        AppHaptic.notify(success: model.errorMessage == nil)
                    }
                }
                .disabled(model.busy)
                .accessibilityHint(Copy.text("Sends this ad to the agency Instagram queue. It does not post it.", "يرسل الإعلان إلى قائمة إنستغرام الخاصة بالوكالة. لا ينشره.", language: model.language))
            }
        }
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

    @ViewBuilder
    private func publicationBlock(_ publication: Publication) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            AppBadge(title: publicationStatus(publication.status), tone: publication.status == "published" ? .positive : .accent)
            if !publication.caption.isEmpty {
                Text(publication.caption)
                    .font(AppFont.caption)
                    .foregroundStyle(AppColor.mutedForeground)
            }
            if publication.status == "published", let permalink = publication.permalink, let url = URL(string: permalink) {
                Link(Copy.text("Open on Instagram", "فتح على إنستغرام", language: model.language), destination: url)
                    .font(AppFont.button)
                if let publishedAt = publication.publishedAt {
                    Text(Copy.text("Published", "نُشر", language: model.language) + " · " + publishedAt)
                        .font(AppFont.caption)
                        .foregroundStyle(AppColor.mutedForeground)
                }
                insightRows(publication.insights)
                if let unavailable = publication.insightsUnavailable, !unavailable.isEmpty {
                    Text(Copy.text("Insights unavailable", "الرؤى غير متاحة", language: model.language) + ": " + unavailable)
                        .font(AppFont.caption)
                        .foregroundStyle(AppColor.mutedForeground)
                }
            }
            if publication.status == "failed", !publication.lastError.isEmpty {
                Text(publication.lastError)
                    .font(AppFont.caption)
                    .foregroundStyle(AppColor.destructive)
            }
            if publication.igMediaId == nil {
                Button(Copy.text("Withdraw approval", "سحب الموافقة", language: model.language)) {
                    Task { await model.withdrawPublication(publication.id) }
                }
                .font(AppFont.caption)
                .foregroundStyle(AppColor.mutedForeground)
            }
        }
        .padding(AppSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppColor.card)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    @ViewBuilder
    private func insightRows(_ insights: InsightValues?) -> some View {
        if let insights {
            let rows: [(String, Int?)] = [
                (Copy.text("Views", "المشاهدات", language: model.language), insights.views),
                (Copy.text("Impressions", "الظهور", language: model.language), insights.impressions),
                (Copy.text("Reach", "الوصول", language: model.language), insights.reach),
                (Copy.text("Likes", "الإعجابات", language: model.language), insights.likes),
                (Copy.text("Comments", "التعليقات", language: model.language), insights.comments),
                (Copy.text("Shares", "المشاركات", language: model.language), insights.shares),
                (Copy.text("Saves", "الحفظ", language: model.language), insights.saves),
            ].filter { $0.1 != nil }
            if rows.isEmpty {
                Text(Copy.text("Instagram has not returned insights for this post yet.", "لم يُرجع إنستغرام رؤى لهذا المنشور بعد.", language: model.language))
                    .font(AppFont.caption)
                    .foregroundStyle(AppColor.mutedForeground)
            } else {
                ForEach(rows, id: \.0) { row in
                    summaryRow(row.0, String(row.1 ?? 0))
                }
            }
        }
    }

    private func publicationStatus(_ value: String) -> String {
        switch value {
        case "pending_admin": return Copy.text("Approved — in the agency queue", "موافق عليه — في قائمة الوكالة", language: model.language)
        case "authorized": return Copy.text("Authorized — waiting to publish", "مفوض — بانتظار النشر", language: model.language)
        case "publishing": return Copy.text("Publishing", "جارٍ النشر", language: model.language)
        case "published": return Copy.text("Published on Instagram", "نُشر على إنستغرام", language: model.language)
        case "failed": return Copy.text("Publishing failed", "فشل النشر", language: model.language)
        case "withdrawn": return Copy.text("Approval withdrawn", "سُحبت الموافقة", language: model.language)
        case "declined": return Copy.text("Not authorized", "غير مفوض", language: model.language)
        default: return value
        }
    }

    private func defaultCaption(_ campaign: Campaign) -> String {
        [campaign.productName, campaign.offer, campaign.objective]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: "\n\n")
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

private struct StepProgress: View {
    let step: Int
    let language: String

    var body: some View {
        HStack(spacing: 0) {
            ForEach(1...4, id: \.self) { index in
                VStack(spacing: 6) {
                    Text("\(index)")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(index <= step ? .white : AppColor.mutedForeground)
                        .frame(width: 28, height: 28)
                        .background {
                            if index <= step {
                                Circle().fill(AppColor.brandGradient)
                            } else {
                                Circle().stroke(AppColor.border, lineWidth: 1)
                            }
                        }
                    Text(title(index))
                        .font(.system(size: 11, weight: index == step ? .semibold : .regular))
                        .foregroundStyle(index == step ? AppColor.foreground : AppColor.mutedForeground)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity)
                if index < 4 {
                    Rectangle()
                        .fill(index < step ? AppColor.accent : AppColor.border)
                        .frame(height: 2)
                        .offset(y: -10)
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Copy.text("Step \(step) of 4", "الخطوة \(step) من 4", language: language))
    }

    private func title(_ index: Int) -> String {
        switch index {
        case 1: return Copy.text("Brief", "الملخص", language: language)
        case 2: return Copy.text("Strategy", "الاستراتيجية", language: language)
        case 3: return Copy.text("Create", "الإنشاء", language: language)
        default: return Copy.text("Result", "النتيجة", language: language)
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
                                AppBadge(title: status(item), tone: tone(item))
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

    private func status(_ item: Campaign) -> String {
        if item.publications.contains(where: { $0.status == "published" }) {
            return Copy.text("Published on Instagram", "نُشر على إنستغرام", language: model.language)
        }
        if let latest = item.publications.first {
            switch latest.status {
            case "pending_admin": return Copy.text("Approved — in the agency queue", "موافق عليه — في قائمة الوكالة", language: model.language)
            case "authorized": return Copy.text("Authorized — waiting to publish", "مفوض — بانتظار النشر", language: model.language)
            case "failed": return Copy.text("Publishing failed", "فشل النشر", language: model.language)
            default: break
            }
        }
        switch item.status {
        case "drafting": return Copy.text("In conversation", "في المحادثة", language: model.language)
        case "brief_ready": return Copy.text("Brief ready", "الملخص جاهز", language: model.language)
        case "confirmed": return Copy.text("Brief confirmed", "تم التأكيد", language: model.language)
        default: return item.status
        }
    }

    private func tone(_ item: Campaign) -> AppBadgeTone {
        if item.publications.contains(where: { $0.status == "published" }) { return .positive }
        if item.publications.contains(where: { $0.status == "pending_admin" || $0.status == "authorized" }) { return .accent }
        switch item.status {
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
    @State private var overview = ""
    @State private var products = ""
    @State private var personality = ""
    @State private var visual = ""
    @State private var themes = ""
    @State private var audience = ""
    @State private var opportunities = ""
    @State private var approaches = ""

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
                    customerInstagramSection
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

    @ViewBuilder
    private var customerInstagramSection: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            Text(Copy.text("Connect Your Instagram", "اربط إنستغرام", language: model.language))
                .font(AppFont.section)
                .foregroundStyle(AppColor.foreground)
            Text(Copy.text(
                "Connect your Instagram account so AdPilot can understand your business, analyze your content, and create advertisements tailored to your brand.",
                "اربط حساب إنستغرام حتى يفهم أدبايلوت عملك ويحلل محتواك وينشئ إعلانات تناسب علامتك.",
                language: model.language
            ))
            .font(AppFont.caption)
            .foregroundStyle(AppColor.mutedForeground)
            Text(Copy.text(
                "AdPilot never posts from your Instagram. Only the agency account publishes ads.",
                "أدبايلوت لا ينشر من إنستغرام الخاص بك. حساب الوكالة فقط ينشر الإعلانات.",
                language: model.language
            ))
            .font(AppFont.caption)
            .foregroundStyle(AppColor.mutedForeground)
            if let note = model.customerInstagram?.appReviewNote, !note.isEmpty {
                Text(note)
                    .font(AppFont.caption)
                    .foregroundStyle(AppColor.mutedForeground)
            }
            if let ig = model.customerInstagram, ig.status == "connected" {
                Text(Copy.text("Connected as", "متصل باسم", language: model.language) + " @" + (ig.username ?? ""))
                    .font(AppFont.secondary)
                    .foregroundStyle(AppColor.primary)
            } else {
                Text(Copy.text("Not connected", "غير متصل", language: model.language))
                    .font(AppFont.secondary)
                    .foregroundStyle(AppColor.mutedForeground)
            }
            if let error = model.customerInstagram?.lastError, !error.isEmpty {
                Text(error)
                    .font(AppFont.caption)
                    .foregroundStyle(AppColor.destructive)
            }
            AppButton(
                Copy.text("Connect Instagram", "ربط إنستغرام", language: model.language),
                isEnabled: !model.busy
            ) {
                Task {
                    await model.connectCustomerInstagram(businessId)
                    AppHaptic.notify(success: model.errorMessage == nil)
                }
            }
            AppButton(
                Copy.text("Analyze my business", "حلّل عملي", language: model.language),
                role: .outline,
                isEnabled: !model.busy && model.customerInstagram?.status == "connected"
            ) {
                Task {
                    await model.analyzeCustomerInstagram(businessId)
                    applyInferred()
                    AppHaptic.notify(success: model.errorMessage == nil)
                }
            }
            AppButton(
                Copy.text("Disconnect Instagram", "فصل إنستغرام", language: model.language),
                role: .destructive,
                isEnabled: !model.busy && model.customerInstagram?.status == "connected"
            ) {
                Task { await model.disconnectCustomerInstagram(businessId) }
            }
            if let analysis = model.customerAnalysis, analysis.inferred != nil {
                Text(Copy.text("Here's what AdPilot learned about your business.", "إليك ما تعلّمه أدبايلوت عن عملك.", language: model.language))
                    .font(AppFont.section)
                    .foregroundStyle(AppColor.foreground)
                    .padding(.top, AppSpacing.sm)
                if analysis.inferred?.preliminary == true {
                    Text(Copy.text(
                        "Few posts were available, so these recommendations are preliminary.",
                        "عدد المنشورات قليل، لذا هذه التوصيات أولية.",
                        language: model.language
                    ))
                    .font(AppFont.caption)
                    .foregroundStyle(AppColor.mutedForeground)
                }
                Text(
                    analysis.inferred?.visionUsed == true
                        ? Copy.text("AdPilot looked at retrieved images when describing visual identity.", "اطّلع أدبايلوت على الصور المسترجعة عند وصف الهوية البصرية.", language: model.language)
                        : Copy.text("Images were not visually analyzed. This is based on captions and profile text.", "لم تُحلَّل الصور بصرياً. هذا من التعليقات ونص الملف الشخصي.", language: model.language)
                )
                .font(AppFont.caption)
                .foregroundStyle(AppColor.mutedForeground)
                if let note = analysis.retrieved?.insights?.note, !note.isEmpty {
                    Text(note)
                        .font(AppFont.caption)
                        .foregroundStyle(AppColor.mutedForeground)
                }
                insightField(Copy.text("Business overview", "نظرة عامة", language: model.language), text: $overview)
                insightField(Copy.text("Products and services", "المنتجات والخدمات", language: model.language), text: $products)
                insightField(Copy.text("Brand personality", "شخصية العلامة", language: model.language), text: $personality)
                insightField(Copy.text("Visual identity", "الهوية البصرية", language: model.language), text: $visual)
                insightField(Copy.text("Content themes", "موضوعات المحتوى", language: model.language), text: $themes)
                insightField(Copy.text("Potential audience", "الجمهور المحتمل", language: model.language), text: $audience)
                insightField(Copy.text("Marketing opportunities", "فرص تسويقية", language: model.language), text: $opportunities)
                insightField(Copy.text("Recommended advertising approaches", "أساليب إعلانية موصى بها", language: model.language), text: $approaches)
                AppButton(
                    Copy.text("Edit and confirm", "عدّل وأكّد", language: model.language),
                    isEnabled: !model.busy && analysis.id != nil
                ) {
                    Task {
                        guard let id = analysis.id, var inferred = analysis.inferred else { return }
                        inferred = InferredInsights(
                            overview: overview,
                            productsServices: products,
                            brandPersonality: personality,
                            visualIdentity: visual,
                            contentThemes: themes,
                            audience: audience,
                            opportunities: opportunities,
                            recommendedApproaches: approaches,
                            confidence: inferred.confidence,
                            preliminary: inferred.preliminary,
                            visionUsed: inferred.visionUsed
                        )
                        await model.confirmCustomerInstagram(businessId, analysisId: id, inferred: inferred)
                        AppHaptic.notify(success: model.errorMessage == nil)
                    }
                }
            }
        }
        .padding(AppSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppColor.card)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous))
    }

    private func insightField(_ label: String, text: Binding<String>) -> some View {
        AppTextField(label: label, text: text)
    }

    private func reload() async {
        business = model.businesses.first { $0.id == businessId }
        if business == nil { await model.refreshLists() }
        business = model.businesses.first { $0.id == businessId }
        await model.loadCustomerInstagram(businessId)
        applyInferred()
    }

    private func applyInferred() {
        guard let inferred = model.customerAnalysis?.inferred else { return }
        overview = inferred.overview
        products = inferred.productsServices
        personality = inferred.brandPersonality
        visual = inferred.visualIdentity
        themes = inferred.contentThemes
        audience = inferred.audience
        opportunities = inferred.opportunities
        approaches = inferred.recommendedApproaches
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
                    if model.customer?.isAdmin == true {
                        AppButton(Copy.text("Open agency queue", "افتح قائمة الوكالة", language: model.language), role: .ghost) {
                            model.tab = 5
                        }
                    }
                    Text(Copy.text(
                        "If OpenAI is enabled, brief text you type may be sent to OpenAI to extract campaign fields. This is optional; AdPilot works without it.",
                        "إذا فُعّل OpenAI، قد يُرسل نص الملخص الذي تكتبه إلى OpenAI لاستخراج حقول الحملة. هذا اختياري؛ يعمل أدبايلوت بدونه.",
                        language: model.language
                    ))
                    .font(AppFont.caption)
                    .foregroundStyle(AppColor.mutedForeground)
                    Text(Copy.text(
                        "Customers create and approve ads in this app. An administrator authorizes the agency Instagram account. Nothing is posted until Publish is confirmed.",
                        "العملاء ينشئون الإعلانات ويوافقون عليها في هذا التطبيق. المسؤول يفوّض حساب إنستغرام الخاص بالوكالة. لا يُنشر شيء حتى يتم تأكيد النشر.",
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

struct AgencyQueueView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: AppSpacing.lg) {
                    connectionCard
                    linkingButtons
                    if model.queue.isEmpty {
                        AppEmptyState(
                            systemImage: "tray",
                            message: Copy.text(
                                "No advertisements waiting. Create a still in this app, then Approve. Publish stays off until you confirm.",
                                "لا إعلانات في الانتظار. أنشئ صورة ثابتة في هذا التطبيق ثم وافق. النشر يبقى متوقفاً حتى تؤكد.",
                                language: model.language
                            )
                        )
                    } else {
                        ForEach(model.queue) { item in
                            queueCard(item)
                        }
                    }
                }
                .padding(AppSpacing.lg)
            }
            .background(AppColor.background)
            .navigationTitle(Copy.text("Agency Instagram", "إنستغرام الوكالة", language: model.language))
            .task { await model.loadAgencyQueue() }
            .refreshable { await model.loadAgencyQueue() }
        }
    }

    private var destinationHandle: String {
        if let name = model.queueDestination?.username, !name.isEmpty {
            return name.hasPrefix("@") ? name : "@\(name)"
        }
        return model.agencyInstagram?.handle ?? "@adpilot.ae"
    }

    private var connectionCard: some View {
        let ig = model.agencyInstagram
        let connected = ig?.status == "connected"
        let exact = (ig?.username ?? "").replacingOccurrences(of: "@", with: "").lowercased() == "adpilot.ae"
        let canPublish = ig?.canPublish == true
        return VStack(alignment: .leading, spacing: AppSpacing.sm) {
            Text(Copy.text("Instagram destination", "وجهة إنستغرام", language: model.language))
                .font(AppFont.caption)
                .foregroundStyle(AppColor.mutedForeground)
            Text(destinationHandle)
                .font(AppFont.screenTitle)
                .foregroundStyle(AppColor.foreground)
            Text(
                connected && exact
                    ? Copy.text("Connected to @adpilot.ae", "متصل بـ @adpilot.ae", language: model.language)
                    : Copy.text("Not connected to @adpilot.ae", "غير متصل بـ @adpilot.ae", language: model.language)
            )
            .font(AppFont.secondary)
            .foregroundStyle(connected && exact ? AppColor.primary : AppColor.destructive)
            Text(
                canPublish
                    ? Copy.text(
                        "Content publishing permission is granted. Connect, disconnect, and authorize stay in this app. No Instagram post is created here.",
                        "صلاحية نشر المحتوى ممنوحة. الربط والفصل والتفويض تبقى في هذا التطبيق. لا يُنشأ منشور إنستغرام من هنا.",
                        language: model.language
                    )
                    : Copy.text(
                        "Content publishing permission is missing. Tap Connect Instagram in this app.",
                        "صلاحية نشر المحتوى غير موجودة. اضغط ربط إنستغرام في هذا التطبيق.",
                        language: model.language
                    )
            )
            .font(AppFont.caption)
            .foregroundStyle(AppColor.mutedForeground)
            if let id = ig?.igUserId, !id.isEmpty {
                Text(Copy.text("Account id", "معرّف الحساب", language: model.language) + " · " + id)
                    .font(AppFont.caption)
                    .foregroundStyle(AppColor.mutedForeground)
            }
            if let error = ig?.lastError, !error.isEmpty {
                Text(error)
                    .font(AppFont.caption)
                    .foregroundStyle(AppColor.destructive)
            }
        }
        .padding(AppSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppColor.card)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous))
    }

    private var linkingButtons: some View {
        VStack(spacing: AppSpacing.sm) {
            AppButton(
                Copy.text("Connect Instagram", "ربط إنستغرام", language: model.language),
                isEnabled: !model.busy
            ) {
                Task {
                    await model.connectInstagram()
                    AppHaptic.notify(success: model.errorMessage == nil)
                }
            }
            AppButton(
                Copy.text("Refresh account", "تحديث الحساب", language: model.language),
                role: .outline,
                isEnabled: !model.busy
            ) {
                Task { await model.refreshInstagram() }
            }
            AppButton(
                Copy.text("Disconnect Instagram", "فصل إنستغرام", language: model.language),
                role: .destructive,
                isEnabled: !model.busy && model.agencyInstagram?.status == "connected"
            ) {
                Task { await model.disconnectInstagram() }
            }
        }
    }

    private func queueCard(_ item: QueueItem) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            HStack {
                Text(item.productName?.isEmpty == false ? item.productName! : item.businessName)
                    .font(AppFont.section)
                    .foregroundStyle(AppColor.foreground)
                Spacer()
                AppBadge(title: queueStatus(item.status), tone: item.adminAuthorized ? .accent : .neutral)
            }
            Text("\(item.businessName) · \(item.customerName)")
                .font(AppFont.caption)
                .foregroundStyle(AppColor.mutedForeground)
            Text(Copy.text("Instagram destination", "وجهة إنستغرام", language: model.language) + " · " + destinationHandle)
                .font(AppFont.caption)
                .foregroundStyle(AppColor.mutedForeground)
            if item.kind == "image" {
                CreativeImage(id: item.creativeId)
            }
            Text(Copy.text("Caption", "التعليق", language: model.language))
                .font(AppFont.caption)
                .foregroundStyle(AppColor.mutedForeground)
            Text(item.caption.isEmpty ? "—" : item.caption)
                .font(AppFont.secondary)
                .foregroundStyle(AppColor.foreground)
            HStack {
                Text(
                    Copy.text("Customer approval", "موافقة العميل", language: model.language)
                        + ": "
                        + (item.customerApprovedAt == nil
                            ? Copy.text("No", "لا", language: model.language)
                            : Copy.text("Yes", "نعم", language: model.language))
                )
                Spacer()
                Text(
                    Copy.text("Agency authorization", "تفويض الوكالة", language: model.language)
                        + ": "
                        + (item.adminAuthorized
                            ? Copy.text("Yes", "نعم", language: model.language)
                            : Copy.text("No", "لا", language: model.language))
                )
            }
            .font(AppFont.caption)
            .foregroundStyle(AppColor.mutedForeground)
            if !item.lastError.isEmpty {
                Text(item.lastError)
                    .font(AppFont.caption)
                    .foregroundStyle(AppColor.destructive)
            }
            if item.customerApprovedAt != nil, item.status != "published" {
                AppButton(
                    Copy.text("Authorize publication", "تفويض النشر", language: model.language),
                    isEnabled: !model.busy
                ) {
                    Task {
                        await model.authorizeQueueItem(item.id, caption: item.caption)
                        AppHaptic.notify(success: model.errorMessage == nil)
                    }
                }
            }
            Text(Copy.text(
                "Publish is not on this screen. Wait for an explicit confirmation before any Instagram post.",
                "النشر ليس على هذه الشاشة. انتظر تأكيداً صريحاً قبل أي منشور على إنستغرام.",
                language: model.language
            ))
            .font(AppFont.caption)
            .foregroundStyle(AppColor.mutedForeground)
        }
        .padding(AppSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppColor.card)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.card, style: .continuous))
    }

    private func queueStatus(_ status: String) -> String {
        switch status {
        case "pending_admin": return Copy.text("In queue", "في القائمة", language: model.language)
        case "authorized": return Copy.text("Authorized", "مفوّض", language: model.language)
        case "published": return Copy.text("Published", "منشور", language: model.language)
        default: return status
        }
    }
}
