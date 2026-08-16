package expo.modules.stickeroverlay

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Floating-window "quick send sticker" module.
 *
 * The window itself is a small system overlay (TYPE_APPLICATION_OVERLAY).
 * Flow (all handled natively so it keeps working while the app is backgrounded):
 *
 *   1. JS calls show(stickerFilePaths) with the app's own local files.
 *   2. User taps a sticker -> the window saves a COPY of that file into a
 *      dedicated system gallery album ("表情包快速发送") via MediaStore.
 *   3. The window tells the user it is saved and they can send it in WeChat etc.
 *   4. User taps "已发送" -> only that temporary copy is deleted from the gallery.
 *
 * The user's own sticker library is never modified or deleted.
 */
class StickerOverlayModule : Module() {
  private val overlay: StickerOverlayWindow by lazy {
    StickerOverlayWindow(appContext.reactContext, this)
  }

  override fun definition() = ModuleDefinition {
    Name("StickerOverlay")

    Events(
      "onStickerTapped",
      "onSaved",
      "onSent",
      "onCleaned",
      "onClosed",
      "onError"
    )

    Function("isAvailable") {
      true
    }

    Function("canDrawOverlays") {
      val ctx = appContext.reactContext
      ctx != null && Settings.canDrawOverlays(ctx)
    }

    AsyncFunction("openOverlaySettings") {
      val activity = appContext.currentActivity
      if (activity != null) {
        val intent = Intent(
          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:${activity.packageName}")
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activity.startActivity(intent)
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("show") { json: String, filtersJson: String ->
      overlay.showItems(json, filtersJson)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("hide") {
      overlay.hide()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("collapse") {
      overlay.collapse()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("expand") {
      overlay.expand()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("cleanupOrphanedTemps") { maxAgeMs: Long ->
      overlay.cleanupOrphanedTemps(maxAgeMs)
    }
  }
}
