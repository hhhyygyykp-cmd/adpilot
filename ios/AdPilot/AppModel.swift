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

    var api = APIClient()
    var language: String { customer?.preferredLanguage ?? "en" }

    func restore() async {
        guard let saved = Keychain.token else { return }
        api.token = saved
        do {
            let me: MePayload = try await api.send("GET", "/api/auth/me")
            customer = me.customer
            if me.customer == nil { signOutLocal() }
            else { await refreshLists() }
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

    func generate(authorizePaid: Bool) async {
        guard let id = campaign?.id else { return }
        do {
            busy = true
            defer { busy = false }
            let payload: GeneratePayload = try await api.send(
                "POST",
                "/api/campaigns/\(id)/generate",
                body: ["authorizePaid": authorizePaid, "video": campaign?.mediaQuote?.wantsVideo ?? false],
                timeout: 300
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

    var activeBusiness: Business? {
        businesses.first { $0.isActive } ?? businesses.first
    }

    private func auth(_ method: String, _ path: String, _ body: [String: Any]) async {
        Keyboard.dismiss()
        busy = true
        defer { busy = false }
        do {
            let payload: AuthPayload = try await api.send(method, path, body: body)
            guard let token = payload.token, !token.isEmpty else {
                errorMessage = "The server did not start a phone session."
                return
            }
            api.token = token
            Keychain.token = token
            customer = payload.customer
            await refreshLists()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func signOutLocal() {
        api.token = nil
        Keychain.token = nil
        customer = nil
        businesses = []
        campaigns = []
        campaign = nil
        tab = 0
    }
}

enum Keychain {
    private static let service = "app.adpilot.ios"
    private static let account = "session"

    static var token: String? {
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
                  let data = item as? Data,
                  let value = String(data: data, encoding: .utf8) else { return nil }
            return value
        }
        set {
            let base: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service,
                kSecAttrAccount as String: account,
            ]
            SecItemDelete(base as CFDictionary)
            guard let newValue, let data = newValue.data(using: .utf8) else { return }
            var query = base
            query[kSecValueData as String] = data
            SecItemAdd(query as CFDictionary, nil)
        }
    }
}
