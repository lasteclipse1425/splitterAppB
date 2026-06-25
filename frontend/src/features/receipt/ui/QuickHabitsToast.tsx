import React, { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { XStack, YStack, Text, Button } from 'tamagui';
import { Check, Undo2 } from '@tamagui/lucide-icons';
import { useQuickHabitsUiStore } from '@/features/receipt/model/quick-habits-ui.store';
import { useReceiptSessionStore } from '@/features/receipt/model/receipt-session.store';

const TOAST_DURATION_MS = 5000;

export function QuickHabitsToast() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const toastVisible = useQuickHabitsUiStore((s) => s.toastVisible);
  const undoSnapshot = useQuickHabitsUiStore((s) => s.undoSnapshot);
  const hideToast = useQuickHabitsUiStore((s) => s.hideToast);
  const setItems = useReceiptSessionStore((s) => s.setItems);

  useEffect(() => {
    if (!toastVisible) return;
    const timer = setTimeout(() => hideToast(), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toastVisible, hideToast]);

  if (!toastVisible) return null;

  const handleUndo = () => {
    if (undoSnapshot) {
      setItems(undoSnapshot);
    }
    hideToast();
  };

  return (
    <YStack
      position="absolute"
      left={16}
      right={16}
      bottom={(insets.bottom ?? 0) + 16}
      zIndex={200}
      pointerEvents="box-none"
    >
      <XStack
        bg="#2C3D4F"
        borderRadius={12}
        px="$3.5"
        py="$3"
        ai="center"
        jc="space-between"
        gap="$3"
        elevation={8}
        shadowColor="#000"
        shadowOpacity={0.2}
        shadowRadius={8}
        shadowOffset={{ width: 0, height: 4 }}
      >
        <XStack ai="center" gap="$2" f={1}>
          <Check size={18} color="#2ECC71" />
          <Text color="white" fontSize={14} fontWeight="600" f={1}>
            {t('quickHabits.applied', 'Habits applied')}
          </Text>
        </XStack>
        {undoSnapshot && (
          <Button
            unstyled
            onPress={handleUndo}
            px="$2.5"
            py="$1.5"
            borderRadius={8}
            bg="rgba(255,255,255,0.12)"
            pressStyle={{ opacity: 0.85 }}
          >
            <XStack ai="center" gap="$1.5">
              <Undo2 size={14} color="white" />
              <Text color="white" fontSize={13} fontWeight="600">
                {t('quickHabits.undo', 'Undo')}
              </Text>
            </XStack>
          </Button>
        )}
      </XStack>
    </YStack>
  );
}
