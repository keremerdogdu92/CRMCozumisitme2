# Mobile UI Guide (Çözüm İşitme CRM)

Amaç: Tüm ekranların **320–400px genişlikte** rahat kullanılabilmesi, masaüstünde de bozulmaması.  
Hedef cihaz: Dikey telefon ekranı (min 360px).

---

## 1. Genel Layout Kuralları

1. **Kapsayıcı genişlik**
   - Sayfa: her yerde `w-full` kullan.
   - Ekstra sabit genişlik verme (`max-w-[400px]` gibi) → sadece gerçekten gerekiyorsa ve component özelinde.

2. **Grid kullanımı**
   - Varsayılan her grid **tek sütun** olsun:
     ```tsx
     className="grid gap-3 sm:grid-cols-2"
     ```
   - Yeni her formda ikili yerleşim gerekiyorsa bu pattern’i kullan:
     - Mobil: 1 sütun (alt alta)
     - `sm:` ve üstü: 2 sütun

3. **Flex satırları**
   - Filtre barları, buton grupları:
     ```tsx
     className="flex flex-wrap items-center gap-1.5"
     ```
   - `flex-wrap` **zorunlu**; aksi halde küçük ekranda taşma yapar.

4. **Margin & padding**
   - Sayfa padding: `p-4`
   - Kart içi: `p-3` veya `p-4`
   - Grid aralığı: genelde `gap-3`

---

## 2. Tipografi

1. **Başlıklar**
   - Sayfa başlığı: `text-lg font-semibold`
   - Kart başlığı: `text-sm font-semibold`

2. **Metinler**
   - Ana metin: `text-sm`
   - Açıklama / helper text: `text-xs` veya `text-[11px]`
   - Tablo içi text: `text-xs`

3. **Renkler**
   - Ana metin: `text-slate-800/900`
   - Açıklama: `text-slate-500`
   - Uyarı metni:
     - Hata: `text-red-600`
     - Uyarı: `text-amber-800/900`
     - Bilgi: `text-slate-500`

---

## 3. Formlar (Inputs, Selectler, Checkboxlar)

1. **Input / select stil şablonu**
   ```tsx
   className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
