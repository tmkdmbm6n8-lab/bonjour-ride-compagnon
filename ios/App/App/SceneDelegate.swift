import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        let background = UIColor(red: 14.0 / 255.0, green: 15.0 / 255.0, blue: 18.0 / 255.0, alpha: 1)
        let controller = CAPBridgeViewController()
        window?.backgroundColor = background
        window?.rootViewController = controller
        controller.view.backgroundColor = background
        controller.webView?.isOpaque = false
        controller.webView?.backgroundColor = background
        controller.webView?.scrollView.backgroundColor = background
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
