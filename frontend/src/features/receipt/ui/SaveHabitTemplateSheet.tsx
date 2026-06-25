import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { YStack, XStack, Text, Button, Input as TInput, ScrollView } from 'tamagui';
import { X, Zap } from '@tamagui/lucide-icons';

import { useQuickHabitsUiStore } from '@/features/receipt/model/quick-habits-ui.store';
import { useQuickHabitsStore } from '@/features/receipt/model/quick-habits.store';
import { useReceiptSessionStore } from '@/features/receipt/model/receipt-session.store';
import { success as hapticSuccess } from '@/shared/lib/haptics';

const GREEN = '#2ECC71';

export function SaveHabitTemplateSheet() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isOpen = useQuickHabitsUiStore((s) => s.saveTemplateOpen);
  const closeSaveTemplate = useQuickHabitsUiStore((s) => s.closeSaveTemplate);
  const saveCurrentSessionAsTemplate = useQuickHabitsStore((s) => s.saveCurrentSessionAsTemplate);

  const items = useReceiptSessionStore((s) => s.items);
  const participants = useReceiptSessionStore((s) => s.participants);
  const currency = useReceiptSessionStore((s) => s.currency);
  const sessionName = useReceiptSessionStore((s) => s.session?.sessionName);

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const grandTotal = useMemo(
    () => items.reduce((sum, item) => sum + (item.totalPrice ?? item.unitPrice * item.quantity), 0),
    [items]
  );

  const handleClose = () => {
    setName('');
    setSaved(false);
    closeSaveTemplate();
  };

  const handleSave = async () => {
    const trimmed = name.trim() || sessionName?.trim() || t('quickHabits.defaultTemplateName', 'My split');
    setSaving(true);
    try {
      await saveCurrentSessionAsTemplate(trimmed);
      setSaved(true);
      void hapticSuccess();
      setTimeout(handleClose, 1200);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <KeyboardAvoidingView
      style={{ position: 'absolute', inset: 0, zIndex: 160, justifyContent: 'flex-end' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Pressable
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)' }}
        onPress={handleClose}
      />

      <YStack
        bg="$color1"
        borderTopLeftRadius={16}
        borderTopRightRadius={16}
        pb={insets.bottom + 8}
        px="$3.5"
        pt="$3"
        gap="$2.5"
        borderWidth={1}
        borderColor="$gray5"
      >
        <XStack ai="center" jc="space-between">
          <XStack ai="center" gap="$2">
            <Zap size={18} color={GREEN} />
            <Text fontSize={16} fontWeight="700" color="#2C3D4F">
              {t('quickHabits.saveAsTemplate', 'Save as Quick Habit')}
            </Text>
          </XStack>
          <Button unstyled onPress={handleClose} p="$1">
            <X size={18} color="$gray10" />
          </Button>
        </XStack>

        <Text fontSize={12} color="$gray10">
          {t('quickHabits.saveAsTemplateHint', 'Save this split as a reusable habit template')}
        </Text>

        <TInput
          placeholder={t('quickHabits.templateNamePlaceholder', 'e.g. Office lunch')}
          value={name}
          onChangeText={setName}
          h={40}
          px="$3"
          borderWidth={1}
          borderColor="$gray6"
          borderRadius={8}
          fontSize={14}
        />

        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="none" style={{ maxHeight: 120 }}>
          <YStack gap="$1" p="$2.5" bg="$gray2" borderRadius={8}>
            <Text fontSize={12} color="$gray11">
              {t('quickHabits.templatePreview', {
                participants: participants.length,
                items: items.length,
                total: `${Math.round(grandTotal).toLocaleString()} ${currency}`,
                defaultValue: `${participants.length} people · ${items.length} items · ${Math.round(grandTotal).toLocaleString()} ${currency}`,
              })}
            </Text>
          </YStack>
        </ScrollView>

        <Button
          unstyled
          bg={saved ? '#2ECC711A' : GREEN}
          h={42}
          borderRadius={10}
          ai="center"
          jc="center"
          disabled={saving || saved || items.length === 0 || participants.length === 0}
          opacity={items.length === 0 || participants.length === 0 ? 0.5 : 1}
          onPress={handleSave}
          pressStyle={{ opacity: 0.9 }}
        >
          <Text fontSize={15} fontWeight="700" color={saved ? GREEN : 'white'}>
            {saved
              ? t('quickHabits.templateSaved', 'Habit saved')
              : t('quickHabits.saveTemplate', 'Save habit')}
          </Text>
        </Button>
      </YStack>
    </KeyboardAvoidingView>
  );
}
