import React, { ReactNode } from 'react';
import { Platform, TextInputProps } from 'react-native';
import { YStack, XStack, Text, Input as TInput } from 'tamagui';
import { useAppColors } from '@/shared/ui/theme-context';
import { appRadii } from '@/shared/ui/app-tokens';

export type CustomInputProps = {
  id?: string;
  name?: string;
  label?: string;
  value?: string;
  onChangeText?: (t: string) => void;
  placeholder?: string;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  secureTextEntry?: boolean;
  error?: string;
  required?: boolean;
  rightAdornment?: ReactNode;
  textInputProps?: Partial<TextInputProps>;
};

export function Input({
  id,
  name,
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
  error,
  required,
  rightAdornment,
  textInputProps,
}: CustomInputProps) {
  const colors = useAppColors();

  const webIdentityProps: Record<string, string> | undefined =
    Platform.OS === 'web'
      ? {
          ...(id ? { id } : {}),
          ...(name ? { name } : {}),
        }
      : undefined;

  return (
    <YStack space="$2" w="100%">
      {!!label && (
        <Text fontSize="$3" fontWeight="600" color={colors.text}>
          {label}
          {required && <Text color="$red10"> *</Text>}
        </Text>
      )}

      <XStack position="relative" w="100%">
        <TInput
          w="100%"
          f={1}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secureTextEntry}
          paddingRight={rightAdornment ? 44 : undefined}
          borderRadius={appRadii.md}
          borderWidth={1}
          borderColor={error ? '$red8' : colors.border}
          backgroundColor={colors.card}
          height="$4"
          fontSize="$4"
          focusStyle={{ borderColor: error ? '$red8' : colors.primary }}
          {...webIdentityProps}
          {...textInputProps}
        />

        {rightAdornment && (
          <XStack
            position="absolute"
            right={8}
            top={0}
            bottom={0}
            ai="center"
            jc="center"
            pointerEvents="box-none"
          >
            {rightAdornment}
          </XStack>
        )}
      </XStack>

      {!!error && (
        <Text fontSize="$3" color="$red10">
          {error}
        </Text>
      )}
    </YStack>
  );
}

export default Input;
