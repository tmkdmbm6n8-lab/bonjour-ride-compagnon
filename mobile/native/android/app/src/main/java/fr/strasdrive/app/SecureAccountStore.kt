package fr.strasdrive.app

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import java.io.File
import java.security.KeyStore
import java.security.MessageDigest
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class SecureAccountStore(private val context: Context) {
    private val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    private fun hash(value: String) = MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it.toInt() and 255) }
    private fun alias(account: String) = "strasdrive.offline." + hash(account)
    private fun directory(account: String) = File(context.noBackupFilesDir, alias(account))
    private fun record(account: String, key: String) = AtomicFile(File(directory(account), hash(key)))
    private fun secret(account: String, create: Boolean): SecretKey {
        (store.getKey(alias(account), null) as? SecretKey)?.let { return it }
        check(create) { "Encryption key unavailable" }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(alias(account),
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setKeySize(256)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true).build())
        }.generateKey()
    }
    private fun aad(account: String, key: String) =
        (hash(account) + hash(key)).toByteArray(Charsets.UTF_8)

    @Synchronized fun write(account: String, key: String, value: String) {
        require(account.isNotBlank() && key.isNotBlank())
        val bytes = value.toByteArray(Charsets.UTF_8)
        require(bytes.size <= 16384)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, secret(account, true))
        cipher.updateAAD(aad(account, key))
        val iv = cipher.iv
        check(iv.size == 12)
        val encrypted = iv + cipher.doFinal(bytes)
        check(directory(account).isDirectory || directory(account).mkdirs())
        val file = record(account, key)
        val stream = file.startWrite()
        try {
            stream.write(encrypted)
            file.finishWrite(stream)
        } catch (error: Exception) {
            file.failWrite(stream)
            throw error
        }
    }

    @Synchronized fun read(account: String, key: String): String? {
        val file = record(account, key)
        if (!file.exists()) return null
        val bytes = file.readFully()
        require(bytes.size in 28..16412)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, secret(account, false),
            GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
        cipher.updateAAD(aad(account, key))
        return String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8)
    }

    @Synchronized fun purgeAccount(account: String) {
        store.deleteEntry(alias(account))
        check(directory(account).deleteRecursively())
    }
}
