-- DB/schema/core/catalog_match_helpers.sql
-- Shared SQL normalization helper for catalog/inventory model matching.

CREATE OR REPLACE FUNCTION public.normalize_catalog_match_text(p_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT btrim(
    regexp_replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(
                        replace(
                          lower(replace(replace(coalesce(p_raw, ''), 'İ', 'i'), 'I', 'i')),
                          'ı', 'i'
                        ),
                        'ğ', 'g'
                      ),
                      'ü', 'u'
                    ),
                    'ş', 's'
                  ),
                  'ö', 'o'
                ),
                'ç', 'c'
              ),
              'â', 'a'
            ),
            'î', 'i'
          ),
          'û', 'u'
        ),
        'ê', 'e'
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.catalog_model_match_key(
  p_brand text,
  p_model text,
  p_item_type text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    public.normalize_catalog_match_text(p_brand)
    || '::'
    || CASE
      WHEN public.normalize_catalog_match_text(p_brand) = 'rexton'
        AND p_item_type = 'hearing_aid'
        AND public.normalize_catalog_match_text(p_model) LIKE 'b li %'
      THEN 'bicore ' || public.normalize_catalog_match_text(p_model)
      ELSE public.normalize_catalog_match_text(p_model)
    END
    || '::'
    || coalesce(p_item_type, '');
$$;
