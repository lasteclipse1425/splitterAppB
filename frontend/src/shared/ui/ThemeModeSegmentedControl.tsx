import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable } from 'react-native';
import { XStack, Text, View } from 'tamagui';
import type { ThemeMode } from '@/shared/lib/stores/app-store';
import { useAppColors } from '@/shared/ui/theme-context';

const THEME_OPTIONS: { mode: ThemeMode; labelKey: string; fallback: string }[] = [
  { mode: 'light', labelKey: 'settings.theme.options.light', fallback: 'Light' },
  { mode: 'dark', labelKey: 'settings.theme.options.dark', fallback: 'Dark' },
  { mode: 'system', labelKey: 'settings.theme.options.system', fallback: 'System' },
];

type Props = {
  value: ThemeMode;
  onChange: (mode: ThemeMode) => void;
  getLabel: (key: string, fallback: string) => string;
};

export function ThemeModeSegmentedControl({ value, onChange, getLabel }: Props) {
  const colors = useAppColors();
  const options = THEME_OPTIONS;
  const selectedIndex = Math.max(0, options.findIndex((o) => o.mode === value));
  const [containerWidth, setContainerWidth] = useState(0);
  const count = options.length;
  const gap = 6;
  const padding = 6;
  const height = 40;
  const thumbAnim = useRef(new Animated.Value(0)).current;

  const segmentWidth = useMemo(() => {
    if (!containerWidth || count === 0) return 0;
    const totalGaps = gap * (count - 1);
    const inner = containerWidth - padding * 2 - totalGaps;
    return Math.max(0, inner / count);
  }, [containerWidth, count]);

  useEffect(() => {
    const toX = padding + selectedIndex * (segmentWidth + gap);
    Animated.spring(thumbAnim, {
      toValue: toX,
      useNativeDriver: true,
      friction: 10,
      tension: 140,
    }).start();
  }, [selectedIndex, segmentWidth, thumbAnim]);

  const onLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  return (
    <View>
      <XStack
        onLayout={onLayout}
        position="relative"
        ai="center"
        bg={colors.borderSoft}
        br="$10"
        padding={padding}
        height={height + padding * 2}
      >
        {segmentWidth > 0 && (
          <Animated.View
            style={{
              position: 'absolute',
              top: padding,
              height,
              width: segmentWidth,
              borderRadius: 999,
              backgroundColor: colors.card,
              transform: [{ translateX: thumbAnim }],
              borderWidth: 1,
              borderColor: colors.border,
              elevation: 2,
            }}
          />
        )}

        {options.map((opt, idx) => {
          const active = idx === selectedIndex;
          const label = getLabel(opt.labelKey, opt.fallback);
          return (
            <Pressable
              key={opt.mode}
              onPress={() => {
                if (!active) onChange(opt.mode);
              }}
              style={{
                height,
                width: segmentWidth || undefined,
                flex: segmentWidth ? undefined : 1,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: idx < count - 1 ? gap : 0,
                zIndex: 1,
              }}
            >
              <Text fontSize={13} fontWeight="700" color={active ? colors.text : colors.textMuted}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </XStack>
    </View>
  );
}
