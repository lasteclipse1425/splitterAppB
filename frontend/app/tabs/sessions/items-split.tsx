import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable } from 'react-native';
import { YStack, XStack, Text, Button, Circle, ScrollView, Spinner, Input } from 'tamagui';
import { Users as UsersIcon, Check, Plus, Minus, Package as PackageIcon } from '@tamagui/lucide-icons';

import { useAppStore } from '@/shared/lib/stores/app-store';
import { useReceiptSessionStore } from '@/features/receipt/model/receipt-session.store';
import type { FinishPayload, ReceiptSplitItem } from '@/features/receipt/model/receipt-session.store';
import { ReceiptApi } from '@/features/receipt/api/receipt.api';
import type { FinalizeReceiptItemPayload, FinalizeTotalsByItem, FinalizeTotalsByParticipant, ReceiptAllocation } from '@/features/receipt/api/receipt.api';
import { useSessionsHistoryStore } from '@/features/sessions/model/history.store';
import { useQuickHabitsStore } from '@/features/receipt/model/quick-habits.store';
import { CURRENCY_OPTIONS, formatCurrencyAmount, roundCurrencyAmount } from '@/shared/config/currencies';
import { useCurrencyConverter } from '@/shared/lib/currency-converter';

// ===== Types =====
type Participant = { uniqueId: string; username: string };
type SplitMode = 'equal' | 'count' | undefined;
type Item = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  assignedTo: string[];
  perPersonCount?: Record<string, number>;
  splitMode?: SplitMode;
  kind?: string;
  totalPrice?: number;
  confidence?: number;
};

// ===== Mock Data =====
const MOCK_ITEMS: Item[] = [
  {
    id: '1',
    name: 'Pizza Margherita',
    price: 89000,
    quantity: 2,
    assignedTo: [],
    perPersonCount: {},
    splitMode: 'count',
    totalPrice: 178000,
    confidence: 0.95
  },
  {
    id: '2',
    name: 'Caesar Salad',
    price: 45000,
    quantity: 1,
    assignedTo: [],
    perPersonCount: {},
    splitMode: 'equal',
    totalPrice: 45000,
    confidence: 0.8
  },
  {
    id: '3',
    name: 'Cola',
    price: 10000,
    quantity: 5,
    assignedTo: [],
    perPersonCount: {},
    splitMode: 'count',
    totalPrice: 50000
  },
  {
    id: '4',
    name: 'Tiramisu',
    price: 32000,
    quantity: 1,
    assignedTo: [],
    perPersonCount: {},
    splitMode: 'equal',
    totalPrice: 32000
  },
  {
    id: '5',
    name: 'Soup of the day',
    price: 28000,
    quantity: 1,
    assignedTo: [],
    perPersonCount: {},
    splitMode: 'equal',
    totalPrice: 28000
  },
];

const cloneItems = (source: Item[]): Item[] =>
  source.map((item) => ({
    ...item,
    assignedTo: [...item.assignedTo],
    perPersonCount: item.perPersonCount ? { ...item.perPersonCount } : {},
  }));

const ensureMode = (item: Item): Exclude<SplitMode, undefined> =>
  item.splitMode === 'count' ? 'count' : 'equal';

const toLocalItems = (source: ReceiptSplitItem[]): Item[] =>
  source.map((item) => ({
    id: item.id,
    name: item.name,
    price: item.unitPrice,
    quantity: item.quantity,
    assignedTo: [...item.assignedTo],
    perPersonCount: item.perPersonCount ? { ...item.perPersonCount } : {},
    splitMode: item.splitMode ?? (item.quantity > 1 ? 'count' : 'equal'),
    kind: item.kind,
    totalPrice: item.totalPrice,
    confidence: item.confidence,
  }));

const toStoreItems = (source: Item[]): ReceiptSplitItem[] =>
  source.map((item) => {
    const mode = ensureMode(item);
    const perPersonEntries = Object.entries(item.perPersonCount ?? {}).filter(
      ([, value]) => typeof value === 'number' && value > 0
    );
    const perPersonCount = perPersonEntries.reduce<Record<string, number>>((acc, [uid, count]) => {
      acc[uid] = count;
      return acc;
    }, {});

    // Ensure assignedTo is not empty for equal mode
    const assignedTo = mode === 'equal' ? [...(item.assignedTo || [])] : [];

    return {
      id: item.id,
      name: item.name,
      unitPrice: item.price,
      quantity: item.quantity,
      totalPrice: typeof item.totalPrice === 'number' ? item.totalPrice : item.price * item.quantity,
      kind: item.kind,
      splitMode: mode,
      assignedTo,
      perPersonCount: mode === 'count' ? perPersonCount : {},
      confidence: item.confidence,
    };
  });

const computeItemTotal = (item: Item) =>
  typeof item.totalPrice === 'number' ? item.totalPrice : item.price * item.quantity;

const buildLocalFinalization = (items: Item[], participants: Participant[]) => {
  const totalsByItem: FinalizeTotalsByItem[] = [];
  const allocations: ReceiptAllocation[] = [];

  const participantTotals = participants.reduce<Record<string, number>>((acc, participant) => {
    acc[participant.uniqueId] = 0;
    return acc;
  }, {});

  for (const item of items) {
    const total = computeItemTotal(item);
    totalsByItem.push({ itemId: item.id, name: item.name, total });

    const mode = ensureMode(item);

    if (mode === 'count') {
      const perPersonCount = item.perPersonCount ?? {};
      for (const [uid, rawCount] of Object.entries(perPersonCount)) {
        const count = Number(rawCount);
        if (!uid || Number.isNaN(count) || count <= 0) continue;

        const shareAmount = count * item.price;
        if (!(uid in participantTotals)) {
          participantTotals[uid] = 0;
        }
        participantTotals[uid] = (participantTotals[uid] ?? 0) + shareAmount;

        allocations.push({
          itemId: item.id,
          participantId: uid,
          shareAmount,
          shareUnits: count,
        });
      }

      continue;
    }

    const assigned = (item.assignedTo ?? []).filter(Boolean);
    const shareCount = assigned.length;
      if (shareCount === 0) {
      console.warn(`Item ${item.id} (${item.name}) has equal split mode but no assigned participants`);
    continue;
    } 

    const shareAmount = total / shareCount;
    const shareRatio = 1 / shareCount;

    assigned.forEach((uid) => {
      if (!(uid in participantTotals)) {
        participantTotals[uid] = 0;
      }
      participantTotals[uid] = (participantTotals[uid] ?? 0) + shareAmount;

      allocations.push({
        itemId: item.id,
        participantId: uid,
        shareAmount,
        shareRatio,
      });
    });
  }

  const totalsByParticipant: FinalizeTotalsByParticipant[] = participants.map((participant) => ({
    uniqueId: participant.uniqueId,
    username: participant.username,
    amountOwed: participantTotals[participant.uniqueId] ?? 0,
  }));

  const grandTotal = totalsByItem.reduce((acc, entry) => acc + entry.total, 0);

  return {
    totalsMap: participantTotals,
    totalsByParticipant,
    totalsByItem,
    allocations,
    grandTotal,
  };
};
// ===== Helpers =====
const parseParticipantsParam = (raw?: string): Participant[] => {
  if (!raw) return [];
  try {
    const decoded = decodeURIComponent(raw);
    return JSON.parse(decoded);
  } catch {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
};

const formatDateSimple = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
  });
};

export default function ItemsSplitScreen() {
  const { participants: participantsParam, receiptId } = useLocalSearchParams<{
    participants?: string;
    receiptId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const me = useAppStore((s) => s.user);
  const session = useReceiptSessionStore((s) => s.session);
  const storeItems = useReceiptSessionStore((s) => s.items);
  const storeParticipants = useReceiptSessionStore((s) => s.participants);
  const setStoreItems = useReceiptSessionStore((s) => s.setItems);
  const setLastFinishPayload = useReceiptSessionStore((s) => s.setLastFinishPayload);
  const setStoreCurrency = useReceiptSessionStore((s) => s.setCurrency);
  const sourceCurrency = useReceiptSessionStore((s) => s.sourceCurrency);
  const currencyConverter = useCurrencyConverter();

  const fetchHistory = useSessionsHistoryStore((s) => s.fetchHistory);
  const historyInitialized = useSessionsHistoryStore((s) => s.initialized);
  const historySessions = useSessionsHistoryStore((s) => s.sessions);

  useEffect(() => {
    if (!historyInitialized) {
      fetchHistory(50).catch(() => {});
    }
  }, [historyInitialized, fetchHistory]);

  const loadCustomHabits = useQuickHabitsStore((s) => s.loadHabits);
  const customHabits = useQuickHabitsStore((s) => s.habits);
  const habitsInitialized = useQuickHabitsStore((s) => s.initialized);
  const addCustomHabit = useQuickHabitsStore((s) => s.addHabit);

  useEffect(() => {
    if (!habitsInitialized) {
      loadCustomHabits().catch(() => {});
    }
  }, [habitsInitialized, loadCustomHabits]);

  const storeCurrency = useReceiptSessionStore((s) => s.currency);
  const [currencyNotice, setCurrencyNotice] = useState<string | null>(null);

  const convertAmount = useCallback((amount: number) => (
    currencyConverter.convert(amount, sourceCurrency || storeCurrency, storeCurrency)
  ), [currencyConverter.convert, sourceCurrency, storeCurrency]);

  const fmtCurrency = useCallback((n: number) => {
    const currency = storeCurrency || 'UZS';
    return `${currency} ${formatCurrencyAmount(convertAmount(n), currency)}`;
  }, [convertAmount, storeCurrency]);

  const getCurrencyParts = useCallback((n: number) => {
    const currency = storeCurrency || 'UZS';
    return { currency, amount: formatCurrencyAmount(convertAmount(n), currency) };
  }, [convertAmount, storeCurrency]);

  const selectCurrency = useCallback(async (currency: string) => {
    const source = sourceCurrency || storeCurrency;
    setCurrencyNotice(null);
    if (!currencyConverter.getRate(source, currency)) {
      await currencyConverter.refresh();
      if (!currencyConverter.getRate(source, currency)) {
        setCurrencyNotice(`No live or configured exchange rate is available for ${source} to ${currency}. The bill currency was not changed.`);
        return;
      }
    }
    setStoreCurrency(currency);
  }, [currencyConverter.getRate, currencyConverter.refresh, sourceCurrency, storeCurrency, setStoreCurrency]);

  const displayedRate = currencyConverter.getRate(sourceCurrency || storeCurrency, storeCurrency);

  const [items, setLocalItems] = useState<Item[]>([]);
  const [taxPercent, setTaxPercent] = useState('');
  const [tipPercent, setTipPercent] = useState('');

  type Editing = {
    id: string;
    splitMode: SplitMode;
    assignedTo: string[];
    perPersonCount: Record<string, number>;
  } | null;
  
  const [editing, setEditing] = useState<Editing>(null);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // --- custom habit modal state ---
  const [showAddHabitModal, setShowAddHabitModal] = useState(false);
  const [habitItemName, setHabitItemName] = useState('');
  const [habitSplitMode, setHabitSplitMode] = useState<'equal' | 'count'>('equal');
  const [habitAssignedTo, setHabitAssignedTo] = useState<string[]>([]);
  const [habitPerPersonCount, setHabitPerPersonCount] = useState<Record<string, number>>({});

  const toggleHabitUser = (uid: string) => {
    setHabitAssignedTo((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const incHabitUser = (uid: string) => {
    setHabitPerPersonCount((prev) => ({
      ...prev,
      [uid]: (prev[uid] || 0) + 1,
    }));
  };

  const decHabitUser = (uid: string) => {
    setHabitPerPersonCount((prev) => {
      const next = { ...prev };
      const val = (next[uid] || 0) - 1;
      if (val <= 0) delete next[uid];
      else next[uid] = val;
      return next;
    });
  };

  const saveCustomHabitAction = async () => {
    if (!habitItemName.trim()) return;

    await addCustomHabit({
      itemName: habitItemName.trim(),
      splitMode: habitSplitMode,
      assignedTo: habitSplitMode === 'equal' ? habitAssignedTo : [],
      perPersonCount: habitSplitMode === 'count' ? habitPerPersonCount : {},
    });

    // Clear and close form settings (but keep modal open so they can see it added to the list)
    setHabitItemName('');
    setHabitSplitMode('equal');
    setHabitAssignedTo([]);
    setHabitPerPersonCount({});
  };

  const participantsFromParams = useMemo(
    () => parseParticipantsParam(participantsParam),
    [participantsParam]
  );

  const participants = useMemo<Participant[]>(() => {
    const source =
      (storeParticipants?.length ?? 0) > 0 ? storeParticipants : participantsFromParams;
    const base =
      source.length > 0
        ? source
        : me?.uniqueId
        ? [{ uniqueId: me.uniqueId, username: me.username || me.uniqueId }]
        : [];

    const normalized = base.map((p) => ({
      uniqueId: p.uniqueId,
      username: p.username || p.uniqueId,
    }));

    const meId = me?.uniqueId;
    const sorted = [...normalized].sort((a, b) => {
      if (meId && a.uniqueId === meId) return -1;
      if (meId && b.uniqueId === meId) return 1;
      return (a.username || '').localeCompare(b.username || '');
    });

    return sorted;
  }, [storeParticipants, participantsFromParams, me?.uniqueId, me?.username]);

  const isMockSession = receiptId === 'mock-001';
  const sessionReceiptId = receiptId ?? (session ? String(session.sessionId) : undefined);

  const loadItemsFromSource = useCallback(() => {
    const hasStoreItems = Array.isArray(storeItems) && storeItems.length > 0;
    if (hasStoreItems) {
      setLocalItems(toLocalItems(storeItems));
    } else if (isMockSession) {
      const fallback = cloneItems(MOCK_ITEMS);
      setLocalItems(fallback);
      setStoreItems(toStoreItems(fallback));
    } else {
      setLocalItems([]);
    }
    setEditing(null);
    setSaving(false);
    setShowSuccess(false);
  }, [storeItems, isMockSession, setStoreItems]);

  const resetState = useCallback(() => {
    loadItemsFromSource();
  }, [loadItemsFromSource]);

  useEffect(() => {
    resetState();
  }, [resetState]);

  useFocusEffect(
    useCallback(() => {
      resetState();
    }, [resetState])
  );

  const commitItems = useCallback(
    (updater: (prev: Item[]) => Item[]) => {
      let nextForStore: Item[] | null = null;
      setLocalItems((prev) => {
        const next = updater(prev);
        const changed =
          next.length !== prev.length || next.some((item, index) => item !== prev[index]);
        if (!changed) {
          return prev;
        }
        nextForStore = next;
        return next;
      });
      if (nextForStore) {
        setStoreItems(toStoreItems(nextForStore));
      }
    },
    [setStoreItems]
  );

  const habitMatches = useMemo(() => {
    const matches: Record<
      string,
      {
        splitMode: 'equal' | 'count';
        assignedTo: string[];
        perPersonCount: Record<string, number>;
        source: 'custom' | 'history';
        sessionName?: string;
        date?: string;
      }
    > = {};

    const currentUids = new Set(participants.map((p) => p.uniqueId));

    for (const item of items) {
      // 1. Try matching in custom (manually saved) habits first
      const customMatch = customHabits.find(
        (h) => h.itemName.toLowerCase().trim() === item.name.toLowerCase().trim()
      );

      if (customMatch) {
        if (customMatch.splitMode === 'count') {
          const perPersonCount: Record<string, number> = {};
          for (const [uid, qty] of Object.entries(customMatch.perPersonCount)) {
            if (currentUids.has(uid) && qty > 0) {
              perPersonCount[uid] = qty;
            }
          }
          if (Object.keys(perPersonCount).length > 0) {
            matches[item.id] = {
              splitMode: 'count',
              assignedTo: [],
              perPersonCount,
              source: 'custom',
            };
            continue; // matched, skip history check
          }
        } else {
          const assigned = (customMatch.assignedTo || []).filter((uid) => currentUids.has(uid));
          if (assigned.length > 0) {
            matches[item.id] = {
              splitMode: 'equal',
              assignedTo: assigned,
              perPersonCount: {},
              source: 'custom',
            };
            continue; // matched, skip history check
          }
        }
      }

      // 2. Try matching in past history sessions (fallback)
      if (historySessions && historySessions.length > 0) {
        for (const session of historySessions) {
          const payload = session.payload;
          if (!payload || !payload.totals || !payload.totals.byItem) continue;

          const pastItem = payload.totals.byItem.find(
            (pi) => pi.name.toLowerCase().trim() === item.name.toLowerCase().trim()
          );

          if (pastItem) {
            const itemAllocs = (payload.allocations || []).filter(
              (a) => a.itemId === pastItem.itemId
            );

            if (itemAllocs.length > 0) {
              const pastUids = itemAllocs.map((a) => a.participantId);
              const presentPastUids = pastUids.filter((uid) => currentUids.has(uid));

              if (presentPastUids.length > 0) {
                const isCount = itemAllocs.some(
                  (a) => typeof (a as any).shareUnits === 'number' && (a as any).shareUnits > 0
                );

                if (isCount) {
                  const perPersonCount: Record<string, number> = {};
                  for (const a of itemAllocs) {
                    if (currentUids.has(a.participantId)) {
                      const u = (a as any).shareUnits || 0;
                      if (u > 0) {
                        perPersonCount[a.participantId] = u;
                      }
                    }
                  }

                  if (Object.keys(perPersonCount).length > 0) {
                    matches[item.id] = {
                      splitMode: 'count',
                      assignedTo: [],
                      perPersonCount,
                      source: 'history',
                      sessionName: session.sessionName || 'Bill',
                      date: formatDateSimple(session.finalizedAt || session.createdAt),
                    };
                    break;
                  }
                } else {
                  matches[item.id] = {
                    splitMode: 'equal',
                    assignedTo: presentPastUids,
                    perPersonCount: {},
                    source: 'history',
                    sessionName: session.sessionName || 'Bill',
                    date: formatDateSimple(session.finalizedAt || session.createdAt),
                  };
                  break;
                }
              }
            }
          }
        }
      }
    }
    return matches;
  }, [items, participants, customHabits, historySessions]);

  const applyHabitSplits = () => {
    if (Object.keys(habitMatches).length === 0) return;

    commitItems((prev) =>
      prev.map((item) => {
        const match = habitMatches[item.id];
        if (!match) return item;

        if (match.splitMode === 'count') {
          const perPersonCount: Record<string, number> = {};
          let allocated = 0;
          for (const [uid, qty] of Object.entries(match.perPersonCount)) {
            const toAssign = Math.min(qty, item.quantity - allocated);
            if (toAssign > 0) {
              perPersonCount[uid] = toAssign;
              allocated += toAssign;
            }
          }
          if (allocated === 0) {
            return {
              ...item,
              splitMode: 'equal',
              assignedTo: participants.map((p) => p.uniqueId),
              perPersonCount: {},
            };
          }
          return {
            ...item,
            splitMode: 'count',
            assignedTo: [],
            perPersonCount,
          };
        } else {
          return {
            ...item,
            splitMode: 'equal',
            assignedTo: [...match.assignedTo],
            perPersonCount: {},
          };
        }
      })
    );
  };

  const splitAllEqually = () => {
    commitItems((prev) =>
      prev.map((item) => ({
        ...item,
        splitMode: 'equal',
        assignedTo: participants.map((p) => p.uniqueId),
        perPersonCount: {},
      }))
    );
  };

  // --- derived ---
  const countAssignedUnits = (it: Item) =>
    Object.values(it.perPersonCount || {}).reduce((a, b) => a + (b || 0), 0);

  const isPartiallyAssigned = (it: Item) => {
    if (ensureMode(it) === 'count') {
      return countAssignedUnits(it) > 0;
    }
    return (it.assignedTo?.length ?? 0) > 0;
  };

  const isFullyAssigned = (it: Item) => {
    if (ensureMode(it) === 'count') {
      const units = countAssignedUnits(it);
      const required = Math.max(1, it.quantity || 0);
      return units >= required;
    }
    return (it.assignedTo?.length ?? 0) > 0;
  };

  const assignedCount = useMemo(
    () => items.reduce((acc, it) => acc + (isFullyAssigned(it) ? 1 : 0), 0),
    [items]
  );

  const totalItems = items.length;
  const canContinue = assignedCount === totalItems && totalItems > 0;

  useEffect(() => {
    if (!canContinue && submitError) {
      setSubmitError(null);
    }
  }, [canContinue, submitError]);

  // --- modal helpers ---
  const editingItem = editing ? items.find((it) => it.id === editing.id) : null;
  const editingTotal = editingItem
    ? typeof editingItem.totalPrice === 'number'
      ? editingItem.totalPrice
      : editingItem.price * editingItem.quantity
    : 0;
  const editingPriceParts = getCurrencyParts(editingTotal);
  const effectiveMode =
    editing?.splitMode || (editingItem?.quantity && editingItem.quantity > 1 ? 'count' : 'equal');
  const isEqualMode = effectiveMode === 'equal';
  const isCountMode = effectiveMode === 'count';

  function openAssignModal(it: Item) {
    const initialMode: SplitMode = it.splitMode ?? (it.quantity > 1 ? 'count' : 'equal');
    const assigned = initialMode === 'equal' ? [...(it.assignedTo || [])] : [];
    const perCount = initialMode === 'count' ? { ...(it.perPersonCount || {}) } : {};

    setEditing({
      id: it.id,
      splitMode: initialMode,
      assignedTo: assigned,
      perPersonCount: perCount,
    });
  }

  function closeAssignModal() {
    setEditing(null);
  }

  function modalAll() {
    if (!editing) return;
    setEditing({
      ...editing,
      splitMode: 'equal',
      assignedTo: participants.map((p) => p.uniqueId),
      perPersonCount: {},
    });
  }

  function modalClear() {
    if (!editing) return;
    setEditing({
      ...editing,
      splitMode: effectiveMode,
      assignedTo: [],
      perPersonCount: {},
    });
  }

  function switchToEqual() {
    if (!editing) return;
    const participantsWithUnits = Object.entries(editing.perPersonCount)
      .filter(([, value]) => (value || 0) > 0)
      .map(([uid]) => uid);
    const baseAssigned = editing.assignedTo.length ? editing.assignedTo : participantsWithUnits;

    setEditing({
      ...editing,
      splitMode: 'equal',
      assignedTo: baseAssigned,
      perPersonCount: {},
    });
  }

  function switchToCount() {
    if (!editing || !editingItem) return;

    const existing = Object.entries(editing.perPersonCount).filter(
      ([, value]) => (value || 0) > 0
    );

    if (existing.length === 0 && editing.assignedTo.length > 0) {
      let remaining = editingItem.quantity;
      const counts: Record<string, number> = {};
      editing.assignedTo.forEach((uid) => {
        if (remaining <= 0) return;
        counts[uid] = 1;
        remaining -= 1;
      });

      setEditing({
        ...editing,
        splitMode: 'count',
        assignedTo: [],
        perPersonCount: counts,
      });
      return;
    }

    setEditing({
      ...editing,
      splitMode: 'count',
      assignedTo: [],
      perPersonCount: { ...editing.perPersonCount },
    });
  }

  function modalToggleUser(uid: string) {
    if (!editing || !editingItem) return;

    if (effectiveMode === 'count') {
      const current = editing.perPersonCount[uid] || 0;
      const next = { ...editing.perPersonCount };

      if (current > 0) {
        delete next[uid];
      } else {
        const othersTotal = Object.entries(editing.perPersonCount)
          .filter(([key]) => key !== uid)
          .reduce((sum, [, value]) => sum + (value || 0), 0);

        if (othersTotal >= editingItem.quantity) return;
        next[uid] = 1;
      }

      setEditing({
        ...editing,
        splitMode: 'count',
        assignedTo: [],
        perPersonCount: next,
      });
      return;
    }

    const has = editing.assignedTo.includes(uid);
    const next = has
      ? editing.assignedTo.filter((x) => x !== uid)
      : [...editing.assignedTo, uid];

    setEditing({
      ...editing,
      splitMode: 'equal',
      assignedTo: next,
      perPersonCount: {},
    });
  }

  function modalInc(uid: string) {
    if (!editing || !editingItem) return;
    const next = { ...editing.perPersonCount };
    const sum = Object.values(next).reduce((a, b) => a + (b || 0), 0);
    if (sum >= editingItem.quantity) return;

    next[uid] = (next[uid] || 0) + 1;
    setEditing({
      ...editing,
      splitMode: 'count',
      perPersonCount: next,
      assignedTo: [],
    });
  }

  function modalDec(uid: string) {
    if (!editing) return;
    const next = { ...editing.perPersonCount };
    const v = (next[uid] || 0) - 1;
    if (v <= 0) delete next[uid];
    else next[uid] = v;

    setEditing({
      ...editing,
      splitMode: 'count',
      perPersonCount: next,
      assignedTo: [],
    });
  }

  async function modalSave() {
  if (!editing) return;
  const mode: Exclude<SplitMode, undefined> =
    editing.splitMode ?? ((editingItem?.quantity && editingItem.quantity > 1) ? 'count' : 'equal');

  setSaving(true);
  try {
    commitItems((prev) =>
      prev.map((it) => {
        if (it.id !== editing.id) return it;
        
        // Ensure we preserve the assignments correctly
        const assignedTo = mode === 'equal' ? [...(editing.assignedTo || [])] : [];
        const perPersonCount = mode === 'count' ? { ...(editing.perPersonCount || {}) } : {};
        
        return {
          ...it,
          splitMode: mode,
          assignedTo,
          perPersonCount,
        };
      })
    );
    setEditing(null);
  } finally {
    setSaving(false);
  }
}

  // --- finalize and navigate ---
  const onContinue = useCallback(async () => {
  if (!canContinue || finalizing) return;

  setSubmitError(null);
  setFinalizing(true);

  try {
    setStoreItems(toStoreItems(items));

      const finalizeItems: FinalizeReceiptItemPayload[] = items.map((item) => {
      const mode = ensureMode(item);

      const payload: FinalizeReceiptItemPayload = {
        id: item.id,
        name: item.name,
        price: roundCurrencyAmount(
          convertAmount(item.price * item.quantity),
          storeCurrency,
        ) / item.quantity,
        quantity: item.quantity,
        kind: item.kind,
        splitMode: mode,
        assignedTo: mode === 'equal' ? (item.assignedTo || []) : undefined,
        perPersonCount: mode === 'count' ? (item.perPersonCount || {}) : undefined,
      };

  // Debug log
  console.log('Finalizing item:', {
    id: item.id,
    name: item.name,
    mode,
    assignedTo: payload.assignedTo,
    perPersonCount: payload.perPersonCount,
  });

  return payload;
});

      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const tax = subtotal * Math.max(0, Number(taxPercent) || 0) / 100;
      const tip = subtotal * Math.max(0, Number(tipPercent) || 0) / 100;
      const extras: FinalizeReceiptItemPayload[] = [
        ...(tax > 0 ? [{ id: 'splitter-tax', name: `Tax (${taxPercent}%)`, price: roundCurrencyAmount(convertAmount(tax), storeCurrency), quantity: 1, kind: 'fee', splitMode: 'equal' as const, assignedTo: participants.map((p) => p.uniqueId) }] : []),
        ...(tip > 0 ? [{ id: 'splitter-tip', name: `Tip (${tipPercent}%)`, price: roundCurrencyAmount(convertAmount(tip), storeCurrency), quantity: 1, kind: 'fee', splitMode: 'equal' as const, assignedTo: participants.map((p) => p.uniqueId) }] : []),
      ];

      const effectiveSessionId =
      session?.sessionId ??
      (sessionReceiptId && !isMockSession ? parseInt(sessionReceiptId, 10) : undefined);

    if (!effectiveSessionId) {
      throw new Error('Session ID is required');
    }

      const finalizationItems: Item[] = [...finalizeItems, ...extras].map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        assignedTo: item.assignedTo ?? [],
        perPersonCount: item.perPersonCount ?? {},
        splitMode: item.splitMode,
        kind: item.kind,
      }));
      const fallbackFinalization = buildLocalFinalization(finalizationItems, participants);

      const result = await ReceiptApi.finalize({
      sessionId: effectiveSessionId,
      sessionName: session?.sessionName || 'Split Session',
      participants: participants.map((p) => ({
        uniqueId: p.uniqueId,
        username: p.username,
      })),
      items: [...finalizeItems, ...extras],
      currency: storeCurrency, // ✅ Добавьте эту строку
    });

      const backendByParticipant = result.totals?.byParticipant ?? [];
      const hasBackendByParticipant = backendByParticipant.length > 0;

      const effectiveByParticipant = hasBackendByParticipant
        ? backendByParticipant
        : fallbackFinalization.totalsByParticipant;

      const totalsFromResponse = hasBackendByParticipant
        ? backendByParticipant.reduce<Record<string, number>>((acc, entry) => {
            acc[entry.uniqueId] = entry.amountOwed;
            return acc;
          }, {})
        : { ...fallbackFinalization.totalsMap };

      const backendByItem = result.totals?.byItem ?? [];
      const totalsByItem = backendByItem.length > 0 ? backendByItem : fallbackFinalization.totalsByItem;

      const backendAllocations = result.allocations ?? [];
      const allocations = backendAllocations.length > 0 ? backendAllocations : fallbackFinalization.allocations;

      const grandTotal =
        typeof result.totals?.grandTotal === 'number'
          ? result.totals.grandTotal
          : fallbackFinalization.grandTotal;

      const finalCurrency = result.totals?.currency || storeCurrency;

      const finishPayload: FinishPayload = {
  sessionId: result.sessionId,
  sessionName: result.sessionName,
  receiptId: sessionReceiptId ?? (isMockSession ? 'mock-001' : undefined),
  participants,
  totalsByParticipant: effectiveByParticipant,
  totalsByItem,
  allocations,
  grandTotal,
  currency: finalCurrency,
  status: result.status,
  createdAt: result.createdAt,
};

      setLastFinishPayload(finishPayload);
      setShowSuccess(true);

      setTimeout(() => {
        setShowSuccess(false);
        setFinalizing(false);

        try {
          const q = encodeURIComponent(JSON.stringify(finishPayload));
          router.push({
            pathname: '/tabs/sessions/finish',
            params: { data: q },
          });
        } catch {
          router.push('/tabs');
        }

        resetState();
      }, 1200);
    } catch (error) {
      setShowSuccess(false);
      setFinalizing(false);

      const message = error instanceof Error ? error.message : 'Failed to finalize session';
      setSubmitError(message);
      console.error('Finalize error:', error);
    }
  }, [
    canContinue,
    finalizing,
    items,
    session,
    sessionReceiptId,
    isMockSession,
    participants,
    storeCurrency,
    convertAmount,
    sourceCurrency,
    setStoreItems,
    setLastFinishPayload,
    router,
    resetState,
  ]);

  // --- UI atoms ---
  const Avatar = ({ name }: { name: string }) => (
    <Circle size={28} bg="$gray5" ai="center" jc="center">
      <Text color="white" fontWeight="700">
        {name?.[0]?.toUpperCase() || '?'}
      </Text>
    </Circle>
  );

  const ProgressBar = ({ value }: { value: number }) => (
    <YStack h={8} w="100%" br={999} bg="$gray5" overflow="hidden">
      <YStack h="100%" w={`${Math.max(0, Math.min(100, value))}%`} bg="#177A42" />
    </YStack>
  );

  const ModeToggleButton = ({
    label,
    icon,
    active,
    onPress,
  }: {
    label: string;
    icon: React.ReactNode;
    active: boolean;
    onPress: () => void;
  }) => (
    <Button
      unstyled
      onPress={onPress}
      px={12}
      py={10}
      borderRadius={8}
      bg={active ? '#177A42' : '$backgroundPress'}
      borderWidth={1}
      borderColor={active ? '#2ECC71' : '$gray5'}
    >
      <XStack ai="center" gap="$2">
        {icon}
        <Text fontSize={13} fontWeight="600" color={active ? 'white' : '$gray11'}>
          {label}
        </Text>
      </XStack>
    </Button>
  );

  const gapBottom = (insets?.bottom ?? 0) + 72;

  return (
    <YStack f={1} bg="$background" position="relative">
      {/* Header */}
      <YStack bg="$background" p="$4" pb="$2">
        <XStack w="100%" ai="center" jc="flex-start" mb="$3">
          <YStack ai="flex-start">
            <Text fontSize={16} fontWeight="700">
              Orders
            </Text>
            <Text fontSize={12} color="$gray10">
              {sessionReceiptId ?? (isMockSession ? 'mock-001' : 'N/A')}
            </Text>
          </YStack>
        </XStack>
      </YStack>

      {/* Content */}
      <ScrollView
        f={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: gapBottom }}
      >
        <YStack px="$4" gap="$3">
          {!!session?.warnings?.length && (
            <YStack p="$3" borderWidth={1} borderColor="$orange8" borderRadius={10} bg="$orange2" gap="$1">
              <Text fontWeight="700" color="$orange11">Some receipt lines need review</Text>
              {session.warnings.slice(0, 3).map((warning, index) => (
                <Text key={`${index}-${warning}`} fontSize={12} color="$orange11">{warning}</Text>
              ))}
            </YStack>
          )}
          {/* Participants */}
          <YStack>
            <XStack w="100%" ai="center" jc="flex-start" mb="$2">
              <XStack ai="center" gap="$2">
                <UsersIcon size={18} color="$gray10" />
                <Text fontWeight="700">Participants ({participants.length})</Text>
              </XStack>
            </XStack>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <XStack gap="$2" pr="$4">
                {participants.map((p) => (
                  <XStack
                    key={p.uniqueId}
                    ai="center"
                    gap="$2"
                    px="$2"
                    py="$1"
                    borderWidth={1}
                    borderColor="$gray6"
                    borderRadius={16}
                    minWidth={100}
                  >
                    <Avatar name={p.username} />
                    <Text numberOfLines={1} fontSize={13}>
                      {p.username}
                    </Text>
                  </XStack>
                ))}
              </XStack>
            </ScrollView>
          </YStack>

          {/* Bill currency */}
          <YStack gap="$2" p="$3" borderWidth={1} borderColor="$gray5" borderRadius={12}>
            <Text fontSize={14} fontWeight="700">Tax and tip</Text>
            <Text fontSize={11} color="$gray10">Calculated on item subtotal and split equally between participants.</Text>
            <XStack gap="$2">
              <Input f={1} value={taxPercent} onChangeText={(value) => setTaxPercent(value.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="Tax %" accessibilityLabel="Tax percentage" />
              <Input f={1} value={tipPercent} onChangeText={(value) => setTipPercent(value.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="Tip %" accessibilityLabel="Tip percentage" />
            </XStack>
          </YStack>

          {/* Bill currency */}
          <YStack gap="$2">
            <Text fontSize={13} fontWeight="700">Bill currency</Text>
            <Text fontSize={11} color="$gray10">Prices and totals are converted from the receipt currency without changing the saved receipt amounts.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <XStack gap="$2" pr="$4">
                {CURRENCY_OPTIONS.map((option) => {
                  const active = storeCurrency === option.code;
                  return (
                    <Button
                      key={option.code}
                      unstyled
                      onPress={() => { void selectCurrency(option.code); }}
                      px="$3"
                      py="$2"
                      borderRadius={18}
                      borderWidth={1}
                      borderColor={active ? '#2ECC71' : '$gray6'}
                      bg={active ? '#177A42' : '$color1'}
                    >
                      <Text fontSize={12} fontWeight="700" color={active ? 'white' : '$gray11'}>
                        {option.code} · {option.symbol}
                      </Text>
                    </Button>
                  );
                })}
              </XStack>
            </ScrollView>
            <XStack ai="center" jc="space-between" gap="$2">
              <Text fontSize={11} color="$gray10" f={1}>
                {sourceCurrency === storeCurrency
                  ? `Receipt amounts are in ${sourceCurrency}.`
                  : displayedRate !== null
                    ? `1 ${sourceCurrency} = ${currencyConverter.formatRate(displayedRate)} ${storeCurrency} · ${currencyConverter.source}${currencyConverter.isStale ? ' · stale' : ''}`
                    : `No rate available for ${sourceCurrency} to ${storeCurrency}.`}
              </Text>
              <Button size="$2" chromeless onPress={() => { void currencyConverter.refresh(); }}>
                Refresh
              </Button>
            </XStack>
            {!!currencyNotice && <Text color="$red10" fontSize={12}>{currencyNotice}</Text>}
          </YStack>

          {/* Quick Split Widget */}
          <YStack
            borderWidth={1}
            borderColor={Object.keys(habitMatches).length > 0 ? '#2ECC71' : '$gray6'}
            borderRadius={12}
            bg={Object.keys(habitMatches).length > 0 ? '#2ECC710D' : '$color1'}
            p="$3.5"
            gap="$3.5"
            mt="$1"
          >
            <XStack ai="center" jc="space-between">
              <YStack gap="$1" f={1} pr="$2">
                <Text fontSize={15} fontWeight="700" color="$color">
                  ⚡ {Object.keys(habitMatches).length > 0 ? 'Smart Split by Habits' : 'Quick Actions'}
                </Text>
                <Text fontSize={12} color="$gray10">
                  {Object.keys(habitMatches).length > 0
                    ? `Matched ${Object.keys(habitMatches).length} of ${items.length} items from habits/history!`
                    : 'Split all items or add custom split rule'}
                </Text>
              </YStack>

              {Object.keys(habitMatches).length > 0 && (
                <Button
                  unstyled
                  bg="#177A42"
                  hoverStyle={{ bg: '#27AE60' }}
                  onPress={applyHabitSplits}
                  px={16}
                  py={8}
                  borderRadius={8}
                  ai="center"
                  jc="center"
                  pressStyle={{ opacity: 0.9 }}
                >
                  <Text fontSize={13} fontWeight="700" color="white">
                    Apply Habits
                  </Text>
                </Button>
              )}
            </XStack>

            <XStack gap="$2" flexWrap="wrap" ai="center">
              {Object.keys(habitMatches).length === 0 && (
                <Button
                  unstyled
                  bg="#177A42"
                  hoverStyle={{ bg: '#27AE60' }}
                  onPress={splitAllEqually}
                  px={14}
                  py={8}
                  borderRadius={8}
                  ai="center"
                  jc="center"
                  pressStyle={{ opacity: 0.9 }}
                >
                  <Text fontSize={13} fontWeight="700" color="white">
                    Split All Equally
                  </Text>
                </Button>
              )}

              {Object.keys(habitMatches).length > 0 && (
                <Button
                  unstyled
                  borderWidth={1}
                  borderColor="#2ECC71"
                  bg="transparent"
                  onPress={splitAllEqually}
                  px={12}
                  py={6}
                  borderRadius={8}
                  ai="center"
                  jc="center"
                  pressStyle={{ opacity: 0.9 }}
                >
                  <Text fontSize={12} fontWeight="600" color="#2ECC71">
                    Split All Equally
                  </Text>
                </Button>
              )}

              <Button
                unstyled
                borderWidth={1}
                borderColor="$gray7"
                bg="transparent"
                onPress={() => setShowAddHabitModal(true)}
                px={12}
                py={Object.keys(habitMatches).length > 0 ? 6 : 8}
                borderRadius={8}
                ai="center"
                jc="center"
                pressStyle={{ opacity: 0.9 }}
              >
                <Text fontSize={Object.keys(habitMatches).length > 0 ? 12 : 13} fontWeight="600" color="$gray11">
                  ➕ Add Habit Rule
                </Text>
              </Button>

              {Object.keys(habitMatches).length > 0 && (
                <Text fontSize={11} color="$gray10" f={1} mt="$1">
                  💡 Matched items will split based on past choices.
                </Text>
              )}
            </XStack>
          </YStack>

          {/* Items */}
          <YStack gap="$3" mt="$2">
            {items.map((it) => {
              const total =
                typeof it.totalPrice === 'number' ? it.totalPrice : it.price * it.quantity;
              const assigned = isPartiallyAssigned(it);
              const singleOwner = it.splitMode !== 'count' && it.assignedTo.length === 1;
              const ownerName = singleOwner
                ? participants.find((p) => p.uniqueId === it.assignedTo[0])?.username
                : undefined;
              const priceParts = getCurrencyParts(total);
              const assignedUnits =
                it.splitMode === 'count'
                  ? countAssignedUnits(it)
                  : 0;
              const missingUnits =
                it.splitMode === 'count'
                  ? Math.max(0, (it.quantity || 0) - assignedUnits)
                  : 0;
              const isCountAndMissing = it.splitMode === 'count' && missingUnits > 0;
              
              const confidence = it.confidence ?? 1.0;
              let confidenceColor = '#2ECC71'; // Green
              if (confidence < 0.7) confidenceColor = '#E74C3C'; // Red
              else if (confidence < 0.9) confidenceColor = '#F1C40F'; // Yellow

              let summaryText = '';
              if (it.splitMode === 'count') {
                summaryText = `${assignedUnits}/${it.quantity} assigned`;
              } else if (singleOwner) {
                summaryText = ownerName ?? '';
              } else if (it.quantity > 1) {
                summaryText = `1x ${fmtCurrency(it.price)}`;
              }

              const showUnitIcon = it.quantity > 1 && summaryText !== '';

              return (
                <YStack
                  key={it.id}
                  w="100%"
                  borderWidth={1}
                  borderColor={
                    isCountAndMissing ? '#E74C3C' : assigned ? '#2ECC71' : '$gray5'
                  }
                  borderRadius={12}
                  bg="$color1"
                >
                  <XStack w="100%" ai="center" jc="space-between" px={16} py="$3" gap="$3">
                    <YStack f={1} pr={12} gap="$1">
                      <XStack ai="center" gap="$2">
                        <Circle size={8} bg={confidenceColor} />
                        <Text fontSize={16} fontWeight="700" numberOfLines={1}>
                          {it.name}
                          {it.quantity > 1 ? ` (${it.quantity}x)` : ''}
                        </Text>
                      </XStack>
                      {confidence < 0.7 && (
                        <Text fontSize={12} color="$orange10">
                          Check the recognized name and amount.
                        </Text>
                      )}
                      {summaryText && (
                        <XStack ai="center" gap="$1">
                          {showUnitIcon && <PackageIcon size={14} color="$gray10" />}
                          <Text fontSize={12} color="$gray10" numberOfLines={1}>
                            {summaryText}
                          </Text>
                        </XStack>
                      )}
                      {isCountAndMissing && (
                        <Text fontSize={12} color="#E74C3C">
                          Assign remaining {missingUnits} unit{missingUnits === 1 ? '' : 's'}
                        </Text>
                      )}
                    </YStack>

                    <YStack ai="flex-end" gap="$2" flexShrink={0}>
                      <XStack ai="baseline" gap="$1">
                        <Text fontSize={12} color="$gray10">
                          {priceParts.currency}
                        </Text>
                        <Text fontSize={16} fontWeight="700" color="#2ECC71">
                          {priceParts.amount}
                        </Text>
                      </XStack>

                      <Button
                        unstyled
                        onPress={() => openAssignModal(it)}
                        width={assigned ? 109 : undefined}
                        minHeight={assigned ? 29 : 32}
                        px={assigned ? 16 : 12}
                        py={assigned ? 6 : undefined}
                        borderRadius={assigned ? 5 : 6}
                        bg={assigned ? '#2ECC711A' : '$backgroundPress'}
                        borderWidth={assigned ? 0 : 1}
                        borderColor={assigned ? 'transparent' : '$gray5'}
                        ai="center"
                        jc="center"
                      >
                        <Text
                          fontSize={14}
                          fontWeight="600"
                          color={assigned ? '#2ECC71' : '$gray11'}
                        >
                          {assigned ? 'Change' : 'Who?'}
                        </Text>
                      </Button>
                    </YStack>
                  </XStack>
                </YStack>
              );
            })}
          </YStack>
        </YStack>
      </ScrollView>

      {/* Bottom progress -> button */}
      <YStack
        position="absolute"
        left={0}
        right={0}
        bottom={(insets?.bottom ?? 0) + 8}
        px="$4"
      >
        {!canContinue ? (
          <YStack p="$3" borderWidth={1} borderColor="$gray5" borderRadius={12} bg="$color1">
            <XStack w="100%" ai="center" jc="space-between" mb="$2">
              <Text color="$gray10" fontSize={13}>
                Assignment progress
              </Text>
              <Text fontSize={13} fontWeight="700">
                {assignedCount}/{totalItems}
              </Text>
            </XStack>
            <ProgressBar
              value={Math.round((assignedCount / Math.max(1, totalItems)) * 100)}
            />
          </YStack>
        ) : (
          <YStack>
            <Button
              unstyled
              onPress={onContinue}
              height={41}
              borderRadius={10}
              bg="#177A42"
              ai="center"
              jc="center"
              pressStyle={finalizing ? undefined : { opacity: 0.9 }}
              disabled={finalizing}
              opacity={finalizing ? 0.6 : 1}
            >
              <Text fontSize={16} fontWeight="600" color="white">
                {finalizing ? 'Saving...' : 'Continue'}
              </Text>
            </Button>
            {submitError && (
              <Text mt="$2" color="$red10" fontSize={13} textAlign="center">
                {submitError}
              </Text>
            )}
          </YStack>
        )}
      </YStack>

      {/* Assign Modal */}
      {editing && (
        <YStack
          position="absolute"
          inset={0}
          bg="rgba(0,0,0,0.35)"
          ai="center"
          pt={insets.top + 12}
        >
          <YStack
            w={358}
            maxWidth={358}
            h={(editingItem?.quantity || 1) > 1 ? 666 : 588}
            bg="$color1"
            borderRadius={8}
            p="$3"
          >
            {/* Header product + price */}
            <XStack w="100%" ai="center" jc="space-between" mb="$3">
              <Text fontSize={16} fontWeight="700" numberOfLines={1}>
                {editingItem?.name}
                {editingItem && editingItem.quantity > 1 ? ` (${editingItem.quantity}x)` : ''}
              </Text>
              <XStack ai="baseline" gap="$1">
                <Text fontSize={12} color="$gray10">
                  {editingPriceParts.currency}
                </Text>
                <Text fontSize={16} fontWeight="700" color="#2ECC71">
                  {editingPriceParts.amount}
                </Text>
              </XStack>
            </XStack>

            {editingItem && editingItem.quantity > 1 && (
              <XStack gap="$2" mb="$2">
                <ModeToggleButton
                  label="Equal split"
                  icon={<UsersIcon size={16} color={isEqualMode ? 'white' : '$color'} />}
                  active={isEqualMode}
                  onPress={switchToEqual}
                />
                <ModeToggleButton
                  label="By units"
                  icon={<PackageIcon size={16} color={isCountMode ? 'white' : '$color'} />}
                  active={isCountMode}
                  onPress={switchToCount}
                />
              </XStack>
            )}

            <XStack w="100%" ai="center" jc="space-between" mb="$2">
              <Text fontWeight="600">Assign to:</Text>
              <XStack ai="center" gap="$2">
                <Button chromeless onPress={modalAll}>
                  <Text color="#2ECC71" fontWeight="700">
                    All
                  </Text>
                </Button>
                <Text color="$gray8">|</Text>
                <Button chromeless onPress={modalClear}>
                  <Text color="#E74C3C" fontWeight="700">
                    Clear
                  </Text>
                </Button>
              </XStack>
            </XStack>

            <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator>
              <YStack gap="$2" pb="$2">
                {participants.map((p) => {
                  const mode = effectiveMode;
                  const isCountRow = mode === 'count';
                  const assignedQty = editing.perPersonCount?.[p.uniqueId] || 0;
                  const isSelected = isCountRow
                    ? assignedQty > 0
                    : editing.assignedTo.includes(p.uniqueId);

                  return (
                    <Pressable
                      key={`m-${editing.id}-${p.uniqueId}`}
                      onPress={() => modalToggleUser(p.uniqueId)}
                      style={({ pressed }) => ({
                        width: '100%',
                        opacity: pressed ? 0.95 : 1,
                      })}
                    >
                      <XStack
                        h={60}
                        ai="center"
                        jc="space-between"
                        px={16}
                        borderWidth={1}
                        borderColor={isSelected ? '#2ECC71' : '$gray5'}
                        borderRadius={12}
                        bg="$color1"
                      >
                        <XStack ai="center" gap="$3">
                          <Avatar name={p.username} />
                          <Text fontWeight="600">{p.username}</Text>
                        </XStack>

                        <XStack ai="center" gap="$3">
                          {isCountRow && (
                            <XStack ai="center" gap="$2">
                              <Button
                                unstyled
                                onPress={(e: any) => {
                                  e?.stopPropagation?.();
                                  modalDec(p.uniqueId);
                                }}
                                width={28}
                                height={28}
                                br={999}
                                bg="$gray5"
                                ai="center"
                                jc="center"
                              >
                                <Minus size={16} color="$color" />
                              </Button>
                              <Text minWidth={12} textAlign="center">
                                {assignedQty}
                              </Text>
                              <Button
                                unstyled
                                onPress={(e: any) => {
                                  e?.stopPropagation?.();
                                  modalInc(p.uniqueId);
                                }}
                                width={28}
                                height={28}
                                br={999}
                                bg="$gray5"
                                ai="center"
                                jc="center"
                              >
                                <Plus size={16} color="$color" />
                              </Button>
                            </XStack>
                          )}

                          <Circle
                            size={22}
                            borderColor="#2ECC71"
                            borderWidth={2}
                            ai="center"
                            jc="center"
                            bg={isSelected ? '#177A42' : 'transparent'}
                          >
                            {isSelected && <Check size={14} color="white" />}
                          </Circle>
                        </XStack>
                      </XStack>
                    </Pressable>
                  );
                })}
              </YStack>
            </ScrollView>

            {effectiveMode === 'equal' && editing.assignedTo.length > 0 && (
              <YStack mt="$2" p={8} borderRadius={5} bg="#2ECC711A">
                <Text fontSize={13} fontWeight="700" color="#2ECC71">
                  Assigned to {editing.assignedTo.length} participant(s)
                </Text>
                <Text fontSize={12} color="#2ECC71">
                  Price split equally:{' '}
                  {fmtCurrency(editingTotal / Math.max(1, editing.assignedTo.length))} each
                </Text>
              </YStack>
            )}

            {effectiveMode === 'count' &&
              Object.values(editing.perPersonCount).reduce((a, b) => a + (b || 0), 0) > 0 && (
                <YStack mt="$2" p={8} borderRadius={5} bg="#2ECC711A">
                  <Text fontSize={13} fontWeight="700" color="#2ECC71">
                    {Object.values(editing.perPersonCount).reduce((a, b) => a + (b || 0), 0)}{' '}
                    unit(s) assigned
                  </Text>
                  <Text fontSize={12} color="#2ECC71">
                    Per unit: {fmtCurrency(editingItem?.price || 0)}
                  </Text>
                </YStack>
              )}

            <XStack mt="auto" gap="$2">
              <Button
                unstyled
                onPress={closeAssignModal}
                width={155}
                height={41}
                borderRadius={10}
                borderWidth={1}
                borderColor="$gray5"
                ai="center"
                jc="center"
              >
                <Text>Cancel</Text>
              </Button>
              <Button
                unstyled
                onPress={modalSave}
                width={155}
                height={41}
                borderRadius={10}
                bg="#177A42"
                ai="center"
                jc="center"
                disabled={saving}
                pressStyle={{ opacity: 0.9 }}
              >
                <Text color="white" fontWeight="600">
                  Save
                </Text>
              </Button>
            </XStack>
          </YStack>
        </YStack>
      )}

      {/* Manage Habits Modal */}
      {showAddHabitModal && (
        <YStack
          position="absolute"
          inset={0}
          bg="rgba(0,0,0,0.45)"
          ai="center"
          pt={insets.top + 24}
          zIndex={100}
        >
          <YStack
            w={358}
            maxWidth={358}
            h={620}
            bg="$color1"
            borderRadius={12}
            p="$3.5"
            gap="$3.5"
            borderWidth={1}
            borderColor="$gray5"
            elevation={10}
          >
            {/* Header */}
            <XStack w="100%" ai="center" jc="space-between">
              <Text fontSize={17} fontWeight="700" color="$color">
                ⚙️ Quick Split Habits
              </Text>
              <Button
                unstyled
                onPress={() => setShowAddHabitModal(false)}
                p="$1.5"
                ai="center"
                jc="center"
              >
                <Text fontSize={18} fontWeight="700" color="$gray10">✕</Text>
              </Button>
            </XStack>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 1 }}>
              <YStack gap="$4" pb="$4">
                {/* Form Section */}
                <YStack gap="$2.5" p="$3" borderWidth={1} borderColor="$gray5" borderRadius={8} bg="$backgroundPress">
                  <Text fontSize={13} fontWeight="700" color="$color">
                    Create new split rule
                  </Text>
                  
                  <Input
                    placeholder="Dish Name (e.g. Pizza Margherita)..."
                    value={habitItemName}
                    onChangeText={setHabitItemName}
                    h={38}
                    px={12}
                    bg="$color1"
                    borderWidth={1}
                    borderColor="$gray6"
                    borderRadius={8}
                    fontSize={13}
                  />

                  {/* Mode select */}
                  <XStack gap="$2" mt="$1">
                    <Button
                      unstyled
                      px={10}
                      py={6}
                      borderRadius={6}
                      bg={habitSplitMode === 'equal' ? '#177A42' : '$color1'}
                      borderWidth={1}
                      borderColor={habitSplitMode === 'equal' ? '#2ECC71' : '$gray5'}
                      onPress={() => setHabitSplitMode('equal')}
                    >
                      <Text fontSize={12} fontWeight="600" color={habitSplitMode === 'equal' ? 'white' : '$gray11'}>
                        Equal split
                      </Text>
                    </Button>
                    <Button
                      unstyled
                      px={10}
                      py={6}
                      borderRadius={6}
                      bg={habitSplitMode === 'count' ? '#177A42' : '$color1'}
                      borderWidth={1}
                      borderColor={habitSplitMode === 'count' ? '#2ECC71' : '$gray5'}
                      onPress={() => setHabitSplitMode('count')}
                    >
                      <Text fontSize={12} fontWeight="600" color={habitSplitMode === 'count' ? 'white' : '$gray11'}>
                        By units
                      </Text>
                    </Button>
                  </XStack>

                  {/* Participants pick */}
                  <Text fontSize={12} fontWeight="600" color="$gray10" mt="$1">
                    Who pays:
                  </Text>

                  <YStack gap="$1.5">
                    {participants.map((p) => {
                      const isCountRow = habitSplitMode === 'count';
                      const assignedQty = habitPerPersonCount[p.uniqueId] || 0;
                      const isSelected = isCountRow ? assignedQty > 0 : habitAssignedTo.includes(p.uniqueId);

                      return (
                        <Pressable
                          key={`h-p-${p.uniqueId}`}
                          onPress={() => {
                            if (isCountRow) {
                              if (assignedQty > 0) {
                                decHabitUser(p.uniqueId);
                              } else {
                                incHabitUser(p.uniqueId);
                              }
                            } else {
                              toggleHabitUser(p.uniqueId);
                            }
                          }}
                        >
                          <XStack
                            h={40}
                            ai="center"
                            jc="space-between"
                            px="$3"
                            borderWidth={1}
                            borderColor={isSelected ? '#2ECC71' : '$gray5'}
                            borderRadius={8}
                            bg="$color1"
                          >
                            <Text fontSize={13} fontWeight="600">{p.username}</Text>

                            <XStack ai="center" gap="$2">
                              {isCountRow && (
                                <XStack ai="center" gap="$1.5">
                                  <Button
                                    unstyled
                                    onPress={(e: any) => {
                                      e.stopPropagation();
                                      decHabitUser(p.uniqueId);
                                    }}
                                    w={22}
                                    h={22}
                                    br={99}
                                    bg="$gray5"
                                    ai="center"
                                    jc="center"
                                  >
                                    <Text fontSize={12} color="$color">-</Text>
                                  </Button>
                                  <Text fontSize={12} minWidth={10} textAlign="center">
                                    {assignedQty}
                                  </Text>
                                  <Button
                                    unstyled
                                    onPress={(e: any) => {
                                      e.stopPropagation();
                                      incHabitUser(p.uniqueId);
                                    }}
                                    w={22}
                                    h={22}
                                    br={99}
                                    bg="$gray5"
                                    ai="center"
                                    jc="center"
                                  >
                                    <Text fontSize={12} color="$color">+</Text>
                                  </Button>
                                </XStack>
                              )}
                              <Circle
                                size={14}
                                borderColor="#2ECC71"
                                borderWidth={1.5}
                                bg={isSelected ? '#177A42' : 'transparent'}
                              />
                            </XStack>
                          </XStack>
                        </Pressable>
                      );
                    })}
                  </YStack>

                  <Button
                    unstyled
                    onPress={saveCustomHabitAction}
                    h={34}
                    borderRadius={8}
                    bg="#177A42"
                    ai="center"
                    jc="center"
                    mt="$2"
                    disabled={!habitItemName.trim()}
                    opacity={habitItemName.trim() ? 1 : 0.6}
                    pressStyle={{ opacity: 0.9 }}
                  >
                    <Text color="white" fontWeight="700" fontSize={13}>
                      Create Rule
                    </Text>
                  </Button>
                </YStack>

                {/* List of active habits */}
                <YStack gap="$2" mt="$2">
                  <Text fontSize={14} fontWeight="700" color="$color">
                    Active Habits ({customHabits.length})
                  </Text>

                  {customHabits.length === 0 ? (
                    <Text fontSize={12} color="$gray10" fontStyle="italic" p="$1">
                      No custom rules added yet. Matches will rely on history.
                    </Text>
                  ) : (
                    customHabits.map((habit) => (
                      <XStack
                        key={habit.id}
                        p="$2.5"
                        borderWidth={1}
                        borderColor="$gray5"
                        borderRadius={8}
                        bg="$color1"
                        jc="space-between"
                        ai="center"
                      >
                        <YStack gap="$0.5" f={1} pr="$2">
                          <Text fontWeight="700" fontSize={13}>{habit.itemName}</Text>
                          <Text fontSize={11} color="$gray10">
                            {habit.splitMode === 'equal'
                              ? `Split equally: ${habit.assignedTo
                                  .map((uid) => participants.find((p) => p.uniqueId === uid)?.username || uid)
                                  .join(', ')}`
                              : `Split units: ${Object.entries(habit.perPersonCount)
                                  .map(([uid, val]) => `${participants.find((p) => p.uniqueId === uid)?.username || uid} (${val}x)`)
                                  .join(', ')}`}
                          </Text>
                        </YStack>
                        <Button
                          unstyled
                          onPress={() => useQuickHabitsStore.getState().removeHabit(habit.id)}
                          px={8}
                          py={4}
                          br={6}
                          bg="#E74C3C1A"
                          hoverStyle={{ bg: '#E74C3C2D' }}
                          pressStyle={{ opacity: 0.9 }}
                        >
                          <Text color="#E74C3C" fontWeight="700" fontSize={11}>
                            Delete
                          </Text>
                        </Button>
                      </XStack>
                    ))
                  )}
                </YStack>
              </YStack>
            </ScrollView>
          </YStack>
        </YStack>
      )}

      {/* Finalizing spinner */}
      {finalizing && !showSuccess && (
        <YStack
          position="absolute"
          inset={0}
          ai="center"
          jc="center"
          bg="rgba(0,0,0,0.25)"
        >
          <YStack w={390} h={156} ai="center" jc="center" bg="$color1" br={12}>
            <Spinner size="large" color="#2ECC71" />
            <Text mt="$2" color="#2ECC71" fontSize={16} fontWeight="600">
              Saving split...
            </Text>
          </YStack>
        </YStack>
      )}

      {/* Success overlay */}
      {showSuccess && (
        <YStack
          position="absolute"
          inset={0}
          ai="center"
          jc="center"
          bg="rgba(0,0,0,0.25)"
        >
          <YStack w={390} h={156} ai="center" jc="center" bg="#177A42" br={12}>
            <Check size={42} color="white" />
            <Text mt="$2" color="white" fontSize={18} fontWeight="700">
              Bill confirmed
            </Text>
          </YStack>
        </YStack>
      )}
    </YStack>
  );
}
