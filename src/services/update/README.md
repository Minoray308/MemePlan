# 更新系统（GitHub Releases + Expo 原生安装器）

更新源与 Kazumi 保持一致：客户端请求 GitHub `releases/latest`，读取 Release 的
`tag_name`、`body` 和 APK `assets`，用数值方式比较当前版本。检测到更高版本后，
Android development/release build 通过 `AppUpdater` 下载并校验 APK，再交给系统安装器。

## 配置

默认仓库为 `Minoray308/MemePlan`，可在构建时用 `EXPO_PUBLIC_GITHUB_REPOSITORY`
覆盖，例如 `Predidit/Kazumi`。检查地址为：

```
https://api.github.com/repos/<owner>/<repo>/releases/latest
```

Release 至少需要一个 `.apk` asset；Release body 会显示为更新日志。APK 下载地址
必须是 GitHub 返回的 HTTPS `browser_download_url`。Expo Go 没有 `AppUpdater` 原生
模块，因此只会提示当前环境不支持安装。

## 检查流程

冷启动和回到前台每 6 小时自动检查一次；设置页的“检查更新”会绕过缓存强制检查。
当前版本低于 Release tag 时提示更新，用户选择“立即更新”后下载 APK、显示进度并打开
Android 系统安装器。普通更新可选择稍后；下载失败不会影响当前应用继续使用。

## 发布

构建 APK 后创建 GitHub Release，并将 APK 上传为 Release asset，例如：

```
memeplan-1.0.3.apk
```

不再需要 Cloudflare Worker/R2 的版本元数据作为客户端更新源。
