import ActivityKit
import Capacitor
import Foundation

// Register this controller from SceneDelegate in the iOS project.
class RideLiveActivityViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(RideLiveActivityPlugin())
    }
}

@objc(RideLiveActivityPlugin)
public class RideLiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RideLiveActivityPlugin"
    public let jsName = "RideLiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    @objc func sync(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        guard let kind = call.getString("kind"), ["rider_trip", "driver_offer"].contains(kind),
              let reference = call.getString("reference"), !reference.isEmpty else {
            call.reject("Activité invalide")
            return
        }
        let phase = call.getString("phase")
        let deadline = call.getDouble("expiresAt").map { Date(timeIntervalSince1970: $0 / 1000) }
        let state = RideActivityAttributes.ContentState(
            kind: kind, phase: phase,
            pickupMinutes: call.getInt("pickupMinutes"), tripMinutes: call.getInt("tripMinutes"),
            remainingMinutes: call.getInt("remainingMinutes"), amountCents: call.getInt("amountCents"),
            expiresAt: deadline
        )
        Task { @MainActor in
            guard ActivityAuthorizationInfo().areActivitiesEnabled else { call.resolve(); return }
            if kind == "driver_offer", let deadline, deadline <= Date() {
                for activity in Activity<RideActivityAttributes>.activities where activity.content.state.kind == kind {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
                call.resolve()
                return
            }
            for activity in Activity<RideActivityAttributes>.activities where activity.attributes.reference != reference || activity.content.state.kind != kind {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            let content = ActivityContent(state: state, staleDate: deadline)
            if let activity = Activity<RideActivityAttributes>.activities.first(where: { $0.attributes.reference == reference && $0.content.state.kind == kind }) {
                await activity.update(content)
            } else {
                do {
                    _ = try Activity.request(attributes: RideActivityAttributes(reference: reference), content: content, pushType: nil)
                } catch {
                    call.reject("Impossible de démarrer l’activité en direct", nil, error)
                    return
                }
            }
            call.resolve()
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        let kind = call.getString("kind")
        Task { @MainActor in
            for activity in Activity<RideActivityAttributes>.activities where kind == nil || activity.content.state.kind == kind {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            call.resolve()
        }
    }
}
