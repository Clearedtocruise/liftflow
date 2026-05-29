import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { api } from '@/api/client';
import { fail, fromError, ok } from '@/lib/serviceResult';
import type { IExportService } from '@/services/interfaces';
import { getAccessToken, supabase } from '@/supabase/client';
import type { ExportRequest } from '@/types';

export const exportService: IExportService = {
  async exportContent(userId, request: ExportRequest) {
    try {
      const token = await getAccessToken();
      const doc = await api.exportDocument({ ...request, userId }, token);

      const { data, error } = await supabase
        .from('exported_documents')
        .insert({
          user_id: userId,
          content_type: request.contentType,
          format: request.format,
          title: doc.title ?? request.title,
          file_url: doc.fileUrl,
          file_size_bytes: doc.fileSizeBytes,
          source_entity_id: request.sourceEntityId,
          is_printer_friendly: true,
        })
        .select('*')
        .single();

      if (error) return fail(error.message);

      return ok({
        id: data.id,
        userId: data.user_id,
        contentType: data.content_type,
        format: data.format,
        title: data.title,
        fileUrl: data.file_url ?? undefined,
        fileSizeBytes: data.file_size_bytes ?? undefined,
        sourceEntityType: data.source_entity_type ?? undefined,
        sourceEntityId: data.source_entity_id ?? undefined,
        isPrinterFriendly: data.is_printer_friendly,
        privacyLevel: data.privacy_level,
        expiresAt: data.expires_at ?? undefined,
        createdAt: data.created_at,
      });
    } catch (e) {
      return fromError(e);
    }
  },

  async getDocuments(userId) {
    try {
      const { data, error } = await supabase
        .from('exported_documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) return fail(error.message);

      return ok(
        (data ?? []).map((row) => ({
          id: row.id,
          userId: row.user_id,
          contentType: row.content_type,
          format: row.format,
          title: row.title,
          fileUrl: row.file_url ?? undefined,
          fileSizeBytes: row.file_size_bytes ?? undefined,
          isPrinterFriendly: row.is_printer_friendly,
          privacyLevel: row.privacy_level,
          createdAt: row.created_at,
        })),
      );
    } catch (e) {
      return fromError(e);
    }
  },

  async createShareLink(userId, request) {
    try {
      const token = await getAccessToken();
      return ok(await api.createShareLink(request, token));
    } catch (e) {
      return fromError(e);
    }
  },

  async generatePrintView(documentId) {
    try {
      const { data, error } = await supabase.from('exported_documents').select('*').eq('id', documentId).single();
      if (error || !data?.file_url) return fail('Document not found');

      const response = await fetch(data.file_url);
      const html = await response.text();
      return ok(html);
    } catch (e) {
      return fromError(e);
    }
  },

  async generatePdf(userId, request: ExportRequest) {
    try {
      const token = await getAccessToken();
      const doc = await api.generatePdf({ ...request, userId }, token);

      const { data, error } = await supabase
        .from('exported_documents')
        .insert({
          user_id: userId,
          content_type: request.contentType,
          format: 'pdf',
          title: doc.title ?? request.title,
          file_url: doc.fileUrl,
          file_size_bytes: doc.fileSizeBytes,
        })
        .select('*')
        .single();

      if (error) return fail(error.message);

      return ok({
        id: data.id,
        userId: data.user_id,
        contentType: data.content_type,
        format: data.format,
        title: data.title,
        fileUrl: data.file_url ?? undefined,
        fileSizeBytes: data.file_size_bytes ?? undefined,
        isPrinterFriendly: data.is_printer_friendly,
        privacyLevel: data.privacy_level,
        createdAt: data.created_at,
      });
    } catch (e) {
      return fromError(e);
    }
  },

  async downloadAndShare(userId: string, request: ExportRequest) {
    const result = await this.generatePdf(userId, request);
    if (!result.success || !result.data.fileUrl) return result;

    const localPath = `${FileSystem.cacheDirectory}${result.data.title.replace(/\s+/g, '_')}.pdf`;
    const download = await FileSystem.downloadAsync(result.data.fileUrl, localPath);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(download.uri);
    }

    return result;
  },
};