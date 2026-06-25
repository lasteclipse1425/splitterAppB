import { Platform } from 'react-native';

const isAndroid = Platform.OS === 'android';

export type AppColorPalette = {
  primary: string;
  primaryDark: string;
  primarySoft: string;
  primaryMuted: string;
  primaryBorder: string;
  background: string;
  card: string;
  text: string;
  textMuted: string;
  border: string;
  borderSoft: string;
  danger: string;
  skeleton: string;
  skeletonHighlight: string;
};

function withPlatformTints(base: Omit<AppColorPalette, 'primarySoft' | 'primaryMuted' | 'primaryBorder'> & {
  primarySoftIos: string;
  primarySoftAndroid: string;
  primaryMutedIos: string;
  primaryMutedAndroid: string;
  primaryBorderIos: string;
  primaryBorderAndroid: string;
}): AppColorPalette {
  return {
    primary: base.primary,
    primaryDark: base.primaryDark,
    primarySoft: isAndroid ? base.primarySoftAndroid : base.primarySoftIos,
    primaryMuted: isAndroid ? base.primaryMutedAndroid : base.primaryMutedIos,
    primaryBorder: isAndroid ? base.primaryBorderAndroid : base.primaryBorderIos,
    background: base.background,
    card: base.card,
    text: base.text,
    textMuted: base.textMuted,
    border: base.border,
    borderSoft: base.borderSoft,
    danger: base.danger,
    skeleton: base.skeleton,
    skeletonHighlight: base.skeletonHighlight,
  };
}

export const palettes = {
  light: withPlatformTints({
    primary: '#2ECC71',
    primaryDark: '#27AE60',
    primarySoftIos: '#2ECC7114',
    primarySoftAndroid: '#E8F8EF',
    primaryMutedIos: '#2ECC7120',
    primaryMutedAndroid: '#DFF5E9',
    primaryBorderIos: '#2ECC71',
    primaryBorderAndroid: '#27AE60',
    background: '#F7F9FA',
    card: '#FFFFFF',
    text: '#24313F',
    textMuted: '#7B8794',
    border: '#E7ECEF',
    borderSoft: '#EEF2F5',
    danger: '#E74C3C',
    skeleton: '#E8ECEF',
    skeletonHighlight: '#F4F6F8',
  }),
  dark: withPlatformTints({
    primary: '#2ECC71',
    primaryDark: '#58D68D',
    primarySoftIos: '#2ECC7120',
    primarySoftAndroid: '#1A3D2A',
    primaryMutedIos: '#2ECC7128',
    primaryMutedAndroid: '#1F4A32',
    primaryBorderIos: '#58D68D',
    primaryBorderAndroid: '#58D68D',
    background: '#121820',
    card: '#1C2430',
    text: '#E8EDF2',
    textMuted: '#9AA8B5',
    border: '#2A3544',
    borderSoft: '#232D3B',
    danger: '#F87171',
    skeleton: '#2A3544',
    skeletonHighlight: '#343F4F',
  }),
  lightCb: withPlatformTints({
    primary: '#2563EB',
    primaryDark: '#1D4ED8',
    primarySoftIos: '#2563EB14',
    primarySoftAndroid: '#E8EFFE',
    primaryMutedIos: '#2563EB20',
    primaryMutedAndroid: '#D6E4FF',
    primaryBorderIos: '#2563EB',
    primaryBorderAndroid: '#1D4ED8',
    background: '#F7F9FA',
    card: '#FFFFFF',
    text: '#24313F',
    textMuted: '#7B8794',
    border: '#E7ECEF',
    borderSoft: '#EEF2F5',
    danger: '#E67E22',
    skeleton: '#E8ECEF',
    skeletonHighlight: '#F4F6F8',
  }),
  darkCb: withPlatformTints({
    primary: '#60A5FA',
    primaryDark: '#3B82F6',
    primarySoftIos: '#60A5FA20',
    primarySoftAndroid: '#1A2D4A',
    primaryMutedIos: '#60A5FA28',
    primaryMutedAndroid: '#1F3558',
    primaryBorderIos: '#60A5FA',
    primaryBorderAndroid: '#60A5FA',
    background: '#121820',
    card: '#1C2430',
    text: '#E8EDF2',
    textMuted: '#9AA8B5',
    border: '#2A3544',
    borderSoft: '#232D3B',
    danger: '#F59E0B',
    skeleton: '#2A3544',
    skeletonHighlight: '#343F4F',
  }),
} as const;

export type PaletteKey = keyof typeof palettes;
