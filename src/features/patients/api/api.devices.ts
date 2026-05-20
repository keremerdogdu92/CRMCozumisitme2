// src/features/patients/api/api.devices.ts
// Fetch helpers + React Query hook for inventory-backed patient devices.
// Lists inventory_items rows linked to a specific patient via sold_patient_id.
// Ayrıca NewPatientDeviceDraft kullanarak stoktaki cihazları hastaya bağlamak için
// attachDevicesToPatientFromDrafts yardımcı fonksiyonunu içerir.

import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '../../../utils/supabaseClient';
import type { PatientDeviceRow, NewPatientDeviceDraft } from '../types';

type PatientDeviceDbRow = Record<string, unknown>;

// React Query key for patient devices
export const PATIENT_DEVICES_BY_PATIENT_QUERY_KEY = (patientId: string) =>
  ['patient-devices', patientId] as const;

/**
 * Fetch devices from inventory_items for a given patient.
 * Filters by sold_patient_id = patientId.
 *
 * Note:
 * - ear_side is NULL in stock; it is set only after binding to a patient.
 * - We normalise ear_side so that only 'right' | 'left' | 'bilateral'
 *   are surfaced; anything else is treated as null.
 * - manufactured_at is not selected yet. When we add the column to
 *   inventory_items, we can extend the select + PatientDeviceRow.
 */
export async function fetchPatientDevicesByPatientId(
  patientId: string,
): Promise<PatientDeviceRow[]> {
  if (!patientId) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from('inventory_items')
    .select(
      `
      id,
      brand,
      model,
      item_type,
      ear_side,
      purchase_price,
      list_price,
      device_price,
      barcode,
      serial_no,
      sold_at
    `,
    )
    .eq('sold_patient_id', patientId)
    .order('sold_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error(
      'Supabase patient devices fetch error (fetchPatientDevicesByPatientId):',
      error,
    );
    throw error;
  }

  return ((data ?? []) as PatientDeviceDbRow[]).map((row): PatientDeviceRow => {
    const rawEar = (row.ear_side as string | null) ?? null;

    let ear_side: PatientDeviceRow['ear_side'] = null;
    if (rawEar === 'right' || rawEar === 'left' || rawEar === 'bilateral') {
      ear_side = rawEar as PatientDeviceRow['ear_side'];
    }
    // In stock state or legacy data, ear_side may be null or any other value – we keep it null.

    return {
      id: row.id as string,
      brand: row.brand as string,
      model: row.model as string,
      item_type: row.item_type as PatientDeviceRow['item_type'],
      ear_side,
      purchase_price:
        row.purchase_price === null ? null : Number(row.purchase_price),
      list_price: row.list_price === null ? null : Number(row.list_price),
      device_price:
        row.device_price === null ? null : Number(row.device_price),
      barcode: (row.barcode as string | null) ?? null,
      serial_no: (row.serial_no as string | null) ?? null,
      sold_at: (row.sold_at as string | null) ?? null,
    };
  });
}

/**
 * React Query hook to load devices for a given patient.
 * Safe to call anywhere; if patientId is falsy the query is disabled.
 */
export function usePatientDevices(patientId: string | null) {
  return useQuery({
    queryKey: patientId
      ? PATIENT_DEVICES_BY_PATIENT_QUERY_KEY(patientId)
      : ['patient-devices', 'none'],
    enabled: !!patientId,
    queryFn: () => fetchPatientDevicesByPatientId(patientId as string),
  });
}

/**
 * Attach inventory_items rows to a patient using NewPatientDeviceDraft[].
 *
 * Beklenen NewPatientDeviceDraft alanları:
 * - inventoryItemId: Bağlanacak stok satırının ID'si
 * - side: 'right' | 'left' | 'bilateral' (kulağa göre)
 *
 * İşleyiş:
 * - Sadece inventoryItemId dolu ve geçerli kulak yönü olan satırlar işlenir.
 * - Her satır için:
 *   - inventory_items.sold_patient_id = patientId
 *   - inventory_items.sold_at = now
 *   - inventory_items.ear_side = draft.side
 *   - inventory_items.status = 'sold'
 *
 * Notlar:
 * - Cihaz sayısı tipik olarak az olacağı için her satır ayrı UPDATE ile gider.
 *   İleride ihtiyaç olursa server-side RPC'ye taşınabilir.
 */
export async function attachDevicesToPatientFromDrafts(
  patientId: string,
  drafts: NewPatientDeviceDraft[] | undefined,
): Promise<void> {
  if (!patientId) {
    throw new Error('ATTACH_DEVICES_NO_PATIENT_ID');
  }
  if (!drafts || drafts.length === 0) {
    return;
  }

  // TypeScript uyumsuzluğunu tetikleyen '' karşılaştırmasını kaldırıyoruz.
  // Bunun yerine geçerli kulak yönünü net bir şekilde filtreliyoruz.
  const rowsToAttach = drafts.filter((d) => {
    if (!d.inventoryItemId) return false;

    return (
      d.side === 'right' ||
      d.side === 'left' ||
      d.side === 'bilateral'
    );
  });

  if (rowsToAttach.length === 0) {
    return;
  }

  const nowIso = new Date().toISOString();
  const errorMessages: string[] = [];

  for (const draft of rowsToAttach) {
    // rowsToAttach filtresinden geçtiği için side burada garanti olarak
    // 'right' | 'left' | 'bilateral' union'ında.
    const ear: 'right' | 'left' | 'bilateral' = draft.side as
      | 'right'
      | 'left'
      | 'bilateral';

    const { error } = await supabaseClient
      .from('inventory_items')
      .update({
        sold_patient_id: patientId,
        sold_at: nowIso,
        ear_side: ear,
        status: 'sold',
      })
      .eq('id', draft.inventoryItemId);

    if (error) {
      console.error(
        'attachDevicesToPatientFromDrafts update error:',
        error,
      );
      errorMessages.push(error.message);
    }
  }

  if (errorMessages.length > 0) {
    // Şimdilik ilk hatayı kullanıcıya gösteriyoruz; loglarda detay duruyor.
    throw new Error(
      'Cihazları hastaya bağlarken hata oluştu: ' + errorMessages[0],
    );
  }
}

/**
 * Update editable fields on an inventory_items row.
 * Used from PatientDetail → Cihazlar tab edit modal.
 */
export async function updateInventoryItem(
  itemId: string,
  fields: {
    barcode?: string | null;
    serial_no?: string | null;
    ear_side?: 'right' | 'left' | 'bilateral' | null;
    purchase_price?: number | null;
    list_price?: number | null;
    device_price?: number | null;
  },
): Promise<void> {
  const { error } = await supabaseClient
    .from('inventory_items')
    .update(fields)
    .eq('id', itemId);

  if (error) {
    console.error('updateInventoryItem error:', error);
    throw error;
  }
}

export type PatientInventoryItemAttachInput = {
  patientId: string;
  inventoryItemId: string;
  earSide: 'right' | 'left' | 'bilateral';
  soldAt?: string | null;
  devicePrice?: number | null;
};

export async function attachPatientInventoryItem(
  input: PatientInventoryItemAttachInput,
): Promise<void> {
  const { error } = await supabaseClient.rpc('attach_patient_inventory_item', {
    p_patient_id: input.patientId,
    p_inventory_item_id: input.inventoryItemId,
    p_ear_side: input.earSide,
    p_sold_at: input.soldAt ?? null,
    p_device_price: input.devicePrice ?? null,
  });

  if (error) {
    console.error('attachPatientInventoryItem RPC error:', error);
    throw new Error('Cihaz hastaya bağlanamadı: ' + error.message);
  }
}

export type PatientInventoryItemReplaceInput = PatientInventoryItemAttachInput & {
  oldInventoryItemId: string;
};

export async function replacePatientInventoryItem(
  input: PatientInventoryItemReplaceInput,
): Promise<void> {
  const { error } = await supabaseClient.rpc('replace_patient_inventory_item', {
    p_patient_id: input.patientId,
    p_old_inventory_item_id: input.oldInventoryItemId,
    p_new_inventory_item_id: input.inventoryItemId,
    p_ear_side: input.earSide,
    p_sold_at: input.soldAt ?? null,
    p_device_price: input.devicePrice ?? null,
  });

  if (error) {
    console.error('replacePatientInventoryItem RPC error:', error);
    throw new Error('Cihaz değiştirilemedi: ' + error.message);
  }
}
