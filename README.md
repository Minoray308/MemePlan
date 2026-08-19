# MemePlan（表情包管理工具）

一个基于 Expo（SDK 57 / React Native 0.86）的表情包管理 App。支持导入、分类、
标签、收藏、搜索、缩放导出、悬浮窗快速发送（自定义原生模块）与保存到相册。

核心特性：JSON + AsyncStorage 本地离线存储，无需后端即可日常使用。

## 更新系统（Cloudflare）

从 GitHub Releases 迁移到了 **Cloudflare** 分发体系，更新完全不再依赖 GitHub。

- **小更新（OTA）**：`expo-updates` 在线更新 JS Bundle 与静态资源。
- **大更新（APK）**：APK 存放在 **Cloudflare R2**，由 Cloudflare CDN 直接分发。
- **版本检查**：**Cloudflare Worker** 提供 `GET /api/version?platform=android`。
- **强制更新**：当运行版本 < `minimumVersion` 时 App 强制下载并安装新 APK。
- **GitHub**：仅作为「构建机」；不再是 APK 的发布或下载渠道。

架构：

```
Android App
   │  GET /api/version?platform=android
   ▼
Cloudflare Worker
   │  读取 KV 中的版本元数据（回退到内置 version.json）
   ▼
version.json / KV  { latestVersion, minimumVersion, forceUpdate, apkUrl, releaseNotes, ota }
```

客户端更新代码位于 `src/services/update/`，逻辑见 `src/services/update/README.md`。

---

## 1. 创建 Cloudflare R2

1. 打开 [R2 控制台](https://dash.cloudflare.com/?to=/:account/r2/new)。
2. 新建 Bucket，例如 `memeplan-apks`。

## 2. 创建 R2 Bucket（可公开读取）

APK 需要让用户直接下载。两种方式：

- **公开读取（推荐，简单）**：R2 → Bucket → Settings → Public access →
  Enable public access，得到形如 `https://pub-XXXX.r2.dev` 的公共 URL。
- 自定义域名（见第 3 步）。

## 3. 绑定自定义域名

1. R2 → Bucket → Settings → Custom Domains → Connect domain。
2. 输入 `download.example.com`（你的域名），Cloudflare 会自动配 DNS 与证书。
3. 之后 APK 的公开地址为 `https://download.example.com/android/<name>.apk`。

## 4. 创建 Worker

```
cd cloudflare/worker
npx wrangler kv namespace create VERSION_KV
```

把输出里的 `id` 填进 `cloudflare/worker/wrangler.toml` 的 `[[kv_namespaces]]`。
`worker/src/version.json` 是内置的默认版本元数据（可作为兜底）。

## 5. 部署 Worker

```
cd cloudflare/worker
npx wrangler login
npx wrangler deploy
```

部署成功后，`https://<worker-subdomain>.workers.dev/api/version?platform=android`
即返回版本元数据。

## 6. 环境变量

见 `.env.example`。客户端构建时用：

- `EXPO_PUBLIC_UPDATE_API_URL`：Worker 版本接口的根地址（覆盖默认占位值）。

发布/上传工具（`scripts/release-android.ts`、GitHub Actions）使用：

- `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN`
- `R2_BUCKET_NAME`、`R2_PUBLIC_URL`
- `CLOUDFLARE_KV_NAMESPACE_ID`

## 7. 本地开发

```
npm install
EXPO_PUBLIC_UPDATE_API_URL=http://192.168.x.x:8787 npm start   # 本地 worker
```

本地调试 Worker：

```
cd cloudflare/worker
npx wrangler dev
```

App 端 `src/constants/update.ts` 默认指向 `https://update.example.com`，开发时
用 `EXPO_PUBLIC_UPDATE_API_URL` 覆盖到本地 `wrangler dev` 地址。

## 8. Android 构建

- EAS：`npx eas build -p android --profile production-apk`（app.json 已配好）。
- 本地 Gradle：`npx expo prebuild -p android --no-install && cd android &&
  ./gradlew assembleRelease`。
- 或使用现有 GitHub Actions `build-and-upload-apk.yml`（在 Actions 里填版本号即
  可，构建后直接上传 Cloudflare）。

## 9. 上传 APK

用 `scripts/release-android.ts`（Node 24+）：

```
node --experimental-strip-types scripts/release-android.ts \
  --apk dist/memeplan-2.0.0.apk \
  --version 2.0.0 --minimum 1.5.0 \
  --notes "新增功能A" --notes "修复B"
```

脚本会：上传 APK 到 R2 → 更新 `cloudflare/worker/src/version.json` → 把元数据
写入 KV（`android-version` 键）。

## 10. 发布新版本

1. 构建 APK（第 8 步）。
2. 上传并更新元数据（第 9 步，或用 GitHub Actions）。
3. 若为纯 JS 改动（不改版本号）：`npx eas update --channel production` 走 OTA。

## 11. OTA 更新

- 小改动（JS / 静态资源）用 `expo-updates`：`npx eas update --auto`。
- 客户端启动时调用 `checkForUpdate`：优先检查 OTA，其次才是 APK 大版本。

## 12. 大版本更新

当 `latestVersion > 当前版本` 且需要换包时，把新 APK 上传到 R2，并把
`latestVersion` / `apkUrl` 更新到 Worker 元数据。App 会提示下载 APK 并调用
系统安装器完成升级。

## 13. minimumVersion 强制更新机制

Worker 元数据里的 `minimumVersion` 是「最低可用版本」：

- 运行版本 < `minimumVersion` → App 弹出强制更新（隐藏「稍后」，不可跳过），
  只能「立即更新」。

## 14. runtimeVersion 管理

- `app.json` 使用 `runtimeVersion.policy = "appVersion"`，App 版本即 runtime。
- 只有更换原生层的版本（APK）才需要升版本号；纯 JS 更新使用 OTA，版本号可不变。
- Worker 元数据里 `ota.runtimeVersion` 仅为展示/对齐信息，实际 OTA 由
  `expo-updates` 依据本机 runtimeVersion 决定。

## 15. 回滚 APK

- 把 KV 中的 `android-version` 覆盖为上一个版本元数据（`latestVersion` /
  `apkUrl` 指向上一个 APK），并确保该 APK 仍在 R2。
- 或用 `cloudflare/worker/src/version.json` 备份回滚后重新 `wrangler deploy`。

## 16. 回滚 OTA

- `npx eas update` 支持指定 EVP 发布/回滚；旧 JS 包可用 `eas update:repair`。
- 也可把 app.json 的 `updates.url` 指向旧 EAS channel，或直接调整
  `checkAutomatically` 行为。

---

## 校验

- 类型检查：`npm run typecheck`
- 更新逻辑单测：`npm run test:update-logic`
- Worker 类型检查：`npx tsc -p cloudflare/worker/tsconfig.json`