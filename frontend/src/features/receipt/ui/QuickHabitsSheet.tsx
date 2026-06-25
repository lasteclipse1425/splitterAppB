import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { YStack, XStack, Text, Button, Circle, ScrollView } from 'tamagui';
import { X, Zap, Trash2, Check, History } from '@tamagui/lucide-icons';
import { EmptyState } from '@/shared/ui/EmptyState';

import {
  useQuickHabitsUiStore,
  type QuickHabitsTab,
} from '@/features/receipt/model/quick-habits-ui.store';
import { useQuickHabitsStore } from '@/features/receipt/model/quick-habits.store';
import type { QuickHabitTemplate } from '@/features/receipt/model/quick-habit-template.types';
import { useReceiptSessionStore } from '@/features/receipt/model/receipt-session.store';
import { useQuickHabitSuggestions } from '@/features/receipt/hooks/useQuickHabitSuggestions';
import { formatHabitMatchLabel } from '@/features/receipt/lib/format-habit-label';
import { applyHabitMatchesToItems } from '@/features/receipt/lib/apply-habit-matches';
import { startTemplateSession } from '@/features/receipt/lib/start-template-session';
import type { HabitMatch } from '@/features/receipt/lib/quick-habits.types';

const GREEN = '#2ECC71';

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      unstyled
      f={1}
      py="$2"
      borderRadius={8}
      bg={active ? `${GREEN}1A` : 'transparent'}
      borderWidth={1}
      borderColor={active ? GREEN : '$gray6'}
      onPress={onPress}
      pressStyle={{ opacity: 0.9 }}
    >
      <Text fontSize={12} fontWeight="700" color={active ? GREEN : '$gray11'} textAlign="center">
        {label}
      </Text>
    </Button>
  );
}

function templateSummary(template: QuickHabitTemplate, currency: string) {
  const total = template.items.reduce(
    (sum, item) => sum + (item.totalPrice ?? item.unitPrice * item.quantity),
    0
  );
  return {
    total,
    label: `${template.participants.length} · ${template.items.length} · ${Math.round(total).toLocaleString()} ${currency}`,
  };
}

export function QuickHabitsSheet() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const isOpen = useQuickHabitsUiStore((s) => s.isOpen);
  const flow = useQuickHabitsUiStore((s) => s.flow);
  const activeTab = useQuickHabitsUiStore((s) => s.activeTab);
  const selectedMatchIds = useQuickHabitsUiStore((s) => s.selectedMatchIds);
  const close = useQuickHabitsUiStore((s) => s.close);
  const setActiveTab = useQuickHabitsUiStore((s) => s.setActiveTab);
  const toggleMatchSelection = useQuickHabitsUiStore((s) => s.toggleMatchSelection);
  const selectAllMatches = useQuickHabitsUiStore((s) => s.selectAllMatches);
  const applyHandler = useQuickHabitsUiStore((s) => s.applyHandler);
  const setUndoSnapshot = useQuickHabitsUiStore((s) => s.setUndoSnapshot);
  const showToast = useQuickHabitsUiStore((s) => s.showToast);

  const storeItems = useReceiptSessionStore((s) => s.items);
  const storeParticipants = useReceiptSessionStore((s) => s.participants);
  const setItems = useReceiptSessionStore((s) => s.setItems);

  const templates = useQuickHabitsStore((s) => s.templates);
  const removeTemplate = useQuickHabitsStore((s) => s.removeTemplate);
  const [startingTemplateId, setStartingTemplateId] = useState<string | null>(null);

  const participants = useMemo(
    () =>
      storeParticipants.map((p) => ({
        uniqueId: p.uniqueId,
        username: p.username || p.uniqueId,
      })),
    [storeParticipants]
  );

  const matchableItems = useMemo(
    () =>
      storeItems.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
      })),
    [storeItems]
  );

  const { matches, matchIds } = useQuickHabitSuggestions(matchableItems, participants);

  const itemNames = useMemo(
    () => Object.fromEntries(storeItems.map((item) => [item.id, item.name])),
    [storeItems]
  );

  const hasSession = storeItems.length > 0;
  const isHomeFlow = flow === 'homeStart';

  useEffect(() => {
    if (!isOpen) return;
    if (!isHomeFlow && matchIds.length > 0 && selectedMatchIds.length === 0 && activeTab === 'suggestions') {
      selectAllMatches(matchIds);
    }
  }, [isOpen, isHomeFlow, matchIds, selectedMatchIds.length, activeTab, selectAllMatches]);

  useEffect(() => {
    if (isOpen && !hasSession && !isHomeFlow && activeTab === 'suggestions') {
      setActiveTab('templates');
    }
  }, [isOpen, hasSession, isHomeFlow, activeTab, setActiveTab]);

  const applySelected = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const selectedMatches: Record<string, HabitMatch> = {};
      for (const id of ids) {
        if (matches[id]) selectedMatches[id] = matches[id];
      }
      if (Object.keys(selectedMatches).length === 0) return;

      if (applyHandler) {
        applyHandler(selectedMatches, ids);
      } else if (storeItems.length > 0) {
        setUndoSnapshot([...storeItems]);
        const next = applyHabitMatchesToItems(
          storeItems.map((item) => ({
            id: item.id,
            name: item.name,
            price: item.unitPrice,
            quantity: item.quantity,
            assignedTo: [...item.assignedTo],
            perPersonCount: { ...item.perPersonCount },
            splitMode: item.splitMode,
            totalPrice: item.totalPrice,
          })),
          selectedMatches,
          participants,
          ids
        );
        setItems(
          next.map((item) => ({
            id: item.id,
            name: item.name,
            unitPrice: item.price,
            quantity: item.quantity,
            totalPrice: item.totalPrice ?? item.price * item.quantity,
            splitMode: item.splitMode ?? 'equal',
            assignedTo: item.assignedTo,
            perPersonCount: item.perPersonCount ?? {},
          }))
        );
      }

      showToast();
      close();
    },
    [matches, applyHandler, storeItems, participants, setUndoSnapshot, setItems, showToast, close]
  );

  const handleStartTemplate = useCallback(
    async (template: QuickHabitTemplate) => {
      if (startingTemplateId) return;
      setStartingTemplateId(template.id);
      try {
        await startTemplateSession(template, router, close);
      } catch (error) {
        console.error('Failed to start template session:', error);
      } finally {
        setStartingTemplateId(null);
      }
    },
    [startingTemplateId, router, close]
  );

  const renderTemplates = () => (
    <YStack gap="$2">
      {templates.length === 0 ? (
        <EmptyState
          icon={Zap}
          title={t('quickHabits.noTemplates', 'No saved habits yet')}
          subtitle={t(
            'quickHabits.noTemplatesHint',
            'After scanning and splitting a bill, save it as a Quick Habit'
          )}
        />
      ) : (
        templates.map((template) => {
          const { label } = templateSummary(template, template.currency);
          return (
            <XStack
              key={template.id}
              borderWidth={1}
              borderColor="$gray5"
              borderRadius={10}
              ai="center"
              overflow="hidden"
            >
              <Pressable
                style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.85 }]}
                onPress={() => handleStartTemplate(template)}
              >
                <YStack p="$2.5" gap="$0.5">
                  <Text fontWeight="700" fontSize={14} numberOfLines={1}>
                    {template.name}
                  </Text>
                  <Text fontSize={11} color="$gray10">
                    {label}
                  </Text>
                  <Text fontSize={10} color="$gray9" numberOfLines={1}>
                    {template.participants.map((p) => p.username).join(', ')}
                  </Text>
                </YStack>
              </Pressable>
              <Button
                unstyled
                p="$2.5"
                onPress={() => removeTemplate(template.id)}
                pressStyle={{ opacity: 0.9 }}
              >
                <Trash2 size={16} color="#E74C3C" />
              </Button>
            </XStack>
          );
        })
      )}
    </YStack>
  );

  if (!isOpen) return null;

  const tabs: { id: QuickHabitsTab; label: string; hidden?: boolean }[] = isHomeFlow
    ? [{ id: 'templates', label: t('quickHabits.habitsTab', 'Quick Habits') }]
    : [
        {
          id: 'suggestions',
          label: t('quickHabits.suggestions', 'Match'),
          hidden: !hasSession,
        },
        { id: 'templates', label: t('quickHabits.habitsTab', 'Quick Habits') },
      ];

  return (
    <KeyboardAvoidingView
      style={{ position: 'absolute', inset: 0, zIndex: 150, justifyContent: 'flex-end' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Pressable
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)' }}
        onPress={close}
      />

      <YStack
        bg="$color1"
        borderTopLeftRadius={16}
        borderTopRightRadius={16}
        maxHeight="78%"
        pb={insets.bottom + 4}
        borderWidth={1}
        borderColor="$gray5"
      >
        <XStack px="$3.5" pt="$3" pb="$1.5" ai="center" jc="space-between">
          <XStack ai="center" gap="$2" f={1}>
            <Zap size={18} color={GREEN} />
            <Text fontSize={16} fontWeight="700" color="#2C3D4F">
              {t('quickHabits.title', 'Quick Habits')}
            </Text>
          </XStack>
          <Button unstyled onPress={close} p="$1">
            <X size={18} color="$gray10" />
          </Button>
        </XStack>

        {tabs.filter((tab) => !tab.hidden).length > 1 && (
          <XStack px="$3.5" gap="$1.5" pb="$2">
            {tabs
              .filter((tab) => !tab.hidden)
              .map((tab) => (
                <TabButton
                  key={tab.id}
                  label={tab.label}
                  active={activeTab === tab.id}
                  onPress={() => setActiveTab(tab.id)}
                />
              ))}
          </XStack>
        )}

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          style={{ maxHeight: 420 }}
          contentContainerStyle={{ paddingBottom: 12 }}
        >
          <YStack px="$3.5" pb="$2" gap="$2">
            {activeTab === 'templates' && renderTemplates()}

            {activeTab === 'suggestions' && (
              <>
                {matchIds.length === 0 ? (
                  <EmptyState
                    icon={History}
                    title={t('quickHabits.noMatches', 'No matches from saved habits')}
                    subtitle={t('quickHabits.noMatchesHint', 'Split all items or use saved habits')}
                  />
                ) : (
                  <>
                    <Text fontSize={12} color="$gray10">
                      {t('quickHabits.selectItems', 'Select items to apply')}
                    </Text>
                    {matchIds.map((itemId) => {
                      const match = matches[itemId];
                      const selected = selectedMatchIds.includes(itemId);
                      return (
                        <Pressable key={itemId} onPress={() => toggleMatchSelection(itemId)}>
                          <XStack
                            p="$2.5"
                            borderWidth={1}
                            borderColor={selected ? GREEN : '$gray5'}
                            borderRadius={8}
                            bg={selected ? `${GREEN}0D` : '$color1'}
                            ai="center"
                            gap="$2"
                          >
                            <Circle
                              size={18}
                              borderColor={GREEN}
                              borderWidth={1.5}
                              bg={selected ? GREEN : 'transparent'}
                              ai="center"
                              jc="center"
                            >
                              {selected && <Check size={10} color="white" />}
                            </Circle>
                            <YStack f={1} gap="$0.5">
                              <Text fontWeight="700" fontSize={13}>
                                {itemNames[itemId] || itemId}
                              </Text>
                              <Text fontSize={11} color="$gray10">
                                {formatHabitMatchLabel(match, participants)}
                              </Text>
                              <XStack ai="center" gap="$1">
                                {match.source === 'history' ? (
                                  <History size={11} color="$gray9" />
                                ) : (
                                  <Zap size={11} color={GREEN} />
                                )}
                                <Text fontSize={10} color="$gray9">
                                  {match.source === 'history'
                                    ? t('quickHabits.fromHistory', {
                                        name: match.sessionName,
                                        date: match.date,
                                        defaultValue: `From ${match.sessionName}`,
                                      })
                                    : t('quickHabits.savedRule', 'From saved habit')}
                                </Text>
                              </XStack>
                            </YStack>
                          </XStack>
                        </Pressable>
                      );
                    })}
                    <Button
                      unstyled
                      bg={GREEN}
                      h={40}
                      borderRadius={8}
                      ai="center"
                      jc="center"
                      disabled={selectedMatchIds.length === 0}
                      opacity={selectedMatchIds.length === 0 ? 0.5 : 1}
                      onPress={() => applySelected(selectedMatchIds)}
                      pressStyle={{ opacity: 0.9 }}
                    >
                      <Text color="white" fontWeight="700" fontSize={14}>
                        {t('quickHabits.applySelected', {
                          count: selectedMatchIds.length,
                          defaultValue: `Apply (${selectedMatchIds.length})`,
                        })}
                      </Text>
                    </Button>
                  </>
                )}
              </>
            )}
          </YStack>
        </ScrollView>
      </YStack>
    </KeyboardAvoidingView>
  );
}
