import type { RefObject } from 'react';
import type { View } from 'react-native';
import { buildWeeklyReportHtml } from '../../reports/weeklyReportHtml';

async function loadShareModules() {
  const [viewShot, sharing, print, mediaLibrary] = await Promise.all([
    import('react-native-view-shot'),
    import('expo-sharing'),
    import('expo-print'),
    import('expo-media-library'),
  ]);
  return { captureRef: viewShot.captureRef, Sharing: sharing, Print: print, MediaLibrary: mediaLibrary };
}

export async function shareCapturedView(ref: RefObject<View | null>, dialogTitle = 'Share P&L card', options?: { width?: number; height?: number }) {
  const { captureRef, Sharing } = await loadShareModules();
  if (!ref.current) throw new Error('Share card is not ready');
  const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile', width: options?.width, height: options?.height });
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
  const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile', width: 1080, height: 1350 });
  await MediaLibrary.saveToLibraryAsync(uri);
  return uri;
}

export async function shareMonthlyPdfReport(stats: Record<string, unknown>) {
  return shareWeeklyPdfReport(stats);
}

export async function shareWeeklyPdfReport(stats: Record<string, unknown>) {
  const { Sharing, Print } = await loadShareModules();
  const html = buildWeeklyReportHtml(stats);
  const { uri } = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Share YouTrader report' });
  return uri;
}
