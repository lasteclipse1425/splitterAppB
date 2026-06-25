import React, { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import { Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { YStack, XStack, Text, View, Circle, ScrollView } from 'tamagui';
import { ScanLine, Users, UserPlus, Zap, Receipt } from '@tamagui/lucide-icons';
import { useTranslation } from 'react-i18next';

import { ScreenContainer } from '@/shared/ui/ScreenContainer';
import UserAvatar from '@/shared/ui/UserAvatar';
import { FadeInView } from '@/shared/ui/FadeInView';
import { SkeletonCard } from '@/shared/ui/Skeleton';
import { EmptyState } from '@/shared/ui/EmptyState';
import { appRadii } from '@/shared/ui/app-tokens';
import { useAppTheme } from '@/shared/ui/theme-context';
import { useEntryAnimation } from '@/shared/lib/hooks/useEntryAnimation';
import type { SessionHistoryEntry, SessionHistoryParticipantLight } from '@/features/sessions/api/history.api';
import { useSessionsHistoryStore } from '@/features/sessions/model/history.store';
import { openQuickHabitsHomeLibrary } from '@/features/receipt/model/quick-habits-ui.store';
import { useQuickHabitsStore } from '@/features/receipt/model/quick-habits.store';
import { formatMoney } from '@/shared/lib/money';

const HOME_HISTORY_LIMIT = 10;
const DEFAULT_CURRENCY = 'UZS';

const formatSessionDate = (value?: string, locale: string = 'en') => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  };
  try {
    return date.toLocaleString(locale, options);
  } catch {
    return date.toLocaleString(undefined, options);
  }
};

function ActionButton({
  title,
  icon,
  onPress,
}: {
  title: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  const { colors, appShadow } = useAppTheme();
  return (
    <XStack
      onPress={onPress}
      width={171}
      height={52}
      borderRadius={appRadii.lg}
      alignItems="center"
      justifyContent="center"
      gap={8}
      borderWidth={1}
      borderColor={colors.border}
      backgroundColor={colors.card}
      pressStyle={{ opacity: 0.92, scale: 0.99 }}
      hoverStyle={{ backgroundColor: colors.borderSoft }}
      focusStyle={{ borderColor: colors.border }}
      {...appShadow.soft}
    >
      <Circle size={32} bg={colors.primarySoft} ai="center" jc="center">
        {icon}
      </Circle>
      <Text fontSize={14} fontWeight="600" color={colors.text}>
        {title}
      </Text>
    </XStack>
  );
}

function AvatarStack({ participants }: { participants: SessionHistoryParticipantLight[] }) {
  const shown = participants.slice(0, 3);
  const extra = Math.max(0, participants.length - shown.length);

  return (
    <XStack w={92} h={28} ai="center">
      {shown.map((participant, i) => (
        <View key={participant.uniqueId ?? i} ml={i === 0 ? 0 : -8}>
          <UserAvatar
            uri={participant.avatarUrl ?? undefined}
            label={(participant.username || participant.uniqueId || 'U').slice(0, 2).toUpperCase()}
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
          backgroundColor="$gray3"
          borderWidth={2}
          borderColor="white"
          ml={shown.length === 0 ? 0 : -8}
          ai="center"
          jc="center"
        >
          <Text fontSize={10} color="$gray11">
            +{extra}
          </Text>
        </View>
      )}
    </XStack>
  );
}

function BillCard({
  title,
  sub,
  amountLabel,
  participants,
  onPress,
}: {
  title: string;
  sub: string;
  amountLabel: string;
  participants: SessionHistoryParticipantLight[];
  onPress?: () => void;
}) {
  const { colors, appShadow } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        width: 358,
        opacity: onPress && pressed ? 0.96 : 1,
        transform: [{ scale: onPress && pressed ? 0.995 : 1 }],
      })}
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
              {sub}
            </Text>
          </YStack>
          <Text fontSize={14} lineHeight={22} fontWeight="700" color={colors.primary}>
            {amountLabel}
          </Text>
        </XStack>

        <XStack mt="auto" ai="center">
          <AvatarStack participants={participants} />
        </XStack>
      </YStack>
    </Pressable>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const sessions = useSessionsHistoryStore(state => state.sessions);
  const loading = useSessionsHistoryStore(state => state.loading);
  const initialized = useSessionsHistoryStore(state => state.initialized);
  const currentLimit = useSessionsHistoryStore(state => state.limit);
  const error = useSessionsHistoryStore(state => state.error);
  const fetchHistory = useSessionsHistoryStore(state => state.fetchHistory);
  const refreshIfStale = useSessionsHistoryStore(state => state.refreshIfStale);
  const templatesCount = useQuickHabitsStore((s) => s.templates.length);
  const loadHabits = useQuickHabitsStore((s) => s.loadHabits);
  const habitsInitialized = useQuickHabitsStore((s) => s.initialized);

  const [refreshing, setRefreshing] = useState(false);
  const entryAnim = useEntryAnimation();
  const { colors, greenSurface, appShadow } = useAppTheme();
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (!habitsInitialized) {
      loadHabits().catch(() => {});
    }
  }, [habitsInitialized, loadHabits]);

  useEffect(() => {
    if (loading) return;
    if (hasFetchedRef.current) return;
    if (!initialized || (currentLimit ?? 0) < HOME_HISTORY_LIMIT) {
      hasFetchedRef.current = true;
      fetchHistory(HOME_HISTORY_LIMIT).catch(() => {
        hasFetchedRef.current = false;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, loading, currentLimit]);

  useFocusEffect(
    useCallback(() => {
      refreshIfStale(15_000, HOME_HISTORY_LIMIT).catch(() => {});
    }, [refreshIfStale])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchHistory(HOME_HISTORY_LIMIT),
        loadHabits(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchHistory, loadHabits]);

  const openFriends = () => router.push('/tabs/friends');
  const openGroups = () => router.push('/tabs/groups');
  const onScan = () => router.push('/tabs/scan-receipt');
  const onQuickSplit = () => openQuickHabitsHomeLibrary();
  const openAllSessions = () => router.push('/tabs/sessions/history');

  const recent = useMemo<SessionHistoryEntry[]>(() => sessions.slice(0, 3), [sessions]);

  return (
    <ScreenContainer>
      <ScrollView
        f={1}
        bg={colors.background}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ alignItems: 'center', paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <FadeInView delay={0} enabled={entryAnim}>
          <YStack ai="center" mt="$2" mb="$4">
            <Pressable onPress={onScan}>
              <YStack
                w={76}
                h={76}
                br={38}
                bg={colors.primaryMuted}
                ai="center"
                jc="center"
              >
                <Circle size={58} bg={colors.primary} ai="center" jc="center" elevationAndroid={3}>
                  <ScanLine size={26} color="white" />
                </Circle>
              </YStack>
            </Pressable>
            <Text mt="$2.5" color={colors.textMuted} fontSize={13}>
              {t('home.scan.cta', 'Scan invite')}
            </Text>
          </YStack>
        </FadeInView>

        <FadeInView delay={40} enabled={entryAnim}>
          <XStack w={358} jc="space-between" mb="$3">
          <ActionButton
            title={t('home.actions.friends', 'Friends')}
            icon={<Users size={18} />}
            onPress={openFriends}
          />
          <ActionButton
            title={t('home.actions.groups', 'Groups')}
            icon={<UserPlus size={18} />}
            onPress={openGroups}
          />
          </XStack>
        </FadeInView>

        <FadeInView delay={80} enabled={entryAnim}>
          <Pressable onPress={onQuickSplit} style={{ width: 358, marginBottom: 20 }}>
            {({ pressed }) => (
              <XStack
                w="100%"
                h={58}
                borderRadius={appRadii.lg}
                ai="center"
                px="$3.5"
                gap="$3"
                {...greenSurface}
                bg={pressed ? colors.primaryMuted : colors.primarySoft}
                {...appShadow.soft}
              >
                <Circle size={38} bg={colors.primary} ai="center" jc="center">
                  <Zap size={18} color="white" />
                </Circle>
                <YStack f={1}>
                  <Text fontSize={15} fontWeight="700" color={colors.text}>
                    {t('home.quickHabits.title', 'Quick split from habits')}
                  </Text>
                  <Text fontSize={12} color={colors.textMuted}>
                  {templatesCount > 0
                    ? t('home.quickHabits.subtitle', {
                        count: templatesCount,
                        defaultValue: `${templatesCount} saved habits ready`,
                      })
                    : t('home.quickHabits.empty', 'Save a split as a habit after scanning')}
                </Text>
              </YStack>
            </XStack>
          )}
        </Pressable>
        </FadeInView>

        <FadeInView delay={120} enabled={entryAnim}>
          <XStack w={358} jc="space-between" ai="center" mb="$3">
            <Text fontSize={18} fontWeight="700" color={colors.text}>
              {t('home.recent.title', 'Recent bills')}
            </Text>

            <Pressable onPress={openAllSessions}>
              <Text color={colors.primary} fontWeight="600">
                {t('home.recent.showMore', 'Show more')}
              </Text>
            </Pressable>
          </XStack>
        </FadeInView>

        <YStack gap="$3" pb="$6">
          {loading && (
            <YStack gap="$3" w={358}>
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
          {!loading && !error && !recent.length && (
            <EmptyState
              icon={Receipt}
              title={t('home.recent.empty', 'No bills yet')}
              subtitle={t('home.recent.emptySubtitle', 'Scan a receipt to split your first bill')}
            />
          )}
          {recent.map((bill, index) => {
            const participants = bill.participants ?? [];
            const participantsLabel = t('home.recent.participants', {
              count: participants.length,
              defaultValue: `${participants.length} participants`,
            });
            const dateForSummary = bill.finalizedAt || bill.createdAt;
            const summary = `${formatSessionDate(dateForSummary, i18n.language)} • ${participantsLabel}`;
            const totalAmount = bill.grandTotal ?? 0;
            const currency = bill.currency || bill.payload?.totals?.currency || DEFAULT_CURRENCY;
            const amountLabel = formatMoney(totalAmount, currency);

            return (
              <FadeInView key={bill.sessionId} index={index} delay={140} enabled={entryAnim}>
                <BillCard
                  title={bill.sessionName || t('home.recent.fallbackName', 'Bill')}
                  sub={summary}
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
        </YStack>
      </ScrollView>
    </ScreenContainer>
  );
}
