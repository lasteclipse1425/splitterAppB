import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable } from 'react-native';
import { XStack, Text, View } from 'tamagui';
import { CURRENCIES, SUPPORTED_CURRENCIES, type CurrencyCode } from '@/shared/lib/money';
import { useAppColors } from '@/shared/ui/theme-context';

type Tone = 'surface' | 'dark';

type Props = {
  value: CurrencyCode;
  onChange: (code: CurrencyCode) => void;
  /** "surface" follows the app theme, "dark" suits a camera/overlay background. */
  tone?: Tone;
};

export function CurrencySegmentedControl({ value, onChange, tone = 'surface' }: Props) {
  const colors = useAppColors();
  const options = SUPPORTED_CURRENCIES;
  const selectedIndex = Math.max(0, options.findIndex((c) => c === value));
  const [containerWidth, setContainerWidth] = useState(0);
  const count = options.length;
  const gap = 6;
  const padding = 6;
  const height = 38;
  const thumbAnim = useRef(new Animated.Value(0)).current;

  const palette =
    tone === 'dark'
      ? {
          track: 'rgba(255,255,255,0.12)',
          thumb: '#FFFFFF',
          thumbBorder: 'rgba(255,255,255,0.4)',
          activeText: '#10202B',
          inactiveText: 'rgba(255,255,255,0.85)',
        }
      : {
          track: colors.borderSoft,
          thumb: colors.card,
          thumbBorder: colors.border,
          activeText: colors.text,
          inactiveText: colors.textMuted,
        };

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
        bg={palette.track}
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
              backgroundColor: palette.thumb,
              transform: [{ translateX: thumbAnim }],
              borderWidth: 1,
              borderColor: palette.thumbBorder,
              elevation: 2,
            }}
          />
        )}

        {options.map((code, idx) => {
          const active = idx === selectedIndex;
          const meta = CURRENCIES[code];
          return (
            <Pressable
              key={code}
              onPress={() => {
                if (!active) onChange(code);
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
              <Text fontSize={13} fontWeight="700" color={active ? palette.activeText : palette.inactiveText}>
                {meta.symbol} {meta.code}
              </Text>
            </Pressable>
          );
        })}
      </XStack>
    </View>
  );
}
