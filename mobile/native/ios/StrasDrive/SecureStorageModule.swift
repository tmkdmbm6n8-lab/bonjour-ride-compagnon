import Foundation
import React

@objc(StrasDriveEncryptedStorage)
final class SecureStorageModule: NSObject {
    private let store = SecureAccountStore()
    private let queue = DispatchQueue(label: "fr.strasdrive.securestorage")

    @objc static func requiresMainQueueSetup() -> Bool { false }

    @objc(read:key:resolver:rejecter:)
    func read(_ account: String, key: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        queue.async {
            do { resolve(try self.store.read(account, key)) }
            catch { reject("SECURE_STORAGE", "Stockage sécurisé indisponible", error) }
        }
    }

    @objc(write:key:value:resolver:rejecter:)
    func write(_ account: String, key: String, value: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        queue.async {
            do { try self.store.write(account, key, value); resolve(nil) }
            catch { reject("SECURE_STORAGE", "Stockage sécurisé indisponible", error) }
        }
    }

    @objc(purgeAccount:resolver:rejecter:)
    func purgeAccount(_ account: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        queue.async {
            do { try self.store.purgeAccount(account); resolve(nil) }
            catch { reject("SECURE_STORAGE", "Effacement impossible", error) }
        }
    }
}
