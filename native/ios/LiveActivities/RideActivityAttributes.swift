import ActivityKit
import Foundation

// Shared by the future iOS app target and its Widget extension.
@available(iOS 16.2, *)
struct RideActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        // driver_offer or rider_trip; values are derived from server-verified data.
        var kind: String
        var phase: String?
        var pickupMinutes: Int?
        var tripMinutes: Int?
        var remainingMinutes: Int?
        var amountCents: Int?
        var expiresAt: Date?
    }

    var reference: String
}
