package expo.modules.stickeroverlay

import android.content.ContentValues
import android.content.Context
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.text.Editable
import android.text.TextWatcher
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.io.File
import java.io.IOException
import java.util.UUID
import java.util.concurrent.Executors
import org.json.JSONArray
import org.json.JSONObject

private const val ALBUM_NAME = "表情包快速发送"
private const val MAX_ITEMS = 200
private const val TEMPS_PREF_NAME = "sticker_overlay_temps"
private const val TEMPS_MAX_KEEP = 30
private val COLOR_PRIMARY = Color.rgb(0x27, 0xAE, 0x60)
private val COLOR_BG = Color.rgb(0x21, 0x25, 0x2E)
private val COLOR_THUMB_BG = Color.rgb(0x33, 0x38, 0x42)
private val COLOR_BTN = Color.rgb(0x3A, 0x40, 0x4C)
private val COLOR_INPUT = Color.rgb(0x2A, 0x2F, 0x3A)
private val COLOR_CLOSE = Color.rgb(0x8A, 0x3A, 0x3A)
private val TEXT_SECONDARY = Color.argb(0xB3, 0xFF, 0xFF, 0xFF)
private val FILTER_ALL = "all"

/** One sticker shown in the floating window (metadata comes from JS as JSON). */
private data class StickerOverlayItem(
  val path: String,
  val name: String,
  val fileType: String,
  val tags: List<String>,
  val categoryName: String?,
  val isFavorite: Boolean,
  val lastUsedAt: Long?,
  val useCount: Int,
  val createdAt: Long
)

/** A temporary image we created in the gallery for the quick-send flow. */
private data class TempRecord(val uri: String, val displayName: String, val createdAt: Long)

private data class SaveResult(
  val ok: Boolean,
  val uri: String = "",
  val displayName: String = "",
  val error: String = ""
)

/**
 * The floating window for quick-send stickers.
 *
 * - Starts small: header + search box + filter chips + one row of recent
 *   stickers. When the user searches or filters, the window grows into a
 *   compact grid (still bounded) so it never covers the screen.
 * - Tapping a sticker copies it into the dedicated gallery album
 *   "表情包快速发送" using MediaStore (Android 11+ needs no permission to
 *   insert/delete the app's own media).
 * - "已发送" / "退出" delete ONLY the copy this window created. The original
 *   sticker files in the app documents dir are never touched.
 * - Orphaned copies from a killed process are cleaned on next app start
 *   (see cleanupOrphanedTemps), so the gallery does not fill up.
 */
class StickerOverlayWindow(
  private val context: Context?,
  private val module: StickerOverlayModule
) {
  private val windowManager: WindowManager?
    get() = context?.getSystemService(Context.WINDOW_SERVICE) as? WindowManager

  private val mainHandler = Handler(Looper.getMainLooper())
  private val executor = Executors.newSingleThreadExecutor()

  private var rootView: FrameLayout? = null
  private var layoutParams: WindowManager.LayoutParams? = null
  private var expandedCard: LinearLayout? = null
  private var bubbleView: TextView? = null
  private var bodyContainer: LinearLayout? = null
  private var searchField: EditText? = null
  private var chipsRow: LinearLayout? = null

  private var items: List<StickerOverlayItem> = emptyList()
  private var searchText = ""
  private var selectedFilter = FILTER_ALL
  private var lastTappedPath: String? = null
  private var pendingTemp: TempRecord? = null
  private var isCollapsed = false
  @Volatile private var isWindowVisible = false

  private var dragStartX = 0f
  private var dragStartY = 0f
  private var dragWinX = 0
  private var dragWinY = 0
  private var dragMoved = false
  private val DRAG_SLOP = 8f

  private val FILTER_LABELS = mapOf(
    "recent" to "最近",
    "favorite" to "收藏",
    "frequent" to "高频"
  )

  private val TAG_FILTER_PREFIX = "tag:"

  /** Enabled filter chips; "全部" is always present. Configured from JS. */
  private var chipDefs: List<Pair<String, String>> = buildChips(FILTER_LABELS.keys)

  private fun buildChips(enabledKeys: Collection<String>): List<Pair<String, String>> {
    return listOf(FILTER_ALL to "全部") + enabledKeys.mapNotNull { key ->
      when {
        key in FILTER_LABELS -> key to FILTER_LABELS.getValue(key)
        key.startsWith(TAG_FILTER_PREFIX) -> key to key.removePrefix(TAG_FILTER_PREFIX)
        else -> null
      }
    }
  }

  // region Public API (invoked from the module, on the main thread)

  fun showItems(json: String, filtersJson: String) {
    items = parseItems(json)
    val enabledFilters = parseFilters(filtersJson)
    chipDefs = buildChips(enabledFilters)
    if (selectedFilter != FILTER_ALL && selectedFilter !in chipDefs.map { it.first }) {
      selectedFilter = FILTER_ALL
    }
    val ctx = context ?: return
    val wm = windowManager ?: return

    if (rootView != null) {
      expand()
      renderChips()
      applyFilter()
      return
    }

    val params = WindowManager.LayoutParams(
      smallWidth(ctx),
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = dp(ctx, 12)
      y = dp(ctx, 180)
    }

    val root = buildRoot(ctx)
    try {
      wm.addView(root, params)
    } catch (e: Exception) {
      return
    }

    rootView = root
    layoutParams = params
    isWindowVisible = true
    renderChips()
    applyFilter()
  }

  fun hide() {
    isWindowVisible = false
    pendingTemp = null
    mainHandler.removeCallbacksAndMessages(null)
    val root = rootView
    if (root != null) {
      try {
        windowManager?.removeView(root)
      } catch (e: Exception) {
        // ignore
      }
    }
    rootView = null
    layoutParams = null
    expandedCard = null
    bubbleView = null
    bodyContainer = null
    searchField = null
    chipsRow = null
    isCollapsed = false
  }

  fun collapse() {
    if (rootView == null) return
    isCollapsed = true
    expandedCard?.visibility = View.GONE
    bubbleView?.visibility = View.VISIBLE
    val params = layoutParams ?: return
    params.width = dp(context, 64)
    params.height = dp(context, 64)
    try {
      windowManager?.updateViewLayout(rootView, params)
    } catch (e: Exception) {
      // ignore
    }
  }

  fun expand() {
    if (rootView == null) return
    isCollapsed = false
    bubbleView?.visibility = View.GONE
    expandedCard?.visibility = View.VISIBLE
    updateWindowSize()
  }

  /**
   * Removes temporary gallery copies that were left behind by a previous
   * session (e.g. the app was killed before the user confirmed "已发送").
   */
  fun cleanupOrphanedTemps(maxAgeMs: Long) {
    executor.execute {
      val now = System.currentTimeMillis()
      val temps = readTemps()
      val remaining = mutableListOf<TempRecord>()
      for (t in temps) {
        if (now - t.createdAt > maxAgeMs) deleteSticker(t.uri) else remaining.add(t)
      }
      writeTemps(remaining)
    }
  }

  // endregion

  // region Filtering / results

  private fun filteredItems(): List<StickerOverlayItem> {
    val q = searchText.trim().lowercase()
    var list = items
    if (q.isNotEmpty()) {
      list = list.filter { item ->
        item.name.lowercase().contains(q) ||
          item.tags.any { it.lowercase().contains(q) } ||
          (item.categoryName?.lowercase()?.contains(q) == true)
      }
    }
    when {
      selectedFilter == "recent" -> list = list.filter { it.lastUsedAt != null }
      selectedFilter == "favorite" -> list = list.filter { it.isFavorite }
      selectedFilter == "frequent" -> list = list.filter { it.useCount >= 2 }
      selectedFilter.startsWith(TAG_FILTER_PREFIX) -> {
        val tag = selectedFilter.removePrefix(TAG_FILTER_PREFIX)
        list = list.filter { it.tags.contains(tag) }
      }
    }
    return list.sortedByDescending { it.lastUsedAt ?: it.createdAt }
  }

  private fun applyFilter() {
    val results = filteredItems()
    val active = searchText.isNotBlank() || selectedFilter != FILTER_ALL
    renderResults(results, active)
    updateWindowSize()
  }

  private fun renderResults(results: List<StickerOverlayItem>, active: Boolean) {
    val ctx = context ?: return
    val body = bodyContainer ?: return
    body.removeAllViews()
    if (items.isEmpty()) {
      body.addView(textView(ctx, "暂无表情包", 13f, TEXT_SECONDARY, Typeface.NORMAL))
      return
    }
    if (results.isEmpty()) {
      body.addView(textView(ctx, "没有找到表情", 13f, TEXT_SECONDARY, Typeface.NORMAL))
      return
    }
    if (active) {
      body.addView(
        textView(ctx, "找到 ${results.size} 个表情", 11f, TEXT_SECONDARY, Typeface.NORMAL),
        LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
          bottomMargin = dp(ctx, 6)
        }
      )
      val cell = dp(ctx, 74)
      val gap = dp(ctx, 6)
      val rows = (results.size + 2) / 3
      val contentHeight = rows * cell + (rows - 1) * gap
      val gridHeight = minOf(contentHeight, dp(ctx, 230))
      val scroll = ScrollView(ctx).apply {
        isVerticalScrollBarEnabled = false
      }
      val grid = LinearLayout(ctx).apply { orientation = LinearLayout.VERTICAL }
      for (chunk in results.chunked(3)) {
        val row = LinearLayout(ctx).apply {
          orientation = LinearLayout.HORIZONTAL
          gravity = Gravity.CENTER_VERTICAL
        }
        for (item in chunk) {
          row.addView(
            stickerThumb(ctx, item),
            LinearLayout.LayoutParams(cell, cell).apply { marginEnd = gap }
          )
        }
        grid.addView(
          row,
          LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            bottomMargin = gap
          }
        )
      }
      scroll.addView(grid)
      body.addView(
        scroll,
        LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, gridHeight)
      )
    } else {
      val scroll = HorizontalScrollView(ctx).apply {
        isHorizontalScrollBarEnabled = false
      }
      val row = LinearLayout(ctx).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
      }
      for (item in results.take(6)) {
        row.addView(stickerThumb(ctx, item), LinearLayout.LayoutParams(dp(ctx, 56), dp(ctx, 56)).apply { marginEnd = dp(ctx, 8) })
      }
      scroll.addView(row)
      body.addView(
        scroll,
        LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
      )
    }
  }

  private fun updateWindowSize() {
    val ctx = context ?: return
    val params = layoutParams ?: return
    if (isCollapsed) return
    val active = searchText.isNotBlank() || selectedFilter != FILTER_ALL
    params.width = if (active) expandedWidth(ctx) else smallWidth(ctx)
    params.height = WindowManager.LayoutParams.WRAP_CONTENT
    try {
      windowManager?.updateViewLayout(rootView, params)
    } catch (e: Exception) {
      // ignore
    }
  }

  private fun smallWidth(ctx: Context): Int {
    return minOf(dp(ctx, 250), ctx.resources.displayMetrics.widthPixels - dp(ctx, 24))
  }

  private fun expandedWidth(ctx: Context): Int {
    return minOf(dp(ctx, 320), ctx.resources.displayMetrics.widthPixels - dp(ctx, 24))
  }

  // endregion

  // region Window building

  private fun buildRoot(ctx: Context): FrameLayout {
    val root = FrameLayout(ctx)
    val card = buildExpandedCard(ctx)
    val bubble = buildBubble(ctx)
    root.addView(card, FrameLayout.LayoutParams(smallWidth(ctx), ViewGroup.LayoutParams.WRAP_CONTENT))
    root.addView(bubble, FrameLayout.LayoutParams(dp(ctx, 56), dp(ctx, 56)))
    bubble.visibility = View.GONE
    expandedCard = card
    bubbleView = bubble
    return root
  }

  private fun buildExpandedCard(ctx: Context): LinearLayout {
    val card = LinearLayout(ctx).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(ctx, 12), dp(ctx, 10), dp(ctx, 12), dp(ctx, 12))
      elevation = dp(ctx, 12).toFloat()
      background = roundedRect(ctx, COLOR_BG, dp(ctx, 16).toFloat())
    }

    // Header: title (drag handle) + collapse / close buttons.
    val header = LinearLayout(ctx).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }
    val titles = LinearLayout(ctx).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(0, 0, dp(ctx, 8), 0)
    }
    titles.addView(
      textView(ctx, "快捷发送", 15f, Color.WHITE, Typeface.BOLD),
      LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    )
    attachDrag(header)
    header.addView(titles, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))

    header.addView(
      smallButton(ctx, "—") { collapse() },
      LinearLayout.LayoutParams(dp(ctx, 30), dp(ctx, 30)).apply { marginStart = dp(ctx, 4) }
    )
    header.addView(
      smallButton(ctx, "✕") { closeWindow() },
      LinearLayout.LayoutParams(dp(ctx, 30), dp(ctx, 30)).apply { marginStart = dp(ctx, 4) }
    )
    card.addView(header, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

    // Search box.
    val searchRow = LinearLayout(ctx).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }
    val field = EditText(ctx).apply {
      hint = "搜索表情（名称/标签/分类）"
      setHintTextColor(TEXT_SECONDARY)
      setTextColor(Color.WHITE)
      textSize = 13f
      setSingleLine(true)
      setPadding(dp(ctx, 12), dp(ctx, 8), dp(ctx, 12), dp(ctx, 8))
      background = roundedRect(ctx, COLOR_INPUT, dp(ctx, 10).toFloat())
      setOnFocusChangeListener { _, hasFocus -> setSearchFocus(hasFocus) }
      addTextChangedListener(object : TextWatcher {
        override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
        override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        override fun afterTextChanged(s: Editable?) {
          searchText = s?.toString() ?: ""
          applyFilter()
        }
      })
    }
    searchField = field
    searchRow.addView(field, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
    val clearBtn = TextView(ctx).apply {
      text = "✕"
      textSize = 13f
      gravity = Gravity.CENTER
      setTextColor(TEXT_SECONDARY)
      setOnClickListener { field.setText("") }
    }
    searchRow.addView(clearBtn, LinearLayout.LayoutParams(dp(ctx, 30), dp(ctx, 30)))
    card.addView(
      searchRow,
      LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
        topMargin = dp(ctx, 10)
      }
    )

    // Filter chips.
    val chipScroll = HorizontalScrollView(ctx).apply {
      isHorizontalScrollBarEnabled = false
    }
    chipsRow = LinearLayout(ctx).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }
    chipScroll.addView(chipsRow)
    card.addView(
      chipScroll,
      LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
        topMargin = dp(ctx, 8)
      }
    )

    bodyContainer = LinearLayout(ctx).apply { orientation = LinearLayout.VERTICAL }
    card.addView(
      bodyContainer,
      LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
        topMargin = dp(ctx, 10)
      }
    )
    return card
  }

  private fun renderChips() {
    val ctx = context ?: return
    val row = chipsRow ?: return
    row.removeAllViews()
    for ((key, label) in chipDefs) {
      val selected = selectedFilter == key
      val chip = TextView(ctx).apply {
        text = label
        textSize = 12f
        gravity = Gravity.CENTER
        setTextColor(if (selected) Color.WHITE else TEXT_SECONDARY)
        typeface = if (selected) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
        setPadding(dp(ctx, 10), dp(ctx, 5), dp(ctx, 10), dp(ctx, 5))
        background = roundedRect(ctx, if (selected) COLOR_PRIMARY else COLOR_BTN, dp(ctx, 9).toFloat())
        setOnClickListener {
          selectedFilter = if (selected) FILTER_ALL else key
          renderChips()
          applyFilter()
        }
      }
      row.addView(chip, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
        marginEnd = dp(ctx, 6)
      })
    }
  }

  private fun buildBubble(ctx: Context): TextView {
    return TextView(ctx).apply {
      text = "悬浮"
      textSize = 13f
      gravity = Gravity.CENTER
      background = roundedRect(ctx, COLOR_BG, dp(ctx, 28).toFloat())
      elevation = dp(ctx, 10).toFloat()
      setOnClickListener { expand() }
      attachDrag(this)
    }
  }

  // endregion

  // region Thumbnails

  private fun stickerThumb(ctx: Context, item: StickerOverlayItem): ImageView {
    return ImageView(ctx).apply {
      scaleType = ImageView.ScaleType.CENTER_CROP
      background = roundedRect(ctx, COLOR_THUMB_BG, dp(ctx, 10).toFloat())
      contentDescription = item.name.ifBlank { "表情" }
      tag = item.path
      setOnClickListener { onStickerTapped(item.path) }
      loadThumb(item.path, this)
    }
  }

  private fun loadThumb(path: String, image: ImageView) {
    val filePath = fileFromUri(path)?.absolutePath ?: path
    executor.execute {
      val bmp = decodeSampledBitmap(filePath, 160)
      mainHandler.post {
        if (image.tag == path) {
          image.setImageBitmap(bmp)
        } else {
          bmp?.recycle()
        }
      }
    }
  }

  private fun decodeSampledBitmap(path: String, reqSize: Int): Bitmap? {
    return try {
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      BitmapFactory.decodeFile(path, bounds)
      var sample = 1
      while (bounds.outWidth / sample > reqSize * 2 || bounds.outHeight / sample > reqSize * 2) {
        sample *= 2
      }
      val opts = BitmapFactory.Options().apply { inSampleSize = sample }
      BitmapFactory.decodeFile(path, opts)
    } catch (e: Throwable) {
      null
    }
  }

  // endregion

  // region Body states

  private fun showSaving() {
    val ctx = context ?: return
    val body = bodyContainer ?: return
    body.removeAllViews()
    body.addView(textView(ctx, "正在保存到相册…", 14f, Color.WHITE, Typeface.NORMAL))
  }

  private fun showSavedState() {
    val ctx = context ?: return
    val body = bodyContainer ?: return
    body.removeAllViews()
    body.addView(textView(ctx, "就绪！", 15f, Color.WHITE, Typeface.BOLD))
    body.addView(
      textView(ctx, "点击社交软件右下角的‘+’发送", 12f, TEXT_SECONDARY, Typeface.NORMAL),
      LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
        topMargin = dp(ctx, 2)
      }
    )
    val row = buttonRow(ctx)
    row.addView(button(ctx, "已发送", COLOR_PRIMARY) { onSentConfirmed() })
    row.addView(button(ctx, "重新保存", COLOR_BTN) { onResave() })
    row.addView(button(ctx, "退出", COLOR_CLOSE) { closeWindow() })
    body.addView(
      row,
      LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
        topMargin = dp(ctx, 10)
      }
    )
  }

  private fun showErrorState(message: String) {
    val ctx = context ?: return
    val body = bodyContainer ?: return
    body.removeAllViews()
    body.addView(textView(ctx, "保存失败", 15f, Color.WHITE, Typeface.BOLD))
    body.addView(
      textView(ctx, message, 12f, TEXT_SECONDARY, Typeface.NORMAL),
      LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
        topMargin = dp(ctx, 2)
      }
    )
    val row = buttonRow(ctx)
    row.addView(button(ctx, "重试", COLOR_PRIMARY) { lastTappedPath?.let { onStickerTapped(it) } })
    row.addView(button(ctx, "退出", COLOR_CLOSE) { closeWindow() })
    body.addView(
      row,
      LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
        topMargin = dp(ctx, 10)
      }
    )
  }


  // endregion

  // region Flow handlers

  private fun onStickerTapped(path: String) {
    lastTappedPath = path
    clearSearchFocus()
    module.sendEvent("onStickerTapped", mapOf("path" to path))
    showSaving()
    executor.execute {
      val result = saveToGallery(path)
      if (!isWindowVisible) {
        // The window was closed while saving: remove the copy we just made.
        if (result.ok) deleteSticker(result.uri)
        return@execute
      }
      mainHandler.post {
        if (!isWindowVisible) {
          if (result.ok) deleteSticker(result.uri)
          return@post
        }
        if (result.ok) {
          pendingTemp = TempRecord(result.uri, result.displayName, System.currentTimeMillis())
          addTemp(result.uri, result.displayName)
          showSavedState()
          module.sendEvent("onSaved", mapOf("uri" to result.uri))
        } else {
          showErrorState(result.error)
          module.sendEvent("onError", mapOf("message" to result.error))
        }
      }
    }
  }

  private fun onSentConfirmed() {
    val temp = pendingTemp
    pendingTemp = null
    if (temp != null) {
      removeTemp(temp.uri)
      executor.execute { deleteSticker(temp.uri) }
    }
    module.sendEvent("onSent", mapOf("uri" to (temp?.uri ?: "")))
    module.sendEvent("onCleaned", mapOf())
    applyFilter()
  }

  private fun onResave() {
    val path = lastTappedPath ?: return
    val temp = pendingTemp
    pendingTemp = null
    if (temp != null) {
      removeTemp(temp.uri)
      executor.execute { deleteSticker(temp.uri) }
    }
    onStickerTapped(path)
  }

  /** Closes the window; if a temporary copy exists it is deleted. */
  private fun closeWindow() {
    val temp = pendingTemp
    pendingTemp = null
    if (temp != null) {
      removeTemp(temp.uri)
      executor.execute { deleteSticker(temp.uri) }
    }
    hide()
    module.sendEvent("onClosed", mapOf())
  }

  // endregion

  // region MediaStore save / delete

  private fun parseItems(json: String): List<StickerOverlayItem> {
    return try {
      val arr = JSONArray(json)
      (0 until arr.length()).mapNotNull { i ->
        val o = arr.getJSONObject(i)
        val tagsArr = o.optJSONArray("tags")
        val tags = if (tagsArr == null) emptyList() else (0 until tagsArr.length()).mapNotNull { j -> tagsArr.optString(j) }
        StickerOverlayItem(
          path = o.optString("path"),
          name = o.optString("name"),
          fileType = o.optString("fileType"),
          tags = tags,
          categoryName = if (o.isNull("categoryName")) null else o.optString("categoryName"),
          isFavorite = o.optBoolean("isFavorite"),
          lastUsedAt = if (o.isNull("lastUsedAt")) null else o.optLong("lastUsedAt"),
          useCount = o.optInt("useCount", 0),
          createdAt = o.optLong("createdAt")
        )
      }
    } catch (e: Exception) {
      emptyList()
    }
  }
  private fun parseFilters(json: String): List<String> {
    return try {
      val arr = JSONArray(json)
      (0 until arr.length()).mapNotNull { i ->
        val key = arr.optString(i)
        key.takeIf { it in FILTER_LABELS || it.startsWith(TAG_FILTER_PREFIX) }
      }
    } catch (e: Exception) {
      emptyList()
    }
  }

  private fun saveToGallery(path: String): SaveResult {
    val ctx = context ?: return SaveResult(false, error = "设备不支持")
    val file = fileFromUri(path) ?: return SaveResult(false, error = "图片文件不存在")
    if (!file.exists()) return SaveResult(false, error = "图片文件不存在")
    return try {
      when (file.extension.lowercase()) {
        "png", "jpg", "jpeg", "webp", "gif" -> {
          val ext = file.extension.lowercase()
          insertFile(ctx, file, mimeForExtension(ext), "quick_${uuid8()}.$ext")
        }
        "heic", "heif" -> saveHeicAsJpeg(ctx, file)
        else -> saveUnknownAsImage(ctx, file)
      }
    } catch (e: Exception) {
      SaveResult(false, error = "保存失败（${e.message ?: "未知错误"}）")
    }
  }

  private fun fileFromUri(uriOrPath: String): File? {
    return try {
      val uri = Uri.parse(uriOrPath)
      if (uri.scheme == "file") {
        File(uri.path ?: return null)
      } else {
        File(uriOrPath)
      }
    } catch (e: Exception) {
      File(uriOrPath)
    }
  }

  private fun insertFile(ctx: Context, file: File, mime: String, displayName: String): SaveResult {
    val resolver = ctx.contentResolver
    val values = ContentValues().apply {
      put(MediaStore.Images.Media.DISPLAY_NAME, displayName)
      put(MediaStore.Images.Media.MIME_TYPE, mime)
      put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/$ALBUM_NAME")
      put(MediaStore.Images.Media.IS_PENDING, 1)
      put(MediaStore.Images.Media.DATE_ADDED, System.currentTimeMillis() / 1000)
    }
    val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
      ?: return SaveResult(false, error = "无法写入相册")
    try {
      val out = resolver.openOutputStream(uri) ?: throw IOException("无法写入相册")
      out.use { output ->
        file.inputStream().use { input -> input.copyTo(output) }
      }
    } catch (e: Exception) {
      try { resolver.delete(uri, null, null) } catch (ignored: Exception) {}
      return SaveResult(false, error = "写入相册失败")
    }
    values.clear()
    values.put(MediaStore.Images.Media.IS_PENDING, 0)
    resolver.update(uri, values, null, null)
    return SaveResult(true, uri = uri.toString(), displayName = displayName)
  }

  private fun insertBitmap(ctx: Context, bmp: Bitmap, displayName: String, mime: String): SaveResult {
    val resolver = ctx.contentResolver
    val values = ContentValues().apply {
      put(MediaStore.Images.Media.DISPLAY_NAME, displayName)
      put(MediaStore.Images.Media.MIME_TYPE, mime)
      put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/$ALBUM_NAME")
      put(MediaStore.Images.Media.IS_PENDING, 1)
      put(MediaStore.Images.Media.DATE_ADDED, System.currentTimeMillis() / 1000)
    }
    val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
      ?: return SaveResult(false, error = "无法写入相册")
    try {
      val out = resolver.openOutputStream(uri) ?: throw IOException("无法写入相册")
      out.use { output ->
        val format = if (mime == "image/png") Bitmap.CompressFormat.PNG else Bitmap.CompressFormat.JPEG
        if (!bmp.compress(format, 90, output)) {
          throw IOException("图片压缩失败")
        }
      }
    } catch (e: Exception) {
      try { resolver.delete(uri, null, null) } catch (ignored: Exception) {}
      return SaveResult(false, error = "写入相册失败")
    }
    values.clear()
    values.put(MediaStore.Images.Media.IS_PENDING, 0)
    resolver.update(uri, values, null, null)
    return SaveResult(true, uri = uri.toString(), displayName = displayName)
  }

  private fun saveHeicAsJpeg(ctx: Context, file: File): SaveResult {
    val bmp = BitmapFactory.decodeFile(file.absolutePath)
      ?: return SaveResult(false, error = "无法读取该图片格式")
    return insertBitmap(ctx, bmp, "quick_${uuid8()}.jpg", "image/jpeg")
  }

  private fun saveUnknownAsImage(ctx: Context, file: File): SaveResult {
    val bmp = BitmapFactory.decodeFile(file.absolutePath)
      ?: return SaveResult(false, error = "无法识别的图片格式")
    return insertBitmap(ctx, bmp, "quick_${uuid8()}.png", "image/png")
  }

  private fun deleteSticker(uriString: String) {
    val ctx = context ?: return
    try {
      ctx.contentResolver.delete(Uri.parse(uriString), null, null)
    } catch (e: Exception) {
      // ignore
    }
  }

  private fun mimeForExtension(ext: String): String = when (ext) {
    "png" -> "image/png"
    "jpg", "jpeg" -> "image/jpeg"
    "webp" -> "image/webp"
    "gif" -> "image/gif"
    else -> "application/octet-stream"
  }

  // endregion

  // region Temp tracking (crash recovery)

  private fun prefs(): SharedPreferences? {
    return context?.getSharedPreferences(TEMPS_PREF_NAME, Context.MODE_PRIVATE)
  }

  private fun readTemps(): List<TempRecord> {
    val raw = prefs()?.getString("temps", "[]") ?: "[]"
    return try {
      val arr = JSONArray(raw)
      (0 until arr.length()).mapNotNull { i ->
        val obj = arr.getJSONObject(i)
        TempRecord(obj.optString("uri"), obj.optString("name"), obj.optLong("createdAt"))
      }
    } catch (e: Exception) {
      emptyList()
    }
  }

  private fun writeTemps(temps: List<TempRecord>) {
    try {
      val arr = JSONArray()
      for (t in temps) {
        arr.put(JSONObject().put("uri", t.uri).put("name", t.displayName).put("createdAt", t.createdAt))
      }
      prefs()?.edit()?.putString("temps", arr.toString())?.apply()
    } catch (e: Exception) {
      // ignore
    }
  }

  private fun addTemp(uri: String, name: String) {
    val temps = readTemps().toMutableList()
    temps.add(TempRecord(uri, name, System.currentTimeMillis()))
    while (temps.size > TEMPS_MAX_KEEP) {
      val removed = temps.removeAt(0)
      deleteSticker(removed.uri)
    }
    writeTemps(temps)
  }

  private fun removeTemp(uri: String) {
    writeTemps(readTemps().filter { it.uri != uri })
  }

  // endregion

  // region UI helpers

  private fun setSearchFocus(hasFocus: Boolean) {
    val root = rootView ?: return
    val params = layoutParams ?: return
    val wm = windowManager ?: return
    try {
      if (hasFocus) {
        params.flags = params.flags and WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE.inv()
        params.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
        wm.removeView(root)
        wm.addView(root, params)
      } else {
        params.flags = params.flags or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
        params.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING
        wm.updateViewLayout(root, params)
      }
    } catch (e: Exception) {
      // ignore
    }
  }

  private fun clearSearchFocus() {
    val field = searchField ?: return
    field.clearFocus()
    val imm = context?.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
    imm?.hideSoftInputFromWindow(field.windowToken, 0)
  }

  private fun attachDrag(view: View) {
    view.setOnTouchListener { v, event ->
      when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          val target = findTouchTarget(view, event.x, event.y)
          if (target != null && target !== v && isInteractive(target)) {
            return@setOnTouchListener false
          }
          dragStartX = event.rawX
          dragStartY = event.rawY
          dragWinX = layoutParams?.x ?: 0
          dragWinY = layoutParams?.y ?: 0
          dragMoved = false
          true
        }
        MotionEvent.ACTION_MOVE -> {
          val params = layoutParams ?: return@setOnTouchListener true
          val dx = event.rawX - dragStartX
          val dy = event.rawY - dragStartY
          if (!dragMoved && dx * dx + dy * dy > DRAG_SLOP * DRAG_SLOP) {
            dragMoved = true
          }
          params.x = dragWinX + dx.toInt()
          params.y = dragWinY + dy.toInt()
          try {
            windowManager?.updateViewLayout(rootView, params)
          } catch (e: Exception) {
            // ignore
          }
          true
        }
        MotionEvent.ACTION_UP -> {
          // Only forward the tap when the user did not actually drag the window,
          // so dragging the collapsed bubble no longer expands it by accident.
          if (!dragMoved) v.performClick()
          false
        }
        else -> false
      }
    }
  }

  /** Deepest view under (x, y) in view-local coordinates. */
  private fun findTouchTarget(root: View, x: Float, y: Float): View? {
    if (root !is ViewGroup) return root
    for (i in root.childCount - 1 downTo 0) {
      val child = root.getChildAt(i)
      if (child.visibility != View.VISIBLE) continue
      if (x >= child.left && x <= child.right && y >= child.top && y <= child.bottom) {
        return findTouchTarget(child, x - child.left, y - child.top) ?: child
      }
    }
    return root
  }

  /** Views that should keep handling their own touches instead of dragging. */
  private fun isInteractive(view: View): Boolean {
    return view.isClickable ||
      view.isLongClickable ||
      view is EditText ||
      view is ScrollView ||
      view is HorizontalScrollView
  }

  private fun dp(ctx: Context?, value: Int): Int {
    val c = ctx ?: return value
    return (value * c.resources.displayMetrics.density).toInt()
  }

  private fun roundedRect(ctx: Context, color: Int, radius: Float): GradientDrawable {
    return GradientDrawable().apply {
      setColor(color)
      cornerRadius = radius
    }
  }

  private fun textView(ctx: Context, text: String, size: Float, color: Int, style: Int): TextView {
    return TextView(ctx).apply {
      this.text = text
      textSize = size
      setTextColor(color)
      typeface = Typeface.create(Typeface.DEFAULT, style)
      includeFontPadding = false
    }
  }

  private fun smallButton(ctx: Context, label: String, onClick: () -> Unit): TextView {
    return TextView(ctx).apply {
      text = label
      textSize = 14f
      gravity = Gravity.CENTER
      setTextColor(Color.WHITE)
      background = roundedRect(ctx, COLOR_BTN, dp(ctx, 8).toFloat())
      setOnClickListener { onClick() }
    }
  }

  private fun button(ctx: Context, label: String, bgColor: Int, onClick: () -> Unit): TextView {
    return TextView(ctx).apply {
      text = label
      textSize = 13f
      gravity = Gravity.CENTER
      setTextColor(Color.WHITE)
      typeface = Typeface.DEFAULT_BOLD
      setPadding(dp(ctx, 12), dp(ctx, 8), dp(ctx, 12), dp(ctx, 8))
      background = roundedRect(ctx, bgColor, dp(ctx, 10).toFloat())
      setOnClickListener { onClick() }
    }
  }

  private fun buttonRow(ctx: Context): LinearLayout {
    return LinearLayout(ctx).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
    }
  }

  private fun uuid8(): String {
    return UUID.randomUUID().toString().replace("-", "").take(8)
  }

  // endregion
}

