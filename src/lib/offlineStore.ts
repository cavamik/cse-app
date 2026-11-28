import { get, set, update } from 'idb-keyval';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PendingSopralluogo } from '../types';

export const OFFLINE_KEYS = {
  CANTIERI: 'offline_cantieri',
  IMPRESE: 'offline_imprese',
  SOPRALLUOGHI: 'offline_sopralluoghi',
  IMPOSTAZIONI_STUDIO: 'offline_impostazioni_studio',
  PENDING_SOPRALLUOGHI: 'pending_sopralluoghi',
} as const;

/**
 * Verifica se una stringa è un UUID valido (standard RFC 4122)
 */
export function isUUID(str?: string | null): boolean {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
}

/**
 * Sanitizza un percorso di file per Supabase Storage:
 * - Rimuove slash iniziali e finali
 * - Sostituisce slash doppi o multipli
 * - Sostituisce caratteri non alfanumerici (tranne . _ / -) con underscore
 */
export function sanitizeStoragePath(rawPath: string): string {
  if (!rawPath || typeof rawPath !== 'string') return `sopralluoghi/${Date.now()}.webp`;
  const trimmed = rawPath.trim().replace(/^\/+|\/+$/g, '');
  const segments = trimmed.split('/');
  const sanitizedSegments = segments.map(seg => 
    seg.replace(/[^a-zA-Z0-9._-]/g, '_')
  );
  return sanitizedSegments.filter(Boolean).join('/');
}

/**
 * Estrae il percorso relativo di storage da un publicUrl di Supabase Storage
 */
export function extractStoragePath(url: string, bucketName = 'foto-sopralluoghi'): string | null {
  if (!url || typeof url !== 'string' || url.startsWith('blob:') || url.startsWith('data:')) {
    return null;
  }
  const marker = `/${bucketName}/`;
  const idx = url.indexOf(marker);
  if (idx !== -1) {
    return decodeURIComponent(url.substring(idx + marker.length));
  }
  return null;
}

export interface ImpostazioniStudioCache {
  id: string;
  logo_url?: string | null;
  timbro_url?: string | null;
  margin_top_mm?: number | null;
  margin_bottom_mm?: number | null;
  margin_lateral_mm?: number | null;
  foto_height_cm?: number | null;
  timbro_height_cm?: number | null;
  timbro_margin_mm?: number | null;
  spazio_dopo_logo_mm?: number | null;
  logo_secondario_url?: string | null;
  spazio_dopo_logo_secondario_mm?: number | null;
}

/**
 * 1. CACHE IN LETTURA LOCALE (IndexedDB)
 */

export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const data = await get<T>(key);
    return data ?? null;
  } catch (err) {
    console.warn(`[offlineStore] Errore lettura cache per "${key}":`, err);
    return null;
  }
}

export async function setCachedData<T>(key: string, data: T): Promise<void> {
  try {
    await set(key, data);
  } catch (err) {
    console.warn(`[offlineStore] Errore scrittura cache per "${key}":`, err);
  }
}

/**
 * 2. GESTIONE DELLA CODA PENDING DEI SOPRALLUOGHI
 */

export async function getPendingSopralluoghi(): Promise<PendingSopralluogo[]> {
  try {
    const list = await get<PendingSopralluogo[]>(OFFLINE_KEYS.PENDING_SOPRALLUOGHI);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn('[offlineStore] Errore lettura pending_sopralluoghi:', err);
    return [];
  }
}

export async function savePendingSopralluogo(item: PendingSopralluogo): Promise<void> {
  try {
    await update<PendingSopralluogo[]>(OFFLINE_KEYS.PENDING_SOPRALLUOGHI, (prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const index = list.findIndex(p => p.tempId === item.tempId);
      if (index >= 0) {
        list[index] = item;
        return [...list];
      }
      return [item, ...list];
    });
  } catch (err) {
    console.error('[offlineStore] Errore salvataggio pending_sopralluogo:', err);
    throw err;
  }
}

export async function removePendingSopralluogo(tempId: string): Promise<void> {
  try {
    await update<PendingSopralluogo[]>(OFFLINE_KEYS.PENDING_SOPRALLUOGHI, (prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return list.filter(p => p.tempId !== tempId);
    });
  } catch (err) {
    console.error(`[offlineStore] Errore rimozione pending_sopralluogo (${tempId}):`, err);
  }
}

export async function updatePendingStatus(
  tempId: string, 
  status: 'pending' | 'syncing' | 'error', 
  errorMessage?: string
): Promise<void> {
  try {
    await update<PendingSopralluogo[]>(OFFLINE_KEYS.PENDING_SOPRALLUOGHI, (prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return list.map(item => {
        if (item.tempId === tempId) {
          return {
            ...item,
            status,
            errorMessage: errorMessage || undefined,
            updatedAt: new Date().toISOString(),
          };
        }
        return item;
      });
    });
  } catch (err) {
    console.warn(`[offlineStore] Errore aggiornamento stato pending (${tempId}):`, err);
  }
}

/**
 * 3. MOTORE DI SINCRONIZZAZIONE ATOMICA
 */

let isSyncInProgress = false;

export async function syncPendingSopralluoghi(
  supabase: SupabaseClient,
  onItemSynced?: (tempId: string) => void
): Promise<{ success: number; failed: number }> {
  // Lock anti-concorrenza
  if (isSyncInProgress) {
    console.log('[offlineStore] Sincronizzazione già in corso, salto...');
    return { success: 0, failed: 0 };
  }

  // Verifica connettività
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { success: 0, failed: 0 };
  }

  const items = await getPendingSopralluoghi();
  if (items.length === 0) {
    return { success: 0, failed: 0 };
  }

  isSyncInProgress = true;
  let successCount = 0;
  let failedCount = 0;

  try {
    for (const item of items) {
      await updatePendingStatus(item.tempId, 'syncing');

      try {
        // Passo 1: Upload atomico delle fotografie
        // Mappa delle nuove URL generate per ciascun rilievo
        const uploadedUrlsByRilievo: Record<string, string[]> = {};

        let allPhotosUploaded = true;
        let photoErrorMsg = '';

        for (const foto of item.pendingFotos) {
          const cleanPath = sanitizeStoragePath(foto.path);
          const isWebp = cleanPath.toLowerCase().endsWith('.webp');
          const mimeType = isWebp ? 'image/webp' : 'image/jpeg';
          
          // Assicura che fileBody sia un Blob valido con il mime type appropriato (WebP o JPEG)
          let fileBody: Blob;
          if (foto.fileBlob instanceof Blob) {
            fileBody = new Blob([foto.fileBlob], { type: mimeType });
          } else if ((foto.fileBlob as any) instanceof ArrayBuffer || ArrayBuffer.isView(foto.fileBlob as any)) {
            fileBody = new Blob([foto.fileBlob as any], { type: mimeType });
          } else if (typeof foto.fileBlob === 'object' && foto.fileBlob !== null) {
            fileBody = new Blob([foto.fileBlob as any], { type: mimeType });
          } else {
            fileBody = new Blob([], { type: mimeType });
          }

          console.log('[offlineStore] Tentativo upload foto:', {
            bucket: 'foto-sopralluoghi',
            originalPath: foto.path,
            sanitizedPath: cleanPath,
            fileName: foto.fileName,
            rilievoId: foto.rilievoId,
            sizeBytes: fileBody.size,
            mimeType: fileBody.type,
          });

          const { error: uploadError } = await supabase.storage
            .from('foto-sopralluoghi')
            .upload(cleanPath, fileBody, {
              contentType: mimeType,
              upsert: true,
            });

          if (uploadError) {
            allPhotosUploaded = false;
            const statusCode = (uploadError as any).statusCode || (uploadError as any).status || 400;
            photoErrorMsg = `Upload foto fallito (${foto.fileName}): ${uploadError.message} (HTTP ${statusCode})`;

            console.error('[offlineStore] ERRORE HTTP UPLOAD FOTO:', {
              message: uploadError.message,
              statusCode,
              rawError: uploadError,
              bucket: 'foto-sopralluoghi',
              path: cleanPath,
              fileDetails: {
                name: foto.fileName,
                size: fileBody.size,
                type: fileBody.type,
              }
            });
            break;
          }

          const { data: urlData } = supabase.storage
            .from('foto-sopralluoghi')
            .getPublicUrl(cleanPath);

          if (!urlData?.publicUrl) {
            allPhotosUploaded = false;
            photoErrorMsg = `Recupero publicUrl fallito per ${foto.fileName}`;
            console.error('[offlineStore] Impossibile ottenere publicUrl per:', cleanPath);
            break;
          }

          console.log('[offlineStore] Foto caricata con successo:', urlData.publicUrl);

          if (!uploadedUrlsByRilievo[foto.rilievoId]) {
            uploadedUrlsByRilievo[foto.rilievoId] = [];
          }
          uploadedUrlsByRilievo[foto.rilievoId].push(urlData.publicUrl);
        }

        if (!allPhotosUploaded) {
          throw new Error(photoErrorMsg || 'Upload immagini non completato');
        }

        // Passo 2: Aggiornamento payload con le URL definitive delle immagini caricate
        const updatedPayload = { ...item.payload };
        if (Array.isArray(updatedPayload.rilievi)) {
          updatedPayload.rilievi = updatedPayload.rilievi.map((r: any) => {
            const newlyUploaded = uploadedUrlsByRilievo[r.id] || [];
            // Filtriamo via eventuali blob URL locali temporanei
            const existingCloudUrls = (r.foto_urls || []).filter((u: string) => !u.startsWith('blob:'));
            return {
              ...r,
              foto_urls: [...existingCloudUrls, ...newlyUploaded],
            };
          });
        }

        // Rimuoviamo campi fittizi e metadati offline prima dell'insert/update su Supabase
        delete (updatedPayload as any).is_pending;
        delete (updatedPayload as any).pending_status;
        delete (updatedPayload as any).pending_error;
        delete (updatedPayload as any).temp_id;
        delete (updatedPayload as any).tempId;
        delete (updatedPayload as any).status;
        delete (updatedPayload as any).errorMessage;
        delete (updatedPayload as any).createdAt;
        delete (updatedPayload as any).updatedAt;

        // Garanzia presenza tipo_verbale (default 'CSE' se non impostato)
        if (!updatedPayload.tipo_verbale) {
          updatedPayload.tipo_verbale = 'CSE';
        }

        // Passo 3: Upsert atomico del record nel database
        // Un record è un aggiornamento cloud solo se il sopralluogoId è un vero UUID valido.
        // Se inizia con 'pending_' o non è un UUID, si tratta di un nuovo verbale da inserire.
        const isExistingCloudRecord = isUUID(item.sopralluogoId);

        console.log('[offlineStore] Inserimento/aggiornamento database sopralluogo:', {
          isUpdate: isExistingCloudRecord,
          sopralluogoIdOriginale: item.sopralluogoId,
          tipo_verbale: updatedPayload.tipo_verbale,
        });

        if (isExistingCloudRecord && item.sopralluogoId) {
          console.log('[offlineStore] Esecuzione UPDATE record:', item.sopralluogoId);
          const { error: dbError } = await supabase
            .from('sopralluoghi')
            .update(updatedPayload)
            .eq('id', item.sopralluogoId);

          if (dbError) {
            console.error('[offlineStore] Errore DB update:', {
              message: dbError.message,
              details: dbError.details,
              hint: dbError.hint,
              code: dbError.code,
            });
            throw dbError;
          }
        } else {
          // Record nuovo (o creato offline): rimuoviamo id per consentire a PostgreSQL
          // di generare un UUID valido e univoco
          delete (updatedPayload as any).id;

          console.log('[offlineStore] Esecuzione INSERT nuovo record:', {
            tipo_verbale: updatedPayload.tipo_verbale,
            cantiere_id: updatedPayload.cantiere_id,
          });
          const { error: dbError } = await supabase
            .from('sopralluoghi')
            .insert([updatedPayload]);

          if (dbError) {
            console.error('[offlineStore] Errore DB insert:', {
              message: dbError.message,
              details: dbError.details,
              hint: dbError.hint,
              code: dbError.code,
            });
            throw dbError;
          }
        }

        // Passo 4: Successo! Rimuoviamo l'elemento dalla coda
        await removePendingSopralluogo(item.tempId);
        successCount++;
        onItemSynced?.(item.tempId);

      } catch (err: any) {
        failedCount++;
        const msg = err?.message || (typeof err === 'string' ? err : 'Errore sconosciuto durante la sincronizzazione');
        const details = err?.details ? ` (${err.details})` : '';
        const fullMsg = `${msg}${details}`;
        console.error(`[offlineStore] Errore sincronizzazione elemento ${item.tempId}:`, {
          message: err?.message,
          details: err?.details,
          hint: err?.hint,
          code: err?.code,
          fullError: err,
        });
        await updatePendingStatus(item.tempId, 'error', fullMsg);
      }
    }
  } finally {
    isSyncInProgress = false;
  }

  return { success: successCount, failed: failedCount };
}
