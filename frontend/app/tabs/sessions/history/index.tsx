import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl } from 'react-native';
import { YStack, XStack, Text, ScrollView, View } from 'tamagui';
import { useTranslation } from 'react-i18next';

import UserAvatar from '@/shared/ui/UserAvatar';
import { useSessionsHistoryStore } from '@/features/sessions/model/history.store';
import type { SessionHistoryEntry, SessionHistoryParticipantLight } from '@/features/sessions/api/history.api';
import { FadeInView } from '@/shared/ui/FadeInView';
import { SkeletonCard } from '@/shared/ui/Skeleton';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Receipt } from '@tamagui/lucide-icons';
import { appRadii } from '@/shared/ui/app-tokens';
import { useAppTheme } from '@/shared/ui/theme-context';
import { useEntryAnimation } from '@/shared/lib/hooks/useEntryAnimation';
import { formatMoney } from '@/shared/lib/money';

const BULLET = '\u2022';
const HISTORY_LIMIT = 50;
const DEFAULT_CURRENCY = 'UZS';

const DATE_LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  uz: 'uz-UZ',
  ja: 'ja-JP',
};

const formatSessionDate = (value?: string, lang = 'en') => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const locale = DATE_LOCALE_MAP[lang] ?? lang;
  return date.toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

function AvatarGroup({ participants }: { participants: SessionHistoryParticipantLight[] }) {
  const shown = participants.slice(0, 4);
  const extra = Math.max(0, participants.length - shown.length);
  return (
    <XStack ai="center">
      {shown.map((participant, idx) => (
        <View key={participant.uniqueId ?? idx} ml={idx === 0 ? 0 : -8}>
          <UserAvatar
            uri={participant.avatarUrl ?? undefined}
            label={(participant.username || 'U').slice(0, 1).toUpperCase()}
            size={28}
            textSize={12}
            backgroundColor="$gray5"
          />
        </View>
      ))}
      {extra > 0 && (
        <View
          w={28}
          h={28}
          br={14}
          backgroundColor="#CBD5F5"
          borderWidth={2}
          borderColor="white"
          ml={shown.length === 0 ? 0 : -8}
          ai="center"
          jc="center"
        >
          <Text fontSize={10} color="$gray11">+{extra}</Text>
        </View>
      )}
    </XStack>
  );
}

function HistoryCard({
  title,
  summary,
  amountLabel,
  participants,
  onPress,
}: {
  title: string;
  summary: string;
  amountLabel: string;
  participants: SessionHistoryParticipantLight[];
  onPress: () => void;
}) {
  const { colors, appShadow } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ width: 358, opacity: pressed ? 0.9 : 1 })}
    >
      <YStack
        h={110}
        br={appRadii.lg}
        borderWidth={1}
        borderColor={colors.border}
        p="$3.5"
        backgroundColor={colors.card}
        {...appShadow.card}
      >
        <XStack jc="space-between" ai="center">
          <YStack>
            <Text fontSize={16} fontWeight="700" lineHeight={19} color={colors.text}>
              {title}
            </Text>
            <Text mt="$1" fontSize={12} lineHeight={14} color={colors.textMuted}>
              {summary}
            </Text>
          </YStack>
          <Text fontSize={14} lineHeight={22} fontWeight="700" color={colors.primary}>
            {amountLabel}
          </Text>
        </XStack>

        <XStack mt="auto" ai="center">
          <AvatarGroup participants={participants} />
        </XStack>
      </YStack>
    </Pressable>
  );
}

export default function SessionsHistoryScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const sessions = useSessionsHistoryStore(state => state.sessions);
  const loading = useSessionsHistoryStore(state => state.loading);
  const initialized = useSessionsHistoryStore(state => state.initialized);
  const currentLimit = useSessionsHistoryStore(state => state.limit);
  const error = useSessionsHistoryStore(state => state.error);
  const fetchHistory = useSessionsHistoryStore(state => state.fetchHistory);
  const refreshIfStale = useSessionsHistoryStore(state => state.refreshIfStale);

  const [refreshing, setRefreshing] = useState(false);
  const entryAnim = useEntryAnimation();
  const { colors } = useAppTheme();

  // FIX: ранее зависимости включали [initialized, loading, currentLimit, fetchHistory, refreshIfStale].
  // каждый вызов fetchHistory менял loading (false→true→false) и currentLimit,
  // и заново запускало useEffect → refreshIfStale → fetchHistory → до бесконечности
  // теперь зависимость только от "initialized": загрузка происходит один раз при входе на экран,
  // а обновление — только если данные протухли (>15 сек)
  useEffect(() => {
    if (!initialized) {
      fetchHistory(HISTORY_LIMIT).catch(() => {});
    } else {
      refreshIfStale(15_000, HISTORY_LIMIT).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchHistory(HISTORY_LIMIT);
    } finally {
      setRefreshing(false);
    }
  }, [fetchHistory]);

  const history = useMemo<SessionHistoryEntry[]>(() => sessions, [sessions]);

  return (
    <YStack f={1} bg={colors.background} px="$4" pt="$4">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ alignItems: 'center', paddingBottom: 32, gap: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        <YStack w={358} gap="$1" mb="$2">
          <Text fontSize={24} fontWeight="700" color={colors.text}>{t('history.title')}</Text>
          <Text fontSize={12} color={colors.textMuted}>{t('history.subtitle')}</Text>
        </YStack>

        {loading && (
          <YStack gap="$3" w={358}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </YStack>
        )}
        {error && (
          <Text color="$red10" fontSize={14}>
            {error}
          </Text>
        )}
        {!loading && !error && !history.length && (
          <EmptyState
            icon={Receipt}
            title={t('history.empty')}
            subtitle={t('history.emptySubtitle', 'Finished splits will appear here')}
          />
        )}

        {history.map((bill, index) => {
          const participants = bill.participants ?? [];
          const dateForSummary = bill.finalizedAt || bill.createdAt;
          const participantsLabel = t('history.participants', { count: participants.length });
          const summary = `${formatSessionDate(dateForSummary, i18n.language)} ${BULLET} ${participantsLabel}`;
          const totalAmount = bill.grandTotal ?? 0;
          const currency = bill.currency || bill.totals?.currency || bill.payload?.totals?.currency || DEFAULT_CURRENCY;
          const amountLabel = formatMoney(totalAmount, currency);
          return (
            <FadeInView key={bill.sessionId} index={index} enabled={entryAnim}>
              <HistoryCard
                title={bill.sessionName || t('history.fallbackName')}
                summary={summary}
                amountLabel={amountLabel}
                participants={participants}
                onPress={() =>
                  router.push({
                    pathname: '/tabs/sessions/history/[historyId]',
                    params: { historyId: String(bill.sessionId) },
                  })
                }
              />
            </FadeInView>
          );
        })}
      </ScrollView>
    </YStack>
  );
}
