import React, { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as Updates from 'expo-updates';
import { useStore } from '../state/StoreProvider';
import { useTheme } from '../hooks/useTheme';
import { useToast } from '../components/ToastProvider';
import { ScreenHeader } from '../components/ScreenHeader';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { THEME_COLOR_PRESETS } from '../theme';
import { OVERLAY_FILTER_OPTIONS, overlayTagKey } from '../constants/overlay';
import { useUpdateManager } from '../components/update/UpdateProvider';
import type { ThemeMode } from '../models/types';

const MIN_COLUMNS = 1;
const MAX_COLUMNS = 64;

export function SettingsScreen() {
  const theme = useTheme();
  const toast = useToast();
  const { isChecking, checkNow, runningVersionCode } = useUpdateManager();
  const { settings, updateSettings, deleteStickers, stickers, allTags } = useStore();
  const [showClear, setShowClear] = useState(false);
  const [showColumnsInput, setShowColumnsInput] = useState(false);
  const [showOverlayFilters, setShowOverlayFilters] = useState(false);
  const [columnsInput, setColumnsInput] = useState('');

  const clampColumns = useCallback((value: number) => {
    if (!Number.isFinite(value)) return MIN_COLUMNS;
    return Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, Math.round(value)));
  }, []);

  const availableOverlayTags = React.useMemo(() => {
    return Array.from(new Set([...allTags, ...stickers.flatMap((s) => s.tags)])).sort((a, b) =>
      a.localeCompare(b, 'zh'),
    );
  }, [allTags, stickers]);

  const setColumns = useCallback(
    (cols: number) => updateSettings({ gridColumns: clampColumns(cols) }),
    [clampColumns, updateSettings],
  );
  const setThumbnails = useCallback(
    (value: boolean) => updateSettings({ generateThumbnails: value }),
    [updateSettings],
  );
  const setThemeMode = useCallback(
    (themeMode: ThemeMode) => updateSettings({ themeMode }),
    [updateSettings],
  );
  const setThemeColor = useCallback(
    (themeColor: string) => updateSettings({ themeColor }),
    [updateSettings],
  );
  const setShowFormatLabel = useCallback(
    (value: boolean) => updateSettings({ showFormatLabel: value }),
    [updateSettings],
  );
  const setAnimateGifs = useCallback(
    (value: boolean) => updateSettings({ animateGifs: value }),
    [updateSettings],
  );
  const toggleOverlayFilter = useCallback(
    (key: string, enable: boolean) => {
      const next = new Set(settings.overlayFilters);
      if (enable) next.add(key);
      else next.delete(key);
      updateSettings({ overlayFilters: Array.from(next) });
    },
    [settings.overlayFilters, updateSettings],
  );
  const setExitAfterOverlay = useCallback(
    (value: boolean) => updateSettings({ exitAfterOverlay: value }),
    [updateSettings],
  );

  const openColumnsInput = useCallback(() => {
    setColumnsInput(String(settings.gridColumns));
    setShowColumnsInput(true);
  }, [settings.gridColumns]);

  const confirmColumnsInput = useCallback(() => {
    const parsed = Number(columnsInput.trim());
    const next = Number.isNaN(parsed) ? settings.gridColumns : clampColumns(parsed);
    updateSettings({ gridColumns: next });
    setShowColumnsInput(false);
    toast.success(`已设置为 ${next} 列`);
  }, [columnsInput, clampColumns, settings.gridColumns, updateSettings, toast]);

  /** Manual "检查更新" — the shared UpdateProvider owns prompting/downloading. */
  const onCheckForUpdates = useCallback(async () => {
    if (isChecking) return;
    const outcome = await checkNow();
    if (outcome === 'latest') {
      toast.success('已是最新版本');
    } else if (outcome === 'unavailable') {
      toast.info('当前环境不支持更新');
    } else if (outcome === 'error') {
      toast.error('检查更新失败，请稍后重试');
    }
  }, [isChecking, checkNow, toast]);

  const themeOptions: { value: ThemeMode; label: string }[] = [
    { value: 'system', label: '跟随系统' },
    { value: 'light', label: '浅色' },
    { value: 'dark', label: '深色' },
  ];

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScreenHeader title="设置" subtitle="偏好与数据" />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>外观模式</Text>
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}>
          <View style={styles.modeRow}>
            {themeOptions.map((opt) => {
              const active = settings.themeMode === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setThemeMode(opt.value)}
                  style={[
                    styles.modeItem,
                    { backgroundColor: active ? theme.colors.primary : theme.colors.inputBackground },
                  ]}
                >
                  <Text style={{ color: active ? '#FFFFFF' : theme.colors.text, fontSize: 14, fontWeight: '600' }}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>主题色</Text>
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}>
          <View style={styles.colorRow}>
            {THEME_COLOR_PRESETS.map((preset) => {
              const active = settings.themeColor.toLowerCase() === preset.color.toLowerCase();
              return (
                <Pressable
                  key={preset.color}
                  onPress={() => setThemeColor(preset.color)}
                  style={[styles.colorItem, { backgroundColor: theme.colors.inputBackground }]}
                >
                  <View style={[styles.colorDot, { backgroundColor: preset.color }]} />
                  <Text style={[styles.colorName, { color: active ? theme.colors.primary : theme.colors.textSecondary }]}>
                    {preset.name}
                  </Text>
                  {active && (
                    <View style={[styles.colorCheck, { backgroundColor: theme.colors.primary }]}>
                      <Text style={styles.colorCheckText}>✓</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>网格列数</Text>
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}>
          <View style={styles.stepperRow}>
            <Pressable
              onPress={() => setColumns(settings.gridColumns - 1)}
              disabled={settings.gridColumns <= MIN_COLUMNS}
              style={[styles.stepperBtn, { backgroundColor: theme.colors.inputBackground, opacity: settings.gridColumns <= MIN_COLUMNS ? 0.4 : 1 }]}
            >
              <Text style={[styles.stepperText, { color: theme.colors.text }]}>−</Text>
            </Pressable>
            <Pressable onPress={openColumnsInput} style={styles.stepperValueWrap}>
              <Text style={[styles.stepperValue, { color: theme.colors.text }]}>{settings.gridColumns}</Text>
              <Text style={[styles.stepperUnit, { color: theme.colors.textMuted }]}>列</Text>
            </Pressable>
            <Pressable
              onPress={() => setColumns(settings.gridColumns + 1)}
              disabled={settings.gridColumns >= MAX_COLUMNS}
              style={[styles.stepperBtn, { backgroundColor: theme.colors.inputBackground, opacity: settings.gridColumns >= MAX_COLUMNS ? 0.4 : 1 }]}
            >
              <Text style={[styles.stepperText, { color: theme.colors.text }]}>＋</Text>
            </Pressable>
          </View>
          <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
            点击数字可直接输入列数，范围 {MIN_COLUMNS}～{MAX_COLUMNS}，默认 3 列。
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>显示</Text>
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}>
          <View style={styles.row}>
            <View style={styles.switchTextWrap}>
              <Text style={[styles.rowLabel, { color: theme.colors.text }]}>缩略图显示格式</Text>
              <Text style={[styles.rowHint, { color: theme.colors.textMuted, marginTop: 2 }]}>
                在缩略图右下角显示 PNG、JPG 等格式标签。
              </Text>
            </View>
            <Switch
              value={settings.showFormatLabel}
              onValueChange={setShowFormatLabel}
              trackColor={{ false: theme.colors.inputBackground, true: theme.colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider }]}>
            <View style={styles.switchTextWrap}>
              <Text style={[styles.rowLabel, { color: theme.colors.text }]}>动图在主页自动播放</Text>
              <Text style={[styles.rowHint, { color: theme.colors.textMuted, marginTop: 2 }]}>
                关闭后主页中的 GIF 动图会显示为静态图。
              </Text>
            </View>
            <Switch
              value={settings.animateGifs}
              onValueChange={setAnimateGifs}
              trackColor={{ false: theme.colors.inputBackground, true: theme.colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>悬浮窗</Text>
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}>
          <Pressable onPress={() => setShowOverlayFilters(true)} style={styles.row}>
            <View style={styles.switchTextWrap}>
              <Text style={[styles.rowLabel, { color: theme.colors.text }]}>悬浮窗筛选</Text>
              <Text style={[styles.rowHint, { color: theme.colors.textMuted, marginTop: 2 }]}>
                自定义悬浮窗快捷筛选栏中显示的筛选项。
              </Text>
            </View>
            <Text style={{ color: theme.colors.textMuted }}>›</Text>
          </Pressable>
          <View style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider }]}>
            <View style={styles.switchTextWrap}>
              <Text style={[styles.rowLabel, { color: theme.colors.text }]}>打开悬浮窗后自动退出</Text>
              <Text style={[styles.rowHint, { color: theme.colors.textMuted, marginTop: 2 }]}>
                开启后打开悬浮窗会自动关闭本应用，悬浮窗保留在屏幕上。
              </Text>
            </View>
            <Switch
              value={settings.exitAfterOverlay}
              onValueChange={setExitAfterOverlay}
              trackColor={{ false: theme.colors.inputBackground, true: theme.colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>导入</Text>
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}>
          <View style={styles.row}>
            <View style={styles.switchTextWrap}>
              <Text style={[styles.rowLabel, { color: theme.colors.text }]}>生成缩略图</Text>
              <Text style={[styles.rowHint, { color: theme.colors.textMuted, marginTop: 2 }]}>
                关闭后直接使用原图作为列表预览，导入更快。
              </Text>
            </View>
            <Switch
              value={settings.generateThumbnails}
              onValueChange={setThumbnails}
              trackColor={{ false: theme.colors.inputBackground, true: theme.colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>更新</Text>
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}>
          <Pressable
            onPress={onCheckForUpdates}
            disabled={isChecking}
            style={[styles.row, { opacity: isChecking ? 0.5 : 1 }]}
          >
            <View style={styles.switchTextWrap}>
              <Text style={[styles.rowLabel, { color: theme.colors.text }]}>
                {isChecking ? '正在检查…' : '检查更新'}
              </Text>
              <Text style={[styles.rowHint, { color: theme.colors.textMuted, marginTop: 2 }]}>
                v{Updates.runtimeVersion ?? '1.0.0'}{runningVersionCode != null ? ` · code ${runningVersionCode}` : ''}
              </Text>
            </View>
            <Text style={{ color: theme.colors.textMuted }}>›</Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>数据</Text>
        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder }]}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: theme.colors.text }]}>本地表情</Text>
            <Text style={[styles.rowValue, { color: theme.colors.textSecondary }]}>{stickers.length} 张</Text>
          </View>
          <Pressable
            onPress={() => setShowClear(true)}
            style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider }]}
          >
            <Text style={[styles.rowLabel, { color: theme.colors.danger }]}>清空所有表情包</Text>
            <Text style={{ color: theme.colors.textMuted }}>›</Text>
          </Pressable>
        </View>

        <Text style={[styles.about, { color: theme.colors.textMuted }]}>MemePlan v{Updates.runtimeVersion ?? '1.0.0'} · 本地离线存储</Text>
      </ScrollView>

      <Modal transparent visible={showOverlayFilters} animationType="slide" onRequestClose={() => setShowOverlayFilters(false)}>
        <View style={styles.subMenuOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowOverlayFilters(false)} />
          <View style={[styles.subMenuSheet, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.subMenuTitle, { color: theme.colors.text }]}>悬浮窗筛选</Text>
            <ScrollView style={styles.subMenuList}>
              <Text style={[styles.subMenuSectionLabel, { color: theme.colors.textMuted }]}>快速筛选</Text>
              {[{ key: 'all', label: '全部' }, ...OVERLAY_FILTER_OPTIONS].map((opt, index) => {
                const locked = opt.key === 'all';
                const checked = locked ? true : settings.overlayFilters.includes(opt.key);
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => !locked && toggleOverlayFilter(opt.key, !checked)}
                    style={[
                      styles.subMenuRow,
                      index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider },
                    ]}
                  >
                    <View style={styles.switchTextWrap}>
                      <Text style={[styles.rowLabel, { color: theme.colors.text }]}>{opt.label}</Text>
                      {locked && (
                        <Text style={[styles.rowHint, { color: theme.colors.textMuted, marginTop: 2 }]}>
                          始终显示，用于清除筛选
                        </Text>
                      )}
                    </View>
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: checked ? theme.colors.primary : theme.colors.textMuted,
                          backgroundColor: checked ? theme.colors.primary : 'transparent',
                        },
                      ]}
                    >
                      {checked && <Text style={styles.checkboxMark}>✓</Text>}
                    </View>
                  </Pressable>
                );
              })}

              <Text style={[styles.subMenuSectionLabel, { color: theme.colors.textMuted }]}>标签筛选</Text>
              {availableOverlayTags.length === 0 ? (
                <Text style={[styles.subMenuEmpty, { color: theme.colors.textMuted }]}>
                  暂无标签，可在表情详情页添加
                </Text>
              ) : (
                availableOverlayTags.map((tag) => {
                  const key = overlayTagKey(tag);
                  const checked = settings.overlayFilters.includes(key);
                  return (
                    <Pressable
                      key={key}
                      onPress={() => toggleOverlayFilter(key, !checked)}
                      style={[
                        styles.subMenuRow,
                        { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider },
                      ]}
                    >
                      <Text style={[styles.rowLabel, { color: theme.colors.text }]}>{tag}</Text>
                      <View
                        style={[
                          styles.checkbox,
                          {
                            borderColor: checked ? theme.colors.primary : theme.colors.textMuted,
                            backgroundColor: checked ? theme.colors.primary : 'transparent',
                          },
                        ]}
                      >
                        {checked && <Text style={styles.checkboxMark}>✓</Text>}
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
            <Pressable
              onPress={() => setShowOverlayFilters(false)}
              style={[styles.subMenuDone, { backgroundColor: theme.colors.primary }]}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>完成</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={showColumnsInput} animationType="fade" onRequestClose={() => setShowColumnsInput(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowColumnsInput(false)} />
          <View style={[styles.modalCard, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>设置列数</Text>
            <TextInput
              value={columnsInput}
              onChangeText={setColumnsInput}
              keyboardType="number-pad"
              style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
              placeholder={`${MIN_COLUMNS}～${MAX_COLUMNS}`}
              placeholderTextColor={theme.colors.placeholder}
              autoFocus
              onSubmitEditing={confirmColumnsInput}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowColumnsInput(false)} style={[styles.modalBtn, { backgroundColor: theme.colors.inputBackground }]}>
                <Text style={{ color: theme.colors.textSecondary }}>取消</Text>
              </Pressable>
              <Pressable onPress={confirmColumnsInput} style={[styles.modalBtn, { backgroundColor: theme.colors.primary }]}>
                <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>确定</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>



      <ConfirmDialog
        visible={showClear}
        title="清空所有表情包"
        message={`确定删除全部 ${stickers.length} 张表情吗？此操作不可恢复。`}
        confirmLabel="清空"
        danger
        onConfirm={() => {
          deleteStickers(stickers.map((s) => s.id));
          setShowClear(false);
          toast.success('已清空所有表情包');
        }}
        onCancel={() => setShowClear(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 18, marginLeft: 6 },
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeItem: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  colorRow: { flexDirection: 'row', gap: 10 },
  colorItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    position: 'relative',
  },
  colorDot: { width: 26, height: 26, borderRadius: 13, marginBottom: 6 },
  colorName: { fontSize: 11, fontWeight: '600' },
  colorCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCheckText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  stepperBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  stepperText: { fontSize: 24, lineHeight: 26, fontWeight: '700' },
  stepperValueWrap: { flexDirection: 'row', alignItems: 'baseline', minWidth: 48, justifyContent: 'center' },
  stepperValue: { fontSize: 26, fontWeight: '800' },
  stepperUnit: { fontSize: 13, marginLeft: 2 },
  hint: { fontSize: 12, marginTop: 10, paddingHorizontal: 2, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowHint: { fontSize: 12 },
  rowValue: { fontSize: 14 },
  switchTextWrap: { flex: 1, paddingRight: 12 },
  about: { textAlign: 'center', fontSize: 12, marginTop: 28 },
  subMenuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  subMenuSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16, paddingBottom: 26, maxHeight: '78%' },
  subMenuTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  subMenuList: { marginTop: 4 },
  subMenuSectionLabel: { fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 4, marginLeft: 16 },
  subMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  subMenuEmpty: { fontSize: 13, paddingHorizontal: 16, paddingVertical: 18, textAlign: 'center' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxMark: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', lineHeight: 18 },
  subMenuDone: { marginHorizontal: 20, marginTop: 14, paddingVertical: 13, borderRadius: 14, alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  modalCard: { width: '100%', maxWidth: 320, borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 14, textAlign: 'center' },
  input: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  modalActions: { flexDirection: 'row', marginTop: 16, gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
});




