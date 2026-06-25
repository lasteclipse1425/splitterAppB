import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { XStack, YStack, Text, Button } from 'tamagui';
import { Zap, Settings2 } from '@tamagui/lucide-icons';
import type { HabitMatch, HabitParticipant } from '@/features/receipt/lib/quick-habits.types';
import { useQuickHabitsUiStore } from '@/features/receipt/model/quick-habits-ui.store';
import { appRadii } from '@/shared/ui/app-tokens';
import { useAppTheme } from '@/shared/ui/theme-context';

type Props = {
  matchCount: number;
  totalItems: number;
  matches: Record<string, HabitMatch>;
  matchIds: string[];
  participants: HabitParticipant[];
  itemNames: Record<string, string>;
  onApplyAll: (selectedIds: string[]) => void;
  onSplitAllEqually: () => void;
};

export function QuickHabitsBanner({
  matchCount,
  totalItems,
  matches,
  matchIds,
  onApplyAll,
  onSplitAllEqually,
}: Props) {
  const { t } = useTranslation();
  const { colors, greenOutline, greenSurface } = useAppTheme();
  const open = useQuickHabitsUiStore((s) => s.open);
  const selectAllMatches = useQuickHabitsUiStore((s) => s.selectAllMatches);

  useEffect(() => {
    if (matchIds.length > 0) {
      selectAllMatches(matchIds);
    }
  }, [matchIds, selectAllMatches]);

  const hasMatches = matchCount > 0;

  return (
    <YStack
      borderRadius={appRadii.lg}
      p="$3.5"
      gap="$3"
      mt="$1"
      {...(hasMatches
        ? greenSurface
        : {
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
          })}
    >
      <XStack ai="center" jc="space-between" gap="$2">
        <XStack ai="center" gap="$2" f={1}>
          <Zap size={18} color={hasMatches ? colors.primaryBorder : colors.textMuted} />
          <YStack gap="$0.5" f={1}>
            <Text fontSize={15} fontWeight="700" color={colors.text}>
              {hasMatches
                ? t('quickHabits.smartSplit', 'Smart Split by Habits')
                : t('quickHabits.quickActions', 'Quick Actions')}
            </Text>
            <Text fontSize={12} color="$gray10">
              {hasMatches
                ? t('quickHabits.foundMatches', {
                    count: matchCount,
                    total: totalItems,
                    defaultValue: `Matched ${matchCount} of ${totalItems} items`,
                  })
                : t('quickHabits.noMatchesHint', 'Split all items or use saved habits')}
            </Text>
          </YStack>
        </XStack>

        {hasMatches && (
          <Button
            unstyled
            bg={colors.primary}
            onPress={() => onApplyAll(matchIds)}
            px="$3"
            py="$2"
            borderRadius={8}
            pressStyle={{ opacity: 0.9 }}
          >
            <Text fontSize={13} fontWeight="700" color="white">
              {t('quickHabits.applyAll', 'Apply all')}
            </Text>
          </Button>
        )}
      </XStack>

      <XStack gap="$2" flexWrap="wrap" ai="center">
        {!hasMatches && (
          <Button
            unstyled
            bg={colors.primary}
            onPress={onSplitAllEqually}
            px="$3.5"
            py="$2"
            borderRadius={8}
            pressStyle={{ opacity: 0.9 }}
          >
            <Text fontSize={13} fontWeight="700" color="white">
              {t('quickHabits.splitAllEqually', 'Split all equally')}
            </Text>
          </Button>
        )}

        {hasMatches && (
          <Button
            unstyled
            {...greenOutline}
            bg="transparent"
            onPress={onSplitAllEqually}
            px="$3"
            py="$1.5"
            borderRadius={8}
            pressStyle={{ opacity: 0.9 }}
          >
            <Text fontSize={12} fontWeight="600" color={colors.primaryBorder}>
              {t('quickHabits.splitAllEqually', 'Split all equally')}
            </Text>
          </Button>
        )}

        {hasMatches && (
          <Button
            unstyled
            {...greenOutline}
            bg="transparent"
            onPress={() => open('suggestions')}
            px="$3"
            py="$1.5"
            borderRadius={8}
            pressStyle={{ opacity: 0.9 }}
          >
            <Text fontSize={12} fontWeight="600" color={colors.primaryBorder}>
              {t('quickHabits.review', 'Review')}
            </Text>
          </Button>
        )}

        <Button
          unstyled
          borderWidth={1}
          borderColor="$gray7"
          bg="transparent"
          onPress={() => open('templates')}
          px="$3"
          py="$1.5"
          borderRadius={8}
          pressStyle={{ opacity: 0.9 }}
        >
          <XStack ai="center" gap="$1.5">
            <Settings2 size={14} color="$gray11" />
            <Text fontSize={12} fontWeight="600" color="$gray11">
              {t('quickHabits.habitsTab', 'Quick Habits')}
            </Text>
          </XStack>
        </Button>
      </XStack>
    </YStack>
  );
}
