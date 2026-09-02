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

## 网络兼容与错误诊断

GitHub REST API 的匿名额度按出口 IP 共享。VPN 节点可能因为其他用户的请求而返回
403（配额耗尽/访问受限）或 429。检查接口 api.github.com 与 APK 下载域名的连通性
也可能不同，客户端不能仅凭是否使用 VPN 判断网络可用性。

检查接口失败后，客户端会尝试同仓库的公开发行附件：
https://github.com/<owner>/<repo>/releases/latest/download/update.json

发布工作流通过 scripts/create-update-manifest.cjs 生成该附件，与 APK 一起上传。
附件包含版本、下载地址、更新说明及真实 APK 的 SHA-256。新流程发布之前的版本可能
没有该附件；两条路径都失败时保留原始接口的明确错误原因。

成功的检查才记入 6 小时自动检查缓存；失败后切换网络可再次检查。并发检查共享真实结果，
不会因为已有请求正在进行而误报最新版。单次请求的超时覆盖响应正文读取，主接口和备用
接口各有 10 秒上限。不在客户端嵌入 GitHub Token，也不关闭 TLS 验证。
