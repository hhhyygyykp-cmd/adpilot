import Foundation
import Security
import UIKit

@MainActor
final class AppModel: ObservableObject {
    @Published var customer: Customer?
    @Published var businesses: [Business] = []
    @Published var campaigns: [Campaign] = []
    @Published var campaign: Campaign?
    @Published var tab = 0
    @Published var busy = false
    @Published var errorMessage: String?
    @Published var queue: [QueueItem] = []
    @Published var queueDestination: QueueDestination?
    @Published var agencyInstagram: AgencyInstagram?
    @Published var customerInstagram: CustomerInstagram?
    @Published var customerAnalysis: CustomerAnalysis?
    private var pendingInstagramState: String?
    private var pendingCustomerInstagram: (businessId: String, state: String)?

    var api = APIClient()
    var language: String { customer?.preferredLanguage ?? "en" }

    func restore() async {
        guard let saved = Keychain.session else { return }
        api.token = saved.token
        api.csrf = saved.csrf
        do {
            let me: MePayload = try await api.send("GET", "/api/auth/me")
            customer = me.customer
            if me.customer == nil { signOutLocal() }
            else {
                await refreshLists()
                await finishPendingCustomerInstagram()
                if customer?.isAdmin == true {
                    await loadAgencyQueue()
                    await finishPendingInstagramConnect()
                }
            }
        } catch {
            signOutLocal()
        }
    }

    func register(name: String, email: String, password: String, language: String) async {
        await auth("POST", "/api/auth/register", [
            "name": name,
            "email": email,
            "password": password,
            "language": language,
        ])
    }

    func login(email: String, password: String) async {
        await auth("POST", "/api/auth/login", ["email": email, "password": password])
    }

    func logout() async {
        busy = true
        defer { busy = false }
        _ = try? await api.data("POST", "/api/auth/logout")
        signOutLocal()
    }

    func refreshLists() async {
        do {
            let businesses: BusinessListPayload = try await api.send("GET", "/api/businesses")
            let campaigns: CampaignListPayload = try await api.send("GET", "/api/campaigns")
            self.businesses = businesses.businesses
            self.campaigns = campaigns.campaigns
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func startBusiness() async -> String? {
        busy = true
        defer { busy = false }
        do {
            let payload: BusinessPayload = try await api.send("POST", "/api/businesses", body: [:])
            await refreshLists()
            return payload.business.id
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    func sendBusiness(_ id: String, text: String? = nil, skip: Bool = false, skipRemaining: Bool = false) async -> Business? {
        var body: [String: Any] = [:]
        if let text { body["text"] = text }
        if skip { body["skip"] = true }
        if skipRemaining { body["skipRemaining"] = true }
        do {
            let payload: BusinessPayload = try await api.send("POST", "/api/businesses/\(id)/conversation", body: body)
            await refreshLists()
            return payload.business
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    func activateBusiness(_ id: String) async {
        do {
            let _: BusinessPayload = try await api.send("POST", "/api/businesses/\(id)/activate")
            await refreshLists()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func startCampaign(prompt: String, businessId: String) async {
        do {
            busy = true
            defer { busy = false }
            let payload: CampaignPayload = try await api.send("POST", "/api/campaigns", body: [
                "prompt": prompt,
                "businessId": businessId,
            ])
            campaign = payload.campaign
            tab = 1
            await refreshLists()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func openCampaign(_ id: String) async {
        tab = 1
        do {
            let payload: CampaignPayload = try await api.send("GET", "/api/campaigns/\(id)")
            campaign = payload.campaign
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func sendCampaign(text: String? = nil, skip: Bool = false, skipRemaining: Bool = false) async {
        guard let id = campaign?.id else { return }
        var body: [String: Any] = [:]
        if let text { body["text"] = text }
        if skip { body["skip"] = true }
        if skipRemaining { body["skipRemaining"] = true }
        do {
            let payload: CampaignPayload = try await api.send("POST", "/api/campaigns/\(id)/message", body: body)
            campaign = payload.campaign
            await refreshLists()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func chooseConcept(id conceptId: String?, recommended: Bool) async {
        guard let id = campaign?.id else { return }
        var body: [String: Any] = [:]
        if let conceptId { body["conceptId"] = conceptId }
        if recommended { body["useRecommended"] = true }
        do {
            let payload: CampaignPayload = try await api.send("POST", "/api/campaigns/\(id)/concept", body: body)
            campaign = payload.campaign
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func confirmCampaign() async {
        guard let id = campaign?.id else { return }
        do {
            let payload: CampaignPayload = try await api.send("POST", "/api/campaigns/\(id)/confirm")
            campaign = payload.campaign
            await refreshLists()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func approveCreative(id creativeId: String, caption: String, requestedAt: String?) async {
        guard let id = campaign?.id else { return }
        do {
            busy = true
            defer { busy = false }
            var body: [String: Any] = ["creativeId": creativeId, "caption": caption]
            if let requestedAt, !requestedAt.isEmpty { body["requestedAt"] = requestedAt }
            let payload: CampaignPayload = try await api.send("POST", "/api/campaigns/\(id)/approve", body: body)
            campaign = payload.campaign
            await refreshLists()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func withdrawPublication(_ publicationId: String) async {
        guard let id = campaign?.id else { return }
        do {
            let payload: CampaignPayload = try await api.send("POST", "/api/campaigns/\(id)/publication", body: [
                "action": "withdraw",
                "publicationId": publicationId,
            ])
            campaign = payload.campaign
            await refreshLists()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func generate(authorizePaid: Bool) async {
        guard let id = campaign?.id else { return }
        do {
            busy = true
            defer { busy = false }
            let payload: GeneratePayload = try await api.send(
                "POST",
                "/api/campaigns/\(id)/generate",
                body: ["authorizePaid": authorizePaid, "video": campaign?.mediaQuote?.wantsVideo ?? false],
                timeout: 600
            )
            campaign = payload.campaign
            await refreshLists()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func saveProfile(name: String) async {
        do {
            let payload: AuthPayload = try await api.send("PATCH", "/api/account", body: ["name": name])
            customer = payload.customer
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func saveLanguage(_ language: String) async {
        do {
            let payload: AuthPayload = try await api.send("PATCH", "/api/account", body: ["language": language])
            customer = payload.customer
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func changePassword(current: String, new: String) async {
        do {
            let _: AuthPayload = try await api.send("PATCH", "/api/account", body: [
                "currentPassword": current,
                "newPassword": new,
            ])
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func creativeData(_ id: String) async throws -> Data {
        try await api.data("GET", "/api/creatives/\(id)")
    }

    func loadAgencyQueue() async {
        guard customer?.isAdmin == true else { return }
        do {
            let instagram: AgencyInstagramPayload = try await api.send("GET", "/api/admin/instagram")
            agencyInstagram = instagram.instagram
            let payload: QueuePayload = try await api.send("GET", "/api/admin/instagram/publications")
            queue = payload.publications
            queueDestination = payload.destination
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func connectInstagram() async {
        guard customer?.isAdmin == true else { return }
        do {
            busy = true
            defer { busy = false }
            let payload: ConnectPayload = try await api.send("POST", "/api/admin/instagram/connect", body: [:])
            guard let url = URL(string: payload.url) else {
                errorMessage = "Meta did not return a login URL."
                return
            }
            await UIApplication.shared.open(url)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func disconnectInstagram() async {
        guard customer?.isAdmin == true else { return }
        do {
            busy = true
            defer { busy = false }
            let payload: AgencyInstagramPayload = try await api.send(
                "POST",
                "/api/admin/instagram",
                body: ["action": "disconnect"]
            )
            agencyInstagram = payload.instagram
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func refreshInstagram() async {
        guard customer?.isAdmin == true else { return }
        do {
            busy = true
            defer { busy = false }
            let payload: AgencyInstagramPayload = try await api.send(
                "POST",
                "/api/admin/instagram",
                body: ["action": "refresh"]
            )
            agencyInstagram = payload.instagram
            await loadAgencyQueue()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func handleIncomingURL(_ url: URL) {
        guard url.scheme == "adpilot" else { return }
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        if url.host == "instagram-customer" {
            tab = 3
            let state = items.first(where: { $0.name == "state" })?.value
            let businessId = items.first(where: { $0.name == "business" })?.value
            let error = items.first(where: { $0.name == "error" })?.value
            if let error, !error.isEmpty { errorMessage = error }
            if let state, !state.isEmpty, let businessId, !businessId.isEmpty {
                pendingCustomerInstagram = (businessId, state)
                Task { await finishPendingCustomerInstagram() }
            }
            return
        }
        guard url.host == "instagram" else { return }
        if customer?.isAdmin == true { tab = 5 }
        let status = items.first(where: { $0.name == "instagram" })?.value
        let error = items.first(where: { $0.name == "error" })?.value
        let state = items.first(where: { $0.name == "state" })?.value
        if status == "pending", let state, !state.isEmpty {
            pendingInstagramState = state
            errorMessage = nil
            Task { await finishPendingInstagramConnect() }
            return
        }
        if status == "connected" {
            errorMessage = nil
        } else if let error, !error.isEmpty {
            errorMessage = error
        }
        Task { await loadAgencyQueue() }
    }

    func loadCustomerInstagram(_ businessId: String) async {
        do {
            let payload: CustomerInstagramPayload = try await api.send("GET", "/api/businesses/\(businessId)/instagram")
            customerInstagram = payload.instagram
            customerAnalysis = payload.analysis
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func connectCustomerInstagram(_ businessId: String) async {
        do {
            busy = true
            defer { busy = false }
            let payload: ConnectPayload = try await api.send("POST", "/api/businesses/\(businessId)/instagram/connect", body: [:])
            guard let url = URL(string: payload.url) else {
                errorMessage = "Instagram did not return a login URL."
                return
            }
            await UIApplication.shared.open(url)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func completeCustomerInstagram(_ businessId: String, state: String) async {
        do {
            busy = true
            defer { busy = false }
            let payload: CustomerInstagramPayload = try await api.send(
                "POST",
                "/api/businesses/\(businessId)/instagram/complete",
                body: ["state": state]
            )
            customerInstagram = payload.instagram
            customerAnalysis = payload.analysis
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func analyzeCustomerInstagram(_ businessId: String) async {
        do {
            busy = true
            defer { busy = false }
            let payload: CustomerInstagramPayload = try await api.send(
                "POST",
                "/api/businesses/\(businessId)/instagram",
                body: ["action": "analyze"]
            )
            customerInstagram = payload.instagram
            customerAnalysis = payload.analysis
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func confirmCustomerInstagram(_ businessId: String, analysisId: String, inferred: InferredInsights) async {
        do {
            busy = true
            defer { busy = false }
            let payload: CustomerInstagramPayload = try await api.send(
                "POST",
                "/api/businesses/\(businessId)/instagram",
                body: ["action": "confirm", "analysisId": analysisId, "inferred": inferred.asBody()]
            )
            customerInstagram = payload.instagram
            customerAnalysis = payload.analysis
            await refreshLists()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func disconnectCustomerInstagram(_ businessId: String) async {
        do {
            busy = true
            defer { busy = false }
            let payload: CustomerInstagramPayload = try await api.send(
                "POST",
                "/api/businesses/\(businessId)/instagram",
                body: ["action": "disconnect"]
            )
            customerInstagram = payload.instagram
            customerAnalysis = payload.analysis
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func finishPendingCustomerInstagram() async {
        guard let pending = pendingCustomerInstagram else { return }
        pendingCustomerInstagram = nil
        await completeCustomerInstagram(pending.businessId, state: pending.state)
        await loadCustomerInstagram(pending.businessId)
    }

    func completeInstagramConnect(_ state: String) async {
        guard customer?.isAdmin == true else { return }
        do {
            busy = true
            defer { busy = false }
            let payload: AgencyInstagramPayload = try await api.send(
                "POST",
                "/api/admin/instagram/complete",
                body: ["state": state]
            )
            agencyInstagram = payload.instagram
            await loadAgencyQueue()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func finishPendingInstagramConnect() async {
        guard customer?.isAdmin == true, let state = pendingInstagramState, !state.isEmpty else { return }
        pendingInstagramState = nil
        await completeInstagramConnect(state)
    }

    func authorizeQueueItem(_ id: String, caption: String) async {
        guard customer?.isAdmin == true else { return }
        do {
            busy = true
            defer { busy = false }
            let _: PublicationActionPayload = try await api.send(
                "POST",
                "/api/admin/instagram/publications/\(id)",
                body: ["action": "authorize", "caption": caption]
            )
            await loadAgencyQueue()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    var activeBusiness: Business? {
        businesses.first { $0.isActive } ?? businesses.first
    }

    private func auth(_ method: String, _ path: String, _ body: [String: Any]) async {
        Keyboard.dismiss()
        busy = true
        defer { busy = false }
        do {
            let payload: AuthPayload = try await api.send(method, path, body: body)
            guard let token = payload.token, let csrf = payload.csrf, !token.isEmpty, !csrf.isEmpty else {
                errorMessage = "The server did not start a phone session."
                return
            }
            api.token = token
            api.csrf = csrf
            Keychain.session = StoredSession(token: token, csrf: csrf)
            customer = payload.customer
            await refreshLists()
            await finishPendingCustomerInstagram()
            if customer?.isAdmin == true {
                await loadAgencyQueue()
                await finishPendingInstagramConnect()
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func signOutLocal() {
        api.token = nil
        api.csrf = nil
        Keychain.session = nil
        customer = nil
        businesses = []
        campaigns = []
        campaign = nil
        queue = []
        queueDestination = nil
        agencyInstagram = nil
        customerInstagram = nil
        customerAnalysis = nil
        pendingInstagramState = nil
        pendingCustomerInstagram = nil
        tab = 0
    }
}

struct StoredSession: Codable {
    var token: String
    var csrf: String
}

enum Keychain {
    private static let service = "app.adpilot.ios"
    private static let account = "session"

    static var session: StoredSession? {
        get {
            let query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service,
                kSecAttrAccount as String: account,
                kSecReturnData as String: true,
                kSecMatchLimit as String: kSecMatchLimitOne,
            ]
            var item: CFTypeRef?
            guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
                  let data = item as? Data else { return nil }
            return try? JSONDecoder().decode(StoredSession.self, from: data)
        }
        set {
            let base: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service,
                kSecAttrAccount as String: account,
            ]
            SecItemDelete(base as CFDictionary)
            guard let newValue, let data = try? JSONEncoder().encode(newValue) else { return }
            var query = base
            query[kSecValueData as String] = data
            SecItemAdd(query as CFDictionary, nil)
        }
    }
}
