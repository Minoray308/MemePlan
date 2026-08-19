# 更新系统（Cloudflare + expo-updates OTA + Android APK）

更新源是 Cloudflare Worker 的版本检查 API；大版本 APK 存放在 Cloudflare R2；
小版本（JS 包与静态资源）由 expo-updates（OTA）完成。GitHub 不再作为 APK 的
发布或下载渠道。

## 1. 仓库配置（集中定义）

`src/constants/update.ts` 中的 `UPDATE_API_BASE_URL` 是唯一配置点（默认
`https://update.example.com`，可通过 `EXPO_PUBLIC_UPDATE_API_URL` 环境变量在
构建时覆盖）。版本检查走：

```
GET <UPDATE_API_BASE_URL>/api/version?platform=android
```

## 2. Worker 返回的版本模型

`ServerUpdateInfo`（见 `src/services/update/updateTypes.ts` / `cloudflare/worker/src/version.json`）：

```json
{
  "platform": "android",
  "latestVersion": "2.0.0",
  "minimumVersion": "1.5.0",
  "forceUpdate": false,
  "apkUrl": "https://download.example.com/android/app-2.0.0.apk",
  "apkName": "app-2.0.0.apk",
  "sha256": "…（可选，64 位 hex）",
  "releaseNotes": ["新增 xxx", "修复 xxx"],
  "publishedAt": "2026-08-19T00:00:00Z",
  "ota": { "enabled": true, "runtimeVersion": "2" }
}
```

## 3. 版本比较

`compareVersions()`（`src/services/update/updateLogic.ts`）做数值比较，不做
字符串比较：`10.0.0 > 2.0.0`，`1.10.0 > 1.9.0`。支持 `1.0` / `1.0.0` 兼容。

## 4. 更新判定（`decideUpdate`，纯函数）

- `currentVersion < minimumVersion` → 强制更新（APK 安装，不可跳过）。
- 否则 `currentVersion < latestVersion`：
  - OTA 开启且无新 APK → OTA 小更新。
  - 否则 → APK 大更新（两者同时存在时以 APK 为准）。
- 否则 → 已是最新。

## 5. 流程

- 冷启动 / 从后台恢复最多每 `AUTO_CHECK_INTERVAL_MS`（6 小时）检查一次；用户
  可在设置页“检查更新”强制检查。
- 小更新：`expo-updates`（`otaUpdater.ts`）下载 JS 包并 `reloadAsync` 就地热更新。
- 大更新：`apkUpdater.ts` 通过原生 `AppUpdater` 模块下载、SHA-256 校验并调用
  系统安装器安装。
- 强制更新：`UpdateDialog` 隐藏“稍后”，且不可被撤销。

## 6. 错误处理

任何失败都 `try/catch`，`console.warn` 后不崩溃、不阻塞正常使用。错误码集中
在 `updateTypes.ts`：`network` / `timeout` / `http` / `parse` / `no_release` /
`unsupported`。

## 7. 发布

见根目录 `README.md` 与 `scripts/release-android.ts`。GitHub Actions 只作为
构建机：构建出的 APK 上传到 Cloudflare R2，并更新 Worker 的 KV 版本元数据
（`.github/workflows/build-and-upload-apk.yml`）。