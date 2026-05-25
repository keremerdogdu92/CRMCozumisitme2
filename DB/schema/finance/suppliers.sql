-- DB/schema/finance/suppliers.sql
-- Purpose: Supplier payable ledger. Patient Tim/Sivantos payments reduce payable balances.

CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  deleted_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  delete_reason text NULL,
  CONSTRAINT suppliers_name_unique_active UNIQUE (org_id, name)
);

CREATE TABLE IF NOT EXISTS public.supplier_payment_method_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  payment_method text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_payment_method_mappings_unique UNIQUE (org_id, payment_method)
);

CREATE TABLE IF NOT EXISTS public.supplier_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  entry_type text NOT NULL,
  amount numeric(14, 2) NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  description text NULL,
  meeting_payment_id uuid NULL REFERENCES public.meeting_payments(id) ON DELETE SET NULL,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  deleted_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  delete_reason text NULL,
  CONSTRAINT supplier_ledger_entries_type_check CHECK (
    entry_type = ANY (ARRAY['opening_debt'::text, 'manual_debt'::text, 'invoice_debt'::text, 'payment'::text, 'patient_payment'::text, 'adjustment'::text])
  ),
  CONSTRAINT supplier_ledger_entries_amount_check CHECK (amount <> 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS supplier_ledger_entries_meeting_payment_unique
  ON public.supplier_ledger_entries (meeting_payment_id)
  WHERE meeting_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS supplier_ledger_entries_lookup_idx
  ON public.supplier_ledger_entries (org_id, supplier_id, occurred_at)
  WHERE deleted_at IS NULL;

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payment_method_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_ledger_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suppliers_select_by_org ON public.suppliers;
DROP POLICY IF EXISTS suppliers_write_by_org ON public.suppliers;
DROP POLICY IF EXISTS suppliers_insert_by_org ON public.suppliers;
DROP POLICY IF EXISTS suppliers_update_by_org ON public.suppliers;
DROP POLICY IF EXISTS suppliers_delete_by_org ON public.suppliers;
DROP POLICY IF EXISTS supplier_mappings_select_by_org ON public.supplier_payment_method_mappings;
DROP POLICY IF EXISTS supplier_mappings_write_admin ON public.supplier_payment_method_mappings;
DROP POLICY IF EXISTS supplier_mappings_insert_admin ON public.supplier_payment_method_mappings;
DROP POLICY IF EXISTS supplier_mappings_update_admin ON public.supplier_payment_method_mappings;
DROP POLICY IF EXISTS supplier_mappings_delete_admin ON public.supplier_payment_method_mappings;
DROP POLICY IF EXISTS supplier_ledger_select_by_org ON public.supplier_ledger_entries;
DROP POLICY IF EXISTS supplier_ledger_write_by_org ON public.supplier_ledger_entries;
DROP POLICY IF EXISTS supplier_ledger_insert_by_org ON public.supplier_ledger_entries;
DROP POLICY IF EXISTS supplier_ledger_update_by_org ON public.supplier_ledger_entries;
DROP POLICY IF EXISTS supplier_ledger_delete_by_org ON public.supplier_ledger_entries;

CREATE POLICY suppliers_select_by_org
ON public.suppliers FOR SELECT TO authenticated
USING (org_id = public.current_user_org_id());

CREATE POLICY suppliers_insert_by_org
ON public.suppliers FOR INSERT TO authenticated
WITH CHECK (org_id = public.current_user_org_id());

CREATE POLICY suppliers_update_by_org
ON public.suppliers FOR UPDATE TO authenticated
USING (org_id = public.current_user_org_id())
WITH CHECK (org_id = public.current_user_org_id());

CREATE POLICY suppliers_delete_by_org
ON public.suppliers FOR DELETE TO authenticated
USING (org_id = public.current_user_org_id());

CREATE POLICY supplier_mappings_select_by_org
ON public.supplier_payment_method_mappings FOR SELECT TO authenticated
USING (org_id = public.current_user_org_id());

CREATE POLICY supplier_mappings_insert_admin
ON public.supplier_payment_method_mappings FOR INSERT TO authenticated
WITH CHECK (org_id = public.current_user_org_id() AND public.current_user_role() = 'admin');

CREATE POLICY supplier_mappings_update_admin
ON public.supplier_payment_method_mappings FOR UPDATE TO authenticated
USING (org_id = public.current_user_org_id() AND public.current_user_role() = 'admin')
WITH CHECK (org_id = public.current_user_org_id() AND public.current_user_role() = 'admin');

CREATE POLICY supplier_mappings_delete_admin
ON public.supplier_payment_method_mappings FOR DELETE TO authenticated
USING (org_id = public.current_user_org_id() AND public.current_user_role() = 'admin');

CREATE POLICY supplier_ledger_select_by_org
ON public.supplier_ledger_entries FOR SELECT TO authenticated
USING (org_id = public.current_user_org_id());

CREATE POLICY supplier_ledger_insert_by_org
ON public.supplier_ledger_entries FOR INSERT TO authenticated
WITH CHECK (org_id = public.current_user_org_id());

CREATE POLICY supplier_ledger_update_by_org
ON public.supplier_ledger_entries FOR UPDATE TO authenticated
USING (org_id = public.current_user_org_id())
WITH CHECK (org_id = public.current_user_org_id());

CREATE POLICY supplier_ledger_delete_by_org
ON public.supplier_ledger_entries FOR DELETE TO authenticated
USING (org_id = public.current_user_org_id());

REVOKE ALL ON TABLE public.suppliers FROM anon;
REVOKE ALL ON TABLE public.supplier_payment_method_mappings FROM anon;
REVOKE ALL ON TABLE public.supplier_ledger_entries FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.suppliers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.supplier_payment_method_mappings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.supplier_ledger_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.suppliers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.supplier_payment_method_mappings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.supplier_ledger_entries TO service_role;

CREATE OR REPLACE FUNCTION public.sync_supplier_ledger_for_meeting_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_supplier_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.supplier_ledger_entries
    SET deleted_at = now(),
        delete_reason = 'meeting payment deleted'
    WHERE meeting_payment_id = OLD.id
      AND deleted_at IS NULL;
    RETURN OLD;
  END IF;

  SELECT m.supplier_id
  INTO v_supplier_id
  FROM public.supplier_payment_method_mappings m
  WHERE m.org_id = NEW.org_id
    AND lower(m.payment_method) = lower(NEW.method)
  LIMIT 1;

  IF v_supplier_id IS NULL OR NEW.deleted_at IS NOT NULL THEN
    UPDATE public.supplier_ledger_entries
    SET deleted_at = now(),
        delete_reason = 'payment method unmapped or payment deleted'
    WHERE meeting_payment_id = NEW.id
      AND deleted_at IS NULL;
    RETURN NEW;
  END IF;

  INSERT INTO public.supplier_ledger_entries (
    org_id, supplier_id, entry_type, amount, occurred_at, description,
    meeting_payment_id, created_by
  )
  VALUES (
    NEW.org_id,
    v_supplier_id,
    'patient_payment',
    -abs(NEW.amount),
    NEW.created_at,
    coalesce(NEW.note, 'Hasta satisindan tedarikciye cekilen tutar'),
    NEW.id,
    auth.uid()
  )
  ON CONFLICT (meeting_payment_id)
  WHERE meeting_payment_id IS NOT NULL
  DO UPDATE SET
    supplier_id = EXCLUDED.supplier_id,
    amount = EXCLUDED.amount,
    occurred_at = EXCLUDED.occurred_at,
    description = EXCLUDED.description,
    deleted_at = NULL,
    delete_reason = NULL;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_supplier_ledger_meeting_payment ON public.meeting_payments;
CREATE TRIGGER trg_supplier_ledger_meeting_payment
AFTER INSERT OR UPDATE OR DELETE ON public.meeting_payments
FOR EACH ROW
EXECUTE FUNCTION public.sync_supplier_ledger_for_meeting_payment();

REVOKE ALL ON FUNCTION public.sync_supplier_ledger_for_meeting_payment() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_supplier_ledger_for_meeting_payment() TO service_role;
