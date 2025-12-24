-- db/schema/core/orgs.sql
-- Purpose: Supabase table definition for `public.orgs`.
-- Stores organizations (tenants). One org groups users and org-scoped data.
-- Source of truth: Repo (kept aligned with live DB).
--
-- v1.0.0:
-- - Table: public.orgs

CREATE TABLE IF NOT EXISTS public.orgs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT orgs_pkey PRIMARY KEY (id)
);

-- Grants (RLS is not enabled here by default; org creation should be controlled by server-side code)
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.orgs TO service_role;
GRANT SELECT ON TABLE public.orgs TO authenticated;
