import { Platform } from 'react-native';
import { palettes } from '@/shared/ui/palettes';

const isAndroid = Platform.OS === 'android';

/** @deprecated Prefer useAppColors() from theme-context */
export const appColors = palettes.light;

export const appRadii = {
  sm: 10,
  md: 14,
  lg: 16,
  xl: 20,
} as const;

const iosCardShadow = {
  shadowColor: '#24313F',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.06,
  shadowRadius: 10,
  elevation: 2,
} as const;

const iosSoftShadow = {
  shadowColor: '#24313F',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.04,
  shadowRadius: 6,
  elevation: 1,
} as const;

/** @deprecated Prefer useAppTheme() */
export const appShadow = {
  card: isAndroid ? { elevation: 4 } : iosCardShadow,
  soft: isAndroid ? { elevation: 2 } : iosSoftShadow,
} as const;

/** @deprecated Prefer useAppTheme().greenSurface */
export const greenSurface = {
  borderWidth: isAndroid ? 2 : 1,
  borderColor: appColors.primaryBorder,
  backgroundColor: appColors.primarySoft,
} as const;

/** @deprecated Prefer useAppTheme().greenOutline */
export const greenOutline = {
  borderWidth: isAndroid ? 2 : 1,
  borderColor: appColors.primaryBorder,
} as const;

/** @deprecated Prefer useAppTheme().surfaceCardProps */
export const surfaceCardProps = {
  backgroundColor: appColors.card,
  borderWidth: 1,
  borderColor: appColors.border,
  borderRadius: appRadii.lg,
  ...appShadow.card,
} as const;

export const platform = {
  isAndroid,
  isIOS: Platform.OS === 'ios',
} as const;
