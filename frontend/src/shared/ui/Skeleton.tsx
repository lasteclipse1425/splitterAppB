import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { YStack } from 'tamagui';
import { useAppColors } from '@/shared/ui/theme-context';

type SkeletonProps = {
  width?: number | string;
  height?: number;
  borderRadius?: number;
};

export function Skeleton({ width = '100%', height = 16, borderRadius = 8 }: SkeletonProps) {
  const colors = useAppColors();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + progress.value * 0.35,
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: colors.skeleton,
        },
        animatedStyle,
      ]}
    />
  );
}

export function SkeletonCard() {
  const colors = useAppColors();

  return (
    <YStack
      w={358}
      h={110}
      br={16}
      borderWidth={1}
      borderColor={colors.border}
      bg={colors.card}
      p="$3.5"
      gap="$2"
      justifyContent="space-between"
    >
      <YStack gap="$2">
        <Skeleton width="55%" height={18} />
        <Skeleton width="40%" height={12} />
      </YStack>
      <Skeleton width={92} height={28} borderRadius={14} />
    </YStack>
  );
}

const styles = StyleSheet.create({});
