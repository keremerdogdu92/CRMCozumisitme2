-- db/schema/inventory/inventory_items.sql
-- Purpose: Supabase table definition for `inventory_items`.
-- Includes: CREATE TABLE, constraints, indexes and RLS policies for inventory stock items.
-- Source of truth: Supabase table editor / migrations.
--
-- Deletion model: this table supports *soft delete* via `deleted_at`.
-- Hard DELETE için henüz RLS policy yok; PROD öncesi net karar ver.
--
-- [TODO-SECURITY-BEFORE-PROD]
--   1) Confirm that org isolation for inventory uses *profiles.org_id* consistently.
--      - Patients tarafında JWT org_id + user_metadata.org_id da kullanılıyor.
--      - Burada ise yalnızca profiles.org_id ile kontrol yapıyoruz.
--      Karar ver:
--        * Tüm sistem profiles.org_id mi kullanacak?
--        * Yoksa JWT claim'ine mi standardize edeceğiz?
--   2) Decide whether service_role should bypass RLS for this table.
--      - Şu an policies, service_role için özel bir istisna içermiyor.
--      - Eğer backend/cron işleri tüm org'ların stoklarını görmeli ise
--        auth.role() = 'service_role' için ayrı bir policy ekle.
--   3) Evaluate if DELETE operations are needed.
--      - Şu an sadece SELECT, INSERT, UPDATE için policy var.
--      - Eğer hard delete yapacaksan, DELETE için de org bazlı bir policy ekle
--        veya tamamen yasakla.
--   4) Re-run regression tests for:
--      - Single-org usage (stok CRUD)
--      - Multi-org izolasyonu (org A stokları org B tarafından görünmesin)
--      - Import jobs + inventory_import_rows ile birlikte çalışması.

CREATE TABLE public.inventory_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  brand text NOT NULL,
  model text NOT NULL,
  item_type text NOT NULL,
  barcode text NULL,
  serial_no text NULL,
  ear_side text NULL,
  status text NOT NULL DEFAULT 'in_stock'::text,
  purchase_price numeric(12, 2) NULL,
  list_price numeric(12, 2) NULL,
  sold_patient_id uuid NULL,
  sold_at timestamp with time zone NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone NULL,
  device_price numeric(12, 2) NULL,
  CONSTRAINT inventory_items_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_items_org_id_fkey FOREIGN KEY (org_id)
    REFERENCES public.orgs (id) ON DELETE CASCADE,
  CONSTRAINT inventory_items_ear_side_check CHECK (
    ear_side IS NULL
    OR ear_side = ANY (
      ARRAY['right'::text, 'left'::text, 'bilateral'::text]
    )
  ),
  CONSTRAINT inventory_items_item_type_check CHECK (
    item_type = ANY (
      ARRAY['hearing_aid'::text, 'charger'::text]
    )
  ),
  CONSTRAINT inventory_items_status_check CHECK (
    status = ANY (
      ARRAY['in_stock'::text, 'sold'::text, 'repair'::text]
    )
  )
) TABLESPACE pg_default;

-- NOTE:
-- Barcode is NOT unique. Same model can have same barcode across multiple stock items,
-- and barcode may change with production series. We keep barcode as informational.

-- (Optional) If you ever need barcode search performance later, add a non-unique index.
-- CREATE INDEX IF NOT EXISTS inventory_items_org_barcode_idx
-- ON public.inventory_items USING btree (org_id, barcode)
-- TABLESPACE pg_default
-- WHERE barcode IS NOT NULL AND barcode <> '' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS inventory_items_org_status_idx
ON public.inventory_items USING btree (org_id, status)
TABLESPACE pg_default;

-- Existing composite index (kept)
CREATE INDEX IF NOT EXISTS inventory_items_org_brand_model_idx
ON public.inventory_items USING btree (org_id, brand, model)
TABLESPACE pg_default;

-- New: direct model index (helps when filtering/searching by model without brand)
CREATE INDEX IF NOT EXISTS inventory_items_org_model_idx
ON public.inventory_items USING btree (org_id, model)
TABLESPACE pg_default
WHERE deleted_at IS NULL;

-- ============================================================
-- RLS POLICIES FOR public.inventory_items
-- Exported from Supabase UI (policies tab).
-- ============================================================

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- 1) INSERT: only allow if there exists a profile with same org_id as the row
--    for the current auth.uid().
CREATE POLICY "inventory_items_insert_by_org"
ON public.inventory_items
AS PERMISSIVE
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = inventory_items.org_id
  )
);

-- 2) SELECT: only allow reading rows where user's profile org_id matches row org_id.
CREATE POLICY "inventory_items_select_by_org"
ON public.inventory_items
AS PERMISSIVE
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = inventory_items.org_id
  )
);

-- 3) UPDATE: only allow updating rows within user's org.
CREATE POLICY "inventory_items_update_by_org"
ON public.inventory_items
AS PERMISSIVE
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = inventory_items.org_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = inventory_items.org_id
  )
);

-- NOTE:
-- - No DELETE policy is defined; prefer soft delete via `deleted_at`.
-- - Eğer hard DELETE eklenecekse, org_id kontrolü yukarıdaki ile birebir aynı olmalı.
