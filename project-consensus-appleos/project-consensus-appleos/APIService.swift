import Foundation

// MARK: - Configuration

private let baseURL = "https://api.polyu.life/api"

// MARK: - Error Types

enum APIError: LocalizedError {
    case invalidURL
    case encodingFailed
    case decodingFailed(Error)
    case httpError(statusCode: Int, data: Data?)
    case unauthorized
    case forbidden
    case notFound
    case serverError(statusCode: Int)
    case networkError(Error)
    case csrfTokenMissing

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .encodingFailed:
            return "Failed to encode request body"
        case .decodingFailed(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .httpError(let code, _):
            return "HTTP error \(code)"
        case .unauthorized:
            return "Authentication required"
        case .forbidden:
            return "Access denied"
        case .notFound:
            return "Resource not found"
        case .serverError(let code):
            return "Server error \(code)"
        case .networkError(let error):
            return error.localizedDescription
        case .csrfTokenMissing:
            return "CSRF token not available"
        }
    }
}

// MARK: - HTTP Method

enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case patch = "PATCH"
    case put = "PUT"
    case delete = "DELETE"
}

// MARK: - Paginated Response

struct PaginatedResponse<T: Decodable>: Decodable {
    let count: Int
    let next: String?
    let previous: String?
    let results: [T]
}

// MARK: - Empty Body Helpers

struct EmptyBody: Encodable {}
struct EmptyResponse: Decodable {}

// MARK: - API Service

@Observable
final class APIService {
    static let shared = APIService()

    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder
    private var csrfToken: String?

    private init() {
        let config = URLSessionConfiguration.default
        config.httpCookieAcceptPolicy = .always
        config.httpShouldSetCookies = true
        config.httpCookieStorage = .shared

        session = URLSession(configuration: config)

        decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601

        encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
    }

    // MARK: - CSRF

    /// Fetches a CSRF token from the backend and stores it for subsequent mutating requests.
    func fetchCSRFToken() async throws {
        let url = try buildURL(path: "/accounts/csrf/")
        var request = URLRequest(url: url)
        request.httpMethod = HTTPMethod.get.rawValue

        let (_, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200..<300).contains(httpResponse.statusCode) else {
            throw APIError.httpError(
                statusCode: (response as? HTTPURLResponse)?.statusCode ?? -1,
                data: nil
            )
        }

        if let cookies = HTTPCookieStorage.shared.cookies(for: url) {
            csrfToken = cookies.first(where: { $0.name == "csrftoken" })?.value
        }
    }

    // MARK: - Public Request Methods

    /// `GET` request that decodes the response into `T`.
    func get<T: Decodable>(
        _ path: String,
        queryItems: [String: String]? = nil
    ) async throws -> T {
        return try await request(path: path, method: .get, queryItems: queryItems)
    }

    /// `POST` request with an `Encodable` body, decoding the response into `T`.
    func post<Body: Encodable, T: Decodable>(
        _ path: String,
        body: Body
    ) async throws -> T {
        return try await request(path: path, method: .post, body: body)
    }

    /// `POST` with no request body.
    func post<T: Decodable>(_ path: String) async throws -> T {
        return try await request(path: path, method: .post, body: EmptyBody())
    }

    /// `PATCH` request with an `Encodable` body.
    func patch<Body: Encodable, T: Decodable>(
        _ path: String,
        body: Body
    ) async throws -> T {
        return try await request(path: path, method: .patch, body: body)
    }

    /// `PUT` request with an `Encodable` body.
    func put<Body: Encodable, T: Decodable>(
        _ path: String,
        body: Body
    ) async throws -> T {
        return try await request(path: path, method: .put, body: body)
    }

    /// `DELETE` request.
    func delete(_ path: String) async throws {
        let _: EmptyResponse = try await request(path: path, method: .delete)
    }

    // MARK: - Core Request Builder

    private func request<T: Decodable>(
        path: String,
        method: HTTPMethod,
        queryItems: [String: String]? = nil,
        body: (any Encodable)? = nil
    ) async throws -> T {
        let url = try buildURL(path: path, queryItems: queryItems)
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = method.rawValue
        urlRequest.setValue("application/json", forHTTPHeaderField: "Accept")

        if let body, !(body is EmptyBody) {
            urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
            guard let data = try? encoder.encode(body) else {
                throw APIError.encodingFailed
            }
            urlRequest.httpBody = data
        }

        if method != .get {
            if csrfToken == nil { try await fetchCSRFToken() }
            guard let token = csrfToken else { throw APIError.csrfTokenMissing }
            urlRequest.setValue(token, forHTTPHeaderField: "X-CSRFToken")
        }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: urlRequest)
        } catch {
            throw APIError.networkError(error)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.httpError(statusCode: -1, data: nil)
        }

        try mapHTTPErrors(statusCode: httpResponse.statusCode, data: data)

        if T.self == EmptyResponse.self, let empty = EmptyResponse() as? T {
            return empty
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingFailed(error)
        }
    }

    // MARK: - Helpers

    private func buildURL(path: String, queryItems: [String: String]? = nil) throws -> URL {
        let fullPath = baseURL + path
        guard var components = URLComponents(string: fullPath) else {
            throw APIError.invalidURL
        }
        if let queryItems {
            components.queryItems = queryItems.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        guard let url = components.url else {
            throw APIError.invalidURL
        }
        return url
    }

    private func mapHTTPErrors(statusCode: Int, data: Data) throws {
        switch statusCode {
        case 200..<300:
            return
        case 401:
            throw APIError.unauthorized
        case 403:
            csrfToken = nil
            throw APIError.forbidden
        case 404:
            throw APIError.notFound
        case 500...599:
            throw APIError.serverError(statusCode: statusCode)
        default:
            throw APIError.httpError(statusCode: statusCode, data: data)
        }
    }
}
