import type { ReceiptParticipant } from '@/features/receipt/api/receipt.api';
import type { ReceiptSplitItem } from '@/features/receipt/model/receipt-session.store';

export interface QuickHabitTemplate {
  id: string;
  name: string;
  participants: ReceiptParticipant[];
  items: ReceiptSplitItem[];
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export type QuickHabitTemplateInput = Omit<QuickHabitTemplate, 'id' | 'createdAt' | 'updatedAt'>;
