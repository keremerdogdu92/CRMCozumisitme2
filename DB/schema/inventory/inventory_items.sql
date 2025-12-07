-- db/schema/inventory/inventory_items.sql
-- Purpose: Supabase table definition for `inventory_items`.
-- Includes: CREATE TABLE, constraints, and indexes for inventory stock items.
-- Source of truth: Supabase table editor / migrations.
-- NOTE: RLS policies for `inventory_items` will be added in a separate pass below.

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
  CONSTRAINT inventory_items_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_items_org_id_fkey FOREIGN KEY (org_id)
    REFERENCES orgs (id) ON DELETE CASCADE,
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

CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_org_barcode_idx
ON public.inventory_items USING btree (org_id, barcode)
TABLESPACE pg_default
WHERE barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS inventory_items_org_status_idx
ON public.inventory_items USING btree (org_id, status)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS inventory_items_org_brand_model_idx
ON public.inventory_items USING btree (org_id, brand, model)
TABLESPACE pg_default;

-- RLS POLICIES PLACEHOLDER
-- TODO: Export and paste the RLS policy definitions for `public.inventory_items` here.
-- Example structure (do NOT invent policies, just paste from Supabase):
--   ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY ... ON public.inventory_items USING (...);
