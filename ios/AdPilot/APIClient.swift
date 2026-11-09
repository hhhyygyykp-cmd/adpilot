import Foundation

enum APIError: LocalizedError {
    case message(String)

    var errorDescription: String? {
        switch self {
        case .message(let text): return text
        }
    }
}

struct APIClient {
    var baseURL = URL(string: "https://adpilot.apps.grok.bot")!
    var token: String?
    var csrf: String?

    func send<T: Decodable>(
        _ method: String,
        _ path: String,
        body: [String: Any]? = nil,
        timeout: TimeInterval = 60
    ) async throws -> T {
        let data = try await data(method, path, body: body, timeout: timeout)
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.message("The server response could not be read.")
        }
    }

    func data(
        _ method: String,
        _ path: String,
        body: [String: Any]? = nil,
        timeout: TimeInterval = 60
    ) async throws -> Data {
        var request = URLRequest(url: endpoint(path), timeoutInterval: timeout)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token, !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let csrf, !csrf.isEmpty {
            request.setValue(csrf, forHTTPHeaderField: "X-CSRF-Token")
        }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        let http = response as? HTTPURLResponse
        let status = http?.statusCode ?? 0
        let type = http?.value(forHTTPHeaderField: "Content-Type") ?? ""
        if type.contains("text/html") || looksLikeGate(data) {
            throw APIError.message(
                "The AdPilot server is still private. In Cursor, set the hosted app to Public so this phone can reach it."
            )
        }
        if status == 401 {
            let message = errorMessage(data) ?? "Please sign in"
            throw APIError.message(message)
        }
        if status >= 400 {
            throw APIError.message(errorMessage(data) ?? "Request failed (\(status))")
        }
        return data
    }

    private func endpoint(_ path: String) -> URL {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) ?? URLComponents()
        components.path = path.hasPrefix("/") ? path : "/" + path
        return components.url ?? baseURL
    }

    private func looksLikeGate(_ data: Data) -> Bool {
        guard let text = String(data: data, encoding: .utf8) else { return false }
        return text.contains("sign_in_required") || text.contains("apps-gate/authorize")
    }

    private func errorMessage(_ data: Data) -> String? {
        struct Body: Decodable { var error: String? }
        return (try? JSONDecoder().decode(Body.self, from: data))?.error
    }
}
