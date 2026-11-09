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
    var generationStatus: String
    var generationNote: String
    var mediaQuote: MediaQuote?
    var awaiting: String?

    var title: String {
        let named = productName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return named.isEmpty ? originalPrompt : named
    }
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
