package com.oldalexhub.innerfolio

import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject
import org.vosk.Model
import org.vosk.Recognizer
import org.vosk.android.RecognitionListener
import org.vosk.android.SpeechService
import org.vosk.android.StorageService

class VoskModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context), LifecycleEventListener, RecognitionListener {
  private var model: Model? = null
  private var recognizer: Recognizer? = null
  private var speech: SpeechService? = null
  @Volatile private var preparing = false

  init { context.addLifecycleEventListener(this) }
  override fun getName() = "InnerfolioVosk"

  @ReactMethod
  @Synchronized fun prepareModel(promise: Promise) {
    if (model != null) return promise.resolve(true)
    if (preparing) return promise.reject("MODEL_PREPARING", "The local speech model is already being prepared")
    preparing = true
    StorageService.unpack(context, "model-en-us", "vosk", { unpacked ->
      model = unpacked; preparing = false; promise.resolve(true)
    }, { error -> preparing = false; promise.reject("MODEL_UNAVAILABLE", "The verified local English model could not be installed", error) })
  }

  @ReactMethod
  @Synchronized fun start(promise: Promise) {
    try {
      if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
        return promise.reject("MICROPHONE_PERMISSION_REQUIRED", "Microphone permission is required only while dictating")
      }
      if (speech != null) return promise.resolve(false)
      val readyModel = model ?: return promise.reject("MODEL_UNAVAILABLE", "Install the local English speech model first")
      recognizer = Recognizer(readyModel, 16000.0f)
      speech = SpeechService(recognizer, 16000.0f).also { it.startListening(this) }
      emit("VoskState", "listening")
      promise.resolve(true)
    } catch (error: Exception) { release(false); promise.reject("DICTATION_START_FAILED", error.message, error) }
  }

  @ReactMethod
  @Synchronized fun stop(promise: Promise) {
    try { speech?.stop(); promise.resolve(true) }
    catch (error: Exception) { release(false); promise.reject("DICTATION_STOP_FAILED", error.message, error) }
  }

  @ReactMethod
  @Synchronized fun cancel(promise: Promise) {
    try { release(true); emit("VoskState", "cancelled"); promise.resolve(true) }
    catch (error: Exception) { promise.reject("DICTATION_CANCEL_FAILED", error.message, error) }
  }

  override fun onPartialResult(hypothesis: String) = emitTranscript("VoskPartial", hypothesis, "partial")
  override fun onResult(hypothesis: String) = emitTranscript("VoskFinal", hypothesis, "text")
  override fun onFinalResult(hypothesis: String) { emitTranscript("VoskFinal", hypothesis, "text"); release(false); emit("VoskState", "idle") }
  override fun onError(exception: Exception) { emit("VoskError", "Recognition stopped. Typing remains available."); release(true) }
  override fun onTimeout() { emit("VoskState", "timeout"); release(true) }

  private fun emitTranscript(event: String, json: String, field: String) {
    val value = try { JSONObject(json).optString(field, "") } catch (_: Exception) { "" }
    if (value.isNotBlank()) emit(event, value)
  }
  private fun emit(event: String, value: String) = context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit(event, value)

  @Synchronized private fun release(cancel: Boolean) {
    val current = speech
    speech = null
    try { if (cancel) current?.cancel() else current?.stop() } catch (_: Exception) {}
    try { current?.shutdown() } catch (_: Exception) {}
    try { recognizer?.close() } catch (_: Exception) {}
    recognizer = null
  }

  @ReactMethod fun addListener(eventName: String) {}
  @ReactMethod fun removeListeners(count: Int) {}
  override fun onHostPause() { release(true); emit("VoskState", "idle") }
  override fun onHostResume() {}
  override fun onHostDestroy() { release(true); try { model?.close() } catch (_: Exception) {}; model = null }
}
