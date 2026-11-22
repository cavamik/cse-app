import type { Cantiere, Impresa, Sopralluogo } from '../types';
import { supabase } from '../lib/supabaseClient';
import { getCachedData, setCachedData, OFFLINE_KEYS } from '../lib/offlineStore';

/**
 * Valida un indirizzo email (opzionale: se vuoto è valido).
 */
export const isValidEmail = (email?: string | null): boolean => {
  if (!email || !email.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

/**
 * Restituisce le imprese associate a un cantiere specifico.
 * Criteri di associazione:
 * 1. Presenza di impresa.id in cantiere.imprese_ids (se valorizzato).
 * 2. Campo legacy impresa.cantiere_id === cantiere.id.
 * 3. Retrocompatibilità: se cantiere.imprese_ids non è definito o vuoto,
 *    include automaticamente le imprese che compaiono nei verbali storici di quel cantiere.
 */
export const getImpreseDelCantiere = (
  cantiere: Cantiere | undefined | null,
  tutteLeImprese: Impresa[] = [],
  sopralluoghi: Sopralluogo[] = []
): Impresa[] => {
  if (!cantiere) return [];

  const explicitIds = Array.isArray(cantiere.imprese_ids) ? cantiere.imprese_ids : [];
  const explicitIdsSet = new Set<string>(explicitIds);

  const sopralluoghiDelCantiere = sopralluoghi.filter(s => s.cantiere_id === cantiere.id);

  return tutteLeImprese.filter(imp => {
    // 1. Assegnazione esplicita tramite imprese_ids
    if (explicitIdsSet.has(imp.id)) return true;

    // 2. Campo legacy cantiere_id
    if (imp.cantiere_id === cantiere.id) return true;

    // 3. Retrocompatibilità: se il cantiere non ha ancora imprese_ids configurato
    if (explicitIds.length === 0) {
      const nomeLower = (imp.ragione_sociale || '').trim().toLowerCase();
      if (!nomeLower) return false;

      const presenteInStorico = sopralluoghiDelCantiere.some(s =>
        s.imprese_presenti?.some(n => n.toLowerCase().includes(nomeLower)) ||
        s.imprese_dettaglio?.some(d => d.nome.toLowerCase() === nomeLower) ||
        s.fasi_lavoro?.some(f => (f.impresa || '').toLowerCase() === nomeLower)
      );
      return presenteInStorico;
    }

    return false;
  });
};

/**
 * Associa un'impresa a un cantiere aggiornando imprese_ids su Supabase e sulla cache locale.
 */
export const associaImpresaACantiere = async (
  cantiere: Cantiere,
  impresaId: string,
  tutteLeImprese: Impresa[] = [],
  sopralluoghi: Sopralluogo[] = []
): Promise<string[]> => {
  const attuali = getImpreseDelCantiere(cantiere, tutteLeImprese, sopralluoghi);
  const updatedIds = Array.from(new Set([...attuali.map(i => i.id), impresaId]));

  // 1. Aggiorna Supabase se online
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const { error } = await supabase
        .from('cantieri')
        .update({ imprese_ids: updatedIds })
        .eq('id', cantiere.id);

      if (error) console.warn('[cantiereImprese] Errore update cantiere su cloud:', error);
    } catch (e) {
      console.warn('[cantiereImprese] Eccezione update cantiere su cloud:', e);
    }
  }

  // 2. Aggiorna cache locale cantieri
  try {
    const cached = await getCachedData<Cantiere[]>(OFFLINE_KEYS.CANTIERI);
    if (cached) {
      const updatedCache = cached.map(c => c.id === cantiere.id ? { ...c, imprese_ids: updatedIds } : c);
      await setCachedData(OFFLINE_KEYS.CANTIERI, updatedCache);
    }
  } catch (e) {
    console.warn('[cantiereImprese] Errore aggiornamento cache cantieri:', e);
  }

  return updatedIds;
};

/**
 * Scollega un'impresa da un cantiere aggiornando imprese_ids su Supabase e cache locale.
 * Se l'impresa aveva legacy cantiere_id uguale al cantiere, lo azzera a null.
 */
export const scollegaImpresaDaCantiere = async (
  cantiere: Cantiere,
  impresaId: string,
  tutteLeImprese: Impresa[] = [],
  sopralluoghi: Sopralluogo[] = []
): Promise<string[]> => {
  const attuali = getImpreseDelCantiere(cantiere, tutteLeImprese, sopralluoghi);
  const remainingIds = attuali.map(i => i.id).filter(id => id !== impresaId);

  // 1. Aggiorna Supabase se online
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const { error: cErr } = await supabase
        .from('cantieri')
        .update({ imprese_ids: remainingIds })
        .eq('id', cantiere.id);

      if (cErr) console.warn('[cantiereImprese] Errore rimozione impresa dal cantiere:', cErr);

      // Se l'impresa aveva cantiere_id impostato a questo cantiere, resettalo
      const imp = tutteLeImprese.find(i => i.id === impresaId);
      if (imp && imp.cantiere_id === cantiere.id) {
        await supabase
          .from('imprese')
          .update({ cantiere_id: null })
          .eq('id', impresaId);
      }
    } catch (e) {
      console.warn('[cantiereImprese] Eccezione rimozione impresa dal cantiere:', e);
    }
  }

  // 2. Aggiorna cache locale cantieri
  try {
    const cachedCantieri = await getCachedData<Cantiere[]>(OFFLINE_KEYS.CANTIERI);
    if (cachedCantieri) {
      const updatedCache = cachedCantieri.map(c => c.id === cantiere.id ? { ...c, imprese_ids: remainingIds } : c);
      await setCachedData(OFFLINE_KEYS.CANTIERI, updatedCache);
    }

    const cachedImprese = await getCachedData<Impresa[]>(OFFLINE_KEYS.IMPRESE);
    if (cachedImprese) {
      const updatedImprese = cachedImprese.map(i => i.id === impresaId && i.cantiere_id === cantiere.id ? { ...i, cantiere_id: undefined } : i);
      await setCachedData(OFFLINE_KEYS.IMPRESE, updatedImprese);
    }
  } catch (e) {
    console.warn('[cantiereImprese] Errore aggiornamento cache cantieri/imprese:', e);
  }

  return remainingIds;
};
