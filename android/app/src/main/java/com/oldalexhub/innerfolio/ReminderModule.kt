package com.oldalexhub.innerfolio

import android.app.*
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.*
import java.util.Calendar

class ReminderModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "InnerfolioReminders"
  @ReactMethod fun schedule(hour: Int, minute: Int, promise: Promise) {
    try {
      require(hour in 0..23 && minute in 0..59)
      val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val pending = PendingIntent.getBroadcast(context, 41, Intent(context, ReminderReceiver::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      val next = Calendar.getInstance().apply { set(Calendar.HOUR_OF_DAY, hour); set(Calendar.MINUTE, minute); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0); if (timeInMillis <= System.currentTimeMillis()) add(Calendar.DAY_OF_YEAR, 1) }
      alarm.setInexactRepeating(AlarmManager.RTC_WAKEUP, next.timeInMillis, AlarmManager.INTERVAL_DAY, pending)
      promise.resolve(true)
    } catch (error: Exception) { promise.reject("REMINDER_FAILED", error.message, error) }
  }
  @ReactMethod fun cancel(promise: Promise) {
    val pending = PendingIntent.getBroadcast(context, 41, Intent(context, ReminderReceiver::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(pending); promise.resolve(true)
  }
}

class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val channel = "journal_reminders"
    if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel(channel, "Journal reminders", NotificationManager.IMPORTANCE_DEFAULT).apply { description = "Optional private writing reminders" })
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val pending = PendingIntent.getActivity(context, 42, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val notification = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, channel) else @Suppress("DEPRECATION") Notification.Builder(context)
    manager.notify(41, notification.setSmallIcon(com.oldalexhub.innerfolio.R.mipmap.ic_launcher).setContentTitle("A quiet moment for your journal").setContentText("Open Innerfolio when you are ready to write.").setContentIntent(pending).setAutoCancel(true).build())
  }
}
