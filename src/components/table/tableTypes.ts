// src/components/table/tableTypes.ts
// Generic column definition shared by all tables.

export type SortDirection = 'asc' | 'desc';

export type TableColumnDef<TRow> = {
  id: string;                 // 'full_name', 'phone', 'status' gibi
  label: string;              // Header'da görünen isim
  isDefaultVisible?: boolean; // İlk açılışta açık mı?
  sortable?: boolean;         // Bu kolona göre sıralanabilsin mi?
  // Tablo içi kullanım için (opsiyonel, sadece type yardımı)
  accessor?: (row: TRow) => unknown;
};
