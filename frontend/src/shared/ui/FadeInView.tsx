import React from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';

type Props = {
  children: React.ReactNode;
  /** Stagger index for list items */
  index?: number;
  /** Extra delay in ms */
  delay?: number;
  /** When false, children render without animation */
  enabled?: boolean;
};

export function FadeInView({ children, index = 0, delay = 0, enabled = true }: Props) {
  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <Animated.View
      entering={FadeInDown.delay(delay + index * 40)
        .duration(280)
        .springify()
        .damping(22)}
    >
      {children}
    </Animated.View>
  );
}
