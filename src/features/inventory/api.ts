// src/features/inventory/api.ts
// Supabase API helpers and React Query hooks for the Inventory feature.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '../../utils/supabaseClient';
import type {
  InventoryItemRow,
  InventoryStatus,
  InventoryItemType,
  NewInventoryItemForm,
  InventoryImportSummary,
} from './types';

export const INVENTORY_QUERY_KEY = ['inventory-items'] as const;

// Internal helper to parse price strings
function parsePriceOrNull(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\s/g, '').replace(',', '.');
  const v = Number(normalized);
  if (!Number.isFinite(v) || v < 0) {
    throw new Error('Fiyat alanları için geçerli (0 veya üzeri) bir sayı girin.');
  }
  return Number(v.toFixed(2));
}

/**
 * Fetch inventory items for current org.
 * Also resolves sold_patient_name from patients table (if sold_patient_id is set).
 */
export async function fetchInventoryItems(): Promise<InventoryItemRow[]> {
  const { data, error } = await supabaseClient
    .from('inventory_items')
    .select(
      `
      id,
      org_id,
      brand,
      model,
      item_type,
      barcode,
      serial_no,
      ear_side,
      status,
      purchase_price,
      list_price,
      sold_patient_id,
      sold_at,
      created_at,
      updated_at
    `,
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase inventory fetch error:', error);
    throw error;
  }

  const baseRows = (data ?? []).map((row: any): InventoryItemRow => ({
    id: row.id as string,
    org_id: row.org_id as string,
    brand: row.brand as string,
    model: row.model as string,
    item_type: row.item_type as InventoryItemType,
    barcode: (row.barcode as string | null) ?? null,
    serial_no: (row.serial_no as string | null) ?? null,
    // ear_side can be null in DB
    ear_side: (row.ear_side as InventoryItemRow['ear_side']) ?? null,
    status: row.status as InventoryStatus,
    purchase_price: row.purchase_price === null ? null : Number(row.purchase_price),
    list_price: row.list_price === null ? null : Number(row.list_price),
    sold_patient_id: (row.sold_patient_id as string | null) ?? null,
    sold_at: (row.sold_at as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    sold_patient_name: null,
  }));

  // Resolve patient names for sold items (best-effort; UI çalışsın yeter)
  const soldIds = Array.from(
    new Set(
      baseRows
        .map((r) => r.sold_patient_id)
        .filter((id): id is string => !!id),
    ),
  );

  if (soldIds.length > 0) {
    const { data: patients, error: patientsError } = await supabaseClient
      .from('patients')
      .select('id, full_name')
      .in('id', soldIds);

    if (patientsError) {
      console.error('Supabase inventory patient lookup error:', patientsError);
      // Hata olursa sadece isimleri boş bırakıyoruz, liste yine de çalışsın.
      return baseRows;
    }

    const nameMap = new Map<string, string>();
    (patients ?? []).forEach((p: any) => {
      if (p.id && p.full_name) {
        nameMap.set(p.id as string, p.full_name as string);
      }
    });

    baseRows.forEach((row) => {
      if (row.sold_patient_id) {
        row.sold_patient_name = nameMap.get(row.sold_patient_id) ?? null;
      }
    });
  }

  return baseRows;
}

/**
 * Create a new inventory item using NewInventoryItemForm.
 */
export async function createInventoryItem(input: NewInventoryItemForm): Promise<void> {
  const { brand, model, itemType, earSide, barcode, serialNo, purchasePrice, listPrice } =
    input;

  if (!brand.trim()) {
    throw new Error('Marka alanı boş bırakılamaz.');
  }
  if (!model.trim()) {
    throw new Error('Model alanı boş bırakılamaz.');
  }

  const purchase_price = parsePriceOrNull(purchasePrice);
  const list_price = parsePriceOrNull(listPrice);

  // Current user → org_id
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError) {
    console.error('Failed to get current user for inventory insert:', userError);
    throw new Error('INVENTORY_USER: ' + userError.message);
  }
  const user = userData.user;
  if (!user) {
    throw new Error('INVENTORY_USER: Kullanıcı oturumu bulunamadı.');
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('id, org_id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Failed to load profile for inventory insert:', profileError);
    throw new Error('INVENTORY_PROFILE: ' + profileError.message);
  }

  if (!profile?.org_id) {
    throw new Error('INVENTORY_NO_ORG: Profilde org_id bulunamadı.');
  }

  // Formdaki earSide → DB ear_side (charger ve "none" için NULL yazıyoruz)
  const ear_side_db =
    itemType === 'charger'
      ? null
      : earSide === 'none'
      ? null
      : earSide; // right | left | bilateral

  const { error: insertError } = await supabaseClient.from('inventory_items').insert({
    org_id: profile.org_id,
    brand: brand.trim(),
    model: model.trim(),
    item_type: itemType,
    ear_side: ear_side_db,
    barcode: barcode.trim() || null,
    serial_no: serialNo.trim() || null,
    purchase_price,
    list_price,
    status: 'in_stock',
  });

  if (insertError) {
    console.error('Failed to insert inventory item:', insertError);
    throw new Error('INVENTORY_INSERT: ' + insertError.message);
  }
}

/**
 * Simple CSV parser that accepts "," or ";" as delimiter.
 */
function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headerLine = lines[0];
  const commaCount = (headerLine.match(/,/g) ?? []).length;
  const semiCount = (headerLine.match(/;/g) ?? []).length;
  const delimiter = semiCount > commaCount ? ';' : ',';

  const headers = headerLine
    .split(delimiter)
    .map((h) => h.trim().toLowerCase());

  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = line.split(delimiter).map((c) => c.trim());
    if (cols.every((c) => !c)) continue;
    rows.push(cols);
  }

  return { headers, rows };
}

type CsvRowObj = {
  [key: string]: string;
};

/**
 * Normalize item_type from CSV.
 */
function normalizeItemType(raw: string): InventoryItemType {
  const v = raw.trim().toLowerCase();
  if (!v) return 'hearing_aid';
  if (v === 'hearing_aid' || v === 'cihaz') return 'hearing_aid';
  if (v === 'charger' || v === 'aksesuar' || v === 'sarg' || v === 'şarj') {
    return 'charger';
  }
  throw new Error('item_type değeri "hearing_aid" veya "charger" olmalıdır.');
}

/**
 * Normalize status from CSV.
 */
function normalizeStatus(raw: string): InventoryStatus {
  const v = raw.trim().toLowerCase();
  if (!v || v === 'stok' || v === 'stock' || v === 'in_stock') return 'in_stock';
  if (v === 'sold' || v === 'satildi' || v === 'satıldı') return 'sold';
  if (v === 'repair' || v === 'tamirde') return 'repair';
  throw new Error('status değeri "in_stock", "sold" veya "repair" olmalıdır.');
}

/**
 * Normalize ear_side from CSV.
 * Returns 'right' | 'left' | 'bilateral' | null.
 */
function normalizeEarSide(raw: string): InventoryItemRow['ear_side'] {
  const v = raw.trim().toLowerCase().replace(/\s+/g, '');
  if (!v) return null;
  if (v === 'right' || v === 'sag' || v === 'sağ') return 'right';
  if (v === 'left' || v === 'sol') return 'left';
  if (v === 'bilateral' || v === 'cift' || v === 'çift' || v === 'both') {
    return 'bilateral';
  }
  throw new Error(
    'ear_side değeri "right", "left" veya "bilateral" (veya karşılığı Türkçe) olmalıdır.',
  );
}

/**
 * Import inventory from a CSV file.
 * - Creates an import_jobs row.
 * - Stores every CSV row in inventory_import_rows with validation info.
 * - Inserts valid rows into inventory_items.
 */
export async function importInventoryFromCsv(
  file: File,
): Promise<InventoryImportSummary> {
  const text = await file.text();
  const { headers, rows } = parseCsv(text);

  if (headers.length === 0 || rows.length === 0) {
    throw new Error('CSV dosyası boş görünüyor.');
  }

  // Build row objects with header → value mapping
  const headerKeys = headers.map((h) => h.replace(/\s+/g, '_'));
  const csvObjects: CsvRowObj[] = rows.map((cols) => {
    const obj: CsvRowObj = {};
    headerKeys.forEach((key, idx) => {
      obj[key] = cols[idx] ?? '';
    });
    return obj;
  });

  // Require at least brand + model columns
  if (!headerKeys.includes('brand') || !headerKeys.includes('model')) {
    throw new Error(
      'CSV başlık satırında en az "brand" ve "model" kolonları bulunmalıdır.',
    );
  }

  // Current user & org
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError) {
    console.error('Failed to get current user for inventory import:', userError);
    throw new Error('IMPORT_USER: ' + userError.message);
  }
  const user = userData.user;
  if (!user) {
    throw new Error('IMPORT_USER: Kullanıcı oturumu bulunamadı.');
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('id, org_id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Failed to load profile for inventory import:', profileError);
    throw new Error('IMPORT_PROFILE: ' + profileError.message);
  }

  if (!profile?.org_id) {
    throw new Error('IMPORT_NO_ORG: Profilde org_id bulunamadı.');
  }

  const orgId: string = profile.org_id as string;
  const createdBy: string = profile.id as string;

  const totalRows = csvObjects.length;
  let importedCount = 0;
  let errorCount = 0;

  type ImportRowPayload = {
    job_id: string;
    row_index: number;
    raw_brand: string | null;
    raw_model: string | null;
    raw_item_type: string | null;
    raw_barcode: string | null;
    raw_serial_no: string | null;
    raw_ear_side: string | null;
    raw_status: string | null;
    raw_purchase_price: string | null;
    raw_list_price: string | null;
    raw_notes: string | null;
    valid: boolean;
    validation_error: string | null;
  };

  const importRowsPayload: ImportRowPayload[] = [];
  const inventoryItemsPayload: any[] = [];

  // 1) Create import_jobs row (status = processing)
  const { data: jobData, error: jobError } = await supabaseClient
    .from('import_jobs')
    .insert({
      org_id: orgId,
      target_entity: 'inventory',
      status: 'processing',
      source_filename: file.name,
      row_count: totalRows,
      error_count: 0,
      created_by: createdBy,
    })
    .select('id')
    .single();

  if (jobError || !jobData?.id) {
    console.error('Failed to create import_jobs row:', jobError);
    throw new Error('IMPORT_JOB: ' + (jobError?.message ?? 'job oluşturulamadı.'));
  }

  const jobId: string = jobData.id as string;

  // 2) Per-row validation + payload build
  csvObjects.forEach((row, idx) => {
    const rowIndex = idx + 2; // 1 = header, o yüzden 2'den başlatıyoruz
    const rawBrand = (row['brand'] ?? '').trim();
    const rawModel = (row['model'] ?? '').trim();
    const rawItemType = (row['item_type'] ?? '').trim();
    const rawBarcode = (row['barcode'] ?? '').trim();
    const rawSerialNo = (row['serial_no'] ?? '').trim();
    const rawEarSide = (row['ear_side'] ?? '').trim();
    const rawStatus = (row['status'] ?? '').trim();
    const rawPurchasePrice = (row['purchase_price'] ?? '').trim();
    const rawListPrice = (row['list_price'] ?? '').trim();
    const rawNotes = (row['notes'] ?? '').trim();

    let valid = true;
    let validationError: string | null = null;

    if (!rawBrand) {
      valid = false;
      validationError = 'Marka (brand) alanı boş olamaz.';
    } else if (!rawModel) {
      valid = false;
      validationError = 'Model (model) alanı boş olamaz.';
    }

    let itemType: InventoryItemType = 'hearing_aid';
    let status: InventoryStatus = 'in_stock';
    let earSideDb: InventoryItemRow['ear_side'] = null;
    let purchasePrice: number | null = null;
    let listPrice: number | null = null;

    if (valid) {
      try {
        itemType = normalizeItemType(rawItemType);
      } catch (e) {
        valid = false;
        validationError = (e as Error).message;
      }
    }

    if (valid) {
      try {
        status = normalizeStatus(rawStatus);
      } catch (e) {
        valid = false;
        validationError = (e as Error).message;
      }
    }

    if (valid && rawEarSide) {
      try {
        earSideDb = normalizeEarSide(rawEarSide);
      } catch (e) {
        valid = false;
        validationError = (e as Error).message;
      }
    }

    if (valid && rawPurchasePrice) {
      try {
        purchasePrice = parsePriceOrNull(rawPurchasePrice);
      } catch (e) {
        valid = false;
        validationError = (e as Error).message;
      }
    }

    if (valid && rawListPrice) {
      try {
        listPrice = parsePriceOrNull(rawListPrice);
      } catch (e) {
        valid = false;
        validationError = (e as Error).message;
      }
    }

    importRowsPayload.push({
      job_id: jobId,
      row_index: rowIndex,
      raw_brand: rawBrand || null,
      raw_model: rawModel || null,
      raw_item_type: rawItemType || null,
      raw_barcode: rawBarcode || null,
      raw_serial_no: rawSerialNo || null,
      raw_ear_side: rawEarSide || null,
      raw_status: rawStatus || null,
      raw_purchase_price: rawPurchasePrice || null,
      raw_list_price: rawListPrice || null,
      raw_notes: rawNotes || null,
      valid,
      validation_error: validationError,
    });

    if (valid) {
      importedCount += 1;

      // Ear side verisini şimdilik sadece satılan cihazlar için zorunlu kabul etmiyoruz;
      // varsa yazıyoruz, yoksa NULL.
      const ear_side = itemType === 'charger' ? null : earSideDb;

      inventoryItemsPayload.push({
        org_id: orgId,
        brand: rawBrand,
        model: rawModel,
        item_type: itemType,
        barcode: rawBarcode || null,
        serial_no: rawSerialNo || null,
        ear_side,
        status,
        purchase_price: purchasePrice,
        list_price: listPrice,
        // satış bilgisi bu import'ta gelmiyor; ileride hasta akışıyla bağlanacak
        sold_patient_id: null,
        sold_at: null,
      });
    } else {
      errorCount += 1;
    }
  });

  try {
    // 3) inventory_import_rows insert
    if (importRowsPayload.length > 0) {
      const { error: rowsError } = await supabaseClient
        .from('inventory_import_rows')
        .insert(importRowsPayload);

      if (rowsError) {
        console.error('Failed to insert inventory_import_rows:', rowsError);
        throw new Error('IMPORT_ROWS: ' + rowsError.message);
      }
    }

    // 4) valid satırlar için inventory_items insert
    if (inventoryItemsPayload.length > 0) {
      const { error: itemsError } = await supabaseClient
        .from('inventory_items')
        .insert(inventoryItemsPayload);

      if (itemsError) {
        console.error('Failed to insert inventory_items from import:', itemsError);
        throw new Error('IMPORT_ITEMS: ' + itemsError.message);
      }
    }

    // 5) job güncelle
    const { error: updateError } = await supabaseClient
      .from('import_jobs')
      .update({
        status: 'completed',
        row_count: totalRows,
        error_count: errorCount,
        finished_at: new Date().toISOString(),
        error_message:
          errorCount > 0
            ? 'Bazı satırlar hatalı; detay için inventory_import_rows tablosuna bakın.'
            : null,
      })
      .eq('id', jobId);

    if (updateError) {
      console.error('Failed to update import_jobs after completion:', updateError);
      // burada hatayı yukarı fırlatmak yerine sadece logluyoruz; import zaten yapılmış durumda
    }
  } catch (err) {
    // Job'u failed işaretle
    await supabaseClient
      .from('import_jobs')
      .update({
        status: 'failed',
        row_count: totalRows,
        error_count: errorCount,
        finished_at: new Date().toISOString(),
        error_message: (err as Error).message,
      })
      .eq('id', jobId);

    throw err;
  }

  return {
    jobId,
    totalRows,
    importedCount,
    errorCount,
  };
}

/**
 * React Query hooks
 */

export function useInventoryItems() {
  return useQuery({
    queryKey: INVENTORY_QUERY_KEY,
    queryFn: fetchInventoryItems,
  });
}

export function useCreateInventoryItemMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createInventoryItem,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEY });
    },
  });
}

/**
 * Mutation wrapper for CSV import.
 */
export function useInventoryCsvImportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: importInventoryFromCsv,
    onSuccess: () => {
      // Import sonrası stok listesini tazeleyelim
      void queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEY });
    },
  });
}
