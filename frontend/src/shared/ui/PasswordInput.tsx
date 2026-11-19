import React, { useState } from 'react';
import { Pressable } from 'react-native';
import { XStack } from 'tamagui';
import { Eye, EyeOff } from '@tamagui/lucide-icons';
import { Input } from '@/shared/ui/Input';

type Props = {
  id?: string;
  name?: string;
  label?: string;
  placeholder?: string;
  value?: string;
  onChangeText?: (t: string) => void;
  error?: string;
  required?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  textInputProps?: any;
};

export default function PasswordInput({
  id,
  name,
  label,
  placeholder = 'Enter your password',
  value,
  onChangeText,
  error,
  required,
  autoCapitalize = 'none',
  textInputProps,
}: Props) {
  const [show, setShow] = useState(false);

  const eye = (
    <Pressable
      onPress={() => setShow(s => !s)}
      hitSlop={6}
      android_ripple={{ color: 'rgba(128,128,128,0.15)', borderless: true }}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="button"
      accessibilityLabel={show ? 'Hide password' : 'Show password'}
    >
      {/* Use theme-aware $gray11 via Tamagui icon color prop — but Lucide
          icons in a Pressable need a literal value. We use a medium gray
          that is readable on both light (#FFF) and dark (#0D1117) surfaces. */}
      {show
        ? <EyeOff size={18} color="$gray11" />
        : <Eye size={18} color="$gray11" />
      }
    </Pressable>
  );

  return (
    <XStack w="100%">
      <Input
        id={id}
        name={name}
        label={label}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!show}
        autoCapitalize={autoCapitalize}
        error={error}
        required={required}
        rightAdornment={eye}
        textInputProps={{
          autoComplete: 'off',
          textContentType: 'none',
          importantForAutofill: 'no',
          ...textInputProps,
        }}
      />
    </XStack>
  );
}
