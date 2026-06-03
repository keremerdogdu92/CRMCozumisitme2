-- ============================================================
-- 20260603_fix_rls_recursion_and_profile_security_apply.sql
-- ============================================================
-- AMAÇ:
-- 1) current_user_org_id() ve current_user_role() fonksiyonlarını
--    LANGUAGE sql → LANGUAGE plpgsql'e çevirerek PostgreSQL'in
--    inline etmesini engelle. Bu, SECURITY DEFINER yetkisini korur
--    ve profiles RLS recursion sorununu çözer.
--
-- 2) Yeni get_org_profiles() SECURITY DEFINER RPC'si oluştur.
--    Client sadece (id, display_name, role) görebilir.
--    org_id, is_admin, created_at gibi alanlar gizlenir.
--
-- GERİ ALMA:
--    Sorun çıkarsa aynı klasördeki
--    20260603_fix_rls_recursion_and_profile_security_ROLLBACK.sql
--    dosyasını Supabase SQL Editor'de çalıştırın.
--
-- GÜVENLİ: CREATE OR REPLACE kullanılıyor, mevcut politikalar
--           ve grant'lar değiştirilmiyor.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- AŞAMA 1: RLS RECURSION DÜZELTMESİ
-- LANGUAGE sql → LANGUAGE plpgsql
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT p.org_id INTO v_org_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
  RETURN v_org_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT p.role INTO v_role
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
  RETURN v_role;
END;
$$;

-- Yetki ayarları (mevcut grant'larla aynı — tutarlılık için)
REVOKE ALL ON FUNCTION public.current_user_org_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_user_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_org_id() TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO service_role;


-- ────────────────────────────────────────────────────────────
-- AŞAMA 2: GÜVENLİ PROFİL LİSTESİ RPC'Sİ
-- Client artık doğrudan profiles tablosuna SELECT yerine
-- bu RPC'yi çağıracak. Sadece id, display_name, role döner.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_org_profiles()
RETURNS TABLE (
  profile_id uuid,
  display_name text,
  role text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id uuid := public.current_user_org_id();
BEGIN
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN_NO_ORG' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.id, p.display_name, p.role
  FROM public.profiles p
  WHERE p.org_id = v_org_id
  ORDER BY
    CASE WHEN p.role = 'admin' THEN 0 ELSE 1 END,
    p.display_name NULLS LAST,
    p.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_profiles() TO authenticated, service_role;


-- ============================================================
-- MIGRATION TAMAMLANDI
-- Şimdi frontend dosyalarını da güncellemeniz gerekiyor:
--   src/features/tasks/api.ts
--   src/features/settings/UserProfilesCard.tsx
-- (fetchAssignableProfiles ve fetchProfiles fonksiyonlarında
--  .from('profiles') → .rpc('get_org_profiles') değişikliği)
-- ============================================================
