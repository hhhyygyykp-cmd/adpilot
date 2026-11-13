import Foundation

struct Customer: Decodable, Identifiable, Equatable {
    let id: String
    var email: String
    var name: String
    var preferredLanguage: String
    var isAdmin: Bool
    var createdAt: String
}

struct AuthPayload: Decodable {
    var customer: Customer
    var token: String?
    var csrf: String?
}

struct MePayload: Decodable {
    var customer: Customer?
}

struct ChatMessage: Decodable, Identifiable {
    let id: String
    var role: String
    var text: String
    var at: String
    var field: String?
    var skipped: Bool?
}

struct OnboardingState: Decodable {
    var messages: [ChatMessage]
    var awaiting: String?
}

struct AssetCounts: Decodable {
    var logo: Int?
    var productPhoto: Int?
}

struct Business: Decodable, Identifiable {
    let id: String
    var name: String
    var category: String
    var description: String
    var productsServices: String
    var targetCustomers: String
    var location: String
    var isActive: Bool
    var onboardingComplete: Bool
    var onboardingState: OnboardingState
    var assetCounts: AssetCounts?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = c.str(.name)
        category = c.str(.category)
        description = c.str(.description)
        productsServices = c.str(.productsServices)
        targetCustomers = c.str(.targetCustomers)
        location = c.str(.location)
        isActive = (try? c.decode(Bool.self, forKey: .isActive)) ?? false
        onboardingComplete = (try? c.decode(Bool.self, forKey: .onboardingComplete)) ?? false
        onboardingState = (try? c.decode(OnboardingState.self, forKey: .onboardingState))
            ?? OnboardingState(messages: [], awaiting: "name")
        assetCounts = try? c.decode(AssetCounts.self, forKey: .assetCounts)
    }

    enum CodingKeys: String, CodingKey {
        case id, name, category, description, productsServices, targetCustomers, location
        case isActive, onboardingComplete, onboardingState, assetCounts
    }
}

struct Concept: Decodable, Identifiable {
    let id: String
    var title: String
    var hook: String
    var headline: String
    var supportingCopy: String
    var coreMessage: String
    var audienceBenefit: String
    var creativeDirection: String
    var recommendedFormat: String
    var cta: String

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = c.str(.title)
        hook = c.str(.hook)
        headline = c.str(.headline)
        supportingCopy = c.str(.supportingCopy)
        coreMessage = c.str(.coreMessage)
        audienceBenefit = c.str(.audienceBenefit)
        creativeDirection = c.str(.creativeDirection)
        recommendedFormat = c.str(.recommendedFormat)
        cta = c.str(.cta)
    }

    enum CodingKeys: String, CodingKey {
        case id, title, hook, headline, supportingCopy, coreMessage, audienceBenefit, creativeDirection, recommendedFormat, cta
    }
}

struct ConceptSet: Decodable {
    var concepts: [Concept]
    var recommendedId: String?
    var recommendationReason: String
    var selectedId: String?
    var chosenBy: String?
}

struct Creative: Decodable, Identifiable {
    let id: String
    var kind: String
    var note: String
    var mimeType: String
    var originalName: String
}

struct InsightValues: Decodable {
    var views: Int?
    var impressions: Int?
    var reach: Int?
    var likes: Int?
    var comments: Int?
    var shares: Int?
    var saves: Int?
}

struct Publication: Decodable, Identifiable {
    let id: String
    var creativeId: String
    var kind: String
    var caption: String
    var requestedAt: String?
    var customerApprovedAt: String?
    var adminAuthorized: Bool
    var status: String
    var igMediaId: String?
    var permalink: String?
    var publishedAt: String?
    var lastError: String
    var insights: InsightValues?
    var insightsUnavailable: String?
}

struct QuoteLine: Decodable {
    var label: String
    var usd: Double
    var remaining: Int?
    var limit: Int?
    var seconds: Int?
}

struct MediaQuote: Decodable {
    var keyConfigured: Bool
    var waitingForKey: Bool
    var wantsVideo: Bool
    var chargesStill: Bool?
    var chargesVideo: Bool?
    var totalUsd: Double
    var still: QuoteLine?
    var video: QuoteLine?
}

struct Campaign: Decodable, Identifiable {
    let id: String
    var businessId: String
    var businessName: String?
    var status: String
    var originalPrompt: String
    var productName: String?
    var offer: String?
    var objective: String?
    var conversation: [ChatMessage]
    var conceptSet: ConceptSet?
    var creatives: [Creative]
    var publications: [Publication]
    var generationStatus: String
    var generationNote: String
    var mediaQuote: MediaQuote?
    var awaiting: String?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        businessId = c.str(.businessId)
        businessName = try? c.decode(String.self, forKey: .businessName)
        status = c.str(.status)
        originalPrompt = c.str(.originalPrompt)
        productName = try? c.decode(String.self, forKey: .productName)
        offer = try? c.decode(String.self, forKey: .offer)
        objective = try? c.decode(String.self, forKey: .objective)
        conversation = (try? c.decode([ChatMessage].self, forKey: .conversation)) ?? []
        conceptSet = try? c.decode(ConceptSet.self, forKey: .conceptSet)
        creatives = (try? c.decode([Creative].self, forKey: .creatives)) ?? []
        publications = (try? c.decode([Publication].self, forKey: .publications)) ?? []
        generationStatus = c.str(.generationStatus)
        generationNote = c.str(.generationNote)
        mediaQuote = try? c.decode(MediaQuote.self, forKey: .mediaQuote)
        awaiting = try? c.decode(String.self, forKey: .awaiting)
    }

    enum CodingKeys: String, CodingKey {
        case id, businessId, businessName, status, originalPrompt, productName, offer, objective
        case conversation, conceptSet, creatives, publications, generationStatus, generationNote, mediaQuote, awaiting
    }

    var title: String {
        let named = productName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return named.isEmpty ? originalPrompt : named
    }
}

struct QueueItem: Decodable, Identifiable {
    let id: String
    var creativeId: String
    var kind: String
    var caption: String
    var customerApprovedAt: String?
    var adminAuthorized: Bool
    var status: String
    var lastError: String
    var customerEmail: String
    var customerName: String
    var businessName: String
    var productName: String?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        creativeId = c.str(.creativeId)
        kind = c.str(.kind)
        caption = c.str(.caption)
        customerApprovedAt = try? c.decode(String.self, forKey: .customerApprovedAt)
        adminAuthorized = (try? c.decode(Bool.self, forKey: .adminAuthorized)) ?? false
        status = c.str(.status)
        lastError = c.str(.lastError)
        customerEmail = c.str(.customerEmail)
        customerName = c.str(.customerName)
        businessName = c.str(.businessName)
        productName = try? c.decode(String.self, forKey: .productName)
    }

    enum CodingKeys: String, CodingKey {
        case id, creativeId, kind, caption, customerApprovedAt, adminAuthorized, status, lastError
        case customerEmail, customerName, businessName, productName
    }
}

struct QueueDestination: Decodable {
    var username: String?
    var igUserId: String?
    var targetUsername: String?
}

struct QueuePayload: Decodable {
    var publications: [QueueItem]
    var destination: QueueDestination?
}

struct AgencyInstagram: Decodable {
    var status: String
    var username: String?
    var igUserId: String?
    var permissions: [String]
    var lastError: String
    var targetUsername: String?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        status = c.str(.status)
        username = try? c.decode(String.self, forKey: .username)
        igUserId = try? c.decode(String.self, forKey: .igUserId)
        permissions = (try? c.decode([String].self, forKey: .permissions)) ?? []
        lastError = c.str(.lastError)
        targetUsername = try? c.decode(String.self, forKey: .targetUsername)
    }

    enum CodingKeys: String, CodingKey {
        case status, username, igUserId, permissions, lastError, targetUsername
    }

    var handle: String {
        let raw = (username ?? targetUsername ?? "adpilot.ae").trimmingCharacters(in: .whitespacesAndNewlines)
        if raw.isEmpty { return "@adpilot.ae" }
        return raw.hasPrefix("@") ? raw : "@\(raw)"
    }

    var canPublish: Bool {
        status == "connected" && permissions.contains("instagram_content_publish")
    }
}

struct AgencyInstagramPayload: Decodable { var instagram: AgencyInstagram }
struct PublicationActionPayload: Decodable { var publication: Publication }
struct ConnectPayload: Decodable { var url: String }

struct CustomerInstagram: Decodable {
    var status: String
    var username: String?
    var name: String?
    var biography: String?
    var lastError: String
    var accessNote: String
    var appReviewNote: String
    var canPublish: Bool

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        status = c.str(.status)
        username = try? c.decode(String.self, forKey: .username)
        name = try? c.decode(String.self, forKey: .name)
        biography = try? c.decode(String.self, forKey: .biography)
        lastError = c.str(.lastError)
        accessNote = c.str(.accessNote)
        appReviewNote = c.str(.appReviewNote)
        canPublish = (try? c.decode(Bool.self, forKey: .canPublish)) ?? false
    }

    enum CodingKeys: String, CodingKey {
        case status, username, name, biography, lastError, accessNote, appReviewNote, canPublish
    }
}

struct InstagramInsightsNote: Decodable {
    var available: Bool?
    var note: String?
}

struct InstagramRetrieved: Decodable {
    var insights: InstagramInsightsNote?
}

struct InferredInsights: Decodable {
    var overview: String
    var productsServices: String
    var brandPersonality: String
    var visualIdentity: String
    var contentThemes: String
    var audience: String
    var opportunities: String
    var recommendedApproaches: String
    var confidence: String
    var preliminary: Bool
    var visionUsed: Bool

    init(
        overview: String,
        productsServices: String,
        brandPersonality: String,
        visualIdentity: String,
        contentThemes: String,
        audience: String,
        opportunities: String,
        recommendedApproaches: String,
        confidence: String,
        preliminary: Bool,
        visionUsed: Bool
    ) {
        self.overview = overview
        self.productsServices = productsServices
        self.brandPersonality = brandPersonality
        self.visualIdentity = visualIdentity
        self.contentThemes = contentThemes
        self.audience = audience
        self.opportunities = opportunities
        self.recommendedApproaches = recommendedApproaches
        self.confidence = confidence
        self.preliminary = preliminary
        self.visionUsed = visionUsed
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        overview = c.str(.overview)
        productsServices = c.str(.productsServices)
        brandPersonality = c.str(.brandPersonality)
        visualIdentity = c.str(.visualIdentity)
        contentThemes = c.str(.contentThemes)
        audience = c.str(.audience)
        opportunities = c.str(.opportunities)
        recommendedApproaches = c.str(.recommendedApproaches)
        confidence = c.str(.confidence)
        preliminary = (try? c.decode(Bool.self, forKey: .preliminary)) ?? false
        visionUsed = (try? c.decode(Bool.self, forKey: .visionUsed)) ?? false
    }

    enum CodingKeys: String, CodingKey {
        case overview, productsServices, brandPersonality, visualIdentity, contentThemes
        case audience, opportunities, recommendedApproaches, confidence, preliminary, visionUsed
    }

    func asBody() -> [String: Any] {
        [
            "overview": overview,
            "productsServices": productsServices,
            "brandPersonality": brandPersonality,
            "visualIdentity": visualIdentity,
            "contentThemes": contentThemes,
            "audience": audience,
            "opportunities": opportunities,
            "recommendedApproaches": recommendedApproaches,
        ]
    }
}

struct CustomerAnalysis: Decodable {
    var id: String?
    var status: String
    var inferred: InferredInsights?
    var retrieved: InstagramRetrieved?
    var visionUsed: Bool
    var mediaCount: Int
    var lastError: String

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try? c.decode(String.self, forKey: .id)
        status = c.str(.status)
        inferred = try? c.decode(InferredInsights.self, forKey: .inferred)
        retrieved = try? c.decode(InstagramRetrieved.self, forKey: .retrieved)
        visionUsed = (try? c.decode(Bool.self, forKey: .visionUsed)) ?? false
        mediaCount = (try? c.decode(Int.self, forKey: .mediaCount)) ?? 0
        lastError = c.str(.lastError)
    }

    enum CodingKeys: String, CodingKey {
        case id, status, inferred, retrieved, visionUsed, mediaCount, lastError
    }
}

struct CustomerInstagramPayload: Decodable {
    var instagram: CustomerInstagram
    var analysis: CustomerAnalysis?
}

struct BusinessListPayload: Decodable { var businesses: [Business] }
struct BusinessPayload: Decodable { var business: Business }
struct CampaignListPayload: Decodable { var campaigns: [Campaign] }
struct CampaignPayload: Decodable { var campaign: Campaign }
struct GeneratePayload: Decodable {
    var campaign: Campaign
    var generation: GenerationNote?
}
struct GenerationNote: Decodable {
    var status: String?
    var note: String?
}

private extension KeyedDecodingContainer {
    func str(_ key: Key) -> String {
        (try? decodeIfPresent(String.self, forKey: key)) ?? ""
    }
}
