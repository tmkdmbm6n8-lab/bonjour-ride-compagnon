import UIKit
import Capacitor
import ActivityKit
#if canImport(LiveActivityPlugin)
import LiveActivityPlugin
#endif

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        #if canImport(LiveActivityPlugin)
        if #available(iOS 16.2, *) {
            StrasDriveOfferManager.shared.start()
        }
        #endif
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {}

    func applicationDidEnterBackground(_ application: UIApplication) {}

    func applicationWillEnterForeground(_ application: UIApplication) {}

    func applicationDidBecomeActive(_ application: UIApplication) {}

    func applicationWillTerminate(_ application: UIApplication) {
        StrasDriveOnlineArrow.endAllBlocking()
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }
}

// Controller unique pour enregistrer les plugins Capacitor
class StrasDriveBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        #if canImport(LiveActivityPlugin)
        bridge?.registerPluginInstance(StrasDriveOffersPlugin())
        #endif
    }
}

#if canImport(LiveActivityPlugin)
@objc(StrasDriveOffersPlugin)
public class StrasDriveOffersPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StrasDriveOffersPlugin"
    public let jsName = "StrasDriveOffers"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endOffers", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reconcile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setOnline", returnType: CAPPluginReturnPromise)
    ]

    @objc func setOnline(_ call: CAPPluginCall) {
        let online = call.getBool("online") ?? false
        Task { @MainActor in
            StrasDriveOnlineArrow.setOnline(online)
            call.resolve()
        }
    }

    @objc func configure(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"), let url = URL(string: raw),
              url.scheme == "https", url.host == "strasdrive.fr",
              url.path == "/api/public/native/live-activity-token",
              let device = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "device" })?.value,
              device.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil else {
            call.reject("Invalid callback URL"); return
        }
        Task { @MainActor in
            if #available(iOS 16.2, *) { StrasDriveOfferManager.shared.configure(url) }
            call.resolve()
        }
    }

    @objc func clear(_ call: CAPPluginCall) {
        Task { @MainActor in
            if #available(iOS 16.2, *) {
                StrasDriveOfferManager.shared.clear()
                await StrasDriveOfferManager.shared.endOffers(id: nil)
            }
            call.resolve()
        }
    }

    @objc func endOffers(_ call: CAPPluginCall) {
        let id = call.getString("id")
        Task { @MainActor in
            if #available(iOS 16.2, *) { await StrasDriveOfferManager.shared.endOffers(id: id) }
            call.resolve()
        }
    }

    @objc func reconcile(_ call: CAPPluginCall) {
        Task { @MainActor in
            if #available(iOS 16.2, *) { await StrasDriveOfferManager.shared.reconcile() }
            call.resolve()
        }
    }
}

@available(iOS 16.2, *)
@MainActor
private final class StrasDriveOfferManager {
    static let shared = StrasDriveOfferManager()
    private let endpointKey = "sd.native.offer-token-endpoint"
    private var endpoint: URL?
    private var discovery: Task<Void, Never>?
    private var observers: [String: Task<Void, Never>] = [:]
    private var generation = UUID()

    func start() {
        if endpoint == nil, let raw = UserDefaults.standard.string(forKey: endpointKey) {
            endpoint = URL(string: raw)
        }
        guard discovery == nil else { return }
        scan()
        discovery = Task { [weak self] in
            for await activity in Activity<GenericAttributes>.activityUpdates {
                self?.observe(activity)
            }
        }
    }

    func configure(_ url: URL) {
        if endpoint != url { generation = UUID() }
        endpoint = url
        UserDefaults.standard.set(url.absoluteString, forKey: endpointKey)
        start()
        scan()
    }

    func clear() {
        generation = UUID()
        endpoint = nil
        UserDefaults.standard.removeObject(forKey: endpointKey)
    }

    private func scan() {
        for activity in Activity<GenericAttributes>.activities {
            observe(activity)
            if let token = activity.pushToken {
                Task { await self.send(token, for: activity) }
            }
        }
    }

    private func observe(_ activity: Activity<GenericAttributes>) {
        guard observers[activity.id] == nil else { return }
        observers[activity.id] = Task { [weak self] in
            for await token in activity.pushTokenUpdates {
                await self?.send(token, for: activity)
            }
            self?.observers.removeValue(forKey: activity.id)
        }
    }

    private func send(_ token: Data, for activity: Activity<GenericAttributes>) async {
        guard let url = endpoint else { return }
        let currentGeneration = generation
        let payload = ["id": activity.attributes.id, "activityId": activity.id,
                       "token": token.map { String(format: "%02x", $0) }.joined()]
        for attempt in 0..<3 {
            guard endpoint == url, generation == currentGeneration else { return }
            do {
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.timeoutInterval = 15
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                request.httpBody = try JSONSerialization.data(withJSONObject: payload)
                let (data, response) = try await URLSession.shared.data(for: request)
                guard endpoint == url, generation == currentGeneration else { return }
                if let http = response as? HTTPURLResponse {
                    if (200...299).contains(http.statusCode) {
                        let result = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
                        if result?["closing"] as? Bool == true {
                            await activity.end(nil, dismissalPolicy: .immediate)
                        }
                        return
                    }
                    if (400..<500).contains(http.statusCode), http.statusCode != 429 { return }
                }
            } catch {}
            if attempt < 2 { try? await Task.sleep(nanoseconds: UInt64(attempt + 1) * 2_000_000_000) }
        }
    }

    func endOffers(id: String?) async {
        for activity in Activity<GenericAttributes>.activities {
            if let id, activity.attributes.id != id { continue }
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }

    func reconcile() async {
        for activity in Activity<GenericAttributes>.activities {
            let values = activity.content.state.values
            let deadline = Double(values["expiresAt"] ?? "") ?? 0
            if values["type"] != "driver_offer" || deadline <= Date().timeIntervalSince1970 {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        }
        scan()
    }
}
#endif

// MARK: - Flèche dorée « En ligne » (Dynamic Island épurée)
@MainActor
enum StrasDriveOnlineArrow {
    private static let key = "sd.native.driver-online"
    static var isOnline: Bool { UserDefaults.standard.bool(forKey: key) }

    static func setOnline(_ online: Bool) {
        UserDefaults.standard.set(online, forKey: key)
        if !online { hide() }
    }

    static func show() {
        guard isOnline else { return }
        if #available(iOS 16.2, *) {
            guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
            let running = Activity<GenericAttributes>.activities.contains {
                $0.attributes.id == "driver-online" || $0.attributes.staticValues["type"] == "driver_online"
            }
            if running { return }
            let attributes = GenericAttributes(id: "driver-online", staticValues: ["type": "driver_online"])
            let state = GenericAttributes.ContentState(values: ["type": "driver_online"])
            _ = try? Activity.request(attributes: attributes, content: .init(state: state, staleDate: nil), pushType: nil)
        }
    }

    static func hide() {
        if #available(iOS 16.2, *) {
            for activity in Activity<GenericAttributes>.activities {
                if activity.attributes.id == "driver-online" || activity.attributes.staticValues["type"] == "driver_online" {
                    Task { await activity.end(nil, dismissalPolicy: .immediate) }
                }
            }
        }
    }

    nonisolated static func endAllBlocking() {
        guard #available(iOS 16.2, *) else { return }
        let done = DispatchSemaphore(value: 0)
        Task.detached {
            for activity in Activity<GenericAttributes>.activities {
                if activity.attributes.id == "driver-online" || activity.attributes.staticValues["type"] == "driver_online" {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
            }
            done.signal()
        }
        _ = done.wait(timeout: .now() + 2)
    }
}
