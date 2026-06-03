-- ============================================================
-- 20260603_fix_rls_recursion_and_profile_security_ROLLBACK.sql
-- ============================================================
-- BU DOSYA GERİ ALMA (ROLLBACK) AMAÇLIDIR.
-- Sadece forward migration sorun çıkarırsa çalıştırın.
-- Uygulandığında sistemi migration öncesi durumuna döndürür.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- AŞAMA 2 GERİ ALMA: get_org_profiles RPC'sini kaldır
-- ────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_org_profiles();

-- ────────────────────────────────────────────────────────────
-- AŞAMA 1 GERİ ALMA: Helper fonksiyonları eski haline döndür
-- (LANGUAGE plpgsql → LANGUAGE sql)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.org_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

-- ────────────────────────────────────────────────────────────
-- Yetki ayarları (değişmedi ama tutarlılık için tekrar uygula)
-- ────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.current_user_org_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_user_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_org_id() TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO service_role;

-- ============================================================
-- ROLLBACK TAMAMLANDI
-- Bu scripti çalıştırdıktan sonra frontend'i de eski haline
-- döndürmeniz gerekir (git revert veya eski branch'e geçiş).
-- ============================================================
