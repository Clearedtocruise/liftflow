import { dedupeInFlight, egressKey } from '@/lib/egressGuard';
import { supabase } from '@/supabase/client';
import type { ProgressPhoto } from '@/types';

const BUCKET = 'progress-photos';
const SIGNED_TTL_SECONDS = 60 * 60;
/** Reuse signed URLs until 10 minutes before expiry. */
const SIGNED_REUSE_MS = (SIGNED_TTL_SECONDS - 10 * 60) * 1000;

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

function storagePathFromPhotoUrl(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const prefixes = [
      `/storage/v1/object/public/${BUCKET}/`,
      `/storage/v1/object/sign/${BUCKET}/`,
      `/storage/v1/object/authenticated/${BUCKET}/`,
    ];
    for (const prefix of prefixes) {
      const index = parsed.pathname.indexOf(prefix);
      if (index >= 0) {
        return decodeURIComponent(parsed.pathname.slice(index + prefix.length));
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** Prefer signed URLs so private buckets and RLS-protected objects still render in the app. */
export async function resolveProgressPhotoUrl(photoUrl: string): Promise<string> {
  const path = storagePathFromPhotoUrl(photoUrl);
  if (!path) return photoUrl;

  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  return dedupeInFlight(egressKey(['signedUrl', path]), async () => {
    const stillCached = signedUrlCache.get(path);
    if (stillCached && stillCached.expiresAt > Date.now()) {
      return stillCached.url;
    }

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL_SECONDS);
    if (error || !data?.signedUrl) return photoUrl;

    signedUrlCache.set(path, {
      url: data.signedUrl,
      expiresAt: Date.now() + SIGNED_REUSE_MS,
    });
    return data.signedUrl;
  });
}

export async function resolveProgressPhotos(photos: ProgressPhoto[]): Promise<ProgressPhoto[]> {
  return Promise.all(
    photos.map(async (photo) => ({
      ...photo,
      photoUrl: await resolveProgressPhotoUrl(photo.photoUrl),
      thumbnailUrl: photo.thumbnailUrl ? await resolveProgressPhotoUrl(photo.thumbnailUrl) : undefined,
    })),
  );
}
