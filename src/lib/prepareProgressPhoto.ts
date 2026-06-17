import * as ImageManipulator from 'expo-image-manipulator';

export type PreparedPhotoUpload = {
  uri: string;
  mimeType: string;
  ext: string;
};

const JPEG_MIME = 'image/jpeg';
const PNG_MIME = 'image/png';

function extensionFromUri(uri: string): string {
  const path = uri.split('?')[0]?.toLowerCase() ?? '';
  const ext = path.split('.').pop();
  return ext ?? 'jpg';
}

/** Normalize iPhone HEIC/HEIF picks to JPEG before Supabase upload. */
export async function prepareProgressPhotoForUpload(uri: string): Promise<PreparedPhotoUpload> {
  const ext = extensionFromUri(uri);
  if (ext === 'jpg' || ext === 'jpeg') {
    return { uri, mimeType: JPEG_MIME, ext: 'jpg' };
  }
  if (ext === 'png') {
    return { uri, mimeType: PNG_MIME, ext: 'png' };
  }

  const converted = await ImageManipulator.manipulateAsync(uri, [], {
    compress: 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return { uri: converted.uri, mimeType: JPEG_MIME, ext: 'jpg' };
}
