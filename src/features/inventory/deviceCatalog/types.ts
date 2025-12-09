// src/features/inventory/deviceCatalog/types.ts
// Summary: Shared types for device catalog CSV import (models + price rows).

export type DeviceCatalogImportSummary = {
  /** Toplam CSV satır sayısı (header hariç). */
  totalRows: number;
  /** Başarılı işlenen satırlar (fiyat satırı eklenmiş). */
  successCount: number;
  /** Yeni oluşturulan cihaz model sayısı. */
  createdModelCount: number;
  /** Var olan modele eklenen fiyat satırı sayısı. */
  updatedModelCount: number;
  /** Hata nedeniyle atlanan satır sayısı. */
  errorCount: number;
};
