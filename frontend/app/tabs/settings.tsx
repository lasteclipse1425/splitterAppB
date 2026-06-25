// app/tabs/settings.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { YStack, Text, XStack } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button } from '@/shared/ui/Button';
import { ScreenContainer } from '@/shared/ui/ScreenContainer';
import Input from '@/shared/ui/Input';
import PasswordInput from '@/shared/ui/PasswordInput';
import { FadeInView } from '@/shared/ui/FadeInView';
import { appRadii } from '@/shared/ui/app-tokens';
import { useAppTheme } from '@/shared/ui/theme-context';
import { useEntryAnimation } from '@/shared/lib/hooks/useEntryAnimation';
import { tapLight } from '@/shared/lib/haptics';
import { useAppStore, type ThemeMode } from '@/shared/lib/stores/app-store';
import { changePassword, updateUsername } from '@/features/auth/api';
import { LANGUAGE_OPTIONS, type LanguageCode } from '@/shared/config/languages';
import { ThemeModeSegmentedControl } from '@/shared/ui/ThemeModeSegmentedControl';
import { CurrencySegmentedControl } from '@/shared/ui/CurrencySegmentedControl';
import type { CurrencyCode } from '@/shared/lib/money';

export default function SettingsScreen() {
  const { user, setUser, language, setLanguage, themeMode, setThemeMode, colorblind, setColorblind, defaultCurrency, setDefaultCurrency } = useAppStore();
  const { t } = useTranslation();
  const isLoggedIn = !!user;

  const [usernameValue, setUsernameValue] = useState(user?.username ?? '');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    setUsernameValue(user?.username ?? '');
  }, [user?.username]);

  const usernameDirty = useMemo(() => {
    const trimmed = usernameValue.trim();
    return trimmed.length > 0 && trimmed !== (user?.username ?? '').trim();
  }, [usernameValue, user?.username]);

  const validateUsername = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return 'Username cannot be empty';
    if (trimmed.length < 2) return 'Username must be at least 2 characters';
    return null;
  };

  const validatePasswordForm = () => {
    if (!currentPassword.trim()) return 'Enter your current password';
    if (newPassword.length < 8) return 'New password must be at least 8 characters';
    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasLowercase = /[a-z]/.test(newPassword);
    const hasNumber = /\d/.test(newPassword);
    const hasSymbol = /[^A-Za-z0-9\s]/.test(newPassword);
    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSymbol) {
      return 'Password must include uppercase, lowercase, number, and special character';
    }
    if (newPassword !== confirmPassword) return 'Passwords do not match';
    if (newPassword === currentPassword) return 'Choose a different password';
    return null;
  };

  const handleLanguageChange = (code: LanguageCode) => {
    if (code === language) return;
    void tapLight();
    setLanguage(code);
  };

  const handleSaveUsername = async () => {
    if (!isLoggedIn) {
      Alert.alert('Unavailable', 'Sign in to update your username.');
      return;
    }
    const error = validateUsername(usernameValue);
    if (error) {
      setUsernameError(error);
      return;
    }
    setUsernameError(null);

    const trimmed = usernameValue.trim();

    try {
      setIsUpdatingUsername(true);
      const updatedUser = await updateUsername({ username: trimmed });
      setUser(updatedUser);
      Alert.alert('Success', 'Username updated.');
    } catch (error) {
      console.error('Username update failed:', error);
      const message = error instanceof Error ? error.message : 'Could not update the username.';
      Alert.alert('Error', message);
    } finally {
      setIsUpdatingUsername(false);
    }
  };

  const handleChangePassword = async () => {
    if (!isLoggedIn) {
      Alert.alert('Unavailable', 'Sign in to change your password.');
      return;
    }

    const error = validatePasswordForm();
    if (error) {
      setPasswordError(error);
      return;
    }
    setPasswordError(null);

    try {
      setIsChangingPassword(true);
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Password updated', 'Your password has been changed.');
    } catch (error) {
      console.error('Password change failed:', error);
      const message = error instanceof Error ? error.message : 'Could not change the password.';
      Alert.alert('Error', message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  useEffect(() => {
    if (usernameError && usernameValue.trim().length >= 2) {
      setUsernameError(null);
    }
  }, [usernameError, usernameValue]);

  useEffect(() => {
    if (passwordError) {
      const err = validatePasswordForm();
      if (!err) setPasswordError(null);
    }
  }, [currentPassword, newPassword, confirmPassword, passwordError]);

  const entryAnim = useEntryAnimation();
  const { colors, surfaceCardProps } = useAppTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.select({ ios: 0, android: 0 }) ?? 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <ScreenContainer>
            <YStack space="$5">
              <FadeInView index={0} enabled={entryAnim}>
              {/* Header */}
              <YStack space="$3" mt="$2">
                <Text fontSize={20} fontWeight="700" color={colors.text}>
                  Account settings
                </Text>
                <Text color={colors.textMuted}>
                  Update your username and password using the forms below.
                </Text>
              </YStack>
              </FadeInView>

              <FadeInView index={1} enabled={entryAnim}>
              {/* APPEARANCE */}
              <YStack space="$3" p="$4" {...surfaceCardProps}>
                <Text fontSize={16} fontWeight="600" color={colors.text}>
                  {t('settings.theme.title', 'Appearance')}
                </Text>
                <Text fontSize={14} color={colors.textMuted}>
                  {t('settings.theme.description', 'Choose how the app looks on your device.')}
                </Text>
                <ThemeModeSegmentedControl
                  value={themeMode}
                  onChange={(mode: ThemeMode) => {
                    if (mode !== themeMode) void tapLight();
                    setThemeMode(mode);
                  }}
                  getLabel={(key, fallback) => t(key, fallback)}
                />
                <XStack ai="center" jc="space-between" pt="$1">
                  <YStack f={1} pr="$3">
                    <Text fontSize={14} fontWeight="600" color={colors.text}>
                      {t('settings.colorblind.title', 'Colorblind-friendly')}
                    </Text>
                    <Text fontSize={12} color={colors.textMuted}>
                      {t('settings.colorblind.description', 'Uses blue and amber instead of green and red.')}
                    </Text>
                  </YStack>
                  <Button
                    title={colorblind ? t('common.on', 'On') : t('common.off', 'Off')}
                    variant={colorblind ? 'primary' : 'outline'}
                    size="small"
                    onPress={() => {
                      void tapLight();
                      setColorblind(!colorblind);
                    }}
                  />
                </XStack>

                <YStack gap="$1.5" pt="$1">
                  <Text fontSize={14} fontWeight="600" color={colors.text}>
                    {t('settings.currency.title', 'Default currency')}
                  </Text>
                  <Text fontSize={12} color={colors.textMuted}>
                    {t('settings.currency.description', 'Used for new receipts when the currency is unclear.')}
                  </Text>
                  <CurrencySegmentedControl
                    value={defaultCurrency}
                    onChange={(code: CurrencyCode) => {
                      if (code !== defaultCurrency) void tapLight();
                      setDefaultCurrency(code);
                    }}
                  />
                </YStack>
              </YStack>
              </FadeInView>

              <FadeInView index={2} enabled={entryAnim}>
              {/* LANGUAGE */}
              <YStack space="$3" p="$4" {...surfaceCardProps}>
                <Text fontSize={16} fontWeight="600" color={colors.text}>
                  {t('settings.language.title', 'Language')}
                </Text>
                <Text fontSize={14} color={colors.textMuted}>
                  {t('settings.language.description', 'Choose the language used across the app.')}
                </Text>

                <XStack
                  space="$2"
                  backgroundColor={colors.borderSoft}
                  borderRadius={appRadii.lg}
                  padding="$1"
                  flexWrap="wrap"
                >
                  {LANGUAGE_OPTIONS.map((option) => {
                    const isActive = option.code === language;
                    const label = t(
                      `settings.language.options.${option.code}`,
                      option.shortLabel
                    );
                    return (
                      <Button
                        key={option.code}
                        title={label}
                        variant={isActive ? 'primary' : 'outline'}
                        size="small"
                        onPress={() => handleLanguageChange(option.code)}
                      />
                    );
                  })}
                </XStack>
              </YStack>
              </FadeInView>

              <FadeInView index={3} enabled={entryAnim}>
              {/* USERNAME */}
              <YStack space="$3" p="$4" {...surfaceCardProps}>
                <Text fontSize={16} fontWeight="600" color={colors.text}>Username</Text>
                <Input
                  value={usernameValue}
                  onChangeText={setUsernameValue}
                  placeholder="Enter a new username"
                  textInputProps={{ autoCapitalize: 'none', autoCorrect: false }}
                  error={usernameError || undefined}
                />
                <XStack space="$2">
                  <Button
                    title={isUpdatingUsername ? 'Saving...' : 'Save username'}
                    variant="primary"
                    size="medium"
                    disabled={!usernameDirty || isUpdatingUsername}
                    onPress={handleSaveUsername}
                  />
                  <Button
                    title="Reset"
                    variant="outline"
                    size="medium"
                    disabled={!usernameDirty}
                    onPress={() => setUsernameValue(user?.username ?? '')}
                  />
                </XStack>
              </YStack>
              </FadeInView>

              <FadeInView index={4} enabled={entryAnim}>
              {/* PASSWORD */}
              <YStack space="$3" p="$4" {...surfaceCardProps}>
                <Text fontSize={16} fontWeight="600" color={colors.text}>Password</Text>
                <PasswordInput
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Current password"
                  textInputProps={{ returnKeyType: 'next' }}
                />
                <PasswordInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="New password"
                  textInputProps={{ returnKeyType: 'next' }}
                />
                <Text fontSize={12} color={colors.textMuted}>
                  Password must be at least 8 characters and include uppercase, lowercase, number, and special symbol.
                </Text>
                <PasswordInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  error={passwordError || undefined}
                  textInputProps={{ returnKeyType: 'done' }}
                />
                <Button
                  title={isChangingPassword ? 'Updating...' : 'Change password'}
                  variant="primary"
                  size="medium"
                  disabled={isChangingPassword}
                  onPress={handleChangePassword}
                />
              </YStack>
              </FadeInView>
            </YStack>
          </ScreenContainer>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
