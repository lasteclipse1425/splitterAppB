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

type ManualReceiptRow = { id: string; name: string; price: string; quantity: string };

const normalizeReceiptNumber = (raw: string) => {
  let value = raw.replace(/[^\d.,]/g, '');
  if (!value) return NaN;
  const comma = value.lastIndexOf(',');
  const dot = value.lastIndexOf('.');
  const decimalIndex = Math.max(comma, dot);
  if (decimalIndex >= 0 && value.length - decimalIndex - 1 > 0 && value.length - decimalIndex - 1 <= 2) {
    value = `${value.slice(0, decimalIndex).replace(/[.,]/g, '')}.${value.slice(decimalIndex + 1)}`;
  } else {
    value = value.replace(/[.,]/g, '');
  }
  return Number(value);
};

function rowsFromReceiptText(chunks: string[]): ManualReceiptRow[] {
  const lines = chunks.flatMap((chunk) => chunk.split(/\r?\n/)).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const ignored = /^(?:subtotal|grand total|total|tax|vat|tip|change|cash|card|payment|discount|service charge|service fee|delivery fee|packaging|rounding|thank you|receipt|check|invoice|order|table|cashier|address|phone|tel|website|итого|сумма|налог|сдача|рахмат|жами|солиқ|скидка|оплата|наличные|карта|обслуживание|сервисный сбор|доставка|упаковка|адрес|телефон|заказ|стол|кассир|чек|счет|счёт)(?:$|[\s:])/i;
  const metadata = /(?:https?:\/\/|www\.|\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|boulevard|blvd\.?|phone|tel\.?|tax\s*id|vat\s*id|receipt\s*(?:no|number)|invoice\s*(?:no|number))|(?:ул\.?|улица|проспект|пр-т|дом|тел\.?|телефон|инн|чек\s*(?:№|номер)))/i;
  const dateOrTime = /(?:\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b|\b\d{1,2}:\d{2}(?::\d{2})?\b)/;
  // OCR can put an item name on one line and its price on the next. Only
  // preserve standalone names that look like food/drinks, never arbitrary
  // header text such as the restaurant name or address.
  const likelyFood = /\b(?:food|meal|dish|drink|beverage|tea|coffee|latte|cappuccino|espresso|juice|water|soda|cola|lemonade|smoothie|soup|salad|pasta|pizza|burger|sandwich|fries|rice|plov|pilaf|dumpling|sushi|roll|steak|chicken|beef|fish|salmon|bread|dessert|cake|ice cream|pastry|cookie|шашлык|лагман|самса|хинкали|хачапури|пельмени|вареники|манты|плов|ош|суп|шурпа|салат|пицца|бургер|сэндвич|картофель|курица|говядина|рыба|хлеб|десерт|торт|мороженое|чай|кофе|сок|вода|лимонад|компот|напиток|таом|ичимлик|чой|қаҳва|qahva|choy|palov|osh|lag.mon|manti|somsa|shashlik|kabob|salat|sho.rva|non|sharbat|limonad|suv|makaron|muzqaymoq)\b/i;
  // Thousands may be separated with spaces, dots, or commas (e.g. 42 000,
  // 42.000, 42,000 in UZS receipts). Match those before decimal amounts so
  // the final digit is not mistaken for a separate zero-price match.
  const amountPattern = /(?:\d{1,3}(?:[ .,]\d{3})+|\d+)(?:[,.]\d{1,2})?/g;
  const rows: ManualReceiptRow[] = [];
  let pendingName = '';

  for (const line of lines) {
    if (ignored.test(line) || metadata.test(line) || dateOrTime.test(line)) { pendingName = ''; continue; }
    const matches = [...line.matchAll(amountPattern)];
    if (!matches.length) {
      pendingName = likelyFood.test(line) ? line : '';
      continue;
    }
    const amountMatch = matches[matches.length - 1];
    const amount = normalizeReceiptNumber(amountMatch[0]);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const quantityMatch = line.match(/(?:^|\s)(\d{1,3})\s*[x×]\s*/i);
    const quantity = quantityMatch ? Math.max(1, Number(quantityMatch[1])) : 1;
    const priceStart = amountMatch.index ?? 0;
    const textBeforePrice = line.slice(0, priceStart)
      .replace(/(?:\b(?:UZS|SUM|USD|EUR|RUB)\b|[₽$€])/gi, '')
      .replace(/(?:^|\s)\d{1,3}\s*[x×]\s*/i, ' ')
      .replace(/[x×*|:;\-]+/g, ' ').trim();
    const textAfterPrice = line.slice(priceStart + amountMatch[0].length)
      .replace(/(?:\b(?:UZS|SUM|USD|EUR|RUB)\b|[₽$€])/gi, '')
      .replace(/[x×*|:;\-]+/g, ' ').trim();
    const lineName = textBeforePrice || textAfterPrice;
    const name = (lineName || pendingName).replace(/\s+/g, ' ').trim();
    pendingName = '';
    // Discard OCR fragments (for example a lone "e" paired with the receipt
    // grand total) instead of presenting them as purchased items.
    if (!name || ignored.test(name) || metadata.test(name) || dateOrTime.test(name) || !/[a-zа-яё\u0400-\u04ff]{3,}/i.test(name)) continue;
    rows.push({ id: `ocr-${rows.length + 1}`, name, price: String(amount), quantity: String(quantity) });
  }
  return rows;
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
  const rows: ManualReceiptRow[] = [];
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
    rows.push(...rowsFromReceiptText(bandText));
  }

  // The overlapping bands can read the same row twice. Keep only one copy
  // of each matching name/price pair and assign stable IDs for the form.
  const uniqueRows = new Map<string, ManualReceiptRow>();
  for (const row of rows) {
    const key = `${row.name.toLocaleLowerCase()}|${row.price}|${row.quantity}`;
    if (!uniqueRows.has(key)) uniqueRows.set(key, row);
  }

  return {
    rows: [...uniqueRows.values()].map((row, index) => ({ ...row, id: `ocr-${index + 1}` })),
    recognizedText,
  };
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
  const clearCapture = useReceiptSessionStore((s) => s.clearCapture);
  const storedCapture = useReceiptSessionStore((s) => s.capture);
  const setSessionNameStore = useReceiptSessionStore((s) => s.setSessionName);
  const storedSessionName = useReceiptSessionStore((s) => s.session?.sessionName);

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
        let extractedRows = rowsFromReceiptText(recognizedLines);
        if (!extractedRows.length && picture.width && picture.height) {
          const bandResult = await rowsFromReceiptBands(ocr, picture.uri, picture.width, picture.height);
          extractedRows = bandResult.rows;
          if (bandResult.recognizedText.length) recognizedLines = bandResult.recognizedText;
        }
        if (extractedRows.length) {
          setManualRows(extractedRows);
          setRecognitionNotice(`Read ${extractedRows.length} possible item${extractedRows.length === 1 ? '' : 's'}. Review names, prices, and quantities before continuing.`);
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
      price: Number(row.price.replace(',', '.')),
      quantity: Math.floor(Number(row.quantity)),
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
        kind: 'item',
        splitMode: 'equal',
        assignedTo: [],
        perPersonCount: {},
      })));
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
        <YStack f={1} bg="$background" pt="$6" px="$4" pb="$4" gap="$3">
          <Text fontSize={22} fontWeight="700">Enter receipt items</Text>
          <Text color="$gray10">Add each item, its unit price, and quantity. You can review the split before saving.</Text>
          {!!recognitionNotice && <Text color="$gray10">{recognitionNotice}</Text>}
          {storedCapture?.uri && <Image source={{ uri: storedCapture.uri }} style={S.preview} resizeMode="cover" />}
          <ScrollView f={1} contentContainerStyle={{ gap: 12, paddingBottom: 12 }}>
            {manualRows.map((row, index) => (
              <YStack key={row.id} p="$3" borderWidth={1} borderColor="$gray5" borderRadius={12} gap="$2">
                <XStack ai="center" jc="space-between">
                  <Text fontWeight="700">Item {index + 1}</Text>
                  {manualRows.length > 1 && <Button size="$2" chromeless onPress={() => setManualRows((rows) => rows.filter((item) => item.id !== row.id))}>Remove</Button>}
                </XStack>
                <Input value={row.name} onChangeText={(name) => setManualRows((rows) => rows.map((item) => item.id === row.id ? { ...item, name } : item))} placeholder="Item name" accessibilityLabel={`Item ${index + 1} name`} />
                <XStack gap="$2">
                  <Input f={1} value={row.price} onChangeText={(price) => setManualRows((rows) => rows.map((item) => item.id === row.id ? { ...item, price: price.replace(/[^0-9.,]/g, '') } : item))} keyboardType="decimal-pad" placeholder="Unit price" accessibilityLabel={`Item ${index + 1} unit price`} />
                  <Input w={92} value={row.quantity} onChangeText={(quantity) => setManualRows((rows) => rows.map((item) => item.id === row.id ? { ...item, quantity: quantity.replace(/\D/g, '') } : item))} keyboardType="number-pad" placeholder="Qty" accessibilityLabel={`Item ${index + 1} quantity`} />
                </XStack>
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















