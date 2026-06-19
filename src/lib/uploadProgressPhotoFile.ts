import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from '@/supabase/client';

const BUCKET = 'progress-photos';

function contentTypeForExt(ext: string): string {
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic' || ext === 'heif') return 'image/jpeg';
  return 'image/jpeg';
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function uploadProgressPhotoFile(userId: string, uri: string): Promise<string> {
  const ext = uri.split('.').pop()?.toLowerCase()?.split('?')[0] ?? 'jpg';
  const path = `${userId}/${Date.now()}.${ext === 'heic' || ext === 'heif' ? 'jpg' : ext}`;

  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    throw new Error('Could not read the selected photo.');
  }

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = base64ToUint8Array(base64);

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: contentTypeForExt(ext),
    upsert: false,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
