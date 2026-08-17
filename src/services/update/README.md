# 更新系统（GitHub Releases + Android APK）

更新源是当前 GitHub 仓库（`Minoray803/memeplan`）的公开 Releases。App 只支持
Android：通过系统安装器在应用内下载并安装 APK。无 OTA（expo-updates 保留但不参与
本次更新判断，见 `otaUpdater.ts`）。

## 1. 仓库配置（集中定义）

`src/constants/update.ts` 中的 `GITHUB_OWNER` / `GITHUB_REPO` 是唯一出处：

```ts
export const GITHUB_OWNER = 'Minoray803';
export const GITHUB_REPO = 'memeplan';
```

请求的完整 URL 为：

```
https://api.github.com/repos/Minoray803/memeplan/releases/latest
```

公开接口、匿名访问、无需 GitHub Token。

## 2. 版本判断

- 当前版本：读取 Android `versionName`（原生模块 `getVersionName`），如
  `1.0.1`。
- 最新版本：读取最新 Release 的 `tag_name`，去掉开头的 `v`，如 `v1.2.3 ->
  1.2.3`。
- 用真正的数值 semver 比较（`compareVersions`），不是字符串比较：
  `1.10.0 > 1.9.0`、`1.2.0 > 1.1.9`。
- 当远程版本 <= 当前版本时，认为没有更新。

## 3. APK 选择（findApkAsset）

只考虑 Release assets 中 `.apk` 文件，并按 `APK_NAME_PRIORITY` 排序：

1. `universal`（通用包，最高优先）
2. `arm64-v8a`
3. `armeabi-v7a`
4. `arm64` / `x86_64` / `x86` / `armeabi`（依次）
5. 其它通用 `.apk`（最后）

自动跳过 `test / debug / source / unsigned / unaligned / proguard` 等开发产物，
且忽略 source code zip/tar.gz。APK 必须是 GitHub 托管的 https 地址
（`github.com/.../releases/download/...` 或其重定向到 `objects.githubusercontent.com`），
绝不从任意第三方主机下载。

## 4. SHA-256（可选）

GitHub 不会自动生成校验和。若发布者提供了下列之一，App 会在下载后校验 SHA-256：

- 同名资产 `<apk>.sha256`
- `SHA256SUMS` / `sha256sums` / `checksums` 资产中对应 `apk` 的一行
- Release 说明（`body`）中包含 `<apk>` 的校验和

未提供时不做校验（与现状一致）。

## 5. 检查时机与缓存

- 手动点击“检查更新”：总是立即强制检查（`force=true`），不受缓存影响。
- 冷启动 / 从后台恢复：最多每 `AUTO_CHECK_INTERVAL_MS`（6 小时）请求一次 GitHub。
- 所有更新都是非强制更新，用户随时可点“稍后”。

## 6. 错误处理

- `403 / 429`：GitHub rate limit —— 提示“请求过于频繁，请稍后再试”。
- 网络断开 / DNS：`network` —— 提示检查网络。
- 超时：`timeout`。
- JSON 解析失败：`parse`。
- 404（仓库不存在或暂无 Release）：`no_release`。
- 最新 Release 没有 APK：`no_apk`。

错误码与文案见 `src/services/update/updateTypes.ts`（`defaultUpdateErrorMessage`）。

## 7. 发布流程（CI）

`.github/workflows/build-and-upload-apk.yml` 在打 tag 时构建 APK，计算 SHA-256，
用 `gh release create` 发布 GitHub Release，并把 APK 与 `<apk>.sha256` 作为资产
附加，同时在 Release 说明中附带校验和（供第 4 步使用）。

## 8. 测试

见下文“修改的文件”说明；逻辑（semver 比较 / APK 选择 / 错误映射）可用纯 JS 验证，
完整下载-安装需在 Android release 构建（.apk）中验证（Expo Go / 开发构建不可用原生
安装模块）。
