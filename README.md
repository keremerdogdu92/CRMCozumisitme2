# Çözüm İşitme CRM

Supabase + Netlify + React tabanlı işitme cihazı klinik yönetim sistemi. Bu depo, şema ve RLS betikleri ile frontend uygulaması için temel iskeleti içerir.

## Başlangıç

```bash
npm install
npm run dev
```

## Proje Yapısı

- `supabase/` — Veritabanı şeması, RLS kuralları, görünümler ve fonksiyonlar için SQL dosyaları.
- `src/` — React + TypeScript + Tailwind arayüzü.
- `netlify/functions/` — Netlify edge & arka plan fonksiyonları.
- `docs/` — Kurulum, kullanıcı kılavuzları ve teknik dokümantasyon.

## Sonraki Adımlar

1. `supabase/schema.sql` içerisinde tablo yapılarının tanımlanması.
2. `supabase/rls.sql` dosyasında RLS kurallarının eklenmesi.
3. Frontend modüllerinin Supabase veritabanına bağlanması.
4. Netlify fonksiyonları ile günlük rapor ve sağlık kontrolü servislerinin tamamlanması.
