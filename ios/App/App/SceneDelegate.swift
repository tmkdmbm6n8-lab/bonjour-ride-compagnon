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
        // Keep the existing static launch artwork above the remote WebView.
        let splash = UIView()
        let logo = UIImageView(image: UIImage(named: "Splash"))
        logo.contentMode = .scaleAspectFit
        logo.translatesAutoresizingMaskIntoConstraints = false
        splash.addSubview(logo)
        NSLayoutConstraint.activate([
            logo.centerXAnchor.constraint(equalTo: splash.centerXAnchor),
            logo.centerYAnchor.constraint(equalTo: splash.centerYAnchor),
            logo.widthAnchor.constraint(equalToConstant: 128),
            logo.heightAnchor.constraint(equalToConstant: 128)
        ])
        splash.backgroundColor = background
        splash.clipsToBounds = true
        splash.translatesAutoresizingMaskIntoConstraints = false
        controller.view.addSubview(splash)
        NSLayoutConstraint.activate([
            splash.leadingAnchor.constraint(equalTo: controller.view.leadingAnchor),
            splash.trailingAnchor.constraint(equalTo: controller.view.trailingAnchor),
            splash.topAnchor.constraint(equalTo: controller.view.topAnchor),
            splash.bottomAnchor.constraint(equalTo: controller.view.bottomAnchor)
        ])
        window?.makeKeyAndVisible()
        waitForStartupContent(controller, splash: splash, deadline: Date().addingTimeInterval(15))
        DispatchQueue.main.asyncAfter(deadline: .now() + 15) { [weak self, weak splash] in
            if let splash { self?.dismissStartupCover(splash) }
        }

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    private func waitForStartupContent(_ controller: CAPBridgeViewController, splash: UIView, deadline: Date) {
        guard splash.superview != nil else { return }
        if Date() >= deadline {
            dismissStartupCover(splash)
            return
        }
        guard let webView = controller.webView else {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in
                self?.waitForStartupContent(controller, splash: splash, deadline: deadline)
            }
            return
        }
        let script = """
        (() => {
          const logo = document.querySelector('.native-startup-logo');
          if (!logo || document.querySelector('.native-startup-unresolved')) return false;
          const rect = logo.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && getComputedStyle(logo).visibility !== 'hidden';
        })()
        """
        webView.evaluateJavaScript(script) { [weak self] result, _ in
            DispatchQueue.main.async {
                guard let self, splash.superview != nil else { return }
                if result as? Bool == true {
                    self.dismissStartupCover(splash)
                } else {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in
                        self?.waitForStartupContent(controller, splash: splash, deadline: deadline)
                    }
                }
            }
        }
    }

    private func dismissStartupCover(_ splash: UIView) {
        guard splash.superview != nil, splash.alpha == 1 else { return }
        UIView.animate(withDuration: 0.4, animations: {
            splash.alpha = 0
        }, completion: { _ in splash.removeFromSuperview() })
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
