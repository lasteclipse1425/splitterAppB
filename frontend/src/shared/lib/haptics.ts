import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

export async function tapLight(): Promise<void> {
  if (!isNative) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // no-op
  }
}

export async function success(): Promise<void> {
  if (!isNative) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // no-op
  }
}

export async function warning(): Promise<void> {
  if (!isNative) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // no-op
  }
}
