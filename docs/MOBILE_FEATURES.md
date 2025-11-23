## 3) `docs/mobile/MOBILE_FEATURES.md`

```markdown
# Mobile Feature Guidelines

Bu doküman; her ana feature sayfası için mobil odaklı özel kuralları içerir.

Kapsam:
- Patients
- Meetings
- Trials
- References
- Profit Calculator
- Dashboard (özet)

---

## 1. Patients Page

### 1.1. Liste

- Patients tablosu:
  - Minimal sütun seti:
    - Ad Soyad
    - Telefon
    - Kayıt Tarihi
    - SGK durumu (ikon / badge)
  - Uzun alanlar (adres vs.) mobil listede gösterilmez; detay çekmecesine bırakılır.
- Tablo wrapper:
  - `overflow-x-auto rounded-lg border border-slate-200 bg-white`

### 1.2. Filtre / Arama

- Arama çubuğu:
  - `w-full`, tek satır input.
- Filtreler varsa:
  - `flex flex-wrap items-center justify-between gap-2`

### 1.3. Patient Detail Drawer

- Sekmeler:
  - `info` (default), `devices`, `meetings`, `payments`, `audiogram`
- Mobilde:
  - Sekmeler üstte scroll gerektirmeyecek şekilde `flex-wrap`.
  - İçeriğin yüksekliği uzun olduğunda normal dikey scroll.

**Özel:**  
- Ödemeler sekmesi:
  - Üstte özet kutu (toplam senet ödemesi).
  - Altta tablo; satır başına tarih, tutar, yöntem, kısa not.

---

## 2. Meetings Page

### 2.1. Form

- **Yeni Görüşme** kartı:
  - Önde; üst kısımda form, altında liste.
  - Grid yapısı:
    - Görüşme tipi + kişi: `grid gap-3 sm:grid-cols-2`
    - Tarihler: `grid gap-3 sm:grid-cols-2`
- Senet ödeme bölümü:
  - Sarı kutu (amber) içinde tek kolon.
  - Checkbox satırı + 2 alan (tutar, not) → `sm:grid-cols-2`

Mobil öncelik:

- Tüm alanlar alt alta rahat okunmalı.
- Bölümler arasında `space-y-3` yeterli.

### 2.2. Liste

- Meetings tablosu:
  - Sütunlar:
    - Tarih
    - Tip
    - Kişi
    - Başlık
    - Sonraki Tarih
    - Memnuniyet
    - Not (kısaltılmış)
- Not alanı:
  - Maks 120 karakter, sonuna `…` ekle.
- Mobilde kritik alan hiyerarşisi:
  1. Tarih
  2. Kişi
  3. Tip
  4. Başlık
  5. Sonraki Tarih
  6. Memnuniyet
  7. Not (özet)

---

## 3. Trials Page

### 3.1. Liste

- Trial tablosu, mobilde daha sıkışık:
  - Tam isim
  - Telefon
  - İlk görüşme tarihi
  - Sonraki görüşme tarihi
  - Referans bilgisi opsiyonel (ikon / kısa ad)
- Çok geniş alanlardan kaçın:
  - Referans adı varsa 15–20 karakterde kesilebilir.

### 3.2. Form (Yeni Deneme)

- Formda çok sayıda alan (cihaz satırları vb.) olduğundan:
  - Cihaz satırları mümkün olduğunca **yatayda dar**, dikeyde detaylı olmalı.
  - Device grid’i:
    - Mobil: her satır bir blok (marka, model, taraf, fiyatlar alt alta).
    - Masaüstü: `sm:grid-cols-4` gibi daha geniş layout.

### 3.3. Detay Çekmecesi

- Device listesi:
  - Mobilde tek sütun liste:
    - `Brand / Model`
    - `Side`
    - `Quote Price`
  - Gerekirse alt satırda detay (örneğin: “left/right/both” açıklaması).

---

## 4. References Page

### 4.1. Liste

- Referans listesi:
  - Ad soyad
  - Telefon
  - Rol / tür (ör: Doktor, Hasta, Firma)
  - Komisyon / ikram özetleri ileride eklenecek.
- Mobilde:
  - Mümkün olduğunca 3–4 sütun ile sınırlı.

### 4.2. Detay

- Referans detay çekmecesi ileride Meetings ile entegre olacak:
  - Görüşmeler sekmesi → sadece referans ile yapılan görüşmeler.
  - Ödemeler / ikramlar sekmesi → referansa bağlı hesaplar.

---

## 5. Profit Calculator Page

### 5.1. Form

- Tek cihaz veya çift cihaz hesapları için:
  - Form alanları tek sütun:
    - Ürün fiyatı, iskonto, taksit sayısı vs.
  - `sm:` altında iki sütun yapmaya gerek yok; burada dikey form, mobil için daha okunur.

### 5.2. Sonuç Alanı

- Sonuç kutusu:
  - `rounded-md border border-slate-200 bg-slate-50 px-3 py-2`
  - İçinde:
    - Toplam kâr
    - Ciro
    - Komisyon sonrası net
  - Mobilde büyük rakam:
    ```tsx
    className="text-lg font-bold text-emerald-900"
    ```

---

## 6. Dashboard Page (Varsa / Gelecek İçin)

Mobil odaklı dashboard kuralları:

1. En üstte özet kartlar (3–4 adet):
   - Bir satırda en fazla 2 kart:
     ```tsx
     className="grid gap-3 grid-cols-1 sm:grid-cols-2"
     ```
2. Altında:
   - Kısa tablolar (ör: son 5 meeting, en son 5 ödeme).
   - Grafik kullanımı minimum; grafikleri mobil için tek sütun, tam genişlikte planla.

---

Bu dosya, feature’lar bazında “mobilde ne önemli, ne nasıl gösterilsin?” sorusuna cevap verir.  
Detaylı tablo kuralları için `MOBILE_TABLE_RULES.md`, test için `MOBILE_QA_CHECKLIST.md` kullanılmalıdır.
