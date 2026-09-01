# MemePlan（表情包管理工具）

基于 Expo SDK 57 / React Native 0.86 的 Android 表情包管理 App，支持导入、分类、标签、收藏、搜索、导出与悬浮窗发送。

## 更新系统

客户端采用与 Kazumi 类似的 GitHub Releases 检查方式：请求仓库的 `releases/latest`，读取 Release 的 tag、更新说明和 APK asset；发现 tag 高于当前版本时，下载 APK 并交给 Android 系统安装器。

- 默认更新仓库：`Minoray308/MemePlan`
- 可用 `EXPO_PUBLIC_GITHUB_REPOSITORY=owner/repo` 覆盖
- 自动检查：冷启动/回到前台时触发，6 小时内不重复请求
- 设置页手动“检查更新”：立即请求，绕过自动检查缓存
- Release body 是更新日志；Release 必须上传至少一个 `.apk`
- Expo Go 不包含项目的原生 APK 安装模块，因此不能用于完整验证更新安装流程

客户端代码和发布要求见 [`src/services/update/README.md`](src/services/update/README.md)。

## 本地开发

```powershell
npm install
npm start
```

## 不使用 Expo Go 的 Android 打包

本地原生构建：

```powershell
npx expo prebuild --platform android --no-install
cd android
./gradlew.bat assembleRelease
```

APK 位于 `android/app/build/outputs/apk/release/app-release.apk`。

也可以使用 EAS 生成 APK（仍然不是 Expo Go）：

```powershell
npx eas build -p android --profile production-apk
```

## 发布新版本（开发者）

1. 修改 `app.json` 中的 `expo.version`，例如 `1.0.3`。
2. 使用上面的原生构建命令生成 APK。
3. 在 GitHub 仓库创建 Release，Tag 使用 `v1.0.3`，并将 APK 作为 asset 上传；Release 描述填写更新日志。
4. 用户打开 App 或在设置页手动检查时，会从 GitHub 读取这个 Release。

也可以在 GitHub Actions 中运行 `Build & Publish Android APK Release`，填写版本号和可选更新说明，工作流会自动构建并创建 GitHub Release。工作流文件为 [`.github/workflows/build-and-upload-apk.yml`](.github/workflows/build-and-upload-apk.yml)。

## 校验

```powershell
npm run typecheck
npm run test:update-logic
```

## 许可证

本项目采用 [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0)。允许个人或非商业用途下进行使用、二次创作和再发布，但未经许可不得用于商业用途。完整条款见 [LICENSE](LICENSE)。
