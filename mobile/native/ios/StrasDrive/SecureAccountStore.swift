import Foundation
import Security
import CryptoKit

// Small JSON records only; large documents require encrypted file storage.
final class SecureAccountStore {
    private func service(_ account: String) -> String {
        let digest = SHA256.hash(data: Data(account.utf8))
        return "fr.strasdrive.offline." + digest.map { String(format: "%02x", $0) }.joined()
    }

    private func query(_ account: String, _ key: String? = nil) -> [String: Any] {
        var result: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service(account),
            kSecAttrSynchronizable as String: false
        ]
        if let key = key { result[kSecAttrAccount as String] = key }
        return result
    }

    private func check(_ status: OSStatus) throws {
        guard status == errSecSuccess else {
            throw NSError(domain: NSOSStatusErrorDomain, code: Int(status))
        }
    }

    func read(_ account: String, _ key: String) throws -> String? {
        var request = query(account, key)
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        let status = SecItemCopyMatching(request as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        try check(status)
        guard let data = item as? Data, let value = String(data: data, encoding: .utf8) else {
            throw NSError(domain: "StrasDriveStorage", code: 1)
        }
        return value
    }

    func write(_ account: String, _ key: String, _ value: String) throws {
        let data = Data(value.utf8)
        guard data.count <= 16384 else {
            throw NSError(domain: "StrasDriveStorage", code: 2)
        }
        let request = query(account, key)
        let attributes = [kSecValueData as String: data]
        let status = SecItemUpdate(request as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var item = request
            item[kSecValueData as String] = data
            item[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            try check(SecItemAdd(item as CFDictionary, nil))
        } else {
            try check(status)
        }
    }

    func purgeAccount(_ account: String) throws {
        let status = SecItemDelete(query(account) as CFDictionary)
        if status != errSecItemNotFound { try check(status) }
    }
}
