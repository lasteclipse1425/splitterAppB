import React, { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Share, Alert } from 'react-native';
import { YStack, XStack, Text, ScrollView, Button } from 'tamagui';

import UserAvatar from '@/shared/ui/UserAvatar';
import { useSessionsHistoryStore } from '@/features/sessions/model/history.store';
import type {
  SessionHistoryEntry,
  SessionHistoryAllocation,
  SessionHistoryItem,
  SessionHistoryParticipantLight,
  SessionHistoryTotalsByParticipant,
} from '@/features/sessions/api/history.api';
import { CURRENCY_OPTIONS, formatCurrencyAmount } from '@/shared/config/currencies';
import { SessionsHistoryApi } from '@/features/sessions/api/history.api';
import { useAppStore } from '@/shared/lib/stores/app-store';

const DEFAULT_CURRENCY = 'UZS';
const fmtCurrency = (value: number, currency: string) => `${currency} ${formatCurrencyAmount(value, currency)}`;
const BULLET = '\u2022';
const DETAIL_LIMIT = 50;

const formatSessionDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('uz-UZ', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

type ParticipantView = {
  participant: SessionHistoryParticipantLight;
  avatarUrl?: string | null;
  amount: number;
  items: {
    id: string;
    title: string;
    price: number;
  }[];
};

const buildParticipantsView = (bill?: SessionHistoryEntry): ParticipantView[] => {
  if (!bill) return [];

  const totalsByParticipant = new Map<string, SessionHistoryTotalsByParticipant>();
  (bill.totals?.byParticipant ?? []).forEach(item => {
    totalsByParticipant.set(item.uniqueId, item);
  });

  const itemsById = new Map<string, SessionHistoryItem>();
  (bill.totals?.byItem ?? []).forEach(item => {
    itemsById.set(item.itemId, item);
  });

  const allocationsByParticipant = new Map<string, SessionHistoryAllocation[]>();
  (bill.allocations ?? []).forEach(alloc => {
    const collection = allocationsByParticipant.get(alloc.participantId) ?? [];
    collection.push(alloc);
    allocationsByParticipant.set(alloc.participantId, collection);
  });

  return (bill.participants ?? []).map(p => {
    const totals = totalsByParticipant.get(p.uniqueId);
    const allocations = allocationsByParticipant.get(p.uniqueId) ?? [];
    const items = allocations.map((allocation, index) => {
      const itemMeta = itemsById.get(allocation.itemId);
      return {
        id: `${allocation.itemId}-${p.uniqueId}-${index}`,
        title: itemMeta?.name || 'Tovar',
        price: allocation.shareAmount,
      };
    });
    return {
      participant: {
        uniqueId: p.uniqueId,
        username: totals?.username || p.username || 'U',
        avatarUrl: p.avatarUrl ?? null,
      },
      avatarUrl: p.avatarUrl ?? null,
      amount: totals?.amountOwed ?? 0,
      items,
    };
  });
};

export default function HistoryDetailsScreen() {
  const { historyId } = useLocalSearchParams<{ historyId: string }>();
  const router = useRouter();
  const sessions = useSessionsHistoryStore(state => state.sessions);
  const loading = useSessionsHistoryStore(state => state.loading);
  const initialized = useSessionsHistoryStore(state => state.initialized);
  const currentLimit = useSessionsHistoryStore(state => state.limit);
  const error = useSessionsHistoryStore(state => state.error);
  const fetchHistory = useSessionsHistoryStore(state => state.fetchHistory);
  const currentUser = useAppStore(state => state.user);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paidUniqueIds, setPaidUniqueIds] = useState<string[]>([]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/tabs/sessions/history' as never);
  };

  const bill: SessionHistoryEntry | undefined = useMemo(() => {
    if (!historyId) return undefined;
    const id = Number(historyId);
    if (Number.isNaN(id)) return undefined;
    return sessions.find(session => session.sessionId === id);
  }, [historyId, sessions]);

  useEffect(() => {
    if (loading) return;
    const hasBill = Boolean(bill);
    if (!initialized || (!hasBill && (currentLimit ?? 0) < DETAIL_LIMIT)) {
      fetchHistory(DETAIL_LIMIT).catch(() => {});
    }
  }, [initialized, loading, currentLimit, fetchHistory, bill]);

  const participants = useMemo(() => buildParticipantsView(bill), [bill]);
  const currency =
    bill?.currency ||
    bill?.totals?.currency ||
    bill?.payload?.totals?.currency ||
    DEFAULT_CURRENCY;

  useEffect(() => setPaidUniqueIds(bill?.payload?.paidUniqueIds ?? []), [bill]);

  const toggleMyPayment = async () => {
    const uniqueId = currentUser?.uniqueId;
    if (!bill || !uniqueId || paymentBusy) return;
    setPaymentBusy(true);
    try {
      const next = await SessionsHistoryApi.setPaymentStatus(bill.sessionId, !paidUniqueIds.includes(uniqueId));
      setPaidUniqueIds(next);
    } catch {
      Alert.alert('Payment status not saved', 'Check your connection and try again.');
    } finally {
      setPaymentBusy(false);
    }
  };
  const [targetCurrency, setTargetCurrency] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const convertedTotal = Number(exchangeRate) > 0 ? (bill?.grandTotal ?? 0) * Number(exchangeRate) : null;

  const shareBill = async () => {
    if (!bill) return;
    const lines = [
      bill.sessionName || 'Bill',
      `${fmtCurrency(bill.grandTotal ?? 0, currency)} · ${formatSessionDate(bill.finalizedAt || bill.createdAt)}`,
      ...participants.map(({ participant, amount }) => `${participant.username}: ${fmtCurrency(amount, currency)}`),
    ];
    try {
      await Share.share({ message: lines.join('\n') });
    } catch {
      Alert.alert('Could not share bill', 'Please try again.');
    }
  };

  if (!bill && loading) {
    return (
      <YStack f={1} bg="$background" ai="center" jc="center">
        <Text fontSize={16}>Yuklanmoqda...</Text>
      </YStack>
    );
  }

  if (!bill) {
    return (
      <YStack f={1} bg="$background" ai="center" jc="center" gap="$3">
        <Text fontSize={16} fontWeight="600">History not found</Text>
        {error && (
          <Text fontSize={14} color="$red10">
            {error}
          </Text>
        )}
        <Button onPress={goBack}>Go back</Button>
      </YStack>
    );
  }

  return (
    <YStack f={1} bg="$background" px="$4" pt="$4" pb="$4">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ alignItems: 'center', paddingBottom: 32, gap: 16 }}
      >
        <YStack w={358} gap="$3">
          <Text fontSize={24} fontWeight="700">{bill.sessionName || 'Hisob'}</Text>
          <Button unstyled alignSelf="flex-start" onPress={goBack}>
            <Text color="#2ECC71">{'< Ortga'}</Text>
          </Button>
          <Text fontSize={14} color="$gray10">
            {`${formatSessionDate(bill.finalizedAt || bill.createdAt)} ${BULLET} ${(bill.participants ?? []).length} ishtirokchi`}
          </Text>
          <Text fontSize={16} fontWeight="700" color="#2ECC71">
            {fmtCurrency(bill.grandTotal ?? 0, currency)}
          </Text>
          <Button onPress={shareBill} alignSelf="flex-start">Share bill</Button>
          {currentUser?.uniqueId && bill.participantUniqueIds.includes(currentUser.uniqueId) && (
            <Button onPress={toggleMyPayment} disabled={paymentBusy} alignSelf="flex-start">
              {paidUniqueIds.includes(currentUser.uniqueId) ? 'Mark my share unpaid' : 'Mark my share paid'}
            </Button>
          )}
          <YStack gap="$2" p="$3" borderWidth={1} borderColor="$gray5" borderRadius={12}>
            <Text fontSize={14} fontWeight="700">Currency converter</Text>
            <Text fontSize={11} color="$gray10">Enter the exchange rate from {currency} to your selected currency.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <XStack gap="$2">
                {CURRENCY_OPTIONS.filter((option) => option.code !== currency).map((option) => (
                  <Button key={option.code} size="$2" onPress={() => setTargetCurrency(option.code)} theme={targetCurrency === option.code ? 'active' : undefined}>
                    {option.code}
                  </Button>
                ))}
              </XStack>
            </ScrollView>
            {targetCurrency ? (
              <>
                <Input value={exchangeRate} onChangeText={(value) => setExchangeRate(value.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder={`1 ${currency} = ? ${targetCurrency}`} accessibilityLabel="Exchange rate" />
                {convertedTotal != null && (
                  <Text fontSize={14} color="$gray11">Approx. {fmtCurrency(convertedTotal, targetCurrency)}</Text>
                )}
              </>
            ) : null}
            {!targetCurrency && (
              <Text fontSize={12} color="$gray10">Choose a currency to see an approximate conversion.</Text>
            )}
          </YStack>
        </YStack>

        {participants.map(({ participant, avatarUrl, amount, items }) => (
          <YStack
            key={participant.uniqueId}
            w={358}
            borderWidth={1}
            borderColor="#2ECC71"
            br={12}
            bg="white"
            px={16}
            py={12}
            gap="$3"
          >
            <XStack jc="space-between" ai="center">
              <XStack ai="center" gap="$2">
                <UserAvatar
                  uri={avatarUrl ?? undefined}
                  label={(participant.username || 'U').slice(0, 1).toUpperCase()}
                  size={40}
                  textSize={16}
                  backgroundColor="$gray5"
                />
                <Text fontSize={16} fontWeight="600">{participant.username}</Text>
              </XStack>
              <Text fontSize={16} fontWeight="700" color="#2ECC71">
                {fmtCurrency(amount, currency)}
              </Text>
            </XStack>
            <Text fontSize={12} color={paidUniqueIds.includes(participant.uniqueId) ? '$green10' : '$gray9'}>
              {paidUniqueIds.includes(participant.uniqueId) ? 'Paid' : 'Not marked paid'}
            </Text>

            <YStack gap={8}>
              {items.length ? (
                items.map(item => (
                  <XStack key={item.id} jc="space-between" ai="center">
                    <Text fontSize={14}>{item.title}</Text>
                    <Text fontSize={14} fontWeight="600" color="#2ECC71">
                      {item.price.toLocaleString()}
                    </Text>
                  </XStack>
                ))
              ) : (
                <Text fontSize={12} color="$gray9">
                  Hech qanday element biriktirilmagan
                </Text>
              )}
            </YStack>
          </YStack>
        ))}
      </ScrollView>
    </YStack>
  );
}
