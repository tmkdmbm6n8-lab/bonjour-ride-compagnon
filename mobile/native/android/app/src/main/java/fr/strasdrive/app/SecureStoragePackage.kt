package fr.strasdrive.app

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager

class SecureStoragePackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
        listOf(SecureStorageModule(context))
    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}

class SecureStorageModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    private val storage by lazy { SecureAccountStore(context) }
    override fun getName() = "StrasDriveEncryptedStorage"
    private fun execute(promise: Promise, operation: () -> Any?) {
        try { promise.resolve(operation()) }
        catch (error: Exception) { promise.reject("SECURE_STORAGE", "Stockage sécurisé indisponible", error) }
    }
    @ReactMethod fun read(account: String, key: String, promise: Promise) =
        execute(promise) { storage.read(account, key) }
    @ReactMethod fun write(account: String, key: String, value: String, promise: Promise) =
        execute(promise) { storage.write(account, key, value); null }
    @ReactMethod fun purgeAccount(account: String, promise: Promise) =
        execute(promise) { storage.purgeAccount(account); null }
}
