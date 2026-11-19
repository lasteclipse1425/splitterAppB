import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, StyleSheet, View } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { YStack, XStack, Button, Paragraph, Input, Text, ScrollView } from 'tamagui';
import { ChevronLeft, AlertTriangle, Camera as CameraIcon } from '@tamagui/lucide-icons';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import { useReceiptSessionStore } from '@/features/receipt/model/receipt-session.store';
import { apiClient } from '@/features/auth/api';
import { CURRENCY_OPTIONS } from '@/shared/config/currencies';
import { useAppStore } from '@/shared/lib/stores/app-store';

type ManualReceiptRow = {
  id: string;
  name: string;
  price: string;
  quantity: string;
  kind?: 'item' | 'fee';
  confidence?: number;
};

/**
 * Normalize a receipt number string into a JS number.
 *
 * Handles:
 *   - Space-separated thousands: "120 020" → 120020
 *   - Dot/comma thousands: "120.020" or "120,020" → 120020 (when no decimal part)
 *   - Decimal amounts: "12.50" or "12,50" → 12.5
 *   - Mixed: "1 200,50" → 1200.5
 *   - UZS-style: "42 000" → 42000
 */
const normalizeReceiptNumber = (raw: string): number => {
  // Keep digits, dots, commas, and spaces (spaces may be thousand separators)
  let value = raw.replace(/[^\d.,\s]/g, '').trim();
  if (!value) return NaN;

  // If the number contains spaces between digit groups, treat them as thousand separators.
  // e.g. "120 020" → "120020", "1 200 000" → "1200000"
  // But "120 020,50" → "120020.50"
  const hasSpaceSeparatedGroups = /\d\s+\d/.test(value);
  if (hasSpaceSeparatedGroups) {
    // Check if there's a decimal part after removing space groups
    // Pattern: digits with spaces, optionally ending in [,.]\d{1,2}
    const spaceGroupMatch = value.match(/^([\d\s]+)(?:[,.]([\d]{1,2}))?$/);
    if (spaceGroupMatch) {
      const integerPart = spaceGroupMatch[1].replace(/\s+/g, '');
      const decimalPart = spaceGroupMatch[2];
      return decimalPart
        ? Number(`${integerPart}.${decimalPart}`)
        : Number(integerPart);
    }
    // Fallback: just strip spaces
    value = value.replace(/\s+/g, '');
  }

  // Now handle dot/comma as thousand or decimal separator
  const comma = value.lastIndexOf(',');
  const dot = value.lastIndexOf('.');
  const decimalIndex = Math.max(comma, dot);

  if (decimalIndex >= 0) {
    const afterDecimal = value.length - decimalIndex - 1;
    if (afterDecimal > 0 && afterDecimal <= 2) {
      // Looks like a decimal separator
      const intPart = value.slice(0, decimalIndex).replace(/[.,]/g, '');
      const fracPart = value.slice(decimalIndex + 1);
      return Number(`${intPart}.${fracPart}`);
    }
    // Otherwise it's a thousand separator — strip it
    return Number(value.replace(/[.,]/g, ''));
  }

  return Number(value);
};

function rowsFromReceiptText(chunks: string[]): ManualReceiptRow[] {
  const lines = chunks.flatMap((chunk) => chunk.split(/\r?\n/)).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const ignored = /^(?:sub\s*total|subtotal|grand total|total|amount due|tax|vat|tip|change|cash|card|payment|discount|rounding|thank you|receipt|check|invoice|order|table|cashier|address|phone|tel|website|restaurant|cafe|coffee shop|dine[ -]?in|take[ -]?away|итого|итог|всего|к оплате|сумма|налог|ндс|сдача|стоимость|рахмат|жами|солиқ|скидка|оплата|наличные|карта|адрес|телефон|заказ|стол|кассир|чек|счет|счёт|ресторан|кафе)(?:$|[\s:#])/i;
  const feeLine = /^(?:service(?:\s+(?:charge|fee))?|delivery fee|packaging|обслуживание|сервис(?:ный сбор)?|доставка|упаковка)(?:$|[\s:#])/i;
  const metadata = /(?:https?:\/\/|www\.|\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|boulevard|blvd\.?|phone|tel\.?|tax\s*id|vat\s*id|receipt\s*(?:no|number)|invoice\s*(?:no|number)|order\s*(?:no|number)|table\s*(?:no|number))|(?:ул\.?|улица|проспект|пр-т|дом|тел\.?|телефон|инн|чек\s*(?:№|номер)))/i;
  const dateOrTime = /(?:\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b|\b\d{1,2}:\d{2}(?::\d{2})?\b)/;
  // OCR often separates item names and prices into adjacent lines. Accept
  // short, text-only lines as possible names, while excluding common receipt
  // headings and business/address metadata above.
  // Thousands may be separated with spaces, dots, or commas (e.g. 42 000,
  // 42.000, 42,000 in UZS receipts). Match those before decimal amounts so
  // the final digit is not mistaken for a separate zero-price match.
  const amountPattern = /(?:\d{1,3}(?:[ .,]\d{3})+|\d+)(?:[,.]\d{1,2})?/g;
  const rows: ManualReceiptRow[] = [];
  let pendingName = '';
  let pendingKind: 'item' | 'fee' = 'item';

  for (const line of lines) {
    if (ignored.test(line) || metadata.test(line) || dateOrTime.test(line)) {
      pendingName = '';
      pendingKind = 'item';
      continue;
    }
    const matches = [...line.matchAll(amountPattern)];
    if (!matches.length) {
      const wordCount = line.split(/\s+/).length;
      pendingName = /[a-zа-яё\u0400-\u04ff]{3}/i.test(line) && wordCount <= 7 && line.length <= 64 ? line : '';
      pendingKind = feeLine.test(line) ? 'fee' : 'item';
      continue;
    }
    const amountMatch = matches[matches.length - 1];
    const quantityMatch = line.match(/(?:^|\s)(\d{1,3}(?:[.,]\d+)?)\s*[x×]\s*|[x×]\s*(\d{1,3}(?:[.,]\d+)?)(?=\s|$)/i);
    const weightMatch = line.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(?:kg|кг|g|г|гр|l|л|ml|мл)(?=\s|$)/i);
    const quantity = quantityMatch
      ? normalizeReceiptNumber(quantityMatch[1] || quantityMatch[2])
      : weightMatch
        ? normalizeReceiptNumber(weightMatch[1])
        : 1;
    let selectedAmount = amountMatch;
    // Many receipts print `2 x 15,000 30,000`: use the unit price so the
    // quantity is not multiplied twice in the split flow.
    if (quantityMatch && matches.length >= 3) {
      const possibleUnit = matches[matches.length - 2];
      const possibleTotal = matches[matches.length - 1];
      const unitValue = normalizeReceiptNumber(possibleUnit[0]);
      const totalValue = normalizeReceiptNumber(possibleTotal[0]);
      if (unitValue > 0 && Math.abs(unitValue * quantity - totalValue) <= Math.max(1, unitValue * 0.03)) {
        selectedAmount = possibleUnit;
      }
    }
    const recognizedAmount = normalizeReceiptNumber(selectedAmount[0]);
    // Weight lines normally show a line total; x-notation normally shows a unit price.
    const amount = weightMatch && !quantityMatch
      ? recognizedAmount / quantity
      : recognizedAmount;
    if (!Number.isFinite(amount) || quantity <= 0 || !Number.isFinite(quantity) || amount <= 0) continue;
    const priceStart = selectedAmount.index ?? 0;
    const textBeforePrice = line.slice(0, priceStart)
      .replace(/(?:\b(?:UZS|SUM|USD|EUR|RUB|GBP|KZT|CNY|JPY|AED|INR)\b|[₽$€¥₹])/gi, '')
      .replace(/(?:^|\s)\d{1,3}\s*[x×]\s*|[x×]\s*\d{1,3}(?=\s|$)/gi, ' ')
      .replace(/[x×*|:;\-]+/g, ' ').trim();
    const textAfterPrice = line.slice(priceStart + selectedAmount[0].length)
      .replace(/(?:\b(?:UZS|SUM|USD|EUR|RUB|GBP|KZT|CNY|JPY|AED|INR)\b|[₽$€¥₹])/gi, '')
      .replace(/[x×*|:;\-]+/g, ' ').trim();
    const lineName = textBeforePrice || textAfterPrice;
    const name = (lineName || pendingName)
      .replace(/\b\d+(?:[.,]\d+)?\s*%/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const kind = feeLine.test(line) || (!lineName && pendingKind === 'fee') ? 'fee' : 'item';
    pendingName = '';
    pendingKind = 'item';
    // Discard OCR fragments (for example a lone "e" paired with the receipt
    // grand total) instead of presenting them as purchased items.
    if (!name || ignored.test(name) || metadata.test(name) || dateOrTime.test(name) || !/[a-zа-яё\u0400-\u04ff]{3,}/i.test(name)) continue;
    rows.push({
      id: `ocr-${rows.length + 1}`,
      name,
      price: String(amount),
      quantity: String(quantity),
      kind,
      confidence: weightMatch && !quantityMatch ? 0.65 : quantityMatch && matches.length < 3 ? 0.7 : 0.85,
    });
  }
  return rows;
}

function mergeReceiptRows(primary: ManualReceiptRow[], secondary: ManualReceiptRow[]): ManualReceiptRow[] {
  const keyFor = (row: ManualReceiptRow) => `${row.kind ?? 'item'}|${row.name.toLocaleLowerCase()}|${row.price}|${row.quantity}`;
  const primaryCounts = new Map<string, number>();
  const secondaryCounts = new Map<string, number>();
  const rowsByKey = new Map<string, ManualReceiptRow>();
  for (const row of primary) {
    const key = keyFor(row);
    primaryCounts.set(key, (primaryCounts.get(key) ?? 0) + 1);
    if (!rowsByKey.has(key)) rowsByKey.set(key, row);
  }
  for (const row of secondary) {
    const key = keyFor(row);
    secondaryCounts.set(key, (secondaryCounts.get(key) ?? 0) + 1);
    if (!rowsByKey.has(key)) rowsByKey.set(key, row);
  }

  const merged: ManualReceiptRow[] = [];
  for (const [key, row] of rowsByKey) {
    const count = Math.max(primaryCounts.get(key) ?? 0, secondaryCounts.get(key) ?? 0);
    for (let index = 0; index < count; index += 1) {
      merged.push({ ...row, id: `ocr-${merged.length + 1}` });
    }
  }
  return merged;
}

async function rowsFromReceiptBands(
  ocr: { extractTextFromImage: (uri: string) => Promise<string[]> },
  uri: string,
  width: number,
  height: number,
): Promise<{ rows: ManualReceiptRow[]; recognizedText: string[] }> {
  const bandCount = 16;
  const bandStep = Math.ceil(height / bandCount);
  const bandHeight = Math.min(height, Math.ceil(bandStep * 1.25));
  const rowsByKey = new Map<string, ManualReceiptRow>();
  const maxOccurrencesByKey = new Map<string, number>();
  const recognizedText: string[] = [];

  for (let index = 0; index < bandCount; index += 1) {
    const originY = index * bandStep;
    if (originY >= height) break;
    const cropHeight = Math.min(bandHeight, height - originY);
    const crop = await manipulateAsync(
      uri,
      [{ crop: { originX: 0, originY, width, height: cropHeight } }],
      { compress: 0.95, format: SaveFormat.JPEG },
    );
    const bandText = await ocr.extractTextFromImage(crop.uri);
    recognizedText.push(...bandText);
    const bandRows = rowsFromReceiptText(bandText);
    const occurrences = new Map<string, number>();
    for (const row of bandRows) {
      const key = `${row.kind ?? 'item'}|${row.name.toLocaleLowerCase()}|${row.price}|${row.quantity}`;
      occurrences.set(key, (occurrences.get(key) ?? 0) + 1);
      if (!rowsByKey.has(key)) rowsByKey.set(key, row);
    }
    for (const [key, count] of occurrences) {
      maxOccurrencesByKey.set(key, Math.max(maxOccurrencesByKey.get(key) ?? 0, count));
    }
  }

  const rows: ManualReceiptRow[] = [];
  for (const [key, row] of rowsByKey) {
    const count = maxOccurrencesByKey.get(key) ?? 0;
    for (let index = 0; index < count; index += 1) {
      rows.push({ ...row, id: `ocr-${rows.length + 1}` });
    }
  }

  return {
    rows,
    recognizedText,
  };
}

function detectReceiptCurrency(lines: string[]): string | null {
  const text = lines.join(' ').toLocaleLowerCase();
  if (/\b(?:uzs|sum|som)\b|сум|сўм|so[ʻ'’]?m/.test(text)) return 'UZS';
  if (/\b(?:usd|us\$)\b|\$/.test(text)) return 'USD';
  if (/\b(?:eur)\b|€/.test(text)) return 'EUR';
  if (/\b(?:rub|rur)\b|₽|руб/.test(text)) return 'RUB';
  if (/\bgbp\b|£/.test(text)) return 'GBP';
  if (/\bkzt\b|₸/.test(text)) return 'KZT';
  if (/\bcny\b/.test(text)) return 'CNY';
  if (/\btry\b|₺/.test(text)) return 'TRY';
  if (/\baed\b|د\.إ/.test(text)) return 'AED';
  if (/\bkrw\b|₩/.test(text)) return 'KRW';
  if (/\binr\b|₹/.test(text)) return 'INR';
  if (/\bjpy\b|円/.test(text)) return 'JPY';
  return null;
}

const getDefaultSessionName = () => {
  const now = new Date();
  const pad = (value: number) => value.toString().padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `${date} ${time}`;
};

function guessMime(uri?: string): string {
  if (!uri) return 'image/jpeg';
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

export default function ScanReceiptScreen() {
  const [perm, requestPerm] = useCameraPermissions();
  const isFocused = useIsFocused();
  const router = useRouter();

  const cameraRef = useRef<CameraView | null>(null);
  const scanInFlightRef = useRef(false);

  const setCapture = useReceiptSessionStore((s) => s.setCapture);
  const startManualSession = useReceiptSessionStore((s) => s.startManualSession);
  const setReceiptCurrencyStore = useReceiptSessionStore((s) => s.setReceiptCurrency);
  const preferredCurrency = useAppStore((s) => s.preferredCurrency);
  const clearCapture = useReceiptSessionStore((s) => s.clearCapture);
  const storedCapture = useReceiptSessionStore((s) => s.capture);
  const setSessionNameStore = useReceiptSessionStore((s) => s.setSessionName);
  const storedSessionName = useReceiptSessionStore((s) => s.session?.sessionName);
  const [receiptCurrency, setReceiptCurrency] = useState(preferredCurrency);

  const [sessionName, setSessionName] = useState(() => storedSessionName || getDefaultSessionName());
  const [isAutoName, setIsAutoName] = useState(() => !storedSessionName);
  const [localError, setLocalError] = useState<string | null>(null);
  const [takingPhoto, setTakingPhoto] = useState(false);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [creatingManualSession, setCreatingManualSession] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [recognitionNotice, setRecognitionNotice] = useState<string | null>(null);
  const [manualRows, setManualRows] = useState<ManualReceiptRow[]>([
    { id: `${Date.now()}-1`, name: '', price: '', quantity: '1' },
  ]);

  useEffect(() => {
    if (isFocused && !perm?.granted) requestPerm();
  }, [isFocused, perm?.granted, requestPerm]);

  useEffect(() => {
    if (storedSessionName) {
      setIsAutoName(false);
      setSessionName((prev) => (prev === storedSessionName ? prev : storedSessionName));
    } else {
      setIsAutoName(true);
    }
  }, [storedSessionName]);

  useEffect(() => {
    setReceiptCurrency(preferredCurrency);
  }, [preferredCurrency]);

  useFocusEffect(
    useCallback(() => {
      if (storedSessionName) return;
      if (!isAutoName) return;
      const freshName = getDefaultSessionName();
      setSessionName((prev) => (prev === freshName ? prev : freshName));
    }, [storedSessionName, isAutoName])
  );

  useEffect(() => () => clearCapture(), [clearCapture]);

  const handlePhotoReference = useCallback(async () => {
    if (!cameraRef.current || takingPhoto || scanInFlightRef.current) return;
    scanInFlightRef.current = true;
    setTakingPhoto(true);

    try {
      setLocalError(null);
      const picture = await cameraRef.current.takePictureAsync({
        quality: 1,
        base64: false,
      });
      if (!picture?.uri) throw new Error('Could not capture the receipt photo. Please try again.');

      const preparedName = sessionName.trim() || getDefaultSessionName();
      setSessionNameStore(preparedName);
      setManualError(null);
      setRecognitionNotice(null);
      setCapture({
        uri: picture.uri,
        base64: '',
        mimeType: guessMime(picture.uri),
        width: picture.width,
        height: picture.height,
      });
      setManualRows([{ id: `${Date.now()}-1`, name: '', price: '', quantity: '1' }]);
      try {
        const ocr = await import('expo-text-extractor');
        if (!ocr.isSupported) throw new Error('OCR is not supported in this app build.');
        let recognizedLines = await ocr.extractTextFromImage(picture.uri);
        const detectedCurrency = detectReceiptCurrency(recognizedLines);
        if (detectedCurrency) setReceiptCurrency(detectedCurrency);
        let extractedRows = rowsFromReceiptText(recognizedLines);
        if (extractedRows.length < 4 && picture.width && picture.height) {
          const bandResult = await rowsFromReceiptBands(ocr, picture.uri, picture.width, picture.height);
          extractedRows = mergeReceiptRows(extractedRows, bandResult.rows);
          if (bandResult.recognizedText.length) {
            recognizedLines = bandResult.recognizedText;
            const bandCurrency = detectReceiptCurrency(recognizedLines);
            if (bandCurrency) setReceiptCurrency(bandCurrency);
          }
        }
        if (extractedRows.length) {
          setManualRows(extractedRows);
          const hasAdjustments = recognizedLines.some((line) => /(?:subtotal|grand total|amount due|tax|vat|discount|change|итого|сумма|налог|ндс|скидка|сдача)/i.test(line));
          setRecognitionNotice(
            `Read ${extractedRows.length} possible item${extractedRows.length === 1 ? '' : 's'}. Review names, prices, and quantities before continuing.${hasAdjustments ? ' Totals and payment lines are not items. Use tax controls for tax; adjust item prices manually if a discount applies.' : ''}`
          );
        } else {
          const textPreview = recognizedLines.join(' | ').replace(/\s+/g, ' ').trim().slice(0, 500);
          setRecognitionNotice(
            textPreview
              ? `No item and price pairs found. OCR read: ${textPreview}`
              : 'No readable text found. Move closer, hold the phone steady, and try again.'
          );
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.error('[Receipt OCR] On-device text extraction failed', error);
        setRecognitionNotice(`OCR could not read this photo: ${reason}. You can still enter items manually.`);
      }
      setManualEntryOpen(true);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Could not capture the receipt photo.');
    } finally {
      scanInFlightRef.current = false;
      setTakingPhoto(false);
    }
  }, [takingPhoto, sessionName, setSessionNameStore, setCapture]);

  const addManualRow = () => setManualRows((rows) => [...rows, {
    id: `${Date.now()}-${rows.length + 1}`, name: '', price: '', quantity: '1',
  }]);

  const createManualReceipt = async () => {
    const enteredRows = manualRows.filter((row) => row.name.trim() || row.price.trim() || row.quantity !== '1');
    const validRows = enteredRows.map((row) => ({
      ...row,
      name: row.name.trim(),
      price: normalizeReceiptNumber(row.price),
      quantity: normalizeReceiptNumber(row.quantity),
    })).filter((row) => row.name && Number.isFinite(row.price) && row.price > 0 && Number.isFinite(row.quantity) && row.quantity > 0);

    if (!validRows.length || validRows.length !== enteredRows.length) {
      setManualError('Complete each item with a name, positive price, and quantity, or remove the empty row.');
      return;
    }
    setCreatingManualSession(true);
    setManualError(null);
    try {
      const preparedName = sessionName.trim() || getDefaultSessionName();
      const total = validRows.reduce((sum, row) => sum + row.price * row.quantity, 0);
      const response = await apiClient.post<{ id: number }>('/sessions', { total });
      if (!Number.isInteger(response.data?.id)) throw new Error('The server did not create a receipt session.');
      startManualSession(response.data.id, preparedName, validRows.map((row, index) => ({
        id: `manual-${response.data.id}-${index + 1}`,
        name: row.name,
        unitPrice: row.price,
        quantity: row.quantity,
        totalPrice: row.price * row.quantity,
        kind: row.kind ?? 'item',
        splitMode: row.quantity > 1 && Number.isInteger(row.quantity) ? 'count' : 'equal',
        assignedTo: [],
        perPersonCount: {},
        confidence: row.confidence,
      })));
      setReceiptCurrencyStore(receiptCurrency);
      setSessionNameStore(preparedName);
      setManualEntryOpen(false);
      router.push('/tabs/sessions/participants');
    } catch (error) {
      setManualError(error instanceof Error ? error.message : 'Could not create the receipt. Try again.');
    } finally {
      setCreatingManualSession(false);
    }
  };

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/tabs' as never);
  }, [router]);

  const handleSessionNameChange = useCallback((value: string) => {
    setIsAutoName(false);
    setSessionName(value);
  }, [setIsAutoName, setSessionName]);

  const disableAction = takingPhoto || !perm?.granted;
  const errorMessage = localError;

  return (
    <View style={S.root}>
      <View style={S.headerAbs}>
        <XStack ai="center" jc="space-between" px="$3" py="$2">
          <Button
            size="$2"
            h={28}
            chromeless
            onPress={goBack}
            icon={<ChevronLeft size={18} color="white" />}
            color="white"
          >
            Back
          </Button>
          <Paragraph fow="700" fos="$6" col="white">Scan receipt</Paragraph>
          <YStack w={54} />
        </XStack>
      </View>

      <View style={S.cameraWrap}>
        {isFocused && perm?.granted ? (
          <CameraView
            ref={cameraRef}
            style={S.camera}
            facing="back"
          />
        ) : (
          <YStack f={1} ai="center" jc="center">
            {!perm ? <ActivityIndicator color="white" /> : <Paragraph col="$gray1">Allow camera access</Paragraph>}
          </YStack>
        )}

      </View>

      <View style={S.actions}>
        <YStack gap="$3">
          <YStack gap={8}>
            <Paragraph color="$gray1" fontSize={12}>
              Session name
            </Paragraph>
            <Input
              value={sessionName}
              onChangeText={handleSessionNameChange}
              placeholder="e.g. Cafe on October"
              height={41}
              borderRadius={10}
              px={16}
              backgroundColor="rgba(255,255,255,0.1)"
              color="white"
              borderWidth={1}
              borderColor="rgba(255,255,255,0.25)"
            />
          </YStack>

          <Paragraph color="$gray1" fontSize={12}>
            A local text reader suggests item names and prices from the photo. Review and correct every line before splitting.
          </Paragraph>

          {storedCapture?.uri && (
            <XStack ai="center" gap="$2">
              <Image source={{ uri: storedCapture.uri }} style={S.preview} resizeMode="cover" />
              <Paragraph color="$gray1" fontSize={12}>
                Last photo stored; capturing again will overwrite it.
              </Paragraph>
            </XStack>
          )}

          {errorMessage && (
            <XStack ai="center" gap="$2" bg="rgba(255,99,71,0.18)" px="$2" py="$2" borderRadius={8}>
              <AlertTriangle size={16} color="#FF6B6B" />
              <Paragraph color="#FF6B6B" flexShrink={1}>{errorMessage}</Paragraph>
            </XStack>
          )}

          <XStack ai="center" jc="space-between" gap="$3">
            <Button
              size="$3"
              borderRadius="$3"
              theme="gray"
              onPress={goBack}
              disabled={takingPhoto}
              opacity={takingPhoto ? 0.6 : 1}
            >
              Cancel
            </Button>
            <Button
              size="$3"
              borderRadius="$3"
              theme="active"
              onPress={handlePhotoReference}
              disabled={disableAction}
              icon={<CameraIcon size={18} color="white" />}
            >
              {takingPhoto ? 'Taking photo...' : 'Photograph and enter items'}
            </Button>
          </XStack>

          <Button size="$3" borderRadius="$3" theme="gray" variant="outlined" onPress={() => { setManualError(null); setRecognitionNotice(null); setManualEntryOpen(true); }} disabled={takingPhoto}>
            Enter items without a photo
          </Button>
        </YStack>
      </View>

      <Modal visible={manualEntryOpen} animationType="slide" onRequestClose={() => setManualEntryOpen(false)}>
        <YStack f={1} bg="$background" pt="$4" px="$4" pb="$3" gap="$2">
          <Text fontSize={22} fontWeight="700">Enter receipt items</Text>
          <Text color="$gray10">Add each item, its unit price, and quantity. You can review the split before saving.</Text>
          <YStack gap="$1">
            <Text fontSize={13} fontWeight="700">Receipt currency</Text>
            <ScrollView
              horizontal
              height={36}
              flexGrow={0}
              flexShrink={0}
              showsHorizontalScrollIndicator={false}
            >
              <XStack gap="$2" alignItems="center">
                {CURRENCY_OPTIONS.map((option) => (
                  <Button
                    key={option.code}
                    size="$2"
                    theme={receiptCurrency === option.code ? 'active' : 'gray'}
                    onPress={() => setReceiptCurrency(option.code)}
                  >
                    {option.code}
                  </Button>
                ))}
              </XStack>
            </ScrollView>
          </YStack>
          {!!recognitionNotice && <Text color="$gray10" fontSize={13}>{recognitionNotice}</Text>}
          {storedCapture?.uri && <Image source={{ uri: storedCapture.uri }} style={S.preview} resizeMode="cover" />}
          <ScrollView f={1} contentContainerStyle={{ gap: 12, paddingBottom: 12 }}>
            {manualRows.map((row, index) => (
              <YStack key={row.id} p="$2.5" borderWidth={1} borderColor="$gray5" borderRadius={12} gap="$2">
                <XStack ai="center" jc="space-between">
                  <Text fontWeight="700">
                    {row.kind === 'fee' ? `Fee ${index + 1}` : `Item ${index + 1}`}
                  </Text>
                  {manualRows.length > 1 && <Button size="$2" chromeless onPress={() => setManualRows((rows) => rows.filter((item) => item.id !== row.id))}>Remove</Button>}
                </XStack>
                <Input value={row.name} onChangeText={(name) => setManualRows((rows) => rows.map((item) => item.id === row.id ? { ...item, name } : item))} placeholder="Item name" accessibilityLabel={`Item ${index + 1} name`} />
                <XStack gap="$2">
                  <Input f={1} value={row.price} onChangeText={(price) => setManualRows((rows) => rows.map((item) => item.id === row.id ? { ...item, price: price.replace(/[^0-9.,\s]/g, '') } : item))} keyboardType="decimal-pad" placeholder="Unit price" accessibilityLabel={`Item ${index + 1} unit price`} />
                  <Input w={92} value={row.quantity} onChangeText={(quantity) => setManualRows((rows) => rows.map((item) => item.id === row.id ? { ...item, quantity: quantity.replace(/[^0-9.,]/g, '') } : item))} keyboardType="decimal-pad" placeholder="Qty / weight" accessibilityLabel={`Item ${index + 1} quantity`} />
                </XStack>
                {row.confidence !== undefined && row.confidence < 0.75 && (
                  <Text color="$orange10" fontSize={12}>Please verify this quantity and price; the receipt layout was ambiguous.</Text>
                )}
              </YStack>
            ))}
            <Button variant="outlined" onPress={addManualRow}>Add another item</Button>
            {!!manualError && <Text color="$red10">{manualError}</Text>}
          </ScrollView>
          <Button onPress={createManualReceipt} disabled={creatingManualSession}>
            {creatingManualSession ? 'Creating…' : 'Continue to participants'}
          </Button>
          <Button variant="outlined" onPress={() => setManualEntryOpen(false)} disabled={creatingManualSession}>Cancel</Button>
        </YStack>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  headerAbs: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    paddingTop: 8, backgroundColor: 'rgba(0,0,0,0.25)',
  },
  cameraWrap: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBox: {
    width: 250,
    height: 300,
    borderWidth: 2,
    borderColor: 'rgba(46, 204, 113, 0.3)',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  scanLine: {
    width: '100%',
    height: 3,
    backgroundColor: '#2ECC71',
    shadowColor: '#2ECC71',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 5,
  },
  actions: {
    position: 'absolute',
    bottom: 24, left: 16, right: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 16,
    borderRadius: 16,
  },
  preview: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
});















