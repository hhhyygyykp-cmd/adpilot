import Foundation

enum APIError: LocalizedError {
    case message(String)

    var errorDescription: String? {
        switch self {
        case .message(let text): return text
        }
    }
}

enum APIEnvironment {
    /// Xcode Run uses Debug and talks to the Next.js server on this Mac.
    /// Archive and Release keep the hosted address and do not make it public.
    static let baseURL: URL = {
        #if DEBUG
        return URL(string: "http://127.0.0.1:3000")!
        #else
        return URL(string: "https://adpilot.apps.grok.bot")!
        #endif
    }()
}

struct APIClient {
    var baseURL = APIEnvironment.baseURL
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
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw APIError.message(
                "Cannot reach AdPilot at \(baseURL.absoluteString). On this Mac, run npm run dev and leave it running."
            )
        }
        let http = response as? HTTPURLResponse
        let status = http?.statusCode ?? 0
        let type = http?.value(forHTTPHeaderField: "Content-Type") ?? ""
        if looksLikeGate(data) {
            throw APIError.message(
                "This request reached the private hosted app. Run from Xcode using the Debug configuration so it uses http://127.0.0.1:3000."
            )
        }
        if type.contains("text/html") {
            throw APIError.message(
                "AdPilot at \(baseURL.absoluteString) did not return app data. Start the local server with npm run dev."
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
