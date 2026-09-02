import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import { useTheme } from '../../hooks/useTheme';
import { formatFileSize } from '../../utils/format';
import type { ApkDownloadProgress, AppUpdateInfo } from '../../services/update/updateTypes';

interface Props {
  info: AppUpdateInfo;
  /** APK download progress (native module). Null for OTA updates. */
  apkProgress: ApkDownloadProgress | null;
}

/**
 * "正在下载新版本" modal.
 * - APK updates show real bytes/progress from the native download.
 * - OTA updates show progress from expo-updates' own download state.
 */
export function UpdateProgress({ info, apkProgress }: Props) {
  const theme = useTheme();
  const ota = Updates.useUpdates();

  const isApk = info.updateType === 'apk';
  const progress = isApk
    ? apkProgress?.progress ?? 0
    : (ota.downloadProgress ?? (ota.isDownloading ? 0 : 1));
  const percent = Math.round((progress < 0 ? 0 : progress > 1 ? 1 : progress) * 100);

  const bytesLabel =
    isApk && apkProgress && apkProgress.bytesTotal > 0
      ? `${formatFileSize(apkProgress.bytesDownloaded)} / ${formatFileSize(apkProgress.bytesTotal)}`
      : null;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>正在下载新版本</Text>
          <Text style={[styles.version, { color: theme.colors.textSecondary }]}>v{info.version}</Text>

          {percent > 0 && percent < 100 ? (
            <>
              <Text style={[styles.percent, { color: theme.colors.primary }]}>{percent}%</Text>
              <View style={[styles.track, { backgroundColor: theme.colors.inputBackground }]}>
                <View
                  style={[
                    styles.fill,
                    { backgroundColor: theme.colors.primary, width: `${Math.max(percent, 2)}%` },
                  ]}
                />
              </View>
            </>
          ) : (
            <ActivityIndicator color={theme.colors.primary} style={styles.spinner} />
          )}

          <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
            {percent >= 100 ? '准备安装…' : bytesLabel ?? '请稍候，不要关闭应用'}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  card: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  version: { fontSize: 13, marginBottom: 16 },
  percent: { fontSize: 30, fontWeight: '800', marginBottom: 10 },
  track: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: { height: 8, borderRadius: 4 },
  spinner: { marginVertical: 18 },
  hint: { fontSize: 12, marginTop: 14, textAlign: 'center' },
});

