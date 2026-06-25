import type { Router } from 'expo-router';
import type { QuickHabitTemplate } from '@/features/receipt/model/quick-habit-template.types';
import { ReceiptApi } from '@/features/receipt/api/receipt.api';
import { useReceiptSessionStore } from '@/features/receipt/model/receipt-session.store';

type RouterLike = Pick<Router, 'push'>;

function cloneItems(items: QuickHabitTemplate['items']) {
  return items.map((item) => ({
    ...item,
    id: `${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    assignedTo: [...item.assignedTo],
    perPersonCount: { ...item.perPersonCount },
  }));
}

export async function startTemplateSession(
  template: QuickHabitTemplate,
  router: RouterLike,
  onDone?: () => void
) {
  const { id: sessionId } = await ReceiptApi.createSession();
  const participants = template.participants.map((p) => ({
    uniqueId: p.uniqueId,
    username: p.username,
  }));

  useReceiptSessionStore.setState({
    session: {
      sessionId,
      sessionName: template.name,
      language: 'en',
    },
    items: cloneItems(template.items),
    participants,
    currency: template.currency || 'UZS',
    parsing: false,
    parseError: undefined,
    finalizing: false,
    finalizeError: undefined,
    finalized: undefined,
  });

  const params = new URLSearchParams();
  params.set('receiptId', String(sessionId));
  params.set('participants', encodeURIComponent(JSON.stringify(participants)));

  onDone?.();
  router.push(`/tabs/sessions/items-split?${params.toString()}` as never);
}
