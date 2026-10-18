package com.oldalexhub.innerfolio

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.pdf.PdfDocument
import android.net.Uri
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import android.text.TextDirectionHeuristics
import android.util.Base64
import com.facebook.react.bridge.*
import org.json.JSONArray
import java.io.ByteArrayOutputStream
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

class DocumentModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context), ActivityEventListener {
  companion object { const val CREATE_FILE = 7310; const val OPEN_BACKUP = 7311; const val ITERATIONS = 600_000 }
  private data class Pending(val promise: Promise, val bytes: ByteArray? = null, val password: String? = null)
  private var pending: Pending? = null
  init { context.addActivityEventListener(this) }
  override fun getName() = "InnerfolioDocuments"

  @ReactMethod
  fun saveText(filename: String, mime: String, content: String, promise: Promise) = createDocument(filename, mime, content.toByteArray(Charsets.UTF_8), promise)

  @ReactMethod
  fun savePdf(filename: String, title: String, content: String, promise: Promise) {
    try { createDocument(filename, "application/pdf", renderPdf(title, content), promise) }
    catch (error: Exception) { promise.reject("PDF_EXPORT_FAILED", error.message, error) }
  }

  @ReactMethod
  fun exportBackup(filename: String, recordsJson: String, password: String, promise: Promise) {
    try {
      JSONArray(recordsJson)
      require(password.length >= 10) { "Backup password must contain at least 10 characters" }
      createDocument(filename, "application/octet-stream", encryptBackup(recordsJson.toByteArray(Charsets.UTF_8), password), promise)
    } catch (error: Exception) { promise.reject("BACKUP_EXPORT_FAILED", error.message, error) }
  }

  @ReactMethod
  fun importBackup(password: String, promise: Promise) {
    if (pending != null) return promise.reject("DOCUMENT_BUSY", "Another document operation is in progress")
    val activity = context.currentActivity ?: return promise.reject("NO_ACTIVITY", "Open Innerfolio to choose a document")
    pending = Pending(promise, password = password)
    activity.startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).apply { addCategory(Intent.CATEGORY_OPENABLE); type = "application/octet-stream" }, OPEN_BACKUP)
  }

  private fun createDocument(filename: String, mime: String, bytes: ByteArray, promise: Promise) {
    if (pending != null) return promise.reject("DOCUMENT_BUSY", "Another document operation is in progress")
    val activity = context.currentActivity ?: return promise.reject("NO_ACTIVITY", "Open Innerfolio to choose a destination")
    pending = Pending(promise, bytes = bytes)
    activity.startActivityForResult(Intent(Intent.ACTION_CREATE_DOCUMENT).apply { addCategory(Intent.CATEGORY_OPENABLE); type = mime; putExtra(Intent.EXTRA_TITLE, filename) }, CREATE_FILE)
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    val operation = pending ?: return
    if (requestCode != CREATE_FILE && requestCode != OPEN_BACKUP) return
    pending = null
    if (resultCode != Activity.RESULT_OK || data?.data == null) return operation.promise.reject("DOCUMENT_CANCELLED", "Document selection was cancelled")
    try {
      val uri: Uri = data.data!!
      if (requestCode == CREATE_FILE) {
        context.contentResolver.openOutputStream(uri, "w")!!.use { it.write(operation.bytes!!) }
        operation.promise.resolve(uri.toString())
      } else {
        val input = context.contentResolver.openInputStream(uri) ?: error("Unable to open backup")
        val bytes = input.use { stream ->
          val output = ByteArrayOutputStream(); val buffer = ByteArray(8192); var total = 0
          while (true) { val count = stream.read(buffer); if (count < 0) break; total += count; require(total <= 50 * 1024 * 1024) { "Backup is larger than 50 MB" }; output.write(buffer, 0, count) }
          output.toByteArray()
        }
        val decoded = String(decryptBackup(bytes, operation.password!!), Charsets.UTF_8)
        JSONArray(decoded)
        operation.promise.resolve(decoded)
      }
    } catch (error: Exception) { operation.promise.reject(if (requestCode == OPEN_BACKUP) "BACKUP_IMPORT_FAILED" else "DOCUMENT_WRITE_FAILED", error.message, error) }
  }
  override fun onNewIntent(intent: Intent) {}

  private fun encryptBackup(plain: ByteArray, password: String): ByteArray {
    val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
    val key = derive(password, salt)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key); cipher.updateAAD("innerfolio-backup-v1".toByteArray())
    val body = cipher.doFinal(plain)
    return "INNERFOLIO1\n".toByteArray() + salt + cipher.iv + body
  }
  private fun decryptBackup(bytes: ByteArray, password: String): ByteArray {
    val magic = "INNERFOLIO1\n".toByteArray()
    require(bytes.size > magic.size + 44 && bytes.copyOfRange(0, magic.size).contentEquals(magic)) { "Unsupported backup format" }
    val salt = bytes.copyOfRange(magic.size, magic.size + 16); val iv = bytes.copyOfRange(magic.size + 16, magic.size + 28); val body = bytes.copyOfRange(magic.size + 28, bytes.size)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.DECRYPT_MODE, derive(password, salt), GCMParameterSpec(128, iv)); cipher.updateAAD("innerfolio-backup-v1".toByteArray())
    return cipher.doFinal(body)
  }
  private fun derive(password: String, salt: ByteArray): SecretKeySpec {
    val spec = PBEKeySpec(password.toCharArray(), salt, ITERATIONS, 256)
    return SecretKeySpec(SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded, "AES")
  }

  private fun renderPdf(title: String, body: String): ByteArray {
    val pageWidth = 595; val pageHeight = 842; val margin = 48
    val paint = TextPaint().apply { color = Color.rgb(24, 45, 42); textSize = 12f; isAntiAlias = true }
    val text = "$title\n\n$body"
    val layout = StaticLayout.Builder.obtain(text, 0, text.length, paint, pageWidth - margin * 2).setAlignment(Layout.Alignment.ALIGN_NORMAL).setIncludePad(false).setTextDirection(TextDirectionHeuristics.FIRSTSTRONG_LTR).build()
    val document = PdfDocument(); val contentHeight = pageHeight - margin * 2; var top = 0; var pageNumber = 1
    while (top < layout.height) {
      val page = document.startPage(PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber++).create())
      page.canvas.save(); page.canvas.clipRect(margin, margin, pageWidth - margin, pageHeight - margin); page.canvas.translate(margin.toFloat(), (margin - top).toFloat()); layout.draw(page.canvas); page.canvas.restore(); document.finishPage(page); top += contentHeight
    }
    return ByteArrayOutputStream().use { output -> document.writeTo(output); document.close(); output.toByteArray() }
  }
}
