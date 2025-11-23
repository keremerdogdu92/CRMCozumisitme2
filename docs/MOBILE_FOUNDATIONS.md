1) docs/mobile/MOBILE_FOUNDATIONS.md
# Mobile Foundations (Çözüm İşitme CRM)

Amaç: Tüm ekranların **320–400px genişlikte** rahat kullanılabilmesi, masaüstünde de bozulmaması.  
Hedef cihaz: Dikey telefon ekranı (min ~360px).

Bu doküman, mobil için temel tasarım ve kodlama kurallarını özetler.  
Detaylı pattern ve ekran bazlı kurallar diğer dosyalardadır.

---

## 1. Layout Kuralları

### 1.1. Genel Genişlik

- Sayfa container’ları:
  - `w-full` kullanılmalı.
  - Global layout (AppShell) dışında ekstra `max-w-*` sınırı verilmemeli.
- Mobile-first düşün:
  - Varsayılan stil mobil içindir.
  - Masaüstü için `sm:`, `md:` vs. ile genişlet.

### 1.2. Grid Kullanımı

Standart form/grid pattern’i:

```tsx
<div className="grid gap-3 sm:grid-cols-2">
  {/* field 1 */}
  {/* field 2 */}
</div>


Mobil: tek sütun (alt alta).

sm: ve üzeri: iki sütun.

Daha fazla sütun gerekiyorsa:

Asgari: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3

3+ sütunlu layoutları sadece masaüstü için planla.

1.3. Flex Satırları

Filtre barları, buton grupları, etiket barları:

className="flex flex-wrap items-center gap-1.5"


flex-wrap zorunlu:

Aksi halde küçük ekranda butonlar ekran dışına taşar.

“Sağ hizalı” kullanımlar için:

className="flex flex-wrap items-center justify-between gap-2"

1.4. Margin & Padding

Sayfa genel padding: p-4

Kart içi padding: p-3 veya p-4

Grid aralığı:

Formlar: gap-3

Sık liste header/footer: gap-2

2. Tipografi
2.1. Başlıklar

Sayfa başlığı:

className="text-lg font-semibold text-slate-900"


Kart başlığı:

className="text-sm font-semibold text-slate-900"


Sekme başlığı / bölüm başlığı:

className="text-xs font-semibold uppercase text-slate-500"

2.2. İçerik Metinleri

Ana metin: text-sm text-slate-800

Açıklama / helper text:

text-xs text-slate-500 veya

text-[11px] text-slate-500

Tablo hücreleri: text-xs text-slate-800 veya text-slate-600 (sekonder bilgi).

2.3. Renk Kullanımı

Ana metin: text-slate-800 / text-slate-900

Açıklama: text-slate-500

Uyarı / bilgi:

Hata: text-red-600

Uyarı: text-amber-800 / text-amber-900

Pozitif / toplam: text-emerald-800 / text-emerald-900

3. Form Elemanları
3.1. Input / Select

Varsayılan form kontrolü:

className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"


Tüm form input’larında tutarlı görünüm için bu pattern kullanılmalı.

Sadece özel durumlarda (uyarı kartları vb.) renk varyasyonu (amber/emerald) verilebilir.

Label:

className="mb-1 block text-xs font-medium text-slate-700"

3.2. Textarea

Minimum satır: rows={3}

Büyük açıklama alanları için max rows={5}.

Mobilde çok yüksek textarea’lardan kaçın.

3.3. Checkbox / Toggle

Ana checkbox:

className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"


Alt seviyede (SGK alt maddeleri vb.):

className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"


Yanındaki text: text-xs text-slate-700

4. Tablolar ve Listeler

Temel tablo wrapper pattern’i:

<div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
  <table className="min-w-full text-left text-xs">
    {/* thead + tbody */}
  </table>
</div>


Her tabloda:

overflow-x-auto ile yatay scroll serbest.

min-w-full ile sütun genişlikleri dengeli.

Header satırı:

<thead className="bg-slate-50 text-slate-600">
  <tr>
    <th className="px-3 py-2 font-medium">...</th>
  </tr>
</thead>


Satır:

<tr className="border-t border-slate-100">
  <td className="px-3 py-2 text-slate-800">...</td>
</tr>

5. Drawer ve Yan Paneller

SideDrawer içerisine tekrar kart çerçevesi ekleme;
içerik doğrudan padding’li alan üzerine oturmalı.

İçerik blokları:

Başlık: text-xs font-semibold uppercase text-slate-500

Kutu:

className="space-y-1 rounded-md border border-slate-100 bg-slate-50 px-3 py-2"


Sekme barı:

<div className="flex flex-wrap gap-1">
  <button
    className={
      'rounded-md px-3 py-1.5 text-xs font-medium ' +
      (active
        ? 'border border-primary-200 bg-primary-50 text-primary-700'
        : 'border border-transparent text-slate-600 hover:bg-slate-50')
    }
  >
    Sekme
  </button>
</div>

6. Butonlar
6.1. Primary CTA
className="inline-flex items-center rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"

6.2. Secondary
className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"

6.3. Filter Chips

Aktif:

"bg-primary-50 border-primary-300 text-primary-700"


Pasif:

"bg-white border-slate-200 text-slate-600 hover:bg-slate-50"

7. Hata ve Boş Durum Mesajları

Boş liste:

className="text-xs text-slate-500"


Metin örneği:

Henüz kayıtlı görüşme yok. Yukarıdan yeni bir görüşme ekleyebilirsiniz.

Hata:

className="text-xs text-red-600"


Metin örneği:

Kayıt sırasında bir hata oluştu: MEET_STEP_INSERT: ...

8. Uygulama Prensibi

Yeni component yazarken şu soruları sor:

Bu layout 360px genişlikte tek sütun halinde okunabilir mi?

Tüm butonlar ve filtreler flex-wrap ile ekran içine sığıyor mu?

Tablolarda gereksiz sütun var mı, kısaltılabilir mi?

Büyük responsive refaktörler, ayrı bir “Mobile QA Sprint” altında planlanmalı.


---
