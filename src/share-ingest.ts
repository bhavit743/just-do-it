import { Capacitor } from '@capacitor/core';

type ShareInboxPlugin = {
  listFiles(): Promise<{ files: string[] }>;
  readFileBase64(opts: { name: string }): Promise<{ data: string }>;
  deleteFile(opts: { name: string }): Promise<void>;
  popQueue(): Promise<{ files: string[] }>;
};

const shareInbox = (window as any).Capacitor?.Plugins?.ShareInbox as ShareInboxPlugin;

function b64ToBlob(b64Data: string, contentType = 'image/jpeg', sliceSize = 512) {
  const byteCharacters = atob(b64Data);
  const byteArrays: Uint8Array[] = [];
  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i);
    byteArrays.push(new Uint8Array(byteNumbers));
  }
  return new Blob(byteArrays, { type: contentType });
}

export async function ingestSharedImages(uploadFn: (blob: Blob, name: string) => Promise<void>) {
  if (!Capacitor.isNativePlatform() || !shareInbox) return;

  // Prefer queued names written by the extension
  const popped = await shareInbox.popQueue();
  let names = popped.files;

  // Fallback: list directory (e.g., if queue write failed)
  if (!names.length) {
    const listed = await shareInbox.listFiles();
    names = listed.files;
  }

  for (const name of names) {
    try {
      const { data } = await shareInbox.readFileBase64({ name });
      const blob = b64ToBlob(data);
      await uploadFn(blob, name);
      await shareInbox.deleteFile({ name });
    } catch (e) {
      console.error('Ingest failed:', name, e);
    }
  }
}
