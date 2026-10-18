package com.oldalexhub.innerfolio

import android.content.ContentValues
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.*
import net.zetetic.database.sqlcipher.SQLiteDatabase
import org.json.JSONArray
import org.json.JSONObject
import java.security.KeyStore
import java.security.SecureRandom
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec

class VaultModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  companion object {
    private const val PREFS = "innerfolio_vault_metadata"
    private const val DB_NAME = "innerfolio-vault.db"
    private const val KDF_ITERATIONS = 600_000
    private const val KEY_BITS = 256
    private const val WRAP_VERSION = 1
    private const val BIOMETRIC_ALIAS = "innerfolio-biometric-v1"
    private const val SECRET_ALIAS = "innerfolio-device-secrets-v1"
  }

  private val prefs = context.getSharedPreferences(PREFS, 0)
  private val random = SecureRandom()
  private var database: SQLiteDatabase? = null
  private var activeKey: ByteArray? = null

  override fun getName() = "InnerfolioVault"

  @ReactMethod fun hasVault(promise: Promise) = promise.resolve(prefs.contains("wrappedKey"))
  @ReactMethod fun isUnlocked(promise: Promise) = promise.resolve(database?.isOpen == true)

  @ReactMethod
  fun createVault(password: String, promise: Promise) {
    try {
      require(password.length >= 10) { "Password must contain at least 10 characters" }
      if (prefs.contains("wrappedKey")) throw IllegalStateException("A vault already exists")
      val vaultKey = randomBytes(32)
      val wrapped = wrapWithPassword(vaultKey, password)
      prefs.edit().putInt("wrapVersion", WRAP_VERSION).putInt("kdfIterations", KDF_ITERATIONS)
        .putString("salt", b64(wrapped.salt)).putString("iv", b64(wrapped.iv))
        .putString("wrappedKey", b64(wrapped.ciphertext)).commit()
      try {
        open(vaultKey)
      } catch (error: Exception) {
        prefs.edit().clear().commit()
        context.getDatabasePath(DB_NAME).delete()
        throw error
      }
      promise.resolve(true)
    } catch (error: Exception) { reject(promise, "VAULT_CREATE_FAILED", error) }
  }

  @ReactMethod
  fun unlock(password: String, promise: Promise) {
    try {
      val key = unwrapWithPassword(password)
      open(key)
      promise.resolve(true)
    } catch (error: AEADBadTagException) { promise.reject("WRONG_PASSWORD", "Password is incorrect")
    } catch (error: Exception) { reject(promise, "VAULT_OPEN_FAILED", error) }
  }

  @ReactMethod
  fun lock(promise: Promise) {
    closeVault()
    promise.resolve(true)
  }

  @ReactMethod
  fun changePassword(currentPassword: String, newPassword: String, promise: Promise) {
    try {
      require(newPassword.length >= 10) { "New password must contain at least 10 characters" }
      val key = unwrapWithPassword(currentPassword)
      val wrapped = wrapWithPassword(key, newPassword)
      prefs.edit().putInt("wrapVersion", WRAP_VERSION).putInt("kdfIterations", KDF_ITERATIONS)
        .putString("salt", b64(wrapped.salt)).putString("iv", b64(wrapped.iv))
        .putString("wrappedKey", b64(wrapped.ciphertext)).commit()
      key.fill(0)
      promise.resolve(true)
    } catch (error: AEADBadTagException) { promise.reject("WRONG_PASSWORD", "Current password is incorrect")
    } catch (error: Exception) { reject(promise, "PASSWORD_CHANGE_FAILED", error) }
  }

  @ReactMethod
  fun putRecord(type: String, id: String, json: String, updatedAt: String, promise: Promise) {
    try {
      require(type.matches(Regex("[a-z_]{2,40}")) && id.length in 1..128)
      val db = requireDb()
      val values = ContentValues().apply { put("type", type); put("id", id); put("json", json); put("updated_at", updatedAt) }
      db.insertWithOnConflict("records", null, values, SQLiteDatabase.CONFLICT_REPLACE)
      promise.resolve(true)
    } catch (error: Exception) { reject(promise, "VAULT_WRITE_FAILED", error) }
  }

  @ReactMethod
  fun getRecord(type: String, id: String, promise: Promise) {
    try {
      requireDb().rawQuery("SELECT json FROM records WHERE type=? AND id=?", arrayOf(type, id)).use { cursor ->
        promise.resolve(if (cursor.moveToFirst()) cursor.getString(0) else null)
      }
    } catch (error: Exception) { reject(promise, "VAULT_READ_FAILED", error) }
  }

  @ReactMethod
  fun listRecords(type: String, promise: Promise) {
    try {
      val output = Arguments.createArray()
      requireDb().rawQuery("SELECT json FROM records WHERE type=? ORDER BY updated_at DESC", arrayOf(type)).use { cursor ->
        while (cursor.moveToNext()) output.pushString(cursor.getString(0))
      }
      promise.resolve(output)
    } catch (error: Exception) { reject(promise, "VAULT_READ_FAILED", error) }
  }

  @ReactMethod
  fun listAllRecords(promise: Promise) {
    try {
      val output = Arguments.createArray()
      requireDb().rawQuery("SELECT type,id,json,updated_at FROM records ORDER BY type,id", null).use { cursor ->
        while (cursor.moveToNext()) output.pushMap(Arguments.createMap().apply {
          putString("type", cursor.getString(0)); putString("id", cursor.getString(1)); putString("json", cursor.getString(2)); putString("updatedAt", cursor.getString(3))
        })
      }
      promise.resolve(output)
    } catch (error: Exception) { reject(promise, "VAULT_READ_FAILED", error) }
  }

  @ReactMethod
  fun replaceAllRecords(recordsJson: String, promise: Promise) {
    try {
      val parsed = JSONArray(recordsJson)
      require(parsed.length() <= 100_000) { "Backup contains too many records" }
      val records = ArrayList<JSONObject>(parsed.length())
      for (index in 0 until parsed.length()) {
        val item = parsed.getJSONObject(index)
        val type = item.getString("type"); val id = item.getString("id"); val json = item.getString("json"); val updatedAt = item.getString("updatedAt")
        require(type.matches(Regex("[a-z_]{2,40}")) && id.length in 1..128 && json.length <= 2_000_000 && updatedAt.length <= 40)
        JSONObject(json)
        records.add(item)
      }
      val db = requireDb(); db.beginTransaction()
      try {
        db.delete("records", null, null)
        records.forEach { item -> db.insertOrThrow("records", null, ContentValues().apply { put("type", item.getString("type")); put("id", item.getString("id")); put("json", item.getString("json")); put("updated_at", item.getString("updatedAt")) }) }
        db.setTransactionSuccessful()
      } finally { db.endTransaction() }
      promise.resolve(records.size)
    } catch (error: Exception) { reject(promise, "BACKUP_VALIDATION_FAILED", error) }
  }

  @ReactMethod
  fun deleteRecord(type: String, id: String, promise: Promise) {
    try {
      val db = requireDb()
      db.beginTransaction()
      try {
        db.delete("records", "type=? AND id=?", arrayOf(type, id))
        if (type == "entry") {
          db.delete("records", "type IN ('extracted_item','observation','analysis_job') AND json LIKE ?", arrayOf("%\"entryId\":\"${escapeLike(id)}\"%"))
        }
        db.setTransactionSuccessful()
      } finally { db.endTransaction() }
      promise.resolve(true)
    } catch (error: Exception) { reject(promise, "VAULT_DELETE_FAILED", error) }
  }

  @ReactMethod
  fun clearType(type: String, promise: Promise) {
    try { requireDb().delete("records", "type=?", arrayOf(type)); promise.resolve(true) }
    catch (error: Exception) { reject(promise, "VAULT_DELETE_FAILED", error) }
  }

  @ReactMethod
  fun eraseVault(promise: Promise) {
    try {
      closeVault()
      context.getDatabasePath(DB_NAME).delete()
      // A failed server deletion is the sole value allowed to survive local
      // erasure, so the app can retry without retaining journal content.
      val pendingIv = prefs.getString("secret_pending_remote_deletion_iv", null)
      val pendingData = prefs.getString("secret_pending_remote_deletion_data", null)
      val editor = prefs.edit().clear()
      if (pendingIv != null && pendingData != null) {
        editor.putString("secret_pending_remote_deletion_iv", pendingIv)
          .putString("secret_pending_remote_deletion_data", pendingData)
      }
      editor.commit()
      deleteKeystoreKey(BIOMETRIC_ALIAS)
      if (pendingData == null) deleteKeystoreKey(SECRET_ALIAS)
      promise.resolve(true)
    } catch (error: Exception) { reject(promise, "VAULT_ERASE_FAILED", error) }
  }

  @ReactMethod
  fun integrityCheck(promise: Promise) {
    try {
      requireDb().rawQuery("PRAGMA integrity_check", null).use { cursor ->
        promise.resolve(cursor.moveToFirst() && cursor.getString(0) == "ok")
      }
    } catch (error: Exception) { reject(promise, "VAULT_DAMAGED", error) }
  }

  @ReactMethod
  fun biometricAvailable(promise: Promise) {
    val result = BiometricManager.from(context).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
    promise.resolve(result == BiometricManager.BIOMETRIC_SUCCESS)
  }

  @ReactMethod
  fun biometricEnabled(promise: Promise) = promise.resolve(prefs.contains("biometricCiphertext"))

  @ReactMethod
  fun enableBiometric(promise: Promise) {
    val key = activeKey?.clone() ?: return promise.reject("VAULT_LOCKED", "Unlock the vault first")
    try {
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.ENCRYPT_MODE, createBiometricKey())
      showBiometric(cipher, "Enable biometric unlock", "Confirm to protect your vault key", { code -> key.fill(0); promise.reject("BIOMETRIC_CANCELLED", code) }) { authenticated ->
        try {
          val encrypted = authenticated.doFinal(key)
          prefs.edit().putString("biometricIv", b64(authenticated.iv)).putString("biometricCiphertext", b64(encrypted)).commit()
          key.fill(0)
          promise.resolve(true)
        } catch (error: Exception) { key.fill(0); reject(promise, "BIOMETRIC_SETUP_FAILED", error) }
      }
    } catch (error: Exception) { key.fill(0); reject(promise, "BIOMETRIC_SETUP_FAILED", error) }
  }

  @ReactMethod
  fun unlockBiometric(promise: Promise) {
    try {
      val encrypted = prefs.getString("biometricCiphertext", null) ?: return promise.reject("BIOMETRIC_NOT_CONFIGURED", "Biometric unlock is not configured")
      val iv = fromB64(prefs.getString("biometricIv", null)!!)
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, getKeystoreKey(BIOMETRIC_ALIAS), GCMParameterSpec(128, iv))
      showBiometric(cipher, "Unlock Innerfolio", "Use your biometric or enter your password", { code -> promise.reject("BIOMETRIC_CANCELLED", code) }) { authenticated ->
        try { open(authenticated.doFinal(fromB64(encrypted))); promise.resolve(true) }
        catch (error: Exception) { reject(promise, "BIOMETRIC_UNLOCK_FAILED", error) }
      }
    } catch (error: KeyPermanentlyInvalidatedException) {
      prefs.edit().remove("biometricCiphertext").remove("biometricIv").apply()
      promise.reject("BIOMETRIC_INVALIDATED", "Biometrics changed. Unlock with your password and enable biometrics again.")
    } catch (error: Exception) { reject(promise, "BIOMETRIC_UNLOCK_FAILED", error) }
  }

  @ReactMethod
  fun disableBiometric(promise: Promise) {
    prefs.edit().remove("biometricCiphertext").remove("biometricIv").apply()
    deleteKeystoreKey(BIOMETRIC_ALIAS)
    promise.resolve(true)
  }

  @ReactMethod
  fun setProtectedSecret(name: String, value: String, promise: Promise) {
    try {
      require(name.matches(Regex("[a-z_]{2,40}")))
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.ENCRYPT_MODE, getOrCreateSecretKey())
      val encrypted = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
      prefs.edit().putString("secret_${name}_iv", b64(cipher.iv)).putString("secret_${name}_data", b64(encrypted)).commit()
      promise.resolve(true)
    } catch (error: Exception) { reject(promise, "SECRET_STORE_FAILED", error) }
  }

  @ReactMethod
  fun getProtectedSecret(name: String, promise: Promise) {
    try {
      val data = prefs.getString("secret_${name}_data", null) ?: return promise.resolve(null)
      val iv = prefs.getString("secret_${name}_iv", null) ?: return promise.resolve(null)
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, getKeystoreKey(SECRET_ALIAS), GCMParameterSpec(128, fromB64(iv)))
      promise.resolve(String(cipher.doFinal(fromB64(data)), Charsets.UTF_8))
    } catch (error: Exception) { reject(promise, "SECRET_READ_FAILED", error) }
  }

  @ReactMethod
  fun clearProtectedSecret(name: String, promise: Promise) {
    try {
      require(name.matches(Regex("[a-z_]{2,40}")))
      prefs.edit().remove("secret_${name}_iv").remove("secret_${name}_data").commit()
      promise.resolve(true)
    } catch (error: Exception) { reject(promise, "SECRET_CLEAR_FAILED", error) }
  }

  private fun open(key: ByteArray) {
    closeVault()
    val file = context.getDatabasePath(DB_NAME)
    file.parentFile?.mkdirs()
    val db = SQLiteDatabase.openOrCreateDatabase(file, key, null, null)
    db.execSQL("PRAGMA foreign_keys=ON")
    migrate(db)
    database = db
    activeKey = key.clone()
    key.fill(0)
  }

  private fun migrate(db: SQLiteDatabase) {
    val version = db.version
    if (version > 1) throw IllegalStateException("Vault schema is newer than this app")
    if (version == 0) {
      db.beginTransaction()
      try {
        db.execSQL("CREATE TABLE records(type TEXT NOT NULL,id TEXT NOT NULL,json TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(type,id))")
        db.execSQL("CREATE INDEX records_type_updated_idx ON records(type,updated_at DESC)")
        db.version = 1
        db.setTransactionSuccessful()
      } finally { db.endTransaction() }
    }
  }

  private fun closeVault() {
    database?.close(); database = null
    activeKey?.fill(0); activeKey = null
  }

  private fun requireDb() = database?.takeIf { it.isOpen } ?: throw IllegalStateException("Vault is locked")

  private data class Wrapped(val salt: ByteArray, val iv: ByteArray, val ciphertext: ByteArray)
  private fun wrapWithPassword(vaultKey: ByteArray, password: String): Wrapped {
    val salt = randomBytes(16)
    val derived = derive(password, salt, KDF_ITERATIONS)
    try {
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.ENCRYPT_MODE, derived)
      cipher.updateAAD("innerfolio-vault-key-v1".toByteArray())
      return Wrapped(salt, cipher.iv, cipher.doFinal(vaultKey))
    } finally { derived.encoded.fill(0) }
  }

  private fun unwrapWithPassword(password: String): ByteArray {
    check(prefs.getInt("wrapVersion", 0) == WRAP_VERSION) { "Unsupported vault key format" }
    val salt = fromB64(prefs.getString("salt", null) ?: error("Vault metadata is incomplete"))
    val iv = fromB64(prefs.getString("iv", null) ?: error("Vault metadata is incomplete"))
    val wrapped = fromB64(prefs.getString("wrappedKey", null) ?: error("Vault metadata is incomplete"))
    val derived = derive(password, salt, prefs.getInt("kdfIterations", KDF_ITERATIONS))
    try {
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, derived, GCMParameterSpec(128, iv))
      cipher.updateAAD("innerfolio-vault-key-v1".toByteArray())
      return cipher.doFinal(wrapped)
    } finally { derived.encoded.fill(0) }
  }

  private fun derive(password: String, salt: ByteArray, iterations: Int): SecretKey {
    val chars = password.toCharArray()
    try {
      val spec = PBEKeySpec(chars, salt, iterations, KEY_BITS)
      val raw = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
      spec.clearPassword()
      return javax.crypto.spec.SecretKeySpec(raw, "AES")
    } finally { chars.fill('\u0000') }
  }

  private fun createBiometricKey(): SecretKey {
    deleteKeystoreKey(BIOMETRIC_ALIAS)
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    val builder = KeyGenParameterSpec.Builder(BIOMETRIC_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setUserAuthenticationRequired(true).setInvalidatedByBiometricEnrollment(true)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) builder.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
    else @Suppress("DEPRECATION") builder.setUserAuthenticationValidityDurationSeconds(-1)
    generator.init(builder.build())
    return generator.generateKey()
  }

  private fun showBiometric(cipher: Cipher, title: String, subtitle: String, failed: (String) -> Unit, complete: (Cipher) -> Unit) {
    val activity = context.currentActivity as? FragmentActivity ?: throw IllegalStateException("No foreground activity")
    val executor = ContextCompat.getMainExecutor(context)
    val prompt = BiometricPrompt(activity, executor, object : BiometricPrompt.AuthenticationCallback() {
      override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
        val authenticated = result.cryptoObject?.cipher ?: return
        complete(authenticated)
      }
      override fun onAuthenticationError(errorCode: Int, errString: CharSequence) { failed(errString.toString()) }
    })
    val info = BiometricPrompt.PromptInfo.Builder().setTitle(title).setSubtitle(subtitle).setNegativeButtonText("Use password").build()
    prompt.authenticate(info, BiometricPrompt.CryptoObject(cipher))
  }

  private fun getOrCreateSecretKey(): SecretKey {
    try { return getKeystoreKey(SECRET_ALIAS) } catch (_: Exception) {}
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    generator.init(KeyGenParameterSpec.Builder(SECRET_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
    return generator.generateKey()
  }
  private fun getKeystoreKey(alias: String): SecretKey = (KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.getKey(alias, null) as? SecretKey) ?: error("Protected key unavailable")
  private fun deleteKeystoreKey(alias: String) { KeyStore.getInstance("AndroidKeyStore").apply { load(null); if (containsAlias(alias)) deleteEntry(alias) } }
  private fun randomBytes(size: Int) = ByteArray(size).also(random::nextBytes)
  private fun b64(value: ByteArray) = Base64.encodeToString(value, Base64.NO_WRAP)
  private fun fromB64(value: String) = Base64.decode(value, Base64.NO_WRAP)
  private fun escapeLike(value: String) = value.replace("%", "\\%").replace("_", "\\_")
  private fun reject(promise: Promise, code: String, error: Exception) = promise.reject(code, error.message ?: code)
}
