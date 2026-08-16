package expo.modules.appupdater

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.core.content.FileProvider
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.Locale

private const val UPDATE_DIR_NAME = "app-updater"
private const val APK_FILE_NAME = "update.apk"
private const val APK_MIME = "application/vnd.android.package-archive"
private const val FILE_PROVIDER_AUTHORITY_SUFFIX = ".fileprovider"
private const val CONNECT_TIMEOUT_MS = 15_000
private const val READ_TIMEOUT_MS = 30_000
private const val PROGRESS_EMIT_INTERVAL_MS = 200L
private const val BUFFER_SIZE = 64 * 1024

/** Download / install failed for a generic reason (network, IO, disk space, ...). */
class DownloadFailedException(message: String, cause: Throwable? = null) : CodedException(message, cause)

/** The server answered with a non-2xx status. */
class HttpStatusException(val statusCode: Int) :
  CodedException("Download failed with HTTP status $statusCode")

/** The downloaded file's SHA-256 does not match the expected value. */
class Sha256MismatchException : CodedException("APK SHA-256 checksum mismatch")

/** Android refuses to let this app install packages ("install unknown apps" disabled). */
class InstallPermissionDeniedException : CodedException("Install permission not granted")

/** The system package installer could not be started. */
class InstallerLaunchException(message: String, cause: Throwable? = null) : CodedException(message, cause)

/**
 * In-app APK update support for Android.
 *
 * Responsibilities (all running on a background queue, never blocking JS/UI):
 *  - reading the running build's versionCode / versionName,
 *  - checking / opening the "install unknown apps" permission,
 *  - downloading an APK into the cache dir with progress events + optional
 *    SHA-256 verification (temp file first, then moved to the final name),
 *  - handing the APK to the Android system installer through a FileProvider
 *    content:// URI (no browser, no file://, no silent install).
 */
class AppUpdaterModule : Module() {

  override fun definition() = ModuleDefinition {
    Name("AppUpdater")

    Events("onDownloadProgress")

    // -- App metadata -------------------------------------------------------

    Function("getVersionCode") {
      val context = appContext.reactContext
      if (context == null) {
        -1
      } else {
        context.packageManager.getPackageInfo(context.packageName, 0).versionCode
      }
    }

    Function("getVersionName") {
      val context = appContext.reactContext
      if (context == null) {
        null
      } else {
        context.packageManager.getPackageInfo(context.packageName, 0).versionName
      }
    }

    // -- "Install unknown apps" permission ----------------------------------

    Function("canRequestPackageInstalls") {
      val context = appContext.reactContext
      if (context == null) {
        false
      } else {
        context.packageManager.canRequestPackageInstalls()
      }
    }

    AsyncFunction("openInstallPermissionSettings") {
      val context = appContext.reactContext
      val activity = appContext.currentActivity
      if (context != null && activity != null) {
        val intent = Intent(
          Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
          Uri.parse("package:${context.packageName}")
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activity.startActivity(intent)
      }
    }.runOnQueue(Queues.MAIN)

    // -- Download -----------------------------------------------------------

    AsyncFunction("downloadApk") { url: String, expectedSha256: String? ->
      val context = appContext.reactContext
        ?: throw DownloadFailedException("Android context is unavailable")
      downloadApk(context, url, expectedSha256)
    }

    // -- Install ------------------------------------------------------------

    AsyncFunction("installApk") { filePath: String ->
      val context = appContext.reactContext
        ?: throw DownloadFailedException("Android context is unavailable")
      installApk(context, filePath)
    }
  }

  private fun updateDir(context: Context): File {
    return File(context.cacheDir, UPDATE_DIR_NAME).apply { mkdirs() }
  }

  private fun downloadApk(context: Context, url: String, expectedSha256: String?): String {
    val dir = updateDir(context)
    // Remove leftovers from a previous attempt / previous version.
    dir.listFiles()?.forEach { it.delete() }

    val tempFile = File(dir, "$APK_FILE_NAME.part")
    val finalFile = File(dir, APK_FILE_NAME)
    tempFile.delete()
    finalFile.delete()

    var connection: HttpURLConnection? = null
    try {
      connection = (URL(url).openConnection() as HttpURLConnection).apply {
        connectTimeout = CONNECT_TIMEOUT_MS
        readTimeout = READ_TIMEOUT_MS
        instanceFollowRedirects = true
        setRequestProperty("Accept-Encoding", "identity")
      }
      val statusCode = connection.responseCode
      if (statusCode !in 200..299) throw HttpStatusException(statusCode)

      val totalBytes = connection.contentLengthLong
      val digest = expectedSha256?.let { MessageDigest.getInstance("SHA-256") }
      var downloaded = 0L

      connection.inputStream.use { input ->
        FileOutputStream(tempFile).use { output ->
          val buffer = ByteArray(BUFFER_SIZE)
          var lastEmitAt = 0L
          while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            output.write(buffer, 0, read)
            downloaded += read
            digest?.update(buffer, 0, read)
            val now = System.currentTimeMillis()
            if (now - lastEmitAt >= PROGRESS_EMIT_INTERVAL_MS ||
              (totalBytes > 0 && downloaded >= totalBytes)
            ) {
              lastEmitAt = now
              emitProgress(downloaded, totalBytes)
            }
          }
          emitProgress(downloaded, totalBytes)
        }
      }

      if (totalBytes > 0 && downloaded != totalBytes) {
        tempFile.delete()
        throw DownloadFailedException("Download incomplete: $downloaded of $totalBytes bytes")
      }

      if (digest != null) {
        val actual = digest.digest().joinToString("") { "%02x".format(it.toInt() and 0xFF) }
        val expected = expectedSha256?.trim()?.lowercase(Locale.ROOT)
        if (actual != expected) {
          tempFile.delete()
          throw Sha256MismatchException()
        }
      }

      val finalized = if (tempFile.renameTo(finalFile)) {
        true
      } else {
        try {
          tempFile.copyTo(finalFile, overwrite = true)
          tempFile.delete()
          true
        } catch (e: Exception) {
          tempFile.delete()
          throw DownloadFailedException("Could not finalize APK file", e)
        }
      }
      if (!finalized) {
        tempFile.delete()
        throw DownloadFailedException("Could not finalize APK file")
      }

      emitProgress(downloaded, downloaded)
      return finalFile.absolutePath
    } catch (e: CodedException) {
      tempFile.delete()
      throw e
    } catch (e: Exception) {
      tempFile.delete()
      throw DownloadFailedException(e.message ?: "Download failed", e)
    } finally {
      connection?.disconnect()
    }
  }

  private fun emitProgress(bytesDownloaded: Long, bytesTotal: Long) {
    val progress = if (bytesTotal > 0) {
      (bytesDownloaded.toDouble() / bytesTotal.toDouble()).coerceIn(0.0, 1.0)
    } else {
      0.0
    }
    sendEvent(
      "onDownloadProgress",
      mapOf(
        "bytesDownloaded" to bytesDownloaded,
        "bytesTotal" to bytesTotal,
        "progress" to progress
      )
    )
  }

  private fun installApk(context: Context, filePath: String): Boolean {
    val file = File(filePath)
    if (!file.exists()) throw DownloadFailedException("APK file does not exist: $filePath")
    if (!context.packageManager.canRequestPackageInstalls()) {
      throw InstallPermissionDeniedException()
    }

    val authority = "${context.packageName}$FILE_PROVIDER_AUTHORITY_SUFFIX"
    val uri = FileProvider.getUriForFile(context, authority, file)
    val intent = Intent(Intent.ACTION_VIEW)
      .setDataAndType(uri, APK_MIME)
      .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)

    return try {
      val activity = appContext.currentActivity
      if (activity != null) {
        activity.startActivity(intent)
      } else {
        context.startActivity(intent)
      }
      true
    } catch (e: Exception) {
      throw InstallerLaunchException("Could not launch the system installer", e)
    }
  }
}

