import type { RefObject } from 'react';
import type { View } from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { buildWeeklyReportHtml } from '../../reports/weeklyReportHtml';
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from './SharePnLCard';

const YOU_TRADER_MARK = require('../../../assets/youtrader-bull-mark.png');

async function loadShareModules() {
  const [viewShot, sharing, print, mediaLibrary] = await Promise.all([
    import('react-native-view-shot'),
    import('expo-sharing'),
    import('expo-print'),
    import('expo-media-library'),
  ]);
  return { captureRef: viewShot.captureRef, Sharing: sharing, Print: print, MediaLibrary: mediaLibrary };
}

export async function shareCapturedView(ref: RefObject<View | null>, dialogTitle = 'Share trader card', options?: { width?: number; height?: number }) {
  const { captureRef, Sharing } = await loadShareModules();
  if (!ref.current) throw new Error('Share card is not ready');
  const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile', width: options?.width || SHARE_CARD_WIDTH, height: options?.height || SHARE_CARD_HEIGHT });
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle });
  return uri;
}

export async function saveCapturedViewToPhotos(ref: RefObject<View | null>) {
  const { captureRef, MediaLibrary } = await loadShareModules();
  const perm = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
  if (!perm.granted) throw new Error('Photos permission was denied. Allow Photos access in iPhone Settings to save YouTrader cards.');
  if (!ref.current) throw new Error('Share card is not ready');
  const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile', width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT });
  await MediaLibrary.saveToLibraryAsync(uri);
  return uri;
}

export async function shareMonthlyPdfReport(stats: Record<string, unknown>) {
  return shareWeeklyPdfReport(stats);
}

async function loadLogoDataUri() {
  try {
    const asset = Asset.fromModule(YOU_TRADER_MARK);
    await asset.downloadAsync();
    const uri = asset.localUri || asset.uri;
    if (!uri || !uri.startsWith('file://')) return '';
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    return `data:image/png;base64,${base64}`;
  } catch {
    return '';
  }
}

export async function shareWeeklyPdfReport(stats: Record<string, unknown>) {
  const { Sharing, Print } = await loadShareModules();
  const html = buildWeeklyReportHtml(stats, await loadLogoDataUri());
  const { uri } = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Share YouTrader report' });
  return uri;
}
