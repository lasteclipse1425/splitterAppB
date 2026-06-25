import { Platform, Share, type View } from 'react-native';
import type { RefObject } from 'react';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { formatMoney } from '@/shared/lib/money';

export type ShareParticipant = {
  username: string;
  amount: number;
};

export type ShareSplitInput = {
  sessionName?: string;
  currency: string;
  grandTotal: number;
  participants: ShareParticipant[];
};

const formatAmount = (n: number, currency: string) => formatMoney(n, currency);

export function buildSplitShareMessage({
  sessionName,
  currency,
  grandTotal,
  participants,
}: ShareSplitInput): string {
  const title = sessionName?.trim() || 'Bill split';
  const lines: string[] = [];

  lines.push(`🧾 ${title}`);
  lines.push(`Total: ${formatAmount(grandTotal, currency)}`);

  if (participants.length > 0) {
    lines.push('');
    const longest = participants.reduce(
      (max, p) => Math.max(max, p.username.length),
      0
    );
    for (const p of participants) {
      const name = p.username.padEnd(longest, ' ');
      lines.push(`• ${name}  ${formatAmount(p.amount, currency)}`);
    }
  }

  lines.push('');
  lines.push('Split with Splitter');

  return lines.join('\n');
}

export async function shareSplit(input: ShareSplitInput): Promise<boolean> {
  const message = buildSplitShareMessage(input);
  try {
    const result = await Share.share({
      message,
      title: input.sessionName?.trim() || 'Bill split',
    });
    return result.action === Share.sharedAction;
  } catch (error) {
    console.warn('[shareSplit] failed', error);
    return false;
  }
}

export type DebtReminderInput = {
  fromName: string;
  toName: string;
  amount: number;
  currency?: string;
  groupName?: string;
};

export function buildDebtReminderMessage({
  fromName,
  toName,
  amount,
  currency = 'UZS',
  groupName,
}: DebtReminderInput): string {
  const amountLabel = formatAmount(amount, currency);
  const lines = [
    `💸 Payment reminder`,
    `${fromName} owes ${toName} ${amountLabel}`,
  ];
  if (groupName?.trim()) {
    lines.push(`Group: ${groupName.trim()}`);
  }
  lines.push('', 'Split with Splitter');
  return lines.join('\n');
}

export async function shareDebtReminder(input: DebtReminderInput): Promise<boolean> {
  const message = buildDebtReminderMessage(input);
  try {
    const result = await Share.share({ message, title: 'Payment reminder' });
    return result.action === Share.sharedAction;
  } catch (error) {
    console.warn('[shareDebtReminder] failed', error);
    return false;
  }
}

export async function shareSplitImage(
  ref: RefObject<View | null>,
  fallback: ShareSplitInput
): Promise<boolean> {
  try {
    if (!ref.current) {
      throw new Error('Share card ref is not mounted');
    }

    const uri = await captureRef(ref, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
    });

    if (Platform.OS === 'web') {
      throw new Error('Image sharing is not supported on web');
    }

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      throw new Error('Sharing is not available on this device');
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: fallback.sessionName?.trim() || 'Bill split',
      UTI: 'public.png',
    });
    return true;
  } catch (error) {
    console.warn('[shareSplitImage] falling back to text share', error);
    return shareSplit(fallback);
  }
}
