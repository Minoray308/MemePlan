import * as ImagePicker from 'expo-image-picker';

export type PermissionResult = {
  granted: boolean;
  canAskAgain: boolean;
};

/**
 * Requests photo-library permission before importing. On Android 13+ the picker
 * generally does not need explicit permission, so we only hard-require on iOS.
 */
export async function requestMediaLibraryPermission(): Promise<PermissionResult> {
  try {
    const existing = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (existing.granted) {
      return { granted: true, canAskAgain: existing.canAskAgain ?? true };
    }
    if (!existing.canAskAgain && !existing.granted) {
      return { granted: false, canAskAgain: false };
    }
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return { granted: res.granted, canAskAgain: res.canAskAgain ?? true };
  } catch (e) {
    console.warn('[permissionService] failed to request permission', e);
    return { granted: false, canAskAgain: false };
  }
}
