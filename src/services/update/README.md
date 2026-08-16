# 更新系统（OTA + APK）

由服务端 `updateType` 决定走 Expo OTA 还是 App 内下载 APK，`versionCode` 是唯一版本判断依据。

## 1. 配置更新服务器

在 `src/constants/update.ts` 中设置：

```ts
export const UPDATE_API_URL: string | null = 'https://your-server.example.com/api/app/update';
```

未配置（或服务器不可达）时，自动回退到 `src/constants/versionInfo.ts` 中内嵌的发布信息（需要 `versionCode > 运行中的 versionCode` 才会提示）。

## 2. 版本接口返回格式

`GET {UPDATE_API_URL}` 返回：

```jsonc
// OTA 小更新
{
  "version": "2.4.1",
  "versionCode": 241,
  "updateType": "ota",
  "changelog": "修复部分问题"
}

// APK 大更新
{
  "version": "2.5.0",
  "versionCode": 250,
  "updateType": "apk",
  "apkUrl": "https://cdn.example.com/app-2.5.0.apk",
  "sha256": "xxxx",          // 可选，提供则下载后校验
  "changelog": "修复问题并增加新功能"
}
```

- 服务器返回 `versionCode <= 当前版本` 时不更新。
- `updateType` 必须明确返回 `ota` 或 `apk`，客户端不会按版本号自动推断。
- 请求失败时 App 静默跳过本次检查，不影响正常使用。

## 3. 检查时机

- App 冷启动检查一次。
- App 从后台恢复且距上次检查超过 30 分钟时再检查。
- 设置页“检查更新”按钮可手动触发。
- 所有更新都是非强制更新，用户随时可点“稍后”。

## 4. 构建 APK

保留 production（AAB）不动，新增了 `production-apk` profile：

```bash
eas build --platform android --profile production-apk
```

构建完成后把 APK 上传到自己的 HTTPS CDN，并把 `apkUrl`（及可选 `sha256`）配置到版本接口。

## 5. 测试

OTA：`npx eas update --channel production` 发布 JS 更新，服务端返回 `updateType: "ota"` 且 versionCode 更高；在 release 构建中冷启动验证提示与 reload。

APK：用 `production-apk` 构建一个更高 versionCode 的 APK 上传到 CDN，服务端返回 `updateType: "apk"`；冷启动验证提示 → 下载进度 → SHA-256 → “允许安装未知应用”引导 → 系统安装器。

> expo-updates 的 API 与自动检查在 Expo Go / 开发构建中不可用，需用 release 构建（.apk）测试完整流程。
