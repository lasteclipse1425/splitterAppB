import React, { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const COLORS = ['#2ECC71', '#27AE60', '#F1C40F', '#3498DB', '#E74C3C', '#9B59B6'];

type ConfettiPieceProps = {
  startX: number;
  delay: number;
  color: string;
  size: number;
  fallDistance: number;
  drift: number;
  duration: number;
  rotateTo: number;
};

function ConfettiPiece({
  startX,
  delay,
  color,
  size,
  fallDistance,
  drift,
  duration,
  rotateTo,
}: ConfettiPieceProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration, easing: Easing.out(Easing.quad) })
    );
  }, [delay, duration, progress]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const opacity = p < 0.85 ? 1 : 1 - (p - 0.85) / 0.15;
    return {
      transform: [
        { translateX: startX + drift * p },
        { translateY: -40 + fallDistance * p },
        { rotate: `${rotateTo * p}deg` },
      ],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          width: size,
          height: size * 0.5,
          backgroundColor: color,
          borderRadius: 2,
        },
        style,
      ]}
    />
  );
}

type ConfettiProps = {
  count?: number;
  /** Trigger value: when it changes, confetti replays via remount key */
  burstKey?: number | string;
};

export function Confetti({ count = 60, burstKey = 0 }: ConfettiProps) {
  const { width, height } = Dimensions.get('window');

  const pieces = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const startX = Math.random() * width;
      const drift = (Math.random() - 0.5) * 160;
      return {
        id: `${burstKey}-${i}`,
        startX,
        delay: Math.random() * 400,
        color: COLORS[i % COLORS.length],
        size: 8 + Math.random() * 8,
        fallDistance: height * (0.7 + Math.random() * 0.3),
        drift,
        duration: 1800 + Math.random() * 1200,
        rotateTo: (Math.random() - 0.5) * 720,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, burstKey, width, height]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p) => (
        <ConfettiPiece
          key={p.id}
          startX={p.startX}
          delay={p.delay}
          color={p.color}
          size={p.size}
          fallDistance={p.fallDistance}
          drift={p.drift}
          duration={p.duration}
          rotateTo={p.rotateTo}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
