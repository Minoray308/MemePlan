import type { UpdateType } from '../services/update/updateTypes';

/**
 * 内嵌在 JS bundle 里的“最新发布信息”。
 *
 * 仅在没有配置更新服务器（UPDATE_API_URL 为 null）或服务器不可达时作为离线
 * 回退使用。配置了服务器后，以服务器返回的 `updateType` 为准。
 *
 * 【测试用配置 - 当前为 1.0.2 测试更新】
 * - versionName：展示用版本号（仅 UI 显示）
 * - versionCode：判断依据。只有当 `versionCode > 手机上已安装版本的 versionCode`
 *   时才会提示更新。当前为测试值 10（基本保证比已装版本大）；
 *   正式发布时请改成新版 APK 的实际 versionCode（设置页会显示当前已装 code）。
 * - updateType：'apk' = 应用内下载 APK 安装；'ota' = expo-updates 在线更新
 * - apkUrl：新版 APK 的公开 HTTPS 下载地址（必须是公网可匿名下载的地址，
 *   私有仓库附件无法被 App 下载）
 * - sha256：可选，APK 的 SHA-256，填了下载后会校验
 * - changelog：更新说明
 */
export const VERSION_INFO: {
  versionName: string;
  versionCode: number;
  updateType: UpdateType;
  apkUrl: string;
  sha256?: string;
  changelog?: string;
} = {
  versionName: '1.0.2',
  versionCode: 10,
  updateType: 'apk',
  apkUrl:
    'https://github.com/Minoray803/memeplan-releases/releases/download/v1.0.2/memeplan-v1.0.2.apk',
  changelog: '1.0.2 测试更新：请确认应用内更新流程可以正常完成。',
};
