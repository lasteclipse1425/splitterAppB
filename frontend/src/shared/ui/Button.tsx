import { forwardRef, type ComponentProps, type ComponentRef } from 'react';
import { Button as TamaguiButton, Text } from 'tamagui';
import { useAppTheme } from '@/shared/ui/theme-context';
import { appRadii } from '@/shared/ui/app-tokens';

type Variant = 'primary' | 'secondary' | 'outline';
type Size = 'small' | 'medium' | 'large';
type TamaguiButtonProps = ComponentProps<typeof TamaguiButton>;
type TamaguiButtonRef = ComponentRef<typeof TamaguiButton>;

interface CustomButtonProps
  extends Omit<TamaguiButtonProps, 'children' | 'size' | 'disabled' | 'variant'> {
  title: string;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
}

const sizeStyles: Record<Size, { height: '$3' | '$4' | '$5'; paddingHorizontal: '$4' | '$6' | '$8' }> = {
  small: { height: '$3', paddingHorizontal: '$4' },
  medium: { height: '$4', paddingHorizontal: '$6' },
  large: { height: '$5', paddingHorizontal: '$8' },
};

export const Button = forwardRef<TamaguiButtonRef, CustomButtonProps>(
  ({ title, variant = 'primary', size = 'medium', disabled = false, ...rest }, ref) => {
    const { colors, greenOutline, appShadow } = useAppTheme();

    const variantStyles: Record<Variant, { backgroundColor: string; color: string; borderWidth?: number; borderColor?: string }> = {
      primary: {
        backgroundColor: colors.primary,
        color: '#FFFFFF',
      },
      secondary: {
        backgroundColor: colors.card,
        color: colors.text,
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: greenOutline.borderWidth,
        borderColor: colors.primaryBorder,
        color: colors.primaryBorder,
      },
    };

    const tone = variantStyles[variant];

    const styles = {
      borderRadius: appRadii.md,
      pressStyle: { scale: 0.985, opacity: 0.94 },
      ...sizeStyles[size],
      ...tone,
      ...(variant === 'primary' && !disabled ? appShadow.soft : null),
      ...(disabled
        ? {
            backgroundColor: variant === 'outline' ? 'transparent' : '$gray8',
            borderColor: variant === 'outline' ? '$gray8' : tone.borderColor,
            color: '$gray8',
          }
        : null),
    };

    return (
      <TamaguiButton ref={ref} {...styles} disabled={disabled} {...rest}>
        <Text color={styles.color} fontWeight="600" fontSize="$4">
          {title}
        </Text>
      </TamaguiButton>
    );
  }
);

Button.displayName = 'Button';
